const fs = require('node:fs');

function requireFile(path) {
  if (!fs.existsSync(path)) throw new Error('Missing required file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const index = requireFile('index.html');
const sw = requireFile('sw.js');
const manifest = JSON.parse(requireFile('manifest.webmanifest'));
requireFile('mastery.js');

[
  'id="masteryScore"',
  'id="masteryFill"',
  'id="masteryDetail"',
  'id="masteryFocus"',
  'id="rankJourney"',
  'id="rankPosition"',
  'id="rankUnlock"',
  'function celebrateRank(rank)',
  '<script id="mastery-code">',
].forEach((marker) => {
  if (!index.includes(marker)) throw new Error('index.html is missing: ' + marker);
});

if (!sw.includes("'./mastery.js'")) throw new Error('Service worker does not cache mastery.js');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) throw new Error('PWA manifest icons are invalid');
if (!manifest.start_url || !manifest.scope) throw new Error('PWA manifest routing is incomplete');

console.log('Static and PWA checks passed.');

const embedded = index.match(/<script id="mastery-code">\n([\s\S]*?)<\/script>/)[1];
if (embedded !== requireFile('mastery.js')) throw new Error('Embedded rating module is out of sync');
const vm = require('node:vm');
for (const match of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
