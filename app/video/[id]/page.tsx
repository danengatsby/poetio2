import { notFound } from 'next/navigation';
import { getPoemDb } from '@/db/binding';
import { getVideo,validateVideoId } from '@/db/videos';
import { hasVideoPosters } from '@/db/video-binding';
import { videoPosterPath } from '@/lib/video-types';
import { requestLanguage } from '@/lib/request-language';
import { contentMetadata,contentPath,excerpt,safeJsonLd,siteOrigin } from '@/lib/content-metadata';
import ContentDetail from '../../content-detail';
export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>;searchParams:Promise<{lang?:string}>};
// Link previews show the film's own still where this runtime can render one.
const previewImage=(fileId:string)=>hasVideoPosters()?videoPosterPath(fileId):'/assets/poetio-balloons.png';
async function read(props:Props){const {id}=await props.params;try{validateVideoId(id);}catch{notFound();}const video=await getVideo(getPoemDb(),id);if(!video)notFound();return {video,language:await requestLanguage()};}
export async function generateMetadata(props:Props){const {video,language}=await read(props);return contentMetadata({title:video.title,author:video.author,description:excerpt(video.description,`${video.title} — ${language==='ro'?'Video din colecția Poetio.':'Video from the Poetio collection.'}`),path:contentPath('video',video.id)+(language==='en-US'?'?lang=en-US':''),image:previewImage(video.file_id),language,updated:video.updated_at,published:video.created_at,video:`/api/video-files/${video.file_id}`});}
export default async function VideoPage(props:Props){const {video,language}=await read(props);return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd({'@context':'https://schema.org','@type':'VideoObject',name:video.title,description:excerpt(video.description,video.title),author:video.author?{'@type':'Person',name:video.author}:undefined,uploadDate:new Date(video.created_at).toISOString(),contentUrl:siteOrigin+`/api/video-files/${video.file_id}`,url:siteOrigin+contentPath('video',video.id),thumbnailUrl:siteOrigin+previewImage(video.file_id)})}}/><ContentDetail video={video} language={language}/></>;}
