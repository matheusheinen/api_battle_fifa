'use strict';
/*
 * Plugin de cache de leitura (write-through).
 * O PostgreSQL é a fonte da verdade: ao subir, a tabela é lida e as respostas JSON
 * ficam pré-serializadas (e pré-comprimidas em gzip). Cada POST grava primeiro no
 * banco e só então atualiza o cache via `fastify.playersCache.add()`.
 */
const fp = require('fastify-plugin');
const zlib = require('zlib');

const GZIP_MIN = 1024;

function entry(obj) {
  const raw = Buffer.from(JSON.stringify(obj));
  return { raw, gz: raw.length >= GZIP_MIN ? zlib.gzipSync(raw) : null };
}

class PlayersCache {
  constructor() {
    this.rows = [];
    this.all = entry([]);
    this.count = entry({ count: 0 });
    this.byId = new Map();
    this.byNat = new Map();
    this.empty = entry([]);
    this.loadedAt = null;
  }

  rebuild(rows) {
    rows.sort((a, b) => a.player_id - b.player_id);
    const byId = new Map();
    const groups = new Map();
    for (const r of rows) {
      byId.set(r.player_id, entry(r));
      const k = r.nationality.toLowerCase();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const byNat = new Map();
    for (const [k, list] of groups) byNat.set(k, entry(list));
    Object.assign(this, { rows, all: entry(rows), count: entry({ count: rows.length }), byId, byNat, loadedAt: new Date() });
  }

  add(row) {
    this.rebuild(this.rows.concat(row));
  }
}

async function cachePlugin(fastify, opts) {
  const cache = new PlayersCache();
  fastify.decorate('playersCache', cache);

  // Envia uma entrada do cache, em gzip quando o cliente aceita
  fastify.decorateReply('sendCached', function sendCached(e) {
    this.header('content-type', 'application/json; charset=utf-8');
    if (e.gz && /\bgzip\b/.test(this.request.headers['accept-encoding'] || '')) {
      this.header('content-encoding', 'gzip').header('vary', 'Accept-Encoding');
      return this.send(e.gz);
    }
    return this.send(e.raw);
  });

  fastify.addHook('onReady', async () => {
    const { rows } = await fastify.pg.query(`SELECT ${opts.columns.join(', ')} FROM fifa_players`);
    cache.rebuild(rows);
    // Alinha a sequence de ids caso tenham inserido registros direto no banco
    await fastify.pg.query("SELECT setval('fifa_players_id_seq', COALESCE((SELECT MAX(player_id) FROM fifa_players), 0) + 1, false)");
    fastify.log.info(`cache carregado: ${rows.length} jogadores`);
  });
}

module.exports = fp(cachePlugin, { name: 'cache', dependencies: ['db'] });
