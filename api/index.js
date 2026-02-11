const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('../src/index');

const router = getRouter(addonInterface);

module.exports = (req, res) => {
  router(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ err: 'not found' }));
  });
};
