# Schițe și istoric pentru cărți

În `/admin/carti`, modificările titlului, autorului, descrierii și referințelor PDF/copertă se salvează automat în browser. După redeschidere, folosește „Recuperează schițe și versiuni”, previzualizează copia și apasă „Încarcă în editor, fără publicare”. Copiile locale rămân pe dispozitivul respectiv; ștergerea datelor browserului le elimină.

„Salvează schița pe server” păstrează explicit o copie privată, inclusiv o carte incompletă sau fără PDF. O poți recupera din alt browser autentificat. O salvare cu alte date creează o copie nouă, iar reîncercarea aceleiași cereri nu creează duplicate. Lista este paginată; schițele pot fi șterse individual.

„Istoric de versiuni” păstrează cartea existentă la activarea funcției, fiecare salvare ulterioară și versiunea dinaintea ștergerii. Capturarea este tranzacțională: dacă salvarea cărții sau a istoricului eșuează, se anulează împreună. Conflictele de revizie și reîncercările fără modificări nu adaugă versiuni.

Recuperarea doar completează formularul. Pentru o carte încă publicată se folosește revizia curentă; pentru o carte ștearsă formularul o tratează ca nouă, păstrând identificatorul. Verifică datele și apasă „Salvează carte” pentru publicare. Validarea PDF și verificările reviziilor rămân obligatorii. Recuperarea unei cărți șterse nu readuce comentariile eliminate.

## Fișiere și corecturi textuale

Schițele și istoricul păstrează identificatorii PDF-ului și copertei deja încărcate. Fișierele rămân în stocarea privată după ștergerea cărții și intră în backup; recuperarea nu face copii noi ale acestora. Chiar dacă publicarea eșuează după un upload reușit, schița locală păstrează referința fișierului deja încărcat.

Un fișier doar selectat pe dispozitiv nu este salvat în schiță. După recuperare, editorul cere reselectarea PDF-ului și/sau a copertei înainte de publicare. Poți renunța explicit la fișierele neîncărcate și păstra referințele recuperate. O carte fără PDF nu poate fi publicată.

Corecturile transcrierilor din modul Text se salvează separat în `book_page_texts`. Ele sunt asociate PDF-ului, nu fiecărei revizii a metadatelor cărții. Istoricul descris aici nu reprezintă istoric al corecturilor și nu salvează automat o transcriere aflată încă în formular; folosește „Salvează textul verificat”. Salvarea detaliilor cărții păstrează corecturile nesalvate în editorul deschis.

## Instalare și recuperare operațională

După backupul bazei existente și după migrarea editorială `0011`, aplică:

```sh
node scripts/migrate-book-editorial-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Migrarea `0013_book_editorial_recovery.sql` adaugă trei triggere pentru `books` și capturează cărțile existente o singură dată. Scriptul este repetabil și refuză o aplicare parțială. Nu poate reconstrui versiunile dinaintea activării. Jurnalul și snapshotul Drizzle includ noua migrare; structura tabelelor editoriale existente rămâne compatibilă.

Activează release-ul după verificarea pe o copie a datelor. Pentru versiunea care include și modul Text, aplică în ordine migrarea `0012` conform [LECTURA-TEXT.md](LECTURA-TEXT.md), apoi `0013`. Revenirea codului nu necesită ștergerea istoricului; triggerele pot continua să înregistreze modificările. Nu înlocui baza cu un backup vechi peste editările noi.

Rutele `/api/admin/recovery/book/*` folosesc verificarea proprietarului și protecția Nginx existentă pentru `/api/admin/`. Scrierile cer aceeași origine și JSON, iar răspunsurile rămân private, fără cache. Schițele nu apar în colecție sau sitemap. Backupul SQLite include schițele și istoricul.
