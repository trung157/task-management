import React from 'react';
import { FaBars, FaBell } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import UserMenu from './UserMenu';

interface HeaderProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ isSidebarOpen, setSidebarOpen }) => {
  const { user } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-md p-4 flex justify-between items-center">
      <div className="flex items-center">
        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="text-gray-500 focus:outline-none lg:hidden"
        >
          <FaBars className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold ml-4">Task Management</h1>
      </div>
      <div className="flex items-center space-x-4">
        <button className="relative">
          <FaBell className="h-6 w-6" />
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>
        {user && <UserMenu user={user} />}
      </div>
    </header>
  );
};

export default Header;
