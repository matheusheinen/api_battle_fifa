'use strict';
// Rotas /fifa (plugin encapsulado, registrado com prefix: '/fifa')

module.exports = async function fifaRoutes(fastify, opts) {
  const { columns, authMode } = opts;
  const cache = fastify.playersCache;
  const readSecurity = authMode === 'all' ? [{ apiKey: [] }] : [];

  // AUTH_MODE=all: hook aplicado só às rotas deste plugin (encapsulamento)
  if (authMode === 'all') fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/count', {
    schema: {
      tags: ['fifa'], summary: 'Quantidade de jogadores', security: readSecurity,
      response: { 200: { type: 'object', properties: { count: { type: 'integer' } } } },
    },
  }, async (request, reply) => reply.sendCached(cache.count));

  fastify.get('', {
    schema: {
      tags: ['fifa'], summary: 'Todos os jogadores', security: readSecurity,
      response: { 200: { type: 'array', items: { $ref: 'player#' } } },
    },
  }, async (request, reply) => reply.sendCached(cache.all));

  fastify.get('/id/:id', {
    schema: {
      tags: ['fifa'], summary: 'Um jogador pelo player_id', security: readSecurity,
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1, description: 'player_id' } } },
      response: { 200: { $ref: 'player#' }, 400: { $ref: 'error#' }, 404: { $ref: 'error#' } },
    },
  }, async (request, reply) => {
    const e = cache.byId.get(request.params.id);
    if (!e) return reply.code(404).send({ error: 'Jogador não encontrado' });
    return reply.sendCached(e);
  });

  fastify.get('/nat/:exp', {
    schema: {
      tags: ['fifa'], summary: 'Jogadores por nacionalidade (ex.: Brazil)', security: readSecurity,
      description: 'Filtra por nationality = {exp}, sem diferenciar maiúsculas/minúsculas. Retorna [] se não houver jogadores.',
      params: { type: 'object', required: ['exp'], properties: { exp: { type: 'string', description: 'Nacionalidade, ex.: Brazil' } } },
      response: { 200: { type: 'array', items: { $ref: 'player#' } } },
    },
  }, async (request, reply) => {
    const e = cache.byNat.get(request.params.exp.trim().toLowerCase());
    return reply.sendCached(e || cache.empty);
  });

  const insertSql =
    `INSERT INTO fifa_players (${columns.join(', ')}) VALUES (` +
    "COALESCE($1, nextval('fifa_players_id_seq')), " +
    columns.slice(1).map((_, i) => `$${i + 2}`).join(', ') +
    `) RETURNING ${columns.join(', ')}`;

  const bumpSql =
    "SELECT setval('fifa_players_id_seq', GREATEST($1::int + 1, (SELECT last_value FROM fifa_players_id_seq)), false)";

  fastify.post('', {
    ...(authMode === 'write' ? { onRequest: fastify.authenticate } : {}),
    schema: {
      tags: ['fifa'], summary: 'Insere um jogador',
      security: authMode === 'off' ? [] : [{ apiKey: [] }],
      body: { $ref: 'playerInput#' },
      response: { 201: { $ref: 'player#' }, 400: { $ref: 'error#' }, 401: { $ref: 'error#' }, 409: { $ref: 'error#' } },
    },
  }, async (request, reply) => {
    const b = request.body;
    const values = columns.map((c) => (b[c] === undefined ? null : b[c]));
    const autoId = b.player_id === undefined;
    // Id automático vem da sequence; se colidir com um id inserido manualmente, tenta de novo (até 5 vezes)
    for (let attempt = 1; ; attempt++) {
      try {
        const { rows } = await fastify.pg.query(insertSql, values);
        // id informado pelo cliente: garante que a sequence fique à frente dele
        if (!autoId) await fastify.pg.query(bumpSql, [rows[0].player_id]);
        cache.add(rows[0]);
        return reply.code(201).send(rows[0]);
      } catch (err) {
        if (err.code !== '23505') throw err;
        if (!autoId) return reply.code(409).send({ error: `player_id ${b.player_id} já existe` });
        if (attempt >= 5) return reply.code(409).send({ error: 'Conflito ao gerar player_id, tente novamente' });
      }
    }
  });
};
