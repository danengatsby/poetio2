# Verificarea audio/video — 28 septembrie 2026

**Remediat și publicat pe poetio.cloud, 28 septembrie 2026**, în release-ul `20260928T173015Z-media-translations`. Fișierele fără conținut redabil nu mai primesc succes la încărcare sau publicare. MP4-ul de 32 de octeți și WAV-ul de 44 de octeți din audit primesc `422`; nu sunt scrise nici obiecte media, nici înregistrări de upload. Fișierele existente sunt verificate înainte de a fi asociate sau păstrate într-o nouă salvare publică. [Raport de publicare](/var/www/Poetio/publicare-media-traduceri-2026-09-28/PUBLICARE.md).

## Comportament

Uploadul verifică semnătura și dimensiunea, apoi scrie o copie temporară privată. `ffprobe` verifică structura, durata, codec-urile și fluxurile. `ffmpeg` decodează integral fluxurile audio/video folosite la redare; nu este o probă limitată la primele secunde. Un rezultat gol, o eroare de decodare sau un diagnostic la nivel `error` refuză fișierul, inclusiv când utilitarul termină cu codul zero. Pentru WAV se verifică și lungimile RIFF/chunk și existența datelor; pentru MP4/M4A se verifică limitele box-urilor și existența `moov` și `mdat` cu date.

Originalul acceptat se păstrează nemodificat; nu este transcodificat. Copia temporară este ștearsă după verificare. Fișierul valid încărcat rămâne privat până la asocierea cu un poem sau video.

Publicarea verifică separat fișierul stocat: proprietar, SHA-256, dimensiune, tip și rezultatul decodării. Această condiție se aplică la creare și modificare, la reîncercarea unui upload existent și la referințe recuperate din schițe/istoric. La poeme se verifică și înregistrările păstrate de clienții care omit câmpurile audio. Eliminarea explicită a unei înregistrări invalide rămâne posibilă.

Când înlocuitorul este invalid, poemul/videoul publicat, revizia și istoricul nu se schimbă. Editorul păstrează titlul, textul/descrierea și selecția locală, afișează motivul și permite înlocuirea fișierului. Panoul „Funcționare” include erorile audio/video observate. Un fișier selectat local trebuie ales din nou după închiderea browserului, conform mecanismului existent de recuperare a schițelor.

Verificarea este sincronă și limitată. Lipsa verificatorului, dependențele indisponibile sau ocuparea lui produc `503`; fișierele invalide, codec-urile neacceptate și depășirea limitelor produc `422`. Nicio eroare de verificare nu este convertită în autorizare de publicare.

## Formate și limite

| Tip | Condiții |
| --- | --- |
| Audio | MP3; WAV PCM u8/s16le/s24le/s32le/f32le; M4A AAC; OGG Opus/Vorbis |
| MP4 video | H.264, pixeli `yuv420p`; sunetul, dacă există, AAC |
| WebM video | VP8/VP9, pixeli `yuv420p`; sunetul, dacă există, Opus/Vorbis |
| Fluxuri | Audio: exact un flux audio; video: exact un flux video și cel mult unul audio. Coperțile `attached_pic` nu sunt tratate drept film. |
| Dimensiune/durată | Audio: 25 MiB; video: 100 MiB; durată pozitivă, maximum 30 de minute |
| Rezoluție/rate | Cel mult 8.294.400 pixeli și 60 fps; audio: maximum 8 canale și 192 kHz |
| Resurse | Un singur job de decodare simultan; cererile identice împart verificarea. Fără coadă nelimitată. |
| Procese | `prlimit`: 768 MiB spațiu de adrese, 60 secunde CPU, fără fișiere de ieșire. Maximum 15 secunde pentru analiză și 90 secunde pentru decodare; ieșirea capturată este limitată la 256 KiB. |

Comenzile folosesc argumente distincte, fără shell, un demuxer explicit, numai protocolul local `file` și referințe externe MOV dezactivate. Decodarea nu produce un fișier convertit. Un fișier valid, dar prea complex pentru aceste limite, poate fi refuzat; mesajul cere reducerea duratei/rezoluției sau un nou export. Un fișier tolerat de un browser poate fi de asemenea refuzat dacă FFmpeg raportează erori. Politica nu garantează compatibilitatea cu orice dispozitiv și nu evaluează valoarea conținutului: o înregistrare de liniște validă rămâne acceptabilă.

## Rezultate reutilizabile și conținut existent

