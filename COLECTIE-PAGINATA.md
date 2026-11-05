# Colecția de poeme: paginare, căutare și filtre

Implementată în surse la 26 septembrie 2026 și publicată pe `poetio.cloud` la 27 septembrie, în release-ul `20260927T151750Z-collection-language`. Migrarea `0014` și actualizarea verificatorului de backup au fost aplicate. [Publicare și verificări](../publicare-2026-09-27/PUBLICARE.md).

Pagina principală afișează cel mult 12 poeme, în ordinea stabilă `created_at, id`. Cardurile primesc din SQLite numai titlul, autorul, tema, referința imaginii, numărul comentariilor aprobate, limba și un fragment de cel mult 240 de caractere. Fragmentul păstrează cel mult două versuri; și un vers foarte lung este limitat. Pentru limba fără traducere disponibilă se afișează originalul, cu eticheta limbii.

Apăsarea cardului deschide pagina individuală existentă, unde se încarcă poemul integral, redarea audio și comentariile. Cardurile sunt linkuri obișnuite, fără preîncărcarea poemelor integrale. Cititorul în fereastră suprapusă de pe pagina principală este înlocuit cu navigarea la pagina poemului. Linkul „Înapoi la colecție” păstrează căutarea, filtrele, limba și numărul paginii; destinația revenirii este limitată la ruta colecției.

## Căutare și navigare

- Căutarea verifică titlul și textul integral, atât în original, cât și în traducere. Găsește un fragment literal, indiferent de majuscule pentru română și engleză; diacriticele românești pot fi omise. `%` și `_` sunt caractere literale, nu wildcarduri SQL.
- Filtrul „Temă” caută un fragment în tema originală sau tradusă. Nu încarcă o listă cu toate temele colecției.
- „Cu traducere” cere titlu și text tradus nevid; „Fără traducere” selectează restul. Cele trei criterii se combină.
- Formularul GET păstrează `q`, `theme`, `translation`, `lang` și `page` în adresă. Aplicarea filtrelor revine la prima pagină. Schimbarea limbii și paginarea păstrează filtrele. Căutarea, paginarea și lectura funcționează și fără JavaScript.
- Pagina cerută peste limita colecției se restrânge la ultima pagină disponibilă. Colecția fără rezultate afișează un mesaj și permite ștergerea filtrelor.

Interogarea este parametrizată. Textul căutării este limitat la 120 de caractere, tema la 80, iar numărul de carduri este fixat pe server. Linkurile filtrelor sunt codificate; React afișează rezultatele ca text, fără a interpreta marcaje HTML.

## Limite și scop

Limita privește datele transferate și cardurile randate în colecția publică. Căutarea cu `instr` și normalizarea diacriticelor scanează încă textele în baza de date; nu este un index full-text. Numărarea rezultatelor și paginarea cu offset pot deveni mai costisitoare la volume foarte mari. Pentru acel prag, următoarea etapă ar fi un index de căutare și paginare prin cursor, după măsurare.

Ordinea este deterministă inclusiv pentru aceeași dată de creare. Colecția rămâne actualizată între cereri: o inserare sau ștergere înaintea poziției curente poate deplasa paginile. Nu se păstrează un snapshot al întregii sesiuni de navigare. API-ul privat de administrare și sitemapul își păstrează fluxurile existente; această etapă vizează pagina principală.

## Instalare

După backup, aplică indexul aditiv pentru ordinea colecției:

```sh
node scripts/migrate-poem-collection-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Migrarea `0014_poem_collection_order.sql` și snapshotul Drizzle sunt incluse. Scriptul este repetabil, păstrează poemele și refuză un index cu același nume, dar cu structură incompatibilă. Pentru D1 se aplică migrarea prin fluxul obișnuit al proiectului.

La publicare trebuie actualizat și `/usr/local/sbin/poetio-backup` din `scripts/backup-vps.py`. Verificarea restaurării parcurge acum toate paginile colecției și compară ordinea și identificatorii cu baza restaurată; detectează omisiuni, duplicate și bucle. Rămâne compatibilă cu arhivele anterioare fără paginare. Nu necesită o schimbare a formatului arhivelor. Schema aditivă poate rămâne dacă se revine la codul anterior; nu se restaurează o bază veche peste editări noi.

## Dovezi

Proba repetată folosește aceeași bază pentru release-ul anterior și buildul nou: 107 poeme, dintre care 100 bilingve cu 30.000 de caractere pe limbă. HTML-ul necomprimat a scăzut de la **9.255.107** la **38.591 de octeți**, adică **99,58%**. Sunt măsurători locale pe date sintetice, fără a include imaginile și JavaScriptul comun, nu măsurători ale traficului comprimat din producție.

[Rezultatele HTTP/browser](../verificare-colectie-2026-09-26/rezultate.json) și [scriptul probei](../verificare-colectie-2026-09-26/verifica.mjs) verifică limita primei pagini, toate cele nouă pagini, absența textelor integrale în colecție, căutarea în traducere, păstrarea filtrelor la revenire, lipsa preîncărcării poemelor, funcționarea fără JavaScript și lățimi de 390/320 px. Verificările folosesc baze temporare; datele publice nu sunt modificate.

Au trecut 72 de teste Node (66 VPS, un test suplimentar al migrării, patru teste UI și integrarea Worker), cinci teste Python de backup, ESLint și TypeScript. Compilările VPS și Cloudflare au reușit în copii izolate care folosesc dependențele locale existente. Testul Worker execută paginarea și căutarea pe D1, inclusiv potrivirea fără diacritice în textul integral. [Verificări și amprentele surselor](../verificare-colectie-2026-09-26/verificari.json), [filtre pe mobil](../verificare-colectie-2026-09-26/collection-filters-mobile.png), [colecția pe desktop](../verificare-colectie-2026-09-26/collection-desktop.png).
