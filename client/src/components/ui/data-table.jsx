/* ============================================================================
   data-table.jsx — the one table every list screen uses.
   ----------------------------------------------------------------------------
   Wraps Untitled UI's React Aria table so a screen describes its columns as
   data and gets sorting, keyboard navigation, row links and the shared cell
   styling for free. Sorting state stays with the caller, because the caller is
   what owns filtering and pagination too.

   Columns: `[{ id, label, tooltip, allowsSorting, isRowHeader, align, className,
                hideBelow, stackRole }]`
   `className` on the one column that should soak up whatever width the others
               leave — a title, a finding — is `FLUID_COLUMN` (below).
   `tooltip`   puts a help icon beside the heading — for a column whose values
               follow a rule the heading alone cannot carry.
   `hideBelow` drops the column from the table when the table's own width is
               under a Tailwind breakpoint ('sm' … '2xl'), so a wide register
               loses its least important columns before it has to scroll
               sideways. Its own width, not the window's: the sidebar takes
               280px of a laptop, and the table has to live in what is left.
               The value is still on the record's detail page, and still shown
               on a phone (below).
   `stackRole` where the cell goes in the phone layout — see STACKED ROWS.

   PHONES. A nine-column register cannot be read on a 390px screen however it
   is squeezed, so below `md` the same columns and `renderCell` are laid out
   as a stacked list instead: one card per row, with the headings folded in as
   labels and a "Sort by" select standing in for the clickable heads.
   ========================================================================== */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Table } from '@/components/application/table/table'
import { cx } from '@/utils/cx'
import { NativeSelect } from './native-select'

/**
 * The classes for a column that takes the leftover width and truncates to it.
 *
 * An auto-layout table sizes every column to its content, so a long title
 * pushes the whole table wider than its box and the register scrolls sideways.
 * `width: 100%` hands this column what the others leave, and `max-width: 0`
 * stops its content from counting towards the table's minimum — which is what
 * lets `truncate` inside it actually truncate. `min-width` keeps a floor so it
 * never collapses to nothing when the other columns are wide.
 */
export const FLUID_COLUMN = 'w-full max-w-0 min-w-56'

/* Cell padding by the table's own width: tight while columns are fighting for
   room, the library's own spacing once there is plenty. The head is `px-6` at
   every size in the vendored table while a `sm` cell is `px-5`; using one
   value for both lines the columns up. */
const CELL_PADDING = {
  sm: 'px-3 @min-[1024px]:px-4 @min-[1536px]:px-5',
  md: 'px-4 @min-[1024px]:px-5 @min-[1536px]:px-6',
}

/** Our `{ key, dir }` sort state as React Aria's descriptor, and back again. */
const toDescriptor = (sort) =>
  sort ? { column: sort.key, direction: sort.dir === 'desc' ? 'descending' : 'ascending' } : undefined

/* ----------------------------------------------------------------- screens
   Tailwind's default breakpoints, mirrored so a column can name one. */
const SCREENS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }

const screensFor = (width) =>
  Object.fromEntries(Object.entries(SCREENS).map(([name, px]) => [name, width >= px]))

const readViewport = () =>
  Object.fromEntries(
    Object.entries(SCREENS).map(([name, px]) => [
      name,
      typeof window === 'undefined' ? true : window.matchMedia(`(min-width: ${px}px)`).matches,
    ]),
  )

/**
 * Which breakpoints the element's own width currently clears, e.g.
 * `{ sm: true, md: true, lg: false, … }`.
 *
 * Until the element has been measured — and wherever there is no layout to
 * measure — the viewport stands in, so the first paint is already close.
 */
