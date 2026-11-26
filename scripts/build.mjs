import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

const types = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.webmanifest':'application/manifest+json',
  '.png':'image/png',
  '.webp':'image/webp'
};
const assets = {};
for (const name of await readdir('public')) {
  const type = types[extname(name)];
  if (!type) throw new Error('Unknown asset type: ' + name);
  assets['/' + name] = {type, content:(await readFile('public/' + name)).toString('base64')};
}
await mkdir('dist/server', {recursive:true});
const source = await readFile('worker/index.js','utf8');
await writeFile('dist/server/index.js', 'const assets = ' + JSON.stringify(assets) + ';\n' + source);
