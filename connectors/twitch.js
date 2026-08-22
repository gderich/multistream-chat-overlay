const tmi = require('tmi.js');

/**
 * Conecta no chat da Twitch de forma anônima (só leitura).
 * @param {string} channel - nome do canal, ex: "gaules"
 * @param {{onMessage: (msg: object) => void, onStatus: (status: string) => void}} callbacks
 */
function connectTwitch(channel, { onMessage, onStatus }) {
  const client = new tmi.Client({
    options: { skipMembership: true },
    connection: { reconnect: true, secure: true },
    identity: { username: `justinfan${Math.floor(Math.random() * 100000)}` },
    channels: [channel],
  });

  onStatus('connecting');

  client.connect().catch((err) => {
    console.error('[Twitch] erro ao conectar:', err);
    onStatus('error');
  });

  client.on('connected', () => onStatus('connected'));
  client.on('disconnected', () => onStatus('disconnected'));
  client.on('reconnect', () => onStatus('connecting'));

  client.on('message', (_channel, tags, message) => {
    onMessage({
      username: tags['display-name'] || tags.username || 'desconhecido',
      color: tags.color || '#9147ff',
      message,
      type: 'chat',
      badges: Object.keys(tags.badges || {}),
      emotes: tags.emotes || {},
    });
  });

  // Mensagens especiais: sub, resub, gift sub, bits (cheer) e raid.
  client.on('subscription', (_channel, username, methods, message) => {
    onMessage({
      username,
      message: message || 'inscreveu-se no canal',
      type: 'sub',
      color: '#9147ff',
      meta: { plan: methods && methods.planName },
    });
  });

  client.on('resub', (_channel, username, months, message) => {
    onMessage({
      username,
      message: message || `renovou a inscrição (${months} meses)`,
      type: 'resub',
      color: '#9147ff',
      meta: { months },
    });
  });

  client.on('subgift', (_channel, username, months, recipient) => {
    onMessage({
      username,
      message: `presenteou uma sub para ${recipient}`,
      type: 'gift',
      color: '#9147ff',
      meta: { recipient, months },
    });
  });

  // Presente coletivo (community gift subs).
  client.on('submysterygift', (_channel, username, numbOfSubs, methods) => {
    onMessage({
      username,
      message: `presenteou ${numbOfSubs} inscrições`,
      type: 'gift',
      color: '#9147ff',
      meta: { count: numbOfSubs, plan: methods && methods.planName, communityGift: true },
    });
  });

  client.on('cheer', (_channel, tags, message) => {
    onMessage({
      username: tags['display-name'] || tags.username || 'desconhecido',
      message: message || '',
      type: 'donation',
      color: tags.color || '#9147ff',
      meta: { bits: tags.bits },
    });
  });

  client.on('raided', (_channel, username, viewers) => {
    onMessage({
      username,
      message: `trouxe uma raid com ${viewers} espectadores`,
      type: 'raid',
      color: '#9147ff',
      meta: { viewers },
    });
  });

  return {
    stop: () => {
      try { client.disconnect(); } catch (e) {}
    },
  };
}

module.exports = { connectTwitch };
