import { NavLink } from 'react-router-dom';
import { 
  HomeIcon, 
  CheckSquareIcon, 
  FolderIcon, 
  UserIcon, 
  ListIcon,
  PlusIcon,
  SettingsIcon,
  LockIcon,
  XIcon
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
  },
  {
    name: 'Tasks',
    href: '/tasks',
    icon: CheckSquareIcon,
  },
  {
    name: 'Categories',
    href: '/categories',
    icon: FolderIcon,
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: UserIcon,
  },
];

const demoNavigation = [
  {
    name: 'Task List Demo',
    href: '/task-list-demo',
    icon: ListIcon,
  },
  {
    name: 'Task Form Demo',
    href: '/task-form-demo',
    icon: PlusIcon,
  },
  {
    name: 'TaskContext Demo',
    href: '/task-context-demo',
    icon: SettingsIcon,
  },
  {
    name: 'Auth Forms Demo',
    href: '/auth-forms-demo',
    icon: LockIcon,
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 border-r border-slate-200">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-gradient">TaskFlow</h1>
          </div>
          
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <div className="text-xs font-semibold leading-6 text-slate-400 uppercase tracking-wide">
                  Main
                </div>
                <ul role="list" className="-mx-2 mt-2 space-y-1">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.name}>
                        <NavLink
                          to={item.href}
                          className={({ isActive }) =>
                            `nav-link ${isActive ? 'nav-link-active' : ''}`
                          }
                        >
                          <Icon className="h-4 w-4" />
                          {item.name}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
              
              <li>
                <div className="text-xs font-semibold leading-6 text-slate-400 uppercase tracking-wide">
                  Demo Pages
                </div>
                <ul role="list" className="-mx-2 mt-2 space-y-1">
                  {demoNavigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.name}>
                        <NavLink
                          to={item.href}
                          className={({ isActive }) =>
                            `nav-link ${isActive ? 'nav-link-active' : ''}`
                          }
                        >
                          <Icon className="h-4 w-4" />
                          {item.name}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`relative z-50 lg:hidden ${isOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-slate-900/80" />
        <div className="fixed inset-0 flex">
          <div className="relative mr-16 flex w-full max-w-xs flex-1">
            <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
              <button type="button" className="-m-2.5 p-2.5" onClick={onClose}>
                <span className="sr-only">Close sidebar</span>
                <XIcon className="h-6 w-6 text-white" />
              </button>
            </div>

            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2">
              <div className="flex h-16 shrink-0 items-center">
                <h1 className="text-xl font-bold text-gradient">TaskFlow</h1>
              </div>
              
              <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                  <li>
                    <div className="text-xs font-semibold leading-6 text-slate-400 uppercase tracking-wide">
                      Main
                    </div>
                    <ul role="list" className="-mx-2 mt-2 space-y-1">
                      {navigation.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.name}>
                            <NavLink
                              to={item.href}
                              onClick={onClose}
                              className={({ isActive }) =>
                                `nav-link ${isActive ? 'nav-link-active' : ''}`
                              }
                            >
                              <Icon className="h-4 w-4" />
                              {item.name}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                  
                  <li>
                    <div className="text-xs font-semibold leading-6 text-slate-400 uppercase tracking-wide">
                      Demo Pages
                    </div>
                    <ul role="list" className="-mx-2 mt-2 space-y-1">
                      {demoNavigation.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.name}>
                            <NavLink
                              to={item.href}
                              onClick={onClose}
                              className={({ isActive }) =>
                                `nav-link ${isActive ? 'nav-link-active' : ''}`
                              }
                            >
                              <Icon className="h-4 w-4" />
                              {item.name}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
