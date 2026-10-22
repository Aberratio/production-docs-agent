import type {
  ExtractedField,
  PurchaseOrderExtraction,
  QualityReportExtraction,
} from '../../src/domain/schema.ts';

/**
 * Sample values from the Polish fixture documents, for tests that assert on them. Like the sample
 * documents, these are data and stay in Polish.
 */
export const SAMPLE = {
  contactPerson: 'Jan Przykładowy',
  shaft: 'Wałek',
  inspector: 'Piotr Próbny',
  /** "ACCEPTED" as a Polish quality report writes it. */
  acceptedPl: 'PRZYJĘTO',
  /** "about 10 pcs" with the unabbreviated Polish word for "about". */
  aboutTenPieces: 'około 10 szt.',
} as const;

/** A field the model is sure about, quoted verbatim from the document. */
export function sure<T>(value: T, source_text: string = String(value)): ExtractedField<T> {
  return { value, confidence: 'high', source_text, note: null };
}

/** The document clearly does not state this value (high confidence that it is absent). */
export function absent<T>(note = 'Not stated in the document.'): ExtractedField<T> {
  return { value: null, confidence: 'high', source_text: null, note };
}

/** The document mentions the value but the model could not resolve it, so it left it empty. */
export function unresolved<T>(source_text: string, note: string): ExtractedField<T> {
  return { value: null, confidence: 'low', source_text, note };
}

/** Text of a small, fully consistent order — every `sure()` quote below occurs in it. */
export const ORDER_TEXT = `ZAMÓWIENIE NR ZK/1
Data zamówienia: 2026-10-14
Zamawiający: Odlewnia Fikcyjna Sp. z o.o.
Osoba kontaktowa: Jan Przykładowy
Termin dostawy: 2026-11-06
Miejsce dostawy: Magazyn B
Waluta: PLN
Warunki płatności: przelew 30 dni
| 1 | WAL-20 | Wałek | 10 | szt. | 2,50 |
| 2 | TUL-35 | Tuleja | 4 | szt. | 5,00 |
Razem netto: 45,00 PLN`;

export function cleanOrder(): PurchaseOrderExtraction {
  return {
    order_number: sure('ZK/1'),
    order_date: sure('2026-10-14'),
    customer_name: sure('Odlewnia Fikcyjna Sp. z o.o.'),
    contact_person: sure('Jan Przykładowy'),
    delivery_date: sure('2026-11-06'),
    delivery_address: sure('Magazyn B'),
    currency: sure('PLN'),
    payment_terms: sure('przelew 30 dni'),
    total_net: sure(45, '45,00 PLN'),
    lines: [
      {
        item_code: sure('WAL-20'),
        description: sure('Wałek'),
        quantity: sure(10, '10'),
        unit: sure('szt.'),
        unit_price: sure(2.5, '2,50'),
      },
      {
        item_code: sure('TUL-35'),
        description: sure('Tuleja'),
        quantity: sure(4, '4'),
        unit: sure('szt.'),
        unit_price: sure(5, '5,00'),
      },
    ],
  };
}

export const REPORT_TEXT = `RAPORT KONTROLI JAKOŚCI NR RKJ/1
Data kontroli: 2026-10-15
Wyrób: WAL-20
Partia: P-1
Dotyczy zamówienia: ZK/1
Liczba sztuk skontrolowanych: 80
Liczba akceptowana (Ac): 2
Liczba sztuk niezgodnych: 1
Opis niezgodności: rysa
Decyzja: PRZYJĘTO
Kontroler: Piotr Próbny`;

export function cleanReport(): QualityReportExtraction {
  return {
    report_number: sure('RKJ/1'),
    report_date: sure('2026-10-15'),
    item_code: sure('WAL-20'),
    batch_number: sure('P-1'),
    order_reference: sure('ZK/1'),
    inspected_qty: sure(80, 'skontrolowanych: 80'),
    acceptance_number: sure(2, '(Ac): 2'),
    nonconforming_qty: sure(1, 'niezgodnych: 1'),
    defect_description: sure('rysa'),
    decision: sure('accepted' as const, 'PRZYJĘTO'),
    inspector: sure('Piotr Próbny'),
  };
}
