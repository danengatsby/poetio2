# Poetio — poetio.cloud

**Publicare actuală, 5 noiembrie 2026, 22:36 UTC:** release-ul `/var/www/Poetio/releases/20261105T223631Z-grouped-navigation`, commit `9956cb359bb2336f0733b65e7a8dc07308ad7c23`, grupează legăturile Poeme, Video, Cărți și Autor într-un bloc compact comun și evidențiază secțiunea curentă. Include toate funcționalitățile release-ului precedent. Fără modificări de schemă sau configurație; buildul și verificarea pe cele patru pagini la 320, 390, 1024 și 1440 px au trecut. [Dovezi](../publicare-navigare-2026-11-05/PUBLICARE.md).

**Publicare precedentă, 5 noiembrie 2026, 22:24 UTC:** release-ul activ este `/var/www/Poetio/releases/20261105T222246Z-search-indexes`, construit din commitul `60f92aa68470c61ff319a4cb8d18b081ddb145cb`. Include căutarea indexată în poeme și cărți, sitemap cu proiecție minimă, paginarea administrării și corectarea ariei TypeScript/ESLint. Migrarea aditivă `0017` este aplicată; înregistrările existente sunt identice înainte și după migrare. Au trecut 93 de teste VPS, 8 teste Python, TypeScript, ESLint, buildul și verificările HTTP/browser. [Funcționare](CAUTARE-INDEXATA.md), [dovezi și revenire](../publicare-2026-11-05/PUBLICARE.md). Copia privată înaintea intervenției este păstrată. Backupul automat are un eșec preexistent din lipsă de spațiu; această publicare nu îl remediază și nu certifică o nouă arhivă automată completă.

**Publicare precedentă, 29 septembrie 2026, 17:22 UTC:** release-ul `/var/www/Poetio/releases/20260929T171712Z-text-recovery` a publicat recuperarea transcrierilor și a comentariilor, cu migrarea `0016` aplicată și datele existente păstrate. Au trecut 87 de teste VPS, 16 scenarii izolate și verificările HTTPS/browser pe domeniul real. [Funcționalitate și limite](RECUPERARE-TEXTE.md), [dovezi de publicare](../publicare-recuperare-2026-09-29/PUBLICARE.md).

**Publicare precedentă, 28 septembrie 2026, 18:35 UTC:** release-ul activ este `/var/www/Poetio/releases/20260928T173015Z-media-translations`. Include corecțiile P1 pentru traduceri și media, previzualizarea, antetul compact, confortul poemelor și panoul de funcționare. Migrarea `0015`, FFmpeg/FFprobe și colectorul privat sunt instalate; backupul a fost verificat prin restaurare. [Dovezi de publicare](../publicare-media-traduceri-2026-09-28/PUBLICARE.md).

**Publicare precedentă, 27 septembrie 2026, 16:09 UTC:** release-ul activ este `/var/www/Poetio/releases/20260927T154916Z-reading-preferences`, prin `/var/www/Poetio/current`. Adaugă memorarea modului de lectură și fontului, cu resetare și tratarea stocării blocate. Nu necesită migrare SQL sau modificare Nginx. Compilarea deja verificată a fost publicată cu o copie independentă a dependențelor din release-ul precedent, după oprirea unei noi instalări `npm ci` din lipsă de memorie. [Dovezi și proveniență](../publicare-preferinte-lectura-2026-09-27/PUBLICARE.md).

**Publicare precedentă, 27 septembrie 2026, 15:24 UTC:** release-ul `/var/www/Poetio/releases/20260927T151750Z-collection-language` include colecția paginată cu căutare și filtre, metadatele cărților și regula comună de limbă URL → cookie → română. Migrarea aditivă `0014` este aplicată, iar verificatorul de backup a fost actualizat. Cele trei poeme și trei imagini au fost păstrate. [Dovezi de publicare](../publicare-2026-09-27/PUBLICARE.md).

**Publicare precedentă, 26 septembrie 2026:** domeniul indică serverul `3.66.232.196`. Release-ul `/var/www/Poetio/releases/20260926T182958Z-books-assets` rămâne disponibil pentru revenire; a introdus validarea integrală PDF, modul Text/OCR și recuperarea editorială a cărților. Baza restaurată atunci, cu acordul utilizatorului, provine din copia locală `vps/backup-before-audio-feb2ead`: trei poeme și trei imagini, fără cărți sau video. Au fost aplicate migrările până la `0013`. [Dovezile publicării precedente](../publicare-carti-2026-09-26/PUBLICARE.md).

