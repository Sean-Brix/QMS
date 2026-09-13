/* ============================================================================
   Document detail (PRD 8.2, 8.3, 8.4)
   Full document information · view / download with dynamic watermark ·
   revision history with previous versions retained. Changes are not made here:
   they are requested as a Document Review / Change Notice and published when a
   QMS Admin approves the request.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Clock,
  Download01,
  Droplets01,
  Eye,
  FileCheck02,
  Folder,
  InfoCircle,
  RefreshCcw01,
  ReverseLeft,
} from '@untitledui/icons'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  ActivityFeed,
  AppDialog,
  Badge,
  Button,
  Callout,
  Card,
  FileTypeIcon,
  KeyValue,
  NativeSelect,
  PageState,
  StatusBadge,
} from '@/components/ui'
import {
  DOC_STATUS,
  ORG_WIDE_ROLES,
  PERMISSION,
  REQUEST_TYPE,
  ROLE,
  ROLE_LABEL,
  docLevelLabel,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { TODAY, formatDate, formatDateTime, relativeDays } from '@/utils/format'
import { renderWatermark, watermarkTemplateFor } from '@/utils/watermark'

/** The file row shown on the detail page and in the download dialog. */
function FileRow({ doc }) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-secondary">
      <FileTypeIcon fileName={doc.fileName} fileType={doc.fileType} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{doc.fileName}</p>
        <p className="text-xs text-tertiary">
          {doc.fileSize} · {doc.pages} page{doc.pages === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}

