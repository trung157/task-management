import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import TaskListPage from '../pages/tasks/TaskListPage';
import TaskDetailPage from '../pages/tasks/TaskDetailPage';
import CategoryPage from '../pages/categories/CategoryPage';
import ProfilePage from '../pages/profile/ProfilePage';
import NotFoundPage from '../pages/NotFoundPage';
import { AuthProvider } from '../contexts/AuthContext';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="tasks" element={<TaskListPage />} />
            <Route path="tasks/:id" element={<TaskDetailPage />} />
            <Route path="categories" element={<CategoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Not Found Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default AppRouter;