Buildul VPS verifică manifestul final al resurselor. Referințele RSC rămase către module JavaScript eliminate de Vite pentru importuri exclusiv CSS sunt omise, păstrând foile de stil. Un fișier cerut de manifestul final Vite care lipsește sau o altă dependență absentă oprește compilarea. Verificarea din browser urmărește și răspunsurile HTTP ale resurselor.

Colecție publică: https://poetio.cloud/

Pagina publică „Autor”: https://poetio.cloud/autor. Fotografia și biografia completă „Despre Poetio” sunt prezentate aici, separat de colecție, în română și engleză. Meniul ambelor pagini oferă legăturile „Poemele”, „Autor” și „Administrare”.

Administrare: https://poetio.cloud/admin

HTTP și `www.poetio.cloud` redirecționează permanent către `https://poetio.cloud`, păstrând calea și parametrii. Adresa vechiului VPS, `159.69.200.202:8096`, nu face parte din instalarea actuală.

Aplicația rulează ca serviciu `poetio.service`, cu utilizatorul dedicat `poetio`, pe `127.0.0.1:4106`, folosind Node 24.21.0 din `/usr/local/bin/node`. Nginx furnizează HTTPS pe portul 443 pentru domeniu și validează parola pentru administrare și operațiile de scriere. Identitatea trimisă aplicației este generată numai după această validare. Headerul de identitate primit de la vizitatori este eliminat.

Meniul „Administrare” este vizibil și fără autentificare. Accesarea lui deschide solicitarea de utilizator și parolă a browserului, prin HTTPS. Contul administrativ configurat pe VPS este `admin`; parola se păstrează în `/etc/poetio/admin-credentials.txt`, disponibil numai administratorului serverului. Nginx folosește hashul parolei din `/etc/poetio/admin.htpasswd`. Aceste fișiere nu intră în Git sau în directorul public.

**Date și actualizări**

- Baza de date: `/var/lib/poetio/poetio.sqlite3`, SQLite cu WAL și chei externe activate.
- Imagini: `/var/lib/poetio/images/`; înregistrări audio: `/var/lib/poetio/audio/`. Fișierele sunt servite exclusiv prin API-ul aplicației.
- Compilare publicată: `/var/www/Poetio/current/dist`; fiecare release are propria copie de dependențe. În mod obișnuit se instalează prin `npm ci`; excepția verificată pentru release-ul preferințelor este descrisă mai sus.
- Configurație Nginx: `/etc/nginx/sites-available/poetio-cloud`, `/etc/nginx/conf.d/poetio-comments-rate.conf` și fișierele comune din `/etc/poetio/`. Zona `poetio_admin` este definită o singură dată, la începutul fișierului `poetio-cloud`.
- Configurație opțională de execuție: `/etc/poetio/runtime.env`.

`npm run build:vps` generează în `dist/` varianta pentru Node.js. După verificare, aceasta se copiază în directorul de publicare și se repornește `poetio.service`. Datele din `/var/lib/poetio` se păstrează la actualizare; exporturile inițiale nu se importă din nou peste datele active. Pentru backupul unei baze aflate în funcțiune se folosește mecanismul SQLite de backup, împreună cu o copie a directoarelor de imagini și audio; nu se copiază doar fișierul principal ignorând WAL.

Fișierele compilate trebuie să poată fi citite de serviciu: directorul publicat folosește proprietarul `root`, grupul `poetio`, permisiuni `0750` pentru directoare și `0640` pentru fișiere. Pentru datele modificabile, proprietarul este `poetio`, cu `0700` pentru directoare și `0600` pentru fișiere. Arhiva inițială include fișiere media cu permisiuni restrictive; copierea lor fără adaptarea permisiunilor poate împiedica pornirea serviciului.

`npm run build` păstrează compilarea originală pentru Sites. `POETIO_RUNTIME=node` selectează adaptorul SQLite/disc doar pentru compilarea VPS. Publicarea pe acest server nu modifică automat site-ul din Sites, iar cele două colecții evoluează independent după migrare.

**Domeniu și certificat HTTPS**

DNS: înregistrarea `A` pentru `poetio.cloud` indică `3.66.232.196`, iar `www` este un `CNAME` către `poetio.cloud`. Nu publica o înregistrare `AAAA` înainte de configurarea și verificarea accesului IPv6.

Certificatul Let's Encrypt pentru ambele nume este în `/etc/letsencrypt/live/poetio.cloud/`. Reînnoirea automată folosește `certbot.timer`, provocări HTTP în `/var/www/poetio-acme/.well-known/acme-challenge/` și hookul `/etc/poetio/renew-nginx.sh`, care verifică și reîncarcă Nginx după reînnoire. Portul 80 și ruta de validare trebuie să rămână accesibile public.

