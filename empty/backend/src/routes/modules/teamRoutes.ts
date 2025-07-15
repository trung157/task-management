/**
 * Team Management Routes Module
 * Comprehensive team and collaboration endpoints
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { jwtAuth, requireRole } from '../../middleware/jwtAuth';
import { defaultLimiter } from '../../middleware/rateLimiting';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Team validation schemas
 */
const createTeamValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Team name must be between 1 and 100 characters'),
    
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
    
  body('department')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must not exceed 100 characters'),
    
  body('team_type')
    .optional()
    .isIn(['project', 'department', 'cross_functional', 'temporary'])
    .withMessage('Team type must be valid'),
    
  body('privacy')
    .optional()
    .isIn(['public', 'private', 'secret'])
    .withMessage('Privacy setting must be valid'),
    
  body('member_ids')
    .optional()
    .isArray()
    .withMessage('Member IDs must be an array'),
    
  body('member_ids.*')
    .optional()
    .isUUID()
    .withMessage('Each member ID must be a valid UUID')
];

const updateTeamValidation = [
  param('teamId')
    .isUUID()
    .withMessage('Team ID must be a valid UUID'),
  ...createTeamValidation
];

const teamQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('search')
    .optional()
    .isString()
    .trim()
    .withMessage('Search term must be a string'),
    
  query('department')
    .optional()
    .isString()
    .trim()
    .withMessage('Department must be a string'),
    
  query('team_type')
    .optional()
    .isIn(['project', 'department', 'cross_functional', 'temporary'])
    .withMessage('Team type must be valid'),
    
  query('privacy')
    .optional()
    .isIn(['public', 'private', 'secret'])
    .withMessage('Privacy setting must be valid'),
    
  query('member_id')
    .optional()
    .isUUID()
    .withMessage('Member ID must be a valid UUID')
];

const memberManagementValidation = [
  body('member_ids')
    .isArray({ min: 1 })
    .withMessage('Member IDs must be a non-empty array'),
    
  body('member_ids.*')
    .isUUID()
    .withMessage('Each member ID must be a valid UUID'),
    
  body('role')
    .optional()
    .isIn(['leader', 'member', 'viewer'])
    .withMessage('Role must be valid')
];

// =====================================================
// TEAM MANAGEMENT ROUTES
// =====================================================

/**
 * @route   GET /teams
 * @desc    Get list of teams user has access to
 * @access  Private
 */
router.get('/',
  jwtAuth,
  teamQueryValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Team list request', { 
      userId: req.authUser.id,
      query: req.query 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        teams: [
          {
            id: 'team-1',
            name: 'Frontend Team',
            description: 'Responsible for UI/UX development',
            department: 'Engineering',
            team_type: 'department',
            privacy: 'public',
            member_count: 5,
            project_count: 3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_role: 'member'
          },
          {
            id: 'team-2',
            name: 'Mobile App Project',
            description: 'Cross-functional team for mobile development',
            department: 'Engineering',
            team_type: 'project',
            privacy: 'private',
            member_count: 8,
            project_count: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_role: 'leader'
          }
        ],
        pagination: {
          total: 2,
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          pages: 1
        }
      }
    });
  })
);

/**
 * @route   POST /teams
 * @desc    Create a new team
 * @access  Private (Manager+)
 */
router.post('/',
  jwtAuth,
  requireRole('manager', 'admin'),
  createTeamValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Team creation attempt', { 
      userId: req.authUser.id,
      teamName: req.body.name 
    });
    
    // Placeholder for actual controller implementation
    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: {
        team: {
          id: 'new-team-id',
          ...req.body,
          created_by: req.authUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          member_count: 1,
          project_count: 0
        }
      }
    });
  })
);

/**
 * @route   GET /teams/:teamId
 * @desc    Get team details
 * @access  Private
 */
router.get('/:teamId',
  jwtAuth,
  param('teamId').isUUID().withMessage('Team ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Team details request', { 
      userId: req.authUser.id,
      teamId: req.params.teamId 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        team: {
          id: req.params.teamId,
          name: 'Frontend Team',
          description: 'Responsible for UI/UX development',
          department: 'Engineering',
          team_type: 'department',
          privacy: 'public',
          created_by: 'creator-user-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          members: [
            {
              id: 'member-1',
              email: 'john@example.com',
              first_name: 'John',
              last_name: 'Doe',
              role: 'leader',
              joined_at: new Date().toISOString()
            },
            {
              id: 'member-2',
              email: 'jane@example.com',
              first_name: 'Jane',
              last_name: 'Smith',
              role: 'member',
              joined_at: new Date().toISOString()
            }
          ],
          projects: [
            {
              id: 'project-1',
              name: 'Website Redesign',
              status: 'in_progress',
              created_at: new Date().toISOString()
            }
          ],
          user_role: 'member',
          user_permissions: ['read', 'contribute']
        }
      }
    });
  })
);

