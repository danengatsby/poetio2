**Backup local automat și restaurare**

Serviciul `poetio-backup.timer` programează zilnic backupul între 03:15 și 03:25 UTC. `Persistent=true` recuperează o rulare omisă cât timp serverul a fost oprit. Sunt păstrate ultimele 14 copii finalizate și verificate, exclusiv în `/var/backups/poetio/automatic`, accesibil root. Backupurile manuale existente nu sunt șterse de această retenție.

Arhivele sunt criptate AES-256 cu GnuPG. Cheia este `/etc/poetio/backup.key`, cu permisiuni 0600; nu este inclusă în arhive. Păstrarea unei copii a cheii separat de VPS este necesară pentru recuperare după pierderea serverului. Destinația externă a fost amânată de proprietar; configurația actuală oferă backup local.

Fiecare rulare:

1. Face un snapshot online prin API-ul SQLite, inclusiv datele comise în WAL, fără oprirea serviciului.
2. Copiază toate obiectele media înregistrate în snapshot, inclusiv fișierele detașate, și le compară dimensiunea/hashul cu baza. Fișierele încărcate după snapshot vor intra în backupul următor.
3. Include versiunea activă completă din `current` cu build și `node_modules`, sursele editabile și configurația Poetio. Include certificatul domeniului Poetio; certificatul comun al adresei IP trebuie administrat separat. Cache-ul regenerabil al paginilor PDF este omis.
4. Comprimă și criptează în flux, elimină snapshotul intermediar, restaurează într-un director temporar și verifică manifestul SHA-256, integritatea SQLite, cheile externe și conținutul media.
5. Pornește aplicația restaurată pe un port local temporar, cu baza restaurată și fără cheile API din producție. Verifică paginile și prezența înregistrărilor, refuzul administrării anonime, randarea primei pagini de carte și protecția PDF-ului original.
6. Publică arhiva și `last-success.json` numai după reușită; abia apoi aplică retenția. La eșec, copiile valide anterioare rămân disponibile, iar serviciul raportează eroarea în journal/systemd.

Verificare operațională, ca root:

```sh
systemctl list-timers poetio-backup.timer
systemctl status poetio-backup.service
cat /var/backups/poetio/automatic/last-success.json
journalctl -u poetio-backup.service -n 30
```

Rulare manuală prin același serviciu:

```sh
systemctl start poetio-backup.service
```

Restaurare de probă, într-un director care **nu există încă**:

```sh
/usr/local/sbin/poetio-backup verify \
  --archive /var/backups/poetio/automatic/poetio-YYYYMMDDTHHMMSSZ.tar.gz.gpg \
  --restore-dir /var/backups/poetio/restaurare-verificata
```

Comanda verifică integritatea și pornește temporar aplicația restaurată; nu modifică serviciul sau baza activă. Directorul rezultat conține date sensibile decriptate și trebuie să rămână privat. Necesită Python cu suport `tarfile` pentru filtrul `data`, GnuPG, Node compatibil cu versiunea arhivată, `pdfinfo` și `pdftoppm`. Necesarul de spațiu pentru creare este calculat înaintea copierii și include o rezervă implicită de 512 MiB; la restaurarea separată trebuie asigurat spațiul pentru conținutul extras.

Pentru recuperarea serviciului după un incident:

1. Verifică/dezarhivează copia prin comanda de mai sus. Inspectează `manifest.json` și rezultatul verificărilor.
2. Oprește `poetio`; păstrează baza/directorul curent într-o copie separată. Nu suprascrie o bază SQLite deschisă și nu combina fișiere WAL vechi cu baza restaurată.
3. Copiază `data/` într-un director nou destinat `/var/lib/poetio`, cu proprietar `poetio:poetio`, directoare 0700 și fișiere 0600.
4. Copiază `runtime/` într-un director nou din `/var/www/Poetio/releases/`. Setează proprietar `root:poetio`, directoare 0750 și fișiere 0640; păstrează execuția pentru fișierele enumerate în `manifest.json.executables` aferente `runtime/`, inclusiv binarele native.
5. Restaurează atent configurația din `config/` în locațiile corespunzătoare. Cheia backupului vine din copia separată. Corectează căile certificatului sau reemite certificatul dacă s-a schimbat serverul.
6. Actualizează atomic legătura `current` către versiunea restaurată, verifică Nginx și unitatea systemd, apoi pornește serviciul. Verifică site-ul HTTPS și autentificarea înainte de reluarea editării.

Backupul nu transmite notificări prin email sau alte servicii. `last-success.json` și starea unității sunt punctele de verificare; integrarea cu monitorizare externă poate fi adăugată separat.

**Remedierea consumului temporar de spațiu — 5 noiembrie 2026**

Crearea arhivei comprimă și criptează într-un flux, fără un fișier tar.gz necriptat pe disc. Snapshotul temporar este eliminat după criptare, înaintea restaurării de verificare. Restaurarea decriptează și extrage în flux și verifică finalizarea autentificată GPG, manifestul, SQLite, media și răspunsurile HTTP înaintea publicării arhivei și a indicatorului `last-success.json`. Arhivele existente rămân compatibile.

Înaintea snapshotului, scriptul estimează spațiul pentru date, surse, runtime, antetele arhivei și o rezervă de 512 MiB. Dacă spațiul nu ajunge, operația se oprește înaintea copierii și păstrează ultima reușită. Rezerva poate fi configurată prin `--reserve-mib`; rotația arhivelor verificate rămâne după noua verificare reușită. Estimarea nu rezervă fizic spațiul împotriva altor procese.

Instalează scriptul actualizat ca `/usr/local/sbin/poetio-backup` și rulează serviciul `poetio-backup.service`. Confirmă starea finală și o arhivă nouă verificată prin restaurare; un timer activ singur nu confirmă reușita. Testele Python includ lipsa spațiului, compatibilitatea arhivelor, fluxul fără copii intermediare, text cifrat trunchiat și păstrarea ultimei reușite la eșec.
