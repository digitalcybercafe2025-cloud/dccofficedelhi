const { contextBridge, ipcRenderer } = require('electron');

const apiIpcRenderer = {
  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  removeListener: (channel, func) => ipcRenderer.removeListener(channel, func)
};

const apiElectronAPI = {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  print: (options) => ipcRenderer.invoke('print-document', options),
  saveFileDialog: (defaultName, format) => ipcRenderer.invoke('save-file-dialog', { defaultName, format }),
  saveFile: (filePath, base64Data) => ipcRenderer.invoke('save-file', { filePath, base64Data }),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  verifyActivationKey: (key) => ipcRenderer.invoke('verify-activation-key', key),
  simulateExpiredTrial: () => ipcRenderer.invoke('simulate-expired-trial'),
  resetTrial: () => ipcRenderer.invoke('reset-trial'),
  getSystemPrinters: () => ipcRenderer.invoke('get-system-printers'),
  openPrintWindow: (data) => ipcRenderer.send('open-print-window', data),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  validateServerLicense: () => ipcRenderer.invoke('validate-server-license'),
  clientOnboard: (payload) => ipcRenderer.invoke('client-onboard', payload),
  getAdminLicenses: () => ipcRenderer.invoke('get-admin-licenses'),
  updateClientStatus: (payload) => ipcRenderer.invoke('update-client-status', payload),
  generateOfflineKey: (payload) => ipcRenderer.invoke('generate-offline-key', payload),
  silentSync: (payload) => ipcRenderer.invoke('silent-sync', payload),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('ipcRenderer', apiIpcRenderer);
  contextBridge.exposeInMainWorld('electronAPI', apiElectronAPI);
} else {
  window.ipcRenderer = apiIpcRenderer;
  window.electronAPI = apiElectronAPI;
}

