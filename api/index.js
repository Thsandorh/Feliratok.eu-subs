const addonInterface = require('../src/index');
const { createRequestHandler } = require('../src/server');

module.exports = createRequestHandler(addonInterface);
