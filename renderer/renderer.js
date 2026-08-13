const appEl = document.getElementById('app');
const chatEl = document.getElementById('chat');
const lockBtn = document.getElementById('lockBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settings');
const closeBtn = document.getElementById('closeBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');
const reconnectBtn = document.getElementById('reconnectBtn');
const statusRow = document.getElementById('statusRow');
const onboardingEl = document.getElementById('onboarding');

const fields = {
  twitch: document.getElementById('twitchInput'),
  kick: document.getElementById('kickInput'),
  youtube: document.getElementById('youtubeInput'),
  tiktok: document.getElementById('tiktokInput'),
  filterTwitch: document.getElementById('filterTwitch'),
  filterKick: document.getElementById('filterKick'),
  filterYoutube: document.getElementById('filterYoutube'),
  filterTiktok: document.getElementById('filterTiktok'),
  maxMessages: document.getElementById('maxMessagesInput'),
  ttl: document.getElementById('ttlInput'),
  throttle: document.getElementById('throttleInput'),
  timestamp: document.getElementById('timestampInput'),
  avatars: document.getElementById('avatarsInput'),
  events: document.getElementById('eventsInput'),
  style: document.getElementById('styleInput'),
  theme: document.getElementById('themeInput'),
  width: document.getElementById('widthInput'),
  height: document.getElementById('heightInput'),
  fontSize: document.getElementById('fontSizeInput'),
  opacity: document.getElementById('opacityInput'),
  spacing: document.getElementById('spacingInput'),
  startLocked: document.getElementById('startLockedInput'),
  saveHistory: document.getElementById('saveHistoryInput'),
};
const opacityValue = document.getElementById('opacityValue');

const platformColors = {
  twitch: '#9147ff',
  kick: '#53fc18',
  youtube: '#ff0000',
  tiktok: '#00f2ea',
};

const platformNames = {
  twitch: 'Twitch',
  kick: 'Kick',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const statusLabels = {
  connecting: '⋯ Conectando',
  connected: '✓ Conectado',
  unavailable: '⚠ Nenhuma live encontrada',
  error: '⚠ Erro na conexão',
  disconnected: '✕ Desconectado',
};

const eventLabels = {
  sub: '🎉 NOVO SUB',
  resub: '🎉 RESUB',
  gift: '🎁 GIFT',
  donation: '💰 DOAÇÃO',
  raid: '🚀 RAID',
  follow: '➕ NOVO FOLLOW',
  member: '⭐ MEMBRO',
};

let config = null;
let statusEls = {};
let messageQueue = [];
let messageThrottle = 0; // ms entre mensagens (0 = sem throttle)
let isProcessingQueue = false;

// Escapar HTML para evitar XSS, mas manter emojis
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Presets de onboarding ----------
const PRESETS = {
  simple: {
    display: { style: 'compact', theme: 'dark', maxMessages: 100, messageTTL: 0, showEvents: true, showAvatars: true },
    behavior: { startLocked: false },
  },
  overlay: {
    display: { style: 'compact', theme: 'transparent', opacity: 40, messageTTL: 20, showTimestamp: false },
    behavior: { startLocked: true },
  },
  full: {
    display: { style: 'cards', theme: 'gamer', maxMessages: 150, showEvents: true, showAvatars: true },
    behavior: { startLocked: false },
  },
  manual: {},
};

function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key]) && base[key]) {
      out[key] = deepMerge(base[key], override[key]);
    } else {
      out[key] = override[key];
    }
  }
  return out;
}

// ---------- Renderização de mensagens ----------
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;

  const msg = messageQueue.shift();
  renderMessage(msg);

  if (messageQueue.length > 0) {
    setTimeout(() => {
      isProcessingQueue = false;
      processMessageQueue();
    }, messageThrottle);
  } else {
    isProcessingQueue = false;
  }
}

function addMessage(msg) {
  if (messageThrottle > 0) {
    messageQueue.push(msg);
    processMessageQueue();
  } else {
    renderMessage(msg);
  }
}

