/* ============================================================================
   CarWorkflow — visual progress through the PRD 12 workflow.
   Issue → Active → Root Cause & Action Plan → Submitted → QMS Review →
   For Revision → Implementation → For Verification → Effectiveness → Closed
   ========================================================================== */

import { Check } from '@untitledui/icons'

import { cx } from '@/components/ui'
import { CAR_STATUS, CAR_WORKFLOW } from '@/config/constants'

/** Index of the workflow stage a CAR has reached, given its status. */
function stageIndexFor(car) {
  const map = {
    [CAR_STATUS.ACTIVE]: 1,
    [CAR_STATUS.PENDING]: 1,
    [CAR_STATUS.OVERDUE]: 2,
    [CAR_STATUS.FOR_REVISION]: 5,
    [CAR_STATUS.UNDER_REVIEW]: 4,
    [CAR_STATUS.FOR_VERIFICATION]: 7,
    [CAR_STATUS.CLOSED]: 9,
  }
  const base = map[car.status] ?? 0
  if (car.status === CAR_STATUS.FOR_VERIFICATION && car.verification.closure.disposition === 'CLOSED') return 8
  return base
}

const MARKER = {
  done: 'bg-brand-solid text-white ring-transparent',
  current: 'bg-primary text-brand-secondary ring-brand',
  todo: 'bg-primary text-quaternary ring-secondary',
}

export default function CarWorkflow({ car }) {
  const current = stageIndexFor(car)

  return (
    <ol aria-label="CAR workflow progress" className="flex flex-col">
      {CAR_WORKFLOW.map((stage, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo'
        const last = index === CAR_WORKFLOW.length - 1

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
                MARKER[state],
              )}
            >
              {state === 'done' ? <Check className="size-3.5 stroke-[3px]" /> : index + 1}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cx(
                  'text-sm font-semibold',
                  state === 'todo' ? 'text-quaternary' : 'text-primary',
                )}
              >
                {stage.label}
              </p>
              <p className="text-sm text-tertiary">{stage.hint}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
