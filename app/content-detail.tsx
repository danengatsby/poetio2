'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Document navigation also updates localized metadata. */
import type { Poem, PoemLanguage } from '@/lib/poem-types';
import type { Video } from '@/lib/video-types';
import { contentPath } from '@/lib/content-metadata';
import { poemVersion } from '@/lib/poem-languages';
import { rememberSiteLanguage } from '@/lib/site-language';
import SiteHeader from './site-header';
import PoemAudioPlayer from './poem-audio-player';
import { ReaderComments } from './poem-comments';
import VideoPlayer from './video/video-player';
import { useState } from 'react';
import './video/video.css';
import './content-detail.css';

export default function ContentDetail({ poem, video, language }: {poem?:Poem;video?:Video;language:PoemLanguage}) {
  const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
  const ro=language==='ro',item=poem??video!;const kind=poem?'poem':'video';
  const version=poem?poemVersion(poem,language):null;
  const text=version??poem;const actualLanguage=version?language:poem?.source_language;
  const path=contentPath(kind,item.id);
  function changeLanguage(locale: PoemLanguage) {
    rememberSiteLanguage(locale);
    window.location.assign(path + (locale === 'en-US' ? '?lang=en-US' : ''));
  }
  async function copy(){try{await navigator.clipboard.writeText(window.location.href);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}
  return <><a className="skip-link" href="#main">{ro?'Mergi la conținut':'Skip to content'}</a><SiteHeader language={language} onLanguageChange={changeLanguage} videoPage={!!video} poemPage={!!poem}/>
    <main id="main" className="content-detail shell" lang={language}><a className="content-back" href={poem?'/#collection':'/video'}>← {ro?'Înapoi la colecție':'Back to collection'}</a>
      <article><p className="eyebrow">{poem?(text?.theme|| (ro?'Poezie':'Poetry')):'Video'}</p><h1 lang={poem?actualLanguage:undefined}>{text?.title??item.title}</h1>{item.author&&<p className="reader-author">{item.author}</p>}
        <div className="content-share"><button type="button" className="secondary-button" onClick={()=>void copy()}>{ro?'Copiază linkul':'Copy link'}</button><span role="status">{copied?(ro?'Link copiat.':'Link copied.'):copyError?(ro?'Copiază adresa din bara browserului.':'Copy the address from your browser.'):''}</span></div>
        {poem?<><PoemAudioPlayer audioId={poem[actualLanguage==='en-US'?'audio_en_id':'audio_ro_id']} title={text?.title??poem.title} language={actualLanguage??language}/>{!version&&<p className="original-language-note">{ro?'Traducerea nu este disponibilă; se afișează originalul.':'Translation unavailable; showing the original.'}</p>}<div className="reader-body saved-poem-text" lang={actualLanguage}>{text?.content}</div></>:<><VideoPlayer src={`/api/video-files/${video!.file_id}`} title={video!.title} language={language}/><p className="video-description">{video!.description}</p></>}
      </article>
      <ReaderComments endpoint={`/api/${poem?'poems':'videos'}/${item.id}/comments`} language={language} intro={video?(ro?'Ce ți-a transmis acest video?':'What did this video bring to mind?'):undefined}/>
    </main><footer className="site-footer shell"><a href="/" className="wordmark">Poetio✳</a><a href={poem?'/#collection':'/video'}>{ro?'Înapoi la colecție':'Back to collection'}</a></footer></>;
}
