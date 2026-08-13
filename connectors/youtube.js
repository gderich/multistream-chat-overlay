const { LiveChat } = require('youtube-chat');
const { createRetrier } = require('../services/reconnect-manager');

/**
 * Conecta no chat de uma live do YouTube que já esteja no ar.
 * Se ainda não tiver live ativa, fica tentando de novo sozinho.
 * @param {string} channelIdOrHandle - ID do canal (começa com "UC...") ou handle (@seucanal)
 * @param {{onMessage: (msg: object) => void, onStatus: (status: string) => void}} callbacks
 */
function connectYouTube(channelIdOrHandle, { onMessage, onStatus }) {
  const opts = channelIdOrHandle.startsWith('UC')
    ? { channelId: channelIdOrHandle }
    : { handle: channelIdOrHandle.startsWith('@') ? channelIdOrHandle : `@${channelIdOrHandle}` };

  let stopped = false;
  let current = null;

  const retrier = createRetrier({
    onAttempt: () => { if (!stopped) { current = attemptStart(); } },
    minDelay: 15000,
    maxDelay: 60000,
  });

  function attemptStart() {
    onStatus('connecting');
    const liveChat = new LiveChat(opts);

    liveChat.on('chat', (chatItem) => {
      const text = (chatItem.message || [])
        .map((m) => m.text || m.emojiText || '')
        .join('');

      let type = 'chat';
      const meta = {};
      if (chatItem.superchat) {
        type = 'donation';
        meta.amount = chatItem.superchat.amount;
      } else if (chatItem.isMembership) {
        type = 'member';
      }

      onMessage({
        username: (chatItem.author && chatItem.author.name) || 'desconhecido',
        avatar: chatItem.author && chatItem.author.thumbnail && chatItem.author.thumbnail.url,
        color: chatItem.superchat ? (chatItem.superchat.color || '#ff0000') : '#ff0000',
        message: text,
        type,
        meta,
      });
    });

    liveChat.on('error', (err) => {
      console.error('[YouTube] erro:', err);
      onStatus('error');
    });

    liveChat.on('end', () => {
      if (stopped) return;
      onStatus('disconnected');
      retrier.scheduleNext();
    });

    liveChat.start().then((ok) => {
      if (ok) {
        onStatus('connected');
        retrier.reset();
      } else {
        onStatus('unavailable');
        retrier.scheduleNext();
      }
    }).catch((err) => {
      console.error('[YouTube] erro ao iniciar:', err);
      onStatus('unavailable');
      retrier.scheduleNext();
    });

    return liveChat;
  }

  current = attemptStart();

  return {
    stop: () => {
      stopped = true;
      retrier.stop();
      try { current && current.stop(); } catch (e) {}
    },
  };
}

module.exports = { connectYouTube };
