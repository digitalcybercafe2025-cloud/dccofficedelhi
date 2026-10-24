const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const licenseManager = require('./licenseManager');
const cloudTracker = require('./cloudTracker');
const supabaseLicensing = require('./supabaseLicensing');
const { autoUpdater } = require('electron-updater');

// Disable GPU disk cache and sandbox to prevent Windows cache lock issues
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('no-sandbox');

let mainWindow;
let printWindow = null;
let latestPrintData = null;
let pythonProcess = null;

function checkServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port, maxTries = 40) {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const isUp = await checkServerRunning(port);
      if (isUp || attempts >= maxTries) {
        clearInterval(interval);
        resolve(isUp);
      }
    }, 250);
  });
}

async function startPythonBackend() {
  const isRunning = await checkServerRunning(5005);
  if (isRunning) {
    console.log('Python backend already active on port 5005.');
    return;
  }

  const isDev = !app.isPackaged;
  const packagedExe = path.join(process.resourcesPath, 'backend', 'py_backend.exe');

  if (!isDev && fs.existsSync(packagedExe)) {
    console.log('Spawning compiled production Python backend executable:', packagedExe);
    pythonProcess = spawn(packagedExe, [], {
      cwd: path.dirname(packagedExe),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
  } else {
    // Development mode or script fallback
    let pythonScript = isDev
      ? path.join(__dirname, 'backend', 'app.py')
      : path.join(process.resourcesPath, 'backend', 'app.py');

    console.log('Launching Python backend via interpreter:', pythonScript);

    let pythonCmd = 'python';
    try {
      const { execSync } = require('child_process');
      execSync('python --version', { stdio: 'ignore' });
      pythonCmd = 'python';
    } catch (e) {
      try {
        const { execSync } = require('child_process');
        execSync('py --version', { stdio: 'ignore' });
        pythonCmd = 'py';
      } catch (e2) {
        pythonCmd = 'python';
      }
    }

    pythonProcess = spawn(pythonCmd, [pythonScript], {
      cwd: path.dirname(pythonScript),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
  }

  pythonProcess.stdout?.on('data', (d) => console.log(`[Python] ${d}`));
  pythonProcess.stderr?.on('data', (d) => console.error(`[Python Err] ${d}`));

  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python backend:', err);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`Python backend exited with code ${code}, signal ${signal}`);
  });

  // Guarantee backend is actively responding before UI initializes
  await waitForServer(5005, 80);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1100,
    minHeight: 700,
    frame: false, // Frameless for exact custom header matching screenshot
    backgroundColor: '#f1f5f9',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Check if Vite dev server is running on 5173
  const isViteDev = await checkServerRunning(5173);
  if (isViteDev && process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production, load dist/index.html directly
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) {
      mainWindow.loadFile(distIndex);
    } else {
      await waitForServer(5005);
      mainWindow.loadURL('http://127.0.0.1:5005');
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  await startPythonBackend();
  await createWindow();

  // Cloud Telemetry & Machine ID Tracking (Free-Tier Supabase / Firebase)
  try {
    const mid = licenseManager.machineId;
    cloudTracker.pingCloudTracker(mid).catch((err) => {
      console.warn('[main] Cloud tracking notice:', err.message);
    });

    // Silent Network-Aware Sync with Supabase licenses table
    supabaseLicensing.silentBackgroundSync(mid, app.getVersion() || '2.0.2').catch((err) => {
      console.warn('[main] Silent sync notice:', err.message);
    });
  } catch (trackErr) {
    console.warn('[main] Cloud tracking skip:', trackErr.message);
  }

  // Silent GitHub OTA Update check on startup (packaged mode only)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[main] Silent update check skip:', err.message);
      });
    }, 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function cleanupPythonProcess() {
  if (pythonProcess) {
    console.log('Terminating Python backend process...');
    try {
      if (process.platform === 'win32' && pythonProcess.pid) {
        const { execSync } = require('child_process');
        execSync(`taskkill /pid ${pythonProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (e) {
      try {
        pythonProcess.kill('SIGKILL');
      } catch (err) {}
    }
    pythonProcess = null;
  }
}

app.on('will-quit', cleanupPythonProcess);
app.on('before-quit', cleanupPythonProcess);
app.on('window-all-closed', () => {
  cleanupPythonProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
process.on('exit', cleanupPythonProcess);
process.on('SIGINT', () => {
  cleanupPythonProcess();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupPythonProcess();
  process.exit(0);
});

// IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Print Hub Sub-Window & Direct/Advanced Print IPC Handlers
ipcMain.on('open-print-window', async (event, printData) => {
  latestPrintData = printData;
  if (printWindow && !printWindow.isDestroyed()) {
    printWindow.focus();
    printWindow.webContents.send('init-print-data', printData);
    return;
  }

  printWindow = new BrowserWindow({
    width: 980,
    height: 680,
    parent: mainWindow,
    modal: false,
    resizable: true,
    title: 'Print Hub',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isViteDev = await checkServerRunning(5173);
  if (isViteDev && process.argv.includes('--dev')) {
    printWindow.loadURL('http://localhost:5173/#print-hub');
  } else {
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) {
      printWindow.loadURL(`file://${distIndex}#print-hub`);
    } else {
      printWindow.loadURL('http://127.0.0.1:5005/#print-hub');
    }
  }

  printWindow.webContents.once('did-finish-load', () => {
    if (latestPrintData) {
      printWindow.webContents.send('init-print-data', latestPrintData);
    }
  });

  printWindow.on('closed', () => {
    printWindow = null;
  });
});

ipcMain.handle('get-print-data', () => {
  return latestPrintData;
});

ipcMain.handle('get-system-printers', async (event) => {
  try {
    if (event && event.sender && typeof event.sender.getPrintersAsync === 'function') {
      return await event.sender.getPrintersAsync();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      return await mainWindow.webContents.getPrintersAsync();
    }
  } catch (err) {
    console.warn('[main] get-system-printers error:', err);
  }
  return [];
});

function sendNativePrintRequest(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5005,
      path: '/api/print',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ success: res.statusCode === 200, raw: body });
        }
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Native print HTTP request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

