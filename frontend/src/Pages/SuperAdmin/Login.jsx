import { FaBook, FaEnvelope, FaLock, FaUser } from "react-icons/fa"; // Import icons from react-icons
import logo from '../../assets/logo.png';
import keySupAdmin from '../../assets/adminSuper.png';
import { Link, useNavigate } from "react-router";
import authService from "../../services/authService";
import { useState } from "react";

const LoginSup = () => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const className = {
    container:
      "background_home w-screen h-screen flex justify-center items-center relative",
    overlay: "absolute w-full h-full inset-y-0 inset-x-0 bg-[#B0D6F580]",
    formContainer:
      "bg-[#3F88BC] z-10 sm:w-fit md:w-96 lg:w-[600px] p-10 md:p-8 rounded-md text-white lg:absolute right-10 bottom-5",
    logoContainer: "space-y-2 mb-4 ",
    logoText: "text-xs text-center font-semibold ml-2",
    form: "space-y-4",
    inputGroup: "flex items-center bg-white rounded-md overflow-hidden",
    icon: "p-3 text-[#3F88BC]",
    separator: "w-px bg-[#3F88BC] h-10", // Separator between icon and input
    input: "w-full p-3 text-gray-700 outline-none",
    button:
      "w-fit py-3 px-8 bg-blue-700 rounded-md hover:bg-blue-800 transition",
    forgotPassword: "text-sm underline cursor-pointer hover:text-gray-300",
    flex: "flex items-center justify-between w-full gap-3",
    footer:
      "inset-x-0 place-items-center absolute bottom-0 bg-white grid grid-cols-3 gap-5 justify-between",
    grid: "w-full grid grid-cols-2 gap-3 place-items-center",
    link: "px-8 py-5 bg-blue-700 text-white font-bold flex items-center gap-3",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Panggil authService.login dengan email dan password
      await authService.login(email, password);

      // Jika tidak ada error, berarti login berhasil
      // Redirect ke dashboard
      navigate('/superadmin/dashboard');

    } catch (err) {
      // Menangkap error dari backend dan menampilkannya
      const apiData = err.response?.data || {};
      const errorMessage = apiData.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      if (apiData.errorField) {
        setFieldErrors(apiData.errorField);
      } else {
        setFieldErrors({});
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className.container}>
      <div className={className.overlay} />
      <div className={className.formContainer}>
        <div className="w-full flex items-center justify-between gap-5">
          <img src={keySupAdmin} className="h-28" />
          <div className={className.logoContainer}>
            <img src={logo} alt="Logo Binus" className="h-16" />
            <p className={className.logoText}>Event Viewer</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Admin Login</h1>
        <p className="text-sm mb-6">
          Please Enter your Credentials to access your account.
        </p>
        <form className={className.form} onSubmit={handleSubmit}>
          <div className={className.inputGroup}>
            <div className={className.icon}><FaEnvelope /></div>
            <div className={className.separator}></div>
            <input type="email" placeholder="Enter your Email" className={className.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {fieldErrors.email && <p className="text-red-300 text-xs mt-1">{fieldErrors.email}</p>}
          <div className={className.inputGroup}>
            <div className={className.icon}><FaLock /></div>
            <div className={className.separator}></div>
            <input type="password" placeholder="Enter your Password" className={className.input} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {fieldErrors.password && <p className="text-red-300 text-xs mt-1">{fieldErrors.password}</p>}

          {error && <p className="text-red-300 text-sm">{error}</p>}
          <div className="flex justify-between items-center text-sm mt-1">
            <a className="underline" href="/forgot-password">lupa password</a>
          </div>
          <div className="flex">
            <button type="submit" className={className.button} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>

      <footer className={className.footer}>
        <div className={className.grid}>
          <Link className={className.link} to={"/"}>
            <FaBook /> <p>Event Viewer</p>
          </Link>
          <Link className={className.link} to={"/login/admin"}>
            <FaUser /> <p>Sign in as Admin</p>
          </Link>
        </div>
        <h1 className="text-gray-600">
          Universitas Bina Nusantara Bekasi 2025
        </h1>
        <div></div>
      </footer>
    </div>
  );
};

export default LoginSup;
