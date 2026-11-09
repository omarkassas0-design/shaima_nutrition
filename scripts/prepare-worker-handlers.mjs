import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacy = path.join(root, 'worker', 'src', 'legacy');
const functions = path.join(legacy, 'functions');
const names = fs.readdirSync(functions, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of names) {
  const file = path.join(functions, name, 'entry.ts');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replaceAll("npm:@base44/sdk@0.8.40", "../../../compat/platform-sdk.js");
  fs.writeFileSync(file, source, 'utf8');
}

const shared = path.join(legacy, 'shared');
for (const file of fs.readdirSync(shared).filter((entry) => entry.endsWith('.ts')).map((entry) => path.join(shared, entry))) {
  let source = fs.readFileSync(file, 'utf8');
  source = source.replaceAll("npm:@base44/sdk@0.8.40", "../../compat/platform-sdk.js");
  fs.writeFileSync(file, source, 'utf8');
}

const imports = names.map((name, index) => `import handler${index} from './legacy/functions/${name}/entry.ts';`).join('\n');
const map = names.map((name, index) => `  ${JSON.stringify(name)}: handler${index},`).join('\n');
const output = `${imports}\n\nexport const handlers = {\n${map}\n};\n`;
fs.writeFileSync(path.join(root, 'worker', 'src', 'handler-map.js'), output, 'utf8');
console.log(`Prepared ${names.length} Worker handler imports.`);
