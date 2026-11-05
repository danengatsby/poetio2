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
  poppler-utils util-linux ffmpeg tesseract-ocr tesseract-ocr-ron tesseract-ocr-eng \
  fonts-dejavu-core fontconfig python3 gnupg
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

## Rezultatul verificării din 26 septembrie 2026

Commitul `37dfbee497df918496c4027bf4eaed1919596086` a fost verificat într-o clonă locală independentă, cu checkout detașat, fără copierea fișierelor neversionate sau a dependențelor existente. `npm ci` a instalat din lockfile 675 de pachete, folosind un cache nou. Mediul verificat: Ubuntu 26.04, Node 24.21.0, npm 11.19.0 și Python 3.14.4.

| Verificare | Rezultat |
| --- | --- |
| ESLint cu `--max-warnings=0` | Fără erori sau avertismente |
| TypeScript fără emitere | Fără erori |
| `npm run test:backup` | 4/4 teste trecute |
| `npm test` | Compilare Cloudflare și 54/54 teste Node trecute, inclusiv Worker |
| `npm run build:vps` | Compilare reușită și versiuni React/RSC aliniate |
| Migrări SQL | Toate cele 12 se aplică în ordine pe o bază nouă; coloanele corespund ultimului snapshot Drizzle |
| Resurse responsive regenerate | Identice cu fișierele versionate |
| `git status --short` după verificări | Fără modificări în clonă |

Instalarea și compilările au emis notificări despre dependențele vechi `@esbuild-kit`, politica npm pentru scripturile de instalare și compatibilitatea viitoare a încărcătorului de configurație Vite; comenzile s-au încheiat cu succes. Verificarea confirmă reconstruirea și testarea acestei versiuni în mediul descris, fără a garanta compilări identice octet cu octet pe alte sisteme.

## Limitele verificării și publicarea

Checkoutul reproduce sursele și permite reconstruirea aplicației. Conținutul salvat de utilizatori, fișierele media private, certificatele și secretele runtime se restaurează separat din backup, conform [BACKUP-VPS.md](BACKUP-VPS.md). Configurațiile din `deploy` sunt modele care trebuie instalate pe serverul țintă; versionarea lor nu activează servicii.

Revizuirea pentru includerea din septembrie urmărește completitudinea surselor, dependențele, migrările, protecțiile API și verificările automate. Problema traducerii generate pentru un original schimbat ulterior a fost între timp remediată prin proveniența verificată la publicare; vezi [TRADUCERI-VERIFICATE.md](TRADUCERI-VERIFICATE.md).

Din 5 noiembrie, directoarele auxiliare sunt excluse explicit din TypeScript/ESLint, iar suita VPS se execută succesiv și include verificările migrării și căutării indexate. Pentru versiunea nouă se aplică și migrarea aditivă `0017`; vezi [CAUTARE-INDEXATA.md](CAUTARE-INDEXATA.md). Rezultatele istorice de mai sus rămân asociate commitului verificat atunci.

Publicarea folosește un release nou construit din commitul ales și procedura din [DEPLOY-VPS.md](DEPLOY-VPS.md). Rezultatele operaționale trebuie verificate pe serverul efectiv. Un commit local nu este încă disponibil într-un depozit extern până la un push autorizat.
