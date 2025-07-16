import { useState } from 'react'
import { Category } from '../../types'

interface CategoryFormProps {
  category?: Category | null
  onSubmit: (data: CategoryFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export interface CategoryFormData {
  name: string
  description?: string
  color?: string
  icon?: string
  sort_order?: number
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
]

const PRESET_ICONS = [
  'folder',
  'work',
  'person',
  'shopping',
  'health',
  'travel',
  'learning',
  'finance',
  'home',
  'hobby'
]

export default function CategoryForm({ category, onSubmit, onCancel, loading = false }: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || '#3B82F6',
    icon: category?.icon || 'folder',
    sort_order: category?.sort_order || 0
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('📝 CategoryForm - handleSubmit called with:', formData)
    
    // Validation
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required'
    }
    
    if (Object.keys(newErrors).length > 0) {
      console.log('❌ CategoryForm - Validation errors:', newErrors)
      setErrors(newErrors)
      return
    }
    
    try {
      console.log('🚀 CategoryForm - Calling onSubmit with data:', formData)
      setErrors({})
      await onSubmit(formData)
      console.log('✅ CategoryForm - onSubmit completed successfully')
    } catch (err) {
      console.error('❌ CategoryForm - Form submission error:', err)
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save category' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name *
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter category name"
          disabled={loading}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter category description"
          rows={3}
          disabled={loading}
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, color }))}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.color === color 
                  ? 'border-gray-800 scale-110' 
                  : 'border-gray-300 hover:border-gray-500'
              }`}
              style={{ backgroundColor: color }}
              disabled={loading}
              title={color}
            />
          ))}
          <input
            type="color"
            value={formData.color}
            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
            disabled={loading}
            title="Custom color"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">Selected: {formData.color}</p>
      </div>

      {/* Icon */}
      <div>
        <label htmlFor="icon" className="block text-sm font-medium text-gray-700 mb-1">
          Icon
        </label>
        <select
          id="icon"
          value={formData.icon}
          onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          {PRESET_ICONS.map(icon => (
            <option key={icon} value={icon}>
              {icon.charAt(0).toUpperCase() + icon.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="text-red-600 text-sm">{errors.submit}</div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          disabled={loading}
        >
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          {category ? 'Update' : 'Create'} Category
        </button>
      </div>
    </form>
  )
}
