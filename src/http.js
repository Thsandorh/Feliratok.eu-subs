const { execFile } = require('node:child_process');

function runCurl(args) {
  return new Promise((resolve, reject) => {
    execFile('curl', args, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`curl failed: ${stderr || error.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function fetchText(url) {
  return runCurl([
    '-L',
    '--silent',
    '--show-error',
    '--max-time',
    '30',
    '-A',
    'Mozilla/5.0',
    url
  ]);
}

async function fetchJson(url) {
  const raw = await fetchText(url);
  return JSON.parse(raw);
}

module.exports = {
  fetchText,
  fetchJson
};
