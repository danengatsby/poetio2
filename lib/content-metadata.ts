import type { Metadata } from 'next';
export const siteOrigin = 'https://poetio.cloud';
export const contentPath = (kind: 'poem' | 'video', id: string) => `${kind === 'poem' ? '/poeme' : '/video'}/${encodeURIComponent(id)}`;
export function excerpt(text: string, fallback: string) { const plain = text.replace(/\s+/g,' ').trim();return plain ? plain.length > 157 ? plain.slice(0,157).trimEnd()+'…' : plain : fallback; }
export function contentMetadata({ title, author, description, path, image, language, updated, published, video }: {title:string;author:string;description:string;path:string;image:string;language:string;updated:number;published:number;video?:string}):Metadata {
  const url=siteOrigin+path;
  return { title:`${title} — ${author ? author+' · ' : ''}Poetio`,description,authors:author?[{name:author}]:undefined,alternates:{canonical:url},
    openGraph:{title,description,url,siteName:'Poetio',locale:language==='en-US'?'en_US':'ro_RO',images:[{url:siteOrigin+image,alt:title}],...(video?{type:'video.other' as const,videos:[{url:siteOrigin+video}]}:{type:'article' as const,publishedTime:new Date(published).toISOString(),modifiedTime:new Date(updated).toISOString(),authors:author?[author]:undefined})},
    twitter:{card:'summary_large_image',title,description,images:[siteOrigin+image]},robots:{index:true,follow:true} };
}
export const safeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g,'\\u003c');