Fișierele din `deploy/` sunt șabloane. La instalarea actuală au fost adaptate astfel:

- `poetio-cloud.nginx.conf` → `/etc/nginx/sites-available/poetio-cloud` (activat prin legătură în `sites-enabled`), precedat de `limit_req_zone $binary_remote_addr zone=poetio_admin:10m rate=5r/s;`.
- `poetio.nginx.conf`, destinat vechiului IP, nu este instalat aici.
- `poetio-app.conf` → `/etc/poetio/app.conf`; `poetio-proxy.conf` → `/etc/poetio/proxy.conf`; `nginx-audio-location.conf` → `/etc/poetio/audio-location.conf`.
- `poetio.service` → `/etc/systemd/system/poetio.service`, cu `ExecStart=/usr/local/bin/node ...` și `VINEXT_TRUSTED_HOSTS=poetio.cloud`.
- `poetio-backup.service` include `Environment=PATH=/usr/local/bin:/usr/bin:/bin`, pentru verificarea restaurării cu aceeași versiune Node.
- `poetio-renew-nginx.sh` → `/etc/poetio/renew-nginx.sh`, proprietar `root`, permisiuni `0755`.

La instalarea pe un server nou, activează inițial numai primul bloc `server` din configurația domeniului (HTTP), creează directorul de validare cu acces de citire pentru Nginx și verifică ruta pe ambele nume. Emite apoi certificatul înainte de activarea blocurilor HTTPS:

```sh
certbot certonly --webroot -w /var/www/poetio-acme \
  --cert-name poetio.cloud -d poetio.cloud -d www.poetio.cloud \
  --non-interactive --deploy-hook /etc/poetio/renew-nginx.sh
```

Comanda reutilizează contul ACME existent pe VPS. La instalarea inițială a Certbot, înregistrează mai întâi un cont ACME. După instalarea tuturor fișierelor, verifică `nginx -t`, rulează `systemctl daemon-reload`, repornește `poetio.service` și reîncarcă Nginx. Blocul aplicației definește `$poetio_host` cu valoarea fixă `poetio.cloud`, protejând originea folosită la salvare și upload. `VINEXT_TRUSTED_HOSTS` acceptă `poetio.cloud`; varianta `www` redirecționează înainte de a ajunge la aplicație.

Verificarea reînnoirii:

```sh
systemctl is-enabled certbot.timer
certbot renew --cert-name poetio.cloud --dry-run --run-deploy-hooks
```

Publicarea domeniului din 13 septembrie 2026 a fost verificată cu certificate valide pentru ambele nume, redirecționări HTTP/`www`, navigare în browser pe desktop și mobil, autentificarea administrării, imaginile originale și redarea parțială a fișierelor audio. Cererile de salvare și upload cu origine corectă ajung la validarea datelor; originile externe sau falsificate sunt respinse. Aceste verificări nu creează poeme ori fișiere. Simularea reînnoirii certificatului, inclusiv hookul Nginx, a reușit. Accesul existent prin IP și celelalte site-uri HTTPS ale serverului au fost verificate separat.

Verificările din 13 septembrie de mai sus descriu vechiul VPS. Instalarea din 26 septembrie folosește exclusiv certificatul domeniului și `certbot.timer`; nu depinde de certificatul vechii adrese IP sau de `amanet-cert-renew.timer`.

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

**Comentariile cititorilor**

Fereastra fiecărui poem include un formular public cu nume (maximum 80 de caractere) și comentariu (maximum 2.000). Interfața urmează limba selectată, iar ambele versiuni ale poemului împart aceeași discuție. Comentariile se afișează de la cele mai recente, în pagini de 20, ca text simplu. Nu necesită cont și sunt publicate imediat. Nu există încă un flux de moderare în interfață.

`GET /api/poems/{id}/comments?offset=0` citește comentariile; `POST` acceptă `{ id, name, content }` cu UUID v4, JSON și origine identică site-ului. Retrimiterea aceluiași identificator și conținut nu creează dubluri. Comentariile sunt păstrate în tabela `poem_comments` din baza SQLite existentă și se șterg în cascadă odată cu poemul.

La publicare, după backup SQLite, rulează `node scripts/migrate-comments-vps.mjs /var/lib/poetio/poetio.sqlite3`. Migrarea aditivă `0004_reader_comments.sql` este inclusă și în istoricul Drizzle pentru Sites. Instalează `deploy/poetio-comments-rate.conf` la `/etc/nginx/conf.d/poetio-comments-rate.conf` și actualizează `/etc/poetio/app.conf` din `deploy/poetio-app.conf`. Excepția publică pentru comentarii trebuie să rămână înaintea expresiei regulate pentru API-ul protejat. Nginx permite șase trimiteri pe minut per IP, cu un mic burst, și răspunde cu 429 la depășire; citirea comentariilor nu consumă această limită. Limita corpului cererii este 16 KiB. Verifică `nginx -t`, publică varianta VPS și reîncarcă serviciile. Celelalte operații de administrare rămân autentificate.

