const { createRetrier } = require('../services/reconnect-manager');

/**
 * Conecta no chat de uma live do TikTok que já esteja no ar.
 * Não precisa de login/API key para só ler o chat.
 *
 * Nota técnica: o pacote "tiktok-live-connector" é publicado como ES Module
 * puro, então não dá pra usar require() normal nele a partir de um arquivo
 * CommonJS. Por isso usamos import() dinâmico aqui dentro, o que funciona
 * em qualquer arquivo CommonJS.
 *
 * Assim como a Kick, essa integração depende de engenharia reversa do site
 * (não é API pública oficial). Por isso: status "Indisponível" em vez de só
 * um console.error, e retry automático em vez de desistir.
 *
 * @param {string} username - @usuario (sem ou com o @) do TikTok
 * @param {{onMessage: (msg: object) => void, onStatus: (status: string) => void}} callbacks
 */
function connectTikTok(username, { onMessage, onStatus }) {
  let connection = null;
  let stopped = false;

  const retrier = createRetrier({
    onAttempt: () => { if (!stopped) start(); },
    minDelay: 15000,
    maxDelay: 60000,
  });

  async function start() {
    onStatus('connecting');
    try {
      const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');

      if (stopped) return;
      connection = new TikTokLiveConnection(username, {});

      connection.on(WebcastEvent.CHAT, (data) => {
        onMessage({
          username: (data.user && (data.user.nickname || data.user.displayId)) || 'desconhecido',
          avatar: avatarOf(data.user),
          color: '#25F4EE',
          message: data.content,
          type: 'chat',
        });
      });

      connection.on(WebcastEvent.GIFT, (data) => {
        // giftType 1 = presente em combo/streak; só mostra quando o streak
        // termina (repeatEnd), senão a tela fica piscando a cada tique.
        if (data.giftType === 1 && !data.repeatEnd) return;
        const giftName = (data.gift && (data.gift.name || data.gift.giftName)) || 'presente';
        onMessage({
          username: (data.user && (data.user.nickname || data.user.displayId)) || 'desconhecido',
          avatar: avatarOf(data.user),
          color: '#25F4EE',
          message: `enviou ${data.repeatCount > 1 ? data.repeatCount + 'x ' : ''}${giftName}`,
          type: 'gift',
        });
      });

      connection.on(WebcastEvent.FOLLOW, (data) => {
        onMessage({
          username: (data.user && (data.user.nickname || data.user.displayId)) || 'desconhecido',
          avatar: avatarOf(data.user),
          message: 'começou a seguir',
          color: '#25F4EE',
          type: 'follow',
        });
      });

      connection.on(ControlEvent.CONNECTED, () => {
        onStatus('connected');
        retrier.reset();
      });

      connection.on(ControlEvent.DISCONNECTED, () => {
        if (stopped) return;
        onStatus('disconnected');
        retrier.scheduleNext();
      });

      connection.on(ControlEvent.ERROR, ({ info } = {}) => {
        console.error('[TikTok] erro:', info);
        onStatus('error');
      });

      await connection.connect();
    } catch (err) {
      console.error(
        '[TikTok] não consegui conectar (provavelmente não tem live ativa agora):',
        err.message || err
      );
      onStatus('unavailable');
      retrier.scheduleNext();
    }
  }

  function avatarOf(user) {
    return user && user.avatarThumb && user.avatarThumb.urlList && user.avatarThumb.urlList[0];
  }

  start();

  return {
    stop: () => {
      stopped = true;
      retrier.stop();
      if (connection) { try { connection.disconnect(); } catch (e) {} }
    },
  };
}

module.exports = { connectTikTok };
