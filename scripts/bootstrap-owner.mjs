import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

if (!url || !serviceKey || !ownerEmail) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OWNER_EMAIL in the operator environment.');
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let page = 1;
let owner = null;
while (!owner) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  owner = data.users.find((user) => user.email?.trim().toLowerCase() === ownerEmail) || null;
  if (owner || data.users.length < 1000) break;
  page += 1;
}

if (!owner) throw new Error(`No Supabase Auth account exists for the configured owner email (${ownerEmail}). Create and verify that account first.`);

const { error } = await supabase.from('platform_owners').upsert({
  user_id: owner.id,
  provisioned_by: 'trusted-operator-script',
}, { onConflict: 'user_id' });
if (error) throw error;

console.log(`Provisioned the platform owner record for ${owner.email} (${owner.id}).`);
