'use strict';
// Monta a aplicação Fastify (sem dar listen) — facilita testes com app.inject()
const Fastify = require('fastify');
const config = require('./config');
const schemas = require('./schemas');

async function buildApp(overrides = {}) {
  const cfg = { ...config, ...overrides };
  const app = Fastify({
    logger: cfg.logger,
    bodyLimit: 64 * 1024,
    requestTimeout: 15000, // corta conexões que não terminam de enviar a requisição (slowloris)
    routerOptions: { ignoreTrailingSlash: true },
    // Recusa campos extras no POST em vez de descartá-los em silêncio (padrão do Fastify)
    ajv: { customOptions: { removeAdditional: false } },
  });

  for (const s of Object.values(schemas)) app.addSchema(s);

  // Rota inexistente no mesmo formato de erro do restante da API
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `Rota ${request.method} ${request.url} não encontrada` });
  });

  // Registrado antes dos plugins de rota para ser herdado por eles (encapsulamento)
  app.setErrorHandler((err, request, reply) => {
    if (err.validation || (err.statusCode && err.statusCode < 500)) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
    request.log.error(err);
    return reply.code(500).send({ error: 'Erro interno' });
  });

  await app.register(require('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'API Battle – FIFA Player Performance',
        version: '1.0.0',
        description:
          'API de jogadores FIFA (dataset Kaggle). Autenticação: header `x-api-key` ' +
          '(ou `Authorization: Bearer <chave>`). ' +
          ({ all: 'Todas as rotas /fifa exigem a chave.', write: 'Apenas o POST exige a chave; os GETs são públicos.' }[cfg.authMode]
            || 'Autenticação desligada.'),
      },
      components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
    },
  });
  await app.register(require('@fastify/swagger-ui'), { routePrefix: '/docs' });

  await app.register(require('./plugins/db'), { pg: cfg.pg });
  await app.register(require('./plugins/cache'), { columns: cfg.COLUMNS });
  await app.register(require('./plugins/auth'), { apiKey: cfg.apiKey });
  await app.register(require('./routes/fifa'), { prefix: '/fifa', columns: cfg.COLUMNS, authMode: cfg.authMode });

  app.get('/health', { schema: { hide: true } }, async () => ({
    status: 'ok', players: app.playersCache.rows.length, cache_loaded_at: app.playersCache.loadedAt,
  }));

  return app;
}

module.exports = buildApp;
