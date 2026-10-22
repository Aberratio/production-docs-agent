import type { MessageKey } from './en.ts';

type PluralBase = 'data.summary.open' | 'export.open';
type PolishKey = Exclude<MessageKey, `${PluralBase}.${string}`> | `${PluralBase}.${PolishPlural}`;
type PolishPlural = 'one' | 'few' | 'many' | 'other';

/** Polish UI dictionary — same keys as `en.ts`, with the Polish plural forms. */
export const pl: Record<PolishKey, string> = {
  'app.title': 'Agent dokumentów produkcyjnych',
  'app.pageTitle': 'Agent dokumentów produkcyjnych · kokot.it',
  'app.tagline':
    'Zamówienia i raporty jakości na wejściu, rekordy ERP na wyjściu — każde niepewne pole trafia do człowieka.',
  'mode.live': 'Na żywo (Claude API)',
  'mode.live.hint': 'Ekstrakcje wywołują Claude API z lokalnego serwera.',
  'mode.recorded': 'Zapisany przebieg',
  'mode.recorded.hint': 'Odtwarza zapisane ekstrakcje. Bez wywołań API.',
  'lang.label': 'Język',

  'tabs.label': 'Przykładowe dokumenty',
  'tabs.format.pdf': 'PDF',
  'tabs.format.email': 'e-mail',
  'tabs.toReview': '{count} do sprawdzenia',
  'tabs.ready': 'gotowe',

  'doc.aria': 'Dokument {title}',
  'doc.kind.purchase_order': 'Zamówienie',
  'doc.kind.quality_report': 'Raport jakości',
  'doc.open.pdf': 'Otwórz PDF',
  'doc.open.email': 'Otwórz e-mail',
  'doc.extract': 'Wyodrębnij z Claude',
  'doc.extracting': 'Wyodrębnianie…',
  'doc.liveFailed': 'Ekstrakcja na żywo nie powiodła się: {error}',

  'docs.po-001.title': 'Zamówienie ZK/2026/0412',
  'docs.po-001.scenario': 'Poprawne zamówienie — wszystkie pola obecne i spójne.',
  'docs.po-002.title': 'Zamówienie TM-7781',
  'docs.po-002.scenario':
    'Zamówienie w e-mailu: „03/11” bez roku, przybliżona ilość, niejasne warunki płatności.',
  'docs.po-003.title': 'Zamówienie 2026/10/055',
  'docs.po-003.scenario':
    'Brakujące pola: bez daty i adresu dostawy, jedna pozycja bez kodu i ceny.',
  'docs.po-004.title': 'Zamówienie ZK/2026/0430',
  'docs.po-004.scenario':
    'Sprzeczności: ilość a uwaga, suma a pozycje, dostawa przed datą zamówienia.',
  'docs.po-005.title': 'PO 4500-2210',
  'docs.po-005.scenario':
    'Poprawne zamówienie po angielsku, w EUR, z datami zapisanymi z kropkami.',
  'docs.qr-001.title': 'Raport jakości RKJ/2026/118',
  'docs.qr-001.scenario': 'Poprawny raport kontroli — przyjęto w granicy liczby akceptacji.',
  'docs.qr-002.title': 'Raport jakości RKJ/2026/121',
  'docs.qr-002.scenario': 'Sprzeczność: partię przyjęto, choć wady przekraczają liczbę akceptacji.',
  'docs.qr-003.title': 'Reklamacja WSP-60',
  'docs.qr-003.scenario':
    'Reklamacja e-mailem: bez numeru raportu i partii, nieprecyzyjna liczba wad, bez decyzji.',

  'data.eyebrow.sales_order': 'ERP · zamówienie sprzedaży',
  'data.eyebrow.quality_inspection': 'ERP · kontrola jakości',
  'data.title': 'Wyodrębniony rekord',
  'data.run.live': 'Przebieg na żywo · {model} · {at}',
  'data.run.unknownModel': 'nieznany model',
  'data.run.recorded': 'Zapisany przebieg · przygotowany ręcznie według schematu ekstrakcji',
  'data.summary.open.one': 'pole do sprawdzenia',
  'data.summary.open.few': 'pola do sprawdzenia',
  'data.summary.open.many': 'pól do sprawdzenia',
  'data.summary.open.other': 'pola do sprawdzenia',
  'data.summary.ready': 'gotowe do ERP',
  'data.summary.decided': 'Twoje decyzje: {count}',
  'data.group.header': 'Nagłówek',
  'data.group.line': 'Pozycja {n} · {code}',
  'data.group.noCode': 'bez kodu towaru',

  'field.confidence': 'Pewność modelu',
  'field.was': 'model: {value}',
  'field.correctAria': 'Popraw: {label}',
  'field.datePlaceholder': 'RRRR-MM-DD',
  'field.aria': '{label}: {status}',

  'conf.high': 'wysoka',
  'conf.medium': 'średnia',
  'conf.low': 'niska',

  'status.auto': 'auto',
  'status.needs_review': 'do sprawdzenia',
  'status.approved': 'zatwierdzone',
  'status.corrected': 'poprawione',

  'issueCode.missing': 'Brak',
  'issueCode.uncertain': 'Niepewne',
  'issueCode.invalid': 'Błędne',
  'issueCode.not_in_document': 'Spoza dokumentu',
  'issueCode.inconsistent': 'Sprzeczność',

  'action.save': 'Zapisz',
  'action.cancel': 'Anuluj',
  'action.approve': 'Zatwierdź',
  'action.correct': 'Popraw…',
  'action.edit': 'Edytuj',
  'action.undo': 'Cofnij',

  'export.csv': 'Eksport CSV',
  'export.xlsx': 'Eksport XLSX (wszystkie dokumenty)',
  'export.failed': 'Eksport nie powiódł się: {error}',
  'export.open.one':
    '{count} otwarte pole trafia do eksportu puste i jest wymienione w open_fields — nic niesprawdzonego nie trafia do ERP.',
  'export.open.few':
    '{count} otwarte pola trafiają do eksportu puste i są wymienione w open_fields — nic niesprawdzonego nie trafia do ERP.',
  'export.open.many':
    '{count} otwartych pól trafia do eksportu pustych i jest wymienionych w open_fields — nic niesprawdzonego nie trafia do ERP.',
  'export.open.other':
    'Otwarte pola ({count}) trafiają do eksportu puste i są wymienione w open_fields — nic niesprawdzonego nie trafia do ERP.',
  'export.allResolved': 'Wszystkie pola rozstrzygnięte ({count}).',
  'export.json': 'Rekord ERP (JSON)',

  'foot.note': 'Dane przykładowe · fikcyjne firmy',

  'field.purchase_order.order_number': 'Numer zamówienia',
  'field.purchase_order.order_date': 'Data zamówienia',
  'field.purchase_order.customer_name': 'Zamawiający',
  'field.purchase_order.contact_person': 'Osoba kontaktowa',
  'field.purchase_order.delivery_date': 'Termin dostawy',
  'field.purchase_order.delivery_address': 'Adres dostawy',
  'field.purchase_order.currency': 'Waluta',
  'field.purchase_order.payment_terms': 'Warunki płatności',
  'field.purchase_order.total_net': 'Suma netto',
  'field.purchase_order.lines': 'Pozycje zamówienia',
  'field.line.item_code': 'kod towaru',
  'field.line.description': 'opis',
  'field.line.quantity': 'ilość',
  'field.line.unit': 'jednostka',
  'field.line.unit_price': 'cena jednostkowa',
  'field.line.label': 'Pozycja {n} · {field}',
  'field.quality_report.report_number': 'Numer raportu',
  'field.quality_report.report_date': 'Data kontroli',
  'field.quality_report.item_code': 'Kod wyrobu',
  'field.quality_report.batch_number': 'Partia',
  'field.quality_report.order_reference': 'Dotyczy zamówienia',
  'field.quality_report.inspected_qty': 'Skontrolowano (szt.)',
  'field.quality_report.acceptance_number': 'Liczba akceptacji (Ac)',
  'field.quality_report.nonconforming_qty': 'Niezgodne (szt.)',
  'field.quality_report.defect_description': 'Opis niezgodności',
  'field.quality_report.decision': 'Decyzja',
  'field.quality_report.inspector': 'Kontroler',

  'rule.text': 'Oczekiwano niepustego tekstu.',
  'rule.date': '„{value}” nie jest jednoznaczną datą (RRRR-MM-DD).',
  'rule.money': 'Oczekiwano kwoty równej zero lub większej.',
  'rule.count': 'Oczekiwano całkowitej liczby sztuk.',
  'rule.quantity': 'Oczekiwano ilości większej od zera.',
  'rule.quantityWhole': 'Ilość w sztukach musi być liczbą całkowitą.',
  'rule.decision': 'Oczekiwano: accepted, rejected lub conditional.',
  'rule.number': 'Wpisz liczbę, np. 1 234,50.',
  'issue.missing': 'Pole wymagane, ale nie znaleziono go w dokumencie.',
  'issue.unreadable': 'Dokument wspomina tę wartość, ale nie udało się jej odczytać.',
  'issue.unsure.medium': 'Model nie był pewny tej wartości (średnia pewność).',
  'issue.unsure.low': 'Model nie był pewny tej wartości (niska pewność).',
  'issue.noQuote': 'Brak cytatu źródłowego — tej wartości nie da się powiązać z dokumentem.',
  'issue.quoteMissing': 'Cytat źródłowy „{quote}” nie występuje w dokumencie.',
  'issue.noLines': 'Nie znaleziono w dokumencie pozycji zamówienia.',
  'issue.modelNote': '{note}',
  'notation.noYear': '„{date}” nie ma roku — rok został przyjęty.',
  'notation.swappable': '„{date}” można odczytać z zamienionym dniem i miesiącem.',
  'notation.approximate': '„{source}” to przybliżenie, a nie dokładna liczba.',
  'cross.overInspected': 'Niezgodnych sztuk: {bad} na {inspected} skontrolowanych.',
  'cross.acceptedOverAc':
    'Partię przyjęto, choć liczba niezgodnych sztuk ({bad}) przekracza liczbę akceptacji {ac}.',
  'cross.deliveryBeforeOrder': 'Termin dostawy {delivery} jest przed datą zamówienia {ordered}.',
  'cross.totalMismatch': 'Podana suma {total} różni się od sumy pozycji {sum}.',
  'decision.linesPlaceholder':
    'Pozycji zamówienia nie można tu wpisać — popraw dokument albo dodaj je w ERP.',
  'decision.nothingToApprove': 'Nie ma czego zatwierdzić — wpisz poprawną wartość.',
};
