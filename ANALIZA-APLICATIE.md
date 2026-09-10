# Analiza aplicației Poetio

Analiză finalizată la 10 septembrie 2026, pe copia din `/var/www/Poetio`. Au fost analizate sursele, exportul de date și comportamentul local al Workerului. Nu au fost modificate sursele aplicației sau datele exportate și nu a fost modificat site-ul publicat. Pentru verificări au fost instalate dependențele și a fost generată o compilare locală în `sursa/dist`.

**Evaluare:** Poetio are o bază funcțională potrivită unei colecții mici de poezie. Persistența și protecțiile împotriva modificărilor concurente sunt bine acoperite de teste. Există însă un defect în reutilizarea traducerilor, o problemă de pornire a compilării și dependențe de găzduire care trebuie rezolvate înaintea unei migrări.

**Structură și funcționalități**

| Zonă | Implementare |
| --- | --- |
| Interfață | React 19, TypeScript, Vinext/Vite, Tailwind și componente Radix/shadcn |
| Colecție | Pagina `/`, poem în prim-plan, casete și cititor modal cu navigare |
| Limbi și aspect | Română / English (US), temă de zi și de noapte |
| Administrare | `/admin`, adăugare, editare, ștergere, imagini și traduceri |
| Date | Cloudflare D1/SQLite; schema și migrările folosesc Drizzle |
| Imagini | Cloudflare R2, metadate în D1, coperți implicite în proiect |
| Traducere | Apel server către OpenAI; cheia este citită din mediul de execuție |
| Autentificare | Identitate furnizată de Sites și verificarea proprietarului în aplicație |

Exportul conține două poeme în română. Unul are traducere engleză salvată; celălalt nu are. Ambele referă imagini personalizate ale căror fișiere lipsesc din arhivă. Cele șase poeme demonstrative din cod nu reprezintă colecția exportată.

**Probleme confirmate și priorități**

1. **Prioritate ridicată — traducerea poate rămâne asociată unui original schimbat.** Dacă traducerea reușește, dar încărcarea imaginii sau salvarea poemului eșuează, traducerea generată rămâne în formular. Dacă autorul modifică apoi originalul și reîncearcă, `needsEnglishTranslation` o consideră o traducere revizuită manual și nu o regenerează. Am reprodus local salvarea originalului „Luna apune.” cu traducerea „The sun rises.”. Remediere: memorarea originalului pentru care a fost generată traducerea și distingerea traducerilor generate de intervențiile manuale. Referințe: [poem-languages.ts](lib/poem-languages.ts:15), [poem-admin.tsx](app/admin/poem-admin.tsx:108), [poems.ts](db/poems.ts:113).

2. **Prioritate ridicată pentru utilizarea arhivei — comanda standard de compilare eșuează.** `npm run build` se oprește cu `Permission denied`: scripturile exportate au permisiuni `0600`, iar scriptul de compilare execută direct `sites-env.sh`. Același model apare în `install:ci`. După instalarea dependențelor, compilarea directă prin Vinext reușește. Remediere: păstrarea permisiunilor de execuție la export sau invocarea consecventă prin `bash`, inclusiv la relansarea scriptului inițial. Referințe: [build-verified.sh](scripts/build-verified.sh:7), [install-ci.sh](scripts/install-ci.sh:7).

3. **Prioritate ridicată pentru restaurare — copia media este incompletă.** Metadatele celor două imagini există, însă obiectele R2 nu sunt incluse. Restaurarea bazei nu restaurează fotografiile; interfața poate afișa coperțile implicite când imaginile lipsesc. Remediere: completarea backupului cu obiectele R2 și verificarea lor față de hashurile exportate. Referințe: [MANIFEST.json](../MANIFEST.json), [lista imaginilor lipsă](../date/imagini-incarcate-lipsa.json).

4. **Condiție obligatorie la migrare — autentificarea depinde de Sites.** Aplicația acceptă identitatea din headerul `oai-authenticated-user-email` și o compară cu proprietarul definit în cod. Am confirmat că verificarea locală acceptă un request construit cu acest header și un `Origin` corespunzător. Siguranța depinde de infrastructura care elimină valorile furnizate de client și transmite identitatea verificată. Aceasta nu este o demonstrație de vulnerabilitate a site-ului live, a cărui infrastructură nu a fost testată. Pentru un VPS sau altă găzduire sunt necesare autentificare verificată și protejarea accesului direct la aplicație. Referință: [access.ts](lib/access.ts:15).

