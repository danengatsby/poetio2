# Poetio — poetio.cloud

Colecție publică: https://poetio.cloud/

Pagina publică „Autor”: https://poetio.cloud/autor. Fotografia și biografia completă „Despre Poetio” sunt prezentate aici, separat de colecție, în română și engleză. Meniul ambelor pagini oferă legăturile „Poemele”, „Autor” și „Administrare”.

Administrare: https://poetio.cloud/admin

HTTP și `www.poetio.cloud` redirecționează permanent către `https://poetio.cloud`, păstrând calea și parametrii. Adresa existentă https://159.69.200.202:8096/ rămâne accesibilă.

Aplicația rulează ca serviciu `poetio.service`, cu utilizatorul dedicat `poetio`, pe `127.0.0.1:4106`. Nginx furnizează HTTPS pe portul 443 pentru domeniu și 8096 pentru IP și validează parola pentru administrare și operațiile de scriere. Identitatea trimisă aplicației este generată numai după această validare. Headerul de identitate primit de la vizitatori este eliminat.

Meniul „Administrare” este vizibil și fără autentificare. Accesarea lui deschide solicitarea de utilizator și parolă a browserului, prin HTTPS. Contul administrativ configurat pe VPS este `admin`; parola se păstrează în `/etc/poetio/admin-credentials.txt`, disponibil numai administratorului serverului. Nginx folosește hashul parolei din `/etc/poetio/admin.htpasswd`. Aceste fișiere nu intră în Git sau în directorul public.

**Date și actualizări**

- Baza de date: `/var/lib/poetio/poetio.sqlite3`, SQLite cu WAL și chei externe activate.
- Imagini: `/var/lib/poetio/images/`; înregistrări audio: `/var/lib/poetio/audio/`. Fișierele sunt servite exclusiv prin API-ul aplicației.
- Compilare publicată: `/var/www/Poetio/vps/dist`.
- Configurație Nginx: `/etc/nginx/sites-available/poetio-cloud`, `/etc/nginx/sites-available/poetio-vps` și fișierele comune `/etc/poetio/app.conf`, `/etc/poetio/proxy.conf`, `/etc/poetio/audio-location.conf`.
- Configurație opțională de execuție: `/etc/poetio/runtime.env`.

`npm run build:vps` generează în `dist/` varianta pentru Node.js. După verificare, aceasta se copiază în directorul de publicare și se repornește `poetio.service`. Datele din `/var/lib/poetio` se păstrează la actualizare; exporturile inițiale nu se importă din nou peste datele active. Pentru backupul unei baze aflate în funcțiune se folosește mecanismul SQLite de backup, împreună cu o copie a directoarelor de imagini și audio; nu se copiază doar fișierul principal ignorând WAL.

Fișierele compilate trebuie să poată fi citite de serviciu: directorul publicat folosește proprietarul `root`, grupul `poetio`, permisiuni `0750` pentru directoare și `0640` pentru fișiere. Pentru datele modificabile, proprietarul este `poetio`, cu `0700` pentru directoare și `0600` pentru fișiere. Arhiva inițială include fișiere media cu permisiuni restrictive; copierea lor fără adaptarea permisiunilor poate împiedica pornirea serviciului.

`npm run build` păstrează compilarea originală pentru Sites. `POETIO_RUNTIME=node` selectează adaptorul SQLite/disc doar pentru compilarea VPS. Publicarea pe acest server nu modifică automat site-ul din Sites, iar cele două colecții evoluează independent după migrare.

**Domeniu și certificat HTTPS**

DNS: înregistrarea `A` pentru `poetio.cloud` indică `159.69.200.202`, iar `www` este un `CNAME` către `poetio.cloud`. Nu publica o înregistrare `AAAA` înainte de configurarea și verificarea accesului IPv6.

Certificatul Let's Encrypt pentru ambele nume este în `/etc/letsencrypt/live/poetio.cloud/`. Reînnoirea automată folosește `certbot.timer`, provocări HTTP în `/var/www/poetio-acme/.well-known/acme-challenge/` și hookul `/etc/poetio/renew-nginx.sh`, care verifică și reîncarcă Nginx după reînnoire. Portul 80 și ruta de validare trebuie să rămână accesibile public.

Fișierele din `deploy/` corespund configurației instalate:

- `poetio-cloud.nginx.conf` → `/etc/nginx/sites-available/poetio-cloud` (activat prin legătură în `sites-enabled`).
- `poetio.nginx.conf` → `/etc/nginx/sites-available/poetio-vps` (include și definirea unică a zonei `poetio_admin`).
- `poetio-app.conf` → `/etc/poetio/app.conf`; `poetio-proxy.conf` → `/etc/poetio/proxy.conf`; `nginx-audio-location.conf` → `/etc/poetio/audio-location.conf`.
- `poetio.service` → `/etc/systemd/system/poetio.service`.
- `poetio-renew-nginx.sh` → `/etc/poetio/renew-nginx.sh`, proprietar `root`, permisiuni `0750`.

La instalarea pe un server nou, activează inițial numai primul bloc `server` din configurația domeniului (HTTP), creează directorul de validare cu acces de citire pentru Nginx și verifică ruta pe ambele nume. Emite apoi certificatul înainte de activarea blocurilor HTTPS:

```sh
certbot certonly --webroot -w /var/www/poetio-acme \
  --cert-name poetio.cloud -d poetio.cloud -d www.poetio.cloud \
  --non-interactive --deploy-hook /etc/poetio/renew-nginx.sh
```

