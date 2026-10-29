'use strict';
// Configuração centralizada (variáveis de ambiente)
module.exports = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  logger: process.env.LOG === '1',
  apiKey: process.env.API_KEY || 'fifa-battle-2026',
  // "write" = só o POST exige chave | "all" = todas as rotas /fifa | "off"
  authMode: (process.env.AUTH_MODE || 'write').toLowerCase(),
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'fifa',
    password: process.env.PGPASSWORD || 'fifa',
    database: process.env.PGDATABASE || 'fifa',
    max: Number(process.env.PG_POOL_MAX || 10),
  },
  COLUMNS: [
    'player_id', 'player_name', 'age', 'nationality', 'club', 'position',
    'overall_rating', 'potential_rating', 'matches_played', 'goals', 'assists',
    'minutes_played', 'market_value_million_eur', 'contract_years_left',
    'injury_prone', 'transfer_risk_level',
  ],
};
