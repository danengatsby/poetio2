# Pagini individuale, schițe și istoric

Implementare pentru poeme și video, 14 septembrie 2026.

## Pagini publice

- `/poeme/{id}`: titlu, autor, text complet cu strofe, audio disponibil pentru limba afișată și comentarii moderate.
- `/video/{id}`: titlu, autor, descriere, player și comentarii moderate.
- Cardurile colecțiilor și ferestrele de lectură oferă legături către paginile individuale. „Copiază linkul” folosește clipboardul browserului; dacă acesta refuză accesul, indică folosirea adresei din bară.
- Adresele folosesc identificatori stabili, astfel încât schimbarea titlului păstrează linkul. Conținutul eliminat răspunde cu 404.
- Metadate HTML pe server: titlu, descriere, autor, canonical, Open Graph și Twitter. Poemele includ datele publicării și modificării. JSON-LD folosește CreativeWork pentru poeme și VideoObject pentru video; textul introdus de autor este serializat sigur. Video folosește imaginea generală Poetio pentru distribuire.
- `?lang=en-US` selectează limba paginii. Legăturile alternative ale poemelor sunt emise numai pentru variantele existente; lipsa traducerii este indicată cititorului.
- `/sitemap.xml` include paginile publice existente, iar `/robots.txt` indică sitemapul. Schițele și istoricul nu intră în sitemap.

## Recuperare în administrare

În `/admin` și `/admin/video`, secțiunea „Recuperează schițe și versiuni” este înaintea editorului.

1. Modificările textuale și identificatorii fișierelor deja încărcate se salvează automat în browser. După reîncărcare, deschide secțiunea, previzualizează schița locală și apasă „Încarcă în editor, fără publicare”. Filele browserului au copii separate pentru a evita suprascrierea reciprocă. Ștergerea datelor browserului elimină aceste copii.
2. „Salvează schița pe server” creează o copie privată, recuperabilă și din alt browser autentificat. Este o salvare explicită; acceptă texte incomplete și video fără fișier. O nouă salvare cu alte date păstrează și copia precedentă. Reîncercarea aceleiași cereri nu dublează copia.
3. „Istoric de versiuni” conține copia de la activarea funcției, fiecare salvare ulterioară și conținutul dinaintea ștergerii. Lista are paginare de câte 20. Înregistrările nu pot fi șterse din interfață.
4. Previzualizarea și încărcarea în editor nu publică nimic. Verifică datele, apoi folosește butonul obișnuit de salvare. Restaurarea devine o nouă versiune; editările concurente continuă să fie verificate prin revizie.

Fișierele doar selectate pe dispozitiv, dar neîncărcate, nu sunt incluse în schițe; interfața cere selectarea lor din nou. Fișierele deja salvate sunt păstrate prin identificator și incluse în backupul de date/media. Recuperarea unui conținut șters nu readuce comentariile eliminate odată cu acesta. Pentru poemele inițiale cu identificator rezervat `original-*`, recuperarea după ștergere creează un poem cu identificator nou.

Istoricul anterior activării funcției nu poate fi reconstruit automat. Copiile locale rămase după reîncărcare și copiile explicite de pe server pot fi șterse individual din secțiunea de recuperare. Nici schițele, nici istoricul nu sunt accesibile vizitatorilor: rutele `/api/admin/recovery/*` verifică administratorul, operațiile de scriere verifică originea, iar răspunsurile nu se memorează în cache public.

## Instalare și revenire

Migrarea `0011_editorial_recovery.sql` creează `content_drafts`, `content_history`, indexurile și șase triggere pentru inserarea, modificarea și ștergerea poemelor/video. Capturarea versiunii se face în aceeași tranzacție cu modificarea; o operație respinsă nu produce istoric. Migrarea captează conținutul existent fără să-l modifice.

Pregătește un release separat cu `npm run build:vps`, verifică-l pe o copie izolată a datelor și fă un backup SQLite înaintea migrării. Cu serviciul oprit pentru schimbarea versiunii:

```sh
runuser -u poetio -- node scripts/migrate-editorial-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Scriptul aplică schema într-o tranzacție, verifică integritatea referințelor și este repetabil. Refuză o schemă aplicată parțial. Activează release-ul prin legătura `/var/www/Poetio/current`, apoi pornește `poetio.service`. Regulile Nginx existente pentru `/api/admin` sunt suficiente.

Pentru revenirea aplicației, reactivează release-ul precedent și repornește serviciul. Schema este aditivă și compatibilă cu aplicația precedentă; nu restaura automat baza veche peste modificări noi. Triggerele continuă să păstreze versiunile și cu aplicația precedentă.

Backupul local automat include aceste tabele și fișierele media. O restaurare verificată este necesară după publicare; procedura generală este în [BACKUP-VPS.md](BACKUP-VPS.md).

## Verificări

- `npm run test:vps`: 46 teste, inclusiv migrare repetabilă, păstrarea rândurilor existente, tranzacții anulate, istoric la modificare/ștergere, restaurare, schițe incomplete, reîncercări și paginare.
- TypeScript și ESLint pentru modulele noi; compilare VPS cu verificarea versiunilor React/RSC.
- 41 verificări HTTP pe o copie izolată: metadate, JSON-LD, sitemap, 404, autentificare, origine, confidențialitate și recuperare.
- Browser desktop/mobil: recuperare locală după reîncărcare, recuperare de pe server din alt browser, publicare explicită, restaurarea versiunii ca revizie nouă, pagini individuale și păstrarea ferestrei de lectură.
- Browser: refuzul stocării locale, eroare de rețea la salvarea privată și reîncercare, două file cu schițe independente și colecția la 390/768/1440 px fără depășiri sau suprapuneri.

## Publicarea pe VPS

Release activat: `/var/www/Poetio/releases/20260914T210447Z-editor`. Copie înainte de migrare: `/var/backups/poetio/before-editor-20260914T204329Z/immediately-before-migration.sqlite3`.

Migrarea a păstrat identic toate rândurile existente: 10 poeme, 20 video, o carte, cinci comentarii și toate înregistrările media. Au fost create 30 de versiuni inițiale, fără schițe de test în producție. Integritatea SQLite și referințele au trecut verificarea.

Backupul final `poetio-20260914T210606Z.tar.gz.gpg` a trecut decriptarea, verificarea manifestului, integritatea SQLite/media și pornirea aplicației restaurate. Copia conține 30 de versiuni și zero schițe de test. Verificările HTTPS au confirmat 35 de intrări în sitemap, paginile individuale, clipboardul, redarea video, desktop/mobil și refuzul accesului anonim sau cu identitate falsificată la administrare. Rezultatele sunt în `verificari-editoriale.json`.