5. **Prioritate medie — verificarea statică nu trece.** ESLint raportează 12 erori și 2 avertismente: linkuri interne cu `<a>`, JSX în blocuri `try/catch` și imagini fără optimizare. Aceste constatări nu înseamnă că toate navigările sau paginile sunt defecte; verificarea configurată a proiectului rămâne însă roșie. Blocurile existente tratează erorile de încărcare a datelor, dar nu înlocuiesc tratarea erorilor de randare. Referințe: [page.tsx](app/page.tsx:14), [admin/page.tsx](app/admin/page.tsx:17).

6. **Prioritate medie — validarea imaginilor pe server este parțială.** Serverul limitează dimensiunea fișierului și verifică semnătura formatului. Decodarea imaginii și limita de 40 megapixeli sunt verificate numai în browser. O secvență de 24 de octeți care începe ca un JPEG a fost acceptată de verificarea serverului. Accesul la încărcare este limitat la proprietar, ceea ce restrânge expunerea. Remediere: validarea dimensiunilor și a structurii reale a imaginii pe server. Referințe: [images.ts](db/images.ts:18), [poem-admin.tsx](app/admin/poem-admin.tsx:82).

**Aspecte bine implementate**

- Interogări SQL parametrizate și validarea datelor de intrare.
- Revizii pentru detectarea editărilor concurente; repetarea cererilor uzuale nu dublează poemele.
- Marcaje persistente care împiedică reapariția poemelor demonstrative șterse.
- Păstrarea diacriticelor, versurilor, strofelor și indentării.
- Verificarea proprietarului, originii și formatului pentru modificări.
- Imaginile neasociate unui poem nu sunt servite vizitatorilor prin ruta locală de imagini.
- Tratarea erorilor de traducere și posibilitatea salvării doar a originalului.
- Elemente de accesibilitate în cod: focus controlat în cititor, etichete, link de salt și respectarea preferinței pentru mișcare redusă.

**Îmbunătățiri pentru dezvoltarea ulterioară**

Poemele se deschid în ferestre modale, fără adresă proprie: distribuirea unui poem și metadatele individuale pentru motoarele de căutare sunt limitate. Pagini individuale, metadate localizate și o funcție explicită de selecție a poemului în prim-plan ar îmbunătăți publicarea; acum este ales primul poem în ordinea datei de creare.

Imaginile încărcate sunt livrate la dimensiunea originală, cu `private, no-store`. Una dintre imaginile din metadate are aproximativ 3,9 MB. Variante redimensionate ar reduce transferul; orice schimbare a politicii de cache trebuie să respecte modelul de acces al site-ului. Colecția este încărcată integral din D1, suficient pentru volumul actual; căutarea și paginarea devin utile la creștere.

Schițele există în starea formularului, cu avertizare la părăsire, dar fără recuperare persistentă după închiderea browserului. De asemenea, codul nu include curățarea obiectelor R2 rămase nefolosite după înlocuiri sau abandonarea unei salvări. Acestea sunt îmbunătățiri de robustețe, nu explicații pentru un defect observat în colecția actuală.

**Verificări efectuate**

| Verificare | Rezultat |
| --- | --- |
| Hashuri din export | 186/186 conforme înaintea verificărilor de execuție |
| SQLite `integrity_check` și chei externe | Integritate OK; fără încălcări |
| Concordanță SQLite / JSON | Toate cele trei tabele corespund |
| Restaurare SQL într-o bază temporară | Reușită; două poeme |
| `npm run build` | Eșuează la permisiunile scriptului |
| Compilare directă `node_modules/.bin/vinext build` | Reușită |
| TypeScript `tsc --noEmit --incremental false` | Fără erori |
| ESLint | 12 erori, 2 avertismente |
| Testele poemelor | 13/13 trecute |
| Testele componentelor | 4/4 trecute |
| Testul Workerului compilat, cu D1 și R2 locale | 1/1 trecut |
| Reproducere suplimentară: traducere după salvare eșuată | Defect confirmat, inclusiv la persistență |

Testele de traducere au folosit răspunsuri simulate; nu au fost făcute cereri reale către OpenAI. Nu au fost verificate vizual interfața într-un browser, performanța pe dispozitive reale sau autentificarea infrastructurii publicate. Cele 18 teste existente trec, dar nu acoperă scenariul defect de reutilizare a traducerii descris mai sus.

**Notă de publicare:** la reconectarea copiei la repository-ul original, permisiunile de execuție ale celor trei scripturi au fost restaurate conform Git. Problema de permisiuni descrisă mai sus privește arhiva analizată. Restul constatărilor rămân deschise.
