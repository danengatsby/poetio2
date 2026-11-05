'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { PoemLanguage } from '@/lib/poem-types';
import LanguageSelector from '../language-selector';
import '../content-detail.css';
import './reader-preview.css';

export default function ReaderPreview({ children, disabled = false, note }: { children: (language: PoemLanguage) => React.ReactNode; disabled?: boolean; note?: React.ReactNode }) {
  const [open, setOpen] = useState(false), [language, setLanguage] = useState<PoemLanguage>('ro');
  const dialog = useRef<HTMLDialogElement>(null), heading = useId();
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);
  return <div className="editor-reader-preview">
    <button type="button" className="secondary-button" disabled={disabled} onClick={() => setOpen(true)}>Previzualizare ca cititor</button>
    <dialog ref={dialog} className="reader-preview" aria-labelledby={heading} onClose={() => setOpen(false)}>
      {open && <><header className="reader-preview-heading"><div><h2 id={heading}>Previzualizare privată</h2><p>Modificările din editor. Deschiderea nu salvează și nu publică.</p></div><button type="button" className="secondary-button" autoFocus onClick={() => dialog.current?.close()}>Înapoi la editor</button></header>
        <LanguageSelector language={language} onChange={setLanguage} />
        {note && <div className="preview-media-state" role="status">{note}</div>}
        <div className="content-detail preview-content" lang={language}>{children(language)}</div>
      </>}
    </dialog>
  </div>;
}