Verificările reușite sunt memorate temporar, cel mult 32 de rezultate în proces, și după verificarea fișierului stocat sunt scrise atomic în `POETIO_DATA_DIR/media-validation/v1/{audio|video}/{fileId}/{hash}/ready.json`. Marcajul include versiunea politicii, tipul, hashul, dimensiunea și caracteristicile fișierului local. Modificarea, înlocuirea sau dispariția fișierului invalidează folosirea marcajului. Cache-ul poate fi regenerat din originalele incluse în backup; nu cere migrare SQL.

Conținutul deja publicat nu este retras automat. Va fi verificat la următoarea salvare editorială, inclusiv dacă înregistrarea rămâne aceeași. Nu s-a făcut un audit al tuturor fișierelor din producție în această intervenție. Recuperarea unei schițe nu certifică fișierul asociat.

Implementarea de decodare este pentru runtime-ul Node/VPS. Worker-ul Cloudflare actual nu are binding `MEDIA_VALIDATOR`: uploadul și publicarea care implică audio/video sunt refuzate cu `503`. Poemele fără audio și servirea conținutului deja publicat rămân funcționale. Activarea publicării media pe Worker necesită un serviciu de verificare compatibil; nu există o acceptare implicită în lipsa lui.

## Instalarea la deploy

Verificările inițiale au folosit pachete FFmpeg extrase într-un director temporar. La publicarea din 28 septembrie au fost instalate în sistem `ffmpeg` și `ffprobe` 8.0.1-3ubuntu2, configurațiile Nginx au fost actualizate împreună, iar cele 83 de teste VPS au fost repetate cu utilizatorul `poetio` și decodoarele instalate. Cele 13 scenarii media HTTP/Chromium au trecut pe noul release, cu date temporare.

La publicarea pe VPS:

1. Instalează `ffmpeg` din distribuție și asigură disponibilitatea `ffprobe` și `prlimit` (`util-linux`) în mediul utilizatorului `poetio`.
2. Pregătește și verifică noul release și backupul, conform procedurii existente. Pentru această corecție media nu există migrare SQL; corecția anterioară a traducerilor necesită separat `0015` dacă nu a fost încă aplicată.
3. Instalează împreună configurațiile din `deploy/`: `poetio-proxy.conf` → `/etc/poetio/proxy.conf`, `poetio-app.conf` → `/etc/poetio/app.conf`, `nginx-audio-location.conf` → `/etc/poetio/audio-location.conf`, `nginx-video-location.conf` → `/etc/poetio/video-location.conf`. Limita implicită de 75 s se mută la nivel de server; uploadurile media și salvările administrative au 300 s pentru a acoperi verificarea a două înregistrări vechi. Copierea parțială poate duplica directiva Nginx.
4. Execută `nginx -t`, promovează buildul și reîncarcă serviciile. Verifică upload invalid/valid, păstrarea editorului și redarea publică folosind conținut demonstrativ autorizat.

```sh
command -v ffmpeg ffprobe prlimit
ffmpeg -version
ffprobe -version
npm run test:vps
```

Revenirea la codul anterior nu necesită eliminarea cache-ului. Totuși, reactivează publicarea fără decodare: suspendă publicarea media până la instalarea unui build corectat.

## Verificări efectuate

- **83/83 teste VPS**, cu decodoare reale pentru fișiere valide și deteriorate. Acoperă deteriorarea pachetelor spre finalul MP4-ului, refuzul înainte de stocare, publicarea/înlocuirea, cache-ul după repornire, fișierul modificat, limitele, concurența, lipsa verificatorului și recuperarea schițelor.
- **13 scenarii HTTP/Chromium**, pe bază și fișiere temporare: respingerea celor două probe din audit, redare efectivă WAV/MP3/M4A/OGG și MP4/WebM, byte ranges, păstrarea textului în editor, înlocuire reușită, referințe vechi și panoul de erori. Fără erori JavaScript.
- **1/1 test de integrare Worker**, inclusiv refuzul fără verificator la upload/publicare și verificarea audio păstrat de clienți vechi.
- TypeScript, ESLint pentru fișierele modificate, buildurile VPS/Worker și configurația Nginx izolată: reușite.

[Rezultate HTTP/browser](/var/www/Poetio/verificare-media-2026-09-28/rezultate.json), [script de reproducere](/var/www/Poetio/verificare-media-2026-09-28/verifica.mjs), [editor după refuz](/var/www/Poetio/verificare-media-2026-09-28/video-invalid-editor-pastrat.png), [amprentele surselor](/var/www/Poetio/verificare-media-2026-09-28/surse.json).

Referințe tehnice: [FFprobe — inspecția fluxurilor](https://ffmpeg.org/ffprobe.html), [FFmpeg — decodare, `xerror` și `abort_on`](https://ffmpeg.org/ffmpeg.html), [lista protocoalelor permise](https://ffmpeg.org/ffmpeg-protocols.html#Protocol-Options).
