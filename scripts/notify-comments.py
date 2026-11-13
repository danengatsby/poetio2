#!/usr/bin/env python3
"""Email the site owner when reader comments are waiting for moderation.

Runs from a systemd timer. It reads the Poetio database read-only, sends one
message that lists every comment still pending since the last notice, and
remembers how far it has reported. Without SMTP settings it does nothing.
"""
import argparse
from contextlib import closing
import datetime as dt
from email.message import EmailMessage
import json
import os
from pathlib import Path
import smtplib
import sqlite3
import ssl
import sys
import tempfile

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
    if not rows:
        return {"configured": True, "sent": 0}
    # Report only after the server accepted the message; a failure is retried.
    send(compose(rows, config), config)
    save(state, max(row["created_at"] for row in rows))
    return {"configured": True, "sent": len(rows)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=Path("/var/lib/poetio/poetio.sqlite3"))
    parser.add_argument("--state", type=Path, default=Path("/var/lib/poetio-notify/comments.json"))
    parser.add_argument("--check", action="store_true", help="Count the comments that would be announced; send and record nothing.")
    args = parser.parse_args()
    os.umask(0o077)
    if args.check:
        print(json.dumps({"pending": len(pending(args.database, load(args.state)))}))
        return
    print(json.dumps(run(args.database, args.state, os.environ)))


if __name__ == "__main__":
    try:
        main()
    except (smtplib.SMTPException, OSError, sqlite3.Error, ValueError) as error:
        # Never print message contents or credentials; the error class is enough to diagnose.
        print(f"Comment notice failed: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)
