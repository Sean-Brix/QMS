/* ============================================================================
   My Account — the signed-in account's own settings (Confirmed #5–#7, #12).
   Password changes under the moderate policy, and the optional Google link a
   shared department account can use to sign in.
   ========================================================================== */

import { useState } from 'react'
import { Check, CheckCircle, InfoCircle, Link01, LinkBroken01, Lock01, UserSquare, XCircle } from '@untitledui/icons'
import { useNavigate } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Callout, Card, GoogleLogo, Input, KeyValue, PageState, StatusBadge, cx } from '@/components/ui'
import { ROLE, ROLE_LABEL } from '@/config/constants'
import { ROUTES } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { formatDateTime } from '@/utils/format'
import { passwordRules } from '@/utils/password'

const SIGN_IN_ACTIONS = ['Login', 'Logout', 'Failed Login Attempt']
const emptyPasswords = { current: '', next: '', confirm: '' }

export default function Account() {
  const { user, changePassword, linkGoogle, unlinkGoogle, isDepartment } = useAuth()
  const { activityLogs, deptName, personnelForDepartment, userName } = useData()
  const navigate = useNavigate()

  const [passwords, setPasswords] = useState(emptyPasswords)
  const [passwordResult, setPasswordResult] = useState(null)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleError, setGoogleError] = useState('')

  const setPassword = (key) => (value) => {
    setPasswords((current) => ({ ...current, [key]: value }))
    setPasswordResult(null)
  }

  const rules = passwordRules().map((rule) => ({ ...rule, met: rule.test(passwords.next) }))
  const mismatch = Boolean(passwords.confirm) && passwords.confirm !== passwords.next
  const ready = passwords.current && rules.every((rule) => rule.met) && passwords.confirm === passwords.next

  const submitPassword = () => {
    const result = changePassword(passwords.current, passwords.next)
    if (result.ok) {
      setPasswords(emptyPasswords)
      setPasswordResult({ tone: 'success', text: 'Password changed. Use the new password the next time you sign in.' })
    } else {
      setPasswordResult({ tone: 'error', text: result.error })
    }
  }

  const submitGoogle = () => {
    const result = linkGoogle(googleEmail)
    if (result.ok) {
      setGoogleEmail('')
      setGoogleError('')
    } else {
      setGoogleError(result.error)
    }
  }

  const members = isDepartment ? personnelForDepartment(user.departmentId) : []
  const signIns = activityLogs.filter((entry) => entry.userId === user.id && SIGN_IN_ACTIONS.includes(entry.action)).slice(0, 6)

  return (
    <Page>
      <PageHeader
        title="My Account"
        subtitle={
          isDepartment
            ? `The shared sign-in for ${deptName(user.departmentId)}. Anyone on the department’s personnel list signs in with it.`
            : 'Your sign-in details and security settings.'
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {/* ------------------------------------------------------- password */}
          <Card
            title="Password"
            subtitle={
              isDepartment
                ? 'Change the shared password whenever someone leaves the department.'
                : 'Choose a password you don’t use anywhere else.'
            }
          >
            <div className="flex flex-col gap-5 md:flex-row md:gap-8">
              <div className="flex flex-1 flex-col gap-4">
                <Input
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={setPassword('current')}
                />
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.next}
                  onChange={setPassword('next')}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  isInvalid={mismatch}
                  hint={mismatch ? 'The two new passwords don’t match.' : undefined}
                  value={passwords.confirm}
                  onChange={setPassword('confirm')}
                />
              </div>

              <div className="flex flex-col gap-4 md:w-60">
                <div>
                  <p className="text-sm font-semibold text-primary">Requirements</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {rules.map((rule) => {
                      const RuleIcon = rule.met ? CheckCircle : XCircle
                      return (
                        <li key={rule.key} className="flex items-center gap-2 text-sm">
                          <RuleIcon
                            className={cx('size-4 shrink-0', rule.met ? 'text-fg-success-primary' : 'text-fg-quaternary')}
                            aria-hidden="true"
                          />
                          <span className={rule.met ? 'text-secondary' : 'text-tertiary'}>{rule.label}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <p className="text-sm text-tertiary">
                  No password change is forced after an account is handed over. Change it when it suits you.
                </p>
                <Button color="primary" size="md" iconLeading={Lock01} isDisabled={!ready} onClick={submitPassword}>
                  Change password
                </Button>
              </div>
            </div>

            {passwordResult && (
              <Callout
                tone={passwordResult.tone}
                icon={passwordResult.tone === 'success' ? CheckCircle : XCircle}
                className="mt-5"
              >
                {passwordResult.text}
              </Callout>
            )}
          </Card>

          {/* ------------------------------------------------- Google sign-in */}
          <Card
            title="Sign in with Google"
            subtitle="Optional. Once linked, this account can use “Sign in with Google” on the login page."
          >
            {user.googleEmail ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 ring-1 ring-secondary">
                  <GoogleLogo colorful className="size-6 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">{user.googleEmail}</p>
                    <p className="text-xs text-tertiary">Linked Google account</p>
                  </div>
                  <Badge size="sm" color="success" className="ml-auto">
                    Linked
                  </Badge>
                </div>
                <Button color="secondary" size="md" iconLeading={LinkBroken01} onClick={unlinkGoogle}>
                  Unlink
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <Input
                  className="flex-1"
                  label="Google address"
                  type="email"
                  placeholder="name@gmail.com"
                  isInvalid={Boolean(googleError)}
                  hint={googleError || 'Prototype: the address is linked directly; no Google window opens.'}
                  value={googleEmail}
                  onChange={(value) => {
                    setGoogleEmail(value)
                    setGoogleError('')
                  }}
                />
                <Button
                  color="secondary"
                  size="md"
                  iconLeading={Link01}
                  className="sm:mt-6"
                  isDisabled={!googleEmail.trim()}
                  onClick={submitGoogle}
                >
                  Link Google account
                </Button>
              </div>
            )}

            {isDepartment && (
              <Callout tone="gray" icon={InfoCircle} className="mt-4">
                Email addresses on the personnel list are for notifications only. They don’t create separate sign-ins.
              </Callout>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------------ side rail */}
        <div className="flex flex-col gap-4">
          <Card title="Account">
            <KeyValue
              items={[
                { k: 'Name', v: user.fullName },
                { k: 'Username', v: user.username, mono: true },
                { k: 'Role', v: ROLE_LABEL[user.role] },
                ...(user.role === ROLE.DEV ? [] : [{ k: 'Department', v: deptName(user.departmentId) }]),
                ...(user.position ? [{ k: 'Position', v: user.position }] : []),
                { k: 'Email', v: user.email },
                { k: 'Status', v: <StatusBadge status={user.status} /> },
                { k: 'Created', v: user.createdAt ? formatDateTime(user.createdAt) : null },
                { k: 'Created by', v: user.createdBy ? userName(user.createdBy) : null },
              ]}
            />
          </Card>

          {isDepartment && (
            <Card
              title="Who uses this account"
              subtitle={`${members.length} active on the personnel list`}
              actions={
                <Button color="link-color" size="sm" iconLeading={UserSquare} onClick={() => navigate(ROUTES.personnel)}>
                  Manage
                </Button>
              }
            >
              {members.length === 0 ? (
                <PageState icon={UserSquare} size="sm" title="No personnel listed" text="Add the people in this department." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {members.slice(0, 6).map((member) => (
                    <li key={member.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-primary">{member.fullName}</span>
                      <span className="shrink-0 truncate text-tertiary">{member.position}</span>
                    </li>
                  ))}
                  {members.length > 6 && <li className="text-sm text-tertiary">and {members.length - 6} more</li>}
                </ul>
              )}
            </Card>
          )}

          <Card title="Recent sign-in activity">
            {signIns.length === 0 ? (
              <PageState icon={Check} size="sm" title="No sign-in activity recorded" />
            ) : (
              <ul className="flex flex-col divide-y divide-secondary">
                {signIns.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p
                        className={cx(
                          'text-sm font-medium',
                          entry.action === 'Failed Login Attempt' ? 'text-error-primary' : 'text-primary',
                        )}
                      >
                        {entry.action}
                      </p>
                      <p className="truncate text-xs text-tertiary">{entry.details}</p>
                    </div>
                    <span className="shrink-0 text-xs text-tertiary">{formatDateTime(entry.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  )
}
