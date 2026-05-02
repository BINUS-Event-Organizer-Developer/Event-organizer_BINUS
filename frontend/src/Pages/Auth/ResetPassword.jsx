import React, { useEffect, useState } from 'react';
import { FaLock } from 'react-icons/fa';
import { useLocation, useNavigate, Link } from 'react-router';
import authService from '../../services/authService';
import { validatePassword } from '../../services/validation';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

const ResetPassword = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);

  useEffect(() => {
    const qEmail = query.get('email');
    const qToken = query.get('token');
    if (qEmail) setEmail(qEmail);
    if (qToken) setToken(qToken);
  }, [query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validate password using backend rules
    const passwordValidationErrors = validatePassword(password);
    setPasswordErrors(passwordValidationErrors);

    if (passwordValidationErrors.length > 0) {
      setError('Please fix the password field.');
      return;
    }

    if (!email || !token) {
      setError('Data tidak lengkap. Silakan kembali ke halaman sebelumnya.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.resetPassword(email, password, token);
      setMessage(res.message || 'Password berhasil direset.');
      setTimeout(() => navigate('/login/admin'), 1000);
    } catch (err) {
      if (err.errorField) {
        // Jika ada validasi field dari backend
        const fieldMsgs = Object.values(err.errorField).join(', ');
        setError(fieldMsgs || err.message || 'Gagal reset password.');

        // Optional: Update passwordErrors list if backend sends specific rules
        if (err.errorField.password) {
          setPasswordErrors(prev => [...prev, err.errorField.password]);
        }
      } else {
        const msg = err?.message || err?.error || 'Gagal reset password.';
        setError(typeof msg === 'string' ? msg : 'Gagal reset password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="background_home w-screen h-screen flex justify-center items-center relative">
      <div className="absolute w-full h-full inset-y-0 inset-x-0 bg-[#B0D6F580]" />
      <div className="bg-[#3F88BC] z-10 sm:w-fit md:w-96 lg:w-[600px] p-10 md:p-8 rounded-md text-white lg:absolute right-10 bottom-5">
        <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
        <p className="text-sm mb-6">Masukkan password baru Anda.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center bg-white rounded-md overflow-hidden">
            <div className="p-3 text-[#3F88BC]"><FaLock /></div>
            <div className="w-px bg-[#3F88BC] h-10" />
            <input type="password" className={`w-full p-3 text-gray-700 outline-none ${passwordErrors.length ? 'bg-red-50' : ''}`} placeholder="Password baru (min. 8 karakter)" value={password} onChange={(e) => { setPassword(e.target.value); setPasswordErrors(validatePassword(e.target.value)); }} minLength="8" maxLength="30" />
          </div>
          {passwordErrors.map((err, idx) => <p key={idx} className="text-red-200 text-xs">{err}</p>)}
          {error && <p className="text-red-200 text-sm">{error}</p>}
          {message && <p className="text-green-200 text-sm">{message}</p>}
          <div className="flex justify-between items-center">
            <Link className="underline text-sm" to={`/login/admin`}>Kembali</Link>
            <button type="submit" className="w-fit py-3 px-8 bg-blue-700 rounded-md hover:bg-blue-800 transition" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;


