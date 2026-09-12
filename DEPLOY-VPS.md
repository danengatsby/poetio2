# Poetio pe serverul 159.69.200.202

Colecție publică: https://159.69.200.202:8096/

Administrare: https://159.69.200.202:8096/admin

Aplicația rulează ca serviciu `poetio.service`, cu utilizatorul dedicat `poetio`, pe `127.0.0.1:4106`. Nginx furnizează HTTPS pe portul 8096 și validează parola pentru administrare și operațiile de scriere. Identitatea trimisă aplicației este generată numai după această validare. Headerul de identitate primit de la vizitatori este eliminat.

Datele de acces se păstrează în `/etc/poetio/admin-credentials.txt`, disponibil numai administratorului serverului. Nginx folosește hashul parolei din `/etc/poetio/admin.htpasswd`. Aceste fișiere nu intră în Git sau în directorul public.

**Date și actualizări**

- Baza de date: `/var/lib/poetio/poetio.sqlite3`, SQLite cu WAL și chei externe activate.
- Imagini: `/var/lib/poetio/images/`; fișierele sunt servite exclusiv prin API-ul aplicației.
- Compilare publicată: `/var/www/Poetio/vps/dist`.
- Configurație Nginx: `/etc/nginx/sites-available/poetio-vps` și `/etc/poetio/proxy.conf`.
- Configurație opțională de execuție: `/etc/poetio/runtime.env`.

`npm run build:vps` generează în `dist/` varianta pentru Node.js. După verificare, aceasta se copiază în directorul de publicare și se repornește `poetio.service`. Datele din `/var/lib/poetio` se păstrează la actualizare; exporturile inițiale nu se importă din nou peste datele active. Pentru backupul unei baze aflate în funcțiune se folosește mecanismul SQLite de backup, împreună cu o copie a directorului de imagini; nu se copiază doar fișierul principal ignorând WAL.

Fișierele compilate trebuie să poată fi citite de serviciu: directorul publicat folosește proprietarul `root`, grupul `poetio`, permisiuni `0750` pentru directoare și `0640` pentru fișiere. Pentru datele modificabile, proprietarul este `poetio`, cu `0700` pentru directoare și `0600` pentru fișiere. Arhiva inițială include fișiere media cu permisiuni restrictive; copierea lor fără adaptarea permisiunilor poate împiedica pornirea serviciului.

`npm run build` păstrează compilarea originală pentru Sites. `POETIO_RUNTIME=node` selectează adaptorul SQLite/disc doar pentru compilarea VPS. Publicarea pe acest server nu modifică automat site-ul din Sites, iar cele două colecții evoluează independent după migrare.

Certificatul HTTPS existent pentru adresa IP este reutilizat. Reînnoirea lui este gestionată de `amanet-cert-renew.timer`; hookul de reînnoire verifică și reîncarcă Nginx. Nu elimina această dependență fără a configura o reînnoire alternativă pentru Poetio.

Traducerile deja salvate funcționează fără cheie API. Traducerea automată necesită configurarea separată a secretului `OPENAI_API_KEY` în `/etc/poetio/runtime.env` și repornirea serviciului. Fără acest secret, editorul permite salvarea originalului și completarea manuală a traducerii.

Playerul din fereastra poemului folosește Web Speech API și vocile oferite de browserul vizitatorului. Nu necesită credit OpenAI. Vocea trebuie să fie disponibilă pentru limba versiunii afișate; în caz contrar, playerul afișează instrucțiuni și dezactivează redarea. Recitarea pornește numai la apăsarea butonului și se oprește la închiderea ferestrei, schimbarea poemului sau a limbii. Continuarea după pauză reia fragmentul întrerupt. Testele pentru ordinea fragmentelor, vocile potrivite și anularea recitării se rulează cu `node --test tests/poem-recitation.test.mjs`; calitatea vocii se verifică pe un dispozitiv cu vocea respectivă instalată.

**Verificare și diagnostic**

```sh
npm run test:vps
systemctl status poetio --no-pager
journalctl -u poetio -n 50 --no-pager
nginx -t
```

Testele verifică persistența SQLite, rollbackul tranzacțiilor, compatibilitatea rezultatelor cu React Server Components și integritatea stocării imaginilor. Verificarea HTTP a publicării include colecția, ambele imagini, autentificarea, respingerea identităților falsificate și operațiile de salvare.

Publicarea din 10 septembrie 2026 a fost verificată prin HTTPS cu certificatul valid: navigare anonimă și autentificată, încărcarea unei imagini cu previzualizare privată, salvare bilingvă, editare, conflicte de revizie, ștergere și persistența datelor după repornirea serviciului. Datele temporare de test au fost eliminate. Cele două poeme și cele două imagini curente coincid cu sursa importată din Sites. Suita completă `npm test` trece toate cele 21 de teste; TypeScript și verificarea ESLint pentru fișierele noi/modificate ale adaptării VPS trec.
