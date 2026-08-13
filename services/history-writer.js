const fs = require('fs');
const path = require('path');

/**
 * Grava as mensagens da sessão em um .txt, tipo:
 *   [21:03] Twitch - Derich: fala galera
 *   [21:03] Kick - João: boa live irmão
 *
 * Um arquivo novo por dia: 2026-08-13-live.txt, dentro da pasta history/.
 * Útil pra depois procurar mensagens pra cortes da live.
 */
function createHistoryWriter(baseDir) {
  const historyDir = path.join(baseDir, 'history');
  let stream = null;
  let currentFile = null;

  function ensureStream() {
    const fileName = `${new Date().toISOString().slice(0, 10)}-live.txt`;
    if (fileName === currentFile && stream) return;

    if (stream) stream.end();
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

    currentFile = fileName;
    stream = fs.createWriteStream(path.join(historyDir, fileName), { flags: 'a' });
  }

  function write(msg) {
    try {
      ensureStream();
      const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const platform = msg.platform.charAt(0).toUpperCase() + msg.platform.slice(1);
      stream.write(`[${time}] ${platform} - ${msg.displayName}: ${msg.message}\n`);
    } catch (e) {
      console.error('[Histórico] erro ao gravar:', e);
    }
  }

  function close() {
    if (stream) stream.end();
    stream = null;
    currentFile = null;
  }

  return { write, close };
}

module.exports = { createHistoryWriter };
