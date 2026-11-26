'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { type Poem, type PoemInput, EXTRA_LANGUAGES, type ExtraLanguage } from '@/lib/poem-types';
import { otherLanguage } from '@/lib/poem-languages';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { defaultPoemImage, poemImage, IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/poem-images';
import TranslationInventory from './translation-inventory';
import type { SiteLanguage } from '@/lib/poem-types';
import PoemCover from '../poem-cover';
import AudioUploadField, { type SelectedAudio } from './audio-upload-field';
import { AUDIO_FIELDS, AUDIO_LABELS, audioFileType, type AudioField } from '@/lib/poem-audio';
import PoemPreview from './poem-preview';
import PoemRecoveryComparison from './poem-recovery-comparison';
import {
  conflictingPoemFields,
  mediaFields,
  pendingPoemMedia,
  poemFieldLabels,
  type PoemField,
  type PoemMediaField,
} from '@/lib/poem-recovery';
import RecoveryTools from './recovery-tools';
import type { EditorSnapshot } from '@/lib/editorial';
import ThemeToggle from '../theme-toggle';
import { translationProvenance } from '@/lib/translation-provenance';
import { useTranslationStatus } from './use-translation-status';
import { adminPoemListUrl, type AdminPoemCollection } from '@/lib/poem-admin-list';

type Draft = PoemInput & { id: string; revision: number; isNew: boolean };
/** How the editor names each language with its own version. */
const VERSION_NAME: Record<ExtraLanguage, string> = {
  fr: 'franceză',
  de: 'germană',
  es: 'spaniolă',
  it: 'italiană',
};
const emptyAudio = {
  audio_ro_id: null,
  audio_en_id: null,
  audio_fr_id: null,
  audio_de_id: null,
  audio_es_id: null,
  audio_it_id: null,
};
const blank = (): Draft => ({
  id: crypto.randomUUID(),
  title: '',
  author: '',
  theme: '',
  content: '',
  source_language: 'ro',
  translated_title: '',
  translated_theme: '',
  translated_content: '',
  translation_provenance: null,
  fr_title: '',
  fr_theme: '',
  fr_content: '',
  fr_provenance: null,
  de_title: '',
  de_theme: '',
  de_content: '',
  de_provenance: null,
  es_title: '',
  es_theme: '',
  es_content: '',
  es_provenance: null,
  it_title: '',
  it_theme: '',
  it_content: '',
  it_provenance: null,
  image_id: null,
  ...emptyAudio,
  revision: 1,
  isNew: true,
});
const fromPoem = (poem: Poem): Draft => ({
  id: poem.id,
  title: poem.title,
  author: poem.author,
  theme: poem.theme,
  content: poem.content,
  source_language: poem.source_language,
  translated_title: poem.translated_title || '',
  translated_theme: poem.translated_theme || '',
  translated_content: poem.translated_content || '',
  translation_provenance: poem.translation_provenance ?? null,
  fr_title: poem.fr_title || '',
  fr_theme: poem.fr_theme || '',
  fr_content: poem.fr_content || '',
  fr_provenance: poem.fr_provenance ?? null,
  de_title: poem.de_title || '',
  de_theme: poem.de_theme || '',
  de_content: poem.de_content || '',
  de_provenance: poem.de_provenance ?? null,
  es_title: poem.es_title || '',
  es_theme: poem.es_theme || '',
  es_content: poem.es_content || '',
  es_provenance: poem.es_provenance ?? null,
  it_title: poem.it_title || '',
  it_theme: poem.it_theme || '',
  it_content: poem.it_content || '',
  it_provenance: poem.it_provenance ?? null,
  image_id: poem.image_id,
  audio_ro_id: poem.audio_ro_id,
  audio_en_id: poem.audio_en_id,
  audio_fr_id: poem.audio_fr_id,
  audio_de_id: poem.audio_de_id,
  audio_es_id: poem.audio_es_id,
  audio_it_id: poem.audio_it_id,
  revision: poem.revision,
  isNew: false,
});

class AdminRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(url: string, options: RequestInit = {}) {
  const result = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await result.json().catch(() => null);
  if (!result.ok)
    throw new AdminRequestError(
      result.status,
      data?.error ||
        (result.status === 401
          ? 'Autentifică-te din nou în administrare; textul introdus rămâne în formular.'
          : 'Cererea nu a reușit. Încearcă din nou; textul introdus rămâne în formular.'),
    );
  if (!data) throw new Error('Răspunsul nu poate fi citit. Reîncearcă salvarea; poemul nu va fi duplicat.');
  return data;
}

export default function Admin({
  initialCollection,
  initialPoem,
  initialError,
  translationReady,
  signInHref,
}: {
  initialCollection: AdminPoemCollection;
  initialPoem: Poem | null;
  initialError: boolean;
  translationReady: boolean;
  signInHref: string;
}) {
  const [collection, setCollection] = useState(initialCollection);
  const poems = collection.poems;
  const [search, setSearch] = useState(initialCollection.q);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState(initialError ? 'Lista nu este disponibilă momentan.' : '');
  const listRequest = useRef<AbortController | null>(null);
  const [loadingPoem, setLoadingPoem] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(initialPoem ? fromPoem(initialPoem) : null);
  const [baseline, setBaseline] = useState<Draft | null>(initialPoem ? fromPoem(initialPoem) : null);
  const [available, setAvailable] = useState(!initialError);
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [checkingAudio, setCheckingAudio] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [success, setSuccess] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ file: File; id: string; url: string } | null>(null);
  const [imageError, setImageError] = useState('');
  const [selectedAudio, setSelectedAudio] = useState<Record<AudioField, SelectedAudio | null>>(emptyAudio);
  const [missingMedia, setMissingMedia] = useState<PoemMediaField[]>([]);
  const [comparison, setComparison] = useState<{
    recovered: Draft;
    current: Draft;
    fields: PoemField[];
    pending: PoemMediaField[];
    baseRevision: number;
  } | null>(null);
  const [audioEditorVersion, setAudioEditorVersion] = useState(0);
  const imageInput = useRef<HTMLInputElement>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const focusAfterLoad = useRef<SiteLanguage | null>(null);
  const pendingMedia = useMemo(
    () =>
      mediaFields.filter(
        field =>
          missingMedia.includes(field) ||
          (field === 'image_id' ? selectedImage !== null : selectedAudio[field] !== null),
      ),
    [missingMedia, selectedImage, selectedAudio],
  );
  const recoveryDraft = useMemo(
    () => (draft && pendingMedia.length ? { ...draft, pendingPoemFiles: pendingMedia } : draft),
    [draft, pendingMedia],
  );
  const dirty =
    missingMedia.length > 0 ||
    JSON.stringify(draft) !== JSON.stringify(baseline) ||
    selectedImage !== null ||
    AUDIO_FIELDS.some(field => selectedAudio[field] !== null);
  const locked = busy || imageBusy || loadingPoem || comparison !== null;
  const sourceLanguage = draft?.source_language || 'ro';
  const translatedLanguage = otherLanguage(sourceLanguage);
  const sourceLabel = sourceLanguage === 'ro' ? 'Română' : 'English (US)';
  const translatedLabel = translatedLanguage === 'ro' ? 'Română' : 'English (US)';
  const translationState = useTranslationStatus(draft);
  const translateOnSave = sourceLanguage === 'ro' && translationState === 'missing';
  const translationBlocked = translationState !== 'ready' && translationState !== 'missing';
  const translationMessage = {
    checking: 'Se verifică asocierea traducerii…',
    missing: 'Nu există o traducere completată.',
    incomplete:
      'Completează titlul și textul traducerii, apoi confirmă revizuirea manuală, sau salvează fără traducere.',
    unreviewed:
      'Traducerea nu are o asociere verificată cu originalul. Compară textele și confirmă revizuirea manuală sau pregătește o traducere nouă.',
    stale: 'Originalul s-a schimbat. Traducerea trebuie regenerată sau verificată manual înainte de publicare.',
    edited: 'Traducerea a fost modificată. Confirmă revizuirea manuală pentru originalul actual înainte de publicare.',
    ready: 'Traducerea este asociată originalului actual. Orice schimbare a textelor cere o nouă verificare.',
    error:
      'Asocierea traducerii nu poate fi verificată în acest browser. Reîncarcă pagina sau salvează fără traducere.',
  }[translationState];
  const saveOriginalOnly = translateOnSave && !translationReady;
  // The French and German versions (fr_*, de_*), shown when the site is in that language.
  const versionStates: Record<ExtraLanguage, ReturnType<typeof useTranslationStatus>> = {
    fr: useTranslationStatus(draft, 'fr'),
    de: useTranslationStatus(draft, 'de'),
    es: useTranslationStatus(draft, 'es'),
    it: useTranslationStatus(draft, 'it'),
  };
  const versionMessage = (language: ExtraLanguage) => {
    const name = VERSION_NAME[language];
    return {
      checking: `Se verifică asocierea versiunii în ${name}…`,
      missing: `Nu există o versiune în ${name}; site-ul în ${name} arată originalul.`,
      incomplete: `Completează titlul și textul în ${name}, apoi confirmă revizuirea, sau golește câmpurile.`,
      unreviewed: `Versiunea în ${name} nu este confirmată pentru originalul actual. Verific-o și confirmă revizuirea.`,
      stale: `Originalul s-a schimbat. Verifică versiunea în ${name} și confirmă din nou, sau golește câmpurile.`,
      edited: `Versiunea în ${name} a fost modificată. Confirmă revizuirea pentru originalul actual.`,
      ready: `Versiunea în ${name} este asociată originalului actual.`,
      error: `Asocierea versiunii în ${name} nu poate fi verificată în acest browser. Reîncarcă pagina.`,
    }[versionStates[language]];
  };
  const blockedVersion = EXTRA_LANGUAGES.find(
    language => versionStates[language] !== 'ready' && versionStates[language] !== 'missing',
  );

  function reportError(error: unknown, fallback: string) {
    setError(error instanceof Error ? error.message : fallback);
    setAuthRequired(error instanceof AdminRequestError && error.status === 401);
  }

  useEffect(
    () => () => {
      if (selectedImage) URL.revokeObjectURL(selectedImage.url);
    },
    [selectedImage],
  );
  useEffect(() => () => listRequest.current?.abort(), []);

  useEffect(() => {
    if (!dirty && !locked) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, locked]);

  function resolveMedia(field: PoemMediaField) {
    setMissingMedia(current => current.filter(key => key !== field));
  }
  useEffect(() => {
    if (locked || !focusAfterLoad.current) return;
    document.getElementById('edit-language-' + focusAfterLoad.current)?.focus();
    focusAfterLoad.current = null;
  }, [draft, locked, audioEditorVersion]);

  function replaceDraft(value: Draft | null, language?: SiteLanguage) {
    focusAfterLoad.current = value ? (language ?? value.source_language ?? 'ro') : null;
    setMissingMedia([]);
    setComparison(null);
    setDraft(value);
    setBaseline(value);
    setError('');
    setAuthRequired(false);
    setSuccess('');
    setTranslationFailed(false);
    setSelectedImage(null);
    setImageError('');
    setSelectedAudio(emptyAudio);
    setAudioEditorVersion(value => value + 1);
    if (imageInput.current) imageInput.current.value = '';
  }
  function guard(action: () => void) {
    if (locked) return;
    if (dirty) {
      pendingAction.current = action;
      setDiscardOpen(true);
    } else action();
  }
  function update(field: keyof PoemInput, value: string) {
    setDraft(current => (current ? { ...current, [field]: value } : null));
    setSuccess('');
    setTranslationFailed(false);
  }
  async function chooseImage(file: File | undefined) {
    if (!file || locked) return;
    setImageError('');
    setSuccess('');
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError('Alege o imagine JPG, PNG sau WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Imaginea depășește limita de 5 MB. Alege un fișier mai mic.');
      return;
    }
    setImageBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width * bitmap.height > 40_000_000;
      bitmap.close();
      if (tooLarge) throw new Error('Imaginea este prea mare. Alege o fotografie de maximum 40 de megapixeli.');
      resolveMedia('image_id');
      setSelectedImage({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) });
    } catch (error) {
      setImageError(
        error instanceof Error && error.message.includes('megapixeli')
          ? error.message
          : 'Imaginea nu poate fi deschisă. Alege un alt fișier JPG, PNG sau WebP.',
      );
    } finally {
      setImageBusy(false);
      if (imageInput.current) imageInput.current.value = '';
    }
  }
  function resetImage() {
    if (locked) return;
    resolveMedia('image_id');
    setSelectedImage(null);
    setImageError('');
    setSuccess('');
    setDraft(current => (current ? { ...current, image_id: null } : null));
    if (imageInput.current) imageInput.current.value = '';
  }
  async function refresh(page = collection.page, q = collection.q) {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    setListBusy(true);
    setListError('');
    try {
      const data: AdminPoemCollection = await request(adminPoemListUrl(page, q), { signal: controller.signal });
      if (listRequest.current !== controller) return;
      setCollection(data);
      setAvailable(true);
    } catch (error) {
      if (listRequest.current === controller) {
        setListError(
          error instanceof AdminRequestError
            ? error.message
            : 'Lista nu poate fi încărcată. Încearcă din nou; editorul este păstrat.',
        );
        if (error instanceof AdminRequestError && error.status === 401) setAuthRequired(true);
      }
    } finally {
      clearTimeout(timeout);
      if (listRequest.current === controller) {
        setListBusy(false);
        listRequest.current = null;
      }
    }
  }
  async function selectPoem(id: string, language?: SiteLanguage) {
    setLoadingPoem(true);
    setError('');
    try {
      const data = await request(`/api/poems/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(30000) });
      replaceDraft(fromPoem(data.poem), language);
    } catch (error) {
      reportError(error, 'Poemul nu poate fi încărcat. Textul din editor este păstrat.');
    } finally {
      setLoadingPoem(false);
    }
  }
  async function recoverPoem(snapshot: EditorSnapshot) {
    setLoadingPoem(true);
    setError('');
    try {
      let current: Poem | null = null;
      try {
        current = (
          await request(`/api/poems/${encodeURIComponent(snapshot.id)}`, { signal: AbortSignal.timeout(30000) })
        ).poem;
      } catch (error) {
        if (!(error instanceof AdminRequestError && error.status === 404)) throw error;
      }
      const baseRevision = Number(snapshot.baseRevision ?? snapshot.revision);
      const recovered = {
        ...fromPoem({ ...blank(), ...snapshot } as unknown as Poem),
        revision: current?.revision ?? 1,
        isNew: !current,
      };
      const published = current ? fromPoem(current) : null;
      const pending = pendingPoemMedia(snapshot);
      if (published && (baseRevision !== published.revision || snapshot.wasNew === true)) {
        const { base } = snapshot.wasNew
          ? { base: null }
          : await request(`/api/admin/recovery/poem/base/${encodeURIComponent(snapshot.id)}?revision=${baseRevision}`);
        const fields = conflictingPoemFields(recovered, published, base, pending);
        if (fields.length) {
          setComparison({ recovered, current: published, fields, pending, baseRevision });
          return;
        }
      }
      replaceDraft(recovered);
      setBaseline(published);
      setMissingMedia(pending);
    } catch (error) {
      reportError(error, 'Versiunea nu poate fi recuperată. Textul din editor este păstrat.');
    } finally {
      setLoadingPoem(false);
    }
  }
  async function prepareTranslation() {
    if (!draft || locked || !translationReady) return;
    setBusy(true);
    setTranslating(true);
    setError('');
    setSuccess('');
    try {
      const data = await request('/api/poems/translate', {
        method: 'POST',
        body: JSON.stringify({ title: draft.title, theme: draft.theme, content: draft.content }),
      });
      const prepared = { ...draft, ...data.translation };
      setDraft(prepared);
      setTranslationFailed(false);
      setSuccess('Traducerea este în schiță. Verific-o în previzualizarea EN înainte de salvarea publică.');
    } catch (error) {
      reportError(error, 'Traducerea nu a putut fi pregătită.');
    } finally {
      setBusy(false);
      setTranslating(false);
    }
  }
  async function confirmTranslation() {
    if (!draft || locked || !draft.translated_title?.trim() || !draft.translated_content?.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const provenance = await translationProvenance(draft, 'manual');
      setDraft({ ...draft, translation_provenance: provenance });
      setSuccess('Revizuirea manuală este confirmată pentru textele actuale. Poemul nu a fost încă publicat.');
    } catch {
      setError('Revizuirea nu poate fi înregistrată în acest browser. Reîncarcă pagina sau salvează fără traducere.');
    } finally {
      setBusy(false);
    }
  }
  async function confirmVersion(language: ExtraLanguage) {
    if (!draft || locked || !draft[`${language}_title`]?.trim() || !draft[`${language}_content`]?.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const provenance = await translationProvenance(draft, 'manual', language);
      setDraft({ ...draft, [`${language}_provenance`]: provenance });
      setSuccess(`Revizuirea versiunii în ${VERSION_NAME[language]} este confirmată. Poemul nu a fost încă publicat.`);
    } catch {
      setError('Revizuirea nu poate fi înregistrată în acest browser. Reîncarcă pagina.');
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent, originalOnly = false) {
    event.preventDefault();
    if (!draft || locked) return;
    if (blockedVersion) {
      setError(versionMessage(blockedVersion));
      return;
    }
    if (missingMedia.length) {
      setError('Alege ce fișiere păstrezi înainte de publicare.');
      return;
    }
    originalOnly = originalOnly || saveOriginalOnly;
    if (!originalOnly && translationBlocked) {
      setError(translationMessage);
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      let saveDraft = { ...draft };
      if (translateOnSave && !originalOnly) {
        setTranslating(true);
        setTranslationFailed(false);
        try {
          const data = await request('/api/poems/translate', {
            method: 'POST',
            body: JSON.stringify({ title: draft.title, theme: draft.theme, content: draft.content }),
          });
          saveDraft = { ...saveDraft, ...data.translation };
          // Keep the generated text in the editor even if a later image upload
          // or database save fails, so a retry reuses this exact translation.
          setDraft(saveDraft);
        } catch (error) {
          setTranslationFailed(true);
          throw error;
        } finally {
          setTranslating(false);
        }
      } else if (originalOnly) {
        saveDraft = {
          ...saveDraft,
          translated_title: '',
          translated_theme: '',
          translated_content: '',
          translation_provenance: null,
        };
        setDraft(saveDraft);
      }
      if (selectedImage) {
        const uploaded = await fetch('/api/images', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': selectedImage.file.type,
            'X-Upload-Id': selectedImage.id,
            'X-File-Name': encodeURIComponent(selectedImage.file.name),
          },
          body: selectedImage.file,
        });
        const uploadData = await uploaded.json().catch(() => null);
        if (!uploaded.ok || !uploadData?.image?.id)
          throw new AdminRequestError(
            uploaded.status,
            uploadData?.error ||
              'Imaginea nu a putut fi încărcată. Textul și imaginea aleasă rămân în formular; încearcă din nou.',
          );
        saveDraft = { ...saveDraft, image_id: uploadData.image.id };
        setDraft(saveDraft);
        setSelectedImage(null);
      }
      for (const field of AUDIO_FIELDS) {
        const selected = selectedAudio[field];
        if (!selected) continue;
        setCheckingAudio(true);
        const uploaded = await fetch('/api/audio', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': audioFileType(selected.file) || 'application/octet-stream',
            'X-Upload-Id': selected.id,
            'X-File-Name': encodeURIComponent(selected.file.name),
          },
          body: selected.file,
        });
        const uploadData = await uploaded.json().catch(() => null);
        if (!uploaded.ok || !uploadData?.audio?.id)
          throw new AdminRequestError(
            uploaded.status,
            uploadData?.error ||
              'Înregistrarea nu a putut fi încărcată. Textul și fișierul ales rămân în formular; încearcă din nou.',
          );
        saveDraft = { ...saveDraft, [field]: uploadData.audio.id };
        setDraft(saveDraft);
        setSelectedAudio(current => ({ ...current, [field]: null }));
      }
      setCheckingAudio(false);
      const data = await request(draft.isNew ? '/api/poems' : `/api/poems/${draft.id}`, {
        method: draft.isNew ? 'POST' : 'PUT',
        body: JSON.stringify(saveDraft),
      });
      const saved: Poem = data.poem;
      replaceDraft(fromPoem(saved));
      setSuccess(
        originalOnly
          ? 'Originalul a fost salvat fără traducere. Traducerea poate fi adăugată ulterior.'
          : saved.source_language === 'ro' && saved.translated_content
            ? 'Poemul a fost salvat în română și engleză americană.'
            : draft.isNew
              ? 'Poemul a fost adăugat în colecție.'
              : 'Modificările au fost salvate în colecție.',
      );
      await refresh();
    } catch (error) {
      reportError(error, 'Salvarea nu a reușit. Textul introdus rămâne în formular.');
    } finally {
      setBusy(false);
      setCheckingAudio(false);
    }
  }
  async function remove() {
    if (!draft || draft.isNew || busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/poems/${draft.id}`, { method: 'DELETE', body: JSON.stringify({ revision: draft.revision }) });
      replaceDraft(null);
      setDeleteOpen(false);
      setSuccess('Poemul a fost șters din colecție.');
      await refresh();
    } catch (error) {
      setDeleteOpen(false);
      reportError(error, 'Ștergerea nu a reușit.');
    } finally {
      setBusy(false);
    }
  }

  // Local blob previews and private images must be fetched directly by the browser.
  const imagePreview = draft ? (
    <Image
      key={selectedImage?.id || draft.image_id || draft.id}
      className="image-preview"
      src={selectedImage?.url || poemImage({ id: draft.id, image_id: draft.image_id ?? null })}
      alt="Previzualizarea imaginii poemului"
      width={160}
      height={120}
      style={{ height: 'auto' }}
      unoptimized
      loading="eager"
      onError={event => {
        if (!event.currentTarget.dataset.fallback) {
          event.currentTarget.dataset.fallback = 'true';
          event.currentTarget.src = defaultPoemImage(draft.id);
        }
      }}
    />
  ) : null;

  return (
    <div lang="ro" className="admin-page">
      <a className="skip-link" href="#poem-editor">
        Mergi la editor
      </a>
      {/* eslint-disable @next/next/no-html-link-for-pages -- Document navigation triggers beforeunload for unsaved drafts and pending uploads. */}
      <header className="site-header shell">
        <a href="/" className="wordmark">
          Poetio<span aria-hidden="true">✳</span>
        </a>
        <span className="private-label">Administrare privată</span>
        <nav className="header-nav" aria-label="Navigare principală">
          <a className="nav-link" href="/admin" aria-current="page">
            Poeme
          </a>
          <a className="nav-link" href="/admin/video">
            Video
          </a>
          <a className="nav-link" href="/admin/carti">
            Cărți
          </a>
          <a className="nav-link" href="/admin/comentarii">
            Comentarii
          </a>
          <a className="nav-link" href="/admin/comenzi">
            Comenzi
          </a>
          <a className="nav-link" href="/admin/magazin">
            Magazin
          </a>
          <a className="nav-link" href="/admin/vizite">
            Vizite
          </a>
          <a className="nav-link" href="/">
            Vezi colecția <span aria-hidden="true">↗</span>
          </a>
          <a className="nav-link" href="/admin/functionare">
            Funcționare
          </a>
          <ThemeToggle />
        </nav>
      </header>
      {/* eslint-enable @next/next/no-html-link-for-pages */}
      <main className="admin-main shell">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Spațiul tău de scris</p>
            <h1>
              Poemele tale<span className="count">({String(collection.total).padStart(2, '0')})</span>
            </h1>
            <p>Adaugă un poem sau alege unul din colecție pentru a-l modifica.</p>
          </div>
          <button
            className="primary-button"
            disabled={locked || !available}
            onClick={() => guard(() => replaceDraft(blank()))}
          >
            <span aria-hidden="true">＋</span> Adaugă poem
          </button>
        </div>
        <div className="admin-feedback" aria-live="polite" aria-atomic="true">
          {success && <p className="success-message">{success}</p>}
          {error && (
            <div className="error-message" role="alert">
              <p>{error}</p>
              {!translationFailed && (
                <button disabled={locked || listBusy} className="text-button" onClick={() => void refresh()}>
                  Reîncarcă lista
                </button>
              )}
              {draft && !draft.isNew && (
                <button
                  disabled={locked}
                  className="text-button"
                  onClick={() => guard(() => void selectPoem(draft.id))}
                >
                  Reîncarcă poemul
                </button>
              )}
              {authRequired && (
                <a className="text-button" href={signInHref} target="_blank" rel="noopener noreferrer">
                  Autentificare într-o filă nouă
                </a>
              )}
            </div>
          )}
        </div>
        <RecoveryTools
          kind="poem"
          draft={recoveryDraft as EditorSnapshot | null}
          dirty={dirty}
          pendingFiles={pendingMedia.length > 0}
          disabled={locked}
          onRecover={snapshot => guard(() => void recoverPoem(snapshot))}
        />
        {comparison && (
          <PoemRecoveryComparison
            draft={comparison.recovered}
            current={comparison.current}
            fields={comparison.fields}
            baseRevision={comparison.baseRevision}
            currentRevision={comparison.current.revision}
            onCancel={() => setComparison(null)}
            onApply={keepPublished => {
              const selected = Object.fromEntries(keepPublished.map(field => [field, comparison.current[field]]));
              replaceDraft({ ...comparison.recovered, ...selected });
              setBaseline(comparison.current);
              setMissingMedia(comparison.pending.filter(field => !keepPublished.includes(field)));
            }}
          />
        )}
        <div className="admin-workspace">
          <aside className="poem-list" aria-label="Poemele din colecție" aria-busy={listBusy}>
            <div className="poem-list-heading">
              <h2>Colecția</h2>
              <button
                className="text-button"
                disabled={locked || listBusy}
                onClick={() => void refresh()}
                aria-label="Reîncarcă lista de poeme"
              >
                Reîncarcă
              </button>
            </div>
            <form
              className="admin-poem-search"
              role="search"
              aria-label="Caută în poemele salvate"
              onSubmit={event => {
                event.preventDefault();
                void refresh(1, search);
              }}
            >
              <label htmlFor="admin-poem-search">Caută poeme</label>
              <input
                id="admin-poem-search"
                type="search"
                maxLength={120}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Titlu, autor, temă sau text"
                disabled={locked || listBusy}
              />
              <div>
                <button className="secondary-button" type="submit" disabled={locked || listBusy}>
                  Caută
                </button>
                {(search || collection.q) && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={locked || listBusy}
                    onClick={() => {
                      setSearch('');
                      void refresh(1, '');
                    }}
                  >
                    Toate poemele
                  </button>
                )}
              </div>
              <p className="field-help">Căutarea și paginarea păstrează poemul din editor.</p>
            </form>
            {listError && (
              <div className="admin-list-error" role="alert">
                <p>{listError}</p>
                <button className="text-button" disabled={locked || listBusy} onClick={() => void refresh()}>
                  Reîncearcă lista
                </button>
                {authRequired && (
                  <a href={signInHref} target="_blank" rel="noopener noreferrer">
                    Autentificare într-o filă nouă
                  </a>
                )}
              </div>
            )}
            <p className="admin-list-status" role="status">
              {listBusy
                ? 'Se încarcă lista…'
                : `${collection.total} ${collection.q ? 'rezultate' : 'poeme'} · Pagina ${collection.page} din ${collection.pages}`}
            </p>
            <TranslationInventory
              collection={collection}
              disabled={locked}
              openPoem={(id, lang) => guard(() => void selectPoem(id, lang))}
            />
            {poems.length ? (
              <ul>
                {poems.map(poem => (
                  <li key={poem.id}>
                    <button
                      disabled={locked}
                      aria-current={draft?.id === poem.id ? 'true' : undefined}
                      onClick={() => guard(() => void selectPoem(poem.id))}
                    >
                      <PoemCover poem={poem} className="list-cover" />
                      <span>
                        <strong>{poem.title}</strong>
                        <span className="list-author">{poem.author}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="list-empty">
                {!available
                  ? 'Lista nu este disponibilă momentan.'
                  : collection.q
                    ? 'Niciun poem nu corespunde căutării.'
                    : 'Colecția nu conține încă poeme.'}
              </p>
            )}
            <nav className="admin-list-pagination" aria-label="Paginile listei de poeme">
              <button
                className="text-button"
                disabled={locked || listBusy || collection.page === 1}
                onClick={() => void refresh(collection.page - 1)}
              >
                Pagina anterioară
              </button>
              <button
                className="text-button"
                disabled={locked || listBusy || collection.page === collection.pages}
                onClick={() => void refresh(collection.page + 1)}
              >
                Pagina următoare
              </button>
            </nav>
          </aside>
          <section id="poem-editor" className="editor-panel" aria-labelledby="editor-title">
            {draft ? (
              <form onSubmit={save}>
                <div className="editor-heading">
                  <h2 id="editor-title">{draft.isNew ? 'Un poem nou' : 'Modifică poemul'}</h2>
                  <span className={dirty ? 'unsaved-label' : 'saved-label'}>
                    {loadingPoem
                      ? 'Se încarcă poemul…'
                      : imageBusy
                        ? 'Se verifică imaginea…'
                        : translating
                          ? 'Se traduce în engleză americană…'
                          : checkingAudio
                            ? 'Se încarcă și se verifică înregistrarea…'
                            : busy
                              ? 'Se salvează…'
                              : dirty
                                ? 'Modificări nesalvate'
                                : draft.isNew
                                  ? 'Necompletat'
                                  : 'Salvat'}
                  </span>
                </div>
                <fieldset disabled={locked} className="editor-fields">
                  <p
                    id="translation-state"
                    className={translationBlocked ? 'error-message' : 'automatic-translation-note'}
                    role="status"
                  >
                    {translationMessage}
                  </p>
                  <div className="original-language-field">
                    <label id="original-language-label">Limba textului original</label>
                    <Select
                      value={sourceLanguage}
                      onValueChange={value => update('source_language', value)}
                      disabled={locked}
                    >
                      <SelectTrigger aria-labelledby="original-language-label" className="original-language-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ro">Română</SelectItem>
                        <SelectItem value="en-US">English (US) — engleză americană</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="field-pair">
                    <label>
                      Titlu — {sourceLabel}{' '}
                      <input
                        id={'edit-language-' + sourceLanguage}
                        value={draft.title}
                        onChange={e => update('title', e.target.value)}
                        required
                        maxLength={180}
                        placeholder="Titlul poemului"
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      Autor{' '}
                      <input
                        value={draft.author}
                        onChange={e => update('author', e.target.value)}
                        required
                        maxLength={120}
                        placeholder="Numele autorului"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  <label>
                    Temă <span className="optional-label">(opțional)</span>
                    <input
                      value={draft.theme}
                      onChange={e => update('theme', e.target.value)}
                      maxLength={80}
                      placeholder="De exemplu: iubire, natură, amintiri"
                    />
                  </label>
                  <div className="image-field">
                    <label htmlFor="poem-image">
                      Imaginea poemului <span className="optional-label">(opțional)</span>
                    </label>
                    <div className="image-picker">
                      {imagePreview}
                      <div className="image-picker-controls">
                        <input
                          id="poem-image"
                          ref={imageInput}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={event => void chooseImage(event.target.files?.[0])}
                          aria-describedby="poem-image-help poem-image-state"
                        />
                        <p id="poem-image-help" className="field-help">
                          JPG, PNG sau WebP, maximum 5 MB. Imaginea va apărea pe caseta poemului.
                        </p>
                        <p id="poem-image-state" className="image-state">
                          {loadingPoem
                            ? 'Se încarcă poemul…'
                            : imageBusy
                              ? 'Se verifică imaginea…'
                              : selectedImage
                                ? `${selectedImage.file.name} · se încarcă la salvarea poemului`
                                : draft.image_id
                                  ? 'Imagine personalizată salvată.'
                                  : 'Se folosește coperta implicită.'}
                        </p>
                        {(selectedImage || draft.image_id) && (
                          <button type="button" className="text-button" disabled={locked} onClick={resetImage}>
                            Folosește coperta implicită
                          </button>
                        )}
                        {imageError && (
                          <p className="image-error" role="alert">
                            {imageError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <section className="audio-editor" aria-labelledby="audio-editor-title">
                    <h3 id="audio-editor-title">Înregistrările poemului</h3>
                    <p className="field-help">
                      Încarcă de pe calculator recitarea poemului. Vizitatorii o pot asculta în fereastra poemului, în
                      limba aleasă.
                    </p>
                    {AUDIO_FIELDS.map(field => (
                      <AudioUploadField
                        key={`${audioEditorVersion}:${field}`}
                        field={field}
                        label={AUDIO_LABELS[field]}
                        selected={selectedAudio[field]}
                        storedId={draft[field] ?? null}
                        disabled={locked}
                        onSelect={value => {
                          resolveMedia(field);
                          setSelectedAudio(current => ({ ...current, [field]: value }));
                          setSuccess('');
                        }}
                        onRemove={() => {
                          resolveMedia(field);
                          setSelectedAudio(current => ({ ...current, [field]: null }));
                          setDraft(current => (current ? { ...current, [field]: null } : null));
                          setSuccess('');
                        }}
                      />
                    ))}
                    <p className="field-help">
                      Înregistrările sunt opționale. Pentru redarea unei traduceri, salvează și textul poemului în limba
                      respectivă.
                    </p>
                  </section>
                  <label>
                    Textul original — {sourceLabel}
                    <textarea
                      lang={sourceLanguage}
                      value={draft.content}
                      onChange={e => update('content', e.target.value)}
                      required
                      maxLength={30000}
                      rows={15}
                      placeholder={'Scrie sau lipește poemul aici.\n\nLasă un rând gol între strofe.'}
                      aria-describedby="poem-text-help"
                    />
                  </label>
                  <p id="poem-text-help" className="field-help">
                    Versurile și strofele se păstrează la salvare. Textul poate avea până la 30.000 de caractere.
                  </p>
                  <section className="translation-editor" aria-labelledby="translation-editor-title">
                    <h3 id="translation-editor-title">Varianta în {translatedLabel}</h3>
                    <p className="field-help">
                      Compară originalul și traducerea în previzualizare. După editarea manuală, confirmă că traducerea
                      corespunde originalului actual. „Salvează fără traducere” elimină varianta tradusă din publicare.
                      {sourceLanguage === 'ro' &&
                        translationReady &&
                        ' Poți genera varianta EN cu „Pregătește traducerea în schiță”.'}
                    </p>
                    <label>
                      Titlul traducerii
                      <input
                        id={'edit-language-' + translatedLanguage}
                        lang={translatedLanguage}
                        value={draft.translated_title || ''}
                        onChange={event => update('translated_title', event.target.value)}
                        maxLength={180}
                        placeholder={translatedLanguage === 'ro' ? 'Titlul în română' : 'Title in American English'}
                      />
                    </label>
                    <label>
                      Tema traducerii <span className="optional-label">(opțional)</span>
                      <input
                        lang={translatedLanguage}
                        value={draft.translated_theme || ''}
                        onChange={event => update('translated_theme', event.target.value)}
                        maxLength={80}
                        placeholder={translatedLanguage === 'ro' ? 'Tema în română' : 'Theme in American English'}
                      />
                    </label>
                    <label>
                      Textul traducerii
                      <textarea
                        lang={translatedLanguage}
                        value={draft.translated_content || ''}
                        onChange={event => update('translated_content', event.target.value)}
                        maxLength={30000}
                        rows={12}
                        placeholder={
                          translatedLanguage === 'ro'
                            ? 'Varianta română a poemului, cu versuri și strofe.'
                            : 'The American English version, preserving lines and stanzas.'
                        }
                      />
                    </label>
                    {translationState !== 'ready' && (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          locked ||
                          !draft.title.trim() ||
                          !draft.content.trim() ||
                          !draft.translated_title?.trim() ||
                          !draft.translated_content?.trim()
                        }
                        onClick={() => void confirmTranslation()}
                      >
                        Confirm: traducerea corespunde originalului actual
                      </button>
                    )}
                  </section>
                  {EXTRA_LANGUAGES.map(language => {
                    const name = VERSION_NAME[language];
                    const state = versionStates[language];
                    return (
                      <section
                        key={language}
                        className="translation-editor"
                        aria-labelledby={`${language}-editor-title`}
                      >
                        <h3 id={`${language}-editor-title`}>Varianta în {name}</h3>
                        <p className="field-help">
                          Apare când cititorul alege {language.toUpperCase()}. Fără ea, site-ul în {name} arată
                          originalul. După orice modificare a originalului sau a acestui text, confirmă din nou
                          revizuirea.
                        </p>
                        <label>
                          Titlul în {name}
                          <input
                            id={'edit-language-' + language}
                            lang={language}
                            value={draft[`${language}_title`] || ''}
                            onChange={event => update(`${language}_title`, event.target.value)}
                            maxLength={180}
                          />
                        </label>
                        <label>
                          Tema în {name} <span className="optional-label">(opțional)</span>
                          <input
                            lang={language}
                            value={draft[`${language}_theme`] || ''}
                            onChange={event => update(`${language}_theme`, event.target.value)}
                            maxLength={80}
                          />
                        </label>
                        <label>
                          Textul în {name}
                          <textarea
                            lang={language}
                            value={draft[`${language}_content`] || ''}
                            onChange={event => update(`${language}_content`, event.target.value)}
                            maxLength={30000}
                            rows={12}
                          />
                        </label>
                        <p className="field-help" role="status">
                          {versionMessage(language)}
                        </p>
                        {state !== 'ready' && state !== 'missing' && (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={
                              locked ||
                              !draft.title.trim() ||
                              !draft.content.trim() ||
                              !draft[`${language}_title`]?.trim() ||
                              !draft[`${language}_content`]?.trim()
                            }
                            onClick={() => void confirmVersion(language)}
                          >
                            Confirm: versiunea în {name} corespunde originalului actual
                          </button>
                        )}
                      </section>
                    );
                  })}
                </fieldset>
                {missingMedia.length > 0 && (
                  <section className="book-missing-files" aria-label="Fișiere de recuperat">
                    <p>Alege din nou fiecare fișier lipsă sau confirmă ce păstrezi pentru câmpul respectiv.</p>
                    {missingMedia.map(field => (
                      <div key={field}>
                        <strong>{poemFieldLabels[field]}</strong>{' '}
                        <button
                          type="button"
                          className="text-button"
                          disabled={locked}
                          onClick={() => document.getElementById(field === 'image_id' ? 'poem-image' : field)?.click()}
                        >
                          Realege fișierul
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          disabled={locked}
                          onClick={() => resolveMedia(field)}
                        >
                          {draft[field] ? 'Păstrează fișierul din schiță' : 'Continuă fără fișier'}
                        </button>
                      </div>
                    ))}
                  </section>
                )}
                <div className="editor-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    aria-describedby="translation-state"
                    disabled={
                      locked ||
                      missingMedia.length > 0 ||
                      !available ||
                      translationBlocked ||
                      (!dirty && !draft.isNew && !(translateOnSave && translationReady))
                    }
                  >
                    {translating
                      ? 'Se traduce…'
                      : busy
                        ? 'Se salvează…'
                        : saveOriginalOnly
                          ? 'Salvează fără traducere'
                          : translateOnSave
                            ? !dirty && !draft.isNew
                              ? 'Adaugă traducerea automată'
                              : 'Salvează și traduce'
                            : draft.isNew
                              ? 'Adaugă în colecție'
                              : 'Salvează modificările'}
                  </button>
                  {!saveOriginalOnly && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        locked ||
                        missingMedia.length > 0 ||
                        !available ||
                        (!dirty && !draft.isNew && translationState === 'missing')
                      }
                      onClick={event => {
                        if (event.currentTarget.form?.reportValidity()) void save(event, true);
                      }}
                    >
                      Salvează fără traducere
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={locked || !dirty}
                    onClick={() => guard(() => replaceDraft(baseline))}
                  >
                    Renunță la modificări
                  </button>
                </div>
                <p className="save-note">
                  După salvare, poemul apare în colecție. Poți verifica rezultatul folosind „Vezi colecția”.
                </p>
                {!draft.isNew && (
                  <div className="delete-area">
                    <button
                      type="button"
                      className="delete-button"
                      disabled={locked}
                      onClick={() => setDeleteOpen(true)}
                    >
                      Șterge poemul
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div className="editor-empty">
                <span aria-hidden="true">✳</span>
                <h2 id="editor-title">Loc pentru un poem nou</h2>
                <p>Completează titlul, autorul și textul. Primul vers îți aparține.</p>
                <button className="primary-button" disabled={!available || busy} onClick={() => replaceDraft(blank())}>
                  Adaugă poem
                </button>
              </div>
            )}
            {draft && sourceLanguage === 'ro' && translationState !== 'ready' && translationReady && (
              <button
                type="button"
                className="secondary-button"
                disabled={locked || !draft.title.trim() || !draft.content.trim()}
                onClick={() => void prepareTranslation()}
              >
                Pregătește traducerea în schiță
              </button>
            )}
            {draft && (
              <PoemPreview
                draft={draft}
                audio={selectedAudio}
                disabled={locked}
                translationPending={translationState !== 'ready'}
              />
            )}
          </section>
        </div>
      </main>
      <footer className="admin-footer shell">
        <p>Poetio · Administrare privată</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Keep the unsaved-draft beforeunload warning when leaving the editor. */}
        <a href="/">Înapoi la colecție</a>
      </footer>
      <AlertDialog
        open={deleteOpen}
        onOpenChange={open => {
          if (!locked) setDeleteOpen(open);
        }}
      >
        <AlertDialogContent lang="ro">
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi acest poem?</AlertDialogTitle>
            <AlertDialogDescription>
              „{draft?.title}” va fi eliminat definitiv din colecție. Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={locked}>Păstrează poemul</AlertDialogCancel>
            <AlertDialogAction
              className="confirm-delete"
              disabled={locked}
              onClick={event => {
                event.preventDefault();
                void remove();
              }}
            >
              {busy ? 'Se șterge…' : 'Șterge definitiv'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent lang="ro">
          <AlertDialogHeader>
            <AlertDialogTitle>Renunți la modificările nesalvate?</AlertDialogTitle>
            <AlertDialogDescription>
              Textul pe care nu l-ai salvat va fi pierdut. Poți reveni la formular pentru a-l salva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                pendingAction.current = null;
              }}
            >
              Continuă editarea
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pendingAction.current;
                pendingAction.current = null;
                setDiscardOpen(false);
                action?.();
              }}
            >
              Renunță la modificări
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
