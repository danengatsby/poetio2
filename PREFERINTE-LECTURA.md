# Preferințele cititorului de cărți

Implementat și publicat la 27 septembrie 2026, în release-ul `20260927T154916Z-reading-preferences`. [Publicare și verificări](../publicare-preferinte-lectura-2026-09-27/PUBLICARE.md).

Cititorul reține modul „Pagina originală” / „Text” și dimensiunea textului. Preferințele sunt comune cărților deschise în același profil de browser, pe același site. Pagina memorată rămâne separată pentru fiecare fișier PDF; nu se mută odată cu preferințele și nu este ștearsă la resetarea lor.

Butonul „Resetează preferințele” revine la pagina originală și text de 125%. Fontul rămâne memorat și după trecerea temporară la pagina originală. Limitele existente sunt 100%–250%, în trepte de 25%. Interfața și mesajele sunt disponibile în română și engleză.

## Date și comportament

- `poetio:book-preferences:v1` păstrează în `localStorage` doar `{ mode, textSize }`.
- `poetio:book-position:v1:{fileId}` păstrează în continuare poziția fiecărui PDF, cu regulile existente de salvare după încărcarea paginii.
- Sunt acceptate numai modurile `original` / `text` și dimensiuni numerice finite, în intervalul și treptele acceptate. Câmpul nevalid revine la valoarea implicită fără a elimina celălalt câmp valid. JSON corupt sau o valoare fără forma unui obiect folosește valorile implicite.
- Preferințele sunt citite în browser după hidratare; serverul folosește un snapshot implicit stabil. Încărcarea paginii nu scrie valorile implicite peste preferințele salvate. Nu este necesar un cookie sau un cont.
- O modificare se aplică și cititoarelor din celelalte file ale aceluiași browser, prin evenimentul de stocare. Pozițiile de lectură rămân independente.
- Refuzul citirii, scrierii sau ștergerii în stocare este tratat. Controalele continuă să funcționeze în memorie, iar un mesaj explică lipsa salvării. Dacă browserul refuză inclusiv ștergerea preferinței vechi, resetarea se aplică sesiunii curente; reîncărcarea poate restaura ultima valoare salvată. Nu se pretinde persistență în acest caz.

Preferințele nu sunt sincronizate între dispozitive sau profiluri diferite și nu intră în backupul serverului. Nu se salvează conținutul cărții, căutarea, zoomul imaginii sau datele formularului de comentarii.

## Verificare

Au trecut 69 de teste VPS, ESLint fără avertismente, TypeScript și compilările VPS/Cloudflare. Cele două cazuri noi ale validării preferințelor se află în `tests/book-reading.test.mjs`; testele anterioare pentru poziție și paginare rămân active.

Proba Chromium a trecut 15 scenarii pe două cărți demonstrative cu câte trei pagini, într-o bază izolată: redeschidere și reîncărcare cu Text/150%/pagina 2, comutarea modului, preferințe comune și poziții separate, resetare, limitele fontului, lățime de 320 px la 250%, schimbarea limbii, date corupte, stocare blocată, erori la scriere/ștergere, sincronizarea filelor și protejarea preferinței salvate în timpul hidratării. Zero erori de pagină sau răspunsuri HTTP de eroare în proba finală.

Dovezi: `../verificare-preferinte-lectura-2026-09-27/`. Compilările folosesc copiile izolate ale surselor și dependențele locale existente, fără o nouă instalare `npm ci`. Nu s-a efectuat audit WCAG complet sau testare cu cititor de ecran.

Nu a fost necesară migrare SQL sau modificare Nginx. Versiunea publică este `20260927T154916Z-reading-preferences`; cele 15 scenarii de browser și 69 de teste VPS au fost rerulate pe pachetul pregătit pentru publicare, cu propria copie de dependențe.
