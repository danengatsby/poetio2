# Imagini responsive și cache — 14 septembrie 2026

Pagina principală descărca aproximativ 18,14 MB după parcurgerea întregii colecții, inclusiv la a doua vizită. Patru fotografii JPEG de 3,2–4,3 MB și sigla PNG de 2,25 MB dominau transferul. Nginx adăuga `private, no-store` inclusiv resurselor care aveau deja politici de cache.

## Implementare

- Copertele folosesc `srcset` și `sizes`. Browserul alege între 320, 480, 640, 960 și 1280 px după dimensiunea afișată și densitatea ecranului; imaginile mici nu sunt mărite. Încărcarea coperților rămâne lazy.
- `/api/images/:id?w=320` produce WebP la calitate 82. Rendererul limitează lucrul concurent, validează dimensiunile și calea, aplică orientarea EXIF și păstrează rezultatul în `/var/lib/poetio/image-variants/webp-v1/`. Fișierele originale și înregistrările SQLite nu sunt modificate. Funcționează și pentru încărcările noi.
- `npm run build:images`, inclus automat în build, creează variantele siglei și copertelor implicite în `public/optimized/`, cu hash al conținutului în nume și manifestul `lib/generated-images.ts`. Sigla folosește calitate 90 și păstrează proporțiile. Aceeași componentă deservește poeme, video și cărți. Copertele cărților folosesc și ele variante responsive.
- Resursele cu nume versionate din `/_next/static/` și `/optimized/` au cache public pentru un an, `immutable`. Fișierele originale fără hash din `/assets/` păstrează durata scurtă a runtime-ului și ETag.
- Imaginile încărcate au `private, no-cache` și ETag: browserul poate păstra octeții, dar serverul verifică din nou dacă imaginea aparține unui poem sau unei cărți publicate, înainte de răspunsul 304. După detașare, accesul public întoarce 404 chiar dacă varianta optimizată există în cache. Previzualizările proprietarului au `no-store`.
- HTML-ul, administrarea, API-urile colecției și comentariile păstrează `no-store`. Configurația nu cache-uiește identitatea administratorului și nu permite falsificarea antetului de proprietar.

Rendererul este disponibil în buildul VPS prin bindingul `IMAGE_RENDERER`. Un mediu fără acest binding livrează originalul; optimizarea dinamică a imaginilor încărcate necesită un renderer corespunzător în acel mediu. Variantele statice funcționează în ambele builduri.

**Validarea uploadurilor — 25 septembrie 2026.** Înainte de salvarea în stocare sau în baza de date, serverul verifică tipul real, dimensiunile de maximum 40 de megapixeli și decodarea completă a pixelilor. Limita de 5 MiB rămâne verificată inclusiv pentru cereri trimise în flux. Fișierele invalide/trunchiate primesc HTTP 415, cele prea mari HTTP 413; octeții originalelor valide sunt păstrați exact, inclusiv la reîncercare. Verificările concurente sunt limitate la două; indisponibilitatea decodorului sau ocuparea ambelor locuri produce HTTP 503, fără salvare.

Pe VPS, bindingul `IMAGE_DECODER` folosește Sharp, cu respingerea avertismentelor de decodare, limită de pixeli și timp de procesare de 15 secunde. WebP-urile animate sunt decodate cu toate cadrele; pe acest runtime limita de pixeli include înălțimea cumulată a cadrelor. Citirea metadatelor singură nu decodează pixelii, de aceea este urmată de decodarea integrală. [Documentația Sharp](https://sharp.pixelplumbing.com/api-input/).

Buildul Cloudflare declară bindingul `IMAGES` în configurația generată. La publicare trebuie păstrat acest binding: validarea citește dimensiunile prin `info()`, apoi consumă complet rezultatul unei transformări, fără să înlocuiască originalul. Transformările Images pot genera costuri în producție conform planului Cloudflare; testul Miniflare folosește implementarea locală. Lipsa bindingului blochează uploadul cu HTTP 503. [Configurarea și tarifarea bindingului Images](https://developers.cloudflare.com/images/optimization/binding/).

Validarea remediului: 45 de teste Node și testul de integrare Worker trec; TypeScript și ESLint pentru fișierele schimbate trec; compilările VPS și Cloudflare reușesc. Cazurile noi verifică JPEG-ul fals de 24 de octeți, JPEG/PNG/WebP trunchiate, un PNG de peste 40 de megapixeli cu mai puțin de 5 MiB comprimați, refuzul salvării fără decodor și așteptarea decodării înaintea oricărei scrieri. Verificarea HTTP pe o instanță VPS temporară confirmă respingerea, păstrarea originalului valid, accesul privat și reîncercarea fără duplicate. Nu este necesară o migrare; imaginile deja stocate nu sunt reverificate prin această schimbare.

## Instalare și revenire

Construiește într-un release separat cu `npm run build:vps`. Instalează `deploy/nginx-image-cache.conf` ca `/etc/poetio/image-cache.conf` și include-l din configurația comună conform `deploy/poetio-app.conf`. Verifică `nginx -t`, activează release-ul și reîncarcă Nginx. Nu este necesară migrarea bazei de date.

La revenire se poate reactiva release-ul anterior împreună cu configurația Nginx anterioară. Nu restaura baza de date: această actualizare nu îi schimbă schema sau conținutul. Cache-ul derivatelor se poate șterge cu serviciul oprit; se reconstruiește automat. Schimbarea algoritmului/calității rendererului necesită și schimbarea versiunii `webp-v1` în calea cache-ului și ETag.

Backupul automat include originale, bază, surse, build și configurații; nu include cache-ul derivatelor, care poate fi regenerat. Restaurarea originalelor este suficientă.

## Verificări

40 de teste automate acoperă aplicația, moderarea, redarea PDF și acum redimensionarea, orientarea, cache-ul, concurența, validarea și accesul la imagini. TypeScript trece. ESLint trece pentru modulele noi; `app/showcase.tsx` păstrează regula deja încălcată privind linkul HTML din footer.

Verificări HTTP printr-un Nginx izolat: 20 de cazuri pentru WebP, ETag, HEAD, lățimi nepermise, previzualizări private, acces după detașare și cache static. Verificări în browser pentru mobil/desktop, a doua vizită, cititorul poemelor, schimbarea limbii, coperta cărții și cititorul PDF.

Măsurare Chromium cu cache inițial gol, fără throttling, desktop 1440×1000 DPR 1 și mobil 390×844 DPR 2; derulare până la capăt pentru a include toate copertele lazy. Valorile sunt octeții raportați de Chrome DevTools Protocol (`Network.loadingFinished.encodedDataLength`), cu antete incluse. A doua vizită folosește același context și navigare normală, fără golirea cache-ului. Nu sunt estimări ale duratei de încărcare pe o conexiune mobilă.

Rezultatele de producție sunt în `verificari-imagini.json`.

Referințe tehnice: [Sharp resize](https://sharp.pixelplumbing.com/api-resize/), [Sharp WebP](https://sharp.pixelplumbing.com/api-output/), [Nginx headers](https://nginx.org/en/docs/http/ngx_http_headers_module.html).
