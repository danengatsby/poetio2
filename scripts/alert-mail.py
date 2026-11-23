#!/usr/bin/env python3
"""Email the owner when a Poetio job fails, and once more when it works again.

systemd starts it through poetio-alert@<unit>.service, from OnFailure= and, for the
jobs whose recovery matters, OnSuccess= in that job's unit:

    poetio-alert <unit>

After a failure it sends the job's last journal lines, at most once every
POETIO_ALERT_REPEAT_HOURS (default 6) per job; after a success that follows an alert
it sends one "working again" notice. SMTP settings come from /etc/poetio/notify.env,
the same account as the comment and order notices; the recipient is POETIO_ALERT_TO,
else POETIO_NOTIFY_TO. Without them the alert is only written to the journal.

The site check (poetio-heartbeat) runs on this server, so it cannot report a server
that is down: .github/workflows/uptime.yml checks the site from outside for that.
"""
import datetime as dt
from email.message import EmailMessage
import json
import os
from pathlib import Path
import re
import smtplib
import ssl
import subprocess
import sys
import time

STATE = Path(os.environ.get('STATE_DIRECTORY', '/var/lib/poetio-alert'))
UNIT = re.compile(r'^poetio-[a-z0-9-]+\.service$')
JOURNAL_LINES = 40

# What each job is, in the owner's words, and what a failure means for the site.
JOBS = {
    'poetio-backup.service': (
        'Copia de siguranță zilnică',
        'Nu s-a făcut copia de azi. Ultimele copii verificate rămân în /var/backups/poetio/automatic '
        'și pe Google Drive, dar până se rezolvă nu apar copii noi.',
    ),
    'poetio-offsite.service': (
        'Copia de pe Google Drive',
        'Copiile de pe server continuă; lipsește doar copia de azi de pe Drive. Cauza obișnuită este '
        'autorizarea Google Drive expirată sau spațiul plin acolo.',
    ),
    'poetio-heartbeat.service': (
        'Verificarea site-ului poetio.cloud',
        'Serverul funcționează, dar site-ul nu răspunde cum trebuie sau certificatul HTTPS expiră în '
        'mai puțin de 14 zile.',
    ),
    'poetio-geoip.service': (
        'Actualizarea lunară a localizării vizitelor',
        'Statistica vizitelor folosește în continuare baza de luna trecută.',
    ),
    'poetio-order-mail.service': (
        'Emailurile pentru comenzi',
        'Cumpărătorii sau tu s-ar putea să nu primească emailul pentru o comandă nouă. Comenzile '
        'rămân salvate în /admin/comenzi.',
    ),
    'poetio-notify.service': (
        'Notificările pentru comentarii',
        'Comentariile noi se văd în continuare în /admin/comentarii, dar nu primești email.',
    ),
}


def settings(env):
    """SMTP settings, or None while email is not configured (as in poetio-notify-comments)."""
    host = env.get('POETIO_SMTP_HOST', '').strip()
    recipient = env.get('POETIO_ALERT_TO', '').strip() or env.get('POETIO_NOTIFY_TO', '').strip()
    if not host or not recipient:
        return None
    port = int(env.get('POETIO_SMTP_PORT', '587'))
    user = env.get('POETIO_SMTP_USER', '').strip()
    mode = env.get('POETIO_SMTP_TLS', 'ssl' if port == 465 else 'starttls').strip().lower()
    if mode not in ('ssl', 'starttls'):
        raise ValueError('POETIO_SMTP_TLS must be ssl or starttls')
    return {
        'host': host, 'port': port, 'user': user, 'password': env.get('POETIO_SMTP_PASSWORD', ''), 'mode': mode,
        'sender': env.get('POETIO_NOTIFY_FROM', '').strip() or user or recipient, 'recipient': recipient,
        'repeat_seconds': float(env.get('POETIO_ALERT_REPEAT_HOURS', '6')) * 3600,
    }


def deliver(message, config, plain=smtplib.SMTP, secure=smtplib.SMTP_SSL):
    context = ssl.create_default_context()
    if config['mode'] == 'ssl':
        server = secure(config['host'], config['port'], timeout=30, context=context)
    else:
        server = plain(config['host'], config['port'], timeout=30)
    with server:
        if config['mode'] == 'starttls':
            server.starttls(context=context)
        if config['user']:
            server.login(config['user'], config['password'])
        server.send_message(message)


