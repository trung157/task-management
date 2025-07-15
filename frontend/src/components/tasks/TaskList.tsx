import { useState, useMemo, useCallback } from 'react'
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskFilters, 
  SortOptions,
  Category 
} from '../../types'
import TaskCard from './TaskCard'
import TaskFiltersPanel from './TaskFiltersPanel'
import TaskSortDropdown from './TaskSortDropdown'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'

interface TaskListProps {
  tasks: Task[]
  categories: Category[]
  loading?: boolean
  error?: string | null
  onTaskUpdate?: (task: Task) => void
  onTaskDelete?: (taskId: string) => void
  onTaskClick?: (task: Task) => void
  enableFiltering?: boolean
  enableSorting?: boolean
  enableSearch?: boolean
  compact?: boolean
  showPagination?: boolean
  itemsPerPage?: number
}

export default function TaskList({
  tasks,
  categories,
  loading = false,
  error = null,
  onTaskUpdate,
  onTaskDelete,
  onTaskClick,
  enableFiltering = true,
  enableSorting = true,
  enableSearch = true,
  compact = false,
  showPagination = true,
  itemsPerPage = 10
}: TaskListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<TaskFilters>({})
  const [sort, setSort] = useState<SortOptions>({
    field: 'created_at',
    order: 'desc'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  // Memoized filtered and sorted tasks
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      result = result.filter(task => filters.status!.includes(task.status))
    }

    if (filters.priority && filters.priority.length > 0) {
      result = result.filter(task => filters.priority!.includes(task.priority))
    }

    if (filters.category_id && filters.category_id.length > 0) {
      result = result.filter(task => 
        task.category && filters.category_id!.includes(task.category.id)
      )
    }

    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(task =>
        filters.tags!.some(filterTag => task.tags.includes(filterTag))
      )
    }

    if (filters.due_date_from) {
      result = result.filter(task =>
        task.due_date && new Date(task.due_date) >= new Date(filters.due_date_from!)
      )
    }

    if (filters.due_date_to) {
      result = result.filter(task =>
        task.due_date && new Date(task.due_date) <= new Date(filters.due_date_to!)
      )
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sort.field) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'created_at':
          aValue = new Date(a.created_at)
          bValue = new Date(b.created_at)
          break
        case 'updated_at':
          aValue = new Date(a.updated_at)
          bValue = new Date(b.updated_at)
          break
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date) : new Date(0)
          bValue = b.due_date ? new Date(b.due_date) : new Date(0)
          break
        case 'priority':
          const priorityOrder = { 
            [TaskPriority.HIGH]: 4, 
            [TaskPriority.MEDIUM]: 3, 
            [TaskPriority.LOW]: 2, 
            [TaskPriority.NONE]: 1 
          }
          aValue = priorityOrder[a.priority]
          bValue = priorityOrder[b.priority]
          break
        case 'status':
          const statusOrder = { 
            [TaskStatus.PENDING]: 1, 
            [TaskStatus.IN_PROGRESS]: 2, 
            [TaskStatus.COMPLETED]: 3, 
            [TaskStatus.ARCHIVED]: 4 
          }
          aValue = statusOrder[a.status]
          bValue = statusOrder[b.status]
          break
        default:
          return 0
      }

      if (aValue < bValue) {
        return sort.order === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sort.order === 'asc' ? 1 : -1
      }
      return 0
    })

    return result
  }, [tasks, searchQuery, filters, sort])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTasks.length / itemsPerPage)
  const paginatedTasks = useMemo(() => {
    if (!showPagination) return filteredAndSortedTasks
    
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredAndSortedTasks.slice(start, end)
  }, [filteredAndSortedTasks, currentPage, itemsPerPage, showPagination])

  // Reset page when filters change
  const handleFiltersChange = useCallback((newFilters: TaskFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }, [])

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, [])

  const handleSortChange = useCallback((newSort: SortOptions) => {
    setSort(newSort)
    setCurrentPage(1)
  }, [])

  // Get unique tags from all tasks for filtering
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    tasks.forEach(task => {
      task.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [tasks])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading tasks</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with search and controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search */}
          {enableSearch && (
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Results count */}
            <span className="text-sm text-gray-500">
              {filteredAndSortedTasks.length} of {tasks.length} tasks
            </span>

            {/* Sort dropdown */}
            {enableSorting && (
              <TaskSortDropdown
                currentSort={sort}
                onSortChange={handleSortChange}
              />
            )}

            {/* Filter toggle */}
            {enableFiltering && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : ''
                }`}
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {Object.keys(filters).length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {Object.keys(filters).length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Filters panel */}
        {enableFiltering && showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <TaskFiltersPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              categories={categories}
              availableTags={availableTags}
            />
          </div>
        )}
      </div>

      {/* Task list */}
      {paginatedTasks.length === 0 ? (
        <EmptyState
          title={searchQuery || Object.keys(filters).length > 0 ? "No tasks found" : "No tasks yet"}
          description={
            searchQuery || Object.keys(filters).length > 0
              ? "Try adjusting your search or filters to find what you're looking for."
              : "Get started by creating your first task."
          }
          action={
            searchQuery || Object.keys(filters).length > 0 ? {
              label: "Clear filters",
              onClick: () => {
                setSearchQuery('')
                setFilters({})
                setCurrentPage(1)
              }
            } : undefined
          }
        />
      ) : (
        <div className={`grid gap-4 ${
          compact 
            ? 'grid-cols-1' 
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}>
          {paginatedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onUpdate={onTaskUpdate}
              onDelete={onTaskDelete}
              compact={compact}
              showCategory={true}
              showDueDate={true}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {((currentPage - 1) * itemsPerPage) + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedTasks.length)}
                </span>{' '}
                of{' '}
                <span className="font-medium">{filteredAndSortedTasks.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1
                  const isActive = pageNum === currentPage
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        isActive
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
