/**
 * Digital Cyber Cafe - Official License Key Generator CLI
 * Usage: node scripts/generate-license.js <MachineId> <Plan: 1M | 3M | 6M | 12M | LIFE>
 * Example: node scripts/generate-license.js e08fe0d4-fddc-4ede-9c15-460ccabb22c4 12M
 */

const crypto = require('crypto');

const SECRET_MASTER_KEY = 'DCC-CYBER-CAFE-SECURE-MASTER-SALT-2026-X9!';

function generateKey(machineId, plan = '12M') {
  if (!machineId) {
    console.error('Error: Machine ID is required.');
    console.log('Usage: node scripts/generate-license.js <MachineId> <1M|3M|6M|12M|LIFE>');
    process.exit(1);
  }

  const validPlans = ['1M', '3M', '6M', '12M', 'LIFE'];
  const cleanPlan = plan.trim().toUpperCase();
  if (!validPlans.includes(cleanPlan)) {
    console.error(`Error: Invalid plan "${plan}". Allowed plans: ${validPlans.join(', ')}`);
    process.exit(1);
  }

  const cleanMid = machineId.trim().toLowerCase();
  const hmac = crypto
    .createHmac('sha256', SECRET_MASTER_KEY)
    .update(`${cleanMid}::${cleanPlan}`)
    .digest('hex')
    .toUpperCase();

  const sig = `${hmac.slice(0, 4)}-${hmac.slice(4, 8)}-${hmac.slice(8, 12)}-${hmac.slice(12, 16)}`;
  const activationKey = `DCC-${cleanPlan}-${sig}`;

  return {
    machineId: cleanMid,
    plan: cleanPlan,
    activationKey
  };
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const mid = args[0];
  const plan = args[1] || '12M';

  if (!mid) {
    console.log('\n======================================================');
    console.log('   DIGITAL CYBER CAFE - LICENSE GENERATOR');
    console.log('======================================================');
    console.log('Usage: node scripts/generate-license.js <MachineId> <1M|3M|6M|12M|LIFE>');
    console.log('Example: node scripts/generate-license.js e08fe0d4-fddc-4ede-9c15-460ccabb22c4 12M\n');
    process.exit(0);
  }

  const result = generateKey(mid, plan);
  console.log('\n======================================================');
  console.log('   LICENSE ACTIVATION KEY GENERATED');
  console.log('======================================================');
  console.log('Machine ID     :', result.machineId);
  console.log('Plan Duration  :', result.plan);
  console.log('Activation Key :', result.activationKey);
  console.log('======================================================\n');
}

module.exports = { generateKey, SECRET_MASTER_KEY };
