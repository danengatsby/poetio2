import { notFound } from 'next/navigation';
import { getPoemDb } from '@/db/binding';
import { getPoem, validateId } from '@/db/poems';
import { poemVersion } from '@/lib/poem-languages';
import { requestLanguage } from '@/lib/request-language';
import { collectionReturnHref } from '@/lib/poem-collection';
import { poemImage } from '@/lib/poem-images';
import { contentMetadata,contentPath,excerpt,safeJsonLd,siteOrigin } from '@/lib/content-metadata';
import ContentDetail from '../../content-detail';
export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>;searchParams:Promise<{lang?:string;returnTo?:string}>};
async function read(props:Props){const {id}=await props.params;try{validateId(id);}catch{notFound();}const poem=await getPoem(getPoemDb(),id);if(!poem)notFound();const search=await props.searchParams;const language=await requestLanguage();return {poem,language,backHref:collectionReturnHref(search.returnTo,language)};}
export async function generateMetadata(props:Props){const {poem,language}=await read(props);const version=poemVersion(poem,language)??poem;const path=contentPath('poem',poem.id)+(language==='en-US'?'?lang=en-US':'');const metadata=contentMetadata({title:version.title,author:poem.author,description:excerpt(version.content,version.title),path,image:poemImage(poem)+(poem.image_id?'?w=1280':''),language,updated:poem.updated_at,published:poem.created_at});return {...metadata,alternates:{...metadata.alternates,languages:{...(poemVersion(poem,'ro')?{ro:siteOrigin+contentPath('poem',poem.id)}:{}),...(poemVersion(poem,'en-US')?{'en-US':siteOrigin+contentPath('poem',poem.id)+'?lang=en-US'}:{})}}};}
export default async function PoemPage(props:Props){const {poem,language,backHref}=await read(props);const version=poemVersion(poem,language)??poem;return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd({'@context':'https://schema.org','@type':'CreativeWork',name:version.title,author:{'@type':'Person',name:poem.author},inLanguage:poemVersion(poem,language)?language:poem.source_language,url:siteOrigin+contentPath('poem',poem.id)+(language==='en-US'?'?lang=en-US':''),datePublished:new Date(poem.created_at).toISOString(),dateModified:new Date(poem.updated_at).toISOString()})}}/><ContentDetail poem={poem} language={language} backHref={backHref}/></>;}
