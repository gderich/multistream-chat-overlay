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
const obsUrlInput = document.getElementById('obsUrlInput');
const copyObsBtn = document.getElementById('copyObsBtn');
const openObsBtn = document.getElementById('openObsBtn');
const autoUpdateInput = document.getElementById('autoUpdateInput');
const obsEnabledInput = document.getElementById('obsEnabledInput');
const obsMaxMessagesInput = document.getElementById('obsMaxMessagesInput');
const obsFontSizeInput = document.getElementById('obsFontSizeInput');
const obsSpacingInput = document.getElementById('obsSpacingInput');
const obsBackgroundInput = document.getElementById('obsBackgroundInput');
const obsOpacityInput = document.getElementById('obsOpacityInput');
const obsRadiusInput = document.getElementById('obsRadiusInput');
const obsAvatarsInput = document.getElementById('obsAvatarsInput');
const obsTimestampInput = document.getElementById('obsTimestampInput');
const obsEventsInput = document.getElementById('obsEventsInput');
const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
const updateStatusEl = document.getElementById('updateStatus');

const donateBtn = document.getElementById('donateBtn');
const donatePanel = document.getElementById('donate');
const donateCloseBtn = document.getElementById('donateCloseBtn');
const amountRow = document.getElementById('amountRow');
const outroBtn = document.getElementById('outroBtn');
const amountHint = document.getElementById('amountHint');
const pixQrCode = document.getElementById('pixQrCode');
const pixQrWrap = document.getElementById('pixQrWrap');
const pixEmptyState = document.getElementById('pixEmptyState');
const pixCodeRow = document.getElementById('pixCodeRow');
const pixCodeInput = document.getElementById('pixCodeInput');
const copyPixBtn = document.getElementById('copyPixBtn');
const followBtn = document.getElementById('followBtn');
const lockShortcutInput = document.getElementById('lockShortcutInput');
const recordShortcutBtn = document.getElementById('recordShortcutBtn');
const shortcutStatusEl = document.getElementById('shortcutStatus');
const notificationVisualInput = document.getElementById('notificationVisualInput');
const notificationStyleInput = document.getElementById('notificationStyleInput');
const notificationSoundInput = document.getElementById('notificationSoundInput');
const notificationVolumeInput = document.getElementById('notificationVolumeInput');
const notificationVolumeValue = document.getElementById('notificationVolumeValue');
const notificationUnfocusedInput = document.getElementById('notificationUnfocusedInput');
const testNotificationSoundBtn = document.getElementById('testNotificationSoundBtn');
const changelogModal = document.getElementById('changelogModal');
const changelogVersion = document.getElementById('changelogVersion');
const changelogList = document.getElementById('changelogList');
const changelogCloseBtn = document.getElementById('changelogCloseBtn');
const moreBtn = document.getElementById('moreBtn');
const compactMenu = document.getElementById('compactMenu');

const donateBanner = document.getElementById('donateBanner');
const donateBannerBtn = document.getElementById('donateBannerBtn');
const donateBannerClose = document.getElementById('donateBannerClose');

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
  autoUpdate: document.getElementById('autoUpdateInput'),
  lockShortcut: document.getElementById('lockShortcutInput'),
  notificationVisual: notificationVisualInput,
  notificationStyle: notificationStyleInput,
  notificationSound: notificationSoundInput,
  notificationVolume: notificationVolumeInput,
  notificationUnfocused: notificationUnfocusedInput,
};
const opacityValue = document.getElementById('opacityValue');
const eventFilterInputs = [...document.querySelectorAll('[data-event-filter]')];

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
  like: '❤️ LIKES',
  share: '🔁 SHARE',
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

