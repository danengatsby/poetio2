# Limba documentului și a interfeței

Implementat și publicat la 27 septembrie 2026, în release-ul `20260927T151750Z-collection-language`. [Publicare și verificări HTTPS](../publicare-2026-09-27/PUBLICARE.md).

Toate paginile publice folosesc aceeași ordine:

1. Prima valoare a parametrului `lang`, dacă este exact `ro` sau `en-US`.
2. Preferința validă din cookie-ul `poetio-language`.
3. Româna.

Un parametru gol sau necunoscut este ignorat și permite folosirea preferinței. Pentru parametri repetați, se examinează prima apariție, identic în colecție și în paginile individuale. Nu sunt introduse rute noi cu prefix de limbă.

## Rezolvare comună pe server

`proxy.ts` este mecanismul de interceptare al frameworkului. El calculează limba din URL și cookie și o transmite componentelor server prin antetul intern `x-poetio-language`. Înlocuiește întotdeauna valoarea venită de la client. Se aplică paginii principale, poemelor, videourilor, cărților, autorului și rutelor de administrare; nu interceptează API-urile sau fișierele media.

`requestLanguage()` este folosit de layout, pagini și generarea metadatelor. Astfel, un link `/poeme/{id}?lang=en-US` produce din primul răspuns `html.lang=en-US`, antet și navigare în engleză, inclusiv când browserul nu are cookie sau are preferința `ro`. Preferința nu este modificată automat prin simpla deschidere a linkului.

Titlurile și descrierile generale sunt localizate. Pentru cărți și video, conținutul editorial rămâne în forma salvată; parametrul schimbă interfața, fără a pretinde că există o traducere a cărții sau a videoului. Cărțile păstrează o singură adresă canonică.

## Limba reală a poemului

Dacă varianta cerută nu există, interfața păstrează limba selectată și explică afișarea originalului. Titlul și textul poemului au `lang` corespunzător originalului. Câmpul JSON-LD `inLanguage` urmează textul efectiv afișat, iar `og:locale` urmează limba interfeței. Înregistrarea audio este aleasă pentru varianta afișată.

Exemplu: un poem românesc fără traducere, deschis cu `?lang=en-US`, are documentul și navigarea în engleză, dar titlul și versurile sunt marcate `lang="ro"`, iar JSON-LD declară `inLanguage="ro"`.

## Navigare și selector

Legăturile publice din antet, subsol și colecțiile de cărți/video includ alegerea limbii. Funcționează și fără cookie-uri sau JavaScript. Legăturile și formularele colecției de poeme păstrează limba, filtrele și pagina conform comportamentului existent.

Selectorul actualizează limba documentului, încearcă salvarea preferinței în cookie și sincronizează parametrul URL fără a elimina filtrele sau fragmentul. Paginile de carte, autor și colecția video reîmprospătează componentele server și metadatele prin router, fără reîncărcarea completă a documentului. Comentariile netrimise au fost verificate ca păstrate în carte și pagina autorului. Selectorul poemului individual și cel al colecției de poeme continuă navigarea la documentul localizat; recuperarea comentariilor netrimise pe pagina poemului rămâne o problemă separată.

Formularele editoriale sunt în continuare în română și își păstrează marcajele locale. Schimbarea nu modifică autentificarea, traducerile salvate sau moderarea comentariilor.

## Verificare și publicare

Au fost verificate 28 de scenarii HTTP/browser într-o instanță VPS izolată, inclusiv JavaScript dezactivat, hidratare fără schimbare accidentală a limbii, cookie în conflict cu URL-ul, cookie-uri blocate, parametri invalizi/repetabili, navigare, actualizarea metadatelor, original fără traducere în ambele direcții și izolarea a opt cereri concurente. Aceasta este o probă de izolare, nu un test de capacitate sub trafic.

Integrarea Worker include șase cazuri ale priorității URL/cookie, verificarea antetului intern și a metadatelor. Compilările VPS și Cloudflare, cele 67 de teste VPS, testul Worker, ESLint și TypeScript au trecut.

Dovezi locale: `/var/www/Poetio/verificare-limba-document-2026-09-27/`. Copiile de compilare folosesc dependențele locale existente, fără o nouă instalare `npm ci`. Probele au folosit Chromium, fără audit WCAG complet sau testare cu cititor de ecran.

Această corecție nu necesită o migrare SQL sau o regulă Nginx nouă. Release-ul a fost reconstruit pentru a include `proxy.ts` și activat în producție. Migrarea `0014` aplicată în aceeași publicare aparține colecției paginate.
