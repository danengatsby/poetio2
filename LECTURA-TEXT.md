# Textul cărților, OCR și corecturi

Cititorul oferă „Pagina originală” și „Text”. Modul Text păstrează navigarea și poziția lecturii, afișează conținut HTML selectabil și permite mărirea literelor de la 100% la 250%, independent de imagine. Căutarea parcurge paginile cărții, afișează progresul și trimite la pagina găsită. Poate fi oprită; erorile și oprirea sunt raportate ca rezultate incomplete. Sunt afișate cel mult 100 de pagini găsite. Căutarea ignoră diferențele dintre majuscule și minuscule, dar păstrează diacriticele.

**Actualizare publicată, 27 septembrie:** modul de lectură și dimensiunea fontului sunt memorate pentru cărțile din același browser, cu validare și resetare fără ștergerea paginilor memorate. Controalele rămân utilizabile dacă stocarea este refuzată. [Preferințe, limite și verificări](PREFERINTE-LECTURA.md).

Serverul extrage fiecare pagină cu `pdftotext`, în ordinea de lectură estimată de Poppler. Dacă nu găsește litere sau cifre, recunoaște imaginea cu Tesseract, folosind modelele român și englez. O pagină mixtă cu text selectabil și imagini necesită uneori OCR inițiat explicit în administrare. Nu se expediază documente către un serviciu extern. Originalul PDF rămâne privat; textul devine accesibil numai pentru fișierele legate de o carte publicată sau pentru administratorul autentificat.

Textul automat este întotdeauna marcat drept **neverificat**. Extragerea nu garantează ordinea coloanelor, păstrarea versurilor sau descrierea ilustrațiilor. Proba cu versuri dispuse în două coloane a demonstrat că spațierea poate schimba ordinea estimată. OCR-ul poate omite caractere; o pagină fără text recunoscut afișează explicit lipsa transcrierii, fără a presupune că originalul este gol.

## Verificare editorială

În administrarea cărții, secțiunea „Text pentru lectură accesibilă” afișează imaginea paginii și transcrierea. Administratorul poate corecta ordinea, versurile, diacriticele și descrierile, poate cere OCR pentru pagina curentă sau poate introduce o transcriere manuală când extragerea nu funcționează. Alege limba textului, compară cu originalul și confirmă verificarea înainte de salvare. Corecturile sunt vizibile în modul Text după reîncărcarea paginii.

Corecturile se salvează separat de detaliile cărții. O revizie protejează împotriva suprascrierii dintr-o sesiune veche; la conflict, formularul păstrează textul introdus. O nouă propunere OCR nu modifică versiunea salvată. Pagina poate include o descriere manuală a unei ilustrații sau mențiunea „Pagină fără conținut”, dacă acestea reflectă originalul.

## Instalare și date

Sunt necesare Node conform `.nvmrc`, `poppler-utils`, `util-linux`, `tesseract-ocr`, `tesseract-ocr-ron` și `tesseract-ocr-eng`. Verifică `tesseract --list-langs`: trebuie să includă `ron` și `eng`.

După backupul bazei existente, aplică migrarea aditivă înaintea activării release-ului:

```sh
node scripts/migrate-book-text-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Tabela `book_page_texts` păstrează corecturile, limba și revizia, identificate prin fișier și pagină. Este inclusă în snapshotul SQLite și în backupul criptat. Cache-ul extras/OCR este regenerabil și rămâne în `book-pages/v3`. La revenirea la codul anterior, tabela aditivă poate rămâne. Nu restaura o bază veche peste modificări ulterioare.

`GET /api/book-text/{fileId}/{page}` verifică publicarea înainte de citire. `GET`/`PUT /api/admin/book-text/{fileId}/{page}` necesită administrator; salvarea verifică originea, formatul JSON, numărul paginii și revizia. Regula Nginx existentă pentru `/api/admin/` protejează aceste rute. Răspunsurile nu se cachează în browser sau proxy. Textul este randat ca text, fără interpretare HTML.

Extragerea împarte limita de două procese active și coada limitată cu randarea PDF. Subprocesele au limite de memorie de 512 MiB, CPU de 20 s, timp de 20 s pentru text/OCR și 30 s pentru rasterizare, plus ieșire limitată. OCR folosește un singur fir și o imagine de maximum 2800 px pe latura lungă. Textul unei pagini este limitat la 64.000 de caractere. Căutarea trimite o singură cerere de pagină odată și poate fi anulată. Oprirea cererii din browser nu întrerupe o extragere deja pornită; limitele serverului rămân active.

## Verificare și limite

Testele acoperă PDF textual, coloane, PDF numai cu imagine și OCR real, pagină goală, cache după restart, pagini invalide, revizii concurente, acces privat, migrare repetabilă și includerea corecturilor în backup. Probele browser verifică textul din arborele de accesibilitate, căutarea, mărirea fontului, telefonul și corectarea administrativă.

Implementarea oferă un echivalent textual editabil, conform principiului explicat de [W3C, Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html). Nu certifică automat accesibilitatea conținutului fiecărei cărți: paginile complexe trebuie verificate editorial, iar alte limbi pot necesita transcriere manuală sau modele OCR suplimentare. Nu a fost efectuat un audit WCAG complet sau o sesiune NVDA/VoiceOver.

Modul Text/OCR și corecturile au fost publicate la 26 septembrie; [publicarea preferințelor de lectură](../publicare-preferinte-lectura-2026-09-27/PUBLICARE.md) din 27 septembrie păstrează aceste funcții și adaugă persistența preferințelor descrisă mai sus.
