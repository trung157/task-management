import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  CheckSquare,
  Clock,
  AlertCircle,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react';
import { taskService } from '../../services/taskService';
import { categoryService } from '../../services/categoryService';
import { Task, Category, CreateTaskRequest, UpdateTaskRequest, TaskFilters, TaskStatus, TaskPriority } from '../../types';
import TaskForm from '../../components/tasks/TaskForm';
import TaskCard from '../../components/tasks/TaskCard';
import { TaskEditModal } from '../../components/tasks/TaskEditModal';
import { TaskDeleteModal } from '../../components/tasks/TaskDeleteModal';

export default function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<TaskFilters>({});

  useEffect(() => {
    loadTasks();
  }, [filters]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await taskService.getTasks(filters);
      console.log('Tasks response:', response);
      
      let tasksData: Task[] = [];
      let categoriesData: Category[] = [];
      
      if (Array.isArray(response)) {
        tasksData = response;
      } else if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          const data = response.data as any;
          tasksData = data.tasks || [];
          categoriesData = data.categories || [];
        } else {
          tasksData = (response as any).tasks || [];
          categoriesData = (response as any).categories || [];
        }
      }
      
      setTasks(tasksData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (data: CreateTaskRequest | UpdateTaskRequest) => {
    try {
      setCreatingTask(true);
      if (editingTask) {
        await taskService.updateTask(editingTask.id, data as UpdateTaskRequest);
      } else {
        await taskService.createTask(data as CreateTaskRequest);
      }
      setShowTaskModal(false);
      setEditingTask(null);
      await loadTasks();
    } catch (err) {
      console.error('Failed to save task:', err);
      throw err;
    } finally {
      setCreatingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await taskService.deleteTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      alert('Failed to delete task');
    }
  };

  // Edit and Delete handlers for TaskCard
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
  };

  const handleDeleteTaskCard = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setDeletingTask(task);
    }
  };

  const handleTaskUpdated = async (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
    setEditingTask(null);
  };

  const handleTaskDeleted = async (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    setDeletingTask(null);
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await taskService.toggleTaskStatus(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
      alert('Failed to update task status');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (searchTerm) {
      return task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
             task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckSquare className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-slate-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Tasks
            </h1>
            <p className="mt-2 text-slate-600">
              Manage and organize all your tasks
            </p>
          </div>
          
          <div className="flex gap-3">
            <button className="btn btn-secondary btn-md">
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button 
              className="btn btn-primary btn-md"
              onClick={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="card">
          <div className="card-body">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select 
                  className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    status: e.target.value ? [e.target.value as TaskStatus] : undefined 
                  }))}
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                
                <select 
                  className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    priority: e.target.value ? [e.target.value as TaskPriority] : undefined 
                  }))}
                >
                  <option value="">All Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p className="text-lg font-medium">Failed to load tasks</p>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              onClick={loadTasks}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-lg mb-2">No tasks found</p>
            <p className="text-slate-500 text-sm mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first task'}
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Create Task
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div key={task.id} className="card hover-lift">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className="mt-1"
                      >
                        {getStatusIcon(task.status)}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-lg font-medium ${
                          task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-900'
                        }`}>
                          {task.title}
                        </h3>
                        
                        {task.description && (
                          <p className="text-slate-600 text-sm mt-1">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </div>
                          )}
                          
                          {task.category && (
                            <div className="flex items-center gap-1">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: task.category.color }}
                              />
                              {task.category.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      
                      <div className="relative">
                        <button className="btn btn-ghost btn-sm">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {/* Dropdown menu (would need to implement dropdown logic) */}
                        <div className="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setShowTaskModal(true);
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {filteredTasks.length > 0 && (
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>
                  Showing {filteredTasks.length} of {tasks.length} tasks
                </span>
                <div className="flex gap-4">
                  <span>Completed: {filteredTasks.filter(t => t.status === 'completed').length}</span>
                  <span>In Progress: {filteredTasks.filter(t => t.status === 'in_progress').length}</span>
                  <span>Pending: {filteredTasks.filter(t => t.status === 'pending').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                {editingTask ? 'Edit Task' : 'Create New Task'}
              </h2>
              <TaskForm
                task={editingTask || undefined}
                categories={categories}
                onSubmit={handleCreateTask}
                onCancel={() => {
                  setShowTaskModal(false);
                  setEditingTask(null);
                }}
                loading={creatingTask}
                className="space-y-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* Delete Task Modal */}
      {deletingTask && (
        <TaskDeleteModal
          task={deletingTask}
          isOpen={!!deletingTask}
          onClose={() => setDeletingTask(null)}
          onTaskDeleted={handleTaskDeleted}
        />
      )}
    </>
  );
}