Verificări pentru comentarii: `node --test tests/poems.test.mjs tests/vps-storage.test.mjs`, TypeScript și ESLint pentru modulele noi; verificare în browser pentru publicare anonimă, persistență, comutarea limbii, izolarea discuțiilor, HTML afișat ca text, reluare după răspuns pierdut și ecrane de 320–1440 px.

Publicarea comentariilor din 13 septembrie 2026 a fost verificată și prin HTTPS pe domeniu: trimitere fără autentificare, reîncărcare, acces mobil, respingerea originii externe și limitarea POST cu 429. Citirea funcționează și prin adresa IP existentă; administrarea și salvarea poemelor cer în continuare autentificare. Comentariul temporar de verificare a fost eliminat, iar toate înregistrările poemelor coincid cu backupul anterior publicării. Cele 27 de teste locale pentru persistență, acces și componente au trecut. ESLint trece pentru modulele noi; `showcase.tsx` păstrează avertizarea preexistentă de tip eroare privind legătura HTML către `/`.

**Comentarii la „Despre Poetio”**

Pagina `/autor` afișează sub biografie o discuție publică dedicată, comună versiunilor în română și engleză. Folosește formularul și validarea comentariilor poemelor, cu introducere adaptată paginii. Datele sunt păstrate în tabela separată `about_comments`; ștergerea unui poem nu afectează această discuție.

Înainte de publicare, creează un backup SQLite și rulează `node scripts/migrate-about-comments-vps.mjs /var/lib/poetio/poetio.sqlite3`. Scriptul aplică migrarea aditivă `0005_about_comments.sql` și poate fi rulat din nou. Publică compilarea VPS și actualizează `/etc/poetio/app.conf` din `deploy/poetio-app.conf`, apoi verifică `nginx -t`, repornește `poetio` și reîncarcă Nginx. Ruta `GET`/`POST /api/about/comments` are aceeași limită de corp și același buget de trimiteri per IP ca discuțiile poemelor; POST verifică originea, JSON și UUID pentru retrimitere fără dubluri.

**Colecția video**

Pagina publică `/video` este accesibilă din meniul „Video” al paginilor principale. Galeria păstrează stilul colecției de poeme; fiecare card deschide titlul, autorul, descrierea și un player video cu controale native. Redarea nu pornește automat și se oprește la închiderea ferestrei, la schimbarea videoului sau la părăsirea paginii. Interfața urmează limba română/engleză selectată; metadatele videourilor sunt afișate exact în limba în care au fost introduse.

`/admin/video` oferă lista de videouri și editorul cu titlu obligatoriu, autor și descriere opționale, alegere fișier, previzualizare, progres/anulare a încărcării, salvare, înlocuire și ștergere din colecție. Administrarea poemelor și administrarea video se leagă reciproc prin meniul Poeme/Video. Modificările nesalvate cer confirmare înainte de schimbarea selecției și la părăsirea paginii; erorile păstrează formularul și fișierul ales. Identificatorii de încărcare și salvare sunt reutilizați la reluare, iar reviziile resping modificările concurente.

Fișiere acceptate: MP4 și WebM, maximum 100 MiB. Se verifică tipul declarat și semnătura containerului. Nu se face transcodare; compatibilitatea codecului depinde de browser. Fișierul selectat devine public numai după salvarea înregistrării video. Fișierele înlocuite sau detașate prin ștergerea videoului rămân private, recuperabile pe disc; nu sunt eliminate fizic automat.

API-uri: `POST /api/video-files` încarcă fișierul; `GET/POST /api/videos` și `PUT/DELETE /api/videos/{id}` gestionează colecția și cer autentificarea proprietarului. Scrierile verifică originea. `GET/HEAD /api/video-files/{id}` servește numai fișiere atașate colecției pentru vizitatori, cu intervale de octeți, Content-Length, ETag și If-Range pentru redare/derulare. Administratorul poate previzualiza și fișiere neatașate.

Datele sunt păstrate în tabelele `videos` și `video_files`; pe VPS fișierele sunt în `/var/lib/poetio/videos/`, în afara directorului public. Adaptorul Sites folosește bucketul existent cu prefix `videos/`; publicarea și verificările acestei versiuni vizează VPS-ul Node.

Publicare după backup SQLite:

