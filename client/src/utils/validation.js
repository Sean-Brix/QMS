/* ============================================================================
   validation.js — field checks shared by the account and personnel forms.
   ========================================================================== */

export function isEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Usernames are lowercase letters, digits, dots, dashes and underscores. */
export function usernameProblem(value, existing = []) {
  const name = value.trim().toLowerCase()
  if (!name) return 'Enter a username.'
  if (!/^[a-z0-9._-]{3,32}$/.test(name))
    return 'Use 3–32 lowercase letters, numbers, dots, dashes or underscores.'
  if (existing.some((account) => account.username.toLowerCase() === name))
    return `The username “${name}” is already taken.`
  return ''
}
