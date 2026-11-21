// Approximate visitor location from a local MaxMind DB file (GeoIP2/GeoLite2 City
// or DB-IP City Lite), so visitor IP addresses never leave the server.
//
// The file is read in 4 KiB pages through one descriptor instead of being loaded:
// the city database is about 130 MB and a lookup touches only a few pages. When
// the monthly update replaces the file, the next lookup after a short check
// interval opens the new one.
import { closeSync, fstatSync, openSync, readSync, statSync } from 'node:fs';
import { isIP } from 'node:net';

const METADATA_MARKER = Buffer.from('abcdef4d61784d696e642e636f6d', 'hex');
const PAGE = 4096;
const CACHED_PAGES = 512;
const RECHECK_MS = 10 * 60 * 1000;

class Reader {
  constructor(file) {
    this.fd = openSync(file, 'r');
    try {
      const stat = fstatSync(this.fd);
      this.size = stat.size;
      this.identity = `${stat.ino}:${stat.mtimeMs}:${stat.size}`;
      this.pages = new Map();
      this.metadata = this.readMetadata();
      const { node_count: nodes, record_size: recordSize, ip_version: version } = this.metadata;
      if (![24, 28, 32].includes(recordSize) || !Number.isInteger(nodes) || nodes < 1)
        throw new Error('Unsupported MaxMind DB search tree');
      this.nodes = nodes;
      this.recordSize = recordSize;
      this.nodeBytes = recordSize / 4;
      this.dataStart = nodes * this.nodeBytes + 16;
      this.version = version;
      // IPv4 addresses live under ::/96 in an IPv6 tree.
      this.ipv4Start = 0;
      if (version === 6) {
        let node = 0;
        for (let bit = 0; bit < 96 && node < nodes; bit++) node = this.record(node, 0);
        this.ipv4Start = node;
      }
    } catch (error) {
      closeSync(this.fd);
      throw error;
    }
  }

  close() {
    closeSync(this.fd);
    this.pages.clear();
  }

  page(index) {
    let page = this.pages.get(index);
    if (page) {
      // Keep recently used pages at the end of the Map (least recently used first).
      this.pages.delete(index);
      this.pages.set(index, page);
      return page;
    }
    page = Buffer.alloc(PAGE);
    const length = readSync(this.fd, page, 0, PAGE, index * PAGE);
    page = page.subarray(0, length);
    this.pages.set(index, page);
    if (this.pages.size > CACHED_PAGES) this.pages.delete(this.pages.keys().next().value);
    return page;
  }

  bytes(offset, length) {
    if (offset < 0 || offset + length > this.size) throw new Error('MaxMind DB read past the end of the file');
    const first = Math.floor(offset / PAGE);
    const last = Math.floor((offset + length - 1) / PAGE);
    if (first === last) return this.page(first).subarray(offset % PAGE, (offset % PAGE) + length);
    const out = Buffer.alloc(length);
    let written = 0;
    for (let index = first; index <= last; index++) {
      const page = this.page(index);
      const start = index === first ? offset % PAGE : 0;
      const end = Math.min(page.length, start + length - written);
      page.copy(out, written, start, end);
      written += end - start;
    }
    return out;
  }

  readMetadata() {
    const window = Math.min(this.size, 128 * 1024);
    const tail = Buffer.alloc(window);
    readSync(this.fd, tail, 0, window, this.size - window);
    const at = tail.lastIndexOf(METADATA_MARKER);
    if (at < 0) throw new Error('Not a MaxMind DB file');
    const start = this.size - window + at + METADATA_MARKER.length;
    return this.decode(start, start)[0];
  }

  record(node, bit) {
    const bytes = this.bytes(node * this.nodeBytes, this.nodeBytes);
    if (this.recordSize === 24) return bit ? bytes.readUIntBE(3, 3) : bytes.readUIntBE(0, 3);
    if (this.recordSize === 28)
      return bit
        ? ((bytes[3] & 0x0f) << 24) + bytes.readUIntBE(4, 3)
        : ((bytes[3] & 0xf0) << 20) + bytes.readUIntBE(0, 3);
    return bit ? bytes.readUInt32BE(4) : bytes.readUInt32BE(0);
  }

