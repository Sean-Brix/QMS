/* ============================================================================
   AuthContext — mock session + role-based permission gate (PRD 6).
   ----------------------------------------------------------------------------
   Credentials are checked against database/users.json. This is a UI prototype:
   no hashing, no tokens. The permission surface, however, mirrors the PRD so
   screens can be wired against the real rules from day one.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { SESSION_KEY } from '@/config/appConfig'
import { AuthContext, useData } from './contexts'

export function AuthProvider({ children }) {
  const { users, roles, log, patchUser } = useData()
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

  const login = useCallback((username, password) => {
    const match = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())

    if (!match) {
      setError('No account found for that username.')
      return { ok: false }
    }
    if (match.status !== 'Active') {
      log(match, 'Failed Login Attempt', 'User', {}, 'Account is deactivated.')
      setError('This account is deactivated. Contact the QMS Department.')
      return { ok: false }
    }
    if (match.password !== password) {
      log(match, 'Failed Login Attempt', 'User', {}, 'Incorrect password.')
      setError('Incorrect password.')
      return { ok: false }
    }

    setError('')
    setUserId(match.id)
    log(match, 'Login', 'User', {}, 'Successful login.')
    return { ok: true, user: match }
  }, [users, log])

  const logout = useCallback(() => {
    if (user) log(user, 'Logout', 'User', {}, 'Session ended by user.')
    setUserId(null)
  }, [user, log])

  const toggleAccount = useCallback((target) => {
    const nextStatus = target.status === 'Active' ? 'Inactive' : 'Active'
    patchUser(target.id, { status: nextStatus })
    log(
      user,
      nextStatus === 'Active' ? 'Activation' : 'Deactivation',
      'User',
      { type: 'user', id: target.id, label: `${target.fullName} (${target.username})` },
      `Account ${nextStatus === 'Active' ? 'activated' : 'deactivated'} by ${user?.fullName}.`,
    )
  }, [log, patchUser, user])

  const value = useMemo(
    () => ({ user, role, error, setError, login, logout, can, toggleAccount, isQms: user?.role === 'qms' }),
    [user, role, error, login, logout, can, toggleAccount],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
