`password-protected.pdf` este o pagină goală, creată pentru testele Poetio cu pypdf 6.19.0. Parola de utilizator este `poetio-test`, iar parola proprietarului este `owner-test`; sunt valori publice de test. Fișierul nu conține conținut de utilizator. Generatorul nu este o dependență a aplicației sau a testelor.

```python
from pypdf import PdfWriter
writer = PdfWriter()
writer.add_blank_page(width=300, height=400)
writer.encrypt(user_password='poetio-test', owner_password='owner-test', use_128bit=False)
with open('password-protected.pdf', 'wb') as output:
    writer.write(output)
```

Celelalte documente demonstrative sunt produse de `tests/book-fixture.mjs`, inclusiv documentul cu prima pagină validă și a doua pagină cu un flux Flate deteriorat.
