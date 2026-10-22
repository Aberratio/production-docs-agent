/**
 * Polish translations of the model notes in the recorded runs (`recordings/*.json`). The notes are
 * model output and stay in English in the recordings; the Polish UI shows them through this map.
 * tests/i18n.test.ts fails when a recorded note has no translation. Notes from a live run that are
 * not listed here are shown as the model wrote them.
 */
export const RECORDED_NOTES_PL: Readonly<Record<string, string>> = {
  'No order date in the text; this is the date the e-mail was sent.':
    'W treści nie ma daty zamówienia; to data wysłania e-maila.',
  '"03/11" has no year and could mean 3 November or 11 March; read as DD/MM in 2026.':
    '„03/11” nie ma roku i może oznaczać 3 listopada albo 11 marca; odczytano jako DD/MM w 2026.',
  'Assembled from a sentence; no postal code given.':
    'Złożone ze zdania; nie podano kodu pocztowego.',
  '"Standardowo" refers to standard terms that are not stated in this e-mail.':
    '„Standardowo” odnosi się do standardowych warunków, których ten e-mail nie podaje.',
  'No total stated in the e-mail.': 'E-mail nie podaje sumy.',
  'Approximate quantity ("ok." = about 500).': 'Ilość przybliżona („ok.” = około 500).',
  'Delivery date is "do uzgodnienia" (to be agreed) — no date given.':
    'Termin dostawy „do uzgodnienia” — nie podano daty.',
  'Only the customer’s registered address is given; no delivery address is stated.':
    'Podano tylko adres siedziby zamawiającego; adresu dostawy brak.',
  'Not stated in the document.': 'Dokument tego nie podaje.',
  'Item code column shows a dash.': 'W kolumnie kodu towaru jest kreska.',
  'Price column is empty for this line.': 'Kolumna ceny jest pusta dla tej pozycji.',
  'The table says 1200, but the remark says "łącznie 1 000 szt." for the same item.':
    'Tabela podaje 1200, a uwaga dla tej samej pozycji mówi „łącznie 1 000 szt.”.',
  'A customer complaint e-mail; it has no report number.':
    'E-mail z reklamacją klienta; nie ma numeru raportu.',
  'Date the complaint was sent; the inspection date is not stated.':
    'Data wysłania reklamacji; data kontroli nie jest podana.',
  'The customer states the label has no batch number.':
    'Klient podaje, że na etykiecie nie ma numeru partii.',
  '"Kilkanaście" means roughly 11–19; the exact count is not given.':
    '„Kilkanaście” to około 11–19; dokładnej liczby nie podano.',
  'The customer asks for a decision; none has been taken yet.':
    'Klient prosi o decyzję; jeszcze jej nie podjęto.',
  'The customer’s quality contact, not the supplier’s inspector.':
    'Osoba od jakości po stronie klienta, nie kontroler dostawcy.',
};
