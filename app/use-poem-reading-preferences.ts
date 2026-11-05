'use client';
import { useSyncExternalStore } from 'react';
import { defaultPoemReading, poemReadingKey, restoredPoemReading, type PoemReadingPreferences } from '@/lib/poem-reading';

type Snapshot = { preferences: PoemReadingPreferences; storageAvailable: boolean };
const serverSnapshot: Snapshot = { preferences: defaultPoemReading, storageAvailable: true };
let clientSnapshot: Snapshot | undefined;
const listeners = new Set<() => void>();

function readStorage(): Snapshot {
  try {
    return { preferences: restoredPoemReading(localStorage.getItem(poemReadingKey)), storageAvailable: true };
  } catch {
    return { preferences: clientSnapshot?.preferences ?? defaultPoemReading, storageAvailable: false };
  }
}
function getSnapshot() {
  // Read only in the browser. A stable, separate server snapshot avoids both
  // hydration mismatches and writing default values over saved preferences.
  return clientSnapshot ??= readStorage();
}
function publish(next: Snapshot) {
  const previous = clientSnapshot;
  if (previous?.preferences.width === next.preferences.width && previous.preferences.textSize === next.preferences.textSize && previous.storageAvailable === next.storageAvailable) return;
  clientSnapshot = next;
  listeners.forEach(listener => listener());
}
function storageChanged(event: StorageEvent) {
  if (event.key !== null && event.key !== poemReadingKey) return;
  try { if (event.storageArea !== localStorage) return; } catch { return; }
  publish(readStorage());
}
function subscribe(listener: () => void) {
  if (!listeners.size) {
    // Recheck after a period with no mounted reader. Keep unsaved in-memory
    // choices when storage has failed, so navigation remains usable.
    if (clientSnapshot?.storageAvailable) publish(readStorage());
    window.addEventListener('storage', storageChanged);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', storageChanged);
  };
}
function save(preferences: PoemReadingPreferences, reset = false) {
  let storageAvailable = true;
  try {
    if (reset) localStorage.removeItem(poemReadingKey);
    else localStorage.setItem(poemReadingKey, JSON.stringify(preferences));
  } catch { storageAvailable = false; }
  // A quota error or disabled storage must never disable the controls.
  publish({ preferences, storageAvailable });
}
function setPreferences(change: Partial<PoemReadingPreferences>) {
  save(restoredPoemReading(JSON.stringify({ ...getSnapshot().preferences, ...change })));
}
function resetPreferences() { save({ ...defaultPoemReading }, true); }
const getServerSnapshot = () => serverSnapshot;

export default function usePoemReadingPreferences() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snapshot, setPreferences, resetPreferences };
}
