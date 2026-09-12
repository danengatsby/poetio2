# Poetio pe serverul 159.69.200.202

Colecție publică: https://159.69.200.202:8096/

Administrare: https://159.69.200.202:8096/admin

Aplicația rulează ca serviciu `poetio.service`, cu utilizatorul dedicat `poetio`, pe `127.0.0.1:4106`. Nginx furnizează HTTPS pe portul 8096 și validează parola pentru administrare și operațiile de scriere. Identitatea trimisă aplicației este generată numai după această validare. Headerul de identitate primit de la vizitatori este eliminat.

Datele de acces se păstrează în `/etc/poetio/admin-credentials.txt`, disponibil numai administratorului serverului. Nginx folosește hashul parolei din `/etc/poetio/admin.htpasswd`. Aceste fișiere nu intră în Git sau în directorul public.

**Date și actualizări**

- Baza de date: `/var/lib/poetio/poetio.sqlite3`, SQLite cu WAL și chei externe activate.
- Imagini: `/var/lib/poetio/images/`; înregistrări audio: `/var/lib/poetio/audio/`. Fișierele sunt servite exclusiv prin API-ul aplicației.
- Compilare publicată: `/var/www/Poetio/vps/dist`.
- Configurație Nginx: `/etc/nginx/sites-available/poetio-vps` și `/etc/poetio/proxy.conf`.
- Configurație opțională de execuție: `/etc/poetio/runtime.env`.

`npm run build:vps` generează în `dist/` varianta pentru Node.js. După verificare, aceasta se copiază în directorul de publicare și se repornește `poetio.service`. Datele din `/var/lib/poetio` se păstrează la actualizare; exporturile inițiale nu se importă din nou peste datele active. Pentru backupul unei baze aflate în funcțiune se folosește mecanismul SQLite de backup, împreună cu o copie a directoarelor de imagini și audio; nu se copiază doar fișierul principal ignorând WAL.

Fișierele compilate trebuie să poată fi citite de serviciu: directorul publicat folosește proprietarul `root`, grupul `poetio`, permisiuni `0750` pentru directoare și `0640` pentru fișiere. Pentru datele modificabile, proprietarul este `poetio`, cu `0700` pentru directoare și `0600` pentru fișiere. Arhiva inițială include fișiere media cu permisiuni restrictive; copierea lor fără adaptarea permisiunilor poate împiedica pornirea serviciului.

`npm run build` păstrează compilarea originală pentru Sites. `POETIO_RUNTIME=node` selectează adaptorul SQLite/disc doar pentru compilarea VPS. Publicarea pe acest server nu modifică automat site-ul din Sites, iar cele două colecții evoluează independent după migrare.

Certificatul HTTPS existent pentru adresa IP este reutilizat. Reînnoirea lui este gestionată de `amanet-cert-renew.timer`; hookul de reînnoire verifică și reîncarcă Nginx. Nu elimina această dependență fără a configura o reînnoire alternativă pentru Poetio.

Traducerile deja salvate funcționează fără cheie API. Traducerea automată necesită configurarea separată a secretului `OPENAI_API_KEY` în `/etc/poetio/runtime.env` și repornirea serviciului. Fără acest secret, editorul permite salvarea originalului și completarea manuală a traducerii.

În editor, secțiunea **Înregistrările poemului** permite alegerea de pe calculator a câte unui fișier pentru română și engleză. Formate: MP3, WAV, M4A și OGG; maximum 25 MB/fișier. Previzualizarea este locală până la salvare. Poemele se pot salva fără audio și fără traducere. Playerul din fereastra poemului redă numai înregistrarea încărcată pentru limba afișată, cu controale native pentru redare, pauză, volum și deplasare în fișier. Nu generează recitări. Redarea se oprește la închiderea ferestrei sau schimbarea poemului/limbii. Compatibilitatea codecului depinde de browser; MP3 este o alegere practică pentru distribuire.

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
