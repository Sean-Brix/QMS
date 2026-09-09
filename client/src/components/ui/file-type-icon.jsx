import { FileIcon as UntitledFileIcon } from '@untitledui/file-icons'

import { cx } from '@/utils/cx'
import { resolveFileIconType } from './file-type'

/** A recognizable, extension-specific file icon with light and dark variants. */
export function FileTypeIcon({ fileName, fileType, type, size = 40, variant = 'default', className }) {
  const resolvedType = resolveFileIconType({ fileName, fileType, type })

  return (
    <span className={cx('inline-flex shrink-0', className)} aria-hidden="true">
      <UntitledFileIcon type={resolvedType} variant={variant} theme="light" size={size} className="dark:hidden" />
      <UntitledFileIcon type={resolvedType} variant={variant} theme="dark" size={size} className="not-dark:hidden" />
    </span>
  )
}
