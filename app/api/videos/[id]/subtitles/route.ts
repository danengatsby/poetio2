import { getPoemDb } from '@/db/binding';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const row = await getPoemDb()
    .prepare('SELECT subtitle_text FROM videos WHERE id=?')
    .bind((await params).id)
    .first<{ subtitle_text: string }>();
  return new Response(row?.subtitle_text || null, {
    status: row?.subtitle_text ? 200 : 404,
    headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
