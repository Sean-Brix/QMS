/* ============================================================================
   ui/index.jsx — THE QMS LAYER OVER UNTITLED UI
   ----------------------------------------------------------------------------
   Two things live here:

   1. Re-exports of the Untitled UI primitives the app uses, so a screen has a
      single import site and swapping an implementation is a change here only.
   2. QMS composites — the small number of patterns this product repeats that
      the library does not ship: a status chip bound to the domain vocabulary,
      the metric tile, the record card, the numbered CAR form section.

   Screens should not reach past this module into the library, except for icons,
   which come straight from @untitledui/icons.
   ========================================================================== */

import { Badge, BadgeWithDot } from '@/components/base/badges/badges'
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon'
import { cx } from '@/utils/cx'
import { HintText as HintTextBase } from '@/components/base/input/hint-text'
import { Label as LabelBase } from '@/components/base/input/label'
import { RadioButton as RadioButtonBase, RadioGroup as RadioGroupBase } from '@/components/base/radio-buttons/radio-buttons'
import { statusColor } from '@/utils/status'
import { icon as resolveIcon } from './icons'

/* ------------------------------------------------------- library re-exports */
export { Button } from '@/components/base/buttons/button'
export { ButtonUtility } from '@/components/base/buttons/button-utility'
export { CloseButton } from '@/components/base/buttons/close-button'
export { Badge, BadgeWithDot, BadgeWithIcon, BadgeWithButton } from '@/components/base/badges/badges'
export { Avatar } from '@/components/base/avatar/avatar'
export { AvatarLabelGroup } from '@/components/base/avatar/avatar-label-group'
export { Input, InputBase } from '@/components/base/input/input'
export { TextArea } from '@/components/base/textarea/textarea'
export { NativeSelect } from './native-select'
export { Select } from '@/components/base/select/select'
export { Checkbox } from '@/components/base/checkbox/checkbox'
export { Toggle } from '@/components/base/toggle/toggle'
export { RadioGroup, RadioButton } from '@/components/base/radio-buttons/radio-buttons'
export { Label } from '@/components/base/input/label'
export { HintText } from '@/components/base/input/hint-text'
export { Form } from '@/components/base/form/form'
export { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip'
export { Dropdown } from '@/components/base/dropdown/dropdown'
export { ProgressBar, ProgressBarBase } from '@/components/base/progress-indicators/progress-indicators'
export { Table, TableCard } from '@/components/application/table/table'
export { Tabs, TabList, Tab, TabPanel } from '@/components/application/tabs/tabs'
export { PaginationCardMinimal, PaginationPageDefault } from '@/components/application/pagination/pagination'
export { Modal, ModalOverlay, Dialog, DialogTrigger } from '@/components/application/modals/modal'
export { SlideoutMenu } from '@/components/application/slideout-menus/slideout-menu'
export { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator'
export { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon'
export { Dot } from '@/components/foundations/dot-icon'
export { FileUpload, FileUploadDropZone, getReadableFileSize } from '@/components/application/file-upload/file-upload-base'
export { DatePicker } from '@/components/application/date-picker/date-picker'
export { DateRangePicker } from '@/components/application/date-picker/date-range-picker'
export { cx } from '@/utils/cx'
export { ICONS, icon } from './icons'
export { FilterBar, FilterDate, FilterDateRange, FilterSelect, SearchField } from './toolbar'
export { CategoryBarChart, TrendAreaChart } from './charts'
export { ActivityFeed } from './feed'
export { CellStack, DataTable } from './data-table'
export { AppDialog, FormGrid, FormSpan } from './dialog'

/* --------------------------------------------------------------------- Icon
   config/navigation.js and config/constants.js name their icons as strings.
   This shim turns a name into a rendered icon so those files stay JSX-free. */
export function Icon({ name, className, ...rest }) {
  const Component = resolveIcon(name)
  return <Component className={cx('size-5 shrink-0', className)} {...rest} />
}

/* -------------------------------------------------------------- StatusBadge
   The only place a domain status becomes a colour. `statusColor` owns the map. */
export function StatusBadge({ status, label, size = 'sm', type = 'pill-color', className }) {
  const value = label ?? status
  if (!value) return null
  return (
    <BadgeWithDot
      color={statusColor(status ?? value)}
      size={size}
      type={type}
      className={cx('whitespace-nowrap', className)}
    >
      {value}
    </BadgeWithDot>
  )
}

/** A status shown without the dot — used where a cell is already busy. */
export function StatusTag({ status, label, size = 'sm', className }) {
  const value = label ?? status
  if (!value) return null
  return (
    <Badge color={statusColor(status ?? value)} size={size} type="pill-color" className={cx('whitespace-nowrap', className)}>
      {value}
    </Badge>
  )
}

/* --------------------------------------------------------------------- Card
   The white surface every panel in the app sits on. */
export function Card({ title, subtitle, actions, children, footer, pad = true, className, bodyClassName, id }) {
  return (
    <section id={id} className={cx('flex flex-col rounded-xl bg-primary shadow-xs ring-1 ring-secondary', className)}>
      {(title || actions) && (
        <header className="flex flex-col gap-4 border-b border-secondary px-4 py-4 md:flex-row md:items-start md:px-5">
          <div className="flex flex-1 flex-col gap-0.5">
            {title && <h3 className="text-md font-semibold text-primary">{title}</h3>}
            {subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}

      {pad ? <div className={cx('flex-1 px-4 py-4 md:px-5', bodyClassName)}>{children}</div> : children}

      {footer && <footer className="border-t border-secondary px-4 py-3 md:px-5">{footer}</footer>}
    </section>
  )
}

/* --------------------------------------------------------------- MetricCard
   The KPI tile: label, big number, and an optional trend or hint underneath. */
export function MetricCard({
  label,
  value,
  hint,
  trend,
  trendDirection = 'up',
  icon: TileIcon,
  color = 'brand',
  onClick,
  className,
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'flex flex-col gap-3 rounded-xl bg-primary p-4 text-left shadow-xs ring-1 ring-secondary md:p-5',
        onClick && 'cursor-pointer transition duration-100 ease-linear hover:bg-primary_hover',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-tertiary">{label}</p>
        {TileIcon && <FeaturedIcon icon={TileIcon} size="sm" color={color} theme="light" />}
      </div>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-display-sm font-semibold text-primary">{value}</span>
        {trend && (
          <span
            className={cx(
              'mb-1 text-sm font-medium',
              trendDirection === 'down' ? 'text-error-primary' : 'text-success-primary',
            )}
          >
            {trend}
          </span>
        )}
      </div>

      {hint && <p className="text-sm text-tertiary">{hint}</p>}
    </Wrapper>
  )
}

/* ------------------------------------------------------------------ Section
   A numbered block of the CAR form (PRD 10.1–10.11). */
export function Section({ no, title, subtitle, actions, children, className }) {
  return (
    <section className={cx('flex flex-col gap-4', className)}>
      <header className="flex items-start gap-3 border-b border-secondary pb-3">
        {no && (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-solid text-xs font-semibold text-white">
            {no}
          </span>
        )}
        <div className="flex-1">
          <h4 className="text-md font-semibold text-primary">{title}</h4>
          {subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

/* ----------------------------------------------------------------- KeyValue
   Record detail rows: label on the left, value on the right, separated by a
   rule — the pattern the Untitled UI settings screens use. */
export function KeyValue({ items, columns = 1, className }) {
  return (
    <dl className={cx('grid gap-x-8', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1', className)}>
      {items.map(({ k, v, mono, full }) => {
        const empty = v === null || v === undefined || v === '' || v === '—'
        return (
          <div
            key={k}
            className={cx(
              'flex flex-col gap-1 border-b border-secondary py-3 sm:flex-row sm:items-baseline sm:gap-4',
              full && 'sm:col-span-2',
            )}
          >
            <dt className="w-full shrink-0 text-sm font-medium text-tertiary sm:w-44">{k}</dt>
            <dd
              className={cx(
                'min-w-0 flex-1 text-sm',
                mono && 'font-mono',
                empty ? 'text-quaternary italic' : 'font-medium text-primary',
              )}
            >
              {empty ? 'Not provided' : v}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/* ------------------------------------------------------------------ Callout
   Stands in for the PRO `alerts` component: an inline notice tinted by tone. */
const CALLOUT_TONES = {
  brand: 'bg-utility-brand-50 text-utility-brand-700 ring-utility-brand-200',
  success: 'bg-utility-green-50 text-utility-green-700 ring-utility-green-200',
  warning: 'bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200',
  error: 'bg-utility-red-50 text-utility-red-700 ring-utility-red-200',
  gray: 'bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200',
}

export function Callout({ tone = 'brand', icon: CalloutIcon, title, children, actions, className }) {
  return (
    <div
      className={cx(
        'flex gap-3 rounded-xl p-4 ring-1 ring-inset',
        CALLOUT_TONES[tone] || CALLOUT_TONES.brand,
        className,
      )}
    >
      {CalloutIcon && <CalloutIcon className="mt-0.5 size-5 shrink-0" />}
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className="text-sm opacity-90">{children}</div>}
        {actions && <div className="flex flex-wrap items-center gap-3 pt-1">{actions}</div>}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- ContentDivider
   Stands in for the PRO `content-divider`: a rule with a centred label. */
export function ContentDivider({ children, className }) {
  if (!children) return <hr className={cx('border-secondary', className)} />
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <hr className="flex-1 border-secondary" />
      <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">{children}</span>
      <hr className="flex-1 border-secondary" />
    </div>
  )
}

/* ---------------------------------------------------------------- PageState
   The empty / no-results / no-access panel. */
export function PageState({ icon: StateIcon, title, text, action, size = 'md', className }) {
  return (
    <div
      className={cx(
        'mx-auto flex w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center',
        className,
      )}
    >
      {StateIcon && <FeaturedIcon icon={StateIcon} size={size === 'sm' ? 'lg' : 'xl'} color="gray" theme="modern" />}
      <h3 className="mt-4 text-md font-semibold text-primary">{title}</h3>
      {text && <p className="mt-1 text-sm text-tertiary">{text}</p>}
      {action && <div className="mt-6 flex items-center gap-3">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- StatStrip
   A responsive row of metric tiles. Screens pass tiles, never a column count. */
export function StatStrip({ children, columns = 4, className }) {
  return (
    <div
      className={cx(
        'grid grid-cols-1 gap-4 sm:grid-cols-2',
        columns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- ChoiceRow
   The CAR form asks a lot of short either/or questions (Yes/No, Major/Minor/
   OFI). A vertical radio list would dominate the form, so they render as one
   labelled row of options built on the library's accessible radio group. */
export function ChoiceRow({ label, hint, options, value, onChange, isDisabled, isRequired, className }) {
  return (
    <RadioGroupBase
      value={value ?? null}
      onChange={onChange}
      isDisabled={isDisabled}
      isRequired={isRequired}
      className={cx('gap-1.5', className)}
    >
      {label && <LabelBase isRequired={isRequired}>{label}</LabelBase>}

      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        {options.map((option) => (
          <RadioButtonBase key={option} value={option} label={option} />
        ))}
      </div>

      {hint && <HintTextBase>{hint}</HintTextBase>}
    </RadioGroupBase>
  )
}

/* ------------------------------------------------------------------ Actions
   A row of buttons, used by page headers and card footers. */
export function Actions({ children, className }) {
  return <div className={cx('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
