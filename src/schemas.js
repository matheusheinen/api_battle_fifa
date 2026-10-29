'use strict';
// Schemas JSON compartilhados (registrados com fastify.addSchema e referenciados por $ref)
const properties = {
  player_id: { type: 'integer', minimum: 1, description: 'Opcional no POST; se omitido é gerado automaticamente' },
  player_name: { type: 'string', minLength: 1, maxLength: 120 },
  age: { type: 'integer', minimum: 10, maximum: 60 },
  nationality: { type: 'string', minLength: 1, maxLength: 80 },
  club: { type: 'string', minLength: 1, maxLength: 120 },
  position: { type: 'string', minLength: 1, maxLength: 10 },
  overall_rating: { type: 'integer', minimum: 0, maximum: 100 },
  potential_rating: { type: 'integer', minimum: 0, maximum: 100 },
  matches_played: { type: 'integer', minimum: 0 },
  goals: { type: 'integer', minimum: 0 },
  assists: { type: 'integer', minimum: 0 },
  minutes_played: { type: 'integer', minimum: 0 },
  market_value_million_eur: { type: 'number', minimum: 0 },
  contract_years_left: { type: 'integer', minimum: 0 },
  injury_prone: { type: 'string', enum: ['Yes', 'No'] },
  transfer_risk_level: { type: 'string', enum: ['Low', 'Medium', 'High'] },
};

const player = { $id: 'player', type: 'object', properties };

const playerInput = {
  $id: 'playerInput',
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties).filter((k) => k !== 'player_id'),
  properties,
};

const error = { $id: 'error', type: 'object', properties: { error: { type: 'string' } } };

module.exports = { player, playerInput, error };
