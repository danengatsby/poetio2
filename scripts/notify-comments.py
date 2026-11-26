#!/usr/bin/env python3
"""Send comment moderation notices and individual shop order confirmations via SMTP."""
import argparse
from contextlib import closing
import datetime as dt
from email.headerregistry import Address
from email.errors import MessageError
from email.message import EmailMessage
import fcntl
import json
import os
from pathlib import Path
import smtplib
import sqlite3
import ssl
import sys
import tempfile
import time

# Comment table, parent table and foreign key; identifiers come only from here.
SOURCES = (
    ("poem", "poem_comments", "poems", "poem_id"),
    ("video", "video_comments", "videos", "video_id"),
    ("book", "book_comments", "books", "book_id"),
    ("about", "about_comments", None, None),
)
LABELS = {"poem": "Poem", "video": "Video", "book": "Carte", "about": "Pagina autorului"}
EXCERPT = 600
LIMIT = 50


def settings(env):
    """SMTP settings from the environment, or None while the notice is not configured."""
    host, recipient = env.get("POETIO_SMTP_HOST", "").strip(), env.get("POETIO_NOTIFY_TO", "").strip()
    if not host or not recipient:
        return None
    port = int(env.get("POETIO_SMTP_PORT", "587"))
    user = env.get("POETIO_SMTP_USER", "").strip()
    mode = env.get("POETIO_SMTP_TLS", "ssl" if port == 465 else "starttls").strip().lower()
    if mode not in ("ssl", "starttls"):
        raise ValueError("POETIO_SMTP_TLS must be ssl or starttls")
    return {
        "host": host, "port": port, "user": user, "password": env.get("POETIO_SMTP_PASSWORD", ""), "mode": mode,
        "sender": env.get("POETIO_NOTIFY_FROM", "").strip() or user or recipient, "recipient": recipient,
        "site": env.get("POETIO_SITE_URL", "https://poetio.cloud").rstrip("/"),
    }


