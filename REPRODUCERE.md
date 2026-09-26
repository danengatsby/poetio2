# Reproducerea aplicației din Git

Depozitul aplicației este directorul `sursa`. Un checkout trebuie să includă codul, migrările SQL și metadatele Drizzle, scripturile, configurațiile model din `deploy`, testele, `package-lock.json` și resursele statice. Directorul părinte cu `current`, `releases` și rapoartele locale nu face parte din acest depozit.

Inventarul din 26 septembrie 2026 a găsit 33 de fișiere urmărite modificate și 150 de fișiere noi, înaintea adăugării acestei proceduri. Acestea acoperă cărți și video, comentarii moderate, schițe și istoric, pagini individuale, imagini responsive și validarea uploadurilor, backup, actualizarea dependențelor și memorarea comună a limbii. Fișierele `verificari-editoriale.json` și `verificari-imagini.json` păstrează rezultate istorice din septembrie 2026; nu certifică starea curentă a producției.

## Mediu și instalare

Versiunea Node pentru verificare este fixată în `.nvmrc` la `24.21.0` (npm `11.19.0`). Folosește un director nou și o revizie Git explicită:

```sh
git clone <URL-repozitoriu> poetio-verificare
cd poetio-verificare
git checkout --detach <commit>
nvm install
nvm use
npm ci --no-audit --no-fund
```

Dacă nu folosești nvm, instalează separat versiunea Node din `.nvmrc`. `npm ci` folosește versiunile și verificările de integritate din lockfile; nu copia `node_modules` dintr-un release anterior.

Pe Ubuntu, testele de randare PDF și backup necesită și dependențe de sistem:

```sh
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  poppler-utils fonts-dejavu-core fontconfig python3 gnupg
```

Python trebuie să ofere `hashlib.file_digest` și filtrul `data` pentru `tarfile.extractall` (Python 3.12 sau mai nou). Scripturile Linux folosesc și utilitarele uzuale `bash`, `timeout`, `flock`, `curl` și `sha256sum`.

## Verificări din checkout

```sh
npm run lint -- --max-warnings=0
./node_modules/.bin/tsc --noEmit --incremental false
npm run test:backup
npm test
npm run build:vps
git status --short
```

`npm test` compilează varianta Cloudflare și rulează testele Node, inclusiv integrarea Worker cu D1/R2 locale și răspunsuri simulate pentru traduceri. Nu necesită o cheie OpenAI reală. `npm run build:vps` verifică versiunile React/RSC și compilează varianta Node. Ambele comenzi scriu în `dist`; execută-le în ordinea de mai sus sau în checkouturi separate. `npm run test:vps` poate fi folosit pentru suita Node destinată VPS, fără o compilare Cloudflare.

Variantele WebP din `public/optimized` și manifestul `lib/generated-images.ts` sunt versionate împreună cu originalele și generatorul `scripts/build-images.mjs`. Compilările le regenerează; o diferență raportată de Git trebuie revizuită înainte de publicare. Cache-urile, `dist`, `node_modules`, bazele SQLite și credențialele sunt excluse din Git.

## Limitele verificării și publicarea

Checkoutul reproduce sursele și permite reconstruirea aplicației. Conținutul salvat de utilizatori, fișierele media private, certificatele și secretele runtime se restaurează separat din backup, conform [BACKUP-VPS.md](BACKUP-VPS.md). Configurațiile din `deploy` sunt modele care trebuie instalate pe serverul țintă; versionarea lor nu activează servicii.

Revizuirea pentru această includere în Git urmărește completitudinea surselor, dependențele, migrările, protecțiile API și verificările automate. Problema cunoscută a traducerii generate pentru un original schimbat după o salvare eșuată rămâne deschisă; includerea versiunii în Git nu o remediază.

Publicarea folosește un release nou construit din commitul ales și procedura din [DEPLOY-VPS.md](DEPLOY-VPS.md). Rezultatele operaționale trebuie verificate pe serverul efectiv. Un commit local nu este încă disponibil într-un depozit extern până la un push autorizat.
