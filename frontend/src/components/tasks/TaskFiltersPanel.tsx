import { useState } from 'react'
import { TaskFilters, TaskStatus, TaskPriority, Category } from '../../types'

interface TaskFiltersPanelProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  categories: Category[]
  availableTags: string[]
  className?: string
}

export default function TaskFiltersPanel({
  filters,
  onFiltersChange,
  categories,
  availableTags,
  className = ''
}: TaskFiltersPanelProps) {
  const [tempFilters, setTempFilters] = useState<TaskFilters>(filters)

  const handleFilterChange = (key: keyof TaskFilters, value: any) => {
    const newFilters = { ...tempFilters, [key]: value }
    setTempFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleArrayFilterChange = (key: keyof TaskFilters, value: string, checked: boolean) => {
    const currentArray = (tempFilters[key] as string[]) || []
    let newArray: string[]
    
    if (checked) {
      newArray = [...currentArray, value]
    } else {
      newArray = currentArray.filter(item => item !== value)
    }
    
    handleFilterChange(key, newArray.length > 0 ? newArray : undefined)
  }

  const clearFilters = () => {
    setTempFilters({})
    onFiltersChange({})
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="space-y-2">
            {Object.values(TaskStatus).map((status) => (
              <label key={status} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.status || []).includes(status)}
                  onChange={(e) => handleArrayFilterChange('status', status, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 capitalize">
                  {status.replace('_', ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority
          </label>
          <div className="space-y-2">
            {Object.values(TaskPriority).map((priority) => (
              <label key={priority} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.priority || []).includes(priority)}
                  onChange={(e) => handleArrayFilterChange('priority', priority, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 capitalize flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    priority === TaskPriority.HIGH ? 'bg-red-500' :
                    priority === TaskPriority.MEDIUM ? 'bg-yellow-500' :
                    priority === TaskPriority.LOW ? 'bg-green-500' :
                    'bg-gray-300'
                  }`} />
                  {priority}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categories
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {categories.map((category) => (
              <label key={category.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.category_id || []).includes(category.id)}
                  onChange={(e) => handleArrayFilterChange('category_id', category.id, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Tags Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {availableTags.slice(0, 10).map((tag) => (
              <label key={tag} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.tags || []).includes(tag)}
                  onChange={(e) => handleArrayFilterChange('tags', tag, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  #{tag}
                </span>
              </label>
            ))}
            {availableTags.length > 10 && (
              <p className="text-xs text-gray-500 mt-2">
                +{availableTags.length - 10} more tags available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Due Date Range</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              From
            </label>
            <input
              type="date"
              value={filters.due_date_from || ''}
              onChange={(e) => handleFilterChange('due_date_from', e.target.value || undefined)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              To
            </label>
            <input
              type="date"
              value={filters.due_date_to || ''}
              onChange={(e) => handleFilterChange('due_date_to', e.target.value || undefined)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Active Filters</h4>
          <div className="flex flex-wrap gap-2">
            {filters.status?.map((status) => (
              <span
                key={`status-${status}`}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
              >
                Status: {status.replace('_', ' ')}
                <button
                  onClick={() => handleArrayFilterChange('status', status, false)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
            {filters.priority?.map((priority) => (
              <span
                key={`priority-${priority}`}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800"
              >
                Priority: {priority}
                <button
                  onClick={() => handleArrayFilterChange('priority', priority, false)}
                  className="ml-1 text-yellow-600 hover:text-yellow-800"
                >
                  ×
                </button>
              </span>
            ))}
            {filters.category_id?.map((categoryId) => {
              const category = categories.find(c => c.id === categoryId)
              return category ? (
                <span
                  key={`category-${categoryId}`}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800"
                >
                  Category: {category.name}
                  <button
                    onClick={() => handleArrayFilterChange('category_id', categoryId, false)}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    ×
                  </button>
                </span>
              ) : null
            })}
            {filters.tags?.map((tag) => (
              <span
                key={`tag-${tag}`}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800"
              >
                #{tag}
                <button
                  onClick={() => handleArrayFilterChange('tags', tag, false)}
                  className="ml-1 text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </span>
            ))}
            {filters.due_date_from && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                From: {filters.due_date_from}
                <button
                  onClick={() => handleFilterChange('due_date_from', undefined)}
                  className="ml-1 text-gray-600 hover:text-gray-800"
                >
                  ×
                </button>
              </span>
            )}
            {filters.due_date_to && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                To: {filters.due_date_to}
                <button
                  onClick={() => handleFilterChange('due_date_to', undefined)}
                  className="ml-1 text-gray-600 hover:text-gray-800"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
