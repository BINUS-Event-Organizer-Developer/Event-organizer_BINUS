import React, { useState, useEffect } from 'react';
import { FaKey } from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router';
import authService from '../../services/authService';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

const VerifyOtp = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpErrors, setOtpErrors] = useState([]);

  useEffect(() => {
    const qEmail = query.get('email');
    if (qEmail) setEmail(qEmail);
  }, [query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
    // Validate OTP - backend expects exactly 6 characters
    if (!otp) {
      setOtpErrors(['OTP wajib diisi.']);
      setError('Please fix the OTP field.');
      setLoading(false);
      return;
    }
    
    if (otp.length !== 6) {
      setOtpErrors(['OTP 6 karakter.']);
      setError('Please fix the OTP field.');
      setLoading(false);
      return;
    }
    
    setOtpErrors([]);
    
    if (!email) {
      setError('Email tidak ditemukan. Silakan kembali ke halaman sebelumnya.');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Attempting to verify OTP for email:', email, 'OTP:', otp);
      const res = await authService.verifyOtp(email, otp);
      console.log('Verify OTP response:', res);
      setMessage(res.message || 'OTP valid. Lanjutkan reset password.');
      // Arahkan ke halaman reset password dengan membawa token dari backend
      const resetToken = res.resetToken || res.token || '';
      setTimeout(() => navigate(`/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(resetToken)}`), 800);
    } catch (err) {
      console.error('Verify OTP error in component:', err);
      console.error('Error details:', {
        message: err?.message,
        error: err?.error,
        status: err?.status,
        response: err?.response
      });
      const msg = err?.message || err?.error || 'OTP tidak valid.';
      setError(typeof msg === 'string' ? msg : 'OTP tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="background_home w-screen h-screen flex justify-center items-center relative">
      <div className="absolute w-full h-full inset-y-0 inset-x-0 bg-[#B0D6F580]" />
      <div className="bg-[#3F88BC] z-10 sm:w-fit md:w-96 lg:w-[600px] p-10 md:p-8 rounded-md text-white lg:absolute right-10 bottom-5">
        <h1 className="text-2xl font-bold mb-2">Verifikasi OTP</h1>
        <p className="text-sm mb-6">Masukkan kode OTP yang dikirim ke email Anda.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center bg-white rounded-md overflow-hidden">
            <div className="p-3 text-[#3F88BC]"><FaKey /></div>
            <div className="w-px bg-[#3F88BC] h-10" />
            <input type="text" className={`w-full p-3 text-gray-700 outline-none ${otpErrors.length ? 'bg-red-50' : ''}`} placeholder="Kode OTP (6 digit)" value={otp} onChange={(e) => { const val = e.target.value.replace(/\D/g, '').slice(0, 6); setOtp(val); setOtpErrors(val.length === 6 ? [] : val.length === 0 ? ['OTP wajib diisi.'] : ['OTP 6 karakter.']); }} maxLength="6" />
          </div>
          {otpErrors.map((err, idx) => <p key={idx} className="text-red-200 text-xs">{err}</p>)}
          {error && <p className="text-red-200 text-sm">{error}</p>}
          {message && <p className="text-green-200 text-sm">{message}</p>}
          <div className="flex justify-between items-center">
            <Link className="underline text-sm" to={`/forgot-password`}>Ganti email</Link>
            <button type="submit" className="w-fit py-3 px-8 bg-blue-700 rounded-md hover:bg-blue-800 transition" disabled={loading}>
              {loading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerifyOtp;


