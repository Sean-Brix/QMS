/* ============================================================================
   Document Repository (PRD 8) — categories, search/filter, view & download.
   Upload / revise / delete are gated to the QMS Department (PRD 8.4).
   ========================================================================== */

import { useMemo, useState } from 'react'
import { Download01, Eye, FilePlus02, Folder } from '@untitledui/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  ButtonUtility,
  CellStack,
  DataTable,
  FilterBar,
  FileTypeIcon,
  PageState,
  PaginationCardMinimal,
  StatusBadge,
  Tab,
  TabList,
  Tabs,
} from '@/components/ui'
import { ALL, DOC_STATUS_LIST, ORG_WIDE_ROLES, PAGE_SIZE, PERMISSION, REQUEST_TYPE } from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { matchesDateRange, matchesQuery, matchesValue, paginate, sortBy, withAll } from '@/utils/filters'
import { formatDate } from '@/utils/format'

const COLUMNS = [
  { id: 'code', label: 'Document code', allowsSorting: true, isRowHeader: true },
  { id: 'title', label: 'Title', allowsSorting: true },
  { id: 'category', label: 'Category' },
  { id: 'department', label: 'Department' },
  { id: 'level', label: 'Level', allowsSorting: true },
  {
    id: 'revisionNo',
    label: 'Revision',
    allowsSorting: true,
    tooltip:
      'Internal documents are numbered 01, 02, 03… An external document keeps the revision its own issuer gave it — a drawing letter such as B, or a standard’s edition year such as 2015.',
  },
  { id: 'effectiveDate', label: 'Effective', allowsSorting: true },
  { id: 'reviewDate', label: 'Review', allowsSorting: true },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: '', align: 'right' },
]

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
  const canRequest = can(PERMISSION.DOC_REQUEST_SUBMIT)

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
      case 'status': {
        const pending = openRequestForDocument(doc.id)
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={doc.status} />
            {pending && (
              <Badge size="sm" color="brand" type="pill-color" className="whitespace-nowrap">
                {pending.type === REQUEST_TYPE.OBSOLETE ? 'Obsoletion requested' : 'Revision requested'}
              </Badge>
            )}
          </div>
        )
      }
      case 'actions':
        return (
          <div className="flex items-center justify-end gap-1">
            <ButtonUtility
              size="xs"
              color="tertiary"
              tooltip="View"
              icon={Eye}
              onClick={() => navigate(path.document(doc.id))}
            />
            {can(PERMISSION.DOCUMENT_DOWNLOAD) && (
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
      default:
        return null
    }
  }

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
            <DataTable
              ariaLabel="Controlled documents"
              columns={COLUMNS}
              rows={view.rows}
              renderCell={renderCell}
              getHref={(doc) => path.document(doc.id)}
              sort={sort}
              onSortChange={(next) => {
                setSort(next)
                setPage(1)
              }}
            />

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
