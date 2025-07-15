import apiClient from './apiClient'
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../types'

export interface CategoryStats {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
}

export class CategoryApi {
  // CRUD operations
  static async getCategories(): Promise<Category[]> {
    const response = await apiClient.get<Category[]>('/categories')
    return response.data
  }

  static async getCategory(id: string): Promise<Category> {
    const response = await apiClient.get<Category>(`/categories/${id}`)
    return response.data
  }

  static async createCategory(categoryData: CreateCategoryRequest): Promise<Category> {
    const response = await apiClient.post<Category>('/categories', categoryData)
    return response.data
  }

  static async updateCategory(id: string, categoryData: UpdateCategoryRequest): Promise<Category> {
    const response = await apiClient.put<Category>(`/categories/${id}`, categoryData)
    return response.data
  }

  static async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}`)
  }

  // Category statistics
  static async getCategoryStats(id: string): Promise<CategoryStats> {
    const response = await apiClient.get<CategoryStats>(`/categories/${id}/stats`)
    return response.data
  }

  static async getAllCategoriesStats(): Promise<Array<Category & { stats: CategoryStats }>> {
    const response = await apiClient.get<Array<Category & { stats: CategoryStats }>>('/categories/stats')
    return response.data
  }

  // Category ordering
  static async reorderCategories(categoryIds: string[]): Promise<void> {
    await apiClient.patch('/categories/reorder', { categoryIds })
  }

  // Bulk operations
  static async bulkDeleteCategories(categoryIds: string[]): Promise<{ deleted: number; failed: string[] }> {
    const response = await apiClient.delete<{ deleted: number; failed: string[] }>('/categories/bulk', {
      data: { categoryIds }
    })
    return response.data
  }

  // Category archive/unarchive
  static async archiveCategory(id: string): Promise<Category> {
    const response = await apiClient.patch<Category>(`/categories/${id}/archive`)
    return response.data
  }

  static async unarchiveCategory(id: string): Promise<Category> {
    const response = await apiClient.patch<Category>(`/categories/${id}/unarchive`)
    return response.data
  }
}