def unit_result(unit):
    """systemd's Result for the unit's last run ('success', 'exit-code', 'timeout', ...)."""
    show = subprocess.run(['systemctl', 'show', unit, '-p', 'Result', '-p', 'InvocationID'],
                          text=True, capture_output=True, check=True).stdout
    values = dict(line.split('=', 1) for line in show.splitlines() if '=' in line)
    return values.get('Result', ''), values.get('InvocationID', '')


def journal(unit, invocation):
    """The failed run's own lines when systemd still knows it, else the unit's last lines."""
    selector = [f'_SYSTEMD_INVOCATION_ID={invocation}'] if invocation else ['-u', unit]
    result = subprocess.run(['journalctl', *selector, '-n', str(JOURNAL_LINES), '--no-pager', '-o', 'short-iso'],
                            text=True, capture_output=True)
    lines = result.stdout.strip()
    if not lines and invocation:
        return journal(unit, '')
    return lines or '(jurnalul nu are rânduri pentru această rulare)'


def load(path):
    try:
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def save(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2) + '\n')
    temporary.replace(path)


def when(seconds):
    return dt.datetime.fromtimestamp(seconds, dt.timezone.utc).strftime('%d.%m.%Y, %H:%M UTC')


def compose(unit, config, failed, state, lines, now):
    label, meaning = JOBS.get(unit, (unit, ''))
    message = EmailMessage()
    message['From'], message['To'] = config['sender'], config['recipient']
    if failed:
        message['Subject'] = f'Poetio: {label} a eșuat'
        repeat = config['repeat_seconds'] / 3600
        again = (f'Dacă problema continuă, primești din nou acest mesaj peste {repeat:g} ore, nu la fiecare încercare, '
                 'și un mesaj separat când funcționează din nou.')
        count = state.get('failures', 1)
        since = f'Eșuează din {when(state["since"])} ({count} încercări).' if count > 1 else f'A eșuat la {when(now)}.'
        message.set_content(
            f'{label} ({unit}) nu a reușit.\n{since}\n\n{meaning}\n\n'
            f'Ultimele rânduri din jurnal:\n\n{lines}\n\n'
            f'Pe server, mai multe detalii: journalctl -u {unit} -n 100\n\n{again}\n')
    else:
        message['Subject'] = f'Poetio: {label} funcționează din nou'
        message.set_content(
            f'{label} ({unit}) a reușit din nou la {when(now)}.\n'
            f'Problema a început la {when(state["since"])} ({state.get("failures", 1)} încercări eșuate).\n')
    return message


def handle(unit, env, *, result=unit_result, read_journal=journal, send=deliver, now=None):
    """Returns the action taken: 'alert', 'repeat-later', 'recovered', 'ok', 'not-configured'."""
    now = time.time() if now is None else now
    state_file = STATE / f'{unit}.json'
    state = load(state_file)
    outcome, invocation = result(unit)
    failed = outcome != 'success'
    if not failed and not state.get('open'):
        return 'ok'
    config = settings(env)
    if failed:
        ongoing = bool(state.get('open'))
        state = {'open': True, 'since': state.get('since', now) if ongoing else now,
                 'failures': state.get('failures', 0) + 1 if ongoing else 1,
                 'last_sent': state.get('last_sent') if ongoing else None}
        # A new problem is reported at once; an ongoing one again only after the interval.
        if config and state['last_sent'] is not None and now - state['last_sent'] < config['repeat_seconds']:
            save(state_file, state)
            return 'repeat-later'
    if not config:
        print(f'{unit}: {"failed" if failed else "works again"}; no email is configured '
              '(POETIO_SMTP_HOST and POETIO_ALERT_TO or POETIO_NOTIFY_TO in /etc/poetio/notify.env).', file=sys.stderr)
        save(state_file, state if failed else {})
        return 'not-configured'
    message = compose(unit, config, failed, state, read_journal(unit, invocation) if failed else '', now)
    if failed:
        save(state_file, state)  # the failure count survives an SMTP error; the next failure retries
    send(message, config)
    if failed:
        state['last_sent'] = now
        save(state_file, state)
        return 'alert'
    save(state_file, {})
    return 'recovered'


def main(argv):
    if len(argv) != 2 or not UNIT.match(argv[1]):
        print(__doc__.split('\n\n')[1], file=sys.stderr)
        return 64
    try:
        action = handle(argv[1], os.environ)
    except (OSError, ValueError, smtplib.SMTPException, subprocess.CalledProcessError) as error:
        print(f'{argv[1]}: the alert could not be sent: {type(error).__name__}: {error}', file=sys.stderr)
        return 1
    if action != 'ok':
        print(f'{argv[1]}: {action}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
