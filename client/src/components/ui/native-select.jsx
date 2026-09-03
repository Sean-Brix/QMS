/* ============================================================================
   native-select.jsx — NativeSelect with room reserved for its chevron.
   ----------------------------------------------------------------------------
   The vendored Untitled UI select pads only its left edge and then draws the
   chevron over the right edge as an absolutely-positioned overlay. Whenever the
   chosen option is as wide as the box — "Any responsible person", "All
   classifications" — the last characters sit underneath the arrow.

   Fixing it upstream would mean editing vendored source and losing the ability
   to run `npx untitledui@latest add select`, so the padding is added here, in
   the QMS layer, and every screen imports the select from this module.
   ========================================================================== */

import { NativeSelect as NativeSelectBase } from '@/components/base/select/select-native'
import { cx } from '@/utils/cx'

/** Chevron inset + icon width + a little breathing room, per size. */
const CHEVRON_ROOM = {
  sm: 'pr-8',
  md: 'pr-9',
  lg: 'pr-10',
}

export function NativeSelect({ size = 'md', className, selectClassName, ...props }) {
  return (
    <NativeSelectBase
      size={size}
      /* A <select> is intrinsically as wide as its longest option, and a grid
         or flex item defaults to `min-width: auto` — so a long option name
         pushes the control past its column. `min-w-0` lets it shrink instead,
         and `truncate` ellipsises the chosen label rather than clipping it. */
      className={cx('min-w-0', className)}
      selectClassName={cx('min-w-0 truncate', CHEVRON_ROOM[size], selectClassName)}
      {...props}
    />
  )
}
