import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaTachometerAlt, FaTasks, FaFolder, FaUser, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setSidebarOpen }) => {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 z-20 bg-black opacity-50 transition-opacity lg:hidden ${
          isSidebarOpen ? 'block' : 'hidden'
        }`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <div
        className={`fixed z-30 inset-y-0 left-0 w-64 bg-gray-800 text-white transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex lg:flex-col`}
      >
        <div className="p-4 text-2xl font-bold">TaskFlow</div>
        <nav className="mt-10 flex-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center p-4 text-lg ${isActive ? 'bg-gray-700' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <FaTachometerAlt className="mr-3" />
            Dashboard
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              `flex items-center p-4 text-lg ${isActive ? 'bg-gray-700' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <FaTasks className="mr-3" />
            Tasks
          </NavLink>
          <NavLink
            to="/categories"
            className={({ isActive }) =>
              `flex items-center p-4 text-lg ${isActive ? 'bg-gray-700' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <FaFolder className="mr-3" />
            Categories
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center p-4 text-lg ${isActive ? 'bg-gray-700' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <FaUser className="mr-3" />
            Profile
          </NavLink>
        </nav>
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center p-4 text-lg text-red-400 hover:bg-gray-700"
          >
            <FaSignOutAlt className="mr-3" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
