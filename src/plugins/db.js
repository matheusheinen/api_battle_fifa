'use strict';
// Plugin de banco: decora a instância com `fastify.pg` (pool) e fecha no onClose.
const fp = require('fastify-plugin');
const { Pool } = require('pg');

async function dbPlugin(fastify, opts) {
  const pool = new Pool(opts.pg);
  // Sem este listener, uma conexão ociosa que cai (ex.: Postgres reiniciou) derruba o processo.
  // Com ele, o erro é registrado e os GETs seguem respondendo pelo cache.
  pool.on('error', (err) => fastify.log.error({ err }, 'conexão ociosa com o PostgreSQL caiu'));
  await pool.query('SELECT 1'); // falha cedo se o banco não estiver acessível
  fastify.decorate('pg', pool);
  fastify.addHook('onClose', async () => pool.end());
}

module.exports = fp(dbPlugin, { name: 'db' });
