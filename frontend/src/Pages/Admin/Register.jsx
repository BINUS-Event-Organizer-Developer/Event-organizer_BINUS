// src/Pages/RegisterUserPage.jsx
import React, { useState } from 'react';
import { FaUser, FaLock, FaEnvelope } from "react-icons/fa";
import { Link, useNavigate } from "react-router";
import authService from '../../services/authService';
import { validateEmail, validatePassword, validateName } from '../../services/validation';

import logo from '../../assets/logo.png';

const RegisterAdminPage = () => {
  // State untuk semua field yang dibutuhkan oleh backend
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin', // Default role untuk registrasi publik
  });
  
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    
    // Real-time validation
    let errors = [];
    switch(name) {
      case 'firstName':
        errors = validateName(value, 'First name');
        break;
      case 'lastName':
        errors = validateName(value, 'Last name');
        break;
      case 'email':
        errors = validateEmail(value);
        break;
      case 'password':
        errors = validatePassword(value);
        break;
      case 'confirmPassword':
        if (value !== formData.password) {
          errors = ['Konfirmasi password harus sama dengan password.'];
        }
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: errors.length > 0 ? errors[0] : '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    // Validate all fields
    const validationErrors = {
      firstName: validateName(formData.firstName, 'First name'),
      lastName: validateName(formData.lastName, 'Last name'),
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
      confirmPassword: formData.password !== formData.confirmPassword ? ['Konfirmasi password harus sama dengan password.'] : []
    };
    
    // Convert to single error messages
    const errorMessages = {};
    Object.keys(validationErrors).forEach(key => {
      if (validationErrors[key].length > 0) {
        errorMessages[key] = validationErrors[key][0];
      }
    });
    
    setFieldErrors(errorMessages);
    
    // Check if there are any errors
    if (Object.keys(errorMessages).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register(formData);
      setSuccessMessage(response.message || 'Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login/admin');
      }, 2500);
    } catch (err) {
      // err adalah apiData langsung (dari interceptor)
      const apiData = err || {};
      setError(apiData.message || 'Registration failed. Please try again.');
      
      console.log('Error response from backend:', apiData);
      
      if (apiData.errorField && typeof apiData.errorField === 'object') {
        console.log('Setting field errors from errorField:', apiData.errorField);
        setFieldErrors(apiData.errorField);
      } else if (Array.isArray(apiData.errors)) {
        // Handle Sequelize validation errors (array)
        const sequelizeErrors = {};
        apiData.errors.forEach(errObj => {
          if (errObj.field && errObj.message) {
            sequelizeErrors[errObj.field] = errObj.message;
          } else if (errObj.path && errObj.message) {
            // Handle Zod validation errors
            sequelizeErrors[errObj.path[0] || errObj.path] = errObj.message;
          }
        });
        console.log('Setting field errors from errors array:', sequelizeErrors);
        setFieldErrors(sequelizeErrors);
      } else if (apiData.details && Array.isArray(apiData.details)) {
        // Handle another error format
        const backendErrors = {};
        apiData.details.forEach(detail => {
          const field = detail.path?.[0];
          if (field) backendErrors[field] = detail.message;
        });
        console.log('Setting field errors from details:', backendErrors);
        setFieldErrors(backendErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  // ClassName dari kode Anda
  const className = {
    container: "background_home w-screen h-screen flex justify-center items-center relative",
    overlay: "absolute w-full h-full inset-y-0 inset-x-0 bg-[#B0D6F580]",
    formContainer: "bg-[#3F88BC] z-10 sm:w-fit md:w-96 lg:w-[600px] p-10 md:p-8 rounded-md text-white lg:absolute right-10 bottom-5",
    logoContainer: "text-center space-y-2 mb-4 ",
    logoText: "text-xs font-semibold ml-2",
    form: "space-y-4",
    inputGroup: "flex items-center bg-white rounded-md overflow-hidden",
    icon: "p-3 text-[#3F88BC]",
    separator: "w-px bg-[#3F88BC] h-10",
    input: "w-full p-3 text-gray-700 outline-none",
    button: "w-fit py-3 px-8 bg-blue-700 rounded-md hover:bg-blue-800 transition disabled:bg-blue-400",
    footer: "inset-x-0 text-center absolute bottom-0 bg-white",
    loginLink: "text-sm mt-4 text-center"
  };

  return (
    <div className={className.container}>
      <div className={className.overlay} />
      <div className={className.formContainer}>
        <div className="w-full flex items-center justify-end gap-5">
          <div className={className.logoContainer}>
            <img src={logo} alt="Logo Binus" className="h-20 w-fit" />
            <p className={className.logoText}>Event Viewer</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Create Admin Account</h1>
        <p className="text-sm mb-6">Join us! Fill in the details below to create your account.</p>

        <form className={className.form} onSubmit={handleSubmit}>
          {/* First Name */}
          <div className={className.inputGroup}>
            <div className={className.icon}><FaUser /></div>
            <div className={className.separator}></div>
            <input name="firstName" type="text" placeholder="First Name" className={`${className.input} ${fieldErrors.firstName ? 'border-red-300' : ''}`} value={formData.firstName} onChange={handleChange} maxLength="20" />
          </div>
          {fieldErrors.firstName && <p className="text-red-300 text-xs mt-1">{fieldErrors.firstName}</p>}
          {/* Last Name */}
          <div className={className.inputGroup}>
            <div className={className.icon}><FaUser /></div>
            <div className={className.separator}></div>
            <input name="lastName" type="text" placeholder="Last Name" className={`${className.input} ${fieldErrors.lastName ? 'border-red-300' : ''}`} value={formData.lastName} onChange={handleChange} maxLength="20" />
          </div>
          {fieldErrors.lastName && <p className="text-red-300 text-xs mt-1">{fieldErrors.lastName}</p>}
          {/* Email */}
          <div className={className.inputGroup}>
            <div className={className.icon}><FaEnvelope /></div>
            <div className={className.separator}></div>
            <input name="email" type="email" placeholder="Email (@binus.ac.id or @gmail.com)" className={`${className.input} ${fieldErrors.email ? 'border-red-300' : ''}`} value={formData.email} onChange={handleChange} />
          </div>
          {fieldErrors.email && <p className="text-red-300 text-xs mt-1">{fieldErrors.email}</p>}
          {/* Password */}
          <div className={className.inputGroup}>
            <div className={className.icon}><FaLock /></div>
            <div className={className.separator}></div>
            <input name="password" type="password" placeholder="Password (min. 8 characters)" className={`${className.input} ${fieldErrors.password ? 'border-red-300' : ''}`} value={formData.password} onChange={handleChange} minLength="8" maxLength="64" />
          </div>
          {fieldErrors.password && <p className="text-red-300 text-xs mt-1">{fieldErrors.password}</p>}
          {/* Confirm Password */}
          <div className={className.inputGroup}>
            <div className={className.icon}><FaLock /></div>
            <div className={className.separator}></div>
            <input name="confirmPassword" type="password" placeholder="Confirm Password" className={`${className.input} ${fieldErrors.confirmPassword ? 'border-red-300' : ''}`} value={formData.confirmPassword} onChange={handleChange} />
          </div>
          {fieldErrors.confirmPassword && <p className="text-red-300 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
          
          {/* Role (disembunyikan: admin) */}
          <input name="role" type="hidden" value="admin" />

          {error && <p className="text-red-300 text-sm">{error}</p>}
          {successMessage && <p className="text-green-300 text-sm">{successMessage}</p>}
          
          <div className="flex justify-between items-center">
            <button type="submit" className={className.button} disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
        <div className={className.loginLink}>
            <p>Already have an account? <Link to="/login/admin" className="font-bold hover:underline">Login here</Link></p>
        </div>
      </div>

      <footer className={className.footer}>
        <h1 className="text-gray-600">Universitas Bina Nusantara Bekasi 2025</h1>
      </footer>
    </div>
  );
};

export default RegisterAdminPage;