```sh
runuser -u poetio -- node scripts/migrate-video-vps.mjs /var/lib/poetio/poetio.sqlite3
install -d -o poetio -g poetio -m 0700 /var/lib/poetio/videos
install -m 0644 deploy/nginx-video-location.conf /etc/poetio/video-location.conf
install -m 0644 deploy/poetio-app.conf /etc/poetio/app.conf
nginx -t
```

Migrarea `0006_video_collection.sql` este aditivă și scriptul este repetabil. Configurația Nginx permite 101 MiB pe ruta exactă de upload, verifică parola și păstrează API-ul de metadate protejat. Publică `npm run build:vps` în directorul de execuție, repornește `poetio` și reîncarcă Nginx. Backupurile viitoare trebuie să includă și directorul `videos/`.


Verificări video: 31 de teste locale pentru colecție, validare, stocare și componente, TypeScript și ESLint pentru modulele noi/modificate ale funcției. În browser, un WebM real a fost încărcat, previzualizat, redat, modificat și șters; au fost verificate reluarea fără dubluri după răspuns pierdut, conflictele de revizie, blocarea accesului public înainte de publicare/după ștergere, intervalele de octeți, oprirea la schimbarea videoului (inclusiv două înregistrări cu același fișier), restaurarea focusului și dimensiuni de 320–1440 px. Interfețele română/engleză și temele zi/noapte au fost verificate.

Publicarea video din 13 septembrie 2026 a trecut verificarea HTTPS pe poetio.cloud cu autentificarea reală: acces Poeme → Video în administrare, upload/salvare/ștergere, redare publică pe mobil, HEAD și range inclusiv pe adresa IP, respingerea identității falsificate și a scrierilor cu origine externă. Videoul temporar și fișierul lui au fost eliminate; poemele, comentariile, imaginile și înregistrările audio au rămas identice cu backupul anterior publicării.

Cardurile galeriei Video afișează primul cadru al fișierului, fără sunet sau redare automată. Previzualizările sunt încărcate când se apropie de zona vizibilă, cu `preload=metadata` și poziționare la 0,001 secunde pentru compatibilitate cu browserele care nu afișează cadrul inițial imediat. Proporțiile originale sunt păstrate, inclusiv pentru video vertical. Dacă fișierul nu poate fi previzualizat, rămâne coperta Poetio cu butonul de redare. Nu se modifică fișierele sau schema bazei de date. Verificat în browser cu MP4-ul existent: cadru decodat, previzualizare oprită, deschiderea/redarea/închiderea playerului, desktop/mobil și fallback la fișier indisponibil; TypeScript și ESLint pentru componentele modificate trec.

### Comentarii la video

Migrarea `0007_video_comments.sql` adaugă comentarii legate de fiecare video, șterse automat odată cu videoul. Pe VPS se aplică înaintea noului build:

```sh
node scripts/migrate-video-comments-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Ruta publică `/api/videos/{id}/comments` acceptă citire și publicare, cu aceleași limite și verificări ca la poeme. Actualizează regula publică din `/etc/poetio/app.conf` conform `deploy/poetio-app.conf`, înaintea regulii de autentificare pentru API-urile de administrare; verifică `nginx -t` și reîncarcă Nginx. Formularul și totalul apar sub player, în fereastra videoului.

### Colecția de cărți

Meniul public Cărți (`/carti`) urmează după Video. Galeria are cinci coloane pe desktop, două sau una pe mobil. Fiecare carte are pagina `/carti/{id}`, cu copertă, titlu, autor, descriere și cititor de pagini rasterizate cu filigran. PDF-ul original este disponibil numai administratorului.

Administrarea `/admin/carti` permite adăugare, editare și ștergere, încărcare PDF de maximum 100 MiB și copertă JPEG/PNG/WebP de maximum 5 MiB. Coperta este opțională, cu înlocuitor tipografic. Încărcarea PDF are progres și anulare; încercările repetate păstrează identificatorul și nu dublează fișierele sau cărțile. Reviziile protejează editările concurente.

După backup SQLite, înaintea noului build:

```sh
runuser -u poetio -- node scripts/migrate-book-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Migrarea `0008_book_collection.sql` adaugă `book_files` și `books`. Stocarea Node folosește `/var/lib/poetio/books`, creată automat, iar Sites folosește `BOOK_BUCKET` sau `BUCKET`. Include acest director în backupuri. PDF-urile originale rămân private inclusiv după publicarea unei cărți. După eliminare, fișierul rămâne recuperabil de administrator. Coperta devine publică după asocierea la carte.