def pending(database, after):
    """Comments still awaiting moderation that arrived after the last notice."""
    rows = []
    with closing(sqlite3.connect(Path(database).resolve().as_uri() + "?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        for kind, table, parent, key in SOURCES:
            query = (f"SELECT c.id, c.name, c.content, c.created_at, p.title AS title FROM {table} c JOIN {parent} p ON p.id = c.{key}"
                     if parent else f"SELECT c.id, c.name, c.content, c.created_at, NULL AS title FROM {table} c")
            for row in db.execute(query + " WHERE c.status = 'pending' AND c.created_at > ? ORDER BY c.created_at, c.id", (after,)):
                rows.append({"kind": kind, **dict(row)})
    return sorted(rows, key=lambda row: (row["created_at"], row["id"]))


def mailbox(value, whose):
    """Exactly one mailbox, so a list of addresses cannot redirect a message."""
    address = Address(addr_spec=value)
    if not address.username or not address.domain:
        raise ValueError(f"Missing {whose} mailbox")
    return address


def order_recipient(source, env, has_shop):
    """Who hears about new orders: POETIO_ORDER_TO, else the shop's contact email, else POETIO_NOTIFY_TO."""
    chosen = env.get("POETIO_ORDER_TO", "").strip()
    if not chosen and has_shop:
        row = source.execute("SELECT value FROM shop_settings WHERE key = 'contact_email'").fetchone()
        chosen = row[0].strip() if row else ""
    return chosen or env.get("POETIO_NOTIFY_TO", "").strip()


SELLER_KEYS = ("seller_name", "seller_address", "contact_email", "contact_phone")


def seller_details(source, has_shop):
    """The seller's name, address and contacts from /admin/magazin, each on one line."""
    if not has_shop:
        return {}
    rows = source.execute(f"SELECT key, value FROM shop_settings WHERE key IN ({', '.join('?' * len(SELLER_KEYS))})", SELLER_KEYS)
    return {row[0]: ", ".join(" ".join(line.split()) for line in row[1].splitlines() if line.strip()) for row in rows}


BUYER_COPY = {
    'ro': {
        'subject': 'Am primit comanda nr.',
        'greeting': 'Bună, {name}! Îți mulțumim pentru comandă.',
        'order': 'Comanda nr.',
        'cover': 'coperta',
        'total': 'Total cu livrare',
        'payment': 'Plată',
        'cod': 'ramburs',
        'transfer': 'transfer bancar',
        'link': 'Detaliile comenzii tale',
        'seller': 'Vânzător',
        'contact': 'Contact',
        'terms': 'Poți renunța la cumpărare în 14 zile de la primirea cărților, fără să explici motivul. Cărțile au garanția legală de conformitate de 2 ani. Termenii, formularul de retragere și garanția',
    },
    'en-US': {
        'subject': 'We received order',
        'greeting': 'Thank you for your order, {name}.',
        'order': 'Order',
        'cover': 'cover',
        'total': 'Total including shipping',
        'payment': 'Payment',
        'cod': 'cash on delivery',
        'transfer': 'bank transfer',
        'link': 'View your order',
        'seller': 'Seller',
        'contact': 'Contact',
        'terms': 'You can withdraw within 14 days of receiving the books without giving a reason. The books carry a two-year legal guarantee of conformity. Terms, withdrawal form and guarantee',
    },
    'fr': {
        'subject': 'Nous avons reçu la commande',
        'greeting': 'Merci pour votre commande, {name}.',
        'order': 'Commande',
        'cover': 'couverture',
        'total': 'Total avec livraison',
        'payment': 'Paiement',
        'cod': 'à la livraison',
        'transfer': 'virement bancaire',
        'link': 'Votre commande',
        'seller': 'Vendeur',
        'contact': 'Contact',
        'terms': 'Vous pouvez vous rétracter sans motif dans les 14 jours suivant la réception des livres. Les livres bénéficient de la garantie légale de conformité de deux ans. Conditions, formulaire de rétractation et garantie',
    },
    'de': {
        'subject': 'Wir haben Ihre Bestellung erhalten',
        'greeting': 'Vielen Dank für Ihre Bestellung, {name}.',
        'order': 'Bestellung',
        'cover': 'Umschlag',
        'total': 'Gesamtbetrag einschließlich Versand',
        'payment': 'Zahlung',
        'cod': 'Nachnahme',
        'transfer': 'Überweisung',
        'link': 'Ihre Bestellung',
        'seller': 'Verkäufer',
        'contact': 'Kontakt',
        'terms': 'Sie können den Kauf innerhalb von 14 Tagen nach Erhalt der Bücher ohne Angabe von Gründen widerrufen. Für die Bücher gilt die zweijährige gesetzliche Gewährleistung. Bedingungen, Widerrufsformular und Gewährleistung',
    },
    'es': {
        'subject': 'Hemos recibido el pedido',
        'greeting': 'Gracias por tu pedido, {name}.',
        'order': 'Pedido',
        'cover': 'cubierta',
        'total': 'Total con envío',
        'payment': 'Pago',
        'cod': 'contra reembolso',
        'transfer': 'transferencia bancaria',
        'link': 'Ver tu pedido',
        'seller': 'Vendedor',
        'contact': 'Contacto',
        'terms': 'Puedes desistir sin indicar el motivo en los 14 días siguientes a la recepción de los libros. Los libros tienen una garantía legal de conformidad de dos años. Condiciones, formulario de desistimiento y garantía',
    },
    'it': {
        'subject': 'Abbiamo ricevuto il tuo ordine',
        'greeting': 'Grazie per il tuo ordine, {name}.',
        'order': 'Ordine',
        'cover': 'copertina',
        'total': 'Totale con spedizione',
        'payment': 'Pagamento',
        'cod': 'contrassegno',
        'transfer': 'bonifico bancario',
        'link': 'Dettagli del tuo ordine',
        'seller': 'Venditore',
        'contact': 'Contatti',
        'terms': 'Puoi recedere senza indicare il motivo entro 14 giorni dal ricevimento dei libri. I libri hanno una garanzia legale di conformità di due anni. Condizioni, modulo di recesso e garanzia',
    },
}


def buyer_terms(config, copy, language):
    seller = config.get("seller") or {}
    who = ", ".join(seller[key] for key in ("seller_name", "seller_address") if seller.get(key))
    contact = " · ".join(seller[key] for key in ("contact_email", "contact_phone") if seller.get(key))
    lines = [f"{copy['seller']}: {who}"] if who else []
    if contact:
        lines.append(f"{copy['contact']}: {contact}")
    query = '' if language == 'ro' else f'?lang={language}'
    lines.extend(['', f"{copy['terms']}: {config['site']}/termeni{query}#retur"])
    return "\n".join(lines).strip("\n")


def compose_order(order, items, role, config):
    number = order["number"]
    language = order["language"] if role == 'buyer' and 'language' in order.keys() else 'ro'
    if language not in BUYER_COPY:
        language = 'ro'
    copy = BUYER_COPY[language]
    separator = '.' if language == 'en-US' else ','
    total = f"{order['total_cents'] // 100}{separator}{order['total_cents'] % 100:02d} {order['currency']}"
    books = "\n".join(f"  {item['quantity']} × {' '.join(item['title'].split())} ({copy['cover']} {item['cover']})" for item in items)
    message = EmailMessage()
    message["From"] = config["sender"]
    message["Message-ID"] = f"<order-{order['id']}-{role}@poetio.cloud>"
    if role == "admin":
        message["To"] = mailbox(config["recipient"], "seller")
        message["Subject"] = f"Poetio: comandă nouă nr. {number} ({total})"
        place = ", ".join(order[key] for key in ("address", "city", "county", "postal_code") if order[key])
        intro = f"Ai o comandă nouă.\nClient: {order['customer_name']} · {order['phone']} · {order['email']}\nLivrare: {place}"
        if order["note"]:
            intro += f"\nObservații: {order['note']}"
        link = f"Gestionează comanda: {config['site']}/admin/comenzi"
    else:
        # Reject address lists even in legacy order data.
        message["To"] = mailbox(order["email"], "customer")
        message["Subject"] = f"Poetio: {copy['subject']} {number}"
        intro = copy['greeting'].format(name=order['customer_name'])
        link = f"{copy['link']}: {config['site']}/comanda/{order['id']}?cheie={order['access_key']}&lang={language}"
    terms = f"\n{buyer_terms(config, copy, language)}\n" if role == "buyer" else ""
    message.set_content(f"{intro}\n\n{copy['order']} {number}\n{books}\n{copy['total']}: {total}\n"
                        f"{copy['payment']}: {copy[order['payment_method']]}\n\n{link}\n{terms}")
    return message


def queue_orders(source, queue, has_shop):
    """Record both deliveries and advance the order number in the same local transaction."""
    with queue:
        queue.execute("CREATE TABLE IF NOT EXISTS cursor (last_number INTEGER NOT NULL)")
        queue.execute("""CREATE TABLE IF NOT EXISTS deliveries (order_id TEXT, role TEXT, retry_at INTEGER DEFAULT 0,
                         PRIMARY KEY (order_id, role))""")
        last = queue.execute("SELECT last_number FROM cursor").fetchone()
        if last is None:
            # Activate for future purchases only. The first timer tick initializes this even without SMTP.
            high = source.execute("SELECT COALESCE(MAX(number), 0) FROM orders").fetchone()[0] if has_shop else 0
            queue.execute("INSERT INTO cursor VALUES (?)", (high,))
            return
        if not has_shop:
            return
        for order in source.execute("SELECT id, number FROM orders WHERE number > ? ORDER BY number LIMIT 200", last):
            queue.executemany("INSERT INTO deliveries(order_id, role) VALUES (?, ?)", [(order["id"], role) for role in ("admin", "buyer")])
            queue.execute("UPDATE cursor SET last_number = ?", (order["number"],))


def deliver_orders(source, queue, config, send):
    delivered = failed = 0
    jobs = queue.execute(
        "SELECT order_id, role FROM deliveries WHERE retry_at <= ? ORDER BY retry_at, rowid LIMIT 50",
        (time.time(),),
    ).fetchall()
    for order_id, role in jobs:
        order = source.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if order is None:
            # An order removed by a database restore can no longer be announced.
            with queue:
                queue.execute("DELETE FROM deliveries WHERE order_id = ?", (order_id,))
            continue
        items = source.execute("SELECT title, quantity, cover FROM order_items WHERE order_id = ? ORDER BY title", (order_id,))
        try:
            send(compose_order(order, items, role, config), config)
        except (ValueError, MessageError, smtplib.SMTPException, OSError) as error:
            print(f"Order {order['number']} ({role}): {type(error).__name__}", file=sys.stderr)
            with queue:
                queue.execute("UPDATE deliveries SET retry_at = ? WHERE order_id = ? AND role = ?", (int(time.time()) + 300, order_id, role))
            failed += 1
        else:
            with queue:
                queue.execute("DELETE FROM deliveries WHERE order_id = ? AND role = ?", (order_id, role))
            delivered += 1
    return delivered, failed


def order_notices(database, state, env, send):
    directory = Path(state).parent
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (directory / "order-mail.lock").open("a") as lock, closing(sqlite3.connect(
        Path(database).resolve().as_uri() + "?mode=ro", uri=True
    )) as source, closing(sqlite3.connect(directory / "order-mail.sqlite3")) as queue:
        fcntl.flock(lock, fcntl.LOCK_EX)
        source.row_factory = sqlite3.Row
        has_shop = source.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'orders'").fetchone()
        # Read on every run, so a contact email changed in /admin/magazin applies to the next order.
        config = settings({**env, "POETIO_NOTIFY_TO": order_recipient(source, env, has_shop)})
        if config:
            config["seller"] = seller_details(source, has_shop)
        queue_orders(source, queue, has_shop)
        delivered, failed = deliver_orders(source, queue, config, send) if config and has_shop else (0, 0)
        return {"configured": bool(config), "delivered": delivered, "failed": failed,
                "pending": queue.execute("SELECT COUNT(*) FROM deliveries").fetchone()[0]}


def compose(rows, config):
    count = len(rows)
    message = EmailMessage()
    message["Subject"] = "Poetio: un comentariu nou așteaptă moderare" if count == 1 else f"Poetio: {count} comentarii noi așteaptă moderare"
    message["From"], message["To"] = config["sender"], config["recipient"]
    parts = []
    for row in rows[:LIMIT]:
        when = dt.datetime.fromtimestamp(row["created_at"] / 1000, dt.timezone.utc).strftime("%d.%m.%Y, %H:%M UTC")
        where = LABELS[row["kind"]] + (f" „{row['title']}”" if row["title"] else "")
        text = " ".join(row["content"].split())
        parts.append(f"{where}\nDe la: {' '.join(row['name'].split())} · {when}\n{text[:EXCERPT]}{'…' if len(text) > EXCERPT else ''}")
    if count > LIMIT:
        parts.append(f"… și încă {count - LIMIT}.")
    intro = "Un comentariu nou așteaptă aprobarea ta." if count == 1 else f"{count} comentarii noi așteaptă aprobarea ta."
    message.set_content(f"{intro}\n\n" + "\n\n".join(parts) + f"\n\nModerare: {config['site']}/admin/comentarii\n\nComentariile nu apar pe site până nu le aprobi.\n")
    return message


def deliver(message, config, plain=smtplib.SMTP, secure=smtplib.SMTP_SSL):
    context = ssl.create_default_context()
    if config["mode"] == "ssl":
        server = secure(config["host"], config["port"], timeout=30, context=context)
    else:
        server = plain(config["host"], config["port"], timeout=30)
    with server:
        if config["mode"] == "starttls":
            server.starttls(context=context)
        if config["user"]:
            server.login(config["user"], config["password"])
        server.send_message(message)


def load(path):
    try:
        value = json.loads(Path(path).read_text())["notified_until"]
        return value if type(value) is int and value >= 0 else 0
    except (OSError, ValueError, KeyError, TypeError):
        return 0


def save(path, notified_until):
    path = Path(path)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump({"notified_until": notified_until}, output)
            output.write("\n")
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def run(database, state, env, send=deliver):
    config = settings(env)
    if config is None:
        return {"configured": False, "sent": 0}
    rows = pending(database, load(state))
    # Report only after the server accepted the message; a failure is retried.
    if rows:
        send(compose(rows, config), config)
        save(state, max(row["created_at"] for row in rows))
    return {"configured": True, "sent": len(rows)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=Path("/var/lib/poetio/poetio.sqlite3"))
    parser.add_argument("--state", type=Path, default=Path("/var/lib/poetio-notify/comments.json"))
    parser.add_argument("--check", action="store_true", help="Count pending comments and queued orders without sending any email.")
    parser.add_argument("--orders-only", action="store_true", help="Queue and deliver confirmations for new orders.")
    args = parser.parse_args()
    os.umask(0o077)
    if args.check:
        ledger = args.state.with_name("order-mail.sqlite3")
        orders = 0
        if ledger.exists():
            with closing(sqlite3.connect(ledger.resolve().as_uri() + "?mode=ro", uri=True)) as db:
                orders = db.execute("SELECT COUNT(DISTINCT order_id) FROM deliveries").fetchone()[0]
        print(json.dumps({"pending": len(pending(args.database, load(args.state))), "orders": orders}))
        return
    if args.orders_only:
        result = order_notices(args.database, args.state, os.environ, deliver)
        # Quiet while idle so a frequent timer does not fill the journal.
        if result["delivered"] or result.get("failed"):
            print(json.dumps(result))
        if result.get("failed"):
            sys.exit(1)
        return
    print(json.dumps(run(args.database, args.state, os.environ)))


if __name__ == "__main__":
    try:
        main()
    except (smtplib.SMTPException, OSError, sqlite3.Error, ValueError) as error:
        # Never print message contents or credentials; the error class is enough to diagnose.
        print(f"Comment notice failed: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)
