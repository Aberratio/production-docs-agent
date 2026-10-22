/**
 * English UI dictionary — the reference set of keys. `pl.ts` must define the same keys
 * (tests/i18n.test.ts). Plural messages use `.one` / `.other` suffixes; Polish adds `.few` / `.many`.
 * Placeholders are written as `{name}`.
 */
export const en = {
  'app.title': 'Production docs agent',
  'app.pageTitle': 'Production docs agent · kokot.it',
  'app.tagline':
    'Orders and quality reports in, ERP records out — every uncertain field goes to a human.',
  'mode.live': 'Live (Claude API)',
  'mode.live.hint': 'Extractions call the Claude API from the local server.',
  'mode.recorded': 'Recorded run',
  'mode.recorded.hint': 'Replays saved extractions. No API calls.',
  'lang.label': 'Language',

  'tabs.label': 'Sample documents',
  'tabs.format.pdf': 'PDF',
  'tabs.format.email': 'e-mail',
  'tabs.toReview': '{count} to review',
  'tabs.ready': 'ready',

  'doc.aria': 'Document {title}',
  'doc.kind.purchase_order': 'Purchase order',
  'doc.kind.quality_report': 'Quality report',
  'doc.open.pdf': 'Open PDF',
  'doc.open.email': 'Open e-mail',
  'doc.extract': 'Extract with Claude',
  'doc.extracting': 'Extracting…',
  'doc.liveFailed': 'Live extraction failed: {error}',

  'docs.po-001.title': 'Purchase order ZK/2026/0412',
  'docs.po-001.scenario': 'Clean purchase order — every field present and consistent.',
  'docs.po-002.title': 'Order TM-7781',
  'docs.po-002.scenario':
    'Order in an e-mail: "03/11" without a year, an approximate quantity, vague payment terms.',
  'docs.po-003.title': 'Purchase order 2026/10/055',
  'docs.po-003.scenario':
    'Missing fields: no delivery date or address, one line without code and price.',
  'docs.po-004.title': 'Purchase order ZK/2026/0430',
  'docs.po-004.scenario':
    'Contradictions: quantity vs remark, total vs lines, delivery before order date.',
  'docs.po-005.title': 'PO 4500-2210',
  'docs.po-005.scenario': 'Clean English order in EUR with dotted European dates.',
  'docs.qr-001.title': 'Quality report RKJ/2026/118',
  'docs.qr-001.scenario': 'Clean inspection report — accepted within the acceptance number.',
  'docs.qr-002.title': 'Quality report RKJ/2026/121',
  'docs.qr-002.scenario':
    'Contradiction: batch accepted although defects exceed the acceptance number.',
  'docs.qr-003.title': 'Complaint WSP-60',
  'docs.qr-003.scenario':
    'Complaint e-mail: no report or batch number, a vague defect count, no decision.',

  'data.eyebrow.sales_order': 'ERP · sales order',
  'data.eyebrow.quality_inspection': 'ERP · quality inspection',
  'data.title': 'Extracted record',
  'data.run.live': 'Live run · {model} · {at}',
  'data.run.unknownModel': 'unknown model',
  'data.run.recorded': 'Recorded run · hand-authored to the extraction schema',
  'data.summary.open.one': 'field needs review',
  'data.summary.open.other': 'fields need review',
  'data.summary.ready': 'ready for ERP',
  'data.summary.decided': '{count} decided by you',
  'data.group.header': 'Header',
  'data.group.line': 'Line {n} · {code}',
  'data.group.noCode': 'no item code',

  'field.confidence': 'Model confidence',
  'field.was': 'model: {value}',
  'field.correctAria': 'Correct {label}',
  'field.datePlaceholder': 'YYYY-MM-DD',
  'field.aria': '{label}: {status}',

  'conf.high': 'high',
  'conf.medium': 'medium',
  'conf.low': 'low',

  'status.auto': 'auto',
  'status.needs_review': 'needs review',
  'status.approved': 'approved',
  'status.corrected': 'corrected',

  'issueCode.missing': 'Missing',
  'issueCode.uncertain': 'Uncertain',
  'issueCode.invalid': 'Invalid',
  'issueCode.not_in_document': 'Not in document',
  'issueCode.inconsistent': 'Contradiction',

  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.approve': 'Approve',
  'action.correct': 'Correct…',
  'action.edit': 'Edit',
  'action.undo': 'Undo',

  'export.csv': 'Export CSV',
  'export.xlsx': 'Export XLSX (all documents)',
  'export.failed': 'Export failed: {error}',
  'export.open.one':
    '{count} open field is exported empty and listed in open_fields — nothing unreviewed reaches the ERP.',
  'export.open.other':
    '{count} open fields are exported empty and listed in open_fields — nothing unreviewed reaches the ERP.',
  'export.allResolved': 'All {count} fields resolved.',
  'export.json': 'ERP record (JSON)',

  'foot.note': 'Sample data · fictional companies',

  // Field labels (also the English labels in the review log export).
  'field.purchase_order.order_number': 'Order number',
  'field.purchase_order.order_date': 'Order date',
  'field.purchase_order.customer_name': 'Customer',
  'field.purchase_order.contact_person': 'Contact person',
  'field.purchase_order.delivery_date': 'Delivery date',
  'field.purchase_order.delivery_address': 'Delivery address',
  'field.purchase_order.currency': 'Currency',
  'field.purchase_order.payment_terms': 'Payment terms',
  'field.purchase_order.total_net': 'Total net',
  'field.purchase_order.lines': 'Order lines',
  'field.line.item_code': 'item code',
  'field.line.description': 'description',
  'field.line.quantity': 'quantity',
  'field.line.unit': 'unit',
  'field.line.unit_price': 'unit price',
  'field.line.label': 'Line {n} · {field}',
  'field.quality_report.report_number': 'Report number',
  'field.quality_report.report_date': 'Inspection date',
  'field.quality_report.item_code': 'Item code',
  'field.quality_report.batch_number': 'Batch',
  'field.quality_report.order_reference': 'Order reference',
  'field.quality_report.inspected_qty': 'Inspected (pcs)',
  'field.quality_report.acceptance_number': 'Acceptance number (Ac)',
  'field.quality_report.nonconforming_qty': 'Nonconforming (pcs)',
  'field.quality_report.defect_description': 'Defect description',
  'field.quality_report.decision': 'Decision',
  'field.quality_report.inspector': 'Inspector',

  // Review messages (domain rules).
  'rule.text': 'Expected non-empty text.',
  'rule.date': '"{value}" is not an unambiguous date (YYYY-MM-DD).',
  'rule.money': 'Expected an amount of zero or more.',
  'rule.count': 'Expected a whole number of pieces.',
  'rule.quantity': 'Expected a quantity greater than zero.',
  'rule.quantityWhole': 'Quantity in pieces must be a whole number.',
  'rule.decision': 'Expected accepted, rejected or conditional.',
  'rule.number': 'Enter a number, e.g. 1 234,50.',
  'issue.missing': 'Required, but not found in the document.',
  'issue.unreadable': 'The document mentions this value but it could not be read.',
  'issue.unsure.medium': 'The model was not sure about this value (medium confidence).',
  'issue.unsure.low': 'The model was not sure about this value (low confidence).',
  'issue.noQuote': 'No source quote — this value cannot be traced to the document.',
  'issue.quoteMissing': 'Quoted source "{quote}" does not appear in the document.',
  'issue.noLines': 'No order lines found in the document.',
  'issue.modelNote': '{note}',
  'notation.noYear': '"{date}" has no year — the year was assumed.',
  'notation.swappable': '"{date}" could be read as day and month either way round.',
  'notation.approximate': '"{source}" is an approximation, not an exact count.',
  'cross.overInspected': '{bad} nonconforming parts out of {inspected} inspected.',
  'cross.acceptedOverAc':
    'Batch accepted although {bad} nonconforming parts exceed the acceptance number {ac}.',
  'cross.deliveryBeforeOrder': 'Delivery date {delivery} is before the order date {ordered}.',
  'cross.totalMismatch': 'Stated total {total} differs from the sum of the lines {sum}.',
  'decision.linesPlaceholder':
    'Order lines cannot be typed in here — fix the document or add them in the ERP.',
  'decision.nothingToApprove': 'Nothing to approve — enter the correct value.',
} as const;

export type MessageKey = keyof typeof en;
