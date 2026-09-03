/* ============================================================================
   Login — mock authentication against database/users.json (PRD 6).
   ========================================================================== */

import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  AtSign,
  CheckVerified01,
  ClipboardCheck,
  FileCheck02,
  Lock01,
  ShieldTick,
} from '@untitledui/icons'
import { Navigate, useNavigate } from 'react-router-dom'

import { BackgroundPattern } from '@/components/shared-assets/background-patterns'
import { Badge, Button, Callout, ContentDivider, Input } from '@/components/ui'
import { APP } from '@/config/appConfig'
import { identityLabel } from '@/config/constants'
import { ROUTES } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'

const PROOF_POINTS = [
  { icon: FileCheck02, label: 'Controlled documents' },
  { icon: ClipboardCheck, label: 'Corrective actions' },
  { icon: Activity, label: 'Traceable activity' },
]

function BrandLockup({ compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg font-bold ring-1 ${
          compact
            ? 'size-10 bg-white/15 text-xs text-white ring-white/20'
            : 'size-11 bg-white text-sm text-brand-700 shadow-lg ring-white/50'
        }`}
      >
        {APP.logo}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{APP.name}</span>
        <span className="block truncate text-xs text-white/65">{APP.organization}</span>
      </span>
    </div>
  )
}

export default function Login() {
  const { user, login, error, setError } = useAuth()
  const { users, deptName } = useData()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })

  if (user) return <Navigate to={ROUTES.dashboard} replace />

  const set = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  const submit = (event) => {
    event.preventDefault()
    if (login(form.username, form.password).ok) navigate(ROUTES.dashboard, { replace: true })
  }

  const quickFill = (account) => {
    setForm({ username: account.username, password: account.password })
    setError('')
  }

  const demoAccounts = [users.find((u) => u.id === 'USR-001'), users.find((u) => u.id === 'USR-003')].filter(Boolean)

  return (
    <main className="relative min-h-dvh overflow-hidden bg-secondary sm:p-3 lg:p-4 xl:p-5">
      <div className="pointer-events-none absolute -top-48 -right-32 size-96 rounded-full bg-brand-primary opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -left-40 size-96 rounded-full bg-brand-primary opacity-50 blur-3xl" />

      <div className="relative mx-auto grid min-h-dvh w-full grid-cols-1 max-w-[1600px] overflow-hidden bg-primary shadow-2xl ring-1 ring-secondary sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-3xl lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)] lg:min-h-[calc(100dvh-2rem)] xl:min-h-[calc(100dvh-2.5rem)]">
        {/* ------------------------------------------------------ media panel */}
        <section className="relative hidden min-h-[calc(100dvh-2rem)] overflow-hidden lg:flex lg:flex-col xl:min-h-[calc(100dvh-2.5rem)]">
          <div
            className="absolute inset-0 bg-cover bg-[position:60%_50%]"
            style={{
              backgroundImage: `url('${import.meta.env.BASE_URL}images/login-quality-illustration.webp')`,
            }}
          />
          <div className="absolute inset-0 bg-linear-to-br from-brand-950/95 via-brand-900/65 to-brand-800/10" />
          <div className="absolute inset-0 bg-linear-to-t from-brand-950/95 via-brand-950/5 to-transparent" />
          <BackgroundPattern
            pattern="grid"
            size="lg"
            className="absolute -top-28 -left-32 text-white/10"
          />

          <header className="relative z-10 p-7 xl:p-9">
            <div className="inline-flex rounded-xl bg-neutral-950/20 p-2 pr-4 ring-1 ring-white/15 backdrop-blur-md">
              <BrandLockup />
            </div>
          </header>

          <div className="relative z-10 mt-auto max-w-3xl p-7 xl:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur-md">
              <CheckVerified01 className="size-4 text-white/75" aria-hidden="true" />
              Aligned with {APP.standard}
            </div>

            <p className="mt-5 max-w-2xl text-display-md font-semibold text-white xl:text-display-lg">
              Quality work,
              <br />
              clearly controlled.
            </p>
            <p className="mt-4 max-w-xl text-md leading-relaxed text-white/75 xl:text-lg">
              Keep current documents and corrective actions moving from issue to verified closure in one accountable workspace.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-2.5">
              {PROOF_POINTS.map(({ icon: ProofIcon, label }) => (
                <div
                  key={label}
                  className="flex min-w-0 flex-col gap-2 rounded-xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-md xl:flex-row xl:items-center"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                    <ProofIcon className="size-4 text-white/80" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-white/85 xl:text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ sign-in side */}
        <section className="relative flex min-h-dvh flex-col overflow-hidden bg-primary sm:min-h-[calc(100dvh-1.5rem)] lg:min-h-0">
          <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-primary opacity-70 blur-3xl" />

          <header className="relative overflow-hidden bg-brand-section px-5 py-5 sm:px-7 lg:hidden">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-brand-950/50 to-transparent" />
            <div className="relative">
              <BrandLockup compact />
              <p className="mt-4 max-w-sm text-lg font-semibold text-white">Quality work, clearly controlled.</p>
            </div>
          </header>

          <div className="relative flex min-w-0 flex-1 items-center justify-center px-5 py-8 sm:px-10 sm:py-10 lg:px-11 lg:py-8 xl:px-16 xl:py-10 [@media(min-width:1024px)_and_(max-height:820px)]:py-4">
            <form className="login-auth-form flex w-full max-w-110 min-w-0 flex-col" onSubmit={submit}>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-brand-secondary ring-1 ring-brand">
                <ShieldTick className="size-4 text-fg-brand-primary" aria-hidden="true" />
                Role-based quality workspace
              </div>

              <div className="mt-5">
                <h1 className="text-display-xs font-semibold text-primary sm:text-display-sm">Welcome back</h1>
                <p className="mt-2 text-md text-tertiary">Sign in with your company account to continue.</p>
              </div>

              <div className="mt-7 flex flex-col gap-4">
                <Input
                  label="Username"
                  icon={AtSign}
                  size="lg"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={set('username')}
                  autoComplete="username"
                  isRequired
                />

                <Input
                  label="Password"
                  icon={Lock01}
                  size="lg"
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="current-password"
                  isRequired
                />
              </div>

              {error && (
                <div className="mt-4" role="alert">
                  <Callout tone="error" icon={AlertCircle}>
                    {error}
                  </Callout>
                </div>
              )}

              <Button type="submit" size="xl" color="primary" iconTrailing={ArrowRight} className="mt-6 w-full">
                Sign in
              </Button>

              <ContentDivider className="my-7">Explore the prototype</ContentDivider>

              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">Quick access</p>
                    <p className="mt-0.5 text-xs text-tertiary">Choose a role to fill the demo credentials.</p>
                  </div>
                  <Badge size="sm" color="gray" type="modern">
                    Demo
                  </Badge>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {demoAccounts.map((account) => {
                    const isSelected = form.username === account.username && form.password === account.password
                    const AccountIcon = account.id === 'USR-001' ? ShieldTick : ClipboardCheck

                    return (
                      <button
                        key={account.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => quickFill(account)}
                        className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left shadow-xs ring-1 transition duration-100 ease-linear outline-brand focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          isSelected
                            ? 'bg-brand-primary_alt ring-brand'
                            : 'bg-primary ring-secondary hover:bg-primary_hover'
                        }`}
                      >
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors ${
                            isSelected
                              ? 'bg-brand-solid text-white ring-brand-solid'
                              : 'bg-brand-primary text-fg-brand-primary ring-brand'
                          }`}
                        >
                          <AccountIcon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-primary">{account.fullName}</span>
                          <span className="block truncate text-xs text-tertiary">
                            {account.position} · {identityLabel(account, deptName)}
                          </span>
                        </span>
                        <ArrowRight
                          className="size-4 shrink-0 text-fg-quaternary transition-transform group-hover:translate-x-0.5 group-hover:text-fg-brand-primary"
                          aria-hidden="true"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </form>
          </div>

          <footer className="relative border-t border-secondary px-5 py-4 text-center text-xs text-quaternary sm:px-10 lg:text-left">
            {APP.fullName} · {APP.version}
          </footer>
        </section>
      </div>
    </main>
  )
}
