import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';

interface UserMenuProps {
  user: User;
}

const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center">
        <img
          src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.id}`}
          alt="User Avatar"
          className="h-8 w-8 rounded-full"
        />
        <span className="hidden md:block ml-2">{user.first_name}</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50">
          <Link
            to="/profile"
            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            <FaUser className="mr-3" />
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            <FaSignOutAlt className="mr-3" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
