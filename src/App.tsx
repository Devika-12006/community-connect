import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';

// Layouts
import { ResidentLayout } from './components/layout/ResidentLayout';
import { ManagerLayout } from './components/layout/ManagerLayout';
import { WorkerLayout } from './components/layout/WorkerLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';

// Resident Pages
import { ResidentDashboard } from './pages/resident/ResidentDashboard';
import { ReportIssuePage } from './pages/resident/ReportIssuePage';
import { MyComplaintsPage } from './pages/resident/MyComplaintsPage';
import { ComplaintDetailsPage } from './pages/resident/ComplaintDetailsPage';
import { ResidentProfilePage } from './pages/resident/ResidentProfilePage';

// Manager Pages
import { ManagerOverviewPage } from './pages/manager/ManagerOverviewPage';
import { ManagerComplaintsPage } from './pages/manager/ManagerComplaintsPage';
import { ManagerWorkersPage } from './pages/manager/ManagerWorkersPage';
import { ManagerReportsPage } from './pages/manager/ManagerReportsPage';
import { ManagerSettingsPage } from './pages/manager/ManagerSettingsPage';

// Worker Pages
import { WorkerTasksPage } from './pages/worker/WorkerTasksPage';
import { WorkerTaskDetailPage } from './pages/worker/WorkerTaskDetailPage';
import { WorkerCompletedPage } from './pages/worker/WorkerCompletedPage';
import { WorkerProfilePage } from './pages/worker/WorkerProfilePage';

// Common Pages
import { CommunityMapPage } from './pages/common/CommunityMapPage';
import { NotificationsPage } from './pages/common/NotificationsPage';

// Route Guards
import { ProtectedRoute } from './components/common/ProtectedRoute';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Resident Portal (Protected) */}
          <Route element={<ProtectedRoute requiredRole="Resident" />}>
            <Route path="/resident" element={<ResidentLayout />}>
              <Route index element={<Navigate to="/resident/home" replace />} />
              <Route path="home" element={<ResidentDashboard />} />
              <Route path="report" element={<ReportIssuePage />} />
              <Route path="complaints" element={<MyComplaintsPage />} />
              <Route path="complaints/:id" element={<ComplaintDetailsPage />} />
              <Route path="map" element={<CommunityMapPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<ResidentProfilePage />} />
            </Route>
          </Route>

          {/* Manager Portal (Protected) */}
          <Route element={<ProtectedRoute requiredRole="Manager" />}>
            <Route path="/manager" element={<ManagerLayout />}>
              <Route index element={<Navigate to="/manager/overview" replace />} />
              <Route path="overview" element={<ManagerOverviewPage />} />
              <Route path="complaints" element={<ManagerComplaintsPage />} />
              <Route path="workers" element={<ManagerWorkersPage />} />
              <Route path="reports" element={<ManagerReportsPage />} />
              <Route path="settings" element={<ManagerSettingsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
          </Route>

          {/* Worker Portal (Protected) */}
          <Route element={<ProtectedRoute requiredRole="Worker" />}>
            <Route path="/worker" element={<WorkerLayout />}>
              <Route index element={<Navigate to="/worker/tasks" replace />} />
              <Route path="tasks" element={<WorkerTasksPage />} />
              <Route path="tasks/:id" element={<WorkerTaskDetailPage />} />
              <Route path="completed" element={<WorkerCompletedPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<WorkerProfilePage />} />
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
