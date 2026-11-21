import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addressBytes, openGeoIp } from '../server/geoip.mjs';

// MaxMind's public test database; expected values come from its source JSON.
const FIXTURE = fileURLToPath(new URL('./fixtures/geoip/GeoIP2-City-Test.mmdb', import.meta.url));

test('looks up city, region and country for IPv4, IPv6 and IPv4-mapped addresses', t => {
  const geo = openGeoIp(FIXTURE);
  t.after(() => geo.close());
  assert.deepEqual(geo.lookup('81.2.69.142'), { country: 'GB', region: 'England', city: 'London' });
  assert.deepEqual(geo.lookup('::ffff:81.2.69.142'), { country: 'GB', region: 'England', city: 'London' });
  assert.deepEqual(geo.lookup('2.125.160.216'), { country: 'GB', region: 'England', city: 'Boxford' });
  assert.deepEqual(geo.lookup('89.160.20.112'), { country: 'SE', region: 'Östergötland County', city: 'Linköping' });
  assert.deepEqual(geo.lookup('216.160.83.56'), { country: 'US', region: 'Washington', city: 'Milton' });
  assert.deepEqual(geo.lookup('2001:218::1'), { country: 'JP', region: '', city: '' });
  // Not in the database, private, or not an address at all.
  for (const ip of ['1.1.1.1', '127.0.0.1', '', 'not-an-ip', '999.1.1.1']) assert.equal(geo.lookup(ip), null, ip);
  assert.deepEqual(geo.info(), { type: 'GeoIP2-City', built: geo.info().built });
  assert.ok(geo.info().built > Date.UTC(2015, 0, 1));
});

test('parses IPv6 notations into 16 bytes and IPv4-mapped ones into 4', () => {
  assert.equal(addressBytes('::ffff:1.2.3.4').toString('hex'), '01020304');
  assert.equal(addressBytes('2001:db8::1').toString('hex'), '20010db8000000000000000000000001');
  assert.equal(addressBytes('::1').toString('hex'), '00000000000000000000000000000001');
  assert.equal(addressBytes('1::').toString('hex'), '00010000000000000000000000000000');
  assert.equal(addressBytes('fe80::1%eth0').toString('hex'), 'fe800000000000000000000000000001');
  assert.equal(addressBytes('64:ff9b::192.0.2.33').toString('hex'), '0064ff9b0000000000000000c0000221');
  assert.equal(addressBytes('2001:db8::g'), null);
});

test('answers null while the database is missing or broken, and picks up a new file', t => {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-geoip-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'city.mmdb');
  const geo = openGeoIp(file, { recheckMs: 0 });
  t.after(() => geo.close());
  assert.equal(geo.lookup('81.2.69.142'), null);
  assert.equal(geo.info(), null);

  const errors = t.mock.method(console, 'error', () => {});
  writeFileSync(file, 'not a database');
  assert.equal(geo.lookup('81.2.69.142'), null);
  assert.equal(errors.mock.callCount(), 1);

  // The monthly update replaces the file by renaming a finished download over it.
  copyFileSync(FIXTURE, join(directory, 'next.mmdb'));
  rmSync(file);
  copyFileSync(join(directory, 'next.mmdb'), file);
  assert.equal(geo.lookup('81.2.69.142').city, 'London');
});
