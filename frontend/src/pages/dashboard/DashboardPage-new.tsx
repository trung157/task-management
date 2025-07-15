import React from 'react';
import { 
  CheckSquare, 
  Clock, 
  TrendingUp, 
  Calendar,
  Plus,
  Filter,
  MoreVertical
} from 'lucide-react';

// Mock data - replace with real data from your API
const stats = [
  {
    name: 'Total Tasks',
    value: '24',
    change: '+12%',
    changeType: 'positive',
    icon: CheckSquare,
  },
  {
    name: 'Completed',
    value: '12',
    change: '+8%',
    changeType: 'positive',
    icon: CheckSquare,
  },
  {
    name: 'In Progress',
    value: '8',
    change: '+2%',
    changeType: 'positive',
    icon: Clock,
  },
  {
    name: 'Overdue',
    value: '4',
    change: '-5%',
    changeType: 'negative',
    icon: Calendar,
  },
];

const recentTasks = [
  {
    id: 1,
    title: 'Complete project proposal',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2025-07-20',
  },
  {
    id: 2,
    title: 'Review design mockups',
    status: 'pending',
    priority: 'medium',
    dueDate: '2025-07-18',
  },
  {
    id: 3,
    title: 'Update documentation',
    status: 'completed',
    priority: 'low',
    dueDate: '2025-07-15',
  },
];

export default function DashboardPage() {
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
          <button className="btn btn-primary btn-md">
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
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
          </div>
          
          <div className="card-body">
            <div className="space-y-4">
              {recentTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-4 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {task.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
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
                  </div>
                </div>
              ))}
            </div>
            
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
              <button className="btn btn-outline btn-lg justify-start">
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
    </div>
  );
}
