/* ============================================================================
   Page + PageHeader — the frame every screen sits in.
   ----------------------------------------------------------------------------
   `Page` owns the content padding and the vertical rhythm between blocks, so no
   screen sets its own margins. `PageHeader` is the title row: heading and
   supporting line on the left, actions on the right, and an optional band
   underneath for tabs or a filter bar.
   ========================================================================== */

import { cx } from '@/utils/cx'

export function Page({ children, className }) {
  return (
    <main className={cx('flex w-full flex-1 flex-col gap-5 px-4 pt-3 pb-10 md:px-8 md:pt-4', className)}>
      {children}
    </main>
  )
}

export function PageHeader({ title, subtitle, actions, children, className }) {
  return (
    <header className={cx('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">{title}</h1>
          {subtitle && <p className="mt-1 text-md text-tertiary">{subtitle}</p>}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 no-print">{actions}</div>}
      </div>

      {children}
    </header>
  )
}

export default PageHeader
