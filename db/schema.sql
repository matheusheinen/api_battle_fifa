-- Esquema do banco da API FIFA (PostgreSQL)
CREATE TABLE IF NOT EXISTS fifa_players (
    player_id                 INTEGER PRIMARY KEY,
    player_name               VARCHAR(120) NOT NULL,
    age                       INTEGER NOT NULL,
    nationality               VARCHAR(80)  NOT NULL,
    club                      VARCHAR(120) NOT NULL,
    position                  VARCHAR(10)  NOT NULL,
    overall_rating            INTEGER NOT NULL,
    potential_rating          INTEGER NOT NULL,
    matches_played            INTEGER NOT NULL,
    goals                     INTEGER NOT NULL,
    assists                   INTEGER NOT NULL,
    minutes_played            INTEGER NOT NULL,
    market_value_million_eur  DOUBLE PRECISION NOT NULL,
    contract_years_left       INTEGER NOT NULL,
    injury_prone              VARCHAR(3)  NOT NULL,
    transfer_risk_level       VARCHAR(10) NOT NULL
);

-- Índice para a consulta por nacionalidade
CREATE INDEX IF NOT EXISTS idx_fifa_players_nationality ON fifa_players (nationality);

-- Gerador de player_id para POSTs sem id (nunca repete valores, mesmo com requisições simultâneas)
CREATE SEQUENCE IF NOT EXISTS fifa_players_id_seq;
