# Verificarea PDF-urilor înaintea publicării

Uploadul și publicarea sunt etape separate. Un fișier încărcat rămâne privat până când toate paginile lui au fost verificate și cererea de publicare reușește.

## Traseul unui document

1. `POST /api/book-files` verifică formatul și limita de 100 MiB. Adaptorul VPS scrie temporar PDF-ul într-un director privat, verifică finalul documentului, îl analizează cu `pdfinfo`, refuză criptarea/parola și randează prima pagină folosind același proces ca cititorul public. Directorul temporar se elimină la încheierea operației. Documentele care eșuează aici primesc 422 și nu intră în bucket sau în `book_files`.
2. După un upload reușit, editorul apelează `POST /api/book-files/{id}/validation`, cu autentificare, aceeași origine și corp JSON. Răspunsul conține `checking`, `ready` sau `error`, numărul de pagini și progresul. Serverul verifică SHA-256 și dimensiunea originalului, apoi randează toate paginile în fundal. PDF-urile a căror corupere apare după prima pagină rămân private, cu rezultat `error`.
3. Editorul afișează progresul, păstrează formularul la eroare și publică numai după `ready`. Anularea așteptării nu publică; verificarea începută poate continua pe server. O nouă salvare reutilizează fișierul încărcat și rezultatul verificării.
4. `POST /api/books` și `PUT /api/books/{id}` impun independent aceeași condiție, inclusiv pentru cereri directe și fișiere vechi. `checking` produce 409, un document respins produce 422, iar lipsa verificatorului produce 503. O înlocuire refuzată păstrează versiunea existentă a cărții.

Un 201 de la upload confirmă doar încărcarea privată și verificarea inițială. Numai un 201/200 de la API-ul cărților confirmă publicarea. Prima pagină singură nu este suficientă pentru această decizie.

## Runtime și persistență

Implementarea este pentru procesul Node de lungă durată al VPS-ului, prin `BOOK_RENDERER`. Worker-ul Cloudflare actual nu are un verificator PDF: uploadul și publicarea cărților sunt refuzate cu 503, fără a accepta implicit fișiere neverificate. Pentru activarea lor pe acel runtime trebuie furnizate atât verificarea, cât și randarea compatibilă.

Rezultatele sunt scrise atomic în `POETIO_DATA_DIR/book-pages/v3/{fileId}/{hash}/validation.json`. Marcajul include versiunea politicii, hashul, dimensiunea, caracteristicile fișierului local și rezultatul. Cache-ul vechi `v2` nu reprezintă dovadă de verificare. Imaginile noi rămân fără filigran.

După o repornire, `ready` și erorile finalizate sunt reutilizate dacă originalul nu s-a schimbat. O verificare întreruptă este reluată la următoarea cerere administrativă; paginile deja randate în `v3` pot fi reutilizate. Erorile temporare de serviciu pot fi reîncercate prin `{"retry":true}`, folosit la o nouă încercare de salvare. Un PDF invalid sau prea complex trebuie înlocuit. Terminarea verificării nu publică automat o carte.

Nu există o migrare SQL pentru această corecție. Fișierele vechi sunt verificate înaintea următoarei publicări sau editări. Cărțile deja publicate nu sunt retrase automat și nu au fost auditate în producție prin această modificare. După restaurarea unui backup, cache-ul poate fi reconstruit din originalele private.

## Limitele procesării

- Maximum 2.000 de pagini și 100 MiB per PDF.
- Cel mult două documente în verificare completă simultan; celelalte așteaptă prin cererile periodice din editor, fără o coadă nelimitată în memorie.
- Maximum două conversii Poppler simultane, coadă de cel mult 16 conversii și maximum 15 secunde de așteptare pentru un loc.
- Fiecare proces Poppler are plafon de 512 MiB pentru spațiul de adrese și 20 de secunde CPU prin `prlimit`; timpul de execuție este limitat la 20 de secunde pentru analiză și 30 de secunde pentru randarea unei pagini.
- Randare la cel mult 1.800 px pe latura lungă, cu output capturat de maximum 20 MiB per pagină.
- Verificarea completă are un buget de 10 minute, verificat între operații, și maximum 512 MiB de imagini generate per document. Operația aflată în curs rămâne limitată separat.

Aceste praguri pot refuza documente valide, dar prea complexe pentru acest serviciu. Mesajul cere simplificarea sau împărțirea cărții. Avertismentele Poppler despre sintaxa deteriorată sunt tratate ca eșec, chiar dacă procesul a încercat repararea documentului și a ieșit cu succes.

## Instalare și verificare

Gazda VPS are nevoie de `poppler-utils`, `util-linux` (`prlimit`), `fonts-dejavu-core`, `fontconfig` și dependența npm `sharp`. După copierea configurațiilor, `deploy/poetio-app.conf` trebuie instalat în `/etc/poetio/app.conf`; acesta protejează și noua rută de verificare cu autentificarea administrativă. Verifică `nginx -t` înaintea reîncărcării. Configurațiile versionate nu sunt instalate automat.

```sh
command -v prlimit pdfinfo pdftoppm
prlimit --as=536870912 --cpu=20 -- pdfinfo -v
npm run test:vps
```

Testele includ PDF valid, semnătură de opt octeți, final trunchiat, parolă, prea multe pagini, coruperea exclusiv a paginii a doua, restaurarea stării după repornire, modificarea originalului, indisponibilitate urmată de reîncercare și refuzul publicării/înlocuirii fără verificare completă. Fișierele și bazele utilizate de teste sunt temporare.

## Rezultatele verificării locale — 26 septembrie 2026

Într-o copie izolată a surselor curente au trecut ESLint fără avertismente, TypeScript, compilările Cloudflare/VPS și toate cele 59 de teste Node, inclusiv integrarea Worker. Au trecut și cele patru teste Python de backup. Copia a reutilizat dependențele locale; nu s-a rerulat instalarea prin `npm ci`.

Pe buildul VPS izolat, zece scenarii HTTP/Chromium au confirmat mesajele și păstrarea formularului pentru PDF invalid/trunchiat/parolat, blocarea unui document cu pagina a doua coruptă, anularea fără publicare, reîncercarea fără reupload/duplicare, editarea unei cărți verificate și lectura publică a ambelor pagini pe mobil. Ruta de verificare a trecut separat prin Nginx local: 401 pentru anonim și identitate falsificată, 200 pentru administrator și 403 pentru origine străină. Nu s-au capturat erori JavaScript de pagină în scenariile browserului.

Verificările folosesc documente demonstrative, baze temporare și configurații Nginx izolate. Nu s-a făcut publicarea modificării și nu s-au verificat cărțile sau serviciile serverului extern. Dovezile locale sunt în directorul părinte `verificare-pdf-2026-09-26`.
