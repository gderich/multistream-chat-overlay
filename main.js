const { app, BrowserWindow, ipcMain, globalShortcut, screen, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');

// Identidade do aplicativo no Windows: mantém o ícone correto na barra de tarefas.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.multistream.chatoverlay');
}

const { createConnectionManager } = require('./services/connection-manager');
const { createHistoryWriter } = require('./services/history-writer');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const OBS_PORT = 19191;
const SINGLE_INSTANCE = app.requestSingleInstanceLock();
if (!SINGLE_INSTANCE) {
  app.quit();
}

const DEFAULT_CONFIG = {
  channels: { twitch: '', kick: '', youtube: '', tiktok: '' },
  filters: { twitch: true, kick: true, youtube: true, tiktok: true },
  display: {
    maxMessages: 100,
    messageTTL: 0, // 0 = desabilitado
    messageThrottle: 0, // 0 = tempo real, >0 = ms entre mensagens
    style: 'compact', // compact | cards | bubble
    theme: 'dark', // dark | transparent | minimal | gamer
    width: 420,
    height: 640,
    fontSize: 13,
    opacity: 50,
    spacing: 4,
    showTimestamp: false,
    showAvatars: true,
    showEvents: true,
  },
  behavior: {
    startLocked: false,
    saveHistory: false,
    lockShortcut: 'CommandOrControl+Alt+L',
    notifications: {
      visual: true,
      visualStyle: 'soft',
      sound: false,
      soundVolume: 35,
      onlyWhenUnfocused: true,
    },
  },
  window: {
    x: null,
    y: null,
  },
  obs: {
    enabled: true,
    maxMessages: 100,
    fontSize: 16,
    opacity: 100,
    spacing: 6,
    padding: 8,
    showTimestamp: false,
    showAvatars: true,
    showEvents: true,
    messageBackground: 55,
    borderRadius: 6,
  },
  updates: {
    autoDownload: true,
  },
  // Doação é 100% opcional e não desbloqueia nada — o app é gratuito e
  // completo pra qualquer pessoa, com ou sem apoio.
  support: {
    linktree: 'https://linktr.ee/FalaDerix',
    pix: {
      // Código "copia e cola" de valor livre — usado no botão "Outro valor"
      // e como reserva pra qualquer valor fixo que ainda não tenha código
      // próprio abaixo. Deixe tudo vazio pra ocultar o QR e mostrar só as redes.
      livre: '00020126750014BR.GOV.BCB.PIX0114+55859969465510235Agradecimento pelo Multistream Chat5204000053039865802BR5925GABRIEL DERICH FREITAS AM6009SAO PAULO622605224yJQ4UeEipXpNGw2OZWFK06304A516',
      // Códigos de valor fixo, um por botão. Gerados no app do banco
      // escolhendo o valor exato (R$2, R$5, R$10, R$25) em vez de "livre".
      '2': '00020126700014BR.GOV.BCB.PIX0114+55859969465510230Agradecimento MultiStream Chat52040000530398654042.005802BR5925GABRIEL DERICH FREITAS AM6009SAO PAULO622605221DE7eMcFw2tGmf4RkxTiYy6304A6F1',
      '5': '00020126710014BR.GOV.BCB.PIX0114+55859969465510231Agradecimento MultiStream Chat 52040000530398654045.005802BR5925GABRIEL DERICH FREITAS AM6009SAO PAULO622605222p8gfDIcIAcewck9n8MBFs6304E5E1',
      '10': '00020126710014BR.GOV.BCB.PIX0114+55859969465510231Agradecimento MultiStream Chat 520400005303986540510.005802BR5925GABRIEL DERICH FREITAS AM6009SAO PAULO62260522141ZklNKegXKFS8ocDNVhN6304B229',
      '25': '00020126710014BR.GOV.BCB.PIX0114+55859969465510231Agradecimento MultiStream Chat 520400005303986540525.005802BR5925GABRIEL DERICH FREITAS AM6009SAO PAULO622605221AFYGOX0vzVUa6dbay8sAj6304E4E3',
    },
  },
  onboarded: false,
  lastSeenVersion: null,
};

let mainWindow;
let locked = true;
let currentConfig = DEFAULT_CONFIG;
let historyWriter = null;
let tray = null;
let obsServer = null;
let obsWss = null;
const obsMessages = [];

function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    if (
      override[key] && typeof override[key] === 'object' && !Array.isArray(override[key]) &&
      base[key] && typeof base[key] === 'object'
    ) {
      out[key] = deepMerge(base[key], override[key]);
    } else {
      out[key] = override[key];
    }
  }
  return out;
}

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    // Migração do config.json antigo (chaves twitch/kick/youtube/tiktok soltas).
    if (!raw.channels && (raw.twitch !== undefined || raw.kick !== undefined)) {
      const migrated = {
        channels: {
          twitch: raw.twitch || '',
          kick: raw.kick || '',
          youtube: raw.youtube || '',
          tiktok: raw.tiktok || '',
        },
      };
      return deepMerge(DEFAULT_CONFIG, migrated);
    }
    return deepMerge(DEFAULT_CONFIG, raw);
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function getSafeWindowPosition(cfg, w, h) {
  const displays = screen.getAllDisplays();
  if (Number.isFinite(cfg.window?.x) && Number.isFinite(cfg.window?.y)) {
    const x = cfg.window.x;
    const y = cfg.window.y;
    const visible = displays.some((d) => {
      const wa = d.workArea;
      return x < wa.x + wa.width && x + w > wa.x && y < wa.y + wa.height && y + h > wa.y;
    });
    if (visible) return { x, y };
  }
  const wa = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.max(0, wa.x + wa.width - w - 20),
    y: Math.max(0, wa.y + 40),
  };
}

function persistWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [x, y] = mainWindow.getPosition();
  const [width, height] = mainWindow.getSize();
  currentConfig.display.width = width;
  currentConfig.display.height = height;
  currentConfig.window = { x, y };
  saveConfig(currentConfig);
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Multistream Chat Overlay');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar chat', click: () => showMainWindow() },
    { label: 'Configurações', click: () => { showMainWindow(); mainWindow.webContents.send('show-settings'); } },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]));
  tray.on('double-click', showMainWindow);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
}

function createWindow(cfg) {
  const w = cfg.display.width;
  const h = cfg.display.height;
  const pos = getSafeWindowPosition(cfg, w, h);

  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, 'assets', 'icon.png'),
    width: w,
    height: h,
    x: pos.x,
    y: pos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setContentProtection(true);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => setTimeout(maybeShowChangelog, 500));

  mainWindow.on('move', persistWindowBounds);
  mainWindow.on('resize', persistWindowBounds);
  mainWindow.on('close', persistWindowBounds);
  mainWindow.on('closed', () => { mainWindow = null; });

  registerShortcuts();
  createTray();
}

let registeredLockShortcut = null;

function registerShortcuts() {
  // Remove explicitamente o atalho anterior antes de registrar o novo.
  // Isso evita que uma hotkey antiga continue ativa quando o usuário troca
  // a combinação e depois volta para a combinação padrão.
  if (registeredLockShortcut) {
    try {
      globalShortcut.unregister(registeredLockShortcut);
    } catch (_) {}
    registeredLockShortcut = null;
  }

  const lockShortcut = currentConfig.behavior?.lockShortcut || 'CommandOrControl+Alt+L';
  const registered = globalShortcut.register(lockShortcut, () => setLocked(!locked));
  if (registered) {
    registeredLockShortcut = lockShortcut;
  }
  if (!registered && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcut-status', {
      ok: false,
      shortcut: lockShortcut,
      message: 'Não foi possível registrar este atalho. Ele pode estar sendo usado por outro programa.'
    });
  }

  globalShortcut.register('CommandOrControl+Alt+Up', () => resizeWindow(20));
  globalShortcut.register('CommandOrControl+Alt+Down', () => resizeWindow(-20));

  globalShortcut.register('CommandOrControl+Alt+R', () => {
    connectionManager.stopAll();
    connectionManager.startAll(currentConfig.channels);
  });
}

function resizeWindow(delta) {
  if (!mainWindow) return;
  const [w, h] = mainWindow.getSize();
  const newW = Math.max(260, w + delta);
  const newH = Math.max(200, h + Math.round(delta * (h / w)));
  mainWindow.setSize(newW, newH);
  currentConfig.display.width = newW;
  currentConfig.display.height = newH;
  persistWindowBounds();
}

function setLocked(value) {
  locked = value;
  mainWindow.setIgnoreMouseEvents(locked, { forward: true });
  mainWindow.webContents.send('lock-state', locked);
}

function pushMessage(msg) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat-message', msg);
  }
  if (historyWriter) historyWriter.write(msg);
  if (!currentConfig.filters || currentConfig.filters[msg.platform] !== false) {
    obsMessages.push(msg);
    const max = currentConfig.display?.maxMessages || 100;
    while (obsMessages.length > max) obsMessages.shift();
    broadcastObs(msg);
  }
}

function pushStatus(platform, status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('platform-status', { platform, status });
  }
}

function applyHistorySetting(cfg) {
  if (cfg.behavior.saveHistory && !historyWriter) {
    historyWriter = createHistoryWriter(__dirname);
  } else if (!cfg.behavior.saveHistory && historyWriter) {
    historyWriter.close();
    historyWriter = null;
  }
}

const connectionManager = createConnectionManager({
  onMessage: pushMessage,
  onStatus: pushStatus,
});

app.on('second-instance', () => showMainWindow());


function maybeShowChangelog() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const currentVersion = app.getVersion();
  // Only show automatically for an existing installation that has already
  // completed onboarding and has not yet acknowledged this version.
  if (currentConfig.onboarded && currentConfig.lastSeenVersion !== currentVersion) {
    mainWindow.webContents.send('show-changelog', {
      version: currentVersion,
      changes: [
        'Novas notificações de mensagens, com destaque visual suave.',
        'Som de nova mensagem opcional, com controle de volume.',
        'Opção para tocar o som somente quando o chat não estiver em foco.',
        'Animação e comportamento das notificações podem ser ajustados em Configurações → Notificações.',
        'Novo tutorial de primeiro uso, com orientação sobre canais, personalização, bloqueio, OBS, notificações e atualizações.',
      ],
    });
    currentConfig.lastSeenVersion = currentVersion;
    saveConfig(currentConfig);
  }
}

