import { useAuth } from '../../contexts/AuthContext'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-medium">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="ml-6">
              <h3 className="text-xl font-medium text-gray-900">
                {user?.first_name} {user?.last_name}
              </h3>
              <p className="text-gray-600">{user?.email}</p>
              <button className="mt-2 text-blue-600 hover:text-blue-800 text-sm">
                Change avatar
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={user?.first_name || ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                readOnly
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={user?.last_name || ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                readOnly
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                readOnly
              />
            </div>
          </div>
          
          <div className="mt-6">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Edit Profile
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Preferences</h2>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme
              </label>
              <select className="w-full md:w-auto border border-gray-300 rounded-md px-3 py-2">
                <option>Light</option>
                <option>Dark</option>
                <option>System</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Format
              </label>
              <select className="w-full md:w-auto border border-gray-300 rounded-md px-3 py-2">
                <option>12-hour</option>
                <option>24-hour</option>
              </select>
            </div>
            
            <div>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                <span className="text-sm text-gray-700">Email notifications</span>
              </label>
            </div>
            
            <div>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                <span className="text-sm text-gray-700">Due date reminders</span>
              </label>
            </div>
            
            <div>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Daily digest</span>
              </label>
            </div>
          </div>
          
          <div className="mt-6">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Save Preferences
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Security</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Password</h3>
              <p className="text-sm text-gray-600">Last changed 3 months ago</p>
              <button className="mt-2 text-blue-600 hover:text-blue-800 text-sm">
                Change password
              </button>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-900">Two-factor authentication</h3>
              <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
              <button className="mt-2 text-blue-600 hover:text-blue-800 text-sm">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