/**
 * @route   PUT /teams/:teamId
 * @desc    Update team information
 * @access  Private (Team leader or admin)
 */
router.put('/:teamId',
  jwtAuth,
  updateTeamValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Team update attempt', { 
      userId: req.authUser.id,
      teamId: req.params.teamId 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Team updated successfully',
      data: {
        team: {
          id: req.params.teamId,
          ...req.body,
          updated_at: new Date().toISOString()
        }
      }
    });
  })
);

/**
 * @route   DELETE /teams/:teamId
 * @desc    Delete team
 * @access  Private (Team leader or admin)
 */
router.delete('/:teamId',
  jwtAuth,
  param('teamId').isUUID().withMessage('Team ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Team deletion attempt', { 
      userId: req.authUser.id,
      teamId: req.params.teamId 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  })
);

/**
 * @route   POST /teams/:teamId/members
 * @desc    Add members to team
 * @access  Private (Team leader or admin)
 */
router.post('/:teamId/members',
  jwtAuth,
  param('teamId').isUUID().withMessage('Team ID must be a valid UUID'),
  memberManagementValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Add team members attempt', { 
      userId: req.authUser.id,
      teamId: req.params.teamId,
      memberIds: req.body.member_ids 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Members added successfully',
      data: {
        added_members: req.body.member_ids.map((id: string) => ({
          id,
          role: req.body.role || 'member',
          joined_at: new Date().toISOString()
        }))
      }
    });
  })
);

/**
 * @route   DELETE /teams/:teamId/members
 * @desc    Remove members from team
 * @access  Private (Team leader or admin)
 */
router.delete('/:teamId/members',
  jwtAuth,
  param('teamId').isUUID().withMessage('Team ID must be a valid UUID'),
  body('member_ids')
    .isArray({ min: 1 })
    .withMessage('Member IDs must be a non-empty array'),
  body('member_ids.*')
    .isUUID()
    .withMessage('Each member ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Remove team members attempt', { 
      userId: req.authUser.id,
      teamId: req.params.teamId,
      memberIds: req.body.member_ids 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Members removed successfully',
      data: {
        removed_members: req.body.member_ids
      }
    });
  })
);

/**
 * @route   PUT /teams/:teamId/members/:memberId/role
 * @desc    Update member role in team
 * @access  Private (Team leader or admin)
 */
router.put('/:teamId/members/:memberId/role',
  jwtAuth,
  param('teamId').isUUID().withMessage('Team ID must be a valid UUID'),
  param('memberId').isUUID().withMessage('Member ID must be a valid UUID'),
  body('role')
    .isIn(['leader', 'member', 'viewer'])
    .withMessage('Role must be valid'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Update member role attempt', { 
      userId: req.authUser.id,
      teamId: req.params.teamId,
      memberId: req.params.memberId,
      newRole: req.body.role 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: {
        member: {
          id: req.params.memberId,
          role: req.body.role,
          updated_at: new Date().toISOString()
        }
      }
    });
  })
);

/**
 * @route   GET /teams/:teamId/projects
 * @desc    Get team's projects
 * @access  Private
 */
router.get('/:teamId/projects',
  jwtAuth,
  param('teamId').isUUID().withMessage('Team ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    logger.info('Team projects request', { 
      userId: req.authUser.id,
      teamId: req.params.teamId 
    });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        projects: [
          {
            id: 'project-1',
            name: 'Website Redesign',
            description: 'Complete website overhaul',
            status: 'in_progress',
            progress: 65,
            start_date: new Date().toISOString(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            team_role: 'primary',
            task_count: 25,
            completed_tasks: 16
          }
        ]
      }
    });
  })
);

/**
 * @route   GET /teams/analytics/overview
 * @desc    Get team analytics overview
 * @access  Private (Manager+)
 */
router.get('/analytics/overview',
  jwtAuth,
  requireRole('manager', 'admin'),
  asyncHandler(async (req: any, res: any) => {
    logger.info('Team analytics request', { userId: req.authUser.id });
    
    // Placeholder for actual controller implementation
    res.json({
      success: true,
      data: {
        total_teams: 15,
        active_teams: 12,
        departments: {
          'Engineering': 6,
          'Design': 3,
          'Marketing': 4,
          'Sales': 2
        },
        team_types: {
          'department': 8,
          'project': 5,
          'cross_functional': 2,
          'temporary': 0
        },
        average_team_size: 6.2,
        most_active_teams: [
          {
            id: 'team-1',
            name: 'Frontend Team',
            activity_score: 95,
            member_count: 5
          }
        ],
        collaboration_stats: {
          cross_team_projects: 3,
          shared_resources: 12,
          communication_frequency: 'high'
        }
      }
    });
  })
);

export default router;
