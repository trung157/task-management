import { useState, useEffect } from 'react'
import { Category } from '../../types'
import { categoryService } from '../../services/categoryService'
import CategoryForm, { CategoryFormData } from '../../components/categories/CategoryForm'
import { Plus, Edit, Trash2 } from 'lucide-react'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  console.log('🔄 CategoriesPage render - State:', {
    loading,
    error,
    categoriesCount: categories.length,
    showCreateModal,
    editingCategory: editingCategory?.id
  })

  useEffect(() => {
    console.log('🚀 CategoriesPage useEffect - Loading categories...')
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await categoryService.getCategories()
      
      // Handle different response structures
      let categoriesData: Category[] = []
      if (Array.isArray(response)) {
        categoriesData = response
      } else if (response && typeof response === 'object') {
        if ('data' in response && (response as any).data) {
          categoriesData = (response as any).data as Category[]
        }
      }
      
      setCategories(categoriesData)
    } catch (err) {
      console.error('Failed to load categories:', err)
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCategory = async (data: CategoryFormData) => {
    console.log('🏗️ CategoriesPage - handleCreateCategory called with:', data)
    try {
      console.log('🌐 CategoriesPage - Calling categoryService.createCategory...')
      const newCategory = await categoryService.createCategory(data)
      console.log('✅ CategoriesPage - Created category:', newCategory)
      setCategories(prev => [newCategory, ...prev])
      setShowCreateModal(false)
      console.log('🎉 CategoriesPage - Category created successfully, modal closed')
    } catch (err) {
      console.error('❌ CategoriesPage - Failed to create category:', err)
      throw err
    }
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
  }

  const handleUpdateCategory = async (data: CategoryFormData) => {
    if (!editingCategory) return
    
    try {
      const updatedCategory = await categoryService.updateCategory(editingCategory.id, data)
      setCategories(prev => prev.map(cat => 
        cat.id === updatedCategory.id ? updatedCategory : cat
      ))
      setEditingCategory(null)
    } catch (err) {
      console.error('Failed to update category:', err)
      throw err
    }
  }

  const handleDeleteCategory = (category: Category) => {
    setDeletingCategory(category)
  }

  const handleCategoryDeleted = async (categoryId: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId))
    setDeletingCategory(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error loading categories</div>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={loadCategories}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600">Organize your tasks with categories</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          New Category
        </button>
      </div>
      
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No categories found</div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Create your first category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div key={category.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded-full mr-3" 
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleEditCategory(category)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Edit category"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteCategory(category)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Delete category"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {category.description && (
                <p className="text-sm text-gray-600 mb-4">{category.description}</p>
              )}
              
              <div className="text-sm text-gray-500">
                <span className="font-medium">{category.task_count || 0} tasks</span>
                {category.completed_task_count !== undefined && (
                  <>
                    {' • '}
                    <span className="ml-1">{category.completed_task_count} completed</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Create Category Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Category</h2>
              <CategoryForm
                onSubmit={handleCreateCategory}
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Category</h2>
              <CategoryForm
                category={editingCategory}
                onSubmit={handleUpdateCategory}
                onCancel={() => setEditingCategory(null)}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Category Modal - TODO: Implement */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Category</h2>
              <p className="text-gray-600">Are you sure you want to delete "{deletingCategory.name}"?</p>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setDeletingCategory(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await categoryService.deleteCategory(deletingCategory.id)
                      handleCategoryDeleted(deletingCategory.id)
                    } catch (err) {
                      console.error('Failed to delete category:', err)
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