Comanda reutilizează contul ACME existent pe VPS. La instalarea inițială a Certbot, înregistrează mai întâi un cont ACME. După instalarea tuturor fișierelor, verifică `nginx -t`, rulează `systemctl daemon-reload`, repornește `poetio.service` și reîncarcă Nginx. Nu încărca noul proxy înainte ca ambele blocuri de aplicație să definească `$poetio_host`: valoarea este fixă pentru fiecare gazdă și protejează originea folosită la salvare și upload. `VINEXT_TRUSTED_HOSTS` acceptă `poetio.cloud,159.69.200.202:8096`; varianta `www` redirecționează înainte de a ajunge la aplicație.

Verificarea reînnoirii:

```sh
systemctl is-enabled certbot.timer
certbot renew --cert-name poetio.cloud --dry-run --run-deploy-hooks
```

Publicarea domeniului din 13 septembrie 2026 a fost verificată cu certificate valide pentru ambele nume, redirecționări HTTP/`www`, navigare în browser pe desktop și mobil, autentificarea administrării, imaginile originale și redarea parțială a fișierelor audio. Cererile de salvare și upload cu origine corectă ajung la validarea datelor; originile externe sau falsificate sunt respinse. Aceste verificări nu creează poeme ori fișiere. Simularea reînnoirii certificatului, inclusiv hookul Nginx, a reușit. Accesul existent prin IP și celelalte site-uri HTTPS ale serverului au fost verificate separat.

Certificatul separat pentru adresa IP este reutilizat. Reînnoirea lui este gestionată de `amanet-cert-renew.timer`; hookul de reînnoire verifică și reîncarcă Nginx. Nu elimina această dependență cât timp accesul prin IP este menținut.

Traducerile deja salvate funcționează fără cheie API. Traducerea automată necesită configurarea separată a secretului `OPENAI_API_KEY` în `/etc/poetio/runtime.env` și repornirea serviciului. Fără acest secret, editorul permite salvarea originalului și completarea manuală a traducerii.

În editor, secțiunea **Înregistrările poemului** permite alegerea de pe calculator a câte unui fișier pentru română și engleză. Formate: MP3, WAV, M4A și OGG; maximum 25 MB/fișier. Previzualizarea este locală până la salvare. Poemele se pot salva fără audio și fără traducere. Playerul din fereastra poemului redă numai înregistrarea încărcată pentru limba afișată, cu controale native pentru redare, pauză, volum și deplasare în fișier. Playerul este vizibil și înainte de încărcarea unui fișier, cu comenzile inactive și un mesaj despre lipsa înregistrării în limba selectată. Nu generează recitări. Redarea se oprește la închiderea ferestrei sau schimbarea poemului/limbii. Compatibilitatea codecului depinde de browser; MP3 este o alegere practică pentru distribuire.

Încărcările se fac prin `POST /api/audio`, cu autentificarea administratorului și verificarea originii. Fișierele neatașate rămân private; eliminarea unei asocieri nu șterge fișierul de pe disc. `GET`/`HEAD /api/audio/{id}` oferă acces public numai fișierelor atașate poemelor și acceptă intervale de octeți pentru redare și căutare. În Sites se folosește bucketul R2 existent; pe VPS, directorul audio separat.

La prima publicare a acestei versiuni, după backup SQLite și cu serviciul oprit, rulează:

```sh
node scripts/migrate-audio-vps.mjs /var/lib/poetio/poetio.sqlite3
install -d -o poetio -g poetio -m 0700 /var/lib/poetio/audio
```

Migrarea `0003_uploaded_audio.sql` adaugă tabela și legăturile audio fără modificarea textelor, imaginilor sau reviziilor existente. Scriptul VPS poate fi rulat din nou în siguranță. În Sites se aplică migrarea Drizzle prin fluxul normal de publicare.

În Nginx, copiază `deploy/nginx-audio-location.conf` în `/etc/poetio/audio-location.conf` și include-l în blocul HTTPS Poetio. Acesta adaugă o locație exactă pentru `/api/audio` cu `client_max_body_size 26m`, aceleași directive `auth_basic`, `auth_basic_user_file`, `auth_delay`, `limit_req`, `include /etc/poetio/proxy.conf` și identitatea verificată ca la încărcarea imaginilor. Restul rutelor păstrează limita existentă. Aplicația verifică limita de 25 MB inclusiv pentru corpuri HTTP transmise în flux. Verifică `nginx -t`, reîncarcă Nginx, publică noua compilare și pornește serviciul. În caz de revenire la compilarea anterioară, schema aditivă poate rămâne; nu restaura baza veche peste modificări ulterioare ale utilizatorului.

**Verificare și diagnostic**

```sh
npm run test:vps
systemctl status poetio --no-pager
journalctl -u poetio -n 50 --no-pager
nginx -t
```

Testele verifică persistența SQLite, rollbackul tranzacțiilor, compatibilitatea rezultatelor cu React Server Components și integritatea stocării imaginilor. Verificarea HTTP a publicării include colecția, ambele imagini, autentificarea, respingerea identităților falsificate și operațiile de salvare.

Publicarea din 10 septembrie 2026 a fost verificată prin HTTPS cu certificatul valid: navigare anonimă și autentificată, încărcarea unei imagini cu previzualizare privată, salvare bilingvă, editare, conflicte de revizie, ștergere și persistența datelor după repornirea serviciului. Datele temporare de test au fost eliminate. Cele două poeme și cele două imagini curente coincid cu sursa importată din Sites. Suita completă `npm test` trece toate cele 21 de teste; TypeScript și verificarea ESLint pentru fișierele noi/modificate ale adaptării VPS trec.
