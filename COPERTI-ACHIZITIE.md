**Două coperți și linkuri de achiziție**

În `/admin/carti`, fiecare carte are două zone independente: „Coperta 1” și „Coperta 2”. Fiecare acceptă o imagine JPEG, PNG sau WebP de maximum 5 MB și un link de achiziție HTTP/HTTPS de maximum 2.048 de caractere. Se pot încărca, înlocui și elimina separat. Eliminarea unei coperți golește și linkul ei. Adresele cu protocoale executabile, relative sau cu credențiale sunt respinse.

În `/carti` și `/carti/{id}`, coperțile completate apar alăturat. Fiecare copertă cu link deschide propria destinație de achiziție într-o filă nouă. Titlul și „Citește” duc separat la lectura cărții. Nu există ancore imbricate. Fără un link completat, coperta se afișează ca imagine; cărțile vechi fără a doua copertă rămân utilizabile. Metadatele folosesc prima copertă disponibilă.

Previzualizarea folosește imaginile și linkurile din editor. Schițele locale și cele de pe server păstrează ambele linkuri, referințele încărcate și starea fișierelor care trebuie reselectate. Istoricul tranzacțional include ambele coperți și linkuri în noile salvări și ștergeri; versiunile istorice vechi nu sunt rescrise. Recuperarea unei versiuni vechi folosește valori goale pentru câmpurile care nu existau atunci.

`image_id` rămâne coperta 1; schema adaugă `image_2_id`, `purchase_url_1` și `purchase_url_2`. Ambele imagini se validează ca aparținând proprietarului. A doua imagine devine publică numai printr-o carte publicată și își pierde accesul public după retragere, inclusiv la cereri condiționale pentru o imagine din cache. PDF-ul și fluxul de lectură rămân cele existente.

După un backup consistent, aplică înainte de activarea buildului:

```sh
node scripts/migrate-book-covers-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Migrarea `0019_book_purchase_covers.sql` adaugă coloane nullable, cheia externă și indexul celei de-a doua imagini și înlocuiește triggerele istoricului. Păstrează cărțile, referințele și istoricul existente. Scriptul este tranzacțional, repetabil și refuză o schemă parțială. La revenirea la codul precedent se poate păstra schema extinsă. Nu restaura automat baza veche peste editări ulterioare.
