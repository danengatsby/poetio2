'use client';
// Document navigation also updates localized metadata.
import type { Poem, PoemLanguage } from '@/lib/poem-types';
import { videoPosterPath, type Video } from '@/lib/video-types';
import { contentPath } from '@/lib/content-metadata';
import { rememberSiteLanguage, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from './site-header';
import PoemReading from './poem-reading';
import { ReaderComments } from './poem-comments';
import VideoReading from './video/video-reading';
import { useState } from 'react';
import './video/video.css';
import './content-detail.css';

export default function ContentDetail({ poem, video, language, backHref }: {poem?:Poem;video?:Video;language:PoemLanguage;backHref?:string}) {
  const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
  const ro=language==='ro',item=poem??video!;const kind=poem?'poem':'video';
  const path=contentPath(kind,item.id);
  const collectionPath=poem?(backHref??withSiteLanguage('/#collection',language)):withSiteLanguage('/video',language);
  function changeLanguage(locale: PoemLanguage) {
    rememberSiteLanguage(locale);
    const query=new URLSearchParams({lang:locale});
    if(poem&&backHref)query.set('returnTo',backHref);
    window.location.assign(path + '?' + query.toString());
  }
  async function copy(){try{await navigator.clipboard.writeText(window.location.href);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}
  const share = <div className="content-share"><button type="button" className="secondary-button" onClick={()=>void copy()}>{ro?'Copiază linkul':'Copy link'}</button><span role="status">{copied?(ro?'Link copiat.':'Link copied.'):copyError?(ro?'Copiază adresa din bara browserului.':'Copy the address from your browser.'):''}</span></div>;
  return <><a className="skip-link" href="#main">{ro?'Mergi la conținut':'Skip to content'}</a><SiteHeader language={language} onLanguageChange={changeLanguage} videoPage={!!video} poemPage={!!poem}/>
    <main id="main" className="content-detail shell" lang={language}><a className="content-back" href={collectionPath}>← {ro?'Înapoi la colecție':'Back to collection'}</a>
      {poem ? <PoemReading poem={poem} language={language}>{share}</PoemReading> : <VideoReading video={video!} src={`/api/video-files/${video!.file_id}`} poster={videoPosterPath(video!.file_id)} language={language}>{share}</VideoReading>}
      <ReaderComments endpoint={`/api/${poem?'poems':'videos'}/${item.id}/comments`} language={language} intro={video?(ro?'Ce ți-a transmis acest video?':'What did this video bring to mind?'):undefined}/>
    </main><footer className="site-footer shell"><a href={withSiteLanguage('/', language)} className="wordmark">Poetio✳</a><a href={collectionPath}>{ro?'Înapoi la colecție':'Back to collection'}</a></footer></>;
}
