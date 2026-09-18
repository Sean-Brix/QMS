/* ============================================================================
   Document Repository (PRD 8) — categories, search/filter, view & download.
   Upload / revise / delete are gated to the QMS Department (PRD 8.4).
   ========================================================================== */

import { useEffect, useMemo, useState } from 'react'
import { Download01, Eye, FilePlus02, Folder, Grid01, LayoutGrid01, List } from '@untitledui/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  ButtonUtility,
  CellStack,
  DataTable,
  FLUID_COLUMN,
  FilterBar,
  FileTypeIcon,
  LayoutToggle,
  NativeSelect,
  PageState,
  PaginationCardMinimal,
  StatusBadge,
  Tab,
  TabList,
  Tabs,
  cx,
} from '@/components/ui'
import { ALL, DOC_STATUS_LIST, ORG_WIDE_ROLES, PAGE_SIZE, PERMISSION, REQUEST_TYPE } from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { matchesDateRange, matchesQuery, matchesValue, paginate, sortBy, withAll } from '@/utils/filters'
import { formatDate } from '@/utils/format'

/* `hideBelow` sheds the columns a reader needs least as the table narrows:
   category (the tabs above already say it), level and review date go first,
   then department and revision, leaving code, title, effective date and status
   on a tablet. All of them come back in the phone layout and on the record. */
const COLUMNS = [
  { id: 'code', label: 'Document code', allowsSorting: true, isRowHeader: true },
  { id: 'title', label: 'Title', allowsSorting: true, className: FLUID_COLUMN },
  { id: 'category', label: 'Category', hideBelow: 'xl' },
  { id: 'department', label: 'Department', hideBelow: 'lg' },
  { id: 'level', label: 'Level', allowsSorting: true, hideBelow: 'xl' },
  {
    id: 'revisionNo',
    label: 'Revision',
    allowsSorting: true,
    hideBelow: 'lg',
    tooltip:
      'Internal documents are numbered 01, 02, 03… An external document keeps the revision its own issuer gave it — a drawing letter such as B, or a standard’s edition year such as 2015.',
  },
  { id: 'effectiveDate', label: 'Effective', allowsSorting: true },
  { id: 'reviewDate', label: 'Review', allowsSorting: true, hideBelow: 'xl' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: '', align: 'right' },
]

/* ---------------------------------------------------------------- layouts
   The register can be read three ways: the full table, a dense grid of
   tiles for scanning a category by eye, or cards that carry the description
   and metadata without opening each document. The choice is remembered per
   browser, like the theme. */
const LAYOUT = { LIST: 'list', GRID: 'grid', CARDS: 'cards' }
const LAYOUT_OPTIONS = [
  { id: LAYOUT.LIST, label: 'List', icon: List },
  { id: LAYOUT.GRID, label: 'Grid', icon: Grid01 },
  { id: LAYOUT.CARDS, label: 'Cards', icon: LayoutGrid01 },
]
const LAYOUT_STORAGE_KEY = 'qms.documents.layout'

const readStoredLayout = () => {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
    return Object.values(LAYOUT).includes(stored) ? stored : LAYOUT.LIST
  } catch {
    return LAYOUT.LIST
  }
}

/* The table sorts by clicking a heading. Grid and cards have no headings, so
   they get the same sortable fields as a select — one entry per direction. */
const SORT_OPTIONS = [
  { key: 'code', dir: 'asc', label: 'Document code (A–Z)' },
  { key: 'code', dir: 'desc', label: 'Document code (Z–A)' },
  { key: 'title', dir: 'asc', label: 'Title (A–Z)' },
  { key: 'title', dir: 'desc', label: 'Title (Z–A)' },
  { key: 'level', dir: 'asc', label: 'Level (1 first)' },
  { key: 'level', dir: 'desc', label: 'Level (highest first)' },
  { key: 'revisionNo', dir: 'asc', label: 'Revision (lowest first)' },
  { key: 'revisionNo', dir: 'desc', label: 'Revision (highest first)' },
  { key: 'effectiveDate', dir: 'desc', label: 'Effective (newest first)' },
  { key: 'effectiveDate', dir: 'asc', label: 'Effective (oldest first)' },
  { key: 'reviewDate', dir: 'asc', label: 'Review (soonest first)' },
  { key: 'reviewDate', dir: 'desc', label: 'Review (latest first)' },
].map((option) => ({ ...option, value: `${option.key}:${option.dir}` }))

