# Metadatele paginilor de carte

Implementat și publicat la 27 septembrie 2026, în release-ul `20260927T151750Z-collection-language`. [Publicare și verificări](../publicare-2026-09-27/PUBLICARE.md). Producția nu conține cărți; verificarea metadatelor cărților folosește instanțe izolate.

Pagina `/carti/{id}` generează pe server metadate din cartea curentă, prin infrastructura comună din `lib/content-metadata.ts`:

- Titlul documentului include cartea și autorul, când autorul este completat. Autorul apare și în `meta[name="author"]`.
- Descrierea salvată este compactată într-un fragment; dacă lipsește, apare o invitație la lectură care include titlul cărții.
- Adresa canonică este `https://poetio.cloud/carti/{id}`, fără parametri de urmărire sau de limbă. Editarea titlului păstrează adresa.
- Open Graph folosește tipul `book`, titlul, descrierea, adresa și coperta. Twitter folosește aceeași imagine și aceleași texte.
- Coperta folosește derivata publică `/api/images/{id}?w=1280`; fără copertă, se folosește imaginea generală `/assets/poetio-balloons.png`. PDF-ul privat nu este inclus în metadate.
- Identificatorii nevalizi, cărțile inexistente și cele șterse răspund 404 cu `noindex`, fără adresa canonică sau metadatele unei cărți valide.

## Limba

Interfața și `og:locale` folosesc regula comună descrisă în [LIMBA-DOCUMENTULUI.md](LIMBA-DOCUMENTULUI.md): parametrul `lang` valid are prioritate, apoi cookie-ul `poetio-language`, apoi româna. Metadatele se calculează la cererea paginii. Selectorul sincronizează URL-ul și preferința și reîmprospătează metadatele prin router, păstrând starea formularului de comentarii.

Titlul, autorul și descrierea editorială rămân în forma salvată. Se localizează numai invitația implicită când descrierea lipsește. Cărțile nu au versiuni editoriale separate pe limbi; nu emitem adrese canonice diferite sau legături `hreflang` care ar sugera traduceri inexistente. Parametrul `lang` selectează limba interfeței, fără a selecta o traducere a cărții. `og:locale` descrie interfața, fără a afirma limba PDF-ului sau a transcrierii.

## HTML disponibil fără JavaScript

Configurația `htmlLimitedBots: /.*/` cere frameworkului să rezolve metadatele înainte de trimiterea antetului pentru agenții identificați prin User-Agent, inclusiv browsere obișnuite. Astfel, un browser cu JavaScript dezactivat primește metadatele direct în `<head>`. Configurația este comună și paginilor de poeme/video; acestea au fost verificate separat.

Această alegere adaugă rezolvarea metadatelor înaintea începerii răspunsului HTML. Metadatele actuale sunt citite din baza de conținut, fără apeluri către servicii externe. Compatibilitatea Vinext pentru câmpurile Open Graph specifice cărților este limitată: autorul este livrat în titlu și în metadatele HTML standard, fără folosirea unui câmp `authors` care ar fi emis incorect ca `article:author`. Data încărcării nu este prezentată ca data apariției cărții.

## Verificare

În două copii izolate ale surselor, cu dependențele locale existente:

- Compilările VPS și Cloudflare au reușit.
- ESLint fără avertismente și TypeScript au trecut.
- 67 de teste VPS și testul de integrare Worker au trecut.
- Proba Chromium cu JavaScript dezactivat verifică două cărți, copertă și imagine implicită, caractere HTML în titlu, descriere lungă, preferința EN, actualizare, izolare între cărți, 404 pentru identificator nevalid/inexistent/șters și regresiile metadatelor pentru poem/video. Redarea video nu face parte din proba metadatelor.

Nu este necesară o migrare SQL. Publicarea necesită reconstruirea aplicației, deoarece configurația antetului este inclusă în build. Dovezile locale sunt în `/var/www/Poetio/verificare-metadate-carti-2026-09-26/`; numele directorului păstrează data începerii lucrării, iar rezultatele finale sunt din 27 septembrie.