function renderMessage(msg) {
  if (config && config.filters && config.filters[msg.platform] === false) return;
  if (msg.type !== 'chat' && config && !config.display.showEvents) return;

  const div = document.createElement('div');
  div.className = msg.type === 'chat' ? 'message' : 'message event event-' + msg.type;
  div.style.borderLeftColor = platformColors[msg.platform] || '#888';

  if (config && config.display.showAvatars && msg.avatar) {
    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = msg.avatar;
    div.appendChild(avatar);
  }

  const body = document.createElement('div');
  body.className = 'messageBody';

  const header = document.createElement('div');
  header.className = 'messageHeader';

  const badge = document.createElement('span');
  badge.className = 'platform-badge';
  badge.textContent = msg.platform;
  badge.style.background = platformColors[msg.platform] || '#888';
  header.appendChild(badge);

  if (msg.type !== 'chat') {
    const eventTag = document.createElement('span');
    eventTag.className = 'event-tag';
    eventTag.textContent = eventLabels[msg.type] || msg.type.toUpperCase();
    header.appendChild(eventTag);
  }

  const user = document.createElement('span');
  user.className = 'username';
  user.textContent = msg.displayName || msg.username;
  user.style.color = msg.color || '#fff';
  header.appendChild(user);

  if (config && config.display.showTimestamp) {
    const time = document.createElement('span');
    time.className = 'timestamp';
    time.textContent = formatTime(msg.timestamp);
    header.appendChild(time);
  }

  body.appendChild(header);

  const text = document.createElement('div');
  text.className = 'text';
  // Usar innerHTML para renderizar emojis corretamente
  text.innerHTML = escapeHtml(msg.message);
  body.appendChild(text);

  div.appendChild(body);
  chatEl.appendChild(div);

  const max = (config && config.display.maxMessages) || 100;
  while (chatEl.children.length > max) {
    chatEl.removeChild(chatEl.firstChild);
  }
  chatEl.scrollTop = chatEl.scrollHeight;

  const ttl = config && config.display.messageTTL;
  if (ttl && ttl > 0) {
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, ttl * 1000);
  }
}

window.api.onChatMessage(addMessage);

// ---------- Status por plataforma ----------
function ensureStatusEl(platform) {
  if (statusEls[platform]) return statusEls[platform];
  const el = document.createElement('span');
  el.className = 'status-dot status-' + platform;
  el.textContent = '●';
  el.title = platformNames[platform] + ': ' + statusLabels.disconnected;
  statusRow.appendChild(el);
  statusEls[platform] = el;
  return el;
}

function updateStatus(platform, status) {
  const el = ensureStatusEl(platform);
  el.className = 'status-dot status-' + platform + ' state-' + status;
  el.title = platformNames[platform] + ': ' + (statusLabels[status] || status);
}

window.api.onPlatformStatus(({ platform, status }) => updateStatus(platform, status));
['twitch', 'kick', 'youtube', 'tiktok'].forEach((p) => ensureStatusEl(p));

// ---------- Aparência ----------
function applyDisplaySettings(cfg) {
  appEl.classList.remove('theme-dark', 'theme-transparent', 'theme-minimal', 'theme-gamer');
  appEl.classList.add('theme-' + cfg.display.theme);

  appEl.classList.remove('style-compact', 'style-cards', 'style-bubble');
  appEl.classList.add('style-' + cfg.display.style);

  appEl.style.setProperty('--font-size', cfg.display.fontSize + 'px');
  appEl.style.setProperty('--msg-opacity', cfg.display.opacity / 100);
  appEl.style.setProperty('--msg-spacing', cfg.display.spacing + 'px');

  // Aplicar throttle de mensagens
  messageThrottle = cfg.display.messageThrottle || 0;
}

