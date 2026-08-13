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
  reconnectAll: () => ipcRenderer.send('reconnect-all'),
  quitApp: () => ipcRenderer.send('quit-app'),
});
