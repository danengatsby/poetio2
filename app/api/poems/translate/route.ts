import { env } from 'cloudflare:workers';
import { validateInput } from '@/db/poems';
import { apiError, readJson, requireSafeMutation } from '@/lib/access';
import { translatePoem, type TranslationConfig } from '@/lib/translate-poem';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSafeMutation(request);
    const data = await readJson(request);
    const original = validateInput({ title: data?.title, theme: data?.theme, content: data?.content, author: 'Translation' });
    const translation = await translatePoem(original, env as unknown as TranslationConfig);
    return Response.json({ translation }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