// Renderiza os emotes nativos da Twitch como imagens. O tmi.js fornece
// os intervalos no formato start-end; assim evitamos substituir palavras
// comuns por engano e preservamos o texto restante exatamente como chegou.
function renderMessageContent(container, message, emotes, platform) {
  const text = String(message || '');
  const ranges = [];

  if (platform === 'twitch' && emotes && typeof emotes === 'object') {
    for (const [id, positions] of Object.entries(emotes)) {
      for (const position of positions || []) {
        const match = String(position).match(/^(\d+)-(\d+)$/);
        if (!match) continue;
        ranges.push({ id, start: Number(match[1]), end: Number(match[2]) });
      }
    }
  }

  ranges.sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor || range.start >= text.length) continue;
    if (range.start > cursor) {
      container.appendChild(document.createTextNode(text.slice(cursor, range.start)));
    }

    const emoteText = text.slice(range.start, range.end + 1);
    const img = document.createElement('img');
    img.className = 'chat-emote';
    img.alt = emoteText;
    img.title = emoteText;
    img.loading = 'lazy';
    img.src = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(range.id)}/default/dark/2.0`;
    img.onerror = () => {
      const fallback = document.createTextNode(emoteText);
      img.replaceWith(fallback);
    };
    container.appendChild(img);
    cursor = range.end + 1;
  }

  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.slice(cursor)));
  }
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


let audioContext = null;
function playNotificationSound() {
  const volume = Math.max(0, Math.min(100, Number(config?.behavior?.notifications?.soundVolume ?? 35))) / 100;
  if (volume <= 0) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.075);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08 * volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch (_) {}
}

function shouldNotifyNewMessage(msg) {
  if (!config?.behavior?.notifications || msg.type !== 'chat') return false;
  if (config.behavior.notifications.visual && !config.behavior.notifications.onlyWhenUnfocused ||
      config.behavior.notifications.visual && config.behavior.notifications.onlyWhenUnfocused && !document.hasFocus()) return true;
  if (config.behavior.notifications.sound &&
      (!config.behavior.notifications.onlyWhenUnfocused || !document.hasFocus())) playNotificationSound();
  return false;
}

function renderMessage(msg) {
  if (config && config.filters && config.filters[msg.platform] === false) return;
  if (msg.type !== 'chat') {
    if (config && !config.display.showEvents) return;
    const eventFilters = config?.display?.eventFilters || {};
    if (eventFilters[msg.type] === false) return;
  }

  const div = document.createElement('div');
  div.className = msg.type === 'chat' ? 'message' : 'message event event-' + msg.type;
  const notifications = config?.behavior?.notifications || {};
  const isNotifiable = msg.type === 'chat' || ['follow','sub','resub','gift','donation','raid','member','like','share'].includes(msg.type);
  const notifyVisual = isNotifiable && notifications.visual && (!notifications.onlyWhenUnfocused || !document.hasFocus());
  if (notifyVisual) div.classList.add('new-message', 'new-message-' + (notifications.visualStyle || 'soft'));
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
  renderMessageContent(text, msg.message, msg.emotes, msg.platform);
  body.appendChild(text);

  div.appendChild(body);
  chatEl.appendChild(div);

  if (isNotifiable && config?.behavior?.notifications?.sound &&
      (!config.behavior.notifications.onlyWhenUnfocused || !document.hasFocus())) {
    playNotificationSound();
  }

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


const emoteStyle = document.createElement('style');
emoteStyle.textContent = `.chat-emote{display:inline-block;width:auto;height:1.6em;max-width:5em;vertical-align:middle;object-fit:contain;margin:0 .06em}`;
document.head.appendChild(emoteStyle);

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
function formatShortcut(accelerator) {
  return String(accelerator || '')
    .replace(/CommandOrControl/g, 'Ctrl')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, 'Ctrl')
    .replace(/Alt/g, 'Alt')
    .replace(/Shift/g, 'Shift')
    .replace(/Plus/g, '+')
    .replace(/Left/g, '←')
    .replace(/Right/g, '→')
    .replace(/Up/g, '↑')
    .replace(/Down/g, '↓')
    .split('+').join(' + ');
}

function keyToAccelerator(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('CommandOrControl');
  if (event.metaKey && !event.ctrlKey) parts.push('Command');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  let key = event.key;
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (/^F([1-9]|1[0-2])$/.test(key)) key = key.toUpperCase();
  else {
    const map = {
      ' ': 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
      ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
      Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown'
    };
    key = map[key] || key;
  }

  if (['Control','Alt','Shift','Meta'].includes(key)) return null;
  if (!parts.length) return { error: 'Use Ctrl, Alt ou Shift junto com a tecla.' };
  if (!key || key.length > 1 && !/^(F([1-9]|1[0-2])|Space|Esc|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right)$/.test(key)) {
    return { error: 'Esta tecla não pode ser usada neste atalho.' };
  }
  return { accelerator: [...parts, key].join('+') };
}

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
  const eventFilters = cfg.display?.eventFilters || {};
  eventFilterInputs.forEach((input) => { input.checked = eventFilters[input.dataset.eventFilter] !== false; });
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
  fields.lockShortcut.value = formatShortcut(cfg.behavior?.lockShortcut || 'CommandOrControl+Alt+L');
  fields.lockShortcut.dataset.accelerator = cfg.behavior?.lockShortcut || 'CommandOrControl+Alt+L';
  const notifications = cfg.behavior?.notifications || {};
  notificationVisualInput.checked = notifications.visual !== false;
  notificationStyleInput.value = notifications.visualStyle || 'soft';
  notificationSoundInput.checked = notifications.sound === true;
  notificationVolumeInput.value = notifications.soundVolume ?? 35;
  notificationVolumeValue.textContent = notificationVolumeInput.value + '%';
  notificationUnfocusedInput.checked = notifications.onlyWhenUnfocused !== false;
  fields.autoUpdate.checked = cfg.updates?.autoDownload !== false;
  const obs = cfg.obs || {};
  obsEnabledInput.checked = obs.enabled !== false;
  obsMaxMessagesInput.value = obs.maxMessages ?? 100;
  obsFontSizeInput.value = obs.fontSize ?? 16;
  obsSpacingInput.value = obs.spacing ?? 6;
  obsBackgroundInput.value = obs.messageBackground ?? 55;
  obsOpacityInput.value = obs.opacity ?? 100;
  obsRadiusInput.value = obs.borderRadius ?? 6;
  obsAvatarsInput.checked = obs.showAvatars !== false;
  obsTimestampInput.checked = obs.showTimestamp === true;
  obsEventsInput.checked = obs.showEvents !== false;
  obsUrlInput.value = window.api.getObsUrl();
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
      eventFilters: Object.fromEntries(eventFilterInputs.map((input) => [input.dataset.eventFilter, input.checked])),
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
      lockShortcut: fields.lockShortcut.dataset.accelerator || 'CommandOrControl+Alt+L',
      notifications: {
        visual: notificationVisualInput.checked,
        visualStyle: notificationStyleInput.value,
        sound: notificationSoundInput.checked,
        soundVolume: Number(notificationVolumeInput.value),
        onlyWhenUnfocused: notificationUnfocusedInput.checked,
      },
    },
    obs: {
      enabled: obsEnabledInput.checked,
      maxMessages: Number(obsMaxMessagesInput.value),
      fontSize: Number(obsFontSizeInput.value),
      opacity: Number(obsOpacityInput.value),
      spacing: Number(obsSpacingInput.value),
      padding: 8,
      showTimestamp: obsTimestampInput.checked,
      showAvatars: obsAvatarsInput.checked,
      showEvents: obsEventsInput.checked,
      messageBackground: Number(obsBackgroundInput.value),
      borderRadius: Number(obsRadiusInput.value),
    },
    updates: {
      autoDownload: fields.autoUpdate.checked,
    },
    onboarded: true,
  };
}

// ---------- Apoiar / doações ----------
let currentPix = {}; // { livre, '2', '5', '10', '25' }

function drawQr(code) {
  pixQrCode.innerHTML = '';
  if (window.QRCode && code) {
    // eslint-disable-next-line no-new
    new window.QRCode(pixQrCode, {
      text: code,
      width: 180,
      height: 180,
      colorDark: '#000000',
      colorLight: '#ffffff',
    });
  }
}

// key: 'livre' | '2' | '5' | '10' | '25'
function selectPix(key) {
  const hasAny = Object.values(currentPix).some((c) => (c || '').trim());
  if (!hasAny) {
    pixQrWrap.classList.add('hidden');
    pixCodeRow.classList.add('hidden');
    pixEmptyState.classList.remove('hidden');
    return;
  }

  pixEmptyState.classList.add('hidden');

  const specific = (currentPix[key] || '').trim();
  const fallback = (currentPix.livre || '').trim();
  const code = specific || fallback;

  if (!code) {
    pixQrWrap.classList.add('hidden');
    pixCodeRow.classList.add('hidden');
    return;
  }

  pixQrWrap.classList.remove('hidden');
  pixCodeRow.classList.remove('hidden');
  drawQr(code);
  pixCodeInput.value = code;

  amountRow.querySelectorAll('.amountChip').forEach((c) => c.classList.remove('selected'));
  outroBtn.classList.remove('selected');

  if (key === 'livre') {
    outroBtn.classList.add('selected');
    amountHint.textContent = 'Valor livre — escaneie ou copie o código e informe o valor que quiser no seu app do banco.';
  } else {
    const chip = amountRow.querySelector(`.amountChip[data-amount="${key}"]`);
    if (chip) chip.classList.add('selected');
    if (specific) {
      amountHint.textContent = `QR de R$ ${key} pronto — é só escanear ou copiar o código abaixo.`;
    } else {
      amountHint.textContent = `Ainda não tem QR específico de R$ ${key} — usando o código de valor livre. Informe R$ ${key} manualmente no banco.`;
    }
  }
}

function renderDonatePanel(cfg) {
  const support = (cfg && cfg.support) || {};
  currentPix = support.pix || {};
  followBtn.dataset.url = support.linktree || 'https://linktr.ee/FalaDerix';
  selectPix('livre');
}

donateBtn.addEventListener('click', () => donatePanel.classList.toggle('hidden'));
donateCloseBtn.addEventListener('click', () => donatePanel.classList.add('hidden'));

donateBannerBtn.addEventListener('click', () => {
  donatePanel.classList.remove('hidden');
  donateBanner.classList.add('hidden');
});
donateBannerClose.addEventListener('click', () => donateBanner.classList.add('hidden'));

amountRow.querySelectorAll('.amountChip').forEach((chip) => {
  chip.addEventListener('click', () => selectPix(chip.dataset.amount));
});
outroBtn.addEventListener('click', () => selectPix('livre'));

copyPixBtn.addEventListener('click', async () => {
  const code = pixCodeInput.value;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
  } catch (e) {
    pixCodeInput.select();
    document.execCommand('copy');
  }
  const original = copyPixBtn.textContent;
  copyPixBtn.textContent = 'Copiado! ✓';
  setTimeout(() => { copyPixBtn.textContent = original; }, 1800);
});

followBtn.addEventListener('click', () => {
  window.api.openExternal(followBtn.dataset.url || 'https://linktr.ee/FalaDerix');
});

window.api.onLoadConfig((cfg) => {
  config = cfg;
  populateForm(config);
  applyDisplaySettings(config);
  renderDonatePanel(config);
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
        <code id="lockShortcutHint" style="font-size: 18px; font-weight: bold; color: #ffd700;">${formatShortcut(config.behavior?.lockShortcut || 'CommandOrControl+Alt+L')}</code>
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

// ---------- Atalho de travar/destravar ----------
let recordingShortcut = false;
recordShortcutBtn.addEventListener('click', () => {
  recordingShortcut = !recordingShortcut;
  recordShortcutBtn.textContent = recordingShortcut ? 'Pressione...' : 'Alterar';
  lockShortcutInput.classList.toggle('recording', recordingShortcut);
  shortcutStatusEl.textContent = recordingShortcut
    ? 'Pressione a combinação desejada agora.'
    : 'Clique em Alterar e pressione a combinação desejada.';
});

window.addEventListener('keydown', (event) => {
  if (!recordingShortcut) return;
  event.preventDefault();
  event.stopPropagation();
  const result = keyToAccelerator(event);
  if (!result?.accelerator) {
    shortcutStatusEl.textContent = result?.error || 'Combinação inválida.';
    return;
  }
  lockShortcutInput.dataset.accelerator = result.accelerator;
  lockShortcutInput.value = formatShortcut(result.accelerator);
  recordingShortcut = false;
  recordShortcutBtn.textContent = 'Alterar';
  lockShortcutInput.classList.remove('recording');
  shortcutStatusEl.textContent = 'Novo atalho definido. Clique em “Salvar e conectar” para aplicar.';
}, true);

window.api.onShortcutStatus((status) => {
  if (!status?.ok) {
    shortcutStatusEl.textContent = status.message || 'Não foi possível registrar o atalho.';
    shortcutStatusEl.style.color = '#ff7676';
  } else {
    shortcutStatusEl.style.color = '';
  }
});

// ---------- Menu compacto ----------
function closeCompactMenu() { compactMenu.classList.add('hidden'); }
moreBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  compactMenu.classList.toggle('hidden');
});
compactMenu.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  closeCompactMenu();
  const actions = {
    clear: () => clearBtn.click(),
    reconnect: () => reconnectBtn.click(),
    donate: () => donateBtn.click(),
    settings: () => settingsBtn.click(),
    lock: () => lockBtn.click(),
    close: () => closeBtn.click(),
  };
  actions[button.dataset.action]?.();
});
document.addEventListener('click', (event) => {
  if (!compactMenu.contains(event.target) && event.target !== moreBtn) closeCompactMenu();
});

// ---------- Interações ----------
lockBtn.addEventListener('click', () => window.api.toggleLock());
closeBtn.addEventListener('click', () => window.api.quitApp());
settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
clearBtn.addEventListener('click', () => { chatEl.innerHTML = ''; });
reconnectBtn.addEventListener('click', () => window.api.reconnectAll());

copyObsBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(obsUrlInput.value);
  copyObsBtn.textContent = 'Copiado!';
  setTimeout(() => { copyObsBtn.textContent = 'Copiar'; }, 1500);
});
openObsBtn.addEventListener('click', () => window.api.openObsSource());
checkUpdatesBtn.addEventListener('click', () => {
  updateStatusEl.textContent = 'Procurando uma nova versão no GitHub...';
  window.api.checkForUpdates();
});
window.api.onUpdateStatus((status) => {
  if (status === 'available') updateStatusEl.textContent = 'Nova versão encontrada. O download será iniciado automaticamente.';
  else if (status === 'latest') updateStatusEl.textContent = 'Você já está usando a versão mais recente.';
  else if (status.startsWith('error:')) updateStatusEl.textContent = 'Não foi possível verificar agora. Tente novamente mais tarde.';
});
window.api.onShowSettings(() => settingsPanel.classList.remove('hidden'));
window.api.onShowChangelog(({ version, changes }) => {
  changelogVersion.textContent = 'Versão ' + version;
  changelogList.innerHTML = '';
  (changes || []).forEach((change) => {
    const li = document.createElement('li');
    li.textContent = change;
    changelogList.appendChild(li);
  });
  changelogModal.classList.remove('hidden');
});
changelogCloseBtn.addEventListener('click', () => changelogModal.classList.add('hidden'));
const changelogDoneBtn = document.getElementById('changelogDoneBtn');
changelogDoneBtn.addEventListener('click', () => changelogModal.classList.add('hidden'));

fields.opacity.addEventListener('input', () => { opacityValue.textContent = fields.opacity.value; });
notificationVolumeInput.addEventListener('input', () => { notificationVolumeValue.textContent = notificationVolumeInput.value + '%'; });
testNotificationSoundBtn.addEventListener('click', () => playNotificationSound());

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

// ---------- Tutorial de primeiro uso ----------
const onboardSteps = [...onboardingEl.querySelectorAll('.onboardStep')];
const onboardNext = document.getElementById('onboardNext');
const onboardBack = document.getElementById('onboardBack');
const onboardSkip = document.getElementById('onboardSkip');
const onboardStepLabel = document.getElementById('onboardStepLabel');
const onboardProgressFill = document.getElementById('onboardProgressFill');
const acceptTerms = document.getElementById('acceptTerms');
let onboardStep = 1;

function updateOnboardingStep() {
  onboardSteps.forEach((el) => el.classList.toggle('hidden', Number(el.dataset.step) !== onboardStep));
  onboardStepLabel.textContent = `${onboardStep} de ${onboardSteps.length}`;
  onboardProgressFill.style.width = `${(onboardStep / onboardSteps.length) * 100}%`;
  onboardBack.disabled = onboardStep === 1;
  onboardNext.disabled = !acceptTerms.checked;
  onboardNext.textContent = onboardStep === onboardSteps.length ? 'Concluir' : (onboardStep === 1 ? 'Começar' : 'Próximo');
}

acceptTerms.addEventListener('change', updateOnboardingStep);
onboardNext.addEventListener('click', () => {
  if (!acceptTerms.checked) return;
  if (onboardStep < onboardSteps.length) {
    onboardStep += 1;
    updateOnboardingStep();
  }
});
onboardBack.addEventListener('click', () => {
  if (onboardStep > 1) { onboardStep -= 1; updateOnboardingStep(); }
});
onboardSkip.addEventListener('click', () => {
  config.onboarded = true;
  window.api.saveConfig(config);
  onboardingEl.classList.add('hidden');
});

onboardingEl.querySelectorAll('.onboardOption').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!acceptTerms.checked) return;
    const preset = PRESETS[btn.dataset.preset] || {};
    config = deepMerge(config, preset);
    config.onboarded = true;
    populateForm(config);
    applyDisplaySettings(config);
    window.api.saveConfig(config);
    onboardingEl.classList.add('hidden');
    if (btn.dataset.preset === 'manual') settingsPanel.classList.remove('hidden');
  });
});

updateOnboardingStep();
