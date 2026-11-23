import { env } from '../server/vps-env';
import type { PlaceFields } from '../lib/visits';

export type GeoLocator = {
  lookup(ip: string): PlaceFields | null;
  /** The installed database, or null when none is installed yet. */
  info(): { type: string; built: number } | null;
};

/** The VPS's local IP location database; absent on Cloudflare, which reports the place itself. */
export function getGeoLocator(): GeoLocator | undefined {
  return (env as unknown as { GEOIP?: GeoLocator }).GEOIP;
}
