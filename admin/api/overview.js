// Admin overview for every user's ACs. Row level security limits the anon key to one owner, so this
// runs on the server with the service role key and only answers signed-in admins.
//
// Env (Vercel project settings):
//   SUPABASE_URL               https://<project>.supabase.co
//   SUPABASE_ANON_KEY          the public key, used to check the caller's session
//   SUPABASE_SERVICE_ROLE_KEY  secret, never sent to the browser
//   ADMIN_EMAILS               comma-separated emails allowed in

const DAY_MS = 24 * 60 * 60 * 1000;

async function rest(url, key, path) {
  const res = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function callerEmail(url, anonKey, token) {
  if (!token) return null;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json();
  return (user.email || '').toLowerCase();
}

async function allUsers(url, key) {
  const users = [];
  for (let page = 1; page < 50; page += 1) {
    const data = await rest(url, key, `/auth/v1/admin/users?page=${page}&per_page=200`);
    const batch = data.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users.map(u => ({ id: u.id, email: u.email, createdAt: u.created_at, lastSignInAt: u.last_sign_in_at }));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey, ADMIN_EMAILS } = process.env;
  if (!url || !anonKey || !serviceKey || !ADMIN_EMAILS) {
    res.status(500).json({ error: 'The dashboard is not configured yet (missing environment variables).' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const email = await callerEmail(url, anonKey, token);
  if (!email) {
    res.status(401).json({ error: 'Please sign in.' });
    return;
  }
  const admins = ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(email)) {
    res.status(403).json({ error: `${email} is not an admin.` });
    return;
  }

  try {
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const [users, devices, bridges, commands, errors, activity] = await Promise.all([
      allUsers(url, serviceKey),
      rest(url, serviceKey, '/rest/v1/devices?select=id,owner_id,name,vendor,brand,model,room_name,ip_address,status,is_on,mode,target_temp,current_temp,last_seen,last_error,created_at&order=created_at.desc'),
      rest(url, serviceKey, '/rest/v1/bridges?select=id,owner_id,name,version,host_info,last_seen,created_at'),
      rest(url, serviceKey, `/rest/v1/device_commands?select=id,device_id,owner_id,patch,status,executed_by,error,created_at,executed_at&created_at=gte.${since}&order=created_at.desc&limit=2000`),
      rest(url, serviceKey, `/rest/v1/error_logs?select=id,owner_id,error_type,message,device_brand,device_ip,platform,created_at&created_at=gte.${since}&order=created_at.desc&limit=2000`),
      rest(url, serviceKey, `/rest/v1/user_activity?select=id,owner_id,action,device_name,details,created_at&created_at=gte.${since}&order=created_at.desc&limit=2000`),
    ]);
    res.status(200).json({ generatedAt: new Date().toISOString(), viewer: email, users, devices, bridges, commands, errors, activity });
  } catch (err) {
    res.status(502).json({ error: `Could not read from Supabase: ${err.message}` });
  }
};
