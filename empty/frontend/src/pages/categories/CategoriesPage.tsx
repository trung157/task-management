export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600">Organize your tasks with categories</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          + New Category
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sample categories */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
              <h3 className="font-medium text-gray-900">Work</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">Work-related tasks and projects</p>
          <div className="text-sm text-gray-500">
            <span className="font-medium">15 tasks</span> • 
            <span className="ml-1">8 completed</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
              <h3 className="font-medium text-gray-900">Personal</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">Personal goals and activities</p>
          <div className="text-sm text-gray-500">
            <span className="font-medium">7 tasks</span> • 
            <span className="ml-1">3 completed</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-purple-500 rounded-full mr-3"></div>
              <h3 className="font-medium text-gray-900">Learning</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">Educational content and skill development</p>
          <div className="text-sm text-gray-500">
            <span className="font-medium">12 tasks</span> • 
            <span className="ml-1">9 completed</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
              <h3 className="font-medium text-gray-900">Shopping</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">Shopping lists and purchases</p>
          <div className="text-sm text-gray-500">
            <span className="font-medium">5 tasks</span> • 
            <span className="ml-1">2 completed</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
              <h3 className="font-medium text-gray-900">Health</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">Health and fitness related tasks</p>
          <div className="text-sm text-gray-500">
            <span className="font-medium">8 tasks</span> • 
            <span className="ml-1">5 completed</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-indigo-500 rounded-full mr-3"></div>
              <h3 className="font-medium text-gray-900">Travel</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">Travel planning and itineraries</p>
          <div className="text-sm text-gray-500">
            <span className="font-medium">3 tasks</span> • 
            <span className="ml-1">1 completed</span>
          </div>
        </div>
      </div>
    </div>
  )
}
