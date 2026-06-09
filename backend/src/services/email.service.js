import nodemailer from 'nodemailer';
import { otpEmailTemplate } from '../templates/otpEmail.js';

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const appName = () => process.env.APP_NAME || 'Chat App';

// Friendly "App Name <address>" sender, unless SMTP_FROM already carries a display name.
const defaultFrom = () => {
  const addr = process.env.SMTP_FROM || process.env.SMTP_USER || '';
  return addr.includes('<') ? addr : `"${appName()}" <${addr}>`;
};

export const sendMail = ({ to, subject, html, text, from }) =>
  getTransporter().sendMail({ from: from || defaultFrom(), to, subject, html, text });

export const sendOtpEmail = (to, code) => {
  const { subject, html, text } = otpEmailTemplate({
    appName: appName(),
    code,
    expiryMinutes: Number(process.env.OTP_TTL_MINUTES) || 10,
    supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_USER,
    brandColor: process.env.BRAND_COLOR || undefined,
  });
  return sendMail({ to, subject, html, text });
};

export const sendNewMessageEmail = (to, senderName) =>
  sendMail({
    to,
    subject: 'New message',
    text: `You have a new message from ${senderName}.`,
    html: `<p>You have a new message from <strong>${senderName}</strong>.</p>`,
  });
