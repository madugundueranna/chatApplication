import crypto from 'crypto';

export const generateOtp = () => {
  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES) || 10;
  const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return { code, expiresAt };
};

export const isOtpValid = (otp, code) =>
  Boolean(otp?.code) && otp.code === code && otp.expiresAt > new Date();