ipcMain.handle('open-printer-preferences', async (event, data = {}) => {
  const payload = { printer_name: data.printerName || latestPrintData?.activePrinter || null };
  const postData = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5005,
      path: '/api/printer-preferences',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 300000 // Allow up to 5 min for user to view/modify preferences
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ success: res.statusCode === 200 }); }
      });
    });
    req.on('error', err => {
      console.warn('[main] open-printer-preferences error:', err);
      resolve({ success: false, error: err.message });
    });
    req.write(postData);
    req.end();
  });
});

ipcMain.on('execute-direct-print', async (event, data = {}) => {
  let base64Image = data.snapshot || data.base64_image || data.image || latestPrintData?.snapshot;

  // Fallback: capture page snapshot if snapshot is not directly passed
  if (!base64Image && printWindow && !printWindow.isDestroyed()) {
    try {
      const nativeImg = await printWindow.webContents.capturePage();
      base64Image = nativeImg.toDataURL();
    } catch (capErr) {
      console.warn('capturePage fallback notice:', capErr);
    }
  }

  const printPayload = {
    base64_image: base64Image,
    printer_name: data.printerName || latestPrintData?.activePrinter || null,
    paper_type: data.paperType || 'Glossy',
    quality: data.quality || 'High',
    copies: parseInt(data.copies, 10) || 1,
    color_mode: data.colorMode || 'color',
    directScale: data.directScale || 100
  };

  try {
    const res = await sendNativePrintRequest(printPayload);
    console.log('[Native Print Spooler Result]:', res);
  } catch (err) {
    console.error('[Native Print Spooler Error]:', err);
  } finally {
    // Close the Print Sub-window immediately as soon as the POST request is successfully sent
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
      printWindow = null;
    }
  }
});

ipcMain.on('execute-advanced-print', (event, data = {}) => {
  if (!printWindow || printWindow.isDestroyed()) return;
  const printOptions = {
    silent: data.silent !== undefined ? data.silent : true,
    printBackground: true,
    color: data.colorMode !== 'grayscale',
    copies: parseInt(data.copies, 10) || 1,
    pageSize: 'A4',
    margins: { marginType: 'printableArea' }
  };
  if (data.printerName) {
    printOptions.deviceName = data.printerName;
  }
  printWindow.webContents.print(printOptions, (success, errorType) => {
    if (!success) console.warn('Advanced print result:', errorType);
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close(); // Strictly close after spooling
      printWindow = null;
    }
  });
});