Instalează `deploy/nginx-book-location.conf` în `/etc/poetio/book-location.conf`, actualizează `/etc/poetio/app.conf` din configurația versionată și verifică `nginx -t`. `/api/book-files` acceptă corp de maximum 101 MiB cu autentificare, iar `/api/books` și `/admin/carti` rămân protejate. Ruta `/api/book-files/{id}` servește GET/HEAD și intervale de octeți, iar `?download=1` setează descărcarea PDF. Publică buildul VPS și reîncarcă serviciile.

Verificarea publicării: 29 de teste locale au trecut, plus TypeScript și ESLint pentru modulele noi. În browser, HTTPS a trecut încărcarea reală PDF/copertă, adăugare/editare/ștergere, acces public după salvare și privat după ștergere, citire pe pagina dedicată, intervale de octeți, descărcare, navigare, limba engleză și dimensiuni desktop/mobil. Cartea și fișierele temporare de test au fost eliminate.

### Cititor protejat pentru cărți

Pe VPS sunt necesare Poppler (`pdfinfo`, `pdftoppm`, pachetul Ubuntu `poppler-utils`), `prlimit` din `util-linux`, fontul DejaVu Sans și dependența npm `sharp`. `BOOK_RENDERER` este furnizat de adaptorul Node. Pe un alt runtime trebuie implementat același serviciu de rasterizare și verificare; în lipsa lui uploadul/publicarea cărților și cititorul răspund cu indisponibilitate, fără a expune PDF-ul ca alternativă. Procedura curentă este descrisă în [VALIDARE-PDF.md](VALIDARE-PDF.md).

Pe Ubuntu, instalează dependențele de sistem pe gazda care execută aplicația sau testele:

```sh
sudo apt-get update
sudo apt-get install -y --no-install-recommends poppler-utils util-linux fonts-dejavu-core fontconfig
prlimit --as=536870912 --cpu=20 -- pdfinfo -v
pdfinfo -v
pdftoppm -v
fc-match 'DejaVu Sans'
node --test tests/book-renderer.test.mjs tests/book-reading.test.mjs
```

`npm install` nu instalează aceste utilitare de sistem. `spawn pdfinfo ENOENT` sau `spawn pdftoppm ENOENT` indică lipsa executabilului din `PATH`; verifică disponibilitatea lor în mediul utilizatorului care rulează aplicația. Testul de randare folosește un PDF temporar și verifică generarea JPEG, cache-ul, limitele paginilor și respingerea căilor nevalide. `npm run test:vps` include și aceste teste.

`/api/book-files/{id}` permite numai administratorului GET/HEAD, intervale și descărcare. Accesul public primește 404 chiar dacă fișierul este asociat unei cărți. Paginile publice folosesc `/api/book-pages/{fileId}` pentru numărul paginilor și `/api/book-pages/{fileId}/{page}` pentru imagini JPEG. Fiecare cerere verifică asocierea la o carte publicată; cache-ul nu permite accesul la o carte eliminată. Nu există rută pentru imagini fără filigran.

Paginile sunt generate la cerere (maximum 1800 px pe latura lungă), cu filigranul „Poetio — doar pentru lectură” aplicat în pixeli. Cache-ul regenerabil se află în `/var/lib/poetio/book-pages/v1/{fileId}/{hash}/`. Procesele de rasterizare au timp limitat, maximum două conversii simultane și coadă limitată. Cache-ul folosește hashul fișierului, astfel că înlocuirea PDF-ului nu afișează paginile vechi.

Cititorul permite navigare, salt la pagină și mărire. Nu oferă descărcare sau imprimare; administratorul păstrează previzualizarea și accesul la original. Conținutul vizibil poate fi fotografiat sau capturat, iar imaginile pot fi salvate; aceasta este protecție împotriva livrării PDF-ului original, nu DRM absolut. Arhivele de backup create anterior rămân copii ale versiunii de la export.

Verificarea cititorului protejat: 23 de teste locale au trecut, inclusiv prezența filigranului în pixeli, cache persistent și refuzul PDF-ului original pentru vizitatori. Pe HTTPS, cartea existentă de 183 de pagini a trecut navigarea început/următoare/final, mărirea și afișarea mobilă. GET/HEAD, `?download=1`, Range și identitatea falsificată nu livrează originalul public; administratorul păstrează accesul. Pagina publică nu face cereri către ruta PDF.

### Eliminarea filigranului

La cererea proprietarului, paginile sunt afișate fără filigran. Cache-ul activ este `book-pages/v2/{fileId}/{hash}/`; imaginile vechi din `v1` nu mai sunt servite. Regenerarea se face automat la citire pentru toate cărțile, inclusiv cele viitoare. PDF-urile originale rămân accesibile numai administratorului. Navigarea și mărirea rămân disponibile.

