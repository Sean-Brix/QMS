/* ============================================================================
   CarWorkflow — where a CAR stands in its lifecycle, following the client's
   NC flowchart: issue → root cause and action plan → QMS review →
   implementation → verification → effectiveness check → closed.
   The current stage shows its deadline, in red once it has passed.
   ========================================================================== */

import { Check } from '@untitledui/icons'

import { cx } from '@/components/ui'
import { CAR_STATUS, CAR_WORKFLOW } from '@/config/constants'
import { formatDate } from '@/utils/format'

/** Index into CAR_WORKFLOW of the stage each status sits in. */
const STAGE_BY_STATUS = {
  [CAR_STATUS.PENDING]: 1,
  [CAR_STATUS.FOR_REVISION]: 1,
  [CAR_STATUS.UNDER_REVIEW]: 2,
  [CAR_STATUS.ACTIVE]: 3,
  [CAR_STATUS.FOR_VERIFICATION]: 4,
  [CAR_STATUS.FOR_EFFECTIVENESS]: 5,
  [CAR_STATUS.CLOSED]: 6,
}

const MARKER = {
  done: 'bg-brand-solid text-white ring-transparent',
  current: 'bg-primary text-brand-secondary ring-brand',
  late: 'bg-primary text-error-primary ring-error',
  todo: 'bg-primary text-quaternary ring-secondary',
}

export default function CarWorkflow({ car }) {
  const monitoring = car.status === CAR_STATUS.CLOSED && Boolean(car.extendedMonitoring)
  /* A closed CAR has finished every stage — unless extended monitoring keeps the last one open. */
  const current = car.status === CAR_STATUS.CLOSED && !monitoring ? CAR_WORKFLOW.length : (STAGE_BY_STATUS[car.status] ?? 0)

  return (
    <ol aria-label="CAR workflow progress" className="flex flex-col">
      {CAR_WORKFLOW.map((stage, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo'
        const late = state === 'current' && car.overdue
        const last = index === CAR_WORKFLOW.length - 1

        let hint = stage.hint
        if (state === 'current') {
          if (car.status === CAR_STATUS.FOR_REVISION) hint = 'Returned for revision'
          if (monitoring) hint = 'Under extended monitoring'
          if (car.deadline?.date) hint = `${car.deadline.label} ${formatDate(car.deadline.date)}`
        }

        return (
          <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
            {/* The connector is tinted up to the stage the CAR has reached. */}
            {!last && (
              <span
                aria-hidden="true"
                className={cx(
                  'absolute top-8 bottom-0 left-3.25 w-0.5',
                  index < current ? 'bg-brand-solid' : 'bg-quaternary',
                )}
              />
            )}

            <span
              className={cx(
                'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-inset',
                MARKER[late ? 'late' : state],
              )}
            >
              {state === 'done' ? <Check className="size-3.5 stroke-[3px]" /> : index + 1}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cx('text-sm font-semibold', state === 'todo' ? 'text-quaternary' : 'text-primary')}>
                {stage.label}
              </p>
              <p className={cx('text-sm', late ? 'font-medium text-error-primary' : 'text-tertiary')}>{hint}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