ipcMain.on('close-print-window', () => {
  if (printWindow && !printWindow.isDestroyed()) {
    printWindow.close();
    printWindow = null;
  }
});

// Backward-compatible print handlers
ipcMain.on('print-document', (event, options = {}) => {
  if (!mainWindow) return;
  mainWindow.webContents.print({
    silent: options.silent !== undefined ? options.silent : true,
    printBackground: true,
    color: options.color !== undefined ? options.color : true,
    deviceName: options.deviceName || '',
    pageSize: 'A4',
    margins: { marginType: 'printableArea' }
  });
});

ipcMain.handle('print-document', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  
  return new Promise((resolve) => {
    mainWindow.webContents.print({
      silent: options.silent !== undefined ? options.silent : true,
      printBackground: true,
      color: options.color !== undefined ? options.color : true,
      deviceName: options.deviceName || '',
      pageSize: 'A4',
      margins: { marginType: 'printableArea' }
    }, (success, failureReason) => {
      if (!success) {
        resolve({ success: false, error: failureReason });
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('save-file-dialog', async (event, { defaultName, format }) => {
  const ext = (format || 'png').toLowerCase();
  let filters = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }];
  if (ext === 'pdf') {
    filters = [{ name: 'PDF Documents', extensions: ['pdf'] }];
  } else if (ext === 'docx') {
    filters = [{ name: 'Word Documents (.docx)', extensions: ['docx'] }];
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || `passport-photos-a4.${ext}`,
    filters
  });
  return result;
});

ipcMain.handle('save-file', async (event, { filePath, base64Data }) => {
  try {
    const dataUri = base64Data.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(dataUri, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-path', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    if (url) {
      await shell.openExternal(url);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Hardware-Bound Licensing & 21-Day Trial IPC Handlers
ipcMain.handle('get-license-status', async () => {
  return await licenseManager.getStatus();
});

ipcMain.handle('verify-activation-key', async (event, key) => {
  return licenseManager.verifyKey(key);
});

ipcMain.handle('simulate-expired-trial', async () => {
  return await licenseManager.simulateExpiredTrial();
});

ipcMain.handle('reset-trial', async () => {
  return await licenseManager.resetTrial();
});

ipcMain.handle('get-machine-id', async () => {
  return licenseManager.machineId;
});

// ============================================================================
// SUPABASE ANTI-SPOOFING LICENSING & HARDWARE-LOCKED ADMIN IPC
// ============================================================================
ipcMain.handle('validate-server-license', async () => {
  const mid = licenseManager.machineId;
  return await supabaseLicensing.validateLicenseWithServer(mid);
});

ipcMain.handle('client-onboard', async (event, payload) => {
  const mid = licenseManager.machineId;
  return await supabaseLicensing.registerClientOnboarding({
    ...payload,
    machineId: mid
  });
});

ipcMain.handle('get-admin-licenses', async () => {
  const mid = licenseManager.machineId;
  return await supabaseLicensing.getAdminLicenseList(mid);
});

ipcMain.handle('update-client-status', async (event, { targetMachineId, newStatus, planCode }) => {
  const mid = licenseManager.machineId;
  return await supabaseLicensing.updateClientStatus(mid, targetMachineId, newStatus, planCode);
});

ipcMain.handle('generate-offline-key', async (event, { targetMachineId, planCode }) => {
  return supabaseLicensing.generateOfflineKey(targetMachineId, planCode);
});

// Silent Network-Aware Cloud Sync (Supabase)
ipcMain.handle('silent-sync', async (event, payload) => {
  const mid = payload?.machineId || licenseManager.machineId;
  const version = payload?.appVersion || app.getVersion() || '2.0.2';
  return await supabaseLicensing.silentBackgroundSync(mid, version);
});

// Zero-Touch GitHub Auto-Updates (electron-updater)
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] New update available:', info.version);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] Update downloaded:', info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Digital Cyber Cafe Update Ready',
      message: `A new version (${info.version}) of Digital Cyber Cafe has been downloaded and is ready to install.`,
      detail: 'Would you like to restart the application now to apply the update?',
      buttons: ['Restart to Install', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    }).catch(() => {});
  }
});

autoUpdater.on('error', (err) => {
  console.warn('[AutoUpdater] Update check error:', err.message);
});

ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    try {
      return await autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
      return { error: e.message };
    }
  }
  return { status: 'dev_mode' };
});
