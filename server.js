const addonInterface = require('./src/index');
const { startServer } = require('./src/server');

const port = Number(process.env.PORT || 7000);
const appBasePath = process.env.APP_BASE_PATH || '';

startServer({ addonInterface, port, appBasePath });

console.log(`Feliratok.eu Stremio addon listening on http://127.0.0.1:${port}${appBasePath}/manifest.json`);
