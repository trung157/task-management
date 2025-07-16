import { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Clock, 
  TrendingUp, 
  Calendar,
  Plus,
  Filter,
  MoreVertical
} from 'lucide-react';
import { taskService } from '../../services/taskService';
import { Task, Category, CreateTaskRequest, UpdateTaskRequest } from '../../types';
import TaskForm from '../../components/tasks/TaskForm';
import { TaskEditModal } from '../../components/tasks/TaskEditModal';
import { TaskDeleteModal } from '../../components/tasks/TaskDeleteModal';

interface DashboardStats {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  
  // Edit/Delete modal state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load tasks and categories
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load tasks - handle different response structure
      const tasksResponse = await taskService.getTasks();
      console.log('Tasks response:', tasksResponse);
      
      // Backend returns { tasks: Task[], total: number, categories: Category[] }
      let tasksData: Task[] = [];
      let categoriesData: Category[] = [];
      
      if (Array.isArray(tasksResponse)) {
        tasksData = tasksResponse;
      } else if (tasksResponse && typeof tasksResponse === 'object') {
        // Check if response has data property (API response wrapper)
        if ('data' in tasksResponse && tasksResponse.data) {
          const data = tasksResponse.data as any;
          tasksData = data.tasks || [];
          categoriesData = data.categories || [];
        } else {
          // Direct response
          tasksData = (tasksResponse as any).tasks || [];
          categoriesData = (tasksResponse as any).categories || [];
        }
      }
      
      setTasks(tasksData);
      setCategories(categoriesData);
      
      // Calculate stats
      const now = new Date();
      const newStats = {
        total: tasksData.length,
        completed: tasksData.filter((t: Task) => t.status === 'completed').length,
        inProgress: tasksData.filter((t: Task) => t.status === 'in_progress').length,
        overdue: tasksData.filter((t: Task) => {
          if (!t.due_date) return false;
          const dueDate = new Date(t.due_date);
          return dueDate < now && t.status !== 'completed';
        }).length
      };
      
      setStats(newStats);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (data: CreateTaskRequest | UpdateTaskRequest) => {
    try {
      setCreatingTask(true);
      // Type guard to ensure we have CreateTaskRequest
      const taskData = data as CreateTaskRequest;
      await taskService.createTask(taskData);
      setShowTaskModal(false);
      // Refresh dashboard data
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to create task:', err);
      throw err; // Re-throw to let TaskForm handle the error
    } finally {
      setCreatingTask(false);
    }
  };

  // Handle edit task
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowEditModal(true);
  };

  // Handle task updated
  const handleTaskUpdated = async (updatedTask: Task) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    );
    await loadDashboardData(); // Refresh stats
  };

  // Handle delete task
  const handleDeleteTask = (task: Task) => {
    setDeletingTask(task);
    setShowDeleteModal(true);
  };

  // Handle task deleted
  const handleTaskDeleted = async (taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    await loadDashboardData(); // Refresh stats
  };

  const getStatCards = () => [
    {
      name: 'Total Tasks',
      value: stats.total.toString(),
      change: '+12%',
      changeType: 'positive' as const,
      icon: CheckSquare,
    },
    {
      name: 'Completed',
      value: stats.completed.toString(),
      change: '+8%',
      changeType: 'positive' as const,
      icon: CheckSquare,
    },
    {
      name: 'In Progress',
      value: stats.inProgress.toString(),
      change: '+2%',
      changeType: 'positive' as const,
      icon: Clock,
    },
    {
      name: 'Overdue',
      value: stats.overdue.toString(),
      change: stats.overdue > 0 ? '+5%' : '-5%',
      changeType: stats.overdue > 0 ? 'negative' as const : 'positive' as const,
      icon: Calendar,
    },
  ];

  // Get recent tasks (last 5, sorted by updated_at)
  const getRecentTasks = () => {
    return [...tasks]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <CheckSquare className="h-12 w-12 mx-auto mb-2" />
          <p className="text-lg font-medium">Failed to load dashboard</p>
          <p className="text-sm">{error}</p>
        </div>
        <button 
          onClick={loadDashboardData}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  const statCards = getStatCards();
  const recentTasks = getRecentTasks();
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-2 text-slate-600">
            Welcome back! Here's what's happening with your tasks today.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-md">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button 
            className="btn btn-primary btn-md"
            onClick={() => setShowTaskModal(true)}
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.name} className="card hover-lift">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        {stat.name}
                      </p>
                      <p className="text-3xl font-bold tracking-tight text-slate-900">
                        {stat.value}
                      </p>
                    </div>
                    
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                      <Icon className="h-6 w-6 text-primary-600" />
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-2">
                    <span className={`inline-flex items-center text-sm font-medium ${
                      stat.changeType === 'positive' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      <TrendingUp className={`mr-1 h-3 w-3 ${
                        stat.changeType === 'negative' ? 'rotate-180' : ''
                      }`} />
                      {stat.change}
                    </span>
                    <span className="text-xs text-slate-500">from last month</span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Tasks */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Recent Tasks
              </h3>
              <button className="btn btn-ghost btn-sm">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>            <div className="card-body">
              {recentTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No tasks yet</p>
                  <button 
                    className="btn btn-primary btn-sm mt-2"
                    onClick={() => setShowTaskModal(true)}
                  >
                    Create your first task
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-4 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : 'No due date'}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`badge ${
                          task.priority === 'high' ? 'priority-high' :
                          task.priority === 'medium' ? 'priority-medium' :
                          'priority-low'
                        }`}>
                          {task.priority}
                        </span>
                        
                        <span className={`badge ${
                          task.status === 'completed' ? 'status-completed' :
                          task.status === 'in_progress' ? 'status-in-progress' :
                          'status-pending'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleEditTask(task)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit task"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => handleDeleteTask(task)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete task"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            
            <div className="mt-6">
              <button className="btn btn-secondary btn-md w-full">
                View All Tasks
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-slate-900">
              Quick Actions
            </h3>
          </div>
          
          <div className="card-body">
            <div className="grid grid-cols-1 gap-4">
              <button 
                className="btn btn-outline btn-lg justify-start"
                onClick={() => setShowTaskModal(true)}
              >
                <Plus className="h-5 w-5" />
                Create New Task
              </button>
              
              <button className="btn btn-outline btn-lg justify-start">
                <Calendar className="h-5 w-5" />
                Schedule Review
              </button>
              
              <button className="btn btn-outline btn-lg justify-start">
                <CheckSquare className="h-5 w-5" />
                Bulk Actions
              </button>
              
              <button className="btn btn-outline btn-lg justify-start">
                <TrendingUp className="h-5 w-5" />
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Create New Task</h2>
              <TaskForm
                categories={categories}
                onSubmit={handleCreateTask}
                onCancel={() => setShowTaskModal(false)}
                loading={creatingTask}
                className="space-y-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Edit Modal */}
      {showEditModal && editingTask && (
        <TaskEditModal
          task={editingTask}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingTask(null);
          }}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* Task Delete Modal */}
      {showDeleteModal && deletingTask && (
        <TaskDeleteModal
          task={deletingTask}
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeletingTask(null);
          }}
          onTaskDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
