import { Router } from 'express';
import validate from '../middleware/validate.middleware.js';
import {
  registerValidator,
  loginValidator,
  verifyOtpValidator,
  resendOtpValidator,
  refreshValidator,
  logoutValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from '../common/Validators.js';
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', registerValidator, validate, register);
router.post('/verify-otp', verifyOtpValidator, validate, verifyOtp);
router.post('/resend-otp', resendOtpValidator, validate, resendOtp);
router.post('/login', loginValidator, validate, login);
router.post('/refresh', refreshValidator, validate, refresh);
router.post('/logout', logoutValidator, validate, logout);
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);

export default router;
