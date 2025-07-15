import { Router } from 'express';
import { TagController } from '../../controllers/tagController';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  validateCreateTag,
  validateUpdateTag,
  validateTagId,
  validateTagSearch,
  validateBulkTagOperation,
  validateMergeTags,
  validateTagStats,
  validateSuggestedTags,
} from '../../validators/tagValidator';

const router = Router();
const tagController = new TagController();

// Tag CRUD routes
router.get('/', validateTagSearch, validateRequest, asyncHandler(tagController.getTags));
router.post('/', validateCreateTag, validateRequest, asyncHandler(tagController.createTag));
router.get('/stats', validateTagStats, validateRequest, asyncHandler(tagController.getTagStats));
router.get('/suggested', validateSuggestedTags, validateRequest, asyncHandler(tagController.getSuggestedTags));
router.get('/:id', validateTagId, validateRequest, asyncHandler(tagController.getTag));
router.put('/:id', validateUpdateTag, validateRequest, asyncHandler(tagController.updateTag));
router.delete('/:id', validateTagId, validateRequest, asyncHandler(tagController.deleteTag));

// Bulk operations
router.delete('/bulk', validateBulkTagOperation, validateRequest, asyncHandler(tagController.bulkDelete));
router.post('/merge', validateMergeTags, validateRequest, asyncHandler(tagController.mergeTags));

export default router;
