**Actualizarea dependențelor și backupului — 14 septembrie 2026**

Versiunea publicată este `/var/www/Poetio/releases/20260914T152454Z-security`, accesată prin legătura `/var/www/Poetio/current`. Fiecare versiune păstrează propriul build și propriile dependențe; serviciul nu mai depinde de `sursa/node_modules`.

| Componentă | Anterior | Actualizat |
| --- | --- | --- |
| React / React DOM / React Server DOM | 19.2.6 | 19.2.8 |
| Copia RSC inclusă în plugin | 19.2.6 | 19.2.8 |
| `@vitejs/plugin-rsc` | 0.5.26 | 0.5.34 |
| `@vitejs/plugin-react` | 6.0.2 | 6.1.1 |
| Vinext | 0.0.50 | 1.0.0-beta.9 |
| Vite | 8.0.13 | 8.3.0 |
| Next / eslint-config-next | 16.2.6 | 16.3.5 |
| sharp | 0.34.5 | 0.35.4 |
| Cloudflare Vite plugin | 1.37.1 | 1.54.9 |
| Wrangler | 4.92.0 | 4.131.2 |

`npm audit` pentru arborele actualizat: **zero alerte**. Au fost actualizate și dependențele tranzitive compatibile. `drizzle-kit` rămâne 0.31.10; dependența veche `esbuild` din `@esbuild-kit/core-utils` este suprascrisă explicit la 0.25.12. Această suprascriere elimină dependența afectată fără retrogradarea generatorului. Generarea unei migrări dintr-o schemă TypeScript temporară a fost verificată cu succes. Reevaluează suprascrierea când Drizzle înlocuiește acest loader.

`npm run verify:security` verifică React, React DOM, dependența RSC și copia inclusă în plugin; compilarea VPS o execută automat. Verificarea refuză versiuni anterioare 19.2.8, pre-release-uri și versiuni nealiniate. Controlul acoperă regresia acestui aviz; nu înlocuiește auditul regulat al noilor avize.

Validare: build VPS reușit, TypeScript fără erori, 35 de teste Node și 4 teste pentru backup trecute. Testele backupului verifică includerea WAL, respingerea media lipsă/corupte, criptarea/decriptarea și detectarea alterării, respectiv refuzul legăturilor externe. Testele HTTP și browser pe o copie a bazei au acoperit creare/editare/ștergere poeme, video, cărți și comentarii, conflicte de revizie, intervale video și protecția PDF. Paginile publice și administrarea au fost verificate pe copia izolată; pe HTTPS s-au efectuat doar citiri și interacțiuni de navigare. Conținutul bazei nu s-a schimbat la publicare.

Backupul este documentat în [BACKUP-VPS.md](BACKUP-VPS.md). Copia inițială a trecut decriptarea, verificarea hashurilor și pornirea aplicației restaurate înainte de publicare. Programarea finală și rezultatul ultimei rulări se verifică prin `systemctl list-timers poetio-backup.timer` și `/var/backups/poetio/automatic/last-success.json`.

Rularea în unitatea systemd, cu restricțiile configurate, s-a încheiat cu `Result=success` la 15:43:23 UTC. Arhiva `poetio-20260914T154022Z.tar.gz.gpg` a trecut toate verificările și pornirea aplicației restaurate. Timerul este activ și activat la boot; următoarea rulare programată la momentul verificării este 15 septembrie 2026, 03:19:02 UTC. Această copie a surprins și un director temporar de dependențe vechi în surse în timpul sincronizării; directorul a fost mutat în backupul privat anterior, iar copiile viitoare exclud explicit `node_modules*` din surse. Runtime-ul arhivat are dependențele actualizate și complete.

Versiunea de revenire este `/var/www/Poetio/releases/20260914T152454Z-previous`. Pentru revenirea exclusivă a codului și dependențelor, ca root:

```sh
ln -s /var/www/Poetio/releases/20260914T152454Z-previous /var/www/Poetio/current.rollback
mv -Tf /var/www/Poetio/current.rollback /var/www/Poetio/current
systemctl restart poetio
```

Revenirea nu modifică baza; această actualizare nu aplică migrări. Versiunea anterioară conține dependențele cu alerte și trebuie folosită numai ca măsură temporară dacă este necesară.

Sursele și modificările preexistente au fost păstrate; nu s-au creat commituri care să amestece lucrările anterioare cu această actualizare. Snapshotul de dinaintea intervenției este în `/var/backups/poetio/before-security-20260914T152454Z`, privat pentru root. Fișierul de credențiale nu a fost afișat.
