const { app, BrowserWindow, ipcMain, globalShortcut, screen, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const { createConnectionManager } = require('./services/connection-manager');
const { createHistoryWriter } = require('./services/history-writer');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

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
};

let mainWindow;
let locked = true;
let currentConfig = DEFAULT_CONFIG;
let historyWriter = null;

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

function createWindow(cfg) {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const w = cfg.display.width;
  const h = cfg.display.height;

  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    x: screenWidth - w - 20,
    y: 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Exclui a janela de qualquer captura de tela no Windows (Display Capture
  // do OBS não vai enxergá-la).
  mainWindow.setContentProtection(true);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  registerShortcuts();
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Alt+L', () => setLocked(!locked));

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
  saveConfig(currentConfig);
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

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Atualização Disponível',
      message: 'Uma nova versão foi baixada. O aplicativo será reiniciado para instalá-la.',
      buttons: ['Reiniciar e Instalar']
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });

  currentConfig = loadConfig();
  createWindow(currentConfig);

  mainWindow.webContents.once('did-finish-load', () => {
    // Começa destravado (barra de título visível) pra você conseguir ver
    // que o app abriu e configurar os canais — a menos que "Iniciar sempre
    // bloqueado" esteja marcado. Trave/destrave com Ctrl+Alt+L.
    setLocked(currentConfig.behavior.startLocked);
    mainWindow.webContents.send('load-config', currentConfig);
    applyHistorySetting(currentConfig);
    connectionManager.startAll(currentConfig.channels);
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
  const channelsChanged = JSON.stringify(merged.channels) !== JSON.stringify(currentConfig.channels);
  currentConfig = merged;
  saveConfig(currentConfig);
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

ipcMain.on('quit-app', () => app.quit());

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  connectionManager.stopAll();
  if (historyWriter) historyWriter.close();
  app.quit();
});
