import { Navigate, Route, Routes } from 'react-router-dom';
import { useCurrentProfile } from './auth/AuthProvider';
import { RequireAuth } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { SitePage } from './pages/SitePage';
import { SitesPage } from './pages/SitesPage';
import { TaskPage } from './pages/TaskPage';

function HomeRedirect() {
  const profile = useCurrentProfile();
  return <Navigate to={profile.role === 'executor' ? '/my-tasks' : '/sites'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<HomeRedirect />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="sites/:siteId" element={<SitePage />} />
        <Route path="tasks/:taskId" element={<TaskPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
