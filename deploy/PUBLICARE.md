# Publicarea pe poetio.cloud

Serverul de producție nu mai compilează și nu mai rulează verificările grele. GitHub Actions face asta la fiecare push. Pe server, `deploy/release.py` instalează doar un build deja testat.

## Fluxul

1. **Push pe `main`.** Workflow-ul [CI](../.github/workflows/ci.yml) rulează formatarea, ESLint, TypeScript și buildul VPS. Apoi verifică dacă imaginile generate coincid cu cele din Git și rulează testele VPS, de componente, Python și de browser. Dacă toate trec, atașează buildul la un pre-release numit `build-<commit>`. Pe GitHub se păstrează ultimele zece builduri.
2. **Pregătire pe server**, fără efect asupra site-ului:

   ```sh
   cd /var/www/Poetio/sursa && git pull
   sudo python3 deploy/release.py prepare --name <nume-scurt>
   ```

   Comanda ia commitul din `origin/main` (altul se alege cu `--commit`) și descarcă buildul. Verifică suma SHA-256, commitul, lockfile-ul și fiecare fișier din `dist/`. Construiește apoi directorul din `releases/`, aplică migrările pe o copie privată a datelor și pornește copia ca utilizator `poetio` pe portul 4203. Verificările acoperă pagina principală, sitemap-ul, un poem, căutarea în trei forme Unicode, imaginile, posterele, subtitrările și cărțile.

3. **Activare**, care oprește serviciul aproximativ o secundă:

   ```sh
   sudo python3 deploy/release.py activate
   ```

   Înainte de oprire, comanda verifică ultimul backup automat. Apoi face un snapshot al bazei în `/var/backups/poetio/before-<release>/`, aplică migrările, comută `current`, pornește serviciul și verifică site-ul local și public. La orice eroare revine singură la release-ul anterior.

4. **Revenire manuală**, dacă e nevoie: `sudo python3 deploy/release.py rollback`. Starea curentă se vede cu `sudo python3 deploy/release.py status`.

Dovezile fiecărei publicări (arhiva, manifestele, rezultatul migrării, jurnalul preview-ului, activarea) se scriu în `/var/www/Poetio/publicari/<release>/`.

## Dependențe

Dacă `package-lock.json` e identic cu cel din release-ul activ, `node_modules` se partajează prin legături fizice. Fișierele astfel legate nu se modifică și nu li se schimbă proprietarul. Dacă lockfile-ul s-a schimbat, rulează mai întâi `npm ci` în `sursa/`. Scriptul verifică pachet cu pachet că arborele instalat corespunde lockfile-ului, apoi îl copiază.

## Migrări

Schimbările de schemă se adaugă ca fișiere `drizzle/NNNN_nume.sql` (cu `npm run db:generate`). Le aplică runner-ul `scripts/migrate.mjs`, care le înregistrează cu suma SHA-256 în tabelul `schema_migrations`:

```sh
npm run migrate -- status /cale/poetio.sqlite3
npm run migrate -- apply /cale/poetio.sqlite3
```

Dacă o migrare are nevoie și de un pas de date (de exemplu reconstruirea unui index), acesta stă în `scripts/migrations/NNNN_nume.mjs` și trebuie să poată fi repetat. Un fișier SQL deja aplicat nu se mai modifică: runner-ul refuză baza dacă suma nu mai corespunde. La publicare, numărul de rânduri din tabelele editoriale trebuie să rămână același. Tabelele de căutare, `collection_meta` și registrul migrărilor sunt exceptate.

O bază creată înainte de runner primește registrul la prima rulare. Schema ei se compară cu schema fiecărui prefix al migrărilor, iar dacă nu corespunde exact niciunuia, runner-ul se oprește fără să scrie.

## Testele de browser

```sh
npm run build:vps
npm run test:e2e
```

Testele pornesc buildul pe o bază temporară, creată de runner. Poemele de test sunt adăugate prin API-ul serverului. Pentru alt build se setează `POETIO_E2E_BUILD_DIR`. Pe acest server, Chromium-ul din Playwright are nevoie de bibliotecile din `LD_LIBRARY_PATH`. În CI sunt instalate cu `npx playwright install --with-deps --only-shell chromium`.

## Fără GitHub

Dacă GitHub nu e disponibil, poți construi și împacheta local, într-un checkout curat al commitului: `npm ci && npm run build:vps && node scripts/package-build.mjs build-out`. Arhiva se publică apoi cu `prepare --artifact build-out/poetio-build-<commit>.tar.gz`. Dovezile notează `tested_by_ci: false`. Pe acest server, buildul local are nevoie de swap și de `choom`; vezi notele despre memorie.
