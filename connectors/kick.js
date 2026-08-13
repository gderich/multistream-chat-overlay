const WebSocket = require('ws');
const { createRetrier } = require('../services/reconnect-manager');

// Chave pública do app Pusher que o kick.com usa no próprio site para o chat.
// A Kick não expõe API oficial pra isso; se parar de funcionar, essa chave
// pode ter mudado (procure "kick pusher app key" em projetos open-source
// atualizados, ex: repositórios de bots/overlays pra Kick no GitHub). Isso é
// o conector mais frágil do app — foi isolado aqui de propósito para que uma
// eventual quebra não afete Twitch/YouTube/TikTok.
const PUSHER_APP_KEY = '32cbd69e4b950bf97679';
const PUSHER_CLUSTER = 'us2';
const PUSHER_CLIENT_VERSION = '8.4.0-rc2';
const KICK_ORIGIN = 'https://kick.com';

class KickLookupError extends Error {
  constructor(message, { status = 'error', retry = true, statusCode = null } = {}) {
    super(message);
    this.status = status;
    this.retry = retry;
    this.statusCode = statusCode;
  }
}

function normalizeKickSlug(input) {
  let value = String(input || '').trim();
  if (!value) throw new KickLookupError('Canal Kick vazio.', { status: 'unavailable', retry: false });

  if (/^https?:\/\//i.test(value) || /^www\.kick\.com\//i.test(value) || /^kick\.com\//i.test(value)) {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    let url;
    try {
      url = new URL(withProtocol);
    } catch (e) {
      throw new KickLookupError(`URL da Kick inválida: ${input}`, { status: 'unavailable', retry: false });
    }

    const host = url.hostname.toLowerCase();
    if (host !== 'kick.com' && host !== 'www.kick.com') {
      throw new KickLookupError(`URL não é da Kick: ${url.hostname}`, { status: 'unavailable', retry: false });
    }

    value = decodeURIComponent(url.pathname.split('/').filter(Boolean)[0] || '');
  }

  value = value.replace(/^@+/, '').split(/[?#]/)[0].split('/').filter(Boolean)[0] || '';
  if (!value) throw new KickLookupError('Não consegui identificar o canal da Kick.', { status: 'unavailable', retry: false });
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    throw new KickLookupError(`Canal Kick inválido: ${value}`, { status: 'unavailable', retry: false });
  }

  return value;
}

function getElectron() {
  try {
    return require('electron');
  } catch (e) {
    return null;
  }
}

function getElectronNet() {
  const electron = getElectron();
  return electron && electron.net && typeof electron.net.fetch === 'function' ? electron.net : null;
}

// A Kick colocou o endpoint kick.com/api/v2/channels/... atrás de um desafio
// JS do Cloudflare. Um fetch cru (mesmo via electron.net, que usa a stack de
// rede do Chromium) não executa esse desafio e sempre recebe 403 — só um
// navegador de verdade renderizando a página consegue passar. Por isso
// mantemos uma janela do Electron escondida (nunca aparece pro usuário) que
// carrega kick.com uma vez; depois disso a sessão fica com o cookie de
// clearance do Cloudflare e os fetches feitos de DENTRO dessa página passam
// normalmente. Essa janela é reaproveitada entre reconexões.
let hiddenKickWindow = null;
let hiddenKickWindowReady = null;

function destroyHiddenKickWindow() {
  if (hiddenKickWindow && !hiddenKickWindow.isDestroyed()) {
    try { hiddenKickWindow.destroy(); } catch (e) {}
  }
  hiddenKickWindow = null;
  hiddenKickWindowReady = null;
}

function getHiddenKickWindow() {
  const electron = getElectron();
  if (!electron || !electron.BrowserWindow || !electron.app || !electron.app.isReady()) {
    return null; // fora do processo principal do Electron (ex: testes) — sem janela disponível
  }

  if (hiddenKickWindowReady && hiddenKickWindow && !hiddenKickWindow.isDestroyed()) {
    return hiddenKickWindowReady;
  }

  const { BrowserWindow } = electron;
  hiddenKickWindow = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  hiddenKickWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  hiddenKickWindow.on('closed', () => { hiddenKickWindow = null; hiddenKickWindowReady = null; });

  hiddenKickWindowReady = hiddenKickWindow.loadURL(KICK_ORIGIN)
    // pequena folga pra eventual redirecionamento do desafio terminar de resolver
    .then(() => new Promise((resolve) => setTimeout(resolve, 1200)))
    .then(() => hiddenKickWindow)
    .catch((e) => {
      destroyHiddenKickWindow();
      throw e;
    });

  return hiddenKickWindowReady;
}

async function fetchJsonInsideKickPage(url) {
  const winPromise = getHiddenKickWindow();
  if (!winPromise) return null;

  let win;
  try {
    win = await winPromise;
  } catch (e) {
    return null;
  }
  if (!win || win.isDestroyed()) {
    destroyHiddenKickWindow();
    return null;
  }

  const script = `(() => {
    return fetch(${JSON.stringify(url)}, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then((r) => r.text().then((text) => ({ ok: r.ok, status: r.status, text })))
      .catch((e) => ({ ok: false, status: 0, text: String((e && e.message) || e) }));
  })();`;

  let result;
  try {
    result = await win.webContents.executeJavaScript(script, true);
  } catch (e) {
    destroyHiddenKickWindow();
    return null;
  }

  // status 0 normalmente indica que a sessão perdeu o clearance do Cloudflare
  // (ex: janela ficou aberta por muito tempo) — descarta pra recriar do zero
  // na próxima tentativa.
  if (!result || (result.status === 0 && !result.ok)) {
    destroyHiddenKickWindow();
  }

  return result;
}

function kickHeaders(slug) {
  return {
    Accept: 'application/json, text/plain, */*',
    Origin: KICK_ORIGIN,
    Referer: `${KICK_ORIGIN}/${slug}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  };
}

async function kickFetch(url, slug, options = {}) {
  const headers = options.headers || kickHeaders(slug);
  const electronNet = getElectronNet();
  if (electronNet) {
    return electronNet.fetch(url, { headers, redirect: 'follow' });
  }
  return fetch(url, { headers, redirect: 'follow' });
}

async function kickFetchJson(url, slug) {
  const res = await kickFetch(url, slug);
  const text = await res.text();

  if (!res.ok) {
    const detail = text ? ` - ${text.slice(0, 160)}` : '';
    const status = res.status === 404 ? 'unavailable' : 'error';
    throw new KickLookupError(`Kick respondeu ${res.status} em ${url}${detail}`, {
      status,
      retry: status === 'error',
      statusCode: res.status,
    });
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    throw new KickLookupError(`Resposta JSON inválida da Kick em ${url}`, { status: 'error', retry: true });
  }
}

function parseWindowFetchResult(result, url) {
  if (!result.ok) {
    const detail = result.text ? ` - ${result.text.slice(0, 160)}` : '';
    const status = result.status === 404 ? 'unavailable' : 'error';
    throw new KickLookupError(`Kick respondeu ${result.status} em ${url}${detail}`, {
      status,
      retry: status === 'error',
      statusCode: result.status,
    });
  }
  try {
    return result.text ? JSON.parse(result.text) : null;
  } catch (e) {
    throw new KickLookupError(`Resposta JSON inválida da Kick em ${url}`, { status: 'error', retry: true });
  }
}

async function fetchKickJson(url, slug) {
  // 1ª tentativa: dentro da janela oculta, que já passou pelo desafio do
  // Cloudflare como um navegador de verdade.
  const viaWindow = await fetchJsonInsideKickPage(url);
  if (viaWindow) return parseWindowFetchResult(viaWindow, url);

  // Fallback: fetch direto de antes (funciona fora do Electron, ex: testes;
  // dentro do app tende a receber 403 do Cloudflare).
  return kickFetchJson(url, slug);
}

async function resolveKickChatroomId(slug) {
  const encodedSlug = encodeURIComponent(slug);
  const endpoints = [
    {
      url: `${KICK_ORIGIN}/api/v2/channels/${encodedSlug}/chatroom`,
      pickId: (data) => data && data.id,
    },
    {
      url: `${KICK_ORIGIN}/api/v2/channels/${encodedSlug}`,
      pickId: (data) => data && data.chatroom && data.chatroom.id,
    },
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const data = await fetchKickJson(endpoint.url, slug);
      const id = endpoint.pickId(data);
      if (id) return id;
      lastError = new KickLookupError(`Resposta da Kick sem chatroom_id em ${endpoint.url}`, { status: 'error', retry: true });
    } catch (e) {
      lastError = e;
      // 404 em um formato de endpoint pode só significar que precisamos tentar o fallback.
      if (!(e instanceof KickLookupError) || e.statusCode !== 404) break;
    }
  }

  if (lastError) throw lastError;
  throw new KickLookupError('Não achei o chatroom_id desse canal Kick.', { status: 'error', retry: true });
}

function parseJsonMaybe(value) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) value = value.toString();
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return value;
  }
}

function eventPayload(outer) {
  const data = parseJsonMaybe(outer && outer.data);
  if (data && typeof data === 'object' && data.data !== undefined) {
    const nested = parseJsonMaybe(data.data);
    if (nested && typeof nested === 'object') return nested;
  }
  return data && typeof data === 'object' ? data : {};
}

function avatarOf(sender) {
  return sender && (
    sender.profile_pic ||
    sender.profile_picture ||
    sender.avatar ||
    (sender.avatar_url) ||
    (sender.profilepic && sender.profilepic.url)
  );
}

function timestampOf(value) {
  if (!value) return undefined;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? undefined : ts;
}

/**
 * Conecta no chat da Kick.
 * @param {string} channelSlug - nome do canal na URL, ex: "gaules", ou URL completa
 * @param {{onMessage: (msg: object) => void, onStatus: (status: string) => void}} callbacks
 */
function connectKick(channelSlug, { onMessage, onStatus }) {
  let ws = null;
  let stopped = false;

  const retrier = createRetrier({
    onAttempt: () => { if (!stopped) start(); },
    minDelay: 5000,
    maxDelay: 60000,
  });

  function closeSocket() {
    if (!ws) return;
    const current = ws;
    ws = null;
    try { current.removeAllListeners(); } catch (e) {}
    try {
      if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
        current.close();
      } else if (typeof current.terminate === 'function') {
        current.terminate();
      }
    } catch (e) {}
  }

  async function start() {
    onStatus('connecting');
    closeSocket();

    let retryScheduled = false;
    function scheduleRetry(status) {
      if (stopped || retryScheduled) return;
      retryScheduled = true;
      onStatus(status);
      retrier.scheduleNext();
    }

    try {
      const slug = normalizeKickSlug(channelSlug);
      const chatroomId = await resolveKickChatroomId(slug);

      if (stopped) return;

      ws = new WebSocket(
        `wss://ws-${PUSHER_CLUSTER}.pusher.com/app/${PUSHER_APP_KEY}?protocol=7&client=js&version=${PUSHER_CLIENT_VERSION}&flash=false`
      );

      ws.on('open', () => {
        if (!ws || stopped) return;
        ws.send(JSON.stringify({
          event: 'pusher:subscribe',
          data: { auth: '', channel: `chatrooms.${chatroomId}.v2` },
        }));
      });

      ws.on('message', (raw) => {
        try {
          const outer = parseJsonMaybe(raw);
          if (outer && typeof outer === 'object') handleEvent(outer);
        } catch (e) {
          console.error('[Kick] erro ao processar evento:', e.message || e);
        }
      });

      ws.on('close', () => {
        if (stopped) return;
        ws = null;
        scheduleRetry('disconnected');
      });

      ws.on('error', (err) => {
        console.error('[Kick] erro no websocket:', err.message || err);
        if (!stopped) onStatus('error');
      });
    } catch (e) {
      console.error('[Kick]', e.message || e);
      const status = e instanceof KickLookupError ? e.status : 'error';
      onStatus(status || 'error');
      if (!(e instanceof KickLookupError) || e.retry) retrier.scheduleNext();
    }
  }

  function handleEvent(outer) {
    if (outer.event === 'pusher:ping') {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      }
      return;
    }

    if (outer.event === 'pusher:error') {
      console.error('[Kick] erro Pusher:', outer.data || outer);
      onStatus('error');
      return;
    }

    if (outer.event === 'pusher_internal:subscription_succeeded' || outer.event === 'pusher:subscription_succeeded') {
      onStatus('connected');
      retrier.reset();
      return;
    }

    if (outer.event === 'App\\Events\\ChatMessageEvent') {
      const payload = eventPayload(outer);
      const sender = payload.sender || payload.user || {};
      onMessage({
        id: payload.id || payload.message_id,
        username: sender.username || sender.slug || payload.username || 'desconhecido',
        displayName: sender.username || sender.slug || payload.username || 'desconhecido',
        avatar: avatarOf(sender),
        color: (sender.identity && sender.identity.color) || payload.color || '#53fc18',
        message: payload.content || payload.message || '',
        timestamp: timestampOf(payload.created_at),
        type: 'chat',
        meta: { chatroomId: payload.chatroom_id || payload.chatroomId },
      });
      return;
    }

    // Eventos de sub/gift da Kick não têm API/documentação oficial — os nomes
    // abaixo são os observados em projetos open-source da comunidade. Se a
    // Kick mudar o formato, esses eventos simplesmente param de aparecer (o
    // chat normal continua funcionando normalmente).
    if (outer.event === 'App\\Events\\SubscriptionEvent') {
      const payload = eventPayload(outer);
      onMessage({
        id: payload.id || payload.subscription_id,
        username: payload.username || (payload.sender && payload.sender.username) || 'desconhecido',
        message: 'inscreveu-se no canal',
        type: 'sub',
        color: '#53fc18',
        meta: payload,
      });
      return;
    }

    if (outer.event === 'App\\Events\\GiftedSubscriptionsEvent') {
      const payload = eventPayload(outer);
      const gifter = payload.gifter_username || payload.username || (payload.sender && payload.sender.username) || 'alguém';
      const count = (payload.gifted_usernames && payload.gifted_usernames.length) || payload.count || 1;
      onMessage({
        id: payload.id || payload.gift_id,
        username: gifter,
        message: `presenteou ${count} sub(s)`,
        type: 'gift',
        color: '#53fc18',
        meta: payload,
      });
    }
  }

  start();

  return {
    stop: () => {
      stopped = true;
      retrier.stop();
      closeSocket();
      onStatus('disconnected');
    },
  };
}

module.exports = {
  connectKick,
  normalizeKickSlug,
  parseJsonMaybe,
  resolveKickChatroomId,
};
