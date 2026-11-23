// The owner's address is server configuration (POETIO_OWNER_EMAIL, systemd reads it from
// /etc/poetio/runtime.env), not part of the public repository. nginx adds the same address
// to a request only after the administrator password is accepted (deploy/poetio-app.conf).
// Without it nobody is the owner, so administration stays closed. Never sent to clients.
function ownerEmail() {
  return process.env.POETIO_OWNER_EMAIL?.trim().toLowerCase() || '';
}

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isOwnerEmail(email: string | null | undefined) {
  const owner = ownerEmail();
  return owner !== '' && email?.trim().toLowerCase() === owner;
}

export function requireOwner(request: Request) {
  // Sites dispatch supplies this authenticated header. No client-supplied roles.
  const email = request.headers.get('oai-authenticated-user-email');
  if (!email)
    throw new AppError(401, 'Sesiunea a expirat. Autentifică-te din nou; textul introdus rămâne în formular.');
  if (!isOwnerEmail(email)) throw new AppError(403, 'Doar proprietarul site-ului poate administra poemele.');
}

export function requireSameOriginOwner(request: Request) {
  requireOwner(request);
  requireSameOrigin(request);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const siteOrigin = new URL(request.url).origin;
  if (!origin || origin !== siteOrigin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AppError(403, 'Cererea nu provine din acest site. Reîncarcă pagina și încearcă din nou.');
  }
}

export function requireSafeMutation(request: Request) {
  requireSameOriginOwner(request);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new AppError(415, 'Formatul cererii nu este acceptat.');
  }
}

export async function readJson(request: Request, limit = 320_000) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new AppError(413, 'Poemul este prea lung.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Cererea este goală.');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(413, 'Poemul este prea lung.');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, 'Datele trimise nu pot fi citite.');
  }
}

export function apiError(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  console.error('Poem storage request failed', error);
  return Response.json(
    { error: 'Poemele nu pot fi accesate momentan. Încearcă din nou; textul introdus nu s-a pierdut.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
