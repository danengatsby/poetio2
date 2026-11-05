**Căutarea în poeme și cărți — 5 noiembrie 2026**

Colecția publică și lista administrativă folosesc o proiecție normalizată a poemelor și un index SQLite FTS5 cu trigrame. Normalizarea literelor românești se face la salvare, prin triggere SQL. Căutarea păstrează potrivirea literală a fragmentelor de cuvinte, inclusiv semnele de punctuație și termenii care seamănă cu operatori de căutare. Pentru unul sau două caractere se caută în proiecția deja normalizată. Titlurile, textele, reviziile și istoricul publicat rămân în tabelele originale.

Remedierea din 5 noiembrie limitează expresia FTS la o singură trigramă candidată, preferând trei caractere distincte. Verificarea finală prin `instr` folosește întregul termen. Expresiile lungi repetitive nu mai construiesc fraze poziționale costisitoare; potrivirile parțiale ale candidaților nu apar ca rezultate.

Extracția, interogarea și triggerele folosesc aceeași mapare versionată de litere mici Unicode 17.0, caracter cu caracter. Diacriticele românești păstrează regula existentă; alte accente sunt păstrate (`CAFÉ` devine `café`, nu `cafe`). `lib/search-fold-map.ts` și tabela `search_fold_characters` provin din același generator. Nu este transliterare, traducere sau echivalare Unicode completă a tuturor variantelor de scriere. `scripts/generate-search-normalization.mjs --check` verifică reproducerea fișierelor generate în versiunea Node documentată.

Sitemap-ul citește numai calea și data modificării. Nu încarcă textele poemelor sau numărul comentariilor.

În cititorul cărților, prima căutare pregătește textul pe server și afișează progresul. Se procesează o singură carte la un moment dat. Paginile procesate și poziția progresului se păstrează în SQLite; după repornire, o nouă cerere reia pregătirea. Căutările următoare reutilizează textul și livrează câte 20 de rezultate, fără descărcarea fiecărei pagini în browser. Paginile fără text disponibil sunt semnalate și pot fi reîncercate. O corectură salvată actualizează rezultatele în aceeași tranzacție; o extracție începută anterior nu o înlocuiește.

Fiecare cerere de rezultate verifică din nou accesul la PDF. Retragerea cărții închide accesul public inclusiv la rezultatele deja pregătite. Previzualizarea unei transcrieri nesalvate caută numai în pagina previzualizată și este etichetată astfel; nu trimite textul nesalvat către căutarea publică. Căutarea în textul cărților acceptă și variantele fără diacritice.

Pe VPS se aplică migrarea aditivă `0017_search_indexes.sql`, după un backup SQLite consistent și înaintea activării noului build:

```sh
node scripts/migrate-search-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Scriptul verifică schema existentă, rulează tranzacțional și poate fi repetat. Refuză o schemă parțială ori incompatibilă. Nu rescrie poemele, transcrierile originale sau istoricul. Varianta Node furnizează serviciul de pregătire a căutării în cărți prin `BOOK_SEARCH`; un runtime fără această implementare răspunde cu indisponibilitate explicită. Validarea acestei publicări vizează VPS-ul.

După `0017`, aplică noua migrare `0018_search_normalization.sql` înaintea activării buildului remediat:

```sh
node scripts/migrate-search-normalization-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Migrarea înlocuiește triggerele de normalizare și reconstruiește numai proiecțiile și indexurile derivate, inclusiv paginile deja extrase sau corectate. Datele editoriale și istoricul rămân identice. Repetarea verifică atât schema, cât și toate mapările. Nu modifica migrarea istorică `0017` pentru a aplica remedierea unei baze existente.

Verificări:

```sh
npm run lint -- --max-warnings=0
./node_modules/.bin/tsc --noEmit --incremental false
npm run test:vps
npm run test:backup
npm run build:vps
```

Suita VPS include testele `search-indexes.test.mjs`: păstrarea datelor la migrare, repetarea migrării, potriviri literale și cu diacritice, modificări/ștergeri, paginarea cărților, reutilizarea după repornire, reîncercarea paginilor lipsă și corecturi concurente. Fișierele testelor VPS se execută succesiv pentru a evita concurența dintre decodoarele media și celelalte verificări.

TypeScript și ESLint exclud directoarele auxiliare `work`, `outputs`, `dist`, `.sites-runtime` și `.wrangler`. O clonă de verificare păstrată în `work` nu mai intră în verificarea sursei curente.

La revenirea la codul precedent se pot păstra schema aditivă și toate datele noi. Nu restaura automat o bază veche peste editările ulterioare publicării.

Comportamentul tokenizerului folosit este descris în [documentația SQLite FTS5](https://www.sqlite.org/fts5.html#the_trigram_tokenizer).