  /** Decodes the value at `offset`; pointers are relative to `base`. Returns [value, next offset]. */
  decode(offset, base = this.dataStart) {
    const control = this.bytes(offset++, 1)[0];
    let type = control >> 5;
    if (type === 1) {
      const sizeBits = (control >> 3) & 0x3;
      const extra = this.bytes(offset, sizeBits + 1);
      let pointer;
      if (sizeBits === 0) pointer = ((control & 0x7) << 8) | extra[0];
      else if (sizeBits === 1) pointer = ((control & 0x7) << 16) + extra.readUInt16BE(0) + 2048;
      else if (sizeBits === 2) pointer = (control & 0x7) * 0x1000000 + extra.readUIntBE(0, 3) + 526336;
      else pointer = extra.readUInt32BE(0);
      return [this.decode(base + pointer, base)[0], offset + sizeBits + 1];
    }
    if (type === 0) type = 7 + this.bytes(offset++, 1)[0];
    let size = control & 0x1f;
    if (size === 29) size = 29 + this.bytes(offset++, 1)[0];
    else if (size === 30) {
      size = 285 + this.bytes(offset, 2).readUInt16BE(0);
      offset += 2;
    } else if (size === 31) {
      size = 65821 + this.bytes(offset, 3).readUIntBE(0, 3);
      offset += 3;
    }
    switch (type) {
      case 2:
        return [this.bytes(offset, size).toString('utf8'), offset + size];
      case 3:
        return [this.bytes(offset, 8).readDoubleBE(0), offset + 8];
      case 4:
        return [Buffer.from(this.bytes(offset, size)), offset + size];
      case 5:
      case 6:
      case 9:
      case 10: {
        let value = 0n;
        for (const byte of this.bytes(offset, size)) value = (value << 8n) | BigInt(byte);
        return [value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value, offset + size];
      }
      case 7: {
        const map = {};
        for (let index = 0; index < size; index++) {
          const [key, afterKey] = this.decode(offset, base);
          const [value, afterValue] = this.decode(afterKey, base);
          map[key] = value;
          offset = afterValue;
        }
        return [map, offset];
      }
      case 8: {
        const bytes = Buffer.alloc(4);
        this.bytes(offset, size).copy(bytes, 4 - size);
        return [bytes.readInt32BE(0), offset + size];
      }
      case 11: {
        const array = [];
        for (let index = 0; index < size; index++) {
          const [value, next] = this.decode(offset, base);
          array.push(value);
          offset = next;
        }
        return [array, offset];
      }
      case 14:
        return [size !== 0, offset];
      case 15:
        return [this.bytes(offset, 4).readFloatBE(0), offset + 4];
      default:
        throw new Error(`Unsupported MaxMind DB data type ${type}`);
    }
  }

  lookup(address) {
    let node = 0;
    let bits;
    if (address.length === 4) {
      if (this.version === 6) node = this.ipv4Start;
      bits = 32;
    } else {
      if (this.version === 4) return null;
      bits = 128;
    }
    for (let bit = 0; bit < bits && node < this.nodes; bit++) {
      const value = (address[bit >> 3] >> (7 - (bit & 7))) & 1;
      node = this.record(node, value);
    }
    if (node === this.nodes) return null;
    if (node < this.nodes) throw new Error('Invalid MaxMind DB search tree');
    return this.decode(this.dataStart + (node - this.nodes) - 16)[0];
  }
}

/** The address as 4 or 16 bytes; an IPv4-mapped IPv6 address becomes IPv4. Null when invalid. */
export function addressBytes(value) {
  const text = String(value ?? '')
    .trim()
    .replace(/%.*$/, '');
  const kind = isIP(text);
  if (kind === 4) return Buffer.from(text.split('.').map(Number));
  if (kind !== 6) return null;
  // Rewrite a trailing dotted IPv4 part (::ffff:1.2.3.4) as two hex groups.
  const expanded = text.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) =>
    [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)].join(':'),
  );
  const halves = expanded.split('::');
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const groups = halves.length > 1 ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail] : head;
  if (groups.length !== 8) return null;
  const bytes = Buffer.alloc(16);
  groups.forEach((group, index) => bytes.writeUInt16BE(parseInt(group, 16), index * 2));
  if (bytes.subarray(0, 10).every(byte => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff)
    return Buffer.from(bytes.subarray(12));
  return bytes;
}

const name = (item, language) => item?.names?.[language] || item?.names?.en || '';

/** The fields Poetio shows from a City record. */
export function cityFields(record) {
  if (!record || typeof record !== 'object') return null;
  const subdivision = Array.isArray(record.subdivisions) ? record.subdivisions[0] : undefined;
  const country = record.country ?? record.registered_country;
  return {
    country: typeof country?.iso_code === 'string' ? country.iso_code.toUpperCase() : '',
    region: name(subdivision, 'en'),
    city: name(record.city, 'en'),
  };
}

/**
 * A lazy locator for one database file. It opens the file on first use, reopens
 * it when the monthly update replaces it, and answers null while it is missing.
 */
export function openGeoIp(file, { recheckMs = RECHECK_MS } = {}) {
  let reader;
  let checkedAt = 0;
  let missingLogged = false;

  function current() {
    const now = Date.now();
    if (now - checkedAt < recheckMs) return reader;
    checkedAt = now;
    let identity;
    try {
      const stat = statSync(file);
      identity = `${stat.ino}:${stat.mtimeMs}:${stat.size}`;
    } catch {
      reader?.close();
      reader = undefined;
      return undefined;
    }
    if (reader?.identity === identity) return reader;
    try {
      const next = new Reader(file);
      reader?.close();
      reader = next;
      missingLogged = false;
    } catch (error) {
      if (!missingLogged) console.error('GeoIP database unavailable', error);
      missingLogged = true;
    }
    return reader;
  }

  return {
    /** Country (ISO code), region and city for an IP address, or null. */
    lookup(ip) {
      const address = addressBytes(ip);
      if (!address) return null;
      const active = current();
      if (!active) return null;
      try {
        return cityFields(active.lookup(address));
      } catch (error) {
        console.error('GeoIP lookup failed', error);
        return null;
      }
    },
    /** Database description for the administration page, or null when none is installed. */
    info() {
      const active = current();
      if (!active) return null;
      const { database_type: type, build_epoch: built } = active.metadata;
      return { type: String(type ?? ''), built: Number(built ?? 0) * 1000 };
    },
    close() {
      reader?.close();
      reader = undefined;
    },
  };
}