### Verificarea PDF-urilor înaintea publicării — 26 septembrie 2026

Corecția din surse folosește acum `book-pages/v3/{fileId}/{hash}/`, tot fără filigran. Documentele trunchiate sau protejate sunt respinse înaintea persistării uploadului; toate paginile trebuie randate cu succes înainte de publicare sau înlocuire. Editorul afișează progresul, iar serverul impune aceeași condiție pentru cereri API directe și fișiere vechi. Nu este necesară migrare SQL. Actualizează și `/etc/poetio/app.conf` pentru protejarea rutei `POST /api/book-files/{id}/validation`. Detaliile, limitele și comportamentul după repornire sunt în [VALIDARE-PDF.md](VALIDARE-PDF.md). Această modificare nu a fost publicată pe serverul extern.

### Comentarii la cărți

Comentariile apar sub cititorul fiecărei cărți, iar cardurile galeriei afișează numărul total. Formularul comun folosește limitele și regulile existente: nume 80 caractere, comentariu 2000, paginare de câte 20, aceeași origine pentru publicare și identificatori de retrimitere fără duplicate. Comentariile se șterg automat odată cu cartea și rămân separate de cele pentru poeme, video și Despre Poetio.

După backup SQLite, aplică înainte de publicare:

```sh
runuser -u poetio -- node scripts/migrate-book-comments-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Migrarea `0009_book_comments.sql` adaugă tabela și indexul comentariilor. Actualizează regula publică din `/etc/poetio/app.conf` conform `deploy/poetio-app.conf` pentru `/api/books/{id}/comments`, înaintea API-ului de administrare protejat. Sunt păstrate limita de corp 16 KiB și limitarea frecvenței de publicare. Verifică `nginx -t`, publică buildul VPS și reîncarcă serviciile. Protecția PDF-ului original și cititorul cu două pagini rămân active.


### Actualizarea de securitate din 14 septembrie 2026

Serviciul activ folosește acum `/var/www/Poetio/current`, o legătură către o versiune din `releases/` cu propriul build și propriile dependențe. Publicările viitoare trebuie pregătite și testate într-un director nou; copierea exclusivă în `vps/dist` nu mai actualizează serviciul activ. `npm run build:vps` verifică automat și copia RSC inclusă în plugin.

Detalii și revenire: [ACTUALIZARE-SECURITATE-2026-09-14.md](ACTUALIZARE-SECURITATE-2026-09-14.md). Backupul zilnic criptat, verificat prin restaurare și pornire locală, este documentat în [BACKUP-VPS.md](BACKUP-VPS.md).

### Pagini individuale și recuperare editorială

Poemele și video au pagini publice individuale, metadate pentru distribuire și intrări în sitemap. Administrarea include salvare automată locală, schițe private salvate explicit pe server și istoric recuperabil. Aplică migrarea aditivă `0011_editorial_recovery.sql` înaintea release-ului. Utilizare, verificări și revenire: [PAGINI-SCHITE-ISTORIC.md](PAGINI-SCHITE-ISTORIC.md).

### Verificarea stării producției fără modificări

Execută aceste comenzi prin SSH pe serverul care găzduiește producția. Prezența surselor și a legăturii `current` într-un mediu de dezvoltare nu confirmă serviciile sau datele active. `LoadState=not-found` în acel mediu descrie numai gazda verificată.

```sh
hostname
date -u
readlink -f /var/www/Poetio/current
systemctl show poetio.service nginx.service \
  -p Id -p LoadState -p ActiveState -p SubState -p WorkingDirectory
systemctl show poetio-backup.timer \
  -p LoadState -p ActiveState -p LastTriggerUSec -p NextElapseUSecRealtime
systemctl show poetio-backup.service \
  -p LoadState -p Result -p ExecMainStatus -p ExecMainExitTimestamp
sudo stat /var/lib/poetio/poetio.sqlite3 /var/backups/poetio/automatic
sudo cat /var/backups/poetio/automatic/last-success.json
sudo nginx -t
```

Pentru backup, verifică data UTC a ultimei reușite și existența arhivei numite în `last-success.json`. Markerul consemnează verificarea de restaurare făcută la crearea acelei copii; o nouă restaurare de probă urmează procedura din [BACKUP-VPS.md](BACKUP-VPS.md). Un serviciu de backup `oneshot` poate fi `inactive` după o execuție reușită: evaluează rezultatul ultimei rulări și starea timerului.

Verifică răspunsurile Nginx local pe server, cu numele domeniului și validarea certificatului HTTPS:

```sh
for path in / /admin /api/admin/comments; do
  curl --noproxy '*' --connect-timeout 5 --max-time 15 \
    --resolve poetio.cloud:443:127.0.0.1 \
    -sS -D - -o /dev/null "https://poetio.cloud${path}"
