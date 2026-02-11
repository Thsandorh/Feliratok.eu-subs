const { execFile } = require('node:child_process');

function runCurl(args, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      args,
      { maxBuffer: 50 * 1024 * 1024, encoding },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`curl failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function curlArgs(url) {
  return ['-L', '--silent', '--show-error', '--max-time', '45', '-A', 'Mozilla/5.0', url];
}

async function fetchText(url) {
  return runCurl(curlArgs(url), 'utf8');
}

async function fetchBuffer(url) {
  return runCurl(curlArgs(url), 'buffer');
}

async function fetchJson(url) {
  const raw = await fetchText(url);
  return JSON.parse(raw);
}

module.exports = {
  fetchText,
  fetchBuffer,
  fetchJson
};
