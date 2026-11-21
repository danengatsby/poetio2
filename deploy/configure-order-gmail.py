#!/usr/bin/python3 -I
"""Configure the order sender interactively on the Poetio VPS."""
import getpass
import os
from pathlib import Path
import re
import smtplib
import ssl
import sys
import tempfile


def main():
    if os.geteuid() != 0 or not sys.stdin.isatty():
        sys.exit("Rulează comanda cu sudo într-un terminal interactiv.")
    path = Path("/etc/poetio/notify.env")
    old = path.read_text().splitlines() if path.exists() else []
    current = next((line.partition("=")[2].strip() for line in old if line.partition("=")[0].strip() == "POETIO_SMTP_USER"), "")
    prompt = f"Contul Gmail care trimite mesajele [{current}]: " if current else "Contul Gmail care trimite mesajele: "
    account = input(prompt).strip() or current
    if not re.fullmatch(r"[^\s@,]+@[^\s@,]+\.[^\s@,]+", account):
        sys.exit("Scrie adresa completă a contului Gmail, de exemplu nume@gmail.com.")
    password = "".join(getpass.getpass(f"Parola de aplicație nouă pentru {account}: ").split())
    if not re.fullmatch(r"[A-Za-z0-9]{16}", password):
        sys.exit("Parola de aplicație trebuie să aibă 16 caractere. Poți lipi codul cu spații.")
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=15) as mail:
            mail.login(account, password)
    except smtplib.SMTPAuthenticationError:
        sys.exit("Gmail a refuzat autentificarea. Verifică adresa contului și parola de aplicație.")
    except (OSError, smtplib.SMTPException):
        sys.exit("Conexiunea la Gmail a eșuat. Poți încerca din nou.")
    values = {"POETIO_SMTP_HOST": "smtp.gmail.com", "POETIO_SMTP_PORT": "465", "POETIO_SMTP_TLS": "ssl",
              "POETIO_SMTP_USER": account, "POETIO_SMTP_PASSWORD": password, "POETIO_NOTIFY_FROM": account}
    fd, tmp = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w") as out:
            for line in old:
                if line.partition("=")[0].strip() not in values:
                    print(line, file=out)
            for key, value in values.items():
                print(f"{key}={value}", file=out)
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)
    print("Autentificarea la Gmail a reușit. Serviciul va prelua automat mesajele în așteptare.")


if __name__ == "__main__":
    main()