// ---------- Formulário de configurações ----------
function populateForm(cfg) {
  fields.twitch.value = cfg.channels.twitch || '';
  fields.kick.value = cfg.channels.kick || '';
  fields.youtube.value = cfg.channels.youtube || '';
  fields.tiktok.value = cfg.channels.tiktok || '';

  fields.filterTwitch.checked = cfg.filters.twitch;
  fields.filterKick.checked = cfg.filters.kick;
  fields.filterYoutube.checked = cfg.filters.youtube;
  fields.filterTiktok.checked = cfg.filters.tiktok;

  fields.maxMessages.value = String(cfg.display.maxMessages);
  fields.ttl.value = String(cfg.display.messageTTL);
  fields.throttle.value = String(cfg.display.messageThrottle || 0);
  fields.timestamp.checked = cfg.display.showTimestamp;
  fields.avatars.checked = cfg.display.showAvatars;
  fields.events.checked = cfg.display.showEvents;
  fields.style.value = cfg.display.style;
  fields.theme.value = cfg.display.theme;
  fields.width.value = cfg.display.width;
  fields.height.value = cfg.display.height;
  fields.fontSize.value = cfg.display.fontSize;
  fields.opacity.value = cfg.display.opacity;
  opacityValue.textContent = cfg.display.opacity;
  fields.spacing.value = cfg.display.spacing;

  fields.startLocked.checked = cfg.behavior.startLocked;
  fields.saveHistory.checked = cfg.behavior.saveHistory;
}

function collectForm() {
  return {
    channels: {
      twitch: fields.twitch.value.trim(),
      kick: fields.kick.value.trim(),
      youtube: fields.youtube.value.trim(),
      tiktok: fields.tiktok.value.trim(),
    },
    filters: {
      twitch: fields.filterTwitch.checked,
      kick: fields.filterKick.checked,
      youtube: fields.filterYoutube.checked,
      tiktok: fields.filterTiktok.checked,
    },
    display: {
      maxMessages: Number(fields.maxMessages.value),
      messageTTL: Number(fields.ttl.value),
      messageThrottle: Number(fields.throttle.value),
      showTimestamp: fields.timestamp.checked,
      showAvatars: fields.avatars.checked,
      showEvents: fields.events.checked,
      style: fields.style.value,
      theme: fields.theme.value,
      width: Number(fields.width.value),
      height: Number(fields.height.value),
      fontSize: Number(fields.fontSize.value),
      opacity: Number(fields.opacity.value),
      spacing: Number(fields.spacing.value),
    },
    behavior: {
      startLocked: fields.startLocked.checked,
      saveHistory: fields.saveHistory.checked,
    },
    onboarded: true,
  };
}

window.api.onLoadConfig((cfg) => {
  config = cfg;
  populateForm(config);
  applyDisplaySettings(config);
  if (!config.onboarded) {
    onboardingEl.classList.remove('hidden');
  }
});

window.api.onLockState((locked) => {
  document.body.classList.toggle('locked', locked);
  lockBtn.textContent = locked ? '🔒' : '🔓';

  // Sempre mostra aviso ao travar
  if (locked) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      font-size: 16px;
      text-align: center;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      border: 2px solid #6441a5;
    `;
    notification.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 10px;">🔒</div>
      <div style="font-weight: bold; margin-bottom: 8px;">Overlay Bloqueado</div>
      <div style="font-size: 14px; opacity: 0.9;">A janela está transparente aos cliques</div>
      <div style="margin-top: 12px; padding: 8px; background: rgba(100, 65, 165, 0.3); border-radius: 6px;">
        <strong>Para desbloquear:</strong><br>
        <code style="font-size: 18px; font-weight: bold; color: #ffd700;">Ctrl + Alt + L</code>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transition = 'opacity 0.5s';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  }
});

// ---------- Interações ----------
lockBtn.addEventListener('click', () => window.api.toggleLock());
closeBtn.addEventListener('click', () => window.api.quitApp());
settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
clearBtn.addEventListener('click', () => { chatEl.innerHTML = ''; });
reconnectBtn.addEventListener('click', () => window.api.reconnectAll());

fields.opacity.addEventListener('input', () => { opacityValue.textContent = fields.opacity.value; });

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (confirm('Deseja restaurar todas as configurações para os valores padrão?')) {
      window.api.resetConfig();
    }
  });
}

saveBtn.addEventListener('click', () => {
  const merged = deepMerge(config, collectForm());
  config = merged;
  window.api.saveConfig(config);
  applyDisplaySettings(config);
  settingsPanel.classList.add('hidden');
});

onboardingEl.querySelectorAll('.onboardOption').forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset] || {};
    config = deepMerge(config, preset);
    config.onboarded = true;
    populateForm(config);
    applyDisplaySettings(config);
    window.api.saveConfig(config);
    onboardingEl.classList.add('hidden');
    if (btn.dataset.preset === 'manual') {
      settingsPanel.classList.remove('hidden');
    }
  });
});
