import { AppError } from '../lib/access';
import type { BookValidation } from '../lib/book-types';
import type { StoredBookFile } from './book-files';

export type BookCheckCode = 'invalid' | 'encrypted' | 'limits' | 'unavailable';
type CheckResult = Omit<BookValidation, 'error'> & { code?: BookCheckCode };
export type BookValidator = {
  checkUpload(bytes: Uint8Array): Promise<unknown>;
  validation(file: StoredBookFile, retry?: boolean): Promise<CheckResult>;
};

const messages: Record<BookCheckCode, string> = {
  invalid: 'PDF-ul este incomplet sau conține pagini care nu pot fi citite. Exportă din nou documentul și încarcă noul PDF.',
  encrypted: 'PDF-ul este protejat prin criptare sau parolă. Exportă o copie fără protecție și încarc-o din nou.',
  limits: 'PDF-ul depășește limitele de procesare. Simplifică documentul sau împarte-l în volume mai mici și încarcă-l din nou.',
  unavailable: 'Verificarea PDF-ului nu este disponibilă momentan. Reîncearcă; datele introduse sunt păstrate.',
};
function codeOf(error: unknown): BookCheckCode {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  return code === 'invalid' || code === 'encrypted' || code === 'limits' ? code : 'unavailable';
}
function requireValidator(validator: BookValidator | undefined): asserts validator is BookValidator {
  if (!validator) throw new AppError(503, messages.unavailable);
}
export async function validateBookUpload(bytes: Uint8Array, validator: BookValidator | undefined) {
  requireValidator(validator);
  try { await validator.checkUpload(bytes); }
  catch (error) {
    const code = codeOf(error);
    throw new AppError(code === 'unavailable' ? 503 : 422, messages[code]);
  }
}
export async function bookValidation(file: StoredBookFile, validator: BookValidator | undefined, retry = false): Promise<BookValidation> {
  requireValidator(validator);
  try {
    const result = await validator.validation(file, retry);
    // A malformed or partial result must never authorize publication.
    if (!['checking', 'ready', 'error'].includes(result.status) || !Number.isSafeInteger(result.pages) || result.pages < 0 || !Number.isSafeInteger(result.checkedPages) || result.checkedPages < 0 || result.checkedPages > result.pages || (result.status === 'ready' && (result.pages < 1 || result.checkedPages !== result.pages))) throw new Error('Invalid PDF validation result');
    return { status: result.status, pages: result.pages, checkedPages: result.checkedPages, ...(result.status === 'error' ? { error: messages[codeOf(result)] } : {}) };
  } catch {
    throw new AppError(503, messages.unavailable);
  }
}
export async function requireReadyBook(file: StoredBookFile, validator: BookValidator | undefined) {
  const result = await bookValidation(file, validator);
  if (result.status === 'checking') throw new AppError(409, 'Paginile PDF-ului sunt încă în verificare. Așteaptă finalizarea înainte de publicare.');
  if (result.status === 'error') throw new AppError(422, result.error!);
}
