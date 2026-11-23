'use client';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, withSiteLanguage } from '@/lib/site-language';
import { addressLine, amountCents, formatMoney, paymentLabel, type PublicShop } from '@/lib/shop';
import ShopFrame, { useShopLanguage } from '../shop-frame';

// Terms of sale required for a distance contract (OUG 34/2014, Legea 365/2002, OUG 140/2021),
// filled in from the seller's settings in /admin/magazin.

function SellerContact({ shop, language }: { shop: PublicShop; language: SiteLanguage }) {
  return (
    <>
      {shop.seller_address && (
        <>
          <br />
          {pick(language, 'Adresa: ', 'Address: ', 'Adresse\u00a0: ', 'Adresse: ', 'Dirección: ', 'Indirizzo: ')}
          {addressLine(shop.seller_address)}
        </>
      )}
      {shop.seller_details && (
        <>
          <br />
          <span className="shop-details-text">{shop.seller_details}</span>
        </>
      )}
      {shop.contact_email && (
        <>
          <br />
          {pick(language, 'Email: ', 'Email: ', 'E-mail\u00a0: ', 'E-Mail: ', 'Correo electrónico: ', 'Email: ')}
          <a href={`mailto:${shop.contact_email}`}>{shop.contact_email}</a>
        </>
      )}
      {shop.contact_phone && (
        <>
          <br />
          {pick(language, 'Telefon: ', 'Phone: ', 'Téléphone\u00a0: ', 'Telefon: ', 'Teléfono: ', 'Telefono: ')}
          <a href={`tel:${shop.contact_phone.replace(/[^\d+]/g, '')}`}>{shop.contact_phone}</a>
        </>
      )}
    </>
  );
}

