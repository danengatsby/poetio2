'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import type { Poem, PoemInput } from '@/lib/poem-types';
import { needsEnglishTranslation, otherLanguage } from '@/lib/poem-languages';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { defaultPoemImage, poemImage, IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/poem-images';
import PoemCover from '../poem-cover';
import ThemeToggle from '../theme-toggle';

type Draft = PoemInput & { id: string; revision: number; isNew: boolean };
const blank = (): Draft => ({ id: crypto.randomUUID(), title: '', author: '', theme: '', content: '', source_language: 'ro', translated_title: '', translated_theme: '', translated_content: '', image_id: null, revision: 1, isNew: true });
const fromPoem = (poem: Poem): Draft => ({ id: poem.id, title: poem.title, author: poem.author, theme: poem.theme, content: poem.content, source_language: poem.source_language, translated_title: poem.translated_title || '', translated_theme: poem.translated_theme || '', translated_content: poem.translated_content || '', image_id: poem.image_id, revision: poem.revision, isNew: false });

class AdminRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request(url: string, options: RequestInit = {}) {
  const result = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await result.json().catch(() => null);
  if (!result.ok) throw new AdminRequestError(result.status, data?.error || (result.status === 401 ? 'Autentifică-te din nou în administrare; textul introdus rămâne în formular.' : 'Cererea nu a reușit. Încearcă din nou; textul introdus rămâne în formular.'));
  if (!data) throw new Error('Răspunsul nu poate fi citit. Reîncearcă salvarea; poemul nu va fi duplicat.');
  return data;
}

export default function Admin({ initialPoems, initialError, translationReady, signInHref }: { initialPoems: Poem[]; initialError: boolean; translationReady: boolean; signInHref: string }) {
  const [poems, setPoems] = useState(initialPoems);
  const [draft, setDraft] = useState<Draft | null>(initialPoems[0] ? fromPoem(initialPoems[0]) : null);
  const [baseline, setBaseline] = useState<Draft | null>(initialPoems[0] ? fromPoem(initialPoems[0]) : null);
  const [available, setAvailable] = useState(!initialError);
  const [busy, setBusy] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [error, setError] = useState(initialError ? 'Poemele nu pot fi încărcate momentan. Încearcă din nou.' : '');
  const [authRequired, setAuthRequired] = useState(false);
  const [success, setSuccess] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ file: File; id: string; url: string } | null>(null);
  const [imageError, setImageError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || selectedImage !== null;
  const locked = busy || imageBusy;
  const sourceLanguage = draft?.source_language || 'ro';
  const translatedLanguage = otherLanguage(sourceLanguage);
  const sourceLabel = sourceLanguage === 'ro' ? 'Română' : 'English (US)';
  const translatedLabel = translatedLanguage === 'ro' ? 'Română' : 'English (US)';
  const translateOnSave = draft ? needsEnglishTranslation(draft, baseline) : false;
  const saveOriginalOnly = translateOnSave && !translationReady;

  function reportError(error: unknown, fallback: string) {
    setError(error instanceof Error ? error.message : fallback);
    setAuthRequired(error instanceof AdminRequestError && error.status === 401);
  }

  useEffect(() => () => { if (selectedImage) URL.revokeObjectURL(selectedImage.url); }, [selectedImage]);

  useEffect(() => {
    if (!dirty && !locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, locked]);

  function replaceDraft(value: Draft | null) {
    setDraft(value); setBaseline(value); setError(''); setAuthRequired(false); setSuccess('');
    setTranslationFailed(false);
    setSelectedImage(null); setImageError('');
    if (imageInput.current) imageInput.current.value = '';
    requestAnimationFrame(() => titleInput.current?.focus());
  }
  function guard(action: () => void) {
    if (locked) return;
    if (dirty) { pendingAction.current = action; setDiscardOpen(true); }
    else action();
  }
  function update(field: keyof PoemInput, value: string) {
    setDraft(current => current ? { ...current, [field]: value } : null);
    setSuccess(''); setTranslationFailed(false);
  }
  async function chooseImage(file: File | undefined) {
    if (!file || locked) return;
    setImageError(''); setSuccess('');
    if (!IMAGE_TYPES.includes(file.type)) { setImageError('Alege o imagine JPG, PNG sau WebP.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImageError('Imaginea depășește limita de 5 MB. Alege un fișier mai mic.'); return; }
    setImageBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width * bitmap.height > 40_000_000;
      bitmap.close();
      if (tooLarge) throw new Error('Imaginea este prea mare. Alege o fotografie de maximum 40 de megapixeli.');
      setSelectedImage({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) });
    } catch (error) { setImageError(error instanceof Error && error.message.includes('megapixeli') ? error.message : 'Imaginea nu poate fi deschisă. Alege un alt fișier JPG, PNG sau WebP.'); }
    finally { setImageBusy(false); if (imageInput.current) imageInput.current.value = ''; }
  }
  function resetImage() {
    if (locked) return;
    setSelectedImage(null); setImageError(''); setSuccess('');
    setDraft(current => current ? { ...current, image_id: null } : null);
    if (imageInput.current) imageInput.current.value = '';
  }
  async function refresh() {
    setBusy(true); setError('');
    try { const data = await request('/api/poems'); setPoems(data.poems); setAvailable(true); replaceDraft(data.poems[0] ? fromPoem(data.poems[0]) : null); }
    catch (error) { reportError(error, 'Lista nu poate fi încărcată.'); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent, originalOnly = false) {
    event.preventDefault();
    if (!draft || locked) return;
    originalOnly = originalOnly || saveOriginalOnly;
    setBusy(true); setError(''); setSuccess('');
    try {
      let saveDraft = { ...draft };
      if (translateOnSave && !originalOnly) {
        setTranslating(true); setTranslationFailed(false);
        try {
          const data = await request('/api/poems/translate', { method: 'POST', body: JSON.stringify({ title: draft.title, theme: draft.theme, content: draft.content }) });
          saveDraft = { ...saveDraft, ...data.translation };
          // Keep the generated text in the editor even if a later image upload
          // or database save fails, so a retry reuses this exact translation.
          setDraft(saveDraft);
        } catch (error) { setTranslationFailed(true); throw error; }
        finally { setTranslating(false); }
      } else if (translateOnSave && originalOnly) {
        saveDraft = { ...saveDraft, translated_title: '', translated_theme: '', translated_content: '' };
        setDraft(saveDraft);
      }
      let imageId = draft.image_id ?? null;
      if (selectedImage) {
        const uploaded = await fetch('/api/images', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': selectedImage.file.type, 'X-Upload-Id': selectedImage.id, 'X-File-Name': encodeURIComponent(selectedImage.file.name) }, body: selectedImage.file });
        const uploadData = await uploaded.json().catch(() => null);
        if (!uploaded.ok || !uploadData?.image?.id) throw new AdminRequestError(uploaded.status, uploadData?.error || 'Imaginea nu a putut fi încărcată. Textul și imaginea aleasă rămân în formular; încearcă din nou.');
        imageId = uploadData.image.id;
      }
      const data = await request(draft.isNew ? '/api/poems' : `/api/poems/${draft.id}`, { method: draft.isNew ? 'POST' : 'PUT', body: JSON.stringify({ ...saveDraft, image_id: imageId }) });
      const saved: Poem = data.poem;
      setPoems(current => current.some(poem => poem.id === saved.id) ? current.map(poem => poem.id === saved.id ? saved : poem) : [...current, saved]);
      replaceDraft(fromPoem(saved));
      setSuccess(originalOnly ? 'Originalul a fost salvat în română. Traducerea poate fi adăugată ulterior.' : saved.source_language === 'ro' && saved.translated_content ? 'Poemul a fost salvat în română și engleză americană.' : draft.isNew ? 'Poemul a fost adăugat în colecție.' : 'Modificările au fost salvate în colecție.');
    } catch (error) { reportError(error, 'Salvarea nu a reușit. Textul introdus rămâne în formular.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!draft || draft.isNew || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await request(`/api/poems/${draft.id}`, { method: 'DELETE', body: JSON.stringify({ revision: draft.revision }) });
      const remaining = poems.filter(poem => poem.id !== draft.id);
      setPoems(remaining); replaceDraft(remaining[0] ? fromPoem(remaining[0]) : null);
      setDeleteOpen(false); setSuccess('Poemul a fost șters din colecție.');
    } catch (error) { setDeleteOpen(false); reportError(error, 'Ștergerea nu a reușit.'); }
    finally { setBusy(false); }
  }

  return <div lang="ro" className="admin-page">
    <a className="skip-link" href="#poem-editor">Mergi la editor</a>
    <header className="site-header shell"><a href="/" className="wordmark">Poetio<span aria-hidden="true">✳</span></a><span className="private-label">Administrare privată</span><nav className="header-nav" aria-label="Navigare principală"><a className="nav-link" href="/">Vezi colecția <span aria-hidden="true">↗</span></a><ThemeToggle /></nav></header>
    <main className="admin-main shell">
      <div className="admin-heading"><div><p className="eyebrow">Spațiul tău de scris</p><h1>Poemele tale<span className="count">({String(poems.length).padStart(2, '0')})</span></h1><p>Adaugă un poem sau alege unul din colecție pentru a-l modifica.</p></div><button className="primary-button" disabled={locked || !available} onClick={() => guard(() => replaceDraft(blank()))}><span aria-hidden="true">＋</span> Adaugă poem</button></div>
      <div className="admin-feedback" aria-live="polite" aria-atomic="true">{success && <p className="success-message">{success}</p>}{error && <div className="error-message" role="alert"><p>{error}</p>{!translationFailed && <button disabled={locked} className="text-button" onClick={() => guard(refresh)}>Reîncarcă lista</button>}{authRequired && <a className="text-button" href={signInHref} target="_blank" rel="noopener noreferrer">Autentificare într-o filă nouă</a>}</div>}</div>
      <div className="admin-workspace">
        <aside className="poem-list" aria-label="Poemele din colecție"><div className="poem-list-heading"><h2>Colecția</h2><button className="text-button" disabled={locked} onClick={() => guard(refresh)} aria-label="Reîncarcă lista de poeme">Reîncarcă</button></div>{poems.length ? <ul>{poems.map(poem => <li key={poem.id}><button disabled={locked} aria-current={draft?.id === poem.id ? 'true' : undefined} onClick={() => { if (draft?.id !== poem.id) guard(() => replaceDraft(fromPoem(poem))); }}><PoemCover poem={poem} className="list-cover" /><span><strong>{poem.title}</strong><span className="list-author">{poem.author}</span></span></button></li>)}</ul> : <p className="list-empty">{available ? 'Colecția nu conține încă poeme.' : 'Lista nu este disponibilă momentan.'}</p>}</aside>
        <section id="poem-editor" className="editor-panel" aria-labelledby="editor-title">
          {draft ? <form onSubmit={save}><div className="editor-heading"><h2 id="editor-title">{draft.isNew ? 'Un poem nou' : 'Modifică poemul'}</h2><span className={dirty ? 'unsaved-label' : 'saved-label'}>{imageBusy ? 'Se verifică imaginea…' : translating ? 'Se traduce în engleză americană…' : busy ? 'Se salvează…' : dirty ? 'Modificări nesalvate' : draft.isNew ? 'Necompletat' : 'Salvat'}</span></div>
            <fieldset disabled={locked} className="editor-fields">{sourceLanguage === 'ro' && <p className="automatic-translation-note" role="status">{translationReady ? translateOnSave ? 'Poți salva poemul fără traducere sau alege „Salvează și traduce” pentru varianta în engleză americană.' : 'Varianta în engleză este completată. O poți revizui mai jos.' : 'Traducerea automată nu este activată. Poți salva originalul în română sau completa manual traducerea.'}</p>}<div className="original-language-field"><label id="original-language-label">Limba textului original</label><Select value={sourceLanguage} onValueChange={value => update('source_language', value)} disabled={locked}><SelectTrigger aria-labelledby="original-language-label" className="original-language-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ro">Română</SelectItem><SelectItem value="en-US">English (US) — engleză americană</SelectItem></SelectContent></Select></div><div className="field-pair"><label>Titlu — {sourceLabel} <input ref={titleInput} value={draft.title} onChange={e => update('title', e.target.value)} required maxLength={180} placeholder="Titlul poemului" autoComplete="off" /></label><label>Autor <input value={draft.author} onChange={e => update('author', e.target.value)} required maxLength={120} placeholder="Numele autorului" autoComplete="off" /></label></div><label>Temă <span className="optional-label">(opțional)</span><input value={draft.theme} onChange={e => update('theme', e.target.value)} maxLength={80} placeholder="De exemplu: iubire, natură, amintiri" /></label><div className="image-field"><label htmlFor="poem-image">Imaginea poemului <span className="optional-label">(opțional)</span></label><div className="image-picker"><img className="image-preview" src={selectedImage?.url || poemImage({ id: draft.id, image_id: draft.image_id ?? null })} alt="Previzualizarea imaginii poemului" onError={event => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = defaultPoemImage(draft.id); } }} key={selectedImage?.id || draft.image_id || draft.id} /><div className="image-picker-controls"><input id="poem-image" ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void chooseImage(event.target.files?.[0])} aria-describedby="poem-image-help poem-image-state" /><p id="poem-image-help" className="field-help">JPG, PNG sau WebP, maximum 5 MB. Imaginea va apărea pe caseta poemului.</p><p id="poem-image-state" className="image-state">{imageBusy ? 'Se verifică imaginea…' : selectedImage ? `${selectedImage.file.name} · se încarcă la salvarea poemului` : draft.image_id ? 'Imagine personalizată salvată.' : 'Se folosește coperta implicită.'}</p>{(selectedImage || draft.image_id) && <button type="button" className="text-button" disabled={locked} onClick={resetImage}>Folosește coperta implicită</button>}{imageError && <p className="image-error" role="alert">{imageError}</p>}</div></div></div><label>Textul original — {sourceLabel}<textarea lang={sourceLanguage} value={draft.content} onChange={e => update('content', e.target.value)} required maxLength={30000} rows={15} placeholder={'Scrie sau lipește poemul aici.\n\nLasă un rând gol între strofe.'} aria-describedby="poem-text-help" /></label><p id="poem-text-help" className="field-help">Versurile și strofele se păstrează la salvare. Textul poate avea până la 30.000 de caractere.</p><section className="translation-editor" aria-labelledby="translation-editor-title"><h3 id="translation-editor-title">Varianta în {translatedLabel}</h3><p className="field-help">{sourceLanguage === 'ro' ? translationReady ? 'Cu „Salvează și traduce”, varianta în engleză americană se generează automat. Poți folosi direct „Salvează fără traducere”, fără să completezi câmpurile de mai jos. Dacă modifici originalul și salvezi fără traducere, varianta veche nerevizuită va fi eliminată. O traducere revizuită manual în acest formular va fi păstrată la salvare.' : 'Pentru a salva ambele variante, completează titlul și textul traducerii. Altfel, poți salva doar originalul. Dacă modifici originalul, o traducere veche nerevizuită va fi eliminată la salvarea doar a originalului.' : 'Completează varianta în română pentru a o afișa la selectarea limbii. Dacă modifici originalul, verifică și traducerea.'}</p><label>Titlul traducerii<input lang={translatedLanguage} value={draft.translated_title || ''} onChange={event => update('translated_title', event.target.value)} maxLength={180} placeholder={translatedLanguage === 'ro' ? 'Titlul în română' : 'Title in American English'} /></label><label>Tema traducerii <span className="optional-label">(opțional)</span><input lang={translatedLanguage} value={draft.translated_theme || ''} onChange={event => update('translated_theme', event.target.value)} maxLength={80} placeholder={translatedLanguage === 'ro' ? 'Tema în română' : 'Theme in American English'} /></label><label>Textul traducerii<textarea lang={translatedLanguage} value={draft.translated_content || ''} onChange={event => update('translated_content', event.target.value)} maxLength={30000} rows={12} placeholder={translatedLanguage === 'ro' ? 'Varianta română a poemului, cu versuri și strofe.' : 'The American English version, preserving lines and stanzas.'} /></label><p className="field-help">{sourceLanguage === 'ro' ? 'După salvare, poți ajusta traducerea și salva din nou.' : 'Titlul și textul traducerii se completează împreună.'}</p></section></fieldset>
            <div className="editor-actions"><button className="primary-button" type="submit" disabled={locked || !available || (!dirty && !draft.isNew && !(translateOnSave && translationReady))}>{translating ? 'Se traduce…' : busy ? 'Se salvează…' : saveOriginalOnly ? 'Salvează fără traducere' : translateOnSave ? !dirty && !draft.isNew ? 'Adaugă traducerea automată' : 'Salvează și traduce' : draft.isNew ? 'Adaugă în colecție' : 'Salvează modificările'}</button>{translateOnSave && translationReady && <button type="button" className="secondary-button" disabled={locked || !available || (!dirty && !draft.isNew)} onClick={event => { if (event.currentTarget.form?.reportValidity()) void save(event, true); }}>Salvează fără traducere</button>}<button type="button" className="secondary-button" disabled={locked || !dirty} onClick={() => guard(() => replaceDraft(baseline))}>Renunță la modificări</button></div><p className="save-note">După salvare, poemul apare în colecție. Poți verifica rezultatul folosind „Vezi colecția”.</p>{!draft.isNew && <div className="delete-area"><button type="button" className="delete-button" disabled={locked} onClick={() => setDeleteOpen(true)}>Șterge poemul</button></div>}
          </form> : <div className="editor-empty"><span aria-hidden="true">✳</span><h2 id="editor-title">Loc pentru un poem nou</h2><p>Completează titlul, autorul și textul. Primul vers îți aparține.</p><button className="primary-button" disabled={!available || busy} onClick={() => replaceDraft(blank())}>Adaugă poem</button></div>}
        </section>
      </div>
    </main>
    <footer className="admin-footer shell"><p>Poetio · Administrare privată</p><a href="/">Înapoi la colecție</a></footer>
    <AlertDialog open={deleteOpen} onOpenChange={open => { if (!locked) setDeleteOpen(open); }}><AlertDialogContent lang="ro"><AlertDialogHeader><AlertDialogTitle>Ștergi acest poem?</AlertDialogTitle><AlertDialogDescription>„{draft?.title}” va fi eliminat definitiv din colecție. Această acțiune nu poate fi anulată.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={locked}>Păstrează poemul</AlertDialogCancel><AlertDialogAction className="confirm-delete" disabled={locked} onClick={event => { event.preventDefault(); void remove(); }}>{busy ? 'Se șterge…' : 'Șterge definitiv'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent lang="ro"><AlertDialogHeader><AlertDialogTitle>Renunți la modificările nesalvate?</AlertDialogTitle><AlertDialogDescription>Textul pe care nu l-ai salvat va fi pierdut. Poți reveni la formular pentru a-l salva.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => { pendingAction.current = null; }}>Continuă editarea</AlertDialogCancel><AlertDialogAction onClick={() => { const action = pendingAction.current; pendingAction.current = null; setDiscardOpen(false); action?.(); }}>Renunță la modificări</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
