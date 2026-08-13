/**
 * Pequeno utilitário de retry com backoff exponencial (limitado a um teto).
 * Usado pelos conectores "instáveis" (Kick, TikTok, YouTube) para tentar
 * reconectar sozinhos sem derrubar o app nem spammar tentativas.
 */
function createRetrier({ onAttempt, minDelay = 5000, maxDelay = 60000 }) {
  let timer = null;
  let attempt = 0;
  let stopped = false;

  function scheduleNext() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    const delay = Math.min(minDelay * Math.pow(2, attempt), maxDelay);
    attempt += 1;
    timer = setTimeout(() => {
      if (!stopped) onAttempt();
    }, delay);
  }

  function reset() {
    attempt = 0;
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
  }

  return { scheduleNext, reset, stop };
}

module.exports = { createRetrier };
