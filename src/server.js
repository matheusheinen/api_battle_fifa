'use strict';
// Ponto de entrada: sobe o servidor e trata desligamento gracioso
const buildApp = require('./app');
const config = require('./config');

async function main() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  console.log(`API FIFA em http://${config.host}:${config.port} | ${app.playersCache.rows.length} jogadores | docs em /docs | AUTH_MODE=${config.authMode}`);

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, async () => {
      await app.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
