# API Battle – FIFA Player Performance

API REST com os dados do dataset *FIFA Player Performance & Market Value* (Kaggle).
**Stack:** Node.js 22 + Fastify 5 + PostgreSQL 16.

- **Base URL:** `http://177.44.248.73:3000`
- **Documentação interativa (Swagger):** `http://177.44.248.73:3000/docs`
- **Autenticação:** header `x-api-key: <chave>` (ou `Authorization: Bearer <chave>`).
  Por padrão só o `POST` exige chave; os `GET` são públicos (`AUTH_MODE=all` protege tudo).

## Endpoints

| Método | Rota | Descrição | Respostas |
|---|---|---|---|
| POST | `/fifa` | Insere um jogador (JSON no corpo) | 201, 400, 401, 409 |
| GET | `/fifa/count` | Quantidade de jogadores → `{"count": 2800}` | 200 |
| GET | `/fifa` | Todos os jogadores (array) | 200 |
| GET | `/fifa/id/{id}` | Um jogador pelo `player_id` | 200, 400, 404 |
| GET | `/fifa/nat/{exp}` | Jogadores com `nationality = {exp}`, ex.: `/fifa/nat/Brazil` (não diferencia maiúsculas) | 200 (`[]` se nenhum) |

### Objeto jogador

```json
{
  "player_id": 1,
  "player_name": "Player_1",
  "age": 23,
  "nationality": "Germany",
  "club": "Liverpool",
  "position": "ST",
  "overall_rating": 65,
  "potential_rating": 87,
  "matches_played": 8,
  "goals": 6,
  "assists": 14,
  "minutes_played": 2976,
  "market_value_million_eur": 122.51,
  "contract_years_left": 3,
  "injury_prone": "No",
  "transfer_risk_level": "Low"
}
```

No `POST`, todos os campos são obrigatórios exceto `player_id` (se omitido, é gerado como MAX+1).
`injury_prone`: `Yes`|`No`. `transfer_risk_level`: `Low`|`Medium`|`High`. `player_id` repetido → 409.

### Exemplos

```bash
curl http://177.44.248.73:3000/fifa/count
curl http://177.44.248.73:3000/fifa/id/10
curl http://177.44.248.73:3000/fifa/nat/Brazil
curl -X POST http://177.44.248.73:3000/fifa \
  -H "Content-Type: application/json" -H "x-api-key: fifa-battle-2026" \
  -d '{"player_name":"Novo","age":25,"nationality":"Brazil","club":"Gremio","position":"ST","overall_rating":80,"potential_rating":85,"matches_played":30,"goals":15,"assists":7,"minutes_played":2500,"market_value_million_eur":20.5,"contract_years_left":3,"injury_prone":"No","transfer_risk_level":"Low"}'
```

## Banco de dados e carga em lote

- Esquema: `db/schema.sql` (tabela `fifa_players`, PK `player_id`, índice em `nationality`).
- Carga: `npm run seed` (ou `node scripts/seed.js [arquivo.csv] [--reset]`) — cria a tabela e insere
  o CSV em lotes de 500 linhas numa transação. É idempotente (`ON CONFLICT DO NOTHING`).

## Desempenho

O PostgreSQL é a fonte da verdade. No startup a API lê a tabela e mantém as respostas JSON
pré-serializadas e pré-comprimidas (gzip) em memória; cada `POST` grava primeiro no banco e só
então atualiza o cache (*write-through*). As respostas grandes (`/fifa`, `/fifa/nat`) vão em gzip
quando o cliente envia `Accept-Encoding: gzip` (Postman/Insomnia enviam): `/fifa` cai de ~920 KB para ~88 KB.

## Arquitetura (padrão de plugins do Fastify)

```
src/
  server.js          ponto de entrada: listen + desligamento gracioso (SIGINT/SIGTERM → app.close())
  app.js             monta a app: schemas compartilhados, error handler, swagger, plugins e rotas
  config.js          variáveis de ambiente
  schemas.js         JSON Schemas (player, playerInput, error) via addSchema + $ref
  plugins/db.js      decora fastify.pg (pool do PostgreSQL), fecha no onClose
  plugins/cache.js   decora fastify.playersCache e reply.sendCached; carrega no onReady
  plugins/auth.js    decora fastify.authenticate (hook de rota por API key)
  routes/fifa.js     rotas /fifa (plugin encapsulado com prefix)
scripts/seed.js      criação da tabela + carga em lote do CSV
db/schema.sql        DDL
```

## Deploy na VM

Passo a passo completo em [`DEPLOY-VM.md`](DEPLOY-VM.md). Resumo:

```bash
sudo env PORT=3000 API_KEY=fifa-battle-2026 bash setup-vm.sh
```
Instala PostgreSQL e Node 22, cria o banco, faz a carga e registra o serviço `fifa-api` no systemd.

Variáveis: `PORT` (3000), `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` (localhost/fifa/fifa/fifa),
`API_KEY` (fifa-battle-2026), `AUTH_MODE` (`write`|`all`|`off`).

## Testes

Importe `postman_collection.json` no Postman ou Insomnia e ajuste as variáveis `baseUrl` e `apiKey`.
Cada requisição verifica status e mostra o tempo de resposta.
