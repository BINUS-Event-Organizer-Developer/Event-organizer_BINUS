import React, { useState } from 'react';
import { FaEnvelope } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router';
import authService from '../../services/authService';
import { validateEmail } from '../../services/validation';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailErrors, setEmailErrors] = useState([]);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validate email using backend rules
    const emailValidationErrors = validateEmail(email);
    setEmailErrors(emailValidationErrors);

    if (emailValidationErrors.length > 0) {
      setError('Please fix the email field.');
      return;
    }

    setLoading(true);

    try {
      const res = await authService.forgotPassword(email);
      setMessage(res.message || 'Kode OTP telah dikirim ke email Anda.');
      // Lanjut ke halaman OTP dengan membawa email
      setTimeout(() => navigate(`/verify-otp?email=${encodeURIComponent(email)}`), 800);
    } catch (err) {
      const msg = err?.message || err?.error || 'Gagal mengirim OTP.';
      setError(typeof msg === 'string' ? msg : 'Gagal mengirim OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="background_home w-screen h-screen flex justify-center items-center relative">
      <div className="absolute w-full h-full inset-y-0 inset-x-0 bg-[#B0D6F580]" />
      <div className="bg-[#3F88BC] z-10 sm:w-fit md:w-96 lg:w-[600px] p-10 md:p-8 rounded-md text-white lg:absolute right-10 bottom-5">
        <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
        <p className="text-sm mb-6">Masukkan email Anda. Kami akan mengirim kode OTP untuk verifikasi.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center bg-white rounded-md overflow-hidden">
            <div className="p-3 text-[#3F88BC]"><FaEnvelope /></div>
            <div className="w-px bg-[#3F88BC] h-10" />
            <input type="email" className={`w-full p-3 text-gray-700 outline-none ${emailErrors.length ? 'bg-red-50' : ''}`} placeholder="Email (@binus.ac.id or @gmail.com)" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErrors(validateEmail(e.target.value)); }} />
          </div>
          {emailErrors.map((err, idx) => <p key={idx} className="text-red-200 text-xs">{err}</p>)}
          {error && <p className="text-red-200 text-sm">{error}</p>}
          {message && <p className="text-green-200 text-sm">{message}</p>}
          <div className="flex justify-between items-center">
            <Link className="underline text-sm" to={".."}>Kembali ke Login</Link>
            <button type="submit" className="w-fit py-3 px-8 bg-blue-700 rounded-md hover:bg-blue-800 transition" disabled={loading}>
              {loading ? 'Mengirim...' : 'Kirim OTP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;


