#!/usr/bin/env node
/**
 * DIGITAL CYBER CAFE — ADMIN OFFLINE KEY GENERATOR (Node.js)
 * Secret Salt: APP_SECRET = 'dcc_master_secure_2026'
 * Generates cryptographic, hardware-bound 16-char activation keys.
 *
 * Usage:
 *   node scripts/admin_keygen.js <MachineID> [1M|3M|6M|12M|LIFE]
 */

const crypto = require('crypto');

const APP_SECRET = 'dcc_master_secure_2026';

const PLANS = {
  '1M': { name: '1 Month', days: 30 },
  '3M': { name: '3 Months', days: 90 },
  '6M': { name: '6 Months', days: 180 },
  '12M': { name: '12 Months (1 Year)', days: 365 },
  'LIFE': { name: 'Lifetime Access', days: 3650 }
};

function generateKey(machineId, plan = '12M') {
  const cleanMid = String(machineId).trim().toLowerCase();
  const cleanPlan = String(plan).trim().toUpperCase();

  const hmac = crypto
    .createHmac('sha256', APP_SECRET)
    .update(`${cleanMid}::${cleanPlan}`)
    .digest('hex')
    .toUpperCase();

  const sig = hmac.slice(0, 16);
  const formatted = `${sig.slice(0, 4)}-${sig.slice(4, 8)}-${sig.slice(8, 12)}-${sig.slice(12, 16)}`;
  const fullDccKey = `DCC-${cleanPlan}-${formatted}`;

  return {
    rawSig: sig,
    formattedKey: formatted,
    prefixedKey: fullDccKey,
    plan: PLANS[cleanPlan] || PLANS['12M']
  };
}

const args = process.argv.slice(2);
const machineId = args[0] || 'e08fe0d4-fddc-4ede-9c15-460ccabb22c4';
const planArg = (args[1] || '12M').toUpperCase();

const result = generateKey(machineId, planArg);

console.log('======================================================');
console.log('       DIGITAL CYBER CAFE — ADMIN KEY GENERATOR       ');
console.log('======================================================');
console.log(` Customer Machine ID : ${machineId}`);
console.log(` Subscription Plan   : ${result.plan.name} (${result.plan.days} Days)`);
console.log(` 16-Char Key         : ${result.formattedKey}`);
console.log(` Full Backup Key     : ${result.prefixedKey}`);
console.log('======================================================');
console.log('\nWhatsApp Template:\n');
console.log(`Hello! Here is your official activation key for Digital Cyber Cafe:\n`);
console.log(`Key: ${result.prefixedKey}`);
console.log(`Plan: ${result.plan.name}`);
console.log(`Machine ID: ${machineId}\n`);
console.log(`Paste this key into your lock screen and click "Verify & Unlock".`);
console.log('======================================================');
