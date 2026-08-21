const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onChatMessage: (cb) => ipcRenderer.on('chat-message', (_e, msg) => cb(msg)),
  onLockState: (cb) => ipcRenderer.on('lock-state', (_e, locked) => cb(locked)),
  onLoadConfig: (cb) => ipcRenderer.on('load-config', (_e, cfg) => cb(cfg)),
  onPlatformStatus: (cb) => ipcRenderer.on('platform-status', (_e, data) => cb(data)),
  toggleLock: () => ipcRenderer.send('toggle-lock'),
  saveConfig: (cfg) => ipcRenderer.send('save-config', cfg),
  resetConfig: () => ipcRenderer.send('reset-config'),
  openTerms: () => ipcRenderer.send('open-terms'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  reconnectAll: () => ipcRenderer.send('reconnect-all'),
  quitApp: () => ipcRenderer.send('quit-app'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  openObsSource: () => ipcRenderer.send('open-obs-source'),
  getObsUrl: () => ipcRenderer.sendSync('get-obs-url'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_e, status) => cb(status)),
  onShortcutStatus: (cb) => ipcRenderer.on('shortcut-status', (_e, status) => cb(status)),
  onShowSettings: (cb) => ipcRenderer.on('show-settings', () => cb()),
  onShowChangelog: (cb) => ipcRenderer.on('show-changelog', (_e, data) => cb(data)),
});