function useScreens(ref) {
  const [width, setWidth] = useState(null)
  const [viewport, setViewport] = useState(readViewport)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => {
      const next = element.getBoundingClientRect().width
      if (next > 0) setWidth((prev) => (prev === next ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  useEffect(() => {
    const lists = Object.values(SCREENS).map((px) => window.matchMedia(`(min-width: ${px}px)`))
    const update = () => setViewport(readViewport())
    lists.forEach((list) => list.addEventListener('change', update))
    return () => lists.forEach((list) => list.removeEventListener('change', update))
  }, [])

  return width == null ? viewport : screensFor(width)
}

/**
 * Reports which edges of the table's scroll area still have content beyond them.
 *
 * A nine-column register is wider than a 1440px laptop, and the vendored table
 * scrolls it inside its own container. On Windows that container shows no
 * scrollbar until you touch it, so the columns past the right edge — Status
 * among them — are invisible and unguessable. These flags drive a scrim that
 * says there is more.
 */
function useScrollEdges(hostRef, rows, columns, enabled) {
  const [edges, setEdges] = useState({ start: false, end: false })
  const remeasure = useRef(() => {})

  useEffect(() => {
    const scroller = hostRef.current?.querySelector('[class~="overflow-x-auto"]')
    if (!scroller) return undefined

    const measure = () => {
      const max = scroller.scrollWidth - scroller.clientWidth
      const next = {
        start: scroller.scrollLeft > 1,
        end: max > 1 && scroller.scrollLeft < max - 1,
      }
      /* Keep the previous object when nothing moved. Returning a fresh one
         every time would re-render, which would re-measure, without end. */
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
    }

    remeasure.current = measure
    measure()

    scroller.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)

    return () => {
      scroller.removeEventListener('scroll', measure)
      observer.disconnect()
    }
    /* `enabled` flips when the phone layout gives way to the table, which is
       when the scroller first exists to be found. */
  }, [hostRef, enabled])

  /* A new page of rows, or a column appearing at a breakpoint, can change the
     column widths — and so the scrollable distance — without resizing the
     container itself. */
  useEffect(() => {
    remeasure.current()
  }, [rows, columns])

  return edges
}

/* ------------------------------------------------------------ STACKED ROWS
   Each column takes one role in the card:

     title    the headline — the `isRowHeader` column (or the first one)
     lead     the descriptive line under it — the first ordinary column
     aside    top-right, beside the title — the `status` column
     actions  the footer — an unlabelled, right-aligned column
     meta     everything else, as label / value pairs

   A screen can set `stackRole` on a column to override the guess. */
const guessRole = (column) => {
  if (column.stackRole) return column.stackRole
  if (column.isRowHeader) return 'title'
  if (column.id === 'status') return 'aside'
  if (!column.label && column.align === 'right') return 'actions'
  return 'meta'
}

function assignRoles(columns) {
  const roles = columns.map(guessRole)
  if (!roles.includes('title')) {
    const first = roles.findIndex((role) => role === 'meta' || role === 'lead')
    if (first >= 0) roles[first] = 'title'
  }
  if (!roles.includes('lead')) {
    const first = roles.indexOf('meta')
    if (first >= 0) roles[first] = 'lead'
  }
  const pick = (role) => columns.filter((_, index) => roles[index] === role)
  return {
    title: pick('title')[0],
    lead: pick('lead')[0],
    aside: pick('aside')[0],
    actions: pick('actions')[0],
    meta: pick('meta'),
  }
}

/** Sort options for the phone layout: every sortable column, in both directions. */
const sortOptions = (columns) =>
  columns
    .filter((column) => column.allowsSorting)
    .flatMap((column) => [
      { value: `${column.id}:asc`, label: `${column.label} — ascending` },
      { value: `${column.id}:desc`, label: `${column.label} — descending` },
    ])

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]'

function StackedRows({ rows, columns, renderCell, getKey, getHref, sort, onSortChange, ariaLabel }) {
  const navigate = useNavigate()
  const { title, lead, aside, actions, meta } = assignRoles(columns)
  const cell = renderCell
  const options = sort && onSortChange ? sortOptions(columns) : []

  /* The whole card opens the record, as the table row does — but a tap on a
     button or link inside it must do its own job instead. The title is also a
     real link, so the keyboard and a screen reader reach the record too. */
  const open = (href) => (event) => {
    if (!href || event.target.closest(INTERACTIVE)) return
    navigate(href)
  }

  return (
    <div>
      {options.length > 0 && (
        <div className="flex items-center justify-end gap-2 border-b border-secondary px-4 py-2">
          <span className="text-xs font-medium text-tertiary">Sort by</span>
          <NativeSelect
            aria-label="Sort by"
            size="sm"
            value={`${sort.key}:${sort.dir}`}
            onChange={(event) => {
              const [key, dir] = event.target.value.split(':')
              onSortChange({ key, dir })
            }}
            className="min-w-44 max-w-64"
            options={options}
          />
        </div>
      )}

      {/* One column on a phone; two side by side once the host is 640px wide,
          which is a small laptop with the sidebar open. */}
      <ul
        aria-label={ariaLabel}
        className="divide-y divide-secondary @min-[640px]:grid @min-[640px]:grid-cols-2 @min-[640px]:gap-3 @min-[640px]:divide-y-0 @min-[640px]:p-4"
      >
        {rows.map((row) => {
          const href = getHref?.(row)
          return (
            <li
              key={getKey(row)}
              onClick={open(href)}
              className={cx(
                'flex flex-col gap-3 px-4 py-4 text-sm text-tertiary transition-colors @min-[640px]:rounded-xl @min-[640px]:ring-1 @min-[640px]:ring-secondary',
                href && 'cursor-pointer hover:bg-secondary',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 font-medium text-primary">
                  {title &&
                    (href ? (
                      <Link to={href} className="rounded-xs outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
                        {cell(row, title.id)}
                      </Link>
                    ) : (
                      cell(row, title.id)
                    ))}
                </div>
                {aside && <div className="shrink-0">{cell(row, aside.id)}</div>}
              </div>

              {/* Full width, under the status: a title or finding needs the room,
                  and a cell built for a table column (`truncate`) wraps here. */}
              {lead && (
                <div className="-mt-1 [&_.truncate]:line-clamp-2 [&_.truncate]:whitespace-normal">
                  {cell(row, lead.id)}
                </div>
              )}

              {/* Half a card is narrower than any table column, so a cell kept
                  on one line for the table (`whitespace-nowrap`) wraps here. */}
              {meta.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 [&_.whitespace-nowrap]:whitespace-normal">
                  {meta.map((column) => (
                    <div key={column.id} className={cx('min-w-0', column.stackFull && 'col-span-2')}>
                      <dt className="text-xs text-quaternary">{column.label}</dt>
                      <dd className="min-w-0 text-secondary">{cell(row, column.id)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {actions && (
                <div className="flex justify-end border-t border-secondary pt-2">{cell(row, actions.id)}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * @param rows        the page of records to show.
 * @param columns     column descriptors, in display order.
 * @param renderCell  `(row, columnId) => ReactNode`
 * @param getKey      unique row id; defaults to `row.id`.
 * @param getHref     optional — makes the whole row a link.
 * @param sort        `{ key, dir }`; omit to disable sorting entirely.
 * @param onSortChange receives the next `{ key, dir }`.
 * @param stackBelow  the breakpoint (of the table's own width) under which the
 *                    rows stack instead. 'md' suits a register; a table of
 *                    three or four short columns can pass 'sm', since it still
 *                    fits in a dashboard card and a tablet.
 */
export function DataTable({
  rows,
  columns,
  renderCell,
  getKey = (row) => row.id,
  getHref,
  sort,
  onSortChange,
  ariaLabel,
  size = 'sm',
  stackBelow = 'md',
  className,
}) {
  const host = useRef(null)
  const screens = useScreens(host)
  const visible = columns.filter((column) => !column.hideBelow || screens[column.hideBelow])

  const handleSortChange = (descriptor) => {
    onSortChange?.({
      key: descriptor.column,
      dir: descriptor.direction === 'descending' ? 'desc' : 'asc',
    })
  }

  const stacked = !screens[stackBelow]
  const edges = useScrollEdges(host, rows, visible, !stacked)

  if (stacked) {
    return (
      <div ref={host} className="@container">
        <StackedRows
          rows={rows}
          columns={columns}
          renderCell={renderCell}
          getKey={getKey}
          getHref={getHref}
          sort={sort}
          onSortChange={onSortChange}
          ariaLabel={ariaLabel}
        />
      </div>
    )
  }

  return (
    <div ref={host} className="relative @container">
      {/* `alpha-black` inverts to white under `.dark-mode`, so one scrim reads
          correctly in both themes. */}
      {edges.start && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-1 w-6 bg-linear-to-r from-alpha-black/10 to-transparent"
        />
      )}
      {edges.end && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-1 w-6 bg-linear-to-l from-alpha-black/10 to-transparent"
        />
      )}

      <Table
        aria-label={ariaLabel}
        size={size}
        className={className}
        sortDescriptor={sort ? toDescriptor(sort) : undefined}
        onSortChange={sort ? handleSortChange : undefined}
      >
        <Table.Header columns={visible}>
          {(column) => (
            <Table.Head
              id={column.id}
              isRowHeader={column.isRowHeader}
              allowsSorting={column.allowsSorting}
              label={column.label}
              tooltip={column.tooltip}
              className={cx(
                CELL_PADDING[size],
                column.align === 'right' && 'text-right',
                column.headClassName,
              )}
            />
          )}
        </Table.Header>

        {/* React Aria caches each row's cells; `dependencies` tells it a row
            must re-render when the visible column set changes with the width. */}
        <Table.Body items={rows} dependencies={[visible, renderCell]}>
          {(row) => (
            <Table.Row id={getKey(row)} columns={visible} href={getHref?.(row)}>
              {(column) => (
                <Table.Cell
                  className={cx(
                    CELL_PADDING[size],
                    column.align === 'right' && 'text-right',
                    column.className,
                  )}
                >
                  {renderCell(row, column.id)}
                </Table.Cell>
              )}
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </div>
  )
}

/** The two-line cell used wherever a code sits above its description.
    The title wraps to a second line before it is cut — which only ever happens
    in a `FLUID_COLUMN`, since any other column grows to fit it. */
export function CellStack({ title, sub, mono, className }) {
  return (
    <div className={cx('flex min-w-0 flex-col', className)}>
      <span className={cx('line-clamp-2 font-medium text-primary', mono && 'font-mono')}>{title}</span>
      {sub && <span className="truncate text-sm text-tertiary">{sub}</span>}
    </div>
   )
}
