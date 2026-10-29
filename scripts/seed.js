'use strict';
/*
 * Cria a tabela (db/schema.sql) e insere os registros do CSV em lote.
 * Uso: node scripts/seed.js [caminho.csv] [--reset]
 *   --reset  apaga os dados existentes antes de inserir
 * Inserções em lotes de 500 linhas por INSERT, tudo numa transação.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { pg: pgConfig, COLUMNS } = require('../src/config');

const pool = new Pool(pgConfig);

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const csvPath = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'data', 'fifa.csv');
const BATCH = 500;
const INT_COLS = new Set(['player_id', 'age', 'overall_rating', 'potential_rating', 'matches_played',
  'goals', 'assists', 'minutes_played', 'contract_years_left']);

function parseLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const lines = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const header = parseLine(lines[0]).map((h) => h.trim());
  const idx = COLUMNS.map((c) => {
    const i = header.indexOf(c);
    if (i < 0) throw new Error(`Coluna ausente no CSV: ${c}`);
    return i;
  });
  const rows = lines.slice(1).map((l) => {
    const f = parseLine(l);
    return COLUMNS.map((c, k) => {
      const v = f[idx[k]].trim();
      if (INT_COLS.has(c)) return parseInt(v, 10);
      if (c === 'market_value_million_eur') return parseFloat(v);
      return v;
    });
  });

  const t0 = Date.now();
  const client = await pool.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    await client.query('BEGIN');
    if (reset) await client.query('TRUNCATE fifa_players');
    let inserted = 0;
    for (let s = 0; s < rows.length; s += BATCH) {
      const chunk = rows.slice(s, s + BATCH);
      const params = [];
      const tuples = chunk.map((r, i) => {
        params.push(...r);
        return '(' + r.map((_, j) => `$${i * COLUMNS.length + j + 1}`).join(',') + ')';
      });
      const res = await client.query(
        `INSERT INTO fifa_players (${COLUMNS.join(',')}) VALUES ${tuples.join(',')} ON CONFLICT (player_id) DO NOTHING`,
        params,
      );
      inserted += res.rowCount;
    }
    // Alinha a sequence de ids ao maior player_id carregado
    await client.query("SELECT setval('fifa_players_id_seq', COALESCE((SELECT MAX(player_id) FROM fifa_players), 0) + 1, false)");
    await client.query('COMMIT');
    await client.query('ANALYZE fifa_players');
    const { rows: [c] } = await client.query('SELECT COUNT(*)::int AS n FROM fifa_players');
    console.log(`CSV: ${rows.length} linhas | inseridas: ${inserted} | total na tabela: ${c.n} | ${Date.now() - t0} ms`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
