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

5. **Curățenie.** După o activare reușită, `activate` șterge singur versiunile din `releases/` mai vechi decât ultimele cinci și instantaneele `before-*` din `/var/backups/poetio` mai vechi de 30 de zile. Versiunea activă, ținta ei de revenire și instantaneul versiunii active rămân întotdeauna. `--no-prune` sare curățenia o dată. Lista se vede fără să se șteargă nimic cu `sudo python3 deploy/release.py prune`, iar `prune --apply` o aplică. Copiile zilnice din `/var/backups/poetio/automatic` au propria regulă (ultimele 7).

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

Dacă GitHub nu e disponibil, poți construi și împacheta local, într-un checkout curat al commitului: `npm ci && python3 scripts/verify-local-build.py /tmp/poetio-build`. Arhiva se publică apoi cu `prepare --artifact /tmp/poetio-build/poetio-build-<commit>.tar.gz`. Scriptul salvează lângă arhivă un fișier `.checks.json` cu rezultatele, commitul și suma arhivei. Comanda `prepare` îl verifică și îl copiază lângă manifest ca `local-checks.json`. Dovezile notează `tested_by_ci: false` pentru compilarea locală. Pe acest server, buildul local are nevoie de swap și de `choom`; vezi notele despre memorie.

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

Aplicația trimite pe fiecare răspuns `Content-Security-Policy` și `Permissions-Policy` (`lib/security-headers.ts`, aplicate din `next.config.ts`). Politica este aplicată din 28 noiembrie 2026, după șase zile în care a doar raportat (`Content-Security-Policy-Report-Only`) fără nicio încălcare de la o pagină reală. Browserele blochează ce nu e permis și trimit la `/api/csp-report` ce au blocat. Serverul scrie fiecare raport în jurnal, fără parametrii adresei, cel mult 200 pe oră:

```sh
journalctl -u poetio --since "-7 days" | grep "CSP violation"
```

Testele de browser verifică pe fiecare pagină deschisă că nu apare nicio încălcare (`tests/e2e/test.mjs`). Dacă apar rapoarte, verifică dacă sunt reale (o resursă nouă a site-ului, care trebuie adăugată în politică) sau zgomot (extensii de browser, de obicei `chrome-extension:` sau scripturi injectate). O resursă nouă de pe alt domeniu (fonturi, analiză, plăți) nu se încarcă până nu e adăugată în `lib/security-headers.ts`. Ca soluție temporară, redenumirea antetului înapoi în `Content-Security-Policy-Report-Only` din `next.config.ts` oprește blocarea.

## Adresa administratorului

Adresa de email a administratorului nu stă în repository. Aplicația o citește din `POETIO_OWNER_EMAIL` în `/etc/poetio/runtime.env` (root, 0600), iar nginx o adaugă la cerere, după parola de administrator, din `/etc/nginx/conf.d/poetio-owner.conf` (modelul [poetio-owner.conf.example](poetio-owner.conf.example)). Cele două trebuie să conțină aceeași adresă și adresa nu se mai schimbă, pentru că fișierele încărcate sunt înregistrate pe ea. Fără `POETIO_OWNER_EMAIL`, administrarea rămâne închisă și serviciul scrie un avertisment la pornire. Fără `poetio-owner.conf`, `nginx -t` refuză configurația. Pe un server nou, ambele fișiere se scriu înainte de `app.conf` și de prima pornire.

## Jurnalul nginx

Cererile pentru poetio.cloud se scriu în `/var/log/nginx/poetio.access.log`, cu numele site-ului la început și timpii de răspuns la sfârșit (`log_format poetio_vhost` din [poetio-http.conf](poetio-http.conf)). Celelalte site-uri de pe server rămân în `access.log`. Rotația zilnică din `/etc/logrotate.d/nginx` acoperă ambele fișiere.

Aplicația nu are Server Actions, așa că `app.conf` refuză orice cerere cu antetul `Next-Action` sau `x-rsc-action` (403) și orice POST pe o pagină, adică în afara `/api/` (405), înainte să ajungă la Node.

## Alerte

Joburile serverului trimit email când eșuează: backupul, copia de pe Google Drive, verificarea site-ului la 5 minute, localizarea, emailurile de comenzi și notificările. Unitatea lor pornește `poetio-alert@<job>.service` prin `OnFailure=`. Scriptul [alert-mail.py](../scripts/alert-mail.py) trimite ultimele rânduri din jurnal prin contul SMTP din `/etc/poetio/notify.env`, la `POETIO_ALERT_TO` sau, în lipsa ei, la `POETIO_NOTIFY_TO`. Aceeași problemă se anunță din nou cel mult o dată la 6 ore (`POETIO_ALERT_REPEAT_HOURS`). Primele patru joburi trimit și un mesaj când funcționează din nou (`OnSuccess=`).

```sh
sudo install -m 0755 scripts/alert-mail.py /usr/local/sbin/poetio-alert
sudo install -m 0644 deploy/poetio-alert@.service deploy/poetio-{backup,offsite,heartbeat,geoip,order-mail,notify}.service /etc/systemd/system/
sudo systemctl daemon-reload
```

Verificarea de pe server nu poate anunța un server oprit de tot. Pentru asta, [uptime.yml](../.github/workflows/uptime.yml) verifică din GitHub, la fiecare 30 de minute, pagina principală, fluxul RSS și certificatul. O rulare eșuată trimite email de la GitHub contului care a făcut ultimul push pe `main`. GitHub suspendă programările dintr-un repository public după 60 de zile fără commituri și anunță înainte. Programarea se reia din tabul Actions („Enable workflow”) sau la următorul push.

De la migrarea 0028, serviciul aplicației curăță vizitele vechi la pornire și zilnic. Pentru confirmările multilingve, actualizează și scriptul folosit de serviciile de email la activarea versiunii:

```sh
sudo install -m 0755 /var/www/Poetio/current/scripts/notify-comments.py /usr/local/sbin/poetio-notify-comments
```
