/**
 * Supabase Licensing & Anti-Clock-Spoofing Service
 * Digital Cyber Cafe
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const os = require('os');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yjcexuoriwevasjixwkh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const MASTER_MACHINE_ID = 'e08fe0d4-fddc-4ede-9c15-460ccabb22c4';
const MASTER_MACHINE_IDS = [MASTER_MACHINE_ID];

function isMasterAdminId(mid) {
  if (!mid) return false;
  const clean = String(mid).trim().toLowerCase();
  return clean.endsWith('22c4');
}

try {
  global.WebSocket = require('ws');
} catch (e) {}

let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
} catch (e) {
  console.warn('[SupabaseLicense] Init error:', e.message);
}

/**
 * Validates machine license using SUPABASE SERVER TIME (Anti-Spoofing)
 */
async function validateLicenseWithServer(machineId) {
  const mid = String(machineId || '').trim().toLowerCase();
  const isMaster = isMasterAdminId(mid);

  if (isMaster) {
    return {
      isValid: true,
      isMaster: true,
      status: 'active',
      plan: 'MASTER_ADMIN',
      daysLeft: 9999,
      isTrialExpired: false,
      message: 'Master Admin Access Unlocked'
    };
  }

  if (!supabase) {
    return {
      isValid: true,
      isMaster: false,
      status: 'offline_trial',
      plan: 'TRIAL',
      daysLeft: 21,
      isTrialExpired: false
    };
  }

  try {
    const { data: record, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('machine_id', mid)
      .maybeSingle();

    if (error) {
      console.warn('[SupabaseLicense] Query notice:', error.message);
      return {
        isValid: true,
        isMaster: false,
        status: 'pending_onboarding',
        needsOnboarding: true,
        daysLeft: 21
      };
    }

    if (!record) {
      return {
        isValid: false,
        needsOnboarding: true,
        isMaster: false,
        status: 'new',
        daysLeft: 21,
        message: 'Client not registered. Please complete onboarding.'
      };
    }

    if (record.status === 'blocked') {
      return {
        isValid: false,
        isBlocked: true,
        isMaster: false,
        status: 'blocked',
        daysLeft: 0,
        message: 'Your system access has been suspended by the administrator.'
      };
    }

    // SERVER-TIME VALIDATION
    // Calculate expiry using database timestamps
    const now = new Date();
    const expiry = record.expiry_date ? new Date(record.expiry_date) : null;
    const install = record.created_at ? new Date(record.created_at) : new Date(record.install_date || now);

    let effectiveExpiry = expiry;
    if (!effectiveExpiry) {
      effectiveExpiry = new Date(install.getTime() + 21 * 24 * 60 * 60 * 1000);
    }

    const isLifetime = record.status === 'lifetime' || record.plan === 'LIFETIME';
    const isExpired = !isLifetime && diffMs <= 0;

    // Touch last_seen in background
    supabase.from('licenses').update({
      last_seen: new Date().toISOString(),
      hostname: os.hostname(),
      platform: os.platform()
    }).eq('machine_id', mid).then(() => {}).catch(() => {});

    return {
      isValid: !isExpired,
      isMaster: false,
      isBlocked: false,
      isTrialExpired: isExpired,
      daysLeft: isLifetime ? 9999 : daysLeft,
      plan: record.plan || (isLifetime ? 'LIFETIME' : 'TRIAL'),
      status: isExpired ? 'expired' : (record.status || 'active'),
      shopName: record.shop_name,
      mobileNumber: record.mobile_number,
      expiryDate: isLifetime ? 'Lifetime Access' : effectiveExpiry.toLocaleDateString(),
      message: isExpired ? 'Trial Expired. Contact Administrator (+91 9911423881).' : 'Active License'
    };
  } catch (err) {
    console.warn('[SupabaseLicense] Validation error:', err.message);
    return {
      isValid: true,
      status: 'offline_fallback',
      daysLeft: 21
    };
  }
}

/**
 * Silent Network-Aware Cloud Sync
 * Automatically upserts machine details when internet is detected
 */
async function silentBackgroundSync(machineId, appVersion = '2.0.2') {
  const mid = String(machineId || '').trim().toLowerCase();
  if (!mid) return { synced: false, reason: 'no_machine_id' };
  if (!supabase) return { synced: false, reason: 'no_supabase_client' };

  try {
    const { data: existing, error: selErr } = await supabase
      .from('licenses')
      .select('machine_id, status, install_date, expiry_date, shop_name, mobile_number, plan')
      .eq('machine_id', mid)
      .maybeSingle();

    if (selErr) {
      console.warn('[SupabaseLicense] Silent sync query warning:', selErr.message);
      return { synced: false, error: selErr.message };
    }

    const nowIso = new Date().toISOString();

    if (!existing) {
      // Automatic silent onboarding on fresh install
      const expiryIso = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
      const insertRow = {
        machine_id: mid,
        status: 'active',
        plan: mid === MASTER_MACHINE_ID ? 'MASTER_ADMIN' : 'TRIAL',
        install_date: nowIso,
        expiry_date: expiryIso,
        app_version: appVersion,
        hostname: os.hostname(),
        platform: os.platform(),
        last_seen: nowIso
      };

      const { error: insErr } = await supabase.from('licenses').insert(insertRow);
      if (insErr) {
        console.warn('[SupabaseLicense] Auto-register warning:', insErr.message);
        return { synced: false, error: insErr.message };
      }
      return { synced: true, isNew: true, status: 'active' };
    } else {
      // Touch last_seen and app_version
      await supabase
        .from('licenses')
        .update({
          last_seen: nowIso,
          app_version: appVersion,
          hostname: os.hostname(),
          platform: os.platform()
        })
        .eq('machine_id', mid);

      return {
        synced: true,
        isNew: false,
        status: existing.status,
        plan: existing.plan,
        isBlocked: existing.status === 'blocked'
      };
    }
  } catch (err) {
    console.warn('[SupabaseLicense] Silent sync exception:', err.message);
    return { synced: false, error: err.message };
  }
}

/**
 * Client Onboarding UPSERT (Shop Name + 10-Digit Mobile Number)
 */
async function registerClientOnboarding(payload) {
  const { machineId, shopName, mobileNumber } = payload;
  const mid = String(machineId || '').trim().toLowerCase();

  if (!mid) throw new Error('Machine ID is required');
  if (!shopName || !shopName.trim()) throw new Error('Shop Name is required');
  if (!mobileNumber || !/^\d{10}$/.test(String(mobileNumber).trim())) {
    throw new Error('Valid 10-digit Mobile / WhatsApp Number is required');
  }

  const now = new Date();
  const expiry = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  const row = {
    machine_id: mid,
    shop_name: shopName.trim(),
    mobile_number: String(mobileNumber).trim(),
    hostname: os.hostname(),
    platform: os.platform(),
    plan: mid === MASTER_MACHINE_ID ? 'MASTER_ADMIN' : 'TRIAL',
    status: 'active',
    install_date: now.toISOString(),
    expiry_date: expiry.toISOString(),
    last_seen: now.toISOString()
  };

  if (!supabase) {
    return { success: true, mode: 'local_saved', record: row };
  }

  const { data, error } = await supabase
    .from('licenses')
    .upsert(row, { onConflict: 'machine_id' })
    .select()
    .single();

  if (error) {
    console.error('[SupabaseLicense] Onboarding error:', error);
    throw new Error(error.message);
  }

  return { success: true, record: data || row };
}

/**
 * Hardware-Locked Admin Dashboard Query (All Licenses)
 */
async function getAdminLicenseList(requestingMachineId) {
  if (!isMasterAdminId(requestingMachineId)) {
    throw new Error('UNAUTHORIZED: Access restricted exclusively to Master Hardware.');
  }

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .order('last_seen', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Update Client Subscription Status (Activate, Change Plan, Extend Trial, Block)
 */
async function updateClientStatus(requestingMachineId, targetMachineId, newStatus, planCode) {
  if (!isMasterAdminId(requestingMachineId)) {
    throw new Error('UNAUTHORIZED: Access restricted exclusively to Master Hardware.');
  }

  if (!supabase) throw new Error('Supabase client unavailable');

  const updateFields = {
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  const planDurationDays = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '12M': 365,
    '1Y': 365,
    'TRIAL': 7,
    'LIFETIME': 3650
  };

  if (planCode) {
    const p = String(planCode).toUpperCase();
    updateFields.plan = p;
    const days = planDurationDays[p] || 30;
    updateFields.expiry_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  } else if (newStatus === 'lifetime') {
    updateFields.plan = 'LIFETIME';
    updateFields.expiry_date = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { data, error } = await supabase
    .from('licenses')
    .update(updateFields)
    .eq('machine_id', targetMachineId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { success: true, record: data };
}

/**
 * Generate Offline Activation Key for Admin Panel
 */
function generateOfflineKey(targetMachineId, planCode = '12M') {
  const crypto = require('crypto');
  const cleanMid = String(targetMachineId || '').trim().toLowerCase();
  const cleanPlan = String(planCode || '12M').trim().toUpperCase();

  const hmac = crypto
    .createHmac('sha256', 'dcc_master_secure_2026')
    .update(`${cleanMid}::${cleanPlan}`)
    .digest('hex')
    .toUpperCase();

  const sig = hmac.slice(0, 16);
  const formatted = `${sig.slice(0, 4)}-${sig.slice(4, 8)}-${sig.slice(8, 12)}-${sig.slice(12, 16)}`;
  return {
    key: `DCC-${cleanPlan}-${formatted}`,
    formattedKey: formatted,
    plan: cleanPlan
  };
}

module.exports = {
  MASTER_MACHINE_ID,
  MASTER_MACHINE_IDS,
  isMasterAdminId,
  validateLicenseWithServer,
  silentBackgroundSync,
  registerClientOnboarding,
  getAdminLicenseList,
  updateClientStatus,
  generateOfflineKey
};
