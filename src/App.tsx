/**
 * Routing and the access gate.
 *
 * Three states: not signed in -> Welcome; signed in with no workspace -> Welcome
 * in create/join mode; otherwise the app shell with everything inside it.
 */

import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ToastHost } from '@/components/ui/Overlay'
import { Spinner } from '@/components/ui/primitives'
import { useStore } from '@/state/store'
import { Welcome } from '@/routes/Welcome'
import { Dashboard } from '@/routes/Dashboard'
import { CalendarPage } from '@/routes/Calendar'
import { PipelinePage } from '@/routes/Pipeline'
import { ContentPlanPage } from '@/routes/ContentPlan'
import { ContentDetailPage } from '@/routes/ContentDetail'
import { TasksPage } from '@/routes/Tasks'
import { IdeasPage } from '@/routes/Ideas'
import { PublishingPage } from '@/routes/Publishing'
import { LibraryPage } from '@/routes/Library'
import { TeamPage } from '@/routes/Team'
import { ReviewPage } from '@/routes/Review'
import { SettingsPage } from '@/routes/Settings'
import { NotFound } from '@/routes/NotFound'

export function App() {
  const { ready, hydrated, user, data, loadingWorkspace, error } = useStore()
  const location = useLocation()

  // Hold the current URL until the store knows whether there is a workspace to
  // open, so reloading on /content/abc lands back on /content/abc.
  if (!ready || !hydrated || loadingWorkspace) {
    return (
      <FullPage>
        <Spinner size={24} />
      </FullPage>
    )
  }

  if (error && !data) {
    return (
      <FullPage>
        <div className="max-w-md text-center">
          <p className="text-headline-sm text-ink">Could not start</p>
          <p className="mt-2 text-body-sm text-ink-dim">{error}</p>
        </div>
      </FullPage>
    )
  }

  const needsWelcome = !user || !data

  return (
    <>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        {needsWelcome ? (
          <Route path="*" element={<Navigate to="/welcome" replace state={{ from: location.pathname }} />} />
        ) : (
          <Route element={<AppShell />} path="/">
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="content" element={<ContentPlanPage />} />
            <Route path="content/:id" element={<ContentDetailPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="ideas" element={<IdeasPage />} />
            <Route path="publishing" element={<PublishingPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        )}
      </Routes>
      <ToastHost />
    </>
  )
}

function FullPage({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6 text-ink-faint">{children}</div>
}
