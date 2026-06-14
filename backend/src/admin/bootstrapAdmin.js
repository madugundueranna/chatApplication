import User from '../models/User.js';
import { ROLES } from '../common/Constants.js';

// Promote the account named by ADMIN_EMAIL to admin on startup, so there is
// always at least one login that can reach the dashboard. No-op when the var is
// unset or the user hasn't registered yet (register, then restart). Best-effort:
// a failure here must not block the server from starting.
const bootstrapAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  try {
    const result = await User.updateOne(
      { email, role: { $ne: ROLES.ADMIN } },
      { $set: { role: ROLES.ADMIN, isActive: true } }
    );
    if (result.modifiedCount) console.log(`Promoted ${email} to admin`);
  } catch (err) {
    console.error(`Admin bootstrap failed: ${err.message}`);
  }
};

export default bootstrapAdmin;
