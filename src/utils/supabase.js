import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://yjcexuoriwevasjixwkh.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqY2V4dW9yaXdldmFzaml4d2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTg4NjMsImV4cCI6MjEwODA3NDg2M30.8zvIOP2m3_gOB8Jd5hDjY_jnNjihEBOB5uOSHuLKcVw';

export const MASTER_ADMIN_IDS = [
  (import.meta.env.VITE_MASTER_MACHINE_ID || 'e08fe0d4-fddc-4ede-9c15-460ccabb22c4')
    .trim()
    .toLowerCase()
];

export const MASTER_MACHINE_ID = MASTER_ADMIN_IDS[0];

export function isMasterAdminId(mid) {
  if (!mid) return false;
  const clean = String(mid).trim().toLowerCase();
  return clean === 'e08fe0d4-fddc-4ede-9c15-460ccabb22c4';
}

let client = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
} catch (err) {
  console.warn('[SupabaseClient] Initialization warning:', err.message);
}

export const supabase = client;

/**
 * Silent Network-Aware Client Sync
 * Automatically creates/updates registration when internet is detected
 */
export async function silentSyncWithSupabase(machineId, appVersion = '2.0.2') {
  if (!machineId || !navigator.onLine) {
    return { synced: false, reason: 'offline_or_no_mid' };
  }

  // 1. Prefer IPC if in Electron
  if (window.electronAPI?.silentSync) {
    try {
      return await window.electronAPI.silentSync({ machineId, appVersion });
    } catch (e) {
      console.warn('[silentSync] IPC fallback:', e.message);
    }
  }

  // 2. Browser fallback via direct Supabase client
  if (!supabase) return { synced: false, reason: 'no_supabase_client' };

  try {
    const mid = String(machineId).trim().toLowerCase();
    const { data: existing, error: selectErr } = await supabase
      .from('licenses')
      .select('machine_id, status, install_date, shop_name, mobile_number')
      .eq('machine_id', mid)
      .maybeSingle();

    if (selectErr) throw selectErr;

    const nowIso = new Date().toISOString();

    if (!existing) {
      const expiryIso = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
      const storedShop = localStorage.getItem('shopName') || 'Digital Cyber Cafe';
      const storedMobile = localStorage.getItem('mobileNumber') || '';

      const { error: insErr } = await supabase.from('licenses').insert({
        machine_id: mid,
        status: 'active',
        plan: mid === MASTER_MACHINE_ID ? 'MASTER_ADMIN' : 'TRIAL',
        shop_name: storedShop,
        mobile_number: storedMobile,
        install_date: nowIso,
        expiry_date: expiryIso,
        app_version: appVersion,
        last_seen: nowIso
      });

      if (insErr) throw insErr;
      return { synced: true, isNew: true };
    } else {
      // Update last_seen
      await supabase
        .from('licenses')
        .update({
          last_seen: nowIso,
          app_version: appVersion
        })
        .eq('machine_id', mid);

      return { synced: true, isNew: false, status: existing.status };
    }
  } catch (err) {
    console.warn('[silentSync] direct error:', err.message);
    return { synced: false, error: err.message };
  }
}
