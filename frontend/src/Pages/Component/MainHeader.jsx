// src/components/MainHeader.jsx
import React from 'react';
import { useAuth } from '../Auth/AuthContext';
import avatar from '../../assets/profilePhoto.jpg';

const MainHeader = ({ pageTitle }) => {
  const { user, logout } = useAuth();
  
  // Fallback to localStorage if context user is null
  const currentUser = user || JSON.parse(localStorage.getItem('user') || 'null');
  


  // Jika user tidak ada, tampilkan header default sebagai Public
  if (!currentUser) {
    return (
      <div className="w-full h-fit px-10 py-5 bg-white grid grid-cols-3 gap-6 shadow-md items-center">
        <div>
          <h3 className="text-[#36699F] font-bold text-sm">BINA NUSANTARA UNIVERSITY</h3>
          <h1 className="font-bold text-2xl">
            {pageTitle || "Bekasi"} <span className="text-[#EC6A37]">@Event Viewer</span>
          </h1>
        </div>

        <div />

        <div className="flex items-center justify-end gap-5">
          <div className="text-right">
            <h1 className="text-lg font-semibold">Hello Binusian</h1>
            <p className="text-sm text-gray-500">PUBLIC</p>
          </div>
          <img src={avatar} alt="Public" className="w-10 h-10 rounded-full object-cover" />

          <button onClick={() => window.location.href = '/login'} className="self-center ml-4 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-fit px-10 py-5 bg-white grid grid-cols-3 gap-6 shadow-md items-center">
      <div>
        <h3 className="text-[#36699F] font-bold text-sm">BINA NUSANTARA UNIVERSITY</h3>
        <h1 className="font-bold text-2xl">
          {pageTitle || "Bekasi"} <span className="text-[#EC6A37]">@Event Viewer</span>
        </h1>
      </div>

      <div />

      <div className="flex items-center justify-end gap-5">
        <div className="text-right">
          <h1 className="text-lg font-semibold">{currentUser?.name || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'Hello Binusian'}</h1>
          <p className="text-sm text-gray-500">{currentUser?.role?.replace('_', ' ').toUpperCase() || 'PUBLIC'}</p>
        </div>
        <img src={currentUser?.avatar || avatar} alt={currentUser?.role || 'User'} className="w-10 h-10 rounded-full object-cover" />

        <button onClick={logout} className="self-center ml-4 px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">
          Log Out
        </button>
      </div>
    </div>
  );
};

export default MainHeader;