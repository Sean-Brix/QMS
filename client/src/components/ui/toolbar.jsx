/* ============================================================================
   toolbar.jsx — the search / filter / reset band that sits above every table.
   ----------------------------------------------------------------------------
   Untitled UI's `filter-bar` is a PRO component, so this is the equivalent built
   from the free primitives. Screens describe their filters as data and this
   module lays them out, which keeps every list screen consistent and means a
   change to the pattern lands in one file.
   ========================================================================== */

import { FilterFunnel01, SearchLg, X as XClose } from '@untitledui/icons'

import { Button } from '@/components/base/buttons/button'
import { NativeSelect } from './native-select'
import { cx } from '@/utils/cx'

/** The search box. Controlled, and debounce-free — the lists filter in memory. */
export function SearchField({ value, onChange, placeholder = 'Search', className, ...rest }) {
  return (
    /* `flex-1` with no floor lets the filter group squeeze the box down to
       ~50px, where you cannot read what you typed. A minimum width makes the
       band wrap the filters onto their own line instead of crushing this. */
    <div className={cx('relative w-full min-w-0 md:w-auto md:min-w-64 md:flex-1 md:max-w-xs', className)}>
      <SearchLg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-quaternary" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-primary py-2 pr-3 pl-9 text-sm text-primary shadow-xs ring-1 ring-primary transition duration-100 ease-linear outline-none ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
        {...rest}
      />
    </div>
  )
}

/** One labelled dropdown in the band. */
export function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      size="sm"
      /* Bounded rather than fixed: a select left to size itself runs from
         "All statuses" (156px) to "All sources" (308px), which reads as a
         ragged row. The floor and ceiling keep the band tidy without padding
         the short ones out to a uniform, mostly-empty width. */
      className={cx('w-full sm:w-auto sm:min-w-36 sm:max-w-52', className)}
      options={options.map((option) =>
        typeof option === 'object' ? option : { label: option === 'All' ? `All ${label}` : option, value: option },
      )}
    />
  )
}

/** A date bound, used by the activity log and report ranges. */
export function FilterDate({ label, value, onChange, className }) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      className={cx(
        'min-w-0 rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs ring-1 ring-primary transition duration-100 ease-linear outline-none ring-inset focus:ring-2 focus:ring-brand',
        className,
      )}
    />
  )
}

/**
 * Two bounds of the same field, drawn as the one control they actually are.
 *
 * Side by side and unlabelled, a pair of date boxes reads as two identical
 * `mm/dd/yyyy` fields with nothing to say which is the start and which the end.
 * Grouping them under the field name — "Issued  01/01/2026 – 31/08/2026" — says
 * it on screen, and costs less width than two separately-bordered inputs.
 */
export function FilterDateRange({ prefix, from, to, className }) {
  const bound = (side) => (
    <input
      type="date"
      aria-label={side.label}
      value={side.value || ''}
      onChange={(event) => side.onChange(event.target.value)}
      className="min-w-0 flex-1 bg-transparent py-1 text-sm text-primary outline-none sm:flex-none"
    />
  )

  return (
    <div
      className={cx(
        'flex min-w-0 w-full items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 shadow-xs ring-1 ring-primary transition duration-100 ease-linear ring-inset focus-within:ring-2 focus-within:ring-brand sm:w-auto',
        className,
      )}
    >
      {prefix && <span className="shrink-0 text-xs font-medium text-tertiary">{prefix}</span>}
      {bound(from)}
      <span aria-hidden="true" className="shrink-0 text-sm text-quaternary">
        –
      </span>
      {bound(to)}
    </div>
  )
}

/** "Issued from" + "Issued to" -> "Issued". Empty when the pair does not match. */
function sharedPrefix(dates) {
  if (dates.length !== 2) return null
  const [a, b] = dates.map((d) => d.label.trim())
  const strip = (label, word) =>
    label.toLowerCase().endsWith(` ${word}`) ? label.slice(0, -(word.length + 1)) : null
  const head = strip(a, 'from')
  return head && strip(b, 'to') === head ? head : null
}

/**
 * The band itself.
 *
 * @param search   `{ value, onChange, placeholder }` — omit to hide the box.
 * @param filters  `[{ label, value, onChange, options }]`
 * @param dates    `[{ label, value, onChange }]`
 * @param onReset  shows the Clear button when the caller reports active filters.
 * @param active   whether anything is currently narrowing the list.
 */
export function FilterBar({ search, filters = [], dates = [], onReset, active, trailing, className }) {
  const rangePrefix = sharedPrefix(dates)

  return (
    <div
      className={cx(
        'flex flex-col gap-3 border-b border-secondary px-4 py-3 md:flex-row md:flex-wrap md:items-center md:px-5',
        className,
      )}
    >
      {search && (
        <SearchField value={search.value} onChange={search.onChange} placeholder={search.placeholder} />
      )}

      {(filters.length > 0 || dates.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <FilterFunnel01 className="hidden size-4 shrink-0 text-fg-quaternary md:block" aria-hidden="true" />

          {filters.map((filter) => (
            <FilterSelect key={filter.label} {...filter} />
          ))}

          {rangePrefix ? (
            <FilterDateRange prefix={rangePrefix} from={dates[0]} to={dates[1]} />
          ) : (
            dates.map((date) => <FilterDate key={date.label} {...date} />)
          )}

          {active && onReset && (
            <Button size="sm" color="link-gray" iconLeading={XClose} onClick={onReset}>
              Clear
            </Button>
          )}
        </div>
      )}

      {trailing && <div className="flex flex-wrap items-center gap-2 md:ml-auto">{trailing}</div>}
    </div>
  )
}
