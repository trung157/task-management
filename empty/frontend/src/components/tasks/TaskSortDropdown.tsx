import { useState, useRef, useEffect } from 'react'
import { SortOptions } from '../../types'

interface TaskSortDropdownProps {
  currentSort: SortOptions
  onSortChange: (sort: SortOptions) => void
  className?: string
}

const sortOptions = [
  { field: 'created_at' as const, label: 'Date Created', order: 'desc' as const },
  { field: 'created_at' as const, label: 'Date Created (Oldest)', order: 'asc' as const },
  { field: 'updated_at' as const, label: 'Last Updated', order: 'desc' as const },
  { field: 'due_date' as const, label: 'Due Date', order: 'asc' as const },
  { field: 'due_date' as const, label: 'Due Date (Latest)', order: 'desc' as const },
  { field: 'priority' as const, label: 'Priority (High to Low)', order: 'desc' as const },
  { field: 'priority' as const, label: 'Priority (Low to High)', order: 'asc' as const },
  { field: 'status' as const, label: 'Status', order: 'asc' as const },
  { field: 'title' as const, label: 'Title (A-Z)', order: 'asc' as const },
  { field: 'title' as const, label: 'Title (Z-A)', order: 'desc' as const },
]

export default function TaskSortDropdown({
  currentSort,
  onSortChange,
  className = ''
}: TaskSortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getCurrentSortLabel = () => {
    const option = sortOptions.find(
      opt => opt.field === currentSort.field && opt.order === currentSort.order
    )
    return option?.label || 'Date Created'
  }

  const handleSortSelect = (option: typeof sortOptions[0]) => {
    onSortChange({
      field: option.field,
      order: option.order
    })
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
        </svg>
        Sort: {getCurrentSortLabel()}
        <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu">
            {sortOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSortSelect(option)}
                className={`block px-4 py-2 text-sm text-left w-full hover:bg-gray-100 ${
                  option.field === currentSort.field && option.order === currentSort.order
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700'
                }`}
                role="menuitem"
              >
                <div className="flex items-center justify-between">
                  <span>{option.label}</span>
                  {option.field === currentSort.field && option.order === currentSort.order && (
                    <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
