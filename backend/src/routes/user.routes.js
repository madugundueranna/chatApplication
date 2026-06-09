import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { updateMeValidator, searchValidator, userIdParam } from '../common/Validators.js';
import { getMe, updateMe, searchUsers, getUserById } from '../controllers/user.controller.js';

const router = Router();
router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', updateMeValidator, validate, updateMe);
router.get('/search', searchValidator, validate, searchUsers);
router.get('/:userId', userIdParam, validate, getUserById);

export default router;
