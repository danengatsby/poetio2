'use client';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, withSiteLanguage } from '@/lib/site-language';
import { addressLine, type PublicShop } from '@/lib/shop';
import { VISIT_IP_RETENTION_DAYS } from '@/lib/visits';
import ShopFrame, { useShopLanguage } from '../shop-frame';

// The privacy notice (GDPR art. 13). It describes what the site actually stores; keep it in step
// with lib/visits.ts (retention), the nginx log rotation (14 days) and the backup retention.
const UPDATED = {
  ro: '22 noiembrie 2026',
  en: '22 November 2026',
  fr: '22 novembre 2026',
  de: '22. November 2026',
  es: '22 de noviembre de 2026',
  it: '22 novembre 2026',
};
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
          {pick(
            language,
            'Nota de confidențialitate',
            'Privacy notice',
            'Politique de confidentialité',
            'Datenschutzerklärung',
            'Política de privacidad',
            'Informativa sulla privacy',
          )}
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
                identificatorul comun între sesiuni și descrierea brută a browserului se șterg după{' '}
                {VISIT_IP_RETENTION_DAYS} de zile; păstrăm sesiunile, paginile și orele, locul aproximativ, sursa, limba
                și categoriile de dispozitiv, sistem și browser.
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
                {VISIT_IP_RETENTION_DAYS}&nbsp;jours&nbsp;; restent les sessions, les pages et horaires, le lieu
                approximatif, la source, la langue et les catégories d’appareil, de système et de navigateur.
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
        ) : language === 'de' ? (
          <>
            <p>
              Welche personenbezogenen Daten Poetio (poetio.cloud) verarbeitet, warum, wie lange wir sie speichern und
              welche Rechte Sie haben. Stand: {UPDATED.de}.
            </p>
            <h2 id="operator">Verantwortlicher</h2>
            <p>
              Verantwortlich für die Datenverarbeitung ist <strong>{controller}</strong>.
              {email && <> Schreiben Sie uns an {email}</>}
              {phone && (
                <>
                  {email ? ' oder rufen Sie an unter ' : ' Rufen Sie an unter '}
                  {phone}
                </>
              )}
              {(email || phone) && '.'}
            </p>
            <h2 id="date">Welche Daten und wozu</h2>
            <ul>
              <li>
                <strong>Buchbestellungen.</strong> Ihr Name, Ihre Lieferadresse, Telefonnummer, E-Mail und Anmerkungen,
                um die Bücher zu liefern, Zahlungsbelege auszustellen und Ihnen zur Bestellung zu schreiben.
                Rechtsgrundlage sind der Vertrag (Art. 6 Abs. 1 lit. b DSGVO) und unsere buchhalterischen Pflichten
                (lit. c). Wir speichern sie, solange die Bestellung es erfordert, und danach so lange, wie es das
                Buchhaltungs- und Steuerrecht verlangt.
              </li>
              <li>
                <strong>Kommentare.</strong> Der Name, den Sie eingeben, und der Text des Kommentars. Sie werden erst
                nach Freigabe öffentlich. Rechtsgrundlage ist Ihre Einwilligung (lit. a); wir löschen sie jederzeit auf
                Ihre Anfrage.
              </li>
              <li id="vizite">
                <strong>Besuchsstatistik.</strong> Für jede geöffnete Seite speichern wir die IP-Adresse, die Seite, die
                Uhrzeit, den Browser und den aus der IP abgeleiteten ungefähren Ort, um zu wissen, was gelesen wird, und
                um die Website vor Missbrauch zu schützen. Rechtsgrundlage ist unser berechtigtes Interesse (lit. f).
                Dafür werden keine Cookies verwendet. IP-Adresse und Browserdaten werden nach {VISIT_IP_RETENTION_DAYS}{' '}
                Tagen gelöscht; erhalten bleiben Sitzungen, Seiten, Zeiten, ungefähre Orte, Herkunft, Sprache sowie
                Geräte-, System- und Browserkategorien.
              </li>
              <li>
                <strong>Serverprotokolle.</strong> IP-Adresse, aufgerufene Adresse, Uhrzeit und Browser, für Sicherheit
                und Fehlersuche (berechtigtes Interesse, lit. f). Sie werden nach {LOG_DAYS} Tagen automatisch gelöscht.
              </li>
              <li>
                <strong>Sicherungskopien.</strong> Sie enthalten die oben genannten Daten, sind verschlüsselt und werden
                nach höchstens {BACKUP_DAYS} Tagen automatisch gelöscht.
              </li>
            </ul>
            <p>Wir treffen keine automatisierten Entscheidungen über Sie und erstellen keine Profile.</p>
            <h2 id="destinatari">Wer die Daten noch erhält</h2>
            <ul>
              <li>Der Kurierdienst erhält Ihren Namen, Ihre Adresse und Telefonnummer, um das Paket zuzustellen.</li>
              <li>
                Der Server der Website wird bei Amazon Web Services in der Europäischen Union (Frankfurt) gemietet.
              </li>
              <li>
                Google versendet die Bestellbestätigungen (Gmail) und bewahrt eine verschlüsselte Kopie der Sicherung
                auf (Google Drive), die es nicht lesen kann. Google kann Daten auch außerhalb des Europäischen
                Wirtschaftsraums verarbeiten, mit den von der DSGVO verlangten Garantien (EU-US-Datenschutzrahmen).
              </li>
            </ul>
            <p>
              Wir verkaufen keine Daten, schalten keine Werbung und nutzen keine Analyse- oder Werbedienste anderer
              Unternehmen. Der Ort wird über eine auf dem Server gespeicherte Datenbank (DB-IP) ermittelt, ohne Ihre
              IP-Adresse an jemanden weiterzugeben.
            </p>
            <h2 id="browser">Was Ihr Browser speichert</h2>
            <p>
              Die Website verwendet keine Tracking- oder Werbe-Cookies. Damit sie funktioniert, speichert sie in Ihrem
              Browser die gewählte Sprache (das Cookie <code>poetio-language</code>, ein Jahr, das nur an den Server
              gesendet wird, um diese Sprache anzuzeigen), das helle oder dunkle Design, die Leseeinstellungen, Ihre
              Stelle in einem Buch, den Warenkorb und Kommentarentwürfe. Diese Daten erreichen uns nur mit einer
              Bestellung oder einem Kommentar, die Sie absenden. Sie können sie jederzeit in den Browsereinstellungen
              löschen.
            </p>
            <h2 id="drepturi">Ihre Rechte</h2>
            <p>
              Sie können Auskunft über Ihre Daten, deren Berichtigung, Löschung oder die Einschränkung der Verarbeitung
              verlangen, sie in einem übertragbaren Format erhalten und der Verarbeitung auf Grundlage unseres
              berechtigten Interesses widersprechen. Ihre Einwilligung für Kommentare können Sie jederzeit widerrufen.
              Schreiben Sie uns{email && <> an {email}</>}; wir antworten innerhalb eines Monats. Sie können sich auch
              bei der rumänischen Datenschutzbehörde beschweren ({authority}).
            </p>
            <p>
              Die Verkaufsbedingungen finden Sie in den <a href={terms}>Allgemeinen Geschäftsbedingungen</a>.
            </p>
          </>
        ) : language === 'es' ? (
          <>
            <p>
              Qué datos personales trata Poetio (poetio.cloud), por qué, durante cuánto tiempo los guardamos y cuáles
              son tus derechos. Última actualización: {UPDATED.es}.
            </p>
            <h2 id="operator">Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos es <strong>{controller}</strong>.
              {email && <> Escríbenos a {email}</>}
              {phone && (
                <>
                  {email ? ' o llama al ' : ' Llama al '}
                  {phone}
                </>
              )}
              {(email || phone) && '.'}
            </p>
            <h2 id="date">Qué datos usamos y para qué</h2>
            <ul>
              <li>
                <strong>Pedidos de libros.</strong> Tu nombre, dirección de entrega, teléfono, correo electrónico y
                observaciones, para entregar los libros, emitir los documentos de pago y escribirte sobre el pedido. La
                base jurídica es el contrato (art. 6, apartado 1, letra b del RGPD) y nuestras obligaciones contables
                (letra c). Los conservamos el tiempo que requiera el pedido y después el que exija la normativa contable
                y fiscal.
              </li>
              <li>
                <strong>Comentarios.</strong> El nombre que escribes y el texto del comentario. Solo se publican tras su
                aprobación. La base jurídica es tu consentimiento (letra a); los borramos en cuanto nos lo pidas.
              </li>
              <li id="vizite">
                <strong>Estadísticas de visitas.</strong> Por cada página abierta guardamos la dirección IP, la página,
                la hora, el navegador y la localidad aproximada deducida de la IP, para saber qué se lee y proteger el
                sitio de abusos. La base jurídica es nuestro interés legítimo (letra f). No se usan cookies para ello.
                La dirección IP y los datos del navegador se borran a los {VISIT_IP_RETENTION_DAYS} días; se conservan
                sesiones, páginas, horas, ubicación aproximada, origen, idioma y categorías de dispositivo, sistema y
                navegador.
              </li>
              <li>
                <strong>Registros del servidor.</strong> Dirección IP, dirección solicitada, hora y navegador, por
                seguridad y para resolver problemas (interés legítimo, letra f). Se borran automáticamente a los{' '}
                {LOG_DAYS} días.
              </li>
              <li>
                <strong>Copias de seguridad.</strong> Contienen los datos anteriores, están cifradas y se borran
                automáticamente como máximo a los {BACKUP_DAYS} días.
              </li>
            </ul>
            <p>No tomamos decisiones automatizadas sobre ti ni elaboramos perfiles.</p>
            <h2 id="destinatari">Quién más recibe los datos</h2>
            <ul>
              <li>La empresa de mensajería recibe tu nombre, dirección y teléfono para entregar el paquete.</li>
              <li>El servidor del sitio está alquilado a Amazon Web Services, en la Unión Europea (Fráncfort).</li>
              <li>
                Google envía los correos de confirmación de pedido (Gmail) y guarda una copia cifrada de la copia de
                seguridad (Google Drive), que no puede leer. Google puede tratar datos fuera del Espacio Económico
                Europeo, con las garantías que exige el RGPD (Marco de Privacidad de Datos UE-EE. UU.).
              </li>
            </ul>
            <p>
              No vendemos datos, no mostramos publicidad ni usamos servicios de análisis o de publicidad de otras
              empresas. La localidad se obtiene de una base de datos guardada en el servidor (DB-IP), sin enviar tu
              dirección IP a nadie.
            </p>
            <h2 id="browser">Qué guarda tu navegador</h2>
            <p>
              El sitio no usa cookies de seguimiento ni de publicidad. Para funcionar, guarda en tu navegador el idioma
              elegido (la cookie <code>poetio-language</code>, un año, que se envía al servidor solo para mostrar ese
              idioma), el tema claro u oscuro, las preferencias de lectura, el punto en que te quedaste en un libro, el
              carrito y los borradores de comentarios. Estos datos solo nos llegan con un pedido o un comentario que
              envíes. Puedes borrarlos cuando quieras en los ajustes del navegador.
            </p>
            <h2 id="drepturi">Tus derechos</h2>
            <p>
              Puedes pedir el acceso a tus datos, su rectificación, supresión o la limitación de su tratamiento,
              recibirlos en un formato portable y oponerte al tratamiento basado en nuestro interés legítimo. Puedes
              retirar en cualquier momento tu consentimiento para los comentarios. Escríbenos{email && <> a {email}</>};
              respondemos en un plazo máximo de un mes. También puedes presentar una reclamación ante la autoridad
              rumana de protección de datos ({authority}).
            </p>
            <p>
              Las condiciones de venta están en los <a href={terms}>términos y condiciones</a>.
            </p>
          </>
        ) : language === 'it' ? (
          <>
            <p>
              Quali dati personali tratta Poetio (poetio.cloud), perché, per quanto tempo li conserviamo e quali sono i
              tuoi diritti. Ultimo aggiornamento: {UPDATED.it}.
            </p>
            <h2 id="operator">Titolare del trattamento</h2>
            <p>
              Il titolare del trattamento dei dati è <strong>{controller}</strong>.{email && <> Scrivici a {email}</>}
              {phone && (
                <>
                  {email ? ' o chiama il ' : ' Chiama il '}
                  {phone}
                </>
              )}
              {(email || phone) && '.'}
            </p>
            <h2 id="date">Quali dati usiamo e perché</h2>
            <ul>
              <li>
                <strong>Ordini di libri.</strong> Il tuo nome, indirizzo di consegna, telefono, email e note, per
                consegnare i libri, emettere i documenti di pagamento e scriverti riguardo all’ordine. La base giuridica
                è il contratto (art. 6, paragrafo 1, lettera b del GDPR) e i nostri obblighi contabili (lettera c). Li
                conserviamo per il tempo necessario all’ordine e poi per quanto richiesto dalla normativa contabile e
                fiscale.
              </li>
              <li>
                <strong>Commenti.</strong> Il nome che scrivi e il testo del commento. Diventano pubblici solo dopo
                l’approvazione. La base giuridica è il tuo consenso (lettera a); li cancelliamo appena ce lo chiedi.
              </li>
              <li id="vizite">
                <strong>Statistiche delle visite.</strong> Per ogni pagina aperta conserviamo l’indirizzo IP, la pagina,
                l’ora, il browser e la località approssimativa ricavata dall’IP, per sapere che cosa viene letto e
                proteggere il sito dagli abusi. La base giuridica è il nostro legittimo interesse (lettera f). Non
                usiamo cookie per questo. L’indirizzo IP e i dati del browser vengono cancellati dopo{' '}
                {VISIT_IP_RETENTION_DAYS} giorni; restano sessioni, pagine, orari, località approssimativa, provenienza,
                lingua e categorie di dispositivo, sistema e browser.
              </li>
              <li>
                <strong>Registri del server.</strong> Indirizzo IP, indirizzo richiesto, ora e browser, per la sicurezza
                e la risoluzione dei problemi (legittimo interesse, lettera f). Vengono cancellati automaticamente dopo{' '}
                {LOG_DAYS} giorni.
              </li>
              <li>
                <strong>Copie di sicurezza.</strong> Contengono i dati indicati sopra, sono cifrate e vengono cancellate
                automaticamente dopo al massimo {BACKUP_DAYS} giorni.
              </li>
            </ul>
            <p>Non prendiamo decisioni automatizzate che ti riguardano e non effettuiamo profilazione.</p>
            <h2 id="destinatari">Chi altro riceve i dati</h2>
            <ul>
              <li>Il corriere riceve il tuo nome, indirizzo e telefono per consegnare il pacco.</li>
              <li>Il server del sito è noleggiato da Amazon Web Services, nell’Unione europea (Francoforte).</li>
              <li>
                Google invia le email di conferma dell’ordine (Gmail) e conserva una copia cifrata della copia di
                sicurezza (Google Drive), che non può leggere. Google può trattare dati anche al di fuori dello Spazio
                economico europeo, con le garanzie richieste dal GDPR (quadro UE-USA sulla protezione dei dati).
              </li>
            </ul>
            <p>
              Non vendiamo dati, non mostriamo pubblicità e non usiamo servizi di analisi o di pubblicità di altre
              aziende. La località viene ricavata da una banca dati conservata sul server (DB-IP), senza inviare il tuo
              indirizzo IP a nessuno.
            </p>
            <h2 id="browser">Che cosa conserva il tuo browser</h2>
            <p>
              Il sito non usa cookie di tracciamento né pubblicitari. Per funzionare, conserva nel tuo browser la lingua
              scelta (il cookie <code>poetio-language</code>, un anno, inviato al server solo per mostrare quella
              lingua), il tema chiaro o scuro, le preferenze di lettura, il punto in cui sei arrivato in un libro, il
              carrello e le bozze dei commenti. Questi dati ci arrivano solo con un ordine o un commento che invii. Puoi
              cancellarli in qualsiasi momento dalle impostazioni del browser.
            </p>
            <h2 id="drepturi">I tuoi diritti</h2>
            <p>
              Puoi chiedere l’accesso ai tuoi dati, la loro rettifica, cancellazione o la limitazione del trattamento,
              riceverli in un formato portabile e opporti al trattamento basato sul nostro legittimo interesse. Puoi
              ritirare in qualsiasi momento il consenso per i commenti. Scrivici{email && <> a {email}</>}; rispondiamo
              entro un mese. Puoi anche presentare un reclamo all’autorità rumena per la protezione dei dati (
              {authority}).
            </p>
            <p>
              Le condizioni di vendita sono nei <a href={terms}>termini e condizioni</a>.
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
                and raw browser strings are deleted after {VISIT_IP_RETENTION_DAYS} days; we retain sessions, pages,
                times, approximate location, source, language and device, OS and browser categories.
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
