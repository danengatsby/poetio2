# Recuperarea transcrierilor și comentariilor — 29 septembrie 2026

**Publicat pe https://poetio.cloud la 29 septembrie 2026, 17:22 UTC**, în release-ul `20260929T171712Z-text-recovery`, cu migrarea `0016` aplicată. Corectează transcrierea modificată fără salvare și comentariul pierdut la schimbarea limbii pe poem/video. Datele existente au fost păstrate. [Raportul publicării](../publicare-recuperare-2026-09-29/PUBLICARE.md).

## Transcrieri

Editorul păstrează automat corectura în `localStorage`, asociată PDF-ului și paginii. Fiecare sesiune de editare are o cheie distinctă, astfel încât două file nu suprascriu aceeași schiță locală. Valorile recuperate sunt validate. „Recuperează transcrieri” arată schițele locale ale tuturor paginilor PDF-ului curent; o schiță de la pagina 2 poate fi găsită și încărcată când editorul este la pagina 1.

„Salvează schița transcrierii pe server” păstrează o versiune privată, fără să schimbe textul public. Această salvare este explicită. Schițele private și istoricul sunt paginate separat pentru fiecare PDF/pagină, câte 20 de intrări. O schiță poate fi ștearsă explicit; istoricul nu are operație de ștergere în interfață.

Comparația afișează textul ales și textul din editor. „Încarcă transcrierea în editor, fără publicare” citește revizia curentă, păstrează textul recuperat și cere din nou verificarea față de original. Salvarea publică rămâne un pas separat. Dacă altă sesiune salvează între timp, API-ul răspunde `409`; corectura din editor și schița locală rămân disponibile.

Migrarea `0016_book_text_recovery.sql` folosește infrastructura existentă `content_drafts` / `content_history`, cu tipul `book-text` și identitatea `file_id:page`. Cele trei triggere înregistrează salvările și ștergerile textului în aceeași tranzacție. Migrarea capturează o singură dată versiunea existentă la activare; nu poate reconstrui corecturi suprascrise înaintea activării. O eroare la scrierea istoricului anulează și schimbarea textului. Reîncercarea aceleiași salvări confirmate nu dublează istoricul.

Schimbarea PDF-ului nu mută schițele sau istoricul pe documentul nou. Pentru recuperarea documentului anterior trebuie să fie disponibil fișierul original, conform mecanismului existent de recuperare a cărților. Schițele locale mai vechi se păstrează până la ștergerea explicită; copia locală creată de sesiunea curentă este eliminată după salvarea publică reușită. Ștergerea datelor browserului elimină copiile locale. Dacă stocarea este refuzată sau plină, mesajul cere salvarea privată pe server; avertizarea de părăsire a editorului rămâne activă.

Ruta nouă `/api/admin/book-text/{fileId}/{page}/recovery` cere administrator, verifică proprietarul fișierului și limitează accesul la PDF/pagină. GET listează sau citește o versiune; POST salvează privat; DELETE elimină o schiță. Mutațiile verifică originea cererii, iar toate răspunsurile folosesc `private, no-store`. Cititorul public continuă să primească doar textul publicat.

## Comentarii

Numele, textul și identificatorul încercării de trimitere sunt păstrate în `sessionStorage`, sub o cheie derivată din tipul materialului și ID. Limba interfeței nu intră în cheie. RO → EN → RO, reîncărcarea și revenirea la același material în aceeași filă păstrează schița. Un poem și un video cu același ID au schițe distincte. Componenta comună oferă aceeași protecție și comentariilor cărților/autorului.

Schițele sunt limitate la sesiunea filei, maximum 24 de ore de la ultima editare/încercare de trimitere și cel mult 40 de materiale. La citire/salvare se curăță intrările expirate sau excedentare. Numele are limita de 80 de caractere, iar corpul 2.000. Datele corupte sunt ignorate. „Abandonează schița” elimină numele și textul cu confirmare.

Schița este eliminată numai după un răspuns reușit care confirmă primirea comentariului. O eroare HTTP, o conexiune întreruptă sau un răspuns fără confirmare păstrează textul. Dacă serverul a primit comentariul, dar răspunsul s-a pierdut, reîncercarea după reîncărcare folosește același ID și nu dublează înregistrarea. Moderarea rămâne neschimbată: primirea nu înseamnă afișare publică imediată.

Dacă browserul refuză stocarea, formularul rămâne editabil, explică necesitatea copierii textului și cere avertizarea nativă înaintea navigării la alt document. Anularea navigării păstrează formularul. Acceptarea plecării în această situație poate pierde textul; aplicația nu declară că l-a salvat. Comentariile netrimise nu sunt trimise pe server și nu primesc un istoric public sau editorial.

## Publicare

Pe VPS, după backup, din release-ul pregătit și cu utilizatorul aplicației:

```sh
node scripts/migrate-book-text-recovery-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Scriptul rulează tranzacțional, poate fi repetat și refuză o schemă parțială sau diferită. Nu schimbă textele, reviziile ori istoricul existent. Nu sunt necesare dependențe de sistem sau reguli Nginx suplimentare; protecția `/api/admin/` există deja. Schițele private și istoricul intră în backupul bazei prin infrastructura existentă. Datele din browser nu intră în backupul serverului.

Pe Worker se aplică aceeași migrare prin fluxul D1. Salvarea schițelor noi verifică existența paginii prin verificatorul PDF; în lipsa lui este refuzată cu `503`. Versiunile deja salvate pot fi citite privat. Revenirea la codul anterior nu cere ștergerea datelor noi; ar elimina însă interfața de recuperare.

## Verificări

- **87/87 teste VPS**: istoric tranzacțional, migrare repetabilă, refuzul schemelor parțiale, conflicte de revizie, retry fără dublare, schițe private, izolare PDF/pagină, paginare, expirare și validarea schițelor din browser.
- **16 scenarii HTTP/Chromium**, pe baze și fișiere temporare: schimbarea limbii, recuperarea după reîncărcare, răspuns pierdut, abandonare, expirare, stocare refuzată, pagini/PDF-uri diferite, comparație și restaurare fără publicare, revizii concurente, autorizare și ștergere privată. Fără erori JavaScript în rularea finală.
- **1/1 test de integrare Worker**, inclusiv protecția noilor rute, istoricul păstrat în D1 și refuzul accesului la versiunea altei pagini.
- TypeScript și ESLint pe copia izolată a aplicației, fără diagnostice; buildurile VPS și Worker reușite. Copia izolată exclude directoarele vechi de reproducere din `work`, care au propriile surse și dependențe.

[Probe de browser](/var/www/Poetio/verificare-recuperare-2026-09-28/rezultate.json), [script de reproducere](/var/www/Poetio/verificare-recuperare-2026-09-28/verifica.mjs), [captură](/var/www/Poetio/verificare-recuperare-2026-09-28/transcriere-recuperata.png), [amprentele surselor](/var/www/Poetio/verificare-recuperare-2026-09-28/surse.json). Probele au început la 28 septembrie și au fost încheiate la 29 septembrie; nu reprezintă teste Safari/Firefox sau un audit WCAG complet.
