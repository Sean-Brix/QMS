const SUPPORTED_TYPES = new Set([
  'aep',
  'ai',
  'audio',
  'avi',
  'code',
  'css',
  'csv',
  'dmg',
  'doc',
  'document',
  'docx',
  'empty',
  'eps',
  'exe',
  'fig',
  'folder',
  'gif',
  'html',
  'image',
  'img',
  'indd',
  'java',
  'jpeg',
  'jpg',
  'js',
  'json',
  'mkv',
  'mp3',
  'mp4',
  'mpeg',
  'pdf',
  'pdf-simple',
  'png',
  'ppt',
  'pptx',
  'psd',
  'rar',
  'rss',
  'spreadsheets',
  'sql',
  'svg',
  'tiff',
  'txt',
  'video',
  'video-01',
  'video-02',
  'wav',
  'webp',
  'xls',
  'xlsx',
  'xml',
  'zip',
])

const TYPE_ALIASES = {
  '7z': 'zip',
  aac: 'audio',
  bmp: 'image',
  flac: 'audio',
  gz: 'zip',
  heic: 'image',
  m4a: 'audio',
  md: 'code',
  mov: 'video',
  ods: 'spreadsheets',
  odp: 'pptx',
  odt: 'document',
  ogg: 'audio',
  pages: 'document',
  py: 'code',
  rtf: 'document',
  tar: 'zip',
  ts: 'code',
  tsx: 'code',
  webm: 'video',
  xlsb: 'xlsx',
  xlsm: 'xlsx',
  yaml: 'code',
  yml: 'code',
  'application/gzip': 'zip',
  'application/msword': 'doc',
  'application/pdf': 'pdf',
  'application/rtf': 'document',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-excel.sheet.macroenabled.12': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.oasis.opendocument.presentation': 'pptx',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheets',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/x-7z-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/rtf': 'document',
}

const MIME_CATEGORY_ALIASES = {
  application: 'document',
  audio: 'audio',
  image: 'image',
  text: 'document',
  video: 'video',
}

const normalizeType = (value) => String(value || '').trim().toLowerCase().replace(/^\./, '').split(';')[0]

const extensionFromName = (fileName) => {
  const name = String(fileName || '').split(/[?#]/)[0].split(/[\\/]/).pop() || ''
  const dot = name.lastIndexOf('.')
  return dot > -1 && dot < name.length - 1 ? normalizeType(name.slice(dot + 1)) : ''
}

export function resolveFileIconType({ fileName, fileType, type } = {}) {
  const candidates = [extensionFromName(fileName), normalizeType(type), normalizeType(fileType)].filter(Boolean)

  for (const candidate of candidates) {
    if (SUPPORTED_TYPES.has(candidate)) return candidate
    if (TYPE_ALIASES[candidate]) return TYPE_ALIASES[candidate]

    if (candidate.includes('/')) {
      const [category, subtype] = candidate.split('/')
      if (SUPPORTED_TYPES.has(subtype)) return subtype
      if (MIME_CATEGORY_ALIASES[category]) return MIME_CATEGORY_ALIASES[category]
    }
  }

  return 'empty'
}
