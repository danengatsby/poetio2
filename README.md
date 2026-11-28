# Poetio

Bibliotecă de poezie în șase limbi cu lectură audio, galerie video, cărți și magazin. Aplicația rulează pe VPS cu Node și vinext. SQLite păstrează conținutul, comenzile și istoricul. Fișierele media sunt stocate local. Nginx autentifică administratorul, iar aplicația verifică identitatea configurată pe server.

Pentru dezvoltare locală, folosește versiunea Node din `.nvmrc` și o bază dedicată:

```sh
npm ci
mkdir -p .data
node scripts/migrate.mjs apply .data/poetio.sqlite3 --create
npm run dev
```

Editorul permite schițe, revizuirea traducerilor și publicarea cu verificarea versiunii. Traducerea automată din română în engleză, franceză, germană, spaniolă și italiană este opțională și folosește API-ul Claude (`lib/translate-poem.ts`). Serverul citește `ANTHROPIC_API_KEY`, `POETIO_TRANSLATION_MODEL` (implicit `claude-opus-5-5`) și `POETIO_OWNER_EMAIL` din mediul procesului. Pe VPS configurarea este în `/etc/poetio/runtime.env`.

[Instalare și teste](REPRODUCERE.md) · [Publicarea pe VPS](deploy/PUBLICARE.md) · [Backup și restaurare](BACKUP-VPS.md)

Varianta Worker cu D1 și R2 a fost retrasă la 23 noiembrie 2026. Rapoartele datate descriu versiunile verificate la momentul respectiv.
