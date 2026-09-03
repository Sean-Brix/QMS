import { Lock01 } from '@untitledui/icons'
import { Navigate, Route, Routes } from 'react-router-dom'

import { PERMISSION } from '@/config/constants'
import { ROUTES } from '@/config/navigation'
import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/context/contexts'
import { DataProvider } from '@/context/DataContext'
import AppLayout from '@/components/layout/AppLayout'
import { Page } from '@/components/layout/PageHeader'
import { Button, PageState } from '@/components/ui'

import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import DocumentRepository from '@/pages/documents/DocumentRepository'
import DocumentDetail from '@/pages/documents/DocumentDetail'
import CarRegister from '@/pages/cars/CarRegister'
import IssueCar from '@/pages/cars/IssueCar'
import CarDetail from '@/pages/cars/CarDetail'
import Notifications from '@/pages/Notifications'
import ActivityLogs from '@/pages/ActivityLogs'
import Reports from '@/pages/Reports'
import UserManagement from '@/pages/UserManagement'
import Settings from '@/pages/Settings'

/** Blocks the whole app until a session exists. */
function RequireAuth({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to={ROUTES.login} replace />
}

/** Blocks a single route on a permission from the user's role (PRD 6). */
function RequirePermission({ permission, children }) {
  const { can } = useAuth()
  if (can(permission)) return children
  return (
    <Page>
      <PageState
        icon={Lock01}
        title="You do not have access to this page"
        text="This area is restricted to the QMS Department. Contact them if you believe you should have access."
        action={
          <Button color="secondary" onClick={() => window.history.back()}>
            Go back
          </Button>
        }
      />
    </Page>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<Login />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path={ROUTES.dashboard} element={<Dashboard />} />

        <Route path={ROUTES.documents} element={<DocumentRepository />} />
        <Route path={ROUTES.documentDetail} element={<DocumentDetail />} />

        <Route path={ROUTES.cars} element={<CarRegister />} />
        <Route
          path={ROUTES.carIssue}
          element={
            <RequirePermission permission={PERMISSION.CAR_ISSUE}>
              <IssueCar />
            </RequirePermission>
          }
        />
        <Route path={ROUTES.carDetail} element={<CarDetail />} />

        <Route path={ROUTES.notifications} element={<Notifications />} />

        <Route
          path={ROUTES.activityLogs}
          element={
            <RequirePermission permission={PERMISSION.ACTIVITY_LOG_VIEW}>
              <ActivityLogs />
            </RequirePermission>
          }
        />
        <Route
          path={ROUTES.reports}
          element={
            <RequirePermission permission={PERMISSION.REPORT_VIEW}>
              <Reports />
            </RequirePermission>
          }
        />
        <Route
          path={ROUTES.users}
          element={
            <RequirePermission permission={PERMISSION.USER_MANAGE}>
              <UserManagement />
            </RequirePermission>
          }
        />
        <Route
          path={ROUTES.settings}
          element={
            <RequirePermission permission={PERMISSION.SETTINGS_MANAGE}>
              <Settings />
            </RequirePermission>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <DataProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </DataProvider>
  )
}