done
```

Colecția trebuie să răspundă `200`, iar cele două rute protejate, fără credențiale, `401` cu `WWW-Authenticate: Basic`. Aceste probe confirmă refuzul accesului anonim; autentificarea reușită necesită separat credențiale valide. Fișierele `runtime.env`, `admin-credentials.txt`, `admin.htpasswd` și `backup.key` nu sunt necesare în raportul de diagnostic.

## Lectură în mod Text — 26 septembrie 2026

Cititorul include text selectabil, căutare și mărirea literelor, cu extragere PDF și OCR local român/englez. Administrarea permite verificarea și corectarea transcrierilor. Înaintea activării sunt necesare `pdftotext` (poppler-utils), `tesseract-ocr`, `tesseract-ocr-ron`, `tesseract-ocr-eng` și migrarea `0012_book_page_texts.sql`, aplicată după backup cu `node scripts/migrate-book-text-vps.mjs /var/lib/poetio/poetio.sqlite3`. Ruta de corecturi folosește protecția existentă `/api/admin/`. Datele corectate intră în backupul SQLite; cache-ul extras/OCR se poate regenera. Detalii și limite: [LECTURA-TEXT.md](LECTURA-TEXT.md).

## Recuperarea editorială a cărților — 26 septembrie 2026

După backup, aplică `node scripts/migrate-book-editorial-vps.mjs /var/lib/poetio/poetio.sqlite3` (migrarea `0013`, după infrastructura editorială `0011`). Aceasta capturează cărțile existente și instalează triggerele pentru istoric tranzacțional. Nu modifică datele cărților. Editorul adaugă schițe locale și private pe server, recuperabile fără publicare automată. Nu sunt necesare reguli Nginx noi: se folosesc rutele protejate `/api/admin/recovery/book/`. Procedură și limite: [RECUPERARE-CARTI.md](RECUPERARE-CARTI.md).

## Panoul de funcționare

Schimbarea editor/lectură include un colector separat de stare a backupului. Instalează serviciul și temporizatorul conform [EDITOR-LECTURA-FUNCTIONARE.md](EDITOR-LECTURA-FUNCTIONARE.md#instalarea-rezumatului-la-deploy-vps) la publicarea release-ului. Fără colector, panoul indică explicit o stare necunoscută; nu lărgi permisiunile aplicației asupra backupurilor sau cheilor.

## Asocierea traducerilor — 28 septembrie 2026

Înaintea publicării corecției P1, după backup, aplică din noul release `node scripts/migrate-translation-provenance-vps.mjs /var/lib/poetio/poetio.sqlite3`, cu utilizatorul aplicației. Migrarea aditivă `0015` păstrează conținutul și istoricul existent și adaugă proveniența în versiunile salvate ulterior. Apoi promovează buildul verificat. Detalii, comportamentul traducerilor vechi și limitele revenirii: [TRADUCERI-VERIFICATE.md](TRADUCERI-VERIFICATE.md). Migrarea a fost aplicată producției la publicarea din 28 septembrie.

## Verificarea audio/video — 28 septembrie 2026

Corecția P1 necesită `ffmpeg`, `ffprobe` și `prlimit` pe gazda VPS, accesibile utilizatorului aplicației. Fără ele, încărcarea și publicarea media sunt refuzate; nu se acceptă fișiere neverificate. Nu există migrare SQL nouă pentru media. Instalează împreună `deploy/poetio-proxy.conf`, `deploy/poetio-app.conf`, `deploy/nginx-audio-location.conf` și `deploy/nginx-video-location.conf`: timeoutul comun se mută la nivel de server, iar verificarea media primește 300 s. Verifică `nginx -t` înainte de reîncărcare. [Procedură, limite și dovezi](VALIDARE-AUDIO-VIDEO.md). Corecția este activă pe VPS din 28 septembrie.

## Schițe și istoric pentru transcrieri; schițe de comentarii

Înaintea publicării acestei corecții, după backup, rulează din release-ul pregătit `node scripts/migrate-book-text-recovery-vps.mjs /var/lib/poetio/poetio.sqlite3`, cu utilizatorul aplicației. Migrarea `0016` adaugă indexul schițelor pe entitate și istoricul tranzacțional al textelor, fără modificarea corecturilor existente. Ruta nouă intră sub protecția Nginx existentă `/api/admin/`; nu se schimbă dependențele de sistem. Schițele comentariilor sunt numai în sesiunea browserului. [Comportament, verificări și limite](RECUPERARE-TEXTE.md).
