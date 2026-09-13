/* ============================================================================
   watermark.js — dynamic watermark templates (Confirmed #18; follow-up C3).
   ----------------------------------------------------------------------------
   QMS Admin keeps reusable templates in System Settings and decides, per
   document, whether its downloads are watermarked and with which template —
   different document types need different wording. A template is plain text
   with placeholders filled in at download; anything else, such as
   CONTROLLED COPY, is stamped as written.
   ========================================================================== */

import { DOCUMENT_RULES } from '@/config/appConfig'

export const WATERMARK_PLACEHOLDERS = [
  { token: 'DEPARTMENT', label: 'Department of the account downloading', sample: 'Production' },
  { token: 'ACCOUNT', label: 'Account name', sample: 'Production Department' },
  { token: 'PERSONNEL', label: 'Person downloading', sample: 'Ramon Dela Cruz' },
  { token: 'DATETIME', label: 'Download date and time', sample: '31 Aug 2026, 09:00 AM' },
  { token: 'DOC_CODE', label: 'Document code', sample: 'QMS-OP-003' },
  { token: 'REVISION', label: 'Revision number', sample: '4' },
]

export const WATERMARK_SAMPLE = Object.fromEntries(WATERMARK_PLACEHOLDERS.map((item) => [item.token, item.sample]))

/** Fills a template's placeholders; unknown ones are left as written. */
export function renderWatermark(template, values = WATERMARK_SAMPLE) {
  return String(template || '').replace(/\{([A-Z_]+)\}/g, (match, token) =>
    token in values ? String(values[token] ?? '') : match,
  )
}

/** Placeholders in a template that the system does not fill in. */
export function unknownPlaceholders(template) {
  const known = new Set(WATERMARK_PLACEHOLDERS.map((item) => item.token))
  return [...String(template || '').matchAll(/\{([^}]*)\}/g)].map((match) => match[1]).filter((token) => !known.has(token))
}

export function watermarkTemplateById(id) {
  return DOCUMENT_RULES.watermarkTemplates?.find((item) => item.id === id) || null
}

/** The template a document's downloads are stamped with, or null when it carries no watermark. */
export function watermarkTemplateFor(doc) {
  if (!doc?.watermark) return null
  return (
    watermarkTemplateById(doc.watermarkTemplateId) ||
    watermarkTemplateById(DOCUMENT_RULES.defaultWatermarkTemplateId) ||
    DOCUMENT_RULES.watermarkTemplates?.[0] ||
    null
  )
}

/** Watermarked documents stamped with a template: those naming it, and those left on the default. */
export function documentsUsingTemplate(documents, templateId, defaultId = DOCUMENT_RULES.defaultWatermarkTemplateId) {
  return documents.filter(
    (doc) => doc.watermark && (doc.watermarkTemplateId ? doc.watermarkTemplateId === templateId : templateId === defaultId),
  )
}
