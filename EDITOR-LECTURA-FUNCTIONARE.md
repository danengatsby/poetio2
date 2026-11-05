# Previzualizare, lectură și funcționare

Implementat la 27 septembrie și publicat pe poetio.cloud la 28 septembrie 2026, în release-ul `20260928T173015Z-media-translations`. Cele 14 scenarii de browser au fost repetate pe noul release, cu date temporare; colectorul privat și `poetio-status.timer` sunt instalate și active. Backupul include configurația celor două unități noi. [Raport de publicare](/var/www/Poetio/publicare-media-traduceri-2026-09-28/PUBLICARE.md).

## Previzualizarea schițelor

Editoarele de poeme, video și cărți oferă „Previzualizare ca cititor”, într-un dialog cu selecție RO/EN, închidere cu Escape și întoarcere la editor fără pierderea modificărilor. `PoemReading`, `VideoReading` și `BookPresentation` sunt folosite și în paginile individuale publice. Dialogul nu publică metadate și nu salvează transcrierea; linkurile de distribuire și comentariile apar numai pe pagina publicată.

Poemele afișează originalul sau traducerea completată, cu limba reală a textului în cazul lipsei traducerii. Dacă traducerea automată este configurată, „Pregătește traducerea în schiță” o aduce în editor pentru verificare înainte de publicare. Salvarea reutilizează traducerea pregătită dacă schița nu s-a schimbat. Previzualizarea nu apelează serviciul de traducere. Fișierele audio și video selectate se redau din URL-uri locale; redarea este o probă în browser, nu o validare completă a fișierului pentru toate dispozitivele.

Pentru un PDF nou, „Pregătește PDF privat pentru previzualizare” încarcă fișierul și verifică toate paginile prin traseul existent, fără să creeze o carte publică. Cititorul public este apoi folosit cu accesul administratorului. Transcrierea paginii curente, inclusiv modificările nesalvate, se poate verifica în modul Text. Fișierul pregătit este reutilizat la salvarea cărții. Fișierele private încărcate rămân pe server conform politicii existente de păstrare a media; închiderea dialogului nu le șterge. Poziția de lectură nu se modifică în previzualizare. Corecturile textului au în continuare salvare separată.

## Antet și confort de lectură

Antetul public păstrează legăturile Poeme, Video, Cărți, Autor și RO/EN la vedere. Tema și administrarea sunt grupate în „Opțiuni”, folosind `details`; Escape și atingerea în afară închid meniul. Comenzile au minimum 44 px înălțime. În proba Chromium la 390 px: antetul scade de la 246,80 la 116,39 px, recuperând 130,41 px de ecran.

Poemele au un panou „Confort de lectură”: font 100–200%, trepte de 12,5%, lățime îngustă/medie/largă și resetare. `poetio:poem-reading:v1` păstrează exclusiv aceste preferințe; setările cărților și pozițiile PDF rămân separate. Valorile invalide sunt înlocuite cu valorile implicite 112,5%/medie. Schimbările se sincronizează între file; dacă stocarea este refuzată, comenzile rămân funcționale în memoria paginii și mesajul explică lipsa persistenței.

## Panoul privat de funcționare

`/admin/functionare` și `/api/admin/operations` cer identitatea proprietarului. Răspunsul API folosește `Cache-Control: private, no-store`. Panoul se actualizează manual sau la un minut cât timp fila este vizibilă.

- Backup: ultima copie disponibilă cu verificare prin restaurare, vechime, ultima execuție și activarea programării. Peste 36 de ore înseamnă backup restant. Rezumatul mai vechi de 5 minute este necunoscut; lipsa unei dovezi nu apare ca succes. O execuție eșuată nu șterge dovada copiei precedente.
- Spațiu: disponibilul pentru proces pe discul datelor; avertizare sub 1 GiB sau 10% liber.
- Versiune: numele directorului real al procesului, momentul pornirii și versiunea Node.
- Media: ultimele 20 de grupuri de erori PDF/imagine observate de proces, cu fișier dacă este cunoscut, cod și număr de observații. Nu se păstrează conținut sau mesaje brute. Lista se resetează la restart; reîncercările pot crește contorul. Erorile proceselor PDF din fundal sunt observate la verificarea stării. Nu reprezintă un scan complet al bibliotecii și nu monitorizează erorile audio/video din browserele vizitatorilor.

Mediile fără binding-ul Node `OPERATIONS` afișează explicit indisponibilitatea monitorizării, fără valori inventate.

## Instalarea rezumatului la deploy VPS

Colectorul rulează separat ca root și publică numai câmpurile permise din dovada backupului și starea a două unități systemd. Aplicația nu primește acces la arhive, parole sau cheia de criptare. Directorul `/run/poetio-status` are proprietar `root:poetio`, mod 0750; fișierul JSON are mod 0640, înlocuit atomic.

După instalarea release-ului și înaintea verificării panoului:

```bash
sudo install -o root -g root -m 0755 /var/www/Poetio/current/scripts/operations-status.py /usr/local/sbin/poetio-status
sudo install -o root -g root -m 0644 /var/www/Poetio/current/deploy/poetio-status.service /etc/systemd/system/poetio-status.service
sudo install -o root -g root -m 0644 /var/www/Poetio/current/deploy/poetio-status.timer /etc/systemd/system/poetio-status.timer
sudo systemctl daemon-reload
sudo systemctl enable --now poetio-status.timer
sudo systemctl start poetio-status.service
```

Verifică apoi panoul autentificat, accesul anonim refuzat și faptul că utilizatorul `poetio` poate citi rezumatul, dar nu îl poate scrie. Dacă temporizatorul este oprit, panoul trebuie să afișeze starea necunoscută după cinci minute. Rollback-ul aplicației nu modifică baza de date: această schimbare nu introduce migrații. Colectorul poate fi oprit separat cu `systemctl disable --now poetio-status.timer`.

## Verificare

`npm run test:operations` verifică validarea preferințelor, starea backupurilor, eșecurile și limitele monitorizării. `npm run test:vps` include testele JavaScript noi. Probe HTTP/browser și comparația antetului: `/var/www/Poetio/verificare-editor-lectura-2026-09-27/`. Datele demonstrative se creează numai într-o bază temporară, eliminată la final. Nu s-a efectuat un audit WCAG complet sau testare Safari/Firefox.
