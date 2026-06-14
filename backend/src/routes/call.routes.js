import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { callIdParam, callHistoryValidator } from '../common/Validators.js';
import { getCallHistory, getCall, getIceServers } from '../controllers/call.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', callHistoryValidator, validate, getCallHistory);
// Keep the static route above the parameterised one so it isn't read as a callId.
router.get('/ice-servers', getIceServers);
router.get('/:callId', callIdParam, validate, getCall);

export default router;
