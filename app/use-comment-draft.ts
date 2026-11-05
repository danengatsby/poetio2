'use client';
import { useEffect, useRef, useState } from 'react';
import { commentDraftKey, restoredCommentDraft, saveCommentDraft, type CommentAttempt, type CommentDraft } from '@/lib/comment-draft';

const empty = (): CommentDraft => ({ version: 1, name: '', content: '', attempt: null, savedAt: Date.now() });
export default function useCommentDraft(endpoint: string) {
  const [draft, setDraft] = useState<CommentDraft>(empty);
  const current = useRef(draft);
  const [ready, setReady] = useState(false), [available, setAvailable] = useState(true);
  const key = commentDraftKey(endpoint);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key), restored = restoredCommentDraft(raw);
      if (raw && !restored) sessionStorage.removeItem(key);
      current.current = restored ?? empty(); setDraft(current.current);
    } catch { setAvailable(false); }
    setReady(true);
  }, [key]);
  function persist(value: CommentDraft) {
    current.current = value; setDraft(value);
    try { saveCommentDraft(sessionStorage, key, value); setAvailable(true); }
    catch { setAvailable(false); }
  }
  return {
    draft, ready, available,
    change(value: Partial<Pick<CommentDraft, 'name' | 'content'>>) { persist({ ...current.current, ...value, attempt: null, savedAt: Date.now() }); },
    attempt() {
      const value = current.current;
      const attempt: CommentAttempt = value.attempt ?? { id: crypto.randomUUID(), name: value.name.trim(), content: value.content.trim() };
      persist({ ...value, attempt, savedAt: Date.now() });
      return attempt;
    },
    clear() { persist(empty()); },
  };
}
