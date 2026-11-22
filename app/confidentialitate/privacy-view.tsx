'use client';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, withSiteLanguage } from '@/lib/site-language';
import { addressLine, type PublicShop } from '@/lib/shop';
import { VISIT_IP_RETENTION_DAYS } from '@/lib/visits';
import ShopFrame, { useShopLanguage } from '../shop-frame';

// The privacy notice (GDPR art. 13). It describes what the site actually stores; keep it in step
// with lib/visits.ts (retention), the nginx log rotation (14 days) and the backup retention.
const UPDATED = { ro: '22 noiembrie 2026', en: '22 November 2026', fr: '22 novembre 2026' };
const LOG_DAYS = 14;
const BACKUP_DAYS = 30;

export default function PrivacyView({ initialLanguage, shop }: { initialLanguage: SiteLanguage; shop: PublicShop }) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
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
        <h1 className="shop-title">
          {pick(language, 'Nota de confidențialitate', 'Privacy notice', 'Politique de confidentialité')}
        </h1>
        {language === 'ro' ? (
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
        ) : language === 'fr' ? (
          <>
            <p>
              Quelles données personnelles Poetio (poetio.cloud) traite, pourquoi, combien de temps nous les conservons
              et quels sont vos droits. Dernière mise à jour&nbsp;: {UPDATED.fr}.
            </p>
            <h2 id="operator">Responsable du traitement</h2>
            <p>
              Le responsable du traitement est <strong>{controller}</strong>.{email && <> Écrivez-nous à {email}</>}
              {phone && (
                <>
                  {email ? ' ou appelez le ' : ' Appelez le '}
                  {phone}
                </>
              )}
              {(email || phone) && '.'}
            </p>
            <h2 id="date">Quelles données et pourquoi</h2>
            <ul>
              <li>
                <strong>Commandes de livres.</strong> Vos nom, adresse de livraison, téléphone, e-mail et remarques,
                pour livrer les livres, établir les documents de paiement et vous écrire au sujet de la commande. La
                base légale est le contrat (art. 6, paragraphe 1, point b du RGPD) et nos obligations comptables (point
                c). Nous les conservons le temps nécessaire à la commande, puis aussi longtemps que l’exige la
                législation comptable et fiscale.
              </li>
              <li>
                <strong>Commentaires.</strong> Le nom que vous saisissez et le texte du commentaire. Ils ne deviennent
                publics qu’après validation. La base légale est votre consentement (point a)&nbsp;; nous les supprimons
                dès que vous le demandez.
              </li>
              <li id="vizite">
                <strong>Statistiques de visite.</strong> Pour chaque page ouverte, nous conservons l’adresse IP, la
                page, l’heure, le navigateur et la localité approximative déduite de l’IP, afin de savoir ce qui est lu
                et de protéger le site contre les abus. La base légale est notre intérêt légitime (point f). Aucun
                cookie n’est utilisé pour cela. L’adresse IP et les données du navigateur sont supprimées après{' '}
                {VISIT_IP_RETENTION_DAYS}&nbsp;jours&nbsp;; seuls restent le nombre de visites, les pages et les
                localités.
              </li>
              <li>
                <strong>Journaux du serveur.</strong> Adresse IP, adresse demandée, heure et navigateur, pour la
                sécurité et le dépannage (intérêt légitime, point f). Supprimés automatiquement après {LOG_DAYS}
                &nbsp;jours.
              </li>
              <li>
                <strong>Sauvegardes.</strong> Elles contiennent les données ci-dessus, sont chiffrées et sont supprimées
                automatiquement après {BACKUP_DAYS}&nbsp;jours au plus.
              </li>
            </ul>
            <p>Nous ne prenons aucune décision automatisée vous concernant et ne faisons pas de profilage.</p>
            <h2 id="destinatari">Qui d’autre reçoit les données</h2>
            <ul>
              <li>Le transporteur reçoit votre nom, votre adresse et votre téléphone pour livrer le colis.</li>
              <li>Le serveur du site est loué à Amazon Web Services, dans l’Union européenne (Francfort).</li>
              <li>
                Google envoie les e-mails de confirmation de commande (Gmail) et conserve une copie chiffrée de la
                sauvegarde (Google Drive), qu’il ne peut pas lire. Google peut traiter des données hors de l’Espace
                économique européen, avec les garanties exigées par le RGPD (cadre de protection des données
                UE–États-Unis).
              </li>
            </ul>
            <p>
              Nous ne vendons pas de données, ne faisons pas de publicité et n’utilisons pas de services d’analyse ou de
              publicité d’autres entreprises. La localité est déterminée à partir d’une base de données conservée sur le
              serveur (DB-IP), sans transmettre votre adresse IP à qui que ce soit.
            </p>
            <h2 id="browser">Ce que conserve votre navigateur</h2>
            <p>
              Le site n’utilise aucun cookie de suivi ou de publicité. Pour fonctionner, il conserve dans votre
              navigateur la langue choisie (le cookie <code>poetio-language</code>, un an, envoyé au serveur uniquement
              pour afficher cette langue), le thème clair ou sombre, les préférences de lecture, votre page dans un
              livre, le panier et les brouillons de commentaires. Ces données ne nous parviennent qu’avec une commande
              ou un commentaire que vous envoyez. Vous pouvez les effacer à tout moment dans les réglages du navigateur.
            </p>
            <h2 id="drepturi">Vos droits</h2>
            <p>
              Vous pouvez demander l’accès à vos données, leur rectification, leur effacement ou la limitation de leur
              traitement, les recevoir dans un format portable et vous opposer au traitement fondé sur notre intérêt
              légitime. Vous pouvez retirer à tout moment votre consentement pour les commentaires. Écrivez-nous
              {email && <> à {email}</>}&nbsp;; nous répondons sous un mois. Vous pouvez aussi introduire une
              réclamation auprès de l’autorité roumaine de protection des données ({authority}).
            </p>
            <p>
              Les conditions de vente figurent dans les <a href={terms}>conditions générales de vente</a>.
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
