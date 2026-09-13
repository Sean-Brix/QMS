/* ============================================================================
   password.js — the moderate password policy (Confirmed requirement #7) and
   temporary passwords for accounts handed over by a QMS Admin (#5).
   ========================================================================== */

import { SESSION_RULES } from '@/config/appConfig'

/** The policy as it stands now — built on each call, so a saved settings change applies at once. */
export function passwordRules() {
  return [
    {
      key: 'length',
      label: `At least ${SESSION_RULES.passwordMinLength} characters`,
      test: (value) => value.length >= SESSION_RULES.passwordMinLength,
    },
    ...(SESSION_RULES.passwordRequiresLetterAndNumber
      ? [
          { key: 'letter', label: 'At least one letter', test: (value) => /[A-Za-z]/.test(value) },
          { key: 'number', label: 'At least one number', test: (value) => /\d/.test(value) },
        ]
      : []),
  ]
}

/** Labels of the rules `value` does not yet meet; empty when it passes. */
export function passwordProblems(value = '') {
  return passwordRules()
    .filter((rule) => !rule.test(value))
    .map((rule) => rule.label)
}

const WORDS = ['harbor', 'cedar', 'summit', 'lantern', 'meadow', 'copper', 'orbit', 'falcon', 'willow', 'ember']

/** A readable one-time password that always satisfies the policy, e.g. "Cedar-4821". */
export function temporaryPassword() {
  const random = new Uint32Array(2)
  globalThis.crypto.getRandomValues(random)
  const word = WORDS[random[0] % WORDS.length]
  const digits = String(1000 + (random[1] % 9000))
  return `${word[0].toUpperCase()}${word.slice(1)}-${digits}`
}
