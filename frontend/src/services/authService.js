// src/services/authService.js
import apiClient from './api';

/**
 * Fungsi untuk melakukan login.
 * Menggunakan endpoint: POST /auth/login
 */
const login = async (email, password) => {
  try {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    // Backend returns: { message, user: {id, name, email, role}, accessToken }
    if (response.data.accessToken && response.data.user) {
      // Simpan data user dengan struktur yang konsisten
      const userData = {
        ...response.data.user,
        accessToken: response.data.accessToken
      };
      sessionStorage.setItem('user', JSON.stringify(userData));
      console.log('User data saved to sessionStorage:', userData);
    }

    return {
      ...response.data.user,
      accessToken: response.data.accessToken
    };
  } catch (error) {
    console.error("Login Error:", error.response?.data || error.message);
    throw error;
  }
};

const register = async (registrationData) => {
  try {
    const response = await apiClient.post('/auth/register', registrationData);
    return response.data;
  } catch (error) {
    console.error("Registration Error:", error.response?.data || error.message);
    throw error;
  }
};

const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error("Logout API call failed, but proceeding with client-side logout.", error);
  } finally {
    sessionStorage.removeItem('user');
    window.location.href = '/';
  }
};

// --- TAMBAHAN: FUNGSI UNTUK RESET PASSWORD ---

/**
 * Meminta OTP untuk reset password.
 * Menggunakan endpoint: POST /password/forgot-password
 */
const forgotPassword = async (email) => {
  try {
    console.log('Sending forgot password request for email:', email);
    const response = await apiClient.post('/password/forgot-password', { email });
    console.log('Forgot password response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Forgot password error:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
    // Error is already standardized by API interceptor
    throw error;
  }
};

/**
 * Memverifikasi OTP yang diterima.
 * Menggunakan endpoint: POST /password/verify-otp
 */
const verifyOtp = async (email, otp) => {
  try {
    console.log('Verifying OTP for email:', email, 'OTP:', otp);
    const response = await apiClient.post('/password/verify-otp', { email, otp });
    console.log('Verify OTP response:', response.data);
    return response.data; // Akan mengembalikan resetToken
  } catch (error) {
    console.error('Verify OTP error:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
    // Error is already standardized by API interceptor
    throw error;
  }
};

/**
 * Mengatur ulang password dengan token.
 * Menggunakan endpoint: POST /password/reset-password
 */
const resetPassword = async (email, password, resetToken) => {
  try {
    console.log('Resetting password for email:', email, 'with token:', resetToken);
    const response = await apiClient.post('/password/reset-password', { email, password, resetToken });
    console.log('Reset password response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Reset password error:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
    // Error is already standardized by API interceptor
    throw error;
  }
};


// --- Helper Functions (Tidak ada perubahan) ---
const getCurrentUser = () => {
  const userString = sessionStorage.getItem('user');
  if (!userString) {
    console.log('No user data in sessionStorage');
    return null;
  }
  
  try {
    const userData = JSON.parse(userString);
    console.log('Current user data:', userData);
    return userData;
  } catch (error) {
    console.error('Error parsing user data:', error);
    sessionStorage.removeItem('user'); // Hapus data yang corrupt
    return null;
  }
};

const isAuthenticated = () => {
  const user = getCurrentUser();
  const hasToken = !!(user?.accessToken);
  console.log('Authentication check:', { hasUser: !!user, hasToken });
  return !!user && hasToken;
};

const getUserRole = () => {
  const user = getCurrentUser();
  const role = user?.role || null;
  console.log('User role:', role);
  return role;
};

const isAdmin = () => {
  return getUserRole() === 'admin';
};

const isSuperAdmin = () => {
  return getUserRole() === 'super_admin';
};

const authService = {
  login,
  register,
  logout,
  forgotPassword, // <-- Tambahkan
  verifyOtp,      // <-- Tambahkan
  resetPassword,  // <-- Tambahkan
  getCurrentUser,
  isAuthenticated,
  getUserRole,
  isAdmin,
  isSuperAdmin,
};

export default authService;