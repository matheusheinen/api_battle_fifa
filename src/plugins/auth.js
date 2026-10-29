'use strict';
// Plugin de autenticação por API key: decora `fastify.authenticate` para uso como hook de rota.
const fp = require('fastify-plugin');
const crypto = require('crypto');

async function authPlugin(fastify, opts) {
  const expected = crypto.createHash('sha256').update(String(opts.apiKey)).digest();
  // Comparação em tempo constante (hash → mesmo tamanho para timingSafeEqual)
  const matches = (key) =>
    typeof key === 'string' && key.length > 0 &&
    crypto.timingSafeEqual(crypto.createHash('sha256').update(key).digest(), expected);

  fastify.decorate('authenticate', async function authenticate(request, reply) {
    const h = request.headers;
    const bearer = (h.authorization || '').replace(/^Bearer\s+/i, '');
    if (!matches(h['x-api-key']) && !matches(bearer)) {
      return reply.code(401).send({ error: 'Não autorizado: informe a chave no header x-api-key' });
    }
  });
}

module.exports = fp(authPlugin, { name: 'auth' });
