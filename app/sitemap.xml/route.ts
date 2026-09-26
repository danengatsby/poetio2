import { getPoemDb } from '@/db/binding';
import { listPoems } from '@/db/poems';
import { listVideos } from '@/db/videos';
import { listBooks } from '@/db/books';
import { siteOrigin,contentPath } from '@/lib/content-metadata';
export const dynamic='force-dynamic';
export async function GET(){const db=getPoemDb();const [poems,videos,books]=await Promise.all([listPoems(db),listVideos(db),listBooks(db)]);const entries=[...['/','/video','/carti','/autor'].map(path=>({path,updated:0})),...poems.map(p=>({path:contentPath('poem',p.id),updated:p.updated_at})),...videos.map(v=>({path:contentPath('video',v.id),updated:v.updated_at})),...books.map(b=>({path:'/carti/'+b.id,updated:b.updated_at}))];return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(e=>`<url><loc>${siteOrigin}${e.path}</loc>${e.updated?`<lastmod>${new Date(e.updated).toISOString()}</lastmod>`:''}</url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-store'}});}
