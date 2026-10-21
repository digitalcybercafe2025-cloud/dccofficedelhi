/**
 * Digital Cyber Cafe - Cloud Tracking & Machine ID Telemetry Service
 * Free-tier Supabase / Firebase cloud synchronization
 */

const { createClient } = require('@supabase/supabase-js');
const os = require('os');

// ============================================================================
// FREE-TIER SUPABASE / FIREBASE CONFIGURATION
// Replace the placeholder SUPABASE_URL and SUPABASE_ANON_KEY with your free project credentials.
// You can get them for free at https://supabase.com
// ============================================================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-public-key-here';

let supabaseClient = null;

try {
  // Only initialize client if valid URL is provided (not placeholder)
  if (
    SUPABASE_URL &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('your-project-id')
  ) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
} catch (err) {
  console.warn('[CloudTracker] Supabase init warning:', err.message);
}

/**
 * Silently pings the cloud tracker database on app startup or timer
 * Schema Table: 'devices' or 'active_machines'
 * Columns: machine_id (TEXT, PRIMARY KEY), status (TEXT), hostname (TEXT), platform (TEXT), last_seen (TIMESTAMPTZ)
 */
async function pingCloudTracker(machineId) {
  if (!machineId) {
    return { success: false, reason: 'No machineId provided' };
  }

  const payload = {
    machine_id: String(machineId).trim().toLowerCase(),
    status: 'active',
    hostname: os.hostname(),
    platform: os.platform(),
    os_release: os.release(),
    arch: os.arch(),
    app_version: '2.0.2',
    last_seen: new Date().toISOString()
  };

  if (!supabaseClient) {
    // Configured for local/offline mode with placeholder credentials
    console.log(`[CloudTracker] Machine ID registered: ${payload.machine_id} (Cloud tracking active, awaiting custom Supabase keys)`);
    return {
      success: true,
      mode: 'placeholder',
      message: 'Cloud tracking initialized with local machineId. Connect Supabase URL/Key to sync online.',
      data: payload
    };
  }

  try {
    const { data, error } = await supabaseClient
      .from('devices')
      .upsert(payload, { onConflict: 'machine_id' });

    if (error) {
      console.warn('[CloudTracker] Supabase ping notice:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[CloudTracker] Cloud sync heartbeat successful for: ${payload.machine_id}`);
    return { success: true, mode: 'cloud_synced', data };
  } catch (syncErr) {
    // Offline or network error - fail silently without interrupting the user
    console.warn('[CloudTracker] Cloud sync network notice:', syncErr.message);
    return { success: false, error: syncErr.message };
  }
}

module.exports = {
  pingCloudTracker,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
};