function checkForUpdates(manual = false) {
  if (!currentConfig.updates?.autoDownload && !manual) return;
  autoUpdater.checkForUpdates();
}

function createObsServer() {
  obsServer = http.createServer((req, res) => {
    if (req.url === '/obs') {
      const html = fs.readFileSync(path.join(__dirname, 'renderer', 'obs.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    res.writeHead(404);
    res.end('Not found');
  });
  obsWss = new WebSocketServer({ server: obsServer });
  obsWss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'init', config: currentConfig.obs || DEFAULT_CONFIG.obs, messages: obsMessages }));
    ws.on('error', () => {});
  });
  obsServer.on('error', (err) => {
    console.error('Servidor OBS:', err.message);
  });
  obsServer.listen(OBS_PORT, '127.0.0.1');
}

function broadcastObs(msg) {
  if (!obsWss) return;
  if (currentConfig.obs?.enabled === false) return;
  for (const client of obsWss.clients) {
    if (client.readyState === 1) client.send(JSON.stringify({ type: 'message', message: msg }));
  }
}

app.whenReady().then(() => {
  currentConfig = loadConfig();
  autoUpdater.autoDownload = currentConfig.updates?.autoDownload !== false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Atualização disponível',
      message: 'Uma nova versão foi baixada. O aplicativo será reiniciado para instalá-la.',
      buttons: ['Reiniciar e instalar', 'Depois']
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('update-available', () => mainWindow?.webContents.send('update-status', 'available'));
  autoUpdater.on('update-not-available', () => mainWindow?.webContents.send('update-status', 'latest'));
  autoUpdater.on('error', (err) => mainWindow?.webContents.send('update-status', 'error:' + (err?.message || 'erro desconhecido')));

  createObsServer();
  createWindow(currentConfig);

  mainWindow.webContents.once('did-finish-load', () => {
    // Começa destravado (barra de título visível) pra você conseguir ver
    // que o app abriu e configurar os canais — a menos que "Iniciar sempre
    // bloqueado" esteja marcado. Trave/destrave com Ctrl+Alt+L.
    setLocked(currentConfig.behavior.startLocked);
    mainWindow.webContents.send('load-config', currentConfig);
    applyHistorySetting(currentConfig);
    connectionManager.startAll(currentConfig.channels);
    if (currentConfig.updates?.autoDownload !== false) checkForUpdates(false);
  });
});

ipcMain.on('open-terms', () => {
  shell.openExternal('https://github.com/gderich/multistream-chat-overlay/blob/main/TERMS.md');
});

// Usado pelo painel "Apoiar" (link do Linktree/redes). Só abre http(s), no
// navegador padrão do sistema — nunca dentro do próprio overlay.
ipcMain.on('open-external', (event, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

ipcMain.on('reset-config', () => {
  currentConfig = deepMerge({}, DEFAULT_CONFIG);
  saveConfig(currentConfig);
  mainWindow.webContents.send('load-config', currentConfig);
  applyHistorySetting(currentConfig);
  connectionManager.stopAll();
  connectionManager.startAll(currentConfig.channels);
});

ipcMain.on('toggle-lock', () => setLocked(!locked));

ipcMain.on('save-config', (event, cfg) => {
  const merged = deepMerge(DEFAULT_CONFIG, cfg);
  if (merged.onboarded && !merged.lastSeenVersion) merged.lastSeenVersion = app.getVersion();
  const channelsChanged = JSON.stringify(merged.channels) !== JSON.stringify(currentConfig.channels);
  currentConfig = merged;
  saveConfig(currentConfig);
  registerShortcuts();
  autoUpdater.autoDownload = currentConfig.updates?.autoDownload !== false;
  autoUpdater.autoInstallOnAppQuit = true;
  applyHistorySetting(currentConfig);
  if (channelsChanged) {
    connectionManager.stopAll();
    connectionManager.startAll(currentConfig.channels);
  }
});

ipcMain.on('reconnect-all', () => {
  connectionManager.stopAll();
  connectionManager.startAll(currentConfig.channels);
});

ipcMain.on('check-for-updates', () => checkForUpdates(true));
ipcMain.on('open-obs-source', () => shell.openExternal(`http://127.0.0.1:${OBS_PORT}/obs`));
ipcMain.on('get-obs-url', (event) => event.returnValue = `http://127.0.0.1:${OBS_PORT}/obs`);
ipcMain.on('quit-app', () => app.quit());

app.on('window-all-closed', () => {
  if (registeredLockShortcut) {
    try { globalShortcut.unregister(registeredLockShortcut); } catch (_) {}
    registeredLockShortcut = null;
  }
  globalShortcut.unregisterAll();
  connectionManager.stopAll();
  if (historyWriter) historyWriter.close();
  if (obsServer) obsServer.close();
  if (tray) tray.destroy();
  app.quit();
});
