import fs from 'node:fs';
import path from 'node:path';

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });

let updated = 0;
for (const file of walk(path.join(process.cwd(), 'src')).filter((name) => /\.(js|jsx)$/.test(name))) {
  const original = fs.readFileSync(file, 'utf8');
  const next = original
    .replaceAll('@/api/base44Client', '@/api/appClient')
    .replaceAll('{ base44 }', '{ appClient }')
    .replace(/\bbase44\./g, 'appClient.');
  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    updated += 1;
  }
}
console.log(`Updated ${updated} frontend files.`);
