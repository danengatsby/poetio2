'use client';
import { useSyncExternalStore } from 'react';
import { poemReadingKey, restoredPoemReading } from '@/lib/poem-reading';

function readStoredPreferences() {
  try {
    return localStorage.getItem(poemReadingKey);
  } catch {
    return null;
  }
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === poemReadingKey) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export default function usePoemReadingPreferences() {
  const saved = useSyncExternalStore(subscribe, readStoredPreferences, () => null);
  return restoredPoemReading(saved);
}
