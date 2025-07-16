import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Folder, 
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { categoryService, CreateCategoryRequest, UpdateCategoryRequest } from '../../services/categoryService';
import { Category } from '../../types';

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export default function CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'folder'
  });

  const iconOptions = [
    { value: 'folder', label: '📁 Folder' },
    { value: 'work', label: '💼 Work' },
    { value: 'home', label: '🏠 Home' },
    { value: 'health', label: '🏥 Health' },
    { value: 'education', label: '📚 Education' },
    { value: 'shopping', label: '🛒 Shopping' },
    { value: 'finance', label: '💰 Finance' },
    { value: 'travel', label: '✈️ Travel' },
  ];

  const colorOptions = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#F43F5E'
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      if (editingCategory) {
        const updateData: UpdateCategoryRequest = {
          name: formData.name,
          description: formData.description,
          color: formData.color,
          icon: formData.icon
        };
        await categoryService.updateCategory(editingCategory.id, updateData);
      } else {
        const createData: CreateCategoryRequest = {
          name: formData.name,
          description: formData.description,
          color: formData.color,
          icon: formData.icon
        };
        await categoryService.createCategory(createData);
      }
      
      setShowModal(false);
      setEditingCategory(null);
      resetForm();
      await loadCategories();
    } catch (err) {
      console.error('Failed to save category:', err);
      alert('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      icon: category.icon
    });
    setShowModal(true);
  };

  const handleDelete = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    
    if (category?.is_default) {
      alert('Cannot delete default category');
      return;
    }
    
    if (category && category.task_count > 0) {
      alert('Cannot delete category with existing tasks');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await categoryService.deleteCategory(categoryId);
      await loadCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      icon: 'folder'
    });
  };

  const handleNewCategory = () => {
    setEditingCategory(null);
    resetForm();
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-slate-600">Loading categories...</p>
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
              Categories
            </h1>
            <p className="mt-2 text-slate-600">
              Organize your tasks with custom categories
            </p>
          </div>
          
          <button 
            className="btn btn-primary btn-md"
            onClick={handleNewCategory}
          >
            <Plus className="h-4 w-4" />
            New Category
          </button>
        </div>

        {/* Categories Grid */}
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p className="text-lg font-medium">Failed to load categories</p>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              onClick={loadCategories}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-lg mb-2">No categories found</p>
            <p className="text-slate-500 text-sm mb-4">
              Create your first category to organize your tasks
            </p>
            <button 
              className="btn btn-primary"
              onClick={handleNewCategory}
            >
              <Plus className="h-4 w-4" />
              Create Category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((category) => (
              <div key={category.id} className="card hover-lift">
                <div className="card-body">
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl"
                      style={{ backgroundColor: category.color }}
                    >
                      {iconOptions.find(icon => icon.value === category.icon)?.label?.split(' ')[0] || '📁'}
                    </div>
                    
                    <div className="relative">
                      <button className="btn btn-ghost btn-sm">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {category.name}
                    {category.is_default && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Default
                      </span>
                    )}
                  </h3>
                  
                  {category.description && (
                    <p className="text-slate-600 text-sm mb-4">
                      {category.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{category.task_count} tasks</span>
                    <span>{category.completed_task_count} completed</span>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleEdit(category)}
                      className="btn btn-secondary btn-sm flex-1"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </button>
                    
                    {!category.is_default && (
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="btn btn-danger btn-sm"
                        disabled={category.task_count > 0}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Icon
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, icon: icon.value }))}
                        className={`p-2 rounded-lg border text-center hover:bg-slate-50 ${
                          formData.icon === icon.value 
                            ? 'border-primary-500 bg-primary-50' 
                            : 'border-slate-300'
                        }`}
                      >
                        {icon.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Color
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-lg border-2 ${
                          formData.color === color 
                            ? 'border-slate-900' 
                            : 'border-slate-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingCategory(null);
                      resetForm();
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={saving || !formData.name.trim()}
                    className="btn btn-primary flex-1"
                  >
                    {saving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
