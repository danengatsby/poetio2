'use client';
import type { PoemLanguage } from '@/lib/poem-types';
import { withSiteLanguage } from '@/lib/site-language';
import { addressLine, type PublicShop } from '@/lib/shop';
import { VISIT_IP_RETENTION_DAYS } from '@/lib/visits';
import ShopFrame, { useShopLanguage } from '../shop-frame';

// The privacy notice (GDPR art. 13). It describes what the site actually stores; keep it in step
// with lib/visits.ts (retention), the nginx log rotation (14 days) and the backup retention.
const UPDATED = { ro: '22 noiembrie 2026', en: '22 November 2026' };
const LOG_DAYS = 14;
const BACKUP_DAYS = 30;

export default function PrivacyView({ initialLanguage, shop }: { initialLanguage: PoemLanguage; shop: PublicShop }) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const ro = language === 'ro';
  const controller = [shop.seller_name || 'Poetio', addressLine(shop.seller_address)].filter(Boolean).join(', ');
  const email = shop.contact_email ? <a href={`mailto:${shop.contact_email}`}>{shop.contact_email}</a> : null;
  const phone = shop.contact_phone || '';
  const terms = withSiteLanguage('/termeni', language);
  const authority = (
    <a href="https://www.dataprotection.ro" rel="noopener noreferrer">
      dataprotection.ro
    </a>
  );

  return (
    <ShopFrame language={language} onLanguageChange={changeLanguage}>
      <article className="shop-document">
        <h1 className="shop-title">{ro ? 'Nota de confidențialitate' : 'Privacy notice'}</h1>
        {ro ? (
          <>
            <p>
              Ce date personale prelucrează Poetio (poetio.cloud), de ce, cât timp le păstrăm și ce drepturi ai. Ultima
              actualizare: {UPDATED.ro}.
            </p>
            <h2 id="operator">Cine răspunde de date</h2>
            <p>
              Operatorul datelor este <strong>{controller}</strong>.{email && <> Ne scrii la {email}</>}
              {phone && (
                <>
                  {email ? ' sau ne suni la ' : ' Ne suni la '}
                  {phone}
                </>
              )}
              {(email || phone) && '.'}
            </p>
            <h2 id="date">Ce date folosim și de ce</h2>
            <ul>
              <li>
                <strong>Comenzile de cărți.</strong> Numele, adresa de livrare, telefonul, emailul și observațiile tale,
                ca să livrăm cărțile, să emitem documentele de plată și să îți scriem despre comandă. Temeiul este
                contractul (art. 6 alin. 1 lit. b din GDPR) și obligațiile legale de evidență contabilă (lit. c). Le
                păstrăm cât e nevoie pentru comandă și apoi cât cere legislația contabilă și fiscală.
              </li>
              <li>
                <strong>Comentariile.</strong> Numele pe care îl scrii și textul comentariului. Apar public numai după
                aprobare. Temeiul este consimțământul tău (lit. a); le ștergem oricând ne ceri.
              </li>
              <li id="vizite">
                <strong>Statistica vizitelor.</strong> La fiecare pagină deschisă păstrăm adresa IP, pagina, ora,
                browserul și localitatea aproximativă dedusă din IP, ca să știm ce se citește și să protejăm site-ul de
                abuzuri. Temeiul este interesul nostru legitim (lit. f). Nu folosim cookie-uri pentru asta. Adresa IP și
                datele browserului se șterg după {VISIT_IP_RETENTION_DAYS} de zile; rămân doar numărul vizitelor,
                paginile și localitatea.
              </li>
              <li>
                <strong>Jurnalele serverului.</strong> Adresa IP, adresa paginii cerute, ora și browserul, pentru
                securitate și depanare (interes legitim, lit. f). Se șterg automat după {LOG_DAYS} zile.
              </li>
              <li>
                <strong>Copiile de siguranță.</strong> Conțin datele de mai sus, sunt criptate și se șterg automat după
                cel mult {BACKUP_DAYS} de zile.
              </li>
            </ul>
            <p>Nu luăm decizii automate despre tine și nu facem profiluri.</p>
            <h2 id="destinatari">Cine mai primește datele</h2>
            <ul>
              <li>Firma de curierat primește numele, adresa și telefonul, ca să livreze coletul.</li>
              <li>Serverul site-ului este închiriat de la Amazon Web Services, în Uniunea Europeană (Frankfurt).</li>
              <li>
                Google trimite emailurile de confirmare a comenzii (Gmail) și păstrează o copie criptată a backupului
                (Google Drive), pe care nu o poate citi. Google poate prelucra date și în afara Spațiului Economic
                European, cu garanțiile cerute de GDPR (cadrul UE–SUA privind protecția datelor).
              </li>
            </ul>
            <p>
              Nu vindem datele, nu facem publicitate și nu folosim servicii de analiză sau de reclame ale altor firme.
              Localitatea se află dintr-o bază de date ținută pe server (DB-IP), fără să trimitem adresa IP altcuiva.
            </p>
            <h2 id="browser">Ce se păstrează în browserul tău</h2>
            <p>
              Site-ul nu folosește cookie-uri de urmărire sau de publicitate. Pentru funcționare păstrează în browserul
              tău limba aleasă (cookie-ul <code>poetio-language</code>, un an, trimis serverului doar ca să afișeze
              limba potrivită), tema deschisă sau închisă, preferințele de lectură, locul unde ai rămas într-o carte,
              coșul de cumpărături și ciornele comentariilor. Acestea nu ajung la noi decât odată cu comanda sau
              comentariul pe care le trimiți. Le poți șterge oricând din setările browserului.
            </p>
            <h2 id="drepturi">Drepturile tale</h2>
            <p>
              Poți cere accesul la datele tale, corectarea, ștergerea sau restricționarea lor, le poți primi într-un
              format portabil și te poți opune prelucrării bazate pe interesul nostru legitim. Consimțământul pentru
              comentarii îl poți retrage oricând. Scrie-ne{email && <> la {email}</>}; răspundem în cel mult o lună. Te
              poți plânge și la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (
              {authority}).
            </p>
            <p>
              Condițiile de vânzare sunt în <a href={terms}>termeni și condiții</a>.
            </p>
          </>
        ) : (
          <>
            <p>
              What personal data Poetio (poetio.cloud) processes, why, how long we keep it and your rights. Last
              updated: {UPDATED.en}.
            </p>
            <h2 id="operator">Who is responsible</h2>
            <p>
              The data controller is <strong>{controller}</strong>.{email && <> Write to {email}</>}
              {phone && (
                <>
                  {email ? ' or call ' : ' Call '}
                  {phone}
                </>
              )}
              {(email || phone) && '.'}
            </p>
            <h2 id="date">What we use and why</h2>
            <ul>
              <li>
                <strong>Book orders.</strong> Your name, delivery address, phone, email and notes, to deliver the books,
                issue payment documents and write to you about the order. The legal basis is the contract (GDPR art.
                6(1)(b)) and our accounting obligations (c). We keep them as long as the order needs and then as long as
                accounting and tax law requires.
              </li>
              <li>
                <strong>Comments.</strong> The name you type and your comment. They become public only after approval.
                The legal basis is your consent (a); we delete them whenever you ask.
              </li>
              <li id="vizite">
                <strong>Visit statistics.</strong> For each page you open we keep your IP address, the page, the time,
                your browser and the approximate town derived from the IP, to know what is read and to protect the site
                from abuse. The legal basis is our legitimate interest (f). No cookies are used for this. The IP address
                and browser details are deleted after {VISIT_IP_RETENTION_DAYS} days; only visit counts, pages and towns
                remain.
              </li>
              <li>
                <strong>Server logs.</strong> IP address, requested address, time and browser, for security and
                troubleshooting (legitimate interest, f). Deleted automatically after {LOG_DAYS} days.
              </li>
              <li>
                <strong>Backups.</strong> They contain the data above, are encrypted and are deleted automatically after
                at most {BACKUP_DAYS} days.
              </li>
            </ul>
            <p>We make no automated decisions about you and do no profiling.</p>
            <h2 id="destinatari">Who else receives data</h2>
            <ul>
              <li>The courier receives your name, address and phone to deliver the parcel.</li>
              <li>The site’s server is rented from Amazon Web Services, in the European Union (Frankfurt).</li>
              <li>
                Google sends the order confirmation emails (Gmail) and keeps an encrypted copy of the backup (Google
                Drive), which it cannot read. Google may process data outside the European Economic Area under the
                safeguards GDPR requires (the EU–US Data Privacy Framework).
              </li>
            </ul>
            <p>
              We do not sell data, show advertising or use other companies’ analytics or advertising services. The town
              is looked up in a database kept on the server (DB-IP), without sending your IP address to anyone.
            </p>
            <h2 id="browser">What your browser keeps</h2>
            <p>
              The site uses no tracking or advertising cookies. To work, it keeps in your browser the language you chose
              (the <code>poetio-language</code> cookie, one year, sent to the server only to show that language), the
              light or dark theme, reading preferences, your place in a book, the shopping cart and comment drafts. They
              reach us only with an order or comment you send. You can clear them at any time in your browser settings.
            </p>
            <h2 id="drepturi">Your rights</h2>
            <p>
              You may ask to access, correct, delete or restrict your data, receive it in a portable format, and object
              to processing based on our legitimate interest. You may withdraw consent for comments at any time. Write
              to us{email && <> at {email}</>}; we answer within one month. You may also complain to Romania’s data
              protection authority ({authority}).
            </p>
            <p>
              The conditions of sale are in the <a href={terms}>terms and conditions</a>.
            </p>
          </>
        )}
      </article>
    </ShopFrame>
  );
}
