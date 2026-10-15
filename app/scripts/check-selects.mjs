import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = fileURLToPath(new URL('../src/', import.meta.url));
const failures = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.[jt]sx?$/.test(entry.name) && file !== path.join(source, 'components', 'SearchableSelect.jsx') && /<select\b/.test(await readFile(file, 'utf8'))) failures.push(path.relative(source, file));
  }
}
await walk(source);
if (failures.length) {
  console.error('Use SearchableSelect for every new select:\n' + failures.join('\n'));
  process.exitCode = 1;
} else console.log('All select controls use SearchableSelect.');
