//* OTP verification email template.
//* Returns { subject, html, text }. Email-client-safe by design:
//* table-based layout, fully inlined styles, no external assets, no JS.
//* The <style> block holds ONLY @media (mobile + dark-mode) rules — never
//* core layout/colors, since Gmail/Outlook strip or ignore much of <head>.

const escapeHtml = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, 'Courier New', monospace";

export const otpEmailTemplate = ({
  appName = 'Chat App',
  name,
  code,
  expiryMinutes = 10,
  supportEmail = 'support@example.com',
  brandColor = '#4f46e5',
} = {}) => {
  const safeApp = escapeHtml(appName);
  const safeCode = escapeHtml(code);
  const safeSupport = escapeHtml(supportEmail);
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const year = new Date().getFullYear();

  const subject = `Verify your email for ${appName}`;

  const text = [
    name ? `Hi ${name},` : 'Hi there,',
    '',
    `Use this code to verify your email for ${appName}:`,
    '',
    `    ${code}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    "If you didn't request this, you can safely ignore this email.",
    '',
    `— ${appName}`,
    `This is an automated message, please don't reply. Need help? ${supportEmail}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media (max-width: 600px) {
      .sm-full { width: 100% !important; }
      .sm-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .code { font-size: 30px !important; letter-spacing: 8px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .bg { background-color: #0f172a !important; }
      .card { background-color: #1e293b !important; }
      .heading { color: #f8fafc !important; }
      .text { color: #e2e8f0 !important; }
      .muted { color: #94a3b8 !important; }
      .code-box { background-color: #0f172a !important; border-color: #334155 !important; }
      .code { color: #ffffff !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0; padding:0; width:100%; background-color:#f4f4f7;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f4f4f7; opacity:0;">
    Your ${safeApp} verification code&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:24px;">
        <table role="presentation" class="sm-full" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <tr>
            <td style="padding:8px 0 24px; text-align:center; font-family:${FONT_STACK}; font-size:20px; font-weight:700; color:${brandColor};">
              ${safeApp}
            </td>
          </tr>

          <tr>
            <td class="card sm-pad" style="background-color:#ffffff; border-radius:12px; padding:40px; font-family:${FONT_STACK};">
              <h1 class="heading" style="margin:0 0 16px; font-size:24px; font-weight:700; color:#111827;">Verify your email</h1>

              <p class="text" style="margin:0 0 8px; font-size:16px; line-height:24px; color:#374151;">${greeting}</p>
              <p class="muted" style="margin:0 0 28px; font-size:15px; line-height:24px; color:#6b7280;">
                Use the code below to verify your email address and finish signing in to ${safeApp}.
              </p>

              <p class="muted" style="margin:0 0 10px; font-size:13px; color:#6b7280;">Your verification code</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="code-box" align="center" style="background-color:#f4f4f7; border:1px solid #e5e7eb; border-radius:10px; padding:22px 16px;">
                    <span class="code" style="font-family:${MONO_STACK}; font-size:36px; font-weight:700; letter-spacing:10px; color:#111827;">${safeCode}</span>
                  </td>
                </tr>
              </table>

              <p class="muted" style="margin:24px 0 0; font-size:14px; line-height:22px; color:#6b7280;">
                This code expires in ${expiryMinutes} minutes.
              </p>

              <div style="border-top:1px solid #e5e7eb; margin:28px 0 0; height:1px; line-height:1px; font-size:0;">&nbsp;</div>

              <p class="muted" style="margin:20px 0 0; font-size:13px; line-height:20px; color:#9ca3af;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <tr>
            <td class="muted" style="padding:24px; text-align:center; font-family:${FONT_STACK}; font-size:12px; line-height:20px; color:#9ca3af;">
              ${safeApp} &middot; This is an automated message, please don't reply.<br>
              Need help? <a href="mailto:${safeSupport}" style="color:${brandColor}; text-decoration:none;">${safeSupport}</a><br>
              &copy; ${year} ${safeApp}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
};

export default otpEmailTemplate;
