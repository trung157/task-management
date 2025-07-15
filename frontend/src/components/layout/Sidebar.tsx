import { NavLink } from 'react-router-dom'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
  },
  {
    name: 'Tasks',
    href: '/tasks',
    icon: '✅',
  },
  {
    name: 'Categories',
    href: '/categories',
    icon: '📁',
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: '👤',
  },
  {
    name: 'Task List Demo',
    href: '/task-list-demo',
    icon: '🎨',
  },
  {
    name: 'Task Form Demo',
    href: '/task-form-demo',
    icon: '📝',
  },
  {
    name: 'TaskContext Demo',
    href: '/task-context-demo',
    icon: '⚙️',
  },
  {
    name: 'Auth Forms Demo',
    href: '/auth-forms-demo',
    icon: '🔐',
  },
]

export default function Sidebar() {
  return (
    <div className="bg-white w-64 border-r border-gray-200">
      <div className="p-6">
        <div className="text-lg font-bold text-gray-900 mb-8">
          TaskFlow
        </div>
        
        <nav className="space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="mr-3 text-base">{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
