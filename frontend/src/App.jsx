// src/App.jsx
import './index.css';
import { Route, Routes, Link, redirect, Navigate } from 'react-router-dom';

import LoginUserPage from './Pages/Login';
import LoginAdminPage from './Pages/Admin/Login';
import LoginSuperAdminPage from './Pages/SuperAdmin/Login';
import DashboardUser from './Pages/Dashboard';
import AdminDashboard from './Pages/Admin/Dashboard';
import ProtectedRoute from './Pages/Auth/ProtectedRoute';
import RegisterUserPage from './Pages/Register';
import RegisterAdminPage from './Pages/Admin/Register';
import RegisterSuperAdminPage from './Pages/SuperAdmin/Register';
import SuperAdminDashboard from './Pages/SuperAdmin/Dashboard';
import ForgotPassword from './Pages/Auth/ForgotPassword';
import VerifyOtp from './Pages/Auth/VerifyOtp';
import ResetPassword from './Pages/Auth/ResetPassword';

const UnauthorizedPage = () => (
  <div className='flex flex-col items-center justify-center h-screen bg-gray-100'>
    <h1 className='text-4xl font-bold text-red-500'>403 - Akses Ditolak</h1>
    <p className='text-gray-600 mt-2'>Anda tidak memiliki izin untuk melihat halaman ini.</p>
    <Link to="/" className='mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'>
      Kembali Login
    </Link>
  </div>
);

function App() {
  return (
    <div className="w-screen min-h-screen overflow-x-hidden bg-gray-100">
      <Routes>
        <Route path='/register' element={<RegisterUserPage />} />
        <Route path='/register/admin' element={<RegisterAdminPage />} />
        <Route path='/register/superadmin' element={<RegisterSuperAdminPage />} />
        <Route path="/" element={<DashboardUser />} />
        <Route path="/admin" element={<Navigate to="/login/admin" />} />
        <Route path="/superadmin" element={<Navigate to="/login/superadmin" />} />
        <Route path="/login" element={<LoginUserPage />} />
        <Route path="/login/admin" element={<LoginAdminPage />} />
        <Route path="/login/superadmin" element={<LoginSuperAdminPage />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={<DashboardUser />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']} loginUrl="/login/admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['super_admin']} loginUrl="/login/superadmin">
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<div className='flex items-center justify-center h-screen'><h1 className='text-4xl font-bold'>404 - Halaman Tidak Ditemukan</h1></div>} />
      </Routes>
    </div>
  );
}

export default App;