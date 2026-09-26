# Lectura cărților pe telefon

Cititorul afișează o pagină pe ecrane de până la 760 px și pe dispozitive tactile în orientare landscape cu înălțimea de până la 600 px. Desktopul păstrează două pagini alăturate. Rotirea ecranului păstrează pagina exactă selectată, inclusiv o pagină pară.

Pe telefon există o singură bară compactă, care rămâne vizibilă în timpul lecturii: pagina anterioară, număr de pagină și salt direct, pagina următoare, mărire/potrivire. Controalele au minimum 44×44 px și etichete accesibile în română și engleză. Săgețile laterale și bara duplicată de jos sunt ascunse, iar pagina folosește întreaga lățime disponibilă. Mărirea derulează imaginea în interiorul cititorului, fără a lărgi pagina web.

Pagina citită se memorează în `localStorage`, separat pentru fiecare fișier PDF: `poetio:book-position:v1:<fileId>`. Reluarea este automată la redeschiderea aceleiași cărți în același browser. O versiune nouă a PDF-ului, cu alt identificator, începe de la pagina 1. Datele deteriorate sunt ignorate, iar pozițiile care depășesc totalul sunt limitate la ultima pagină.

Poziția se salvează după încărcarea imaginii paginii. O pagină care nu s-a încărcat nu suprascrie poziția anterioară; reîncercarea rămâne la pagina solicitată. Schimbarea limbii sau a temei nu resetează lectura. Dacă browserul blochează stocarea, navigarea funcționează în continuare și cititorul afișează un mesaj. Poziția nu se sincronizează între dispozitive și se pierde dacă utilizatorul șterge datele site-ului.

Fișierele originale, protecția PDF-ului, colecția și comentariile nu sunt modificate. Nu există migrare de bază de date. Activarea/revenirea se face prin release-ul aplicației și repornirea serviciului `poetio`.

Verificări: 42 de teste automate; TypeScript și ESLint pentru cititor și logica poziției; browser la 320, 390, 760 px, telefon landscape și desktop. Scenariile acoperă încărcarea unei singure pagini pe telefon, reluarea unei pagini pare fără cerere pentru pagina 1, rotația, ultima pagină, zoom, controale pe un singur rând, eroare de încărcare și reîncercare, limbă/temă și stocare blocată.
