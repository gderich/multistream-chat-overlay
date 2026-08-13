const { connectTwitch } = require('../connectors/twitch');
const { connectKick } = require('../connectors/kick');
const { connectYouTube } = require('../connectors/youtube');
const { connectTikTok } = require('../connectors/tiktok');
const { normalize } = require('./message-normalizer');

const CONNECTORS = {
  twitch: connectTwitch,
  kick: connectKick,
  youtube: connectYouTube,
  tiktok: connectTikTok,
};

/**
 * Orquestra os 4 conectores. Se um deles quebrar (ex: Kick mudar algo),
 * os outros continuam funcionando normalmente — cada um vive isolado no
 * seu próprio try/catch.
 *
 * @param {{onMessage: (msg: object) => void, onStatus: (platform: string, status: string) => void}} callbacks
 */
function createConnectionManager({ onMessage, onStatus }) {
  let handles = {};

  function stopOne(platform) {
    const h = handles[platform];
    if (!h) return;
    try { h.stop(); } catch (e) {}
    delete handles[platform];
  }

  function stopAll() {
    Object.keys(handles).forEach(stopOne);
  }

  function startOne(platform, channel) {
    stopOne(platform);
    if (!channel) {
      onStatus(platform, 'disconnected');
      return;
    }
    const connect = CONNECTORS[platform];
    try {
      handles[platform] = connect(channel, {
        onMessage: (raw) => onMessage(normalize({ ...raw, platform })),
        onStatus: (status) => onStatus(platform, status),
      });
    } catch (e) {
      console.error(`[${platform}]`, e);
      onStatus(platform, 'error');
    }
  }

  function startAll(channels) {
    Object.keys(CONNECTORS).forEach((platform) => startOne(platform, channels[platform]));
  }

  function restartOne(platform, channels) {
    startOne(platform, channels[platform]);
  }

  return { startAll, stopAll, restartOne };
}

module.exports = { createConnectionManager };
