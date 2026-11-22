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

La fiecare rulare, runner-ul compară schema cu cea pe care o produc migrările înregistrate și se oprește dacă ea a fost modificată de mână. `--target <nume>` aplică migrările doar până la cea indicată. Scripturile `scripts/migrate-*-vps.mjs`, pomenite în documentele mai vechi, au fost înlocuite de runner, care aplică aceleași fișiere SQL.

O bază creată înainte de runner primește registrul la prima rulare. Schema ei se compară cu schema fiecărui prefix al migrărilor, iar dacă nu corespunde exact niciunuia, runner-ul se oprește fără să scrie.

## Testele de browser

```sh
npm run build:vps
npm run test:e2e
```

Testele pornesc buildul pe o bază temporară, creată de runner. Poemele de test sunt adăugate prin API-ul serverului. Pentru alt build se setează `POETIO_E2E_BUILD_DIR`. Pe acest server, Chromium-ul din Playwright are nevoie de bibliotecile din `LD_LIBRARY_PATH`. În CI sunt instalate cu `npx playwright install --with-deps --only-shell chromium`.

## Fără GitHub

Dacă GitHub nu e disponibil, poți construi și împacheta local, într-un checkout curat al commitului: `npm ci && npm run build:vps && node scripts/package-build.mjs build-out`. Arhiva se publică apoi cu `prepare --artifact build-out/poetio-build-<commit>.tar.gz`. Dovezile notează `tested_by_ci: false`. Pe acest server, buildul local are nevoie de swap și de `choom`; vezi notele despre memorie.

## Confirmările de comandă prin email

Pe VPS, `poetio-order-mail.timer` verifică comenzile noi la fiecare 15 secunde. Serviciul trimite câte un mesaj vânzătorului și la adresa cumpărătorului din comandă. Vânzătorul primește mesajul la `POETIO_ORDER_TO`, dacă e setat în `/etc/poetio/notify.env`; altfel la emailul de contact din `/admin/magazin`, iar în lipsa lui la `POETIO_NOTIFY_TO`. La prima pornire ia drept punct de plecare ultima comandă existentă. Păstrează directorul privat `/var/lib/poetio-notify` la mutarea serviciului pe alt server.

Instalează scriptul și unitățile din checkout pentru a activa serviciul pe un VPS nou.

```sh
sudo install -m 0755 scripts/notify-comments.py /usr/local/sbin/poetio-notify-comments
sudo install -m 0644 deploy/poetio-order-mail.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now poetio-order-mail.timer
```

Serviciul citește expeditorul și datele SMTP din `/etc/poetio/notify.env` la fiecare rulare. Folosește modelul [poetio-notify.env.example](poetio-notify.env.example) și salvează configurația cu proprietarul root și permisiuni 0600. Pentru un cont Gmail, `sudo python3 -I deploy/configure-order-gmail.py` cere adresa contului și parola de aplicație, verifică autentificarea și scrie datele SMTP în acest fișier. Mesajele așteaptă până la configurarea SMTP. După un refuz SMTP, serviciul reîncearcă livrarea pentru destinatarul respectiv după cinci minute. Poți verifica numărul de comenzi în așteptare cu `sudo -u poetio /usr/local/sbin/poetio-notify-comments --check`.

## Statistica vizitelor

Paginile publice raportează fiecare vizită la `/api/visits`, iar statistica se vede în `/admin/vizite`. Tabelul `visits` vine din migrarea 0023. Adresa IP și datele browserului se șterg după 90 de zile (`VISIT_IP_RETENTION_DAYS` din `lib/visits.ts`). Paragraful despre vizite din `/termeni` trebuie păstrat în acord cu această durată.

Localitatea se deduce pe server din baza gratuită DB-IP City Lite (CC BY 4.0, atribuirea apare în `/admin/vizite`). IP-urile vizitatorilor nu sunt trimise nicăieri. Instalează o dată baza și actualizarea lunară:

```sh
sudo install -d -o poetio -g poetio -m 0750 /var/lib/poetio/geoip
sudo install -m 0755 scripts/update-geoip.py /usr/local/sbin/poetio-update-geoip
sudo install -m 0644 deploy/poetio-geoip.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now poetio-geoip.timer
sudo systemctl start poetio-geoip.service
```

Prima descărcare are aproximativ 60 MB (127 MB după dezarhivare). Site-ul preia noul fișier în cel mult 10 minute, fără repornire. Fără bază, vizitele se înregistrează fără localitate. Backupul nu include baza de localizare, care se poate descărca din nou oricând.

## Content Security Policy și Permissions-Policy

Aplicația trimite pe fiecare răspuns `Content-Security-Policy-Report-Only` și `Permissions-Policy` (`lib/security-headers.ts`, aplicate din `next.config.ts`). Deocamdată politica doar raportează: browserele nu blochează nimic, dar trimit la `/api/csp-report` ce ar fi blocat. Serverul scrie fiecare raport în jurnal, fără parametrii adresei, cel mult 200 pe oră:

```sh
journalctl -u poetio --since "-7 days" | grep "CSP violation"
```

Testele de browser verifică pe fiecare pagină deschisă că nu apare nicio încălcare (`tests/e2e/test.mjs`). Când jurnalul rămâne curat câteva zile, redenumește antetul în `Content-Security-Policy` din `next.config.ts` ca politica să fie aplicată. Dacă apar rapoarte, verifică dacă sunt reale (o resursă nouă a site-ului) sau zgomot (extensii de browser, de obicei `chrome-extension:` sau scripturi injectate).
