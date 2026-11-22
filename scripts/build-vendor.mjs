import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const output = 'vendor';
const { metafile } = await build({
  stdin: {
    contents: [
      "import MarkdownIt from 'markdown-it';",
      "import { katex } from '@mdit/plugin-katex';",
      "import hljs from 'highlight.js/lib/core';",
      "import cpp from 'highlight.js/lib/languages/cpp';",
      "import python from 'highlight.js/lib/languages/python';",
      "import javascript from 'highlight.js/lib/languages/javascript';",
      "hljs.registerLanguage('cpp', cpp);",
      "hljs.registerLanguage('python', python);",
      "hljs.registerLanguage('javascript', javascript);",
      'export { MarkdownIt, katex, hljs };'
    ].join('\n'),
    resolveDir: resolve('.')
  },
  outfile: output + '/blog.js',
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'BlogVendor',
  target: 'es2020',
  legalComments: 'none',
  metafile: true
});

const katex = 'node_modules/katex/dist';
const css = await readFile(katex + '/katex.min.css', 'utf8');
await mkdir(output + '/fonts', { recursive: true });
for (const file of await readdir(katex + '/fonts')) {
  if (file.endsWith('.woff2')) await copyFile(katex + '/fonts/' + file, output + '/fonts/' + file);
}
await writeFile(output + '/katex.css', css.replace(/,url\([^)]*\.(?:woff|ttf)\) format\([^)]*\)/g, ''));

const dependencyRoots = new Set();
for (const input of Object.keys(metafile.inputs)) {
  const matches = [...input.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g)];
  const last = matches.at(-1);
  if (last) dependencyRoots.add(input.slice(0, last.index + last[0].length));
}
const notices = [];
for (const root of [...dependencyRoots].sort()) {
  const manifest = JSON.parse(await readFile(root + '/package.json', 'utf8'));
  const license = (await readdir(root)).find(file => /^licen[cs]e(?:[.-]|$)/i.test(file));
  if (!license) throw new Error('Missing license for ' + manifest.name);
  notices.push(manifest.name + ' ' + manifest.version + '\n\n' + (await readFile(root + '/' + license, 'utf8')).trim());
}
await writeFile(output + '/LICENSES.txt', notices.join('\n\n' + '-'.repeat(72) + '\n\n') + '\n');
