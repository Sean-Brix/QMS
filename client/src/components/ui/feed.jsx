/* ============================================================================
   feed.jsx — the vertical activity timeline.
   ----------------------------------------------------------------------------
   Untitled UI's `activity-feed` is a PRO component, so this is the equivalent
   built from the free primitives. Callers pass already-shaped items; this module
   owns nothing but the layout and the connector line.
   ========================================================================== */

import { Avatar } from '@/components/base/avatar/avatar'
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon'
import { cx } from '@/utils/cx'

/**
 * @param items `[{ id, actor, actorName, avatarUrl, icon, color, title, description, meta, action }]`
 *              — `action` is an optional control shown under the entry;
 *              — `avatarUrl` renders a profile image with `actor` as fallback;
 *              `icon` renders a featured icon instead.
 *              Supply one or the other.
 */
export function ActivityFeed({ items, className }) {
  return (
    <ol className={cx('flex flex-col', className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1

        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector — stops at the last entry so the line never dangles. */}
            {!last && <span aria-hidden="true" className="absolute top-9 bottom-0 left-4 w-px bg-quaternary" />}

            <span className="relative z-10 shrink-0">
              {item.icon ? (
                <FeaturedIcon icon={item.icon} size="sm" color={item.color || 'gray'} theme="light" />
              ) : (
                <Avatar size="sm" src={item.avatarUrl} initials={item.actor} alt={item.actorName} />
              )}
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm text-secondary">{item.title}</p>
              {item.description && <p className="mt-0.5 text-sm text-tertiary">{item.description}</p>}
              {item.meta && <p className="mt-1 text-xs text-quaternary">{item.meta}</p>}
              {item.action && <div className="mt-2">{item.action}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
