/* ============================================================================
   data-table.jsx — the one table every list screen uses.
   ----------------------------------------------------------------------------
   Wraps Untitled UI's React Aria table so a screen describes its columns as
   data and gets sorting, keyboard navigation, row links and the shared cell
   styling for free. Sorting state stays with the caller, because the caller is
   what owns filtering and pagination too.

   Columns: `[{ id, label, tooltip, allowsSorting, isRowHeader, align, className }]`
   `tooltip` puts a help icon beside the heading — for a column whose values
   follow a rule the heading alone cannot carry.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'

import { Table } from '@/components/application/table/table'
import { cx } from '@/utils/cx'

/** Our `{ key, dir }` sort state as React Aria's descriptor, and back again. */
const toDescriptor = (sort) =>
  sort ? { column: sort.key, direction: sort.dir === 'desc' ? 'descending' : 'ascending' } : undefined

/**
 * Reports which edges of the table's scroll area still have content beyond them.
 *
 * A nine-column register is wider than a 1440px laptop, and the vendored table
 * scrolls it inside its own container. On Windows that container shows no
 * scrollbar until you touch it, so the columns past the right edge — Status
 * among them — are invisible and unguessable. These flags drive a scrim that
 * says there is more.
 */
function useScrollEdges(hostRef, rows) {
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
  }, [hostRef])

  /* A new page of rows can change the column widths, and so the scrollable
     distance, without resizing the container itself. */
  useEffect(() => {
    remeasure.current()
  }, [rows])

  return edges
}

/**
 * @param rows        the page of records to show.
 * @param columns     column descriptors, in display order.
 * @param renderCell  `(row, columnId) => ReactNode`
 * @param getKey      unique row id; defaults to `row.id`.
 * @param getHref     optional — makes the whole row a link.
 * @param sort        `{ key, dir }`; omit to disable sorting entirely.
 * @param onSortChange receives the next `{ key, dir }`.
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
  className,
}) {
  const handleSortChange = (descriptor) => {
    onSortChange?.({
      key: descriptor.column,
      dir: descriptor.direction === 'descending' ? 'desc' : 'asc',
    })
  }

  const host = useRef(null)
  const edges = useScrollEdges(host, rows)

  return (
    <div ref={host} className="relative">
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
        <Table.Header columns={columns}>
          {(column) => (
            <Table.Head
              id={column.id}
              isRowHeader={column.isRowHeader}
              allowsSorting={column.allowsSorting}
              label={column.label}
              tooltip={column.tooltip}
              /* The vendored head is `px-6` at every size while a `sm` cell is
                 `px-5`; matching them lines the columns up and gives a wide
                 register back ~8px per column. */
              className={cx(
                size === 'sm' && 'px-5',
                column.align === 'right' && 'text-right',
                column.headClassName,
              )}
            />
          )}
        </Table.Header>

        <Table.Body items={rows}>
          {(row) => (
            <Table.Row id={getKey(row)} columns={columns} href={getHref?.(row)}>
              {(column) => (
                <Table.Cell className={cx(column.align === 'right' && 'text-right', column.className)}>
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

/** The two-line cell used wherever a code sits above its description. */
export function CellStack({ title, sub, mono, className }) {
  return (
    <div className={cx('flex min-w-0 flex-col', className)}>
      <span className={cx('truncate font-medium text-primary', mono && 'font-mono')}>{title}</span>
      {sub && <span className="truncate text-sm text-tertiary">{sub}</span>}
    </div>
  )
}
