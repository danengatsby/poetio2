# Traduceri asociate originalului — 28 septembrie 2026

**Implementat și publicat pe poetio.cloud, 28 septembrie 2026**, în release-ul `20260928T173015Z-media-translations`. Remediază publicarea unei traduceri vechi după schimbarea originalului, atât după o salvare eșuată, cât și după „Pregătește traducerea în schiță”. Migrarea `0015` a fost aplicată cu backup și fără modificarea datelor existente. Cele 11 scenarii HTTP/Chromium au fost repetate pe release-ul publicat, cu date temporare. [Raport de publicare](/var/www/Poetio/publicare-media-traduceri-2026-09-28/PUBLICARE.md).

Fiecare traducere nouă are `translation_provenance`: versiunea formatului (`1`), proveniența (`automatic` sau `manual`), amprenta SHA-256 a originalului și amprenta traducerii. Originalul include limba, titlul, tema și textul; traducerea include titlul, tema și textul. Normalizarea coincide cu API-ul: spațiile marginale din titlu/temă sunt eliminate, CRLF/CR devin LF în corpuri, iar indentarea și strofele se păstrează. Autorul, imaginea, înregistrările și numărul reviziei nu schimbă asocierea.

Editorul verifică asocierea la fiecare modificare relevantă și anunță starea înaintea butonului de publicare. O traducere depășită, modificată manual, incompletă sau fără asociere verificată blochează salvarea perechii până la:

- regenerarea traducerii din originalul actual;
- compararea textelor și apăsarea „Confirm: traducerea corespunde originalului actual”;
- alegerea „Salvează fără traducere”, care elimină din publicare cele trei câmpuri traduse și asocierea.

Confirmarea manuală nu publică: pregătește schița pentru salvare. Schimbarea ulterioară a oricăruia dintre textele asociate invalidează confirmarea. Dacă originalul rămâne identic, reîncercarea unei salvări eșuate reutilizează traducerea generată, fără alt apel la traducător. Verificarea asincronă din browser invalidează imediat starea anterioară; un rezultat vechi nu poate reactiva publicarea după o nouă editare.

API-ul verifică independent ambele amprente la creare și actualizare. O pereche nevalidă primește `409`, fără modificarea poemului sau adăugarea unei versiuni în istoric. Schițele private pot păstra texte incomplete ori depășite, împreună cu proveniența; recuperarea nu le declară automat verificate. Istoricul salvat/șters păstrează obiectul de proveniență în aceeași tranzacție cu poemul.

Traducerile existente fără proveniență rămân vizibile. Nu le atribuim retrospectiv un original „verificat”. Editorul cere o revizuire înaintea republicării lor. Pentru compatibilitate, API-ul acceptă schimbări ale autorului sau fișierelor din clienți vechi dacă originalul și traducerea veche sunt identice cu cele din baza de date. Nu acceptă asocierea traducerii vechi cu un original schimbat. Clienții care omit complet câmpurile traducerii la schimbarea originalului continuă să elimine traducerea.

Asocierea verifică versiunea textelor, nu calitatea lingvistică. Confirmarea manuală este declarația administratorului; amprentele nu sunt semnături criptografice și nu certifică o traducere semantic corectă. Traducerea automată rămâne disponibilă RO → EN, iar revizuirea manuală funcționează în ambele direcții.

## Migrare și publicare

Migrarea aditivă [0015_translation_provenance.sql](drizzle/0015_translation_provenance.sql) adaugă o coloană nullable și înlocuiește cele trei triggere ale istoricului poemelor. Nu modifică textele, reviziile, schițele sau istoricul existent. Metadatele lipsă din versiunile vechi rămân necunoscute.

Pe VPS, după backup și verificarea release-ului pregătit, rulează din acel release, cu utilizatorul aplicației:

```sh
node scripts/migrate-translation-provenance-vps.mjs /var/lib/poetio/poetio.sqlite3
```

Scriptul necesită baza existentă, verifică schema și triggerele, lucrează într-o tranzacție și poate fi repetat. O schemă parțială sau conflictuală oprește migrarea. Publică apoi buildul care include această verificare. Pentru Cloudflare/D1, aplică migrarea `0015` prin fluxul existent de migrări înainte de Worker; migrarea a fost verificată în Miniflare/D1.

Revenirea la un build anterior poate păstra coloana și triggerele aditive, dar **reactivează comportamentul vechi de publicare**. Într-o astfel de revenire, suspendă modificările editoriale până la instalarea unei versiuni corectate. Nu elimina istoricul pentru a reveni la codul anterior.

## Dovezi

- `npm run test:vps`: **77/77** teste reușite, inclusiv proveniență, refuzul perechilor depășite, normalizare, reîncercări idempotente, schițe/istoric și migrare repetabilă cu date păstrate.
- **11 scenarii Chromium**, cu baza temporară și server exclusiv local: reîncercare fără modificări, schimbarea originalului după eroare, pregătire în schiță, recuperare locală/server, revizuire manuală prin tastatură, invalidarea revizuirii, eliminarea traducerii, original EN, versiune veche și eroare a traducătorului. Nicio eroare JavaScript.
- Testul de integrare al Worker-ului compilat: **1/1**, cu D1, autentificare și refuzul traducerii depășite prin HTTP.
- TypeScript, ESLint pentru fișierele modificate, build VPS și build Worker: reușite.
- Traducătorul a fost simulat; nu au fost apelate servicii externe în probe.

[Amprentele surselor verificate](/var/www/Poetio/verificare-traduceri-2026-09-28/surse.json).

[Scenarii și rezultate](/var/www/Poetio/verificare-traduceri-2026-09-28/rezultate.json), [reproducere](/var/www/Poetio/verificare-traduceri-2026-09-28/verifica.mjs), [avertizarea din editor](/var/www/Poetio/verificare-traduceri-2026-09-28/original-schimbat-blocat.png).
