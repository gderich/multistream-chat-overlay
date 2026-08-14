const crypto = require('crypto');

/**
 * Formato padrão de mensagem usado no app inteiro, não importa a plataforma
 * de origem. Isso é o que permite o app crescer (novos tipos de evento,
 * avatar, badges etc.) sem cada conector reinventar seu próprio formato.
 *
 * type pode ser: 'chat' | 'sub' | 'resub' | 'gift' | 'donation' | 'raid' |
 *                'follow' | 'member' | 'system'
 */
function normalize(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    platform: raw.platform,
    username: raw.username || 'desconhecido',
    displayName: raw.displayName || raw.username || 'desconhecido',
    message: raw.message || '',
    color: raw.color || '#888888',
    avatar: raw.avatar || null,
    badges: raw.badges || [],
    emotes: raw.emotes || {},
    timestamp: raw.timestamp || Date.now(),
    type: raw.type || 'chat',
    meta: raw.meta || {},
  };
}

module.exports = { normalize };
