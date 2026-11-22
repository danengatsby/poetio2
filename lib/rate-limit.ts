// Counts recent events per key (an IP address) in this process's memory. On the VPS one
// Node process serves the site, so the count holds until it restarts; that is enough to
// stop one script, while nginx still limits requests per second in front of it.
export function createRateLimit(limit: number, windowMs: number, maxKeys = 10_000) {
  const events = new Map<string, number[]>();
  const recent = (key: string, now: number) => (events.get(key) ?? []).filter(time => time > now - windowMs);
  return {
    /** Whether the key may act once more now. */
    allows(key: string, now = Date.now()) {
      return !key || recent(key, now).length < limit;
    },
    /** Records one event for the key. */
    record(key: string, now = Date.now()) {
      if (!key) return;
      const times = recent(key, now);
      times.push(now);
      events.delete(key);
      events.set(key, times);
      // Forget the keys seen longest ago once there are too many.
      for (const oldest of events.keys()) {
        if (events.size <= maxKeys) break;
        events.delete(oldest);
      }
    },
  };
}