export default function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user, can } = useAuth()
  const {
    documentForUser,
    documentRequests,
    revisionsForDocument,
    revisionsForUser,
    openRequestForDocument,
    categoryName,
    deptName,
    userName,
    personnelForDepartment,
    patchDocument,
    log,
  } = useData()

  /* Scoped on purpose: an obsolete document is archived and open to QMS Admins only. */
  const doc = documentForUser(user, id)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloader, setDownloader] = useState('')
  const loggedView = useRef(null)

  useEffect(() => {
    if (params.get('action') === 'download') {
      setDownloadOpen(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  /* Every opening of a document record is logged and counted (Confirmed #17). The
     ref keeps React's development double-run from counting one visit twice. */
  useEffect(() => {
    if (!doc || loggedView.current === doc.id) return
    loggedView.current = doc.id
    patchDocument(doc.id, { views: doc.views + 1 })
    log(
      user,
      'Viewed Document',
      'Document',
      { type: 'document', id: doc.id, label: `${doc.code} ${doc.title}` },
      'Opened the document record.',
    )
  }, [doc, log, patchDocument, user])

  if (!doc) {
    return (
      <Page>
        <PageState
          icon={Folder}
          title="Document not found"
          text="This document does not exist, or it has been archived and is outside your access."
          action={
            <Button color="secondary" onClick={() => navigate(ROUTES.documents)}>
              Back to repository
            </Button>
          }
        />
      </Page>
    )
  }

  const orgWide = ORG_WIDE_ROLES.includes(user.role)
  /* QMS Admins and Dev see every revision; anyone else sees the current one only. */
  const revisions = revisionsForUser(user, doc.id)
  const allRevisions = revisionsForDocument(doc.id)
  const openRequest = openRequestForDocument(doc.id)
  const requestById = (requestId) => documentRequests.find((request) => request.id === requestId) || null
  const lastRequest = doc.lastRequestId ? requestById(doc.lastRequestId) : null
  const canRequestChange = can(PERMISSION.DOC_REQUEST_SUBMIT) && doc.status === DOC_STATUS.ACTIVE
  /* Restoring an older revision is raised as a revision request, so another QMS Admin approves it. */
  const canRestore = can(PERMISSION.DOC_REQUEST_REVIEW) && doc.status === DOC_STATUS.ACTIVE && !openRequest
  const reviewDays = relativeDays(doc.reviewDate)
  const reviewOverdue = new Date(doc.reviewDate) < TODAY

  const requestChange = (type) => navigate(`${ROUTES.requestNew}?type=${type}&document=${doc.id}`)

  /* A shared department account names who is downloading: the log records the
     person, and a watermark template can stamp them on the copy. */
  const downloaders = user.role === ROLE.DEPARTMENT ? personnelForDepartment(user.departmentId) : []
  const downloadingPerson = downloaders.find((person) => person.id === downloader) || null

  /* Each document carries its own watermark template, or none (Confirmed #18). */
  const watermarkTemplate = watermarkTemplateFor(doc)
  const watermarkPreview = watermarkTemplate
    ? renderWatermark(watermarkTemplate.template, {
        DEPARTMENT: user.departmentId ? deptName(user.departmentId) : ROLE_LABEL[user.role],
        ACCOUNT: user.fullName,
        PERSONNEL:
          user.role === ROLE.DEPARTMENT ? downloadingPerson?.fullName || '(person downloading)' : user.fullName,
        DATETIME: formatDateTime(TODAY),
        DOC_CODE: doc.code,
        REVISION: doc.revisionNo,
      })
    : null

  const confirmDownload = () => {
    patchDocument(doc.id, { downloads: doc.downloads + 1 })
    log(
      user,
      'Downloaded Document',
      'Document',
      { type: 'document', id: doc.id, label: `${doc.code} ${doc.title}` },
      watermarkTemplate
        ? `Downloaded copy stamped with the “${watermarkTemplate.name}” watermark.`
        : 'Downloaded copy.',
      downloadingPerson?.id || null,
    )
    setDownloadOpen(false)
    setDownloader('')
  }

  const revisionFeed = revisions.map((revision) => {
    const viaRequest = revision.requestId ? requestById(revision.requestId) : null
    const restoredFrom = revision.restoredFrom ? allRevisions.find((item) => item.id === revision.restoredFrom) : null
    return {
      id: revision.id,
      icon: RefreshCcw01,
      color: revision.status === DOC_STATUS.ACTIVE ? 'success' : 'gray',
      title: (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-primary">Revision {revision.revisionNo}</span>
          <span>effective {formatDate(revision.effectiveDate)}</span>
          <StatusBadge status={revision.status} />
        </span>
      ),
      description: revision.changeSummary,
      meta: [
        userName(revision.revisedBy),
        formatDateTime(revision.revisionDate),
        revision.fileName,
        viaRequest?.controlNo,
        restoredFrom && `restores revision ${restoredFrom.revisionNo}`,
      ]
        .filter(Boolean)
        .join(' · '),
      action:
        canRestore && revision.status === DOC_STATUS.OBSOLETE ? (
          <Button
            color="link-color"
            size="sm"
            iconLeading={ReverseLeft}
            onClick={() =>
              navigate(`${ROUTES.requestNew}?type=${REQUEST_TYPE.REVISE}&document=${doc.id}&restore=${revision.id}`)
            }
          >
            Restore this revision
          </Button>
        ) : undefined,
    }
  })

  return (
    <Page>
      <PageHeader
        title={doc.title}
        subtitle={doc.description}
        actions={
          <>
            <Button color="secondary" size="md" iconLeading={ArrowLeft} onClick={() => navigate(ROUTES.documents)}>
              Back
            </Button>
            {canRequestChange && (
              <>
                <Button
                  color="secondary"
                  size="md"
                  iconLeading={RefreshCcw01}
                  isDisabled={Boolean(openRequest)}
                  onClick={() => requestChange(REQUEST_TYPE.REVISE)}
                >
                  Request revision
                </Button>
                <Button
                  color="secondary"
                  size="md"
                  iconLeading={Archive}
                  isDisabled={Boolean(openRequest)}
                  onClick={() => requestChange(REQUEST_TYPE.OBSOLETE)}
                >
                  Request obsoletion
                </Button>
              </>
            )}
            {can(PERMISSION.DOCUMENT_DOWNLOAD) && (
              <Button color="primary" size="md" iconLeading={Download01} onClick={() => setDownloadOpen(true)}>
                Download
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="sm" color="gray" type="modern" className="font-mono">
            {doc.code}
          </Badge>
          <StatusBadge status={doc.status} />
          <Badge size="sm" color="gray" type="modern">
            Rev {doc.revisionNo}
          </Badge>
          <Badge size="sm" color="gray" type="modern">
            {categoryName(doc.categoryId)}
          </Badge>
          {watermarkTemplate && (
            <Badge size="sm" color="blue">
              Watermarked on download
            </Badge>
          )}
        </div>
      </PageHeader>

      {openRequest && (
        <Callout
          tone="brand"
          icon={FileCheck02}
          title={`${openRequest.controlNo} — ${openRequest.type.toLowerCase()} request, ${openRequest.status.toLowerCase()}`}
          actions={
            <Link to={path.request(openRequest.id)} className="text-sm font-semibold hover:underline">
              Open the request
            </Link>
          }
        >
          No other change can be requested for this document until that request is decided.
        </Callout>
      )}

      {reviewOverdue && doc.status === DOC_STATUS.ACTIVE && (
        <Callout tone="warning" icon={Clock} title="Review date reached">
          This document was scheduled for review on {formatDate(doc.reviewDate)} ({reviewDays}). Confirm it is still
          suitable, or request a revision.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {/* --------------------------------- document information (8.2) */}
          <Card title="Document information" subtitle="PRD 8.2 — controlled document record">
            <KeyValue
              items={[
                { k: 'Document ID', v: doc.id, mono: true },
                { k: 'Document title', v: doc.title },
                { k: 'Document code', v: doc.code, mono: true },
                { k: 'Document level', v: docLevelLabel(doc.level) },
                { k: 'Department / Section', v: deptName(doc.departmentId) },
                { k: 'Revision number', v: doc.revisionNo, mono: true },
                { k: 'Effective date', v: formatDate(doc.effectiveDate) },
                { k: 'Review date', v: `${formatDate(doc.reviewDate)} (${reviewDays})` },
                { k: 'Status', v: <StatusBadge status={doc.status} /> },
                { k: 'Uploaded by', v: userName(doc.uploadedBy) },
                { k: 'Upload date', v: formatDateTime(doc.uploadDate) },
                { k: 'Last revision by', v: doc.lastRevisionBy ? userName(doc.lastRevisionBy) : null },
                { k: 'Last revision date', v: doc.lastRevisionDate ? formatDateTime(doc.lastRevisionDate) : null },
                { k: 'Retention period', v: doc.retentionPeriod },
                ...(lastRequest
                  ? [
                      {
                        k: 'Last change approved via',
                        v: (
                          <Link to={path.request(lastRequest.id)} className="font-mono text-brand-secondary hover:underline">
                            {lastRequest.controlNo}
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          {/* ------------------------------------- revision history (8.4) */}
          <Card
            title="Revision history"
            subtitle={
              orgWide
                ? 'Previous versions are retained as obsolete; the last approved version is marked ACTIVE. Restoring one raises a revision request.'
                : 'The current approved revision. Earlier revisions are kept on record for QMS Admins.'
            }
          >
            {revisionFeed.length === 0 ? (
              <PageState icon={Clock} size="sm" title="No revision history recorded" />
            ) : (
              <ActivityFeed items={revisionFeed} />
            )}
          </Card>
        </div>

        {/* --------------------------------------------------- side rail */}
        <div className="flex flex-col gap-4">
          <Card title="File">
            <FileRow doc={doc} />

            <div className="mt-4 flex gap-2">
              <Button color="secondary" size="sm" iconLeading={Eye} className="flex-1">
                View
              </Button>
              {can(PERMISSION.DOCUMENT_DOWNLOAD) && (
                <Button
                  color="primary"
                  size="sm"
                  iconLeading={Download01}
                  className="flex-1"
                  onClick={() => setDownloadOpen(true)}
                >
                  Download
                </Button>
              )}
            </div>
          </Card>

          <Card title="Usage">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-tertiary">Views</p>
                <p className="text-display-xs font-semibold text-primary">{doc.views}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-tertiary">Downloads</p>
                <p className="text-display-xs font-semibold text-primary">{doc.downloads}</p>
              </div>
            </div>
          </Card>

          {watermarkTemplate && (
            <Card title="Dynamic watermark" subtitle={`${watermarkTemplate.name} — stamped on every downloaded copy`}>
              <p className="rounded-lg border border-dashed border-primary p-3 font-mono text-xs wrap-break-word text-tertiary">
                {watermarkPreview}
              </p>
            </Card>
          )}

          <Callout tone="gray" icon={InfoCircle} title="How this document changes">
            Revisions and obsoletion are requested through a Document Review / Change Notice. A QMS Admin reviews and
            approves each request before it takes effect.
          </Callout>
        </div>
      </div>

      {/* -------------------------------------------------- download dialog */}
      <AppDialog
        isOpen={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        size="md"
        icon={Download01}
        title="Download controlled document"
        subtitle={`${doc.code} — Revision ${doc.revisionNo}`}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDownloadOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              size="md"
              iconLeading={Download01}
              isDisabled={downloaders.length > 0 && !downloadingPerson}
              onClick={confirmDownload}
            >
              Download copy
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FileRow doc={doc} />

          {downloaders.length > 0 && (
            <NativeSelect
              label="Who is downloading"
              value={downloader}
              onChange={(event) => setDownloader(event.target.value)}
              hint="This account is shared, so the activity log records the person."
              options={[
                { value: '', label: 'Select a person…' },
                ...downloaders.map((person) => ({ value: person.id, label: `${person.fullName} — ${person.position}` })),
              ]}
            />
          )}

          {watermarkTemplate ? (
            <Callout tone="brand" icon={Droplets01} title="A dynamic watermark will be applied">
              Every page is stamped with the “{watermarkTemplate.name}” template:
              <p className="mt-2 font-mono text-xs wrap-break-word">{watermarkPreview}</p>
            </Callout>
          ) : (
            <Callout tone="gray" icon={InfoCircle}>
              This document type is issued without a watermark.
            </Callout>
          )}

          <Callout tone="warning" icon={AlertTriangle} title="This download will be logged">
            The activity log records who downloaded which document and when.
          </Callout>
        </div>
      </AppDialog>
    </Page>
  )
}
