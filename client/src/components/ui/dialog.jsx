/* ============================================================================
   dialog.jsx — the app's modal shell.
   ----------------------------------------------------------------------------
   Untitled UI ships the overlay, modal and dialog primitives but leaves the
   chrome to the product. This composes them into the one dialog the app uses:
   a featured icon, a title and supporting line, a scrolling body and a footer
   of actions — with focus trapping, escape-to-close and scroll locking coming
   from React Aria rather than hand-rolled effects.
   ========================================================================== */

import { XClose } from '@untitledui/icons'
import { Heading } from 'react-aria-components'

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal'
import { ButtonUtility } from '@/components/base/buttons/button-utility'
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon'
import { cx } from '@/utils/cx'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

/**
 * @param isOpen / onClose  controlled visibility.
 * @param icon              optional featured icon shown above the title.
 * @param footer            the action row; omit for a bare dialog.
 */
export function AppDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: DialogIcon,
  iconColor = 'brand',
  size = 'lg',
  children,
  footer,
  bodyClassName,
}) {
  return (
    <ModalOverlay isOpen={isOpen} isDismissable onOpenChange={(open) => !open && onClose?.()}>
      <Modal className={cx('mx-auto', SIZES[size])}>
        <Dialog>
          <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl bg-primary shadow-xl">
            <header className="flex items-start gap-4 border-b border-secondary px-4 py-4 md:px-6">
              {DialogIcon && <FeaturedIcon icon={DialogIcon} size="md" color={iconColor} theme="light" />}

              <div className="min-w-0 flex-1">
                {/* `slot="title"` is what names the dialog for assistive
                    technology; a bare <h2> leaves it unlabelled. */}
                <Heading slot="title" className="text-lg font-semibold text-primary">
                  {title}
                </Heading>
                {subtitle && <p className="mt-0.5 text-sm text-tertiary">{subtitle}</p>}
              </div>

              <ButtonUtility size="sm" color="tertiary" tooltip="Close" icon={XClose} onClick={onClose} />
            </header>

            <div className={cx('flex-1 overflow-y-auto px-4 py-5 md:px-6', bodyClassName)}>{children}</div>

            {footer && (
              <footer className="flex flex-col-reverse gap-3 border-t border-secondary px-4 py-4 sm:flex-row sm:justify-end md:px-6">
                {footer}
              </footer>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

/** The two-column grid every form in a dialog or a page uses. */
export function FormGrid({ children, className }) {
  return <div className={cx('grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2', className)}>{children}</div>
}

/** A field that should span the full width of `FormGrid`. */
export function FormSpan({ children, className }) {
  return <div className={cx('sm:col-span-2', className)}>{children}</div>
}
