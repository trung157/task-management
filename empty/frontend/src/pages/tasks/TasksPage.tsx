export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">Manage and organize your tasks</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          + New Task
        </button>
      </div>
      
      {/* Task filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-4">
          <select className="border border-gray-300 rounded-md px-3 py-2">
            <option>All Status</option>
            <option>Todo</option>
            <option>In Progress</option>
            <option>Completed</option>
          </select>
          
          <select className="border border-gray-300 rounded-md px-3 py-2">
            <option>All Priority</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
          
          <input
            type="text"
            placeholder="Search tasks..."
            className="border border-gray-300 rounded-md px-3 py-2 flex-1 min-w-0"
          />
        </div>
      </div>
      
      {/* Task list */}
      <div className="bg-white rounded-lg shadow">
        <div className="divide-y divide-gray-200">
          {/* Sample task items */}
          <div className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input type="checkbox" className="mr-4" />
                <div>
                  <h3 className="font-medium text-gray-900">Review project proposal</h3>
                  <p className="text-sm text-gray-600">Update the project proposal with latest requirements</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                      In Progress
                    </span>
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                      High Priority
                    </span>
                    <span className="text-xs text-gray-500">Due: Tomorrow</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="text-blue-600 hover:text-blue-800">Edit</button>
                <button className="text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          </div>
          
          <div className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input type="checkbox" checked className="mr-4" />
                <div>
                  <h3 className="font-medium text-gray-900 line-through">Update website copy</h3>
                  <p className="text-sm text-gray-600">Refresh the homepage content</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Completed
                    </span>
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Low Priority
                    </span>
                    <span className="text-xs text-gray-500">Completed: 2 hours ago</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="text-blue-600 hover:text-blue-800">Edit</button>
                <button className="text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          </div>
          
          <div className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input type="checkbox" className="mr-4" />
                <div>
                  <h3 className="font-medium text-gray-900">Prepare quarterly report</h3>
                  <p className="text-sm text-gray-600">Compile Q4 performance metrics</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                      Todo
                    </span>
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                      Urgent
                    </span>
                    <span className="text-xs text-red-500">Overdue: 1 day</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="text-blue-600 hover:text-blue-800">Edit</button>
                <button className="text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
