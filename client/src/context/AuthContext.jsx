/* ============================================================================
   AuthContext — mock session, role-based permission gate (PRD 6) and the
   account lifecycle (Confirmed requirements #4–#8, #12).
   ----------------------------------------------------------------------------
   Credentials are checked against database/users.json. This is a UI prototype:
   no hashing, no tokens, and "Sign in with Google" matches a linked address
   instead of running OAuth. The permission surface and the account rules,
   however, mirror the agreed requirements so screens are wired against them.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { SESSION_KEY } from '@/config/appConfig'
import { ACCOUNT_STATUS, ROLE } from '@/config/constants'
import { timestamp } from '@/utils/format'
import { passwordProblems, temporaryPassword } from '@/utils/password'
import { isEmail } from '@/utils/validation'
import { AuthContext, useData } from './contexts'

const accountLabel = (account) => `${account.fullName} (${account.username})`

const BLOCKED = {
  [ACCOUNT_STATUS.INACTIVE]: 'This account is deactivated. Contact a QMS Admin.',
  [ACCOUNT_STATUS.ARCHIVED]: 'This account has been closed. Contact a QMS Admin if you still need access.',
}

let accountSequence = 100

export function AuthProvider({ children }) {
  const { users, roles, log, addUser, patchUser } = useData()
  const [userId, setUserId] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })
  const [error, setError] = useState('')

  const user = useMemo(() => users.find((u) => u.id === userId) || null, [users, userId])

  const role = useMemo(
    () => (user ? roles.find((r) => r.key === user.role) : null),
    [roles, user],
  )

  useEffect(() => {
    try {
      if (userId) sessionStorage.setItem(SESSION_KEY, userId)
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* storage unavailable — session simply does not survive a reload */
    }
  }, [userId])

  const can = useCallback(
    (permission) => Boolean(role?.permissions?.includes(permission)),
    [role],
  )

  const startSession = useCallback((account, details) => {
    setError('')
    setUserId(account.id)
    patchUser(account.id, { lastLogin: timestamp() })
    log(account, 'Login', 'User', {}, details)
    return { ok: true, user: account }
  }, [log, patchUser])

  const login = useCallback((username, password) => {
    const match = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())

    if (!match) {
      setError('No account found for that username.')
      return { ok: false }
    }
    if (BLOCKED[match.status]) {
      log(match, 'Failed Login Attempt', 'User', {}, `Account is ${match.status.toLowerCase()}.`)
      setError(BLOCKED[match.status])
      return { ok: false }
    }
    if (match.password !== password) {
      log(match, 'Failed Login Attempt', 'User', {}, 'Incorrect password.')
      setError('Incorrect password.')
      return { ok: false }
    }
    return startSession(match, 'Successful login.')
  }, [users, log, startSession])

  /** Google sign-in works only for an account that has linked that Google address (#12). */
  const loginWithGoogle = useCallback((email) => {
    const address = email.trim().toLowerCase()
    const match = users.find((u) => u.googleEmail?.toLowerCase() === address)

    if (!match) {
      setError('No account is linked to that Google address. Sign in with your username, then link Google from My Account.')
      return { ok: false }
    }
    if (BLOCKED[match.status]) {
      log(match, 'Failed Login Attempt', 'User', {}, `Google sign-in refused; account is ${match.status.toLowerCase()}.`)
      setError(BLOCKED[match.status])
      return { ok: false }
    }
    return startSession(match, `Signed in with linked Google account ${address}.`)
  }, [users, log, startSession])

  const logout = useCallback(() => {
    if (user) log(user, 'Logout', 'User', {}, 'Session ended by user.')
    setUserId(null)
  }, [user, log])

  /* ------------------------------------------------- managing other accounts */

  const toggleAccount = useCallback((target) => {
    const nextStatus = target.status === ACCOUNT_STATUS.ACTIVE ? ACCOUNT_STATUS.INACTIVE : ACCOUNT_STATUS.ACTIVE
    patchUser(target.id, { status: nextStatus })
    log(
      user,
      nextStatus === ACCOUNT_STATUS.ACTIVE ? 'Activation' : 'Deactivation',
      'User',
      { type: 'user', id: target.id, label: accountLabel(target) },
      `Account ${nextStatus === ACCOUNT_STATUS.ACTIVE ? 'activated' : 'deactivated'} by ${user?.fullName}.`,
    )
  }, [log, patchUser, user])

  /** Closing an account never deletes it: its CARs, signatures and log entries stay (#8). */
  const archiveAccount = useCallback((target, reason) => {
    patchUser(target.id, { status: ACCOUNT_STATUS.ARCHIVED, archivedAt: timestamp(), archivedBy: user.id })
    log(
      user,
      'Account Archived',
      'User',
      { type: 'user', id: target.id, label: accountLabel(target) },
      reason?.trim() || 'Account closed; its records are retained.',
    )
  }, [log, patchUser, user])

  /** Creates an account with a temporary password for the QMS Admin to hand over (#5). */
  const createAccount = useCallback((fields) => {
    accountSequence += 1
    const account = {
      id: `USR-${accountSequence}`,
      username: fields.username.trim().toLowerCase(),
      password: fields.password,
      fullName: fields.fullName.trim(),
      position: fields.role === ROLE.DEPARTMENT ? null : fields.position?.trim() || null,
      role: fields.role,
      departmentId: fields.role === ROLE.DEV ? null : fields.departmentId,
      email: fields.email.trim(),
      status: ACCOUNT_STATUS.ACTIVE,
      avatarUrl: null,
      avatarColor: '#475467',
      googleEmail: null,
      lastLogin: null,
      createdAt: timestamp(),
      createdBy: user.id,
    }
    addUser(account)
    log(
      user,
      'Account Created',
      'User',
      { type: 'user', id: account.id, label: accountLabel(account) },
      'Account created with a temporary password.',
    )
    return account
  }, [addUser, log, user])

  const resetPassword = useCallback((target) => {
    const password = temporaryPassword()
    patchUser(target.id, { password })
    log(
      user,
      'Password Reset',
      'User',
      { type: 'user', id: target.id, label: accountLabel(target) },
      'Temporary password issued.',
    )
    return password
  }, [log, patchUser, user])

  /* ----------------------------------------------------------- own account */

  const changePassword = useCallback((current, next) => {
    if (user.password !== current) return { ok: false, error: 'Your current password is incorrect.' }
    const problems = passwordProblems(next)
    if (problems.length) return { ok: false, error: `The new password needs: ${problems.join(', ').toLowerCase()}.` }
    if (next === current) return { ok: false, error: 'Choose a password different from the current one.' }

    patchUser(user.id, { password: next, passwordChangedAt: timestamp() })
    log(user, 'Password Changed', 'User', { type: 'user', id: user.id, label: accountLabel(user) }, 'Password changed by the account holder.')
    return { ok: true }
  }, [log, patchUser, user])

  const linkGoogle = useCallback((email) => {
    const address = email.trim().toLowerCase()
    if (!isEmail(address)) return { ok: false, error: 'Enter the full Google address, for example name@gmail.com.' }
    const taken = users.find((u) => u.id !== user.id && u.googleEmail?.toLowerCase() === address)
    if (taken) return { ok: false, error: 'That Google address is already linked to another account.' }

    patchUser(user.id, { googleEmail: address })
    log(user, 'Google Account Linked', 'User', { type: 'user', id: user.id, label: accountLabel(user) }, `Linked ${address} for sign-in.`)
    return { ok: true }
  }, [log, patchUser, user, users])

  const unlinkGoogle = useCallback(() => {
    log(
      user,
      'Google Account Unlinked',
      'User',
      { type: 'user', id: user.id, label: accountLabel(user) },
      `Unlinked ${user.googleEmail}.`,
    )
    patchUser(user.id, { googleEmail: null })
  }, [log, patchUser, user])

  const value = useMemo(
    () => ({
      user,
      role,
      error,
      setError,
      login,
      loginWithGoogle,
      logout,
      can,
      toggleAccount,
      archiveAccount,
      createAccount,
      resetPassword,
      changePassword,
      linkGoogle,
      unlinkGoogle,
      isQms: user?.role === ROLE.QMS,
      isDev: user?.role === ROLE.DEV,
      isDepartment: user?.role === ROLE.DEPARTMENT,
    }),
    [
      user, role, error, login, loginWithGoogle, logout, can, toggleAccount, archiveAccount, createAccount,
      resetPassword, changePassword, linkGoogle, unlinkGoogle,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
