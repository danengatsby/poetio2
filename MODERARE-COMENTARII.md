# Moderarea comentariilor

Administrare: https://poetio.cloud/admin/comentarii (aceeași autentificare ca pentru colecție).

Comentariile noi pentru poeme, video, cărți și pagina „Despre Poetio” sunt salvate în starea `pending`. Formularul confirmă primirea, fără să le adauge în lista publică. Numărătorile și listele publice includ exclusiv `approved`.

Pagina de administrare oferă filtre pe categorie și stare, paginare de 20 de comentarii, aprobarea individuală, ascunderea reversibilă și ștergerea definitivă cu confirmare. Ștergerea unui comentariu păstrează poemul, videoul sau cartea. Comentariile deja existente rămân publicate după migrare și pot fi moderate ulterior.

API-ul `/api/admin/comments` este protejat în Nginx și verifică identitatea proprietarului în aplicație. Modificările verifică originea cererii, formatul JSON și revizia comentariului; o decizie nouă nu poate fi suprascrisă dintr-o filă veche. Retrimiterea comentariului original nu anulează moderarea. Nu sunt trimise notificări externe.

## Migrare VPS

1. Construiește versiunea nouă într-un director separat cu `npm run build:vps` și testeaz-o pe o copie a datelor.
2. Oprește serviciul `poetio`, salvează o copie SQLite consistentă și aplică:

   ```sh
   node scripts/migrate-comment-moderation-vps.mjs /var/lib/poetio/poetio.sqlite3
   ```

3. Activează versiunea nouă prin legătura `/var/www/Poetio/current`, apoi pornește serviciul. Configurația Nginx trebuie să includă protecția `/api/admin` din `deploy/poetio-app.conf`.

Migrarea este tranzacțională. La prima aplicare păstrează comentariile existente ca `approved`; o a doua execuție nu modifică stările. Coloanele noi au implicit `pending`.

**Revenire:** nu activa direct o versiune veche după migrare: vechile interogări nu filtrează starea și ar afișa comentarii ascunse sau neaprobate. Folosește o versiune corectată care păstrează filtrarea. Restaurarea bazei anterioare necesită oprirea serviciului și reconcilierea tuturor datelor primite ulterior copiei.

## Verificare

- `npm run test:vps`: 37 de teste, inclusiv toate cele patru fluxuri de moderare, numărători, paginare, concurență, retrimiteri și migrare repetată.
- TypeScript și ESLint pentru modulele noi/modificate de moderare.
- Build de producție cu verificarea versiunilor React/RSC.
- Verificări HTTP pe o copie izolată: autentificare, origine, dimensiune/format, aprobare, ascundere, retrimitere și conflicte de revizie.
- Browser: aprobare, ascundere, anularea/confirmarea ștergerii, filtre, formular public, afișarea textului HTML fără executare și lățimi de 320, 390 și 1440 px.
- Backupul local automat include baza SQLite cu toate stările, fișierele media și versiunea aplicației. Arhivele sunt verificate prin restaurare izolată.
