/**
 * Digital Cyber Cafe - Hardware-Bound Licensing & 21-Day Trial Manager
 * Machine ID generation, encrypted local storage, online anti-clock-tamper check,
 * and offline cryptographic license key validation.
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const os = require('os');
const { execSync } = require('child_process');

let machineIdSync;
try {
  machineIdSync = require('node-machine-id').machineIdSync;
} catch (e) {
  machineIdSync = null;
}

const APP_SECRET = 'dcc_master_secure_2026';
const SECRET_MASTER_KEY = 'DCC-CYBER-CAFE-SECURE-MASTER-SALT-2026-X9!';
const TRIAL_DURATION_DAYS = 21;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

// Unique hardware ID resolution
function getHardwareId() {
  try {
    if (machineIdSync) {
      const mid = machineIdSync({ original: true });
      if (mid && mid.trim()) return mid.trim().toLowerCase();
    }
  } catch (err) {
    console.warn('[LicenseManager] node-machine-id warning:', err.message);
  }

  // Windows Registry MachineGuid fallback
  if (process.platform === 'win32') {
    try {
      const reg = execSync(
        'REG QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid',
        { encoding: 'utf8', timeout: 2000 }
      );
      const match = reg.match(/MachineGuid\s+REG_SZ\s+([A-Za-z0-9\-]+)/i);
      if (match && match[1]) return match[1].trim().toLowerCase();
    } catch (e) {}
  }

  // Fallback: CPU & Hostname hash
  const sysInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus().map((c) => c.model).join('|')}`;
  return crypto.createHash('sha256').update(sysInfo).digest('hex').slice(0, 32);
}

// Fetch network time with timeout (prevents system clock rollback bypass)
function fetchNetworkTime(timeoutMs = 3000) {
  return new Promise((resolve) => {
    // 1. Try worldtimeapi.org
    const req = https.get('https://worldtimeapi.org/api/timezone/Etc/UTC', { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.unixtime) {
            return resolve(json.unixtime * 1000);
          }
        } catch (e) {}
        // Fallback to HTTP Date header
        if (res.headers && res.headers.date) {
          const d = Date.parse(res.headers.date);
          if (!isNaN(d)) return resolve(d);
        }
        resolve(null);
      });
    });

    req.on('error', () => {
      // 2. Secondary fallback: Cloudflare HTTP Date header
      const cfReq = https.request(
        'https://1.1.1.1',
        { method: 'HEAD', timeout: 2000 },
        (cfRes) => {
          if (cfRes.headers && cfRes.headers.date) {
            const d = Date.parse(cfRes.headers.date);
            if (!isNaN(d)) return resolve(d);
          }
          resolve(null);
        }
      );
      cfReq.on('error', () => resolve(null));
      cfReq.end();
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

class LicenseManager {
  constructor() {
    this.machineId = getHardwareId();
    this.storagePath = null;
    this.encKey = crypto.createHash('sha256').update(this.machineId + '_DCC_ENC_KEY_2026').digest();
  }

  getFilePath() {
    if (!this.storagePath) {
      const userData = app ? app.getPath('userData') : process.cwd();
      this.storagePath = path.join(userData, 'dcc_license.dat');
    }
    return this.storagePath;
  }

  encryptData(obj) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encKey, iv);
    const jsonStr = JSON.stringify(obj);
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted
    });
  }

  decryptData(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.iv || !parsed.data) return null;
      const iv = Buffer.from(parsed.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encKey, iv);
      let decrypted = decipher.update(parsed.data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (err) {
      return null;
    }
  }

  loadLicenseFile() {
    const filePath = this.getFilePath();
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return this.decryptData(raw);
    } catch (e) {
      return null;
    }
  }

  saveLicenseFile(data) {
    const filePath = this.getFilePath();
    try {
      const cipherText = this.encryptData(data);
      fs.writeFileSync(filePath, cipherText, 'utf8');
      return true;
    } catch (e) {
      console.error('[LicenseManager] Failed to save license file:', e);
      return false;
    }
  }

  async getStatus() {
    let license = this.loadLicenseFile();
    const networkTime = await fetchNetworkTime(2500);
    const localNow = Date.now();

    // First launch initialization
    if (!license) {
      const initTime = networkTime || localNow;
      license = {
        machineId: this.machineId,
        installDate: initTime,
        trialDurationDays: TRIAL_DURATION_DAYS,
        lastRecordedTime: initTime,
        isActivated: false,
        licenseKey: null,
        licensePlan: null,
        licenseExpiryDate: null
      };
      this.saveLicenseFile(license);
    }

    // Anti-clock rollback verification
    let effectiveTime = localNow;
    let isClockTampered = false;

    if (networkTime) {
      effectiveTime = networkTime;
      license.lastRecordedTime = Math.max(license.lastRecordedTime || 0, networkTime);
    } else {
      // Offline fallback: system clock must not be behind last recorded time (allow 60s jitter)
      if (license.lastRecordedTime && localNow < license.lastRecordedTime - 60000) {
        isClockTampered = true;
        effectiveTime = license.lastRecordedTime;
      } else {
        effectiveTime = Math.max(localNow, license.lastRecordedTime || localNow);
        license.lastRecordedTime = effectiveTime;
      }
    }

    this.saveLicenseFile(license);

    // 1. Check if user has an activated license
    if (license.isActivated && license.licenseExpiryDate) {
      if (license.licensePlan === 'LIFE') {
        return {
          isUnlocked: true,
          isTrialExpired: false,
          isActivated: true,
          daysLeft: 9999,
          machineId: this.machineId,
          plan: 'LIFETIME',
          expiryDate: 'Lifetime Access',
          isClockTampered
        };
      }

      if (effectiveTime <= license.licenseExpiryDate) {
        const daysLeft = Math.max(0, Math.ceil((license.licenseExpiryDate - effectiveTime) / (24 * 60 * 60 * 1000)));
        return {
          isUnlocked: true,
          isTrialExpired: false,
          isActivated: true,
          daysLeft,
          machineId: this.machineId,
          plan: license.licensePlan,
          expiryDate: new Date(license.licenseExpiryDate).toLocaleDateString(),
          isClockTampered
        };
      } else {
        // License expired
        return {
          isUnlocked: false,
          isTrialExpired: true,
          isActivated: false,
          daysLeft: 0,
          machineId: this.machineId,
          plan: license.licensePlan,
          expiryDate: new Date(license.licenseExpiryDate).toLocaleDateString(),
          expiredReason: 'License expired. Please renew your subscription.',
          isClockTampered
        };
      }
    }

    // 2. Check 21-Day Free Trial
    const trialExpiry = license.installDate + TRIAL_DURATION_MS;
    const isTrialExpired = effectiveTime > trialExpiry;
    const daysLeft = Math.max(0, Math.ceil((trialExpiry - effectiveTime) / (24 * 60 * 60 * 1000)));

    return {
      isUnlocked: !isTrialExpired,
      isTrialExpired,
      isActivated: false,
      daysLeft,
      machineId: this.machineId,
      plan: 'TRIAL',
      expiryDate: new Date(trialExpiry).toLocaleDateString(),
      installDate: new Date(license.installDate).toLocaleDateString(),
      isClockTampered
    };
  }

  // Offline Key Verification Algorithm (supports 16-character keys and DCC-prefixed keys)
  verifyKey(key) {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Please enter an activation key.' };
    }

    const rawKey = key.trim().toUpperCase();
    const cleanHex = rawKey.replace(/[^A-F0-9]/gi, ''); // remove hyphens, spaces, prefixes
    const cleanMid = this.machineId.trim().toLowerCase();

    // Check if key has explicit DCC prefix: DCC-<PLAN>-<16-CHAR-SIG>
    let explicitPlan = null;
    let targetSig = '';

    const dccMatch = rawKey.match(/^DCC-(7D|1M|3M|6M|12M|LIFE)-([A-F0-9]{4})-?([A-F0-9]{4})-?([A-F0-9]{4})-?([A-F0-9]{4})$/i);
    if (dccMatch) {
      explicitPlan = dccMatch[1].toUpperCase();
      targetSig = `${dccMatch[2]}${dccMatch[3]}${dccMatch[4]}${dccMatch[5]}`.toUpperCase();
    } else {
      // 16-character format (e.g. A1B2-C3D4-E5F6-G7H8 or A1B2C3D4E5F6G7H8)
      if (cleanHex.length === 16) {
        targetSig = cleanHex.toUpperCase();
      } else {
        return {
          success: false,
          error: 'Invalid key format. Expected 16-character key (e.g. A1B2-C3D4-E5F6-G7H8)'
        };
      }
    }

    // Supported plans and duration mapping
    const durationMap = {
      '7D': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '12M': 365,
      'LIFE': 3650
    };

    const secretsToCheck = [APP_SECRET, SECRET_MASTER_KEY];
    const plansToCheck = explicitPlan ? [explicitPlan] : ['12M', '6M', '3M', '1M', '7D', 'LIFE'];
    let matchedPlan = null;

    for (const secret of secretsToCheck) {
      if (matchedPlan) break;

      // Check 1: Direct hash of Machine ID (e.g. standard lifetime/12M format)
      const directHmac = crypto
        .createHmac('sha256', secret)
        .update(cleanMid)
        .digest('hex')
        .toUpperCase()
        .slice(0, 16);

      const bufEntered = Buffer.from(targetSig, 'utf8');
      const bufDirect = Buffer.from(directHmac, 'utf8');
      if (bufEntered.length === bufDirect.length && crypto.timingSafeEqual(bufEntered, bufDirect)) {
        matchedPlan = explicitPlan || '12M';
        break;
      }

      // Check 2: Plan-based hash (cleanMid::plan)
      for (const p of plansToCheck) {
        const planHmac = crypto
          .createHmac('sha256', secret)
          .update(`${cleanMid}::${p}`)
          .digest('hex')
          .toUpperCase()
          .slice(0, 16);

        const bufExpected = Buffer.from(planHmac, 'utf8');
        if (bufEntered.length === bufExpected.length && crypto.timingSafeEqual(bufEntered, bufExpected)) {
          matchedPlan = p;
          break;
        }
      }
    }

    if (!matchedPlan) {
      return {
        success: false,
        error: 'Invalid key. This key does not match your specific Machine ID.'
      };
    }

    const durationDays = durationMap[matchedPlan] || 365;
    const now = Date.now();
    const expiryDateMs = now + durationDays * 24 * 60 * 60 * 1000;

    // Save activated license
    let license = this.loadLicenseFile() || {
      machineId: this.machineId,
      installDate: now
    };

    license.isActivated = true;
    license.licenseKey = rawKey;
    license.licensePlan = matchedPlan;
    license.licenseExpiryDate = expiryDateMs;
    license.lastRecordedTime = now;

    this.saveLicenseFile(license);

    return {
      success: true,
      plan: matchedPlan,
      durationDays,
      expiryDate: new Date(expiryDateMs).toLocaleDateString(),
      message: `License activated successfully for ${matchedPlan === 'LIFE' ? 'Lifetime' : matchedPlan}!`
    };
  }

  // Helper for testing: resets back to fresh 21-day trial
  resetTrial() {
    const filePath = this.getFilePath();
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }
    return this.getStatus();
  }

  // Helper for testing: simulates an expired trial (installed 25 days ago)
  simulateExpiredTrial() {
    const now = Date.now();
    const twentyFiveDaysAgo = now - 25 * 24 * 60 * 60 * 1000;
    const data = {
      machineId: this.machineId,
      installDate: twentyFiveDaysAgo,
      trialDurationDays: TRIAL_DURATION_DAYS,
      lastRecordedTime: now,
      isActivated: false,
      licenseKey: null,
      licensePlan: null,
      licenseExpiryDate: null
    };
    this.saveLicenseFile(data);
    return this.getStatus();
  }
}

const licenseManager = new LicenseManager();
module.exports = licenseManager;
