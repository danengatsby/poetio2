import { env } from '@/server/vps-env';
import { validateInput } from '@/db/poems';
import { AppError, apiError, readJson, requireSafeMutation } from '@/lib/access';
import { isTranslationTarget, translatePoem, TRANSLATION_TARGETS, type TranslationConfig } from '@/lib/translate-poem';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSafeMutation(request);
    const data = await readJson(request);
    const original = validateInput({
      title: data?.title,
      theme: data?.theme,
      content: data?.content,
      author: 'Translation',
    });
    // Which versions to prepare (English `translated`, fr, de, es, it); all of them when the editor names none.
    const targets = data?.targets ?? TRANSLATION_TARGETS;
    if (
      !Array.isArray(targets) ||
      !targets.length ||
      !targets.every(isTranslationTarget) ||
      new Set(targets).size !== targets.length
    )
      throw new AppError(400, 'Limbile cerute pentru traducere nu sunt valide.');
    const result = await translatePoem(original, env as unknown as TranslationConfig, targets);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