/** The model withdrawal form of OUG 34/2014 (annex 1, part B), addressed to this seller. */
function WithdrawalForm({ shop, language }: { shop: PublicShop; language: SiteLanguage }) {
  const to = [shop.seller_name || 'Poetio', addressLine(shop.seller_address), shop.contact_email]
    .filter(Boolean)
    .join(', ');
  const lines = pick(
    language,
    [
      `Către: ${to}`,
      'Vă informez prin prezenta cu privire la retragerea mea din contractul referitor la vânzarea următoarelor produse: …',
      'Comandate la data: … / primite la data: …',
      'Numărul comenzii: …',
      'Numele consumatorului: …',
      'Adresa consumatorului: …',
      'Semnătura consumatorului (doar dacă formularul este trimis pe hârtie): …',
      'Data: …',
    ],
    [
      `To: ${to}`,
      'I hereby give notice that I withdraw from my contract of sale of the following goods: …',
      'Ordered on: … / received on: …',
      'Order number: …',
      'Name of consumer: …',
      'Address of consumer: …',
      'Signature of consumer (only if this form is notified on paper): …',
      'Date: …',
    ], // France's model form (Code de la consommation, annexe à l’article R221-1), adapted to books.
    [
      `À l’attention de\u00a0: ${to}`,
      'Je vous notifie par la présente ma rétractation du contrat portant sur la vente des biens ci-dessous\u00a0: …',
      'Commandés le\u00a0: … / reçus le\u00a0: …',
      'Numéro de commande\u00a0: …',
      'Nom du consommateur\u00a0: …',
      'Adresse du consommateur\u00a0: …',
      'Signature du consommateur (uniquement en cas de notification du présent formulaire sur papier)\u00a0: …',
      'Date\u00a0: …',
    ],
    [
      `An: ${to}`,
      'Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Waren: …',
      'Bestellt am: … / erhalten am: …',
      'Bestellnummer: …',
      'Name des Verbrauchers: …',
      'Anschrift des Verbrauchers: …',
      'Unterschrift des Verbrauchers (nur bei Mitteilung auf Papier): …',
      'Datum: …',
    ],
    [
      `A la atención de: ${to}`,
      'Por la presente le comunico que desisto de mi contrato de venta de los siguientes bienes: …',
      'Pedido el: … / recibido el: …',
      'Número de pedido: …',
      'Nombre del consumidor: …',
      'Domicilio del consumidor: …',
      'Firma del consumidor (solo si el presente formulario se presenta en papel): …',
      'Fecha: …',
    ],
    [
      `Destinatario: ${to}`,
      'Con la presente notifico il recesso dal mio contratto di vendita dei seguenti beni: …',
      'Ordinato il: … / ricevuto il: …',
      'Numero dell’ordine: …',
      'Nome del consumatore: …',
      'Indirizzo del consumatore: …',
      'Firma del consumatore (solo se il presente modulo è notificato in versione cartacea): …',
      'Data: …',
    ],
  );
  const subject = pick(
    language,
    'Retragere din contract',
    'Withdrawal from contract',
    'Rétractation du contrat',
    'Widerruf des Vertrags',
    'Desistimiento del contrato',
    'Recesso dal contratto',
  );
  return (
    <>
      <h2 id="formular-retragere">
        {pick(
          language,
          'Formularul de retragere',
          'Withdrawal form',
          'Formulaire de rétractation',
          'Widerrufsformular',
          'Formulario de desistimiento',
          'Modulo di recesso',
        )}
      </h2>
      <p>
        {pick(
          language,
          'Completează și trimite acest formular doar dacă vrei să renunți la contract. Poți scrie și cu propriile cuvinte; formularul nu este obligatoriu.',
          'Complete and return this form only if you wish to withdraw from the contract. You may also write in your own words; the form is optional.',
          'Complétez et renvoyez ce formulaire uniquement si vous souhaitez vous rétracter du contrat. Vous pouvez aussi écrire avec vos propres mots\u00a0; le formulaire est facultatif.',
          'Wenn Sie den Vertrag widerrufen wollen, füllen Sie dieses Formular aus und senden Sie es zurück. Sie können auch mit eigenen Worten schreiben; das Formular ist nicht verpflichtend.',
          'Rellena y envía este formulario solo si quieres desistir del contrato. También puedes escribir con tus propias palabras; el formulario no es obligatorio.',
          'Compila e restituisci questo modulo solo se desideri recedere dal contratto. Puoi anche scrivere con parole tue; il modulo non è obbligatorio.',
        )}
      </p>
      <div className="shop-withdrawal-form">
        {lines.map(line => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {shop.contact_email && (
        <p>
          <a
            href={`mailto:${shop.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n\n'))}`}
          >
            {pick(
              language,
              'Trimite formularul prin email',
              'Send the form by email',
              'Envoyer le formulaire par e-mail',
              'Formular per E-Mail senden',
              'Enviar el formulario por correo electrónico',
              'Invia il modulo via email',
            )}
          </a>
        </p>
      )}
    </>
  );
}

export default function TermsView({ initialLanguage, shop }: { initialLanguage: SiteLanguage; shop: PublicShop }) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const seller = shop.seller_name || 'Poetio';
  const shipping = amountCents(shop.shipping_amount);
  const days = `${shop.delivery_min_days}–${shop.delivery_max_days}`;
  const methods = shop.payment_methods.map(method => paymentLabel(method, language)).join(', ');
  const email = shop.contact_email ? <a href={`mailto:${shop.contact_email}`}>{shop.contact_email}</a> : null;
  const privacy = withSiteLanguage('/confidentialitate', language);
  const sal = (
    <a href="https://anpc.ro/ce-este-sal/" rel="noopener noreferrer">
      anpc.ro/ce-este-sal
    </a>
  );

  return (
    <ShopFrame language={language} onLanguageChange={changeLanguage}>
      <article className="shop-document">
        <h1 className="shop-title">
          {pick(
            language,
            'Termeni și condiții de vânzare',
            'Terms and conditions of sale',
            'Conditions générales de vente',
            'Allgemeine Geschäftsbedingungen',
            'Términos y condiciones de venta',
            'Termini e condizioni di vendita',
          )}
        </h1>
        {language === 'ro' ? (
          <>
            <h2 id="vanzator">Vânzătorul</h2>
            <p>
              Cărțile comandate pe Poetio sunt vândute și expediate de <strong>{seller}</strong>.
              <SellerContact shop={shop} language={language} />
            </p>
            <h2 id="comanda">Comanda și contractul</h2>
            <p>
              Comanda se plasează din coșul de cumpărături sau cu butonul „Cumpără acum”. Înainte de trimitere vezi
              cărțile, prețul total cu livrarea și metoda de plată. După ce apeși „Comandă cu obligație de plată”
              primești numărul comenzii, un link unde îi vezi oricând starea și un email de confirmare. Contractul se
              încheie când vânzătorul confirmă comanda; dacă o carte nu mai poate fi livrată, te anunțăm și nu plătești
              nimic.
            </p>
            <h2 id="preturi">Prețuri și plată</h2>
            <p>
              Prețurile sunt afișate în {shop.currency}, pe pagina fiecărei cărți, și sunt prețuri finale. Costul
              livrării este{' '}
              {shipping === null
                ? 'afișat la comandă'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'ro')
                  : 'gratuit'}{' '}
              și se adaugă o singură dată pe comandă. {methods && <>Metode de plată: {methods}.</>}
            </p>
            <h2 id="livrare">Livrarea</h2>
            <p>
              Livrăm prin curier, în România, de obicei în {days} zile lucrătoare de la comandă (de la primirea plății,
              pentru transferul bancar). Dacă nu putem livra în termenul anunțat, te anunțăm; poți renunța la comandă și
              îți restituim imediat tot ce ai plătit. Răspunderea pentru pierderea sau deteriorarea cărților trece la
              tine când primești coletul.
            </p>
            <h2 id="retur">Dreptul de retragere și returul</h2>
            <p>
              Poți renunța la cumpărare în 14 zile de la ziua în care tu (sau cineva ales de tine, altul decât curierul)
              primești cărțile, fără să explici motivul (OUG 34/2014). Ca să te retragi, anunță vânzătorul înainte să
              treacă cele 14 zile, printr-o declarație clară, de exemplu un email{email && <> la {email}</>}, cu numărul
              comenzii. Poți folosi <a href="#formular-retragere">formularul de retragere</a>, dar nu este obligatoriu.
            </p>
            <p>
              Trimite apoi cărțile înapoi, la adresa vânzătorului, în cel mult 14 zile de la anunț. Costul returului
              este al tău. Răspunzi doar pentru deprecierea cărților cauzată de o folosire mai mult decât necesar pentru
              a le verifica.
            </p>
            <p>
              Îți restituim toate sumele plătite, inclusiv livrarea standard, în cel mult 14 zile de la anunțul de
              retragere, prin aceeași metodă de plată; pentru plata ramburs, prin transfer în contul pe care ni-l
              indici. Putem amâna restituirea până primim cărțile înapoi sau până ne trimiți dovada că le-ai expediat,
              oricare dintre acestea are loc mai întâi.
            </p>
            <WithdrawalForm shop={shop} language={language} />
            <h2 id="garantie">Garanția legală de conformitate</h2>
            <p>
              Cărțile beneficiază de garanția legală de conformitate (OUG 140/2021) timp de 2 ani de la livrare. Dacă
              primești o carte deteriorată, incompletă sau alta decât cea comandată, scrie-ne: o înlocuim sau, dacă nu
              se poate, îți restituim banii, fără costuri pentru tine.
            </p>
            <h2 id="date">Datele personale</h2>
            <p>
              Numele, adresa, telefonul și emailul din comandă sunt folosite doar pentru livrarea cărților, facturare și
              comunicarea despre comandă. Nu sunt vândute și nu sunt folosite pentru publicitate. Ce date păstrăm, cât
              timp și ce drepturi ai: <a href={privacy}>nota de confidențialitate</a>.
            </p>
            <h2 id="reclamatii">Reclamații și litigii</h2>
            <p>
              Pentru orice problemă scrie-ne mai întâi; răspundem cât mai repede. Te poți adresa și Autorității
              Naționale pentru Protecția Consumatorilor (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) sau poți apela la soluționarea alternativă a litigiilor (SAL): {sal}. Contractul este supus legii
              române.
            </p>
          </>
        ) : language === 'fr' ? (
          <>
            <h2 id="vanzator">Le vendeur</h2>
            <p>
              Les livres commandés sur Poetio sont vendus et expédiés par <strong>{seller}</strong>.
              <SellerContact shop={shop} language={language} />
            </p>
            <h2 id="comanda">La commande et le contrat</h2>
            <p>
              Commandez depuis le panier ou avec le bouton «&nbsp;Acheter maintenant&nbsp;». Avant l’envoi, vous voyez
              les livres, le prix total avec la livraison et le mode de paiement. Après avoir cliqué sur «&nbsp;Commande
              avec obligation de paiement&nbsp;», vous recevez le numéro de commande, un lien pour en suivre l’état à
              tout moment et un e-mail de confirmation. Le contrat est conclu lorsque le vendeur confirme la
              commande&nbsp;; si un livre ne peut plus être livré, nous vous prévenons et vous ne payez rien.
            </p>
            <h2 id="preturi">Prix et paiement</h2>
            <p>
              Les prix sont indiqués en {shop.currency} sur la page de chaque livre et sont des prix définitifs.
              Livraison&nbsp;:{' '}
              {shipping === null
                ? 'indiquée lors de la commande'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'fr')
                  : 'gratuite'}
              , facturée une seule fois par commande. {methods && <>Modes de paiement&nbsp;: {methods}.</>}
            </p>
            <h2 id="livrare">Livraison</h2>
            <p>
              Nous livrons par transporteur, en Roumanie, généralement sous {days} jours ouvrés à compter de la commande
              (à compter de la réception du paiement, pour le virement bancaire). Si nous ne pouvons pas livrer dans ce
              délai, nous vous prévenons&nbsp;; vous pouvez annuler la commande et nous vous remboursons immédiatement
              tout ce que vous avez payé. Le risque de perte ou d’endommagement des livres vous est transféré à la
              réception du colis.
            </p>
            <h2 id="retur">Droit de rétractation et retours</h2>
            <p>
              Vous pouvez renoncer à l’achat dans un délai de 14&nbsp;jours à compter du jour où vous (ou une personne
              que vous désignez, autre que le transporteur) recevez les livres, sans avoir à justifier de motif (OUG
              34/2014). Pour vous rétracter, informez le vendeur avant l’expiration de ce délai par une déclaration
              dénuée d’ambiguïté, par exemple un e-mail{email && <> à {email}</>}, en indiquant le numéro de commande.
              Vous pouvez utiliser le <a href="#formular-retragere">formulaire de rétractation</a>, mais ce n’est pas
              obligatoire.
            </p>
            <p>
              Renvoyez ensuite les livres à l’adresse du vendeur au plus tard 14&nbsp;jours après votre notification.
              Les frais de retour sont à votre charge. Votre responsabilité n’est engagée qu’en cas de dépréciation des
              livres résultant de manipulations autres que celles nécessaires pour les examiner.
            </p>
            <p>
              Nous vous remboursons toutes les sommes versées, y compris les frais de livraison standard, au plus tard
              14&nbsp;jours après votre notification, par le même moyen de paiement&nbsp;; pour le paiement à la
              livraison, par virement sur le compte que vous nous indiquez. Nous pouvons différer le remboursement
              jusqu’à la réception des livres ou jusqu’à ce que vous ayez fourni une preuve de leur expédition, la date
              retenue étant celle du premier de ces faits.
            </p>
            <WithdrawalForm shop={shop} language={language} />
            <h2 id="garantie">Garantie légale de conformité</h2>
            <p>
              Les livres bénéficient de la garantie légale de conformité (OUG 140/2021) pendant 2&nbsp;ans à compter de
              la livraison. Si vous recevez un livre abîmé, incomplet ou différent de celui commandé,
              écrivez-nous&nbsp;: nous le remplaçons ou, si ce n’est pas possible, nous vous remboursons, sans frais
              pour vous.
            </p>
            <h2 id="date">Données personnelles</h2>
            <p>
              Vos nom, adresse, téléphone et e-mail servent uniquement à livrer les livres, à la facturation et aux
              échanges concernant votre commande. Ils ne sont jamais vendus ni utilisés à des fins publicitaires. Ce que
              nous conservons, combien de temps et vos droits&nbsp;: <a href={privacy}>politique de confidentialité</a>.
            </p>
            <h2 id="reclamatii">Réclamations et litiges</h2>
            <p>
              En cas de problème, écrivez-nous d’abord&nbsp;; nous répondons au plus vite. Vous pouvez aussi vous
              adresser à l’autorité roumaine de protection des consommateurs (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) ou recourir au règlement extrajudiciaire des litiges (SAL)&nbsp;: {sal}. Le contrat est soumis au droit
              roumain.
            </p>
          </>
        ) : language === 'de' ? (
          <>
            <h2 id="vanzator">Verkäufer</h2>
            <p>
              Die auf Poetio bestellten Bücher werden von <strong>{seller}</strong> verkauft und versandt.
              <SellerContact shop={shop} language={language} />
            </p>
            <h2 id="comanda">Bestellung und Vertrag</h2>
            <p>
              Sie bestellen über den Warenkorb oder mit „Jetzt kaufen“. Vor dem Absenden sehen Sie die Bücher, den
              Gesamtpreis mit Versand und die Zahlungsart. Nachdem Sie auf „Zahlungspflichtig bestellen“ geklickt haben,
              erhalten Sie die Bestellnummer, einen Link, unter dem Sie jederzeit den Status sehen, und eine Bestätigung
              per E-Mail. Der Vertrag kommt zustande, wenn der Verkäufer die Bestellung bestätigt; kann ein Buch nicht
              mehr geliefert werden, informieren wir Sie und Sie zahlen nichts.
            </p>
            <h2 id="preturi">Preise und Zahlung</h2>
            <p>
              Die Preise werden in {shop.currency} auf der Seite jedes Buches angezeigt und sind Endpreise. Versand:{' '}
              {shipping === null
                ? 'wird bei der Bestellung angezeigt'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'de')
                  : 'kostenlos'}
              , einmal pro Bestellung berechnet. {methods && <>Zahlungsarten: {methods}.</>}
            </p>
            <h2 id="livrare">Lieferung</h2>
            <p>
              Wir liefern per Kurier innerhalb Rumäniens, in der Regel innerhalb von {days} Werktagen nach der
              Bestellung (bei Banküberweisung nach Zahlungseingang). Können wir nicht innerhalb dieser Frist liefern,
              informieren wir Sie; Sie können die Bestellung stornieren und wir erstatten Ihnen sofort alle Zahlungen.
              Die Gefahr des Verlusts oder der Beschädigung der Bücher geht mit Erhalt des Pakets auf Sie über.
            </p>
            <h2 id="retur">Widerrufsrecht und Rücksendung</h2>
            <p>
              Sie können den Kauf binnen 14 Tagen ab dem Tag, an dem Sie (oder ein von Ihnen benannter Dritter, der
              nicht der Beförderer ist) die Bücher erhalten haben, ohne Angabe von Gründen widerrufen (OUG 34/2014). Um
              zu widerrufen, informieren Sie den Verkäufer vor Ablauf der Frist mittels einer eindeutigen Erklärung, zum
              Beispiel per E-Mail{email && <> an {email}</>}, unter Angabe der Bestellnummer. Sie können das{' '}
              <a href="#formular-retragere">Widerrufsformular</a> verwenden, müssen es aber nicht.
            </p>
            <p>
              Senden Sie die Bücher anschließend binnen 14 Tagen nach Ihrem Widerruf an die Adresse des Verkäufers
              zurück. Die Kosten der Rücksendung tragen Sie. Sie haften nur für einen Wertverlust, der auf einen zur
              Prüfung nicht notwendigen Umgang mit den Büchern zurückzuführen ist.
            </p>
            <p>
              Wir erstatten Ihnen alle Zahlungen einschließlich der Standardversandkosten binnen 14 Tagen nach Ihrem
              Widerruf über dasselbe Zahlungsmittel; bei Zahlung bei Lieferung per Überweisung auf das von Ihnen
              genannte Konto. Wir können die Rückzahlung verweigern, bis wir die Bücher zurückerhalten haben oder bis
              Sie nachgewiesen haben, dass Sie sie zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.
            </p>
            <WithdrawalForm shop={shop} language={language} />
            <h2 id="garantie">Gesetzliche Gewährleistung</h2>
            <p>
              Für die Bücher gilt die gesetzliche Gewährleistung für Vertragsmäßigkeit (OUG 140/2021) für 2 Jahre ab
              Lieferung. Erhalten Sie ein beschädigtes, unvollständiges oder anderes als das bestellte Buch, schreiben
              Sie uns: Wir ersetzen es oder erstatten, falls dies nicht möglich ist, den Kaufpreis, ohne Kosten für Sie.
            </p>
            <h2 id="date">Personenbezogene Daten</h2>
            <p>
              Ihr Name, Ihre Adresse, Telefonnummer und E-Mail werden nur für die Lieferung der Bücher, die
              Rechnungsstellung und die Kommunikation zu Ihrer Bestellung verwendet. Sie werden weder verkauft noch für
              Werbung genutzt. Was wir speichern, wie lange und welche Rechte Sie haben:{' '}
              <a href={privacy}>Datenschutzerklärung</a>.
            </p>
            <h2 id="reclamatii">Beschwerden und Streitigkeiten</h2>
            <p>
              Bitte schreiben Sie uns zuerst; wir antworten so schnell wie möglich. Sie können sich auch an die
              rumänische Verbraucherschutzbehörde (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) wenden oder die alternative Streitbeilegung (SAL) nutzen: {sal}. Der Vertrag unterliegt rumänischem
              Recht.
            </p>
          </>
        ) : language === 'es' ? (
          <>
            <h2 id="vanzator">El vendedor</h2>
            <p>
              Los libros pedidos en Poetio los vende y envía <strong>{seller}</strong>.
              <SellerContact shop={shop} language={language} />
            </p>
            <h2 id="comanda">El pedido y el contrato</h2>
            <p>
              Haces el pedido desde el carrito o con el botón «Comprar ahora». Antes de enviarlo ves los libros, el
              precio total con el envío y la forma de pago. Después de pulsar «Pedido con obligación de pago» recibes el
              número del pedido, un enlace donde puedes ver su estado en cualquier momento y un correo de confirmación.
              El contrato se celebra cuando el vendedor confirma el pedido; si un libro ya no se puede entregar, te
              avisamos y no pagas nada.
            </p>
            <h2 id="preturi">Precios y pago</h2>
            <p>
              Los precios se muestran en {shop.currency} en la página de cada libro y son precios finales. Envío:{' '}
              {shipping === null
                ? 'se muestra al hacer el pedido'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'es')
                  : 'gratuito'}
              , que se cobra una sola vez por pedido. {methods && <>Formas de pago: {methods}.</>}
            </p>
            <h2 id="livrare">Entrega</h2>
            <p>
              Entregamos por mensajería, en Rumanía, normalmente en {days} días hábiles desde el pedido (desde la
              recepción del pago, en caso de transferencia bancaria). Si no podemos entregar en ese plazo, te avisamos;
              puedes cancelar el pedido y te devolvemos de inmediato todo lo que hayas pagado. El riesgo de pérdida o
              deterioro de los libros se te transmite cuando recibes el paquete.
            </p>
            <h2 id="retur">Derecho de desistimiento y devoluciones</h2>
            <p>
              Puedes desistir de la compra en un plazo de 14 días desde el día en que tú (o alguien que designes,
              distinto del transportista) recibes los libros, sin tener que indicar el motivo (OUG 34/2014). Para
              desistir, comunícaselo al vendedor antes de que termine el plazo mediante una declaración inequívoca, por
              ejemplo un correo electrónico{email && <> a {email}</>}, indicando el número de pedido. Puedes usar el{' '}
              <a href="#formular-retragere">formulario de desistimiento</a>, pero no es obligatorio.
            </p>
            <p>
              Después, devuelve los libros a la dirección del vendedor en un plazo máximo de 14 días desde tu
              comunicación. Los gastos de devolución corren de tu cuenta. Solo eres responsable de la disminución de
              valor de los libros resultante de una manipulación distinta de la necesaria para comprobarlos.
            </p>
            <p>
              Te reembolsamos todos los pagos recibidos, incluidos los gastos de envío estándar, en un plazo máximo de
              14 días desde tu comunicación, por el mismo medio de pago; si pagaste contra reembolso, mediante
              transferencia a la cuenta que nos indiques. Podemos retener el reembolso hasta haber recibido los libros o
              hasta que presentes una prueba de su devolución, según qué condición se cumpla primero.
            </p>
            <WithdrawalForm shop={shop} language={language} />
            <h2 id="garantie">Garantía legal de conformidad</h2>
            <p>
              Los libros cuentan con la garantía legal de conformidad (OUG 140/2021) durante 2 años desde la entrega. Si
              recibes un libro dañado, incompleto o distinto del que pediste, escríbenos: lo sustituimos o, si no es
              posible, te devolvemos el dinero, sin coste para ti.
            </p>
            <h2 id="date">Datos personales</h2>
            <p>
              Tu nombre, dirección, teléfono y correo electrónico solo se usan para entregar los libros, facturar y
              comunicarnos contigo sobre el pedido. Nunca se venden ni se usan con fines publicitarios. Qué datos
              guardamos, durante cuánto tiempo y cuáles son tus derechos: <a href={privacy}>política de privacidad</a>.
            </p>
            <h2 id="reclamatii">Reclamaciones y litigios</h2>
            <p>
              Ante cualquier problema, escríbenos primero; respondemos lo antes posible. También puedes dirigirte a la
              autoridad rumana de protección de los consumidores (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) o recurrir a la resolución alternativa de litigios (SAL): {sal}. El contrato se rige por la legislación
              rumana.
            </p>
          </>
        ) : language === 'it' ? (
          <>
            <h2 id="vanzator">Il venditore</h2>
            <p>
              I libri ordinati su Poetio sono venduti e spediti da <strong>{seller}</strong>.
              <SellerContact shop={shop} language={language} />
            </p>
            <h2 id="comanda">L’ordine e il contratto</h2>
            <p>
              Puoi ordinare dal carrello o con il pulsante «Acquista ora». Prima dell’invio vedi i libri, il prezzo
              totale con la spedizione e il metodo di pagamento. Dopo aver premuto «Ordine con obbligo di pagamento»
              ricevi il numero dell’ordine, un link dove puoi vederne lo stato in qualsiasi momento e un’email di
              conferma. Il contratto si conclude quando il venditore conferma l’ordine; se un libro non può più essere
              consegnato, ti avvisiamo e non paghi nulla.
            </p>
            <h2 id="preturi">Prezzi e pagamento</h2>
            <p>
              I prezzi sono indicati in {shop.currency} nella pagina di ogni libro e sono prezzi finali. Spedizione:{' '}
              {shipping === null
                ? 'indicata al momento dell’ordine'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'it')
                  : 'gratuita'}
              , addebitata una sola volta per ordine. {methods && <>Metodi di pagamento: {methods}.</>}
            </p>
            <h2 id="livrare">Consegna</h2>
            <p>
              Consegniamo tramite corriere, in Romania, di solito entro {days} giorni lavorativi dall’ordine (dal
              ricevimento del pagamento, in caso di bonifico bancario). Se non possiamo consegnare entro questo termine,
              ti avvisiamo; puoi annullare l’ordine e ti rimborsiamo subito tutto ciò che hai pagato. Il rischio di
              perdita o danneggiamento dei libri passa a te quando ricevi il pacco.
            </p>
            <h2 id="retur">Diritto di recesso e resi</h2>
            <p>
              Puoi recedere dall’acquisto entro 14 giorni dal giorno in cui tu (o una persona da te indicata, diversa
              dal vettore) ricevi i libri, senza indicarne le ragioni (OUG 34/2014). Per recedere, informa il venditore
              prima della scadenza del termine con una dichiarazione esplicita, per esempio un’email
              {email && <> a {email}</>}, indicando il numero dell’ordine. Puoi usare il{' '}
              <a href="#formular-retragere">modulo di recesso</a>, ma non è obbligatorio.
            </p>
            <p>
              Rispedisci poi i libri all’indirizzo del venditore entro 14 giorni dalla tua comunicazione. Le spese di
              restituzione sono a tuo carico. Sei responsabile solo della diminuzione del valore dei libri risultante da
              una manipolazione diversa da quella necessaria per esaminarli.
            </p>
            <p>
              Ti rimborsiamo tutti i pagamenti ricevuti, comprese le spese di consegna standard, entro 14 giorni dalla
              tua comunicazione, con lo stesso mezzo di pagamento; se hai pagato in contrassegno, con bonifico sul conto
              che ci indichi. Possiamo trattenere il rimborso finché non abbiamo ricevuto i libri o finché non hai
              dimostrato di averli rispediti, se precedente.
            </p>
            <WithdrawalForm shop={shop} language={language} />
            <h2 id="garantie">Garanzia legale di conformità</h2>
            <p>
              I libri beneficiano della garanzia legale di conformità (OUG 140/2021) per 2 anni dalla consegna. Se
              ricevi un libro danneggiato, incompleto o diverso da quello ordinato, scrivici: lo sostituiamo o, se non è
              possibile, ti rimborsiamo, senza costi per te.
            </p>
            <h2 id="date">Dati personali</h2>
            <p>
              Il tuo nome, indirizzo, telefono ed email sono usati solo per consegnare i libri, per la fatturazione e
              per comunicare con te riguardo all’ordine. Non vengono mai venduti né usati a fini pubblicitari. Quali
              dati conserviamo, per quanto tempo e quali sono i tuoi diritti:{' '}
              <a href={privacy}>informativa sulla privacy</a>.
            </p>
            <h2 id="reclamatii">Reclami e controversie</h2>
            <p>
              Per qualsiasi problema scrivi prima a noi; rispondiamo il prima possibile. Puoi rivolgerti anche
              all’autorità rumena per la tutela dei consumatori (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) o ricorrere alla risoluzione alternativa delle controversie (SAL): {sal}. Il contratto è regolato dalla
              legge rumena.
            </p>
          </>
        ) : (
          <>
            <h2 id="vanzator">Seller</h2>
            <p>
              Books ordered on Poetio are sold and shipped by <strong>{seller}</strong>.
              <SellerContact shop={shop} language={language} />
            </p>
            <h2 id="comanda">Orders and the contract</h2>
            <p>
              Order from the shopping cart or with “Buy now”. Before sending you see the books, the total price with
              delivery and the payment method. After you press “Order with obligation to pay” you get the order number,
              a link where you can see its status at any time, and a confirmation email. The contract is made when the
              seller confirms the order; if a book can no longer be delivered, we tell you and you pay nothing.
            </p>
            <h2 id="preturi">Prices and payment</h2>
            <p>
              Prices are shown in {shop.currency} on each book’s page and are final prices. Delivery costs{' '}
              {shipping === null
                ? 'are shown at checkout'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'en-US')
                  : 'nothing'}{' '}
              and is charged once per order. {methods && <>Payment methods: {methods}.</>}
            </p>
            <h2 id="livrare">Delivery</h2>
            <p>
              We deliver by courier within Romania, usually in {days} working days from the order (from the payment, for
              bank transfers). If we cannot deliver within that time, we tell you; you may cancel the order and we
              refund everything you paid at once. The risk of loss or damage passes to you when you receive the parcel.
            </p>
            <h2 id="retur">Right of withdrawal and returns</h2>
            <p>
              You may withdraw from the purchase within 14 days of the day you (or someone you name, other than the
              carrier) receive the books, without giving a reason. To withdraw, tell the seller before the 14 days have
              passed with a clear statement, for example an email{email && <> to {email}</>}, quoting the order number.
              You may use the <a href="#formular-retragere">withdrawal form</a>, but you do not have to.
            </p>
            <p>
              Then send the books back to the seller’s address within 14 days of your notice. You pay for the return.
              You are only liable for any loss in value caused by handling the books more than needed to examine them.
            </p>
            <p>
              We refund everything you paid, including standard delivery, within 14 days of your notice, using the same
              payment method; for cash on delivery, by transfer to the account you give us. We may wait until we have
              the books back or you have shown that you sent them, whichever is earlier.
            </p>
            <WithdrawalForm shop={shop} language={language} />
            <h2 id="garantie">Legal guarantee of conformity</h2>
            <p>
              The books carry the legal guarantee of conformity (OUG 140/2021) for 2 years from delivery. If a book
              arrives damaged, incomplete or is not the one you ordered, write to us: we replace it or, if that is not
              possible, refund you, at no cost to you.
            </p>
            <h2 id="date">Personal data</h2>
            <p>
              Your name, address, phone and email are used only to deliver the books, invoice and talk about your order.
              They are never sold or used for advertising. What we keep, for how long and your rights:{' '}
              <a href={privacy}>privacy notice</a>.
            </p>
            <h2 id="reclamatii">Complaints and disputes</h2>
            <p>
              Please write to us first. You may also contact Romania’s consumer protection authority (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) or use alternative dispute resolution (SAL): {sal}. The contract is governed by Romanian law.
            </p>
          </>
        )}
      </article>
    </ShopFrame>
  );
}
