/**
 * Project Routes Module
 * Project management endpoints with team collaboration
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { jwtAuth } from '../../middleware/jwtAuth';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Project validation schemas
 */
const createProjectValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Project name must be between 1 and 100 characters'),
    
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
    
  body('status')
    .optional()
    .isIn(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
    .withMessage('Invalid project status'),
    
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
    
  body('team_members')
    .optional()
    .isArray()
    .withMessage('Team members must be an array'),
    
  body('team_members.*')
    .optional()
    .isUUID()
    .withMessage('Each team member ID must be a valid UUID')
];

/**
 * @route   GET /projects
 * @desc    Get projects with filtering and pagination
 * @access  Private
 * @version v1, v2
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
  query('search').optional().isString().trim().isLength({ min: 1, max: 100 }),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const {
      page = 1,
      limit = 20,
      status,
      search
    } = req.query;

    const userId = req.user.id;

    logger.info('Fetching projects', {
      userId,
      filters: { status, search },
      pagination: { page, limit }
    });

    // Mock response - replace with actual service call
    const projects = {
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Task Management System',
          description: 'A comprehensive task management application',
          status: 'active',
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-06-30T23:59:59Z',
          created_at: '2023-12-15T10:00:00Z',
          updated_at: '2024-01-15T14:30:00Z',
          owner: {
            id: userId,
            name: 'John Doe',
            email: 'john@example.com'
          },
          team_members: [
            {
              id: '550e8400-e29b-41d4-a716-446655440002',
              name: 'Jane Smith',
              email: 'jane@example.com',
              role: 'developer'
            }
          ],
          stats: {
            total_tasks: 45,
            completed_tasks: 12,
            in_progress_tasks: 8,
            pending_tasks: 25
          }
        }
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    };

    res.json({
      success: true,
      data: projects,
      message: 'Projects retrieved successfully'
    });
  })
);

/**
 * @route   POST /projects
 * @desc    Create a new project
 * @access  Private
 * @version v1, v2
 */
router.post('/',
  createProjectValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const projectData = req.body;
    const userId = req.user.id;

    logger.info('Creating new project', {
      userId,
      projectData: {
        name: projectData.name,
        status: projectData.status
      }
    });

    // Mock project creation - replace with actual service call
    const newProject = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      ...projectData,
      status: projectData.status || 'planning',
      owner_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner: {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
      },
      team_members: projectData.team_members || [],
      stats: {
        total_tasks: 0,
        completed_tasks: 0,
        in_progress_tasks: 0,
        pending_tasks: 0
      }
    };

    res.status(201).json({
      success: true,
      data: newProject,
      message: 'Project created successfully'
    });
  })
);

/**
 * @route   GET /projects/:id
 * @desc    Get a specific project by ID
 * @access  Private
 * @version v1, v2
 */
router.get('/:id',
  param('id').isUUID().withMessage('Project ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user.id;

    logger.info('Fetching project by ID', { projectId: id, userId });

    // Mock project data - replace with actual service call
    const project = {
      id,
      name: 'Task Management System',
      description: 'A comprehensive task management application with advanced features',
      status: 'active',
      start_date: '2024-01-01T00:00:00Z',
      end_date: '2024-06-30T23:59:59Z',
      created_at: '2023-12-15T10:00:00Z',
      updated_at: '2024-01-15T14:30:00Z',
      owner: {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
      },
      team_members: [
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'developer',
          joined_at: '2024-01-01T00:00:00Z'
        }
      ],
      stats: {
        total_tasks: 45,
        completed_tasks: 12,
        in_progress_tasks: 8,
        pending_tasks: 25
      },
      recent_activity: [
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          type: 'task_created',
          description: 'New task "Implement authentication" was created',
          user: {
            id: userId,
            name: 'John Doe'
          },
          timestamp: '2024-01-15T14:30:00Z'
        }
      ]
    };

    res.json({
      success: true,
      data: project,
      message: 'Project retrieved successfully'
    });
  })
);

/**
 * @route   PUT /projects/:id
 * @desc    Update a project
 * @access  Private
 * @version v1, v2
 */
router.put('/:id',
  param('id').isUUID().withMessage('Project ID must be a valid UUID'),
  createProjectValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    logger.info('Updating project', {
      projectId: id,
      userId,
      updateData: Object.keys(updateData)
    });

    // Mock project update - replace with actual service call
    const updatedProject = {
      id,
      ...updateData,
      updated_at: new Date().toISOString(),
      updated_by: {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
      }
    };

    res.json({
      success: true,
      data: updatedProject,
      message: 'Project updated successfully'
    });
  })
);

/**
 * @route   POST /projects/:id/members
 * @desc    Add team member to project
 * @access  Private
 * @version v2
 */
router.post('/:id/members',
  param('id').isUUID().withMessage('Project ID must be a valid UUID'),
  body('user_id').isUUID().withMessage('User ID must be a valid UUID'),
  body('role').optional().isIn(['owner', 'admin', 'member', 'viewer']).withMessage('Invalid role'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { user_id, role = 'member' } = req.body;
    const userId = req.user.id;

    logger.info('Adding team member to project', {
      projectId: id,
      newMemberId: user_id,
      role,
      addedBy: userId
    });

    // Mock member addition - replace with actual service call
    const newMember = {
      id: user_id,
      name: 'New Team Member',
      email: 'member@example.com',
      role,
      joined_at: new Date().toISOString(),
      added_by: {
        id: userId,
        name: 'John Doe'
      }
    };

    res.status(201).json({
      success: true,
      data: newMember,
      message: 'Team member added successfully'
    });
  })
);

/**
 * @route   GET /projects/:id/tasks
 * @desc    Get tasks for a specific project
 * @access  Private
 * @version v2
 */
router.get('/:id/tasks',
  param('id').isUUID().withMessage('Project ID must be a valid UUID'),
  query('status').optional().isIn(['todo', 'in_progress', 'review', 'completed']),
  query('assignee_id').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { status, assignee_id, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    logger.info('Fetching project tasks', {
      projectId: id,
      userId,
      filters: { status, assignee_id },
      pagination: { page, limit }
    });

    // Mock tasks data - replace with actual service call
    const tasks = {
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440005',
          title: 'Implement user authentication',
          description: 'Add JWT-based authentication to the API',
          status: 'in_progress',
          priority: 'high',
          project_id: id,
          assignee: {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Jane Smith'
          },
          created_at: '2024-01-15T10:00:00Z',
          due_date: '2024-01-25T23:59:59Z'
        }
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1,
        totalPages: 1
      }
    };

    res.json({
      success: true,
      data: tasks,
      message: 'Project tasks retrieved successfully'
    });
  })
);

export default router;
