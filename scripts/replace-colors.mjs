import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const replacements = [
  ['from-purple-', 'from-red-'],
  ['to-indigo-', 'to-red-900 '],
  ['to-purple-', 'to-red-'],
  ['from-cyan-', 'from-red-'],
  ['to-cyan-', 'to-red-'],
  ['text-purple-', 'text-red-'],
  ['text-cyan-', 'text-red-'],
  ['bg-purple-', 'bg-red-'],
  ['bg-cyan-', 'bg-red-'],
  ['border-purple-', 'border-red-'],
  ['border-cyan-', 'border-red-'],
  ['ring-purple-', 'ring-red-'],
  ['ring-cyan-', 'ring-red-'],
  ['hover:border-purple-', 'hover:border-red-'],
  ['focus:border-purple-', 'focus:border-red-'],
  ['focus:ring-purple-', 'focus:ring-red-'],
  ['hover:bg-purple-', 'hover:bg-red-'],
  ['hover:from-purple-', 'hover:from-red-'],
  ['hover:to-indigo-', 'hover:to-red-900 '],
  ['hover:to-purple-', 'hover:to-red-'],
  ['hover:text-purple-', 'hover:text-red-'],
];

function walk(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const full = join(dir, file);
    if (file.startsWith('node_modules') || file.startsWith('dist') || file.startsWith('.git')) continue;
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      let content = readFileSync(full, 'utf-8');
      let changed = false;
      for (const [from, to] of replacements) {
        if (content.includes(from)) {
          content = content.replaceAll(from, to);
          changed = true;
        }
      }
      if (changed) {
        writeFileSync(full, content, 'utf-8');
        console.log(`Fixed: ${full}`);
      }
    }
  }
}

walk(join(process.cwd(), 'src'));
console.log('Done!');