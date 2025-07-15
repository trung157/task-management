import { Menu, Search, Bell, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-slate-200">
      <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <button
          type="button"
          className="-m-2.5 p-2.5 text-slate-700 lg:hidden"
          onClick={onMenuClick}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" />
        </button>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-200 lg:hidden" />

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          {/* Search */}
          <div className="relative flex flex-1 max-w-md">
            <label htmlFor="search-field" className="sr-only">
              Search
            </label>
            <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400 pl-3" />
            <input
              id="search-field"
              className="input h-full w-full border-0 pl-10 pr-0 text-slate-900 placeholder:text-slate-400 focus:ring-0 sm:text-sm bg-transparent"
              placeholder="Search tasks..."
              type="search"
              name="search"
            />
          </div>

          <div className="flex items-center gap-x-4 lg:gap-x-6">
            {/* Notifications */}
            <button 
              type="button" 
              className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-500 relative"
            >
              <span className="sr-only">View notifications</span>
              <Bell className="h-6 w-6" />
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                3
              </span>
            </button>

            {/* Separator */}
            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" />

            {/* Profile dropdown */}
            <div className="relative">
              <div className="flex items-center gap-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shadow-lg">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                </div>
                
                <div className="hidden lg:block">
                  <div className="text-sm font-medium text-slate-900">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {user?.email}
                  </div>
                </div>

                <div className="flex items-center gap-x-1">
                  <button 
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => logout('manual')}
                    className="btn btn-ghost btn-sm"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