export default function DocumentRepository() {
  const { user, can } = useAuth()
  const {
    documentsForUser,
    openRequestForDocument,
    documentCategories,
    departments,
    categoryName,
    deptName,
    userName,
  } = useData()

  /* Departments see ACTIVE documents only; obsolete ones are archived for QMS Admins. */
  const documents = documentsForUser(user)
  const orgWide = ORG_WIDE_ROLES.includes(user.role)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [category, setCategory] = useState(ALL)
  const [query, setQuery] = useState(params.get('q') || '')
  const [status, setStatus] = useState(params.get('status') || ALL)
  const [department, setDepartment] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState({ key: 'code', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [layout, setLayout] = useState(readStoredLayout)
  const canRequest = can(PERMISSION.DOC_REQUEST_SUBMIT)
  const canDownload = can(PERMISSION.DOCUMENT_DOWNLOAD)

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, layout)
    } catch {
      /* storage unavailable — the choice simply does not persist */
    }
  }, [layout])

  const filtered = useMemo(() => {
    const rows = documents.filter(
      (doc) =>
        matchesQuery(doc, query, ['title', 'code', 'description', 'fileName']) &&
        matchesValue(doc.categoryId, category) &&
        matchesValue(doc.status, status) &&
        matchesValue(doc.departmentId, department) &&
        matchesDateRange(doc.effectiveDate, dateFrom, dateTo),
    )
    return sortBy(rows, sort.key, sort.dir)
  }, [documents, query, category, status, department, dateFrom, dateTo, sort])

  const view = paginate(filtered, page, pageSize)

  const hasFilters = query || status !== ALL || department !== ALL || dateFrom || dateTo || category !== ALL

  const resetFilters = () => {
    setQuery('')
    setStatus(ALL)
    setDepartment(ALL)
    setDateFrom('')
    setDateTo('')
    setCategory(ALL)
    setPage(1)
    setParams({})
  }

  /* Every filter change returns to the first page — otherwise a narrow result
     set can leave the user stranded on a page that no longer exists. */
  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const onSortChange = (next) => {
    setSort(next)
    setPage(1)
  }

  /* The status chip plus the "revision / obsoletion requested" flag — shown
     the same way in every layout. */
  const renderStatus = (doc, className) => {
    const pending = openRequestForDocument(doc.id)
    return (
      <div className={cx('flex flex-col items-start gap-1', className)}>
        <StatusBadge status={doc.status} />
        {pending && (
          <Badge size="sm" color="brand" type="pill-color" className="whitespace-nowrap">
            {pending.type === REQUEST_TYPE.OBSOLETE ? 'Obsoletion requested' : 'Revision requested'}
          </Badge>
        )}
      </div>
    )
  }

  const renderActions = (doc) => (
    <div className="flex items-center justify-end gap-1">
      <ButtonUtility
        size="xs"
        color="tertiary"
        tooltip="View"
        icon={Eye}
        onClick={() => navigate(path.document(doc.id))}
      />
      {canDownload && (
        <ButtonUtility
          size="xs"
          color="tertiary"
          tooltip="Download"
          icon={Download01}
          onClick={() => navigate(`${path.document(doc.id)}?action=download`)}
        />
      )}
    </div>
  )

  const renderCell = (doc, columnId) => {
    switch (columnId) {
      case 'code':
        return <span className="font-mono whitespace-nowrap text-primary">{doc.code}</span>
      case 'title':
        return (
          <div className="flex min-w-0 items-center gap-3">
            <FileTypeIcon fileName={doc.fileName} fileType={doc.fileType} size={36} />
            <CellStack
              title={doc.title}
              sub={`${doc.fileType} · ${doc.fileSize} · uploaded by ${userName(doc.uploadedBy)}`}
            />
          </div>
        )
      case 'category':
        return <span className="whitespace-nowrap">{categoryName(doc.categoryId)}</span>
      case 'department':
        return <span className="block min-w-0">{deptName(doc.departmentId)}</span>
      case 'revisionNo':
        return (
          <Badge size="sm" color="gray" type="modern" className="font-mono">
            {doc.revisionNo}
          </Badge>
        )
      case 'effectiveDate':
        return <span className="whitespace-nowrap">{formatDate(doc.effectiveDate)}</span>
      case 'reviewDate':
        return <span className="whitespace-nowrap">{formatDate(doc.reviewDate)}</span>
      case 'level':
        return <span className="whitespace-nowrap">Level {doc.level}</span>
      case 'status':
        return renderStatus(doc)
      case 'actions':
        return renderActions(doc)
      default:
        return null
    }
  }

  /* ------------------------------------------------------------- grid tile
     Enough to recognise a document — file icon, code, title, status — and the
     whole tile opens it. Actions live on the detail page. */
  const renderTile = (doc) => (
    <li key={doc.id}>
      <Link
        to={path.document(doc.id)}
        className="flex h-full flex-col items-center gap-2 rounded-xl p-4 text-center ring-1 ring-secondary transition duration-100 ease-linear outline-brand hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <FileTypeIcon fileName={doc.fileName} fileType={doc.fileType} size={48} />
        <span className="font-mono text-xs text-tertiary">{doc.code}</span>
        <span className="line-clamp-2 text-sm font-medium text-primary">{doc.title}</span>
        <span className="mt-auto pt-1">{renderStatus(doc, 'items-center')}</span>
      </Link>
    </li>
  )

  /* ------------------------------------------------------------------ card
     The row's contents laid out as a panel, with the description the table
     has no room for. The title is the link; the footer keeps the row actions. */
  const renderCard = (doc) => (
    <li
      key={doc.id}
      className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-secondary transition duration-100 ease-linear hover:bg-primary_hover"
    >
      <div className="flex items-start gap-3">
        <FileTypeIcon fileName={doc.fileName} fileType={doc.fileType} size={40} />
        <div className="min-w-0 flex-1">
          <span className="block font-mono text-xs text-tertiary">{doc.code}</span>
          <Link
            to={path.document(doc.id)}
            className="line-clamp-2 text-sm font-semibold text-primary outline-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {doc.title}
          </Link>
        </div>
        {renderStatus(doc, 'shrink-0 items-end')}
      </div>

      {doc.description && <p className="line-clamp-2 text-sm text-tertiary">{doc.description}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {[
          ['Category', categoryName(doc.categoryId)],
          ['Department', deptName(doc.departmentId)],
          ['Level', `Level ${doc.level}`],
          ['Revision', doc.revisionNo],
          ['Effective', formatDate(doc.effectiveDate)],
          ['Review', formatDate(doc.reviewDate)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-quaternary">{k}</dt>
            <dd className={cx('truncate font-medium text-secondary', k === 'Revision' && 'font-mono')}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-secondary pt-3">
        <span className="truncate text-xs text-tertiary">
          {doc.fileType} · {doc.fileSize} · uploaded by {userName(doc.uploadedBy)}
        </span>
        {renderActions(doc)}
      </div>
    </li>
  )

  return (
    <Page>
      <PageHeader
        title="Document Repository"
        subtitle={
          orgWide
            ? 'Every controlled document, including obsolete ones kept for their retention period. Each new document, revision and obsoletion is requested and approved by a QMS Admin.'
            : 'The ACTIVE controlled documents. Each new document, revision and obsoletion is requested and approved by a QMS Admin.'
        }
        actions={
          canRequest && (
            <Button
              color="primary"
              size="md"
              iconLeading={FilePlus02}
              onClick={() => navigate(`${ROUTES.requestNew}?type=New`)}
            >
              Request new document
            </Button>
          )
        }
      >
        {/* ------------------------------------------- category tabs (PRD 8.2) */}
        <Tabs
          selectedKey={category}
          onSelectionChange={(key) => {
            setCategory(key)
            setPage(1)
          }}
        >
          <TabList type="button-border" size="sm" className="overflow-x-auto">
            <Tab id={ALL} label="All categories" badge={documents.length} />
            {/* A deactivated category keeps its tab only while documents are filed under it. */}
            {documentCategories
              .filter((cat) => cat.status !== 'Inactive' || documents.some((doc) => doc.categoryId === cat.id))
              .map((cat) => (
              <Tab
                key={cat.id}
                id={cat.id}
                label={cat.name}
                badge={documents.filter((doc) => doc.categoryId === cat.id).length}
              />
            ))}
          </TabList>
        </Tabs>
      </PageHeader>

      <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
        {/* --------------------------------------- search & filter (PRD 8.3) */}
        <FilterBar
          search={{
            value: query,
            onChange: onFilter(setQuery),
            placeholder: 'Search by title, code or description',
          }}
          filters={[
            /* Only accounts that can see obsolete documents have anything to filter by status. */
            ...(orgWide
              ? [
                  {
                    label: 'statuses',
                    value: status,
                    onChange: onFilter(setStatus),
                    options: withAll(DOC_STATUS_LIST).map((value) => ({
                      value,
                      label: value === ALL ? 'All statuses' : value,
                    })),
                  },
                ]
              : []),
            {
              label: 'departments',
              value: department,
              onChange: onFilter(setDepartment),
              options: [
                { value: ALL, label: 'All departments' },
                ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
              ],
            },
          ]}
          dates={[
            { label: 'Effective from', value: dateFrom, onChange: onFilter(setDateFrom) },
            { label: 'Effective to', value: dateTo, onChange: onFilter(setDateTo) },
          ]}
          active={Boolean(hasFilters)}
          onReset={resetFilters}
          trailing={
            <>
              {layout !== LAYOUT.LIST && (
                <NativeSelect
                  aria-label="Sort by"
                  size="sm"
                  value={`${sort.key}:${sort.dir}`}
                  onChange={(event) => {
                    const [key, dir] = event.target.value.split(':')
                    onSortChange({ key, dir })
                  }}
                  className="w-full sm:w-auto sm:min-w-44 sm:max-w-56"
                  options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))}
                />
              )}
              <LayoutToggle value={layout} onChange={setLayout} options={LAYOUT_OPTIONS} />
            </>
          }
        />

        {hasFilters && (
          <p className="border-b border-secondary bg-secondary px-4 py-2 text-xs text-tertiary md:px-5">
            {view.total} of {documents.length} documents match the current filters
          </p>
        )}

        {view.total === 0 ? (
          <PageState
            icon={Folder}
            title="No documents found"
            text="No controlled document matches the current search and filter combination."
            action={
              <Button size="sm" color="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {layout === LAYOUT.LIST && (
              <DataTable
                ariaLabel="Controlled documents"
                columns={COLUMNS}
                rows={view.rows}
                renderCell={renderCell}
                getHref={(doc) => path.document(doc.id)}
                sort={sort}
                onSortChange={onSortChange}
              />
            )}

            {layout === LAYOUT.GRID && (
              <ul
                aria-label="Controlled documents"
                className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:p-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              >
                {view.rows.map(renderTile)}
              </ul>
            )}

            {layout === LAYOUT.CARDS && (
              <ul
                aria-label="Controlled documents"
                className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3"
              >
                {view.rows.map(renderCard)}
              </ul>
            )}

            <PaginationCardMinimal
              page={view.page}
              total={view.pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </div>
    </Page>
  )
}
