/**
 * npm run snapshot
 *
 * Generates PROJECT_SNAPSHOT.md — a single file with the full project tree
 * and source contents, ready to share with a planning agent.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT  = path.join(ROOT, 'PROJECT_SNAPSHOT.md');

// ─── Config ───────────────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', 'dist', '.git', '.cursor',
]);

/** Files included in the "full content" section */
const CONTENT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.json',
  '.html', '.css', '.md',
]);

/** Files always excluded from content (too large / not useful) */
const CONTENT_EXCLUDE = new Set([
  'package-lock.json',
  'PROJECT_SNAPSHOT.md',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walk(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !IGNORE_DIRS.has(e.name))
    .sort((a, b) => {
      // directories first, then files
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [];
  entries.forEach((entry, i) => {
    const isLast      = i === entries.length - 1;
    const connector   = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    lines.push(`${prefix}${connector}${entry.name}`);
    if (entry.isDirectory()) {
      lines.push(...walk(path.join(dir, entry.name), prefix + childPrefix));
    }
  });
  return lines;
}

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, files);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONTENT_EXTENSIONS.has(ext) && !CONTENT_EXCLUDE.has(entry.name)) {
        files.push(full);
      }
    }
  }
  return files;
}

function langTag(file) {
  const ext = path.extname(file).toLowerCase();
  return { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.mjs': 'js',
           '.json': 'json', '.html': 'html', '.css': 'css', '.md': 'md' }[ext] ?? '';
}

// ─── Build output ─────────────────────────────────────────────────────────────

const date = new Date().toISOString().slice(0, 16).replace('T', ' ');

const sections = [];

sections.push(`# Project Snapshot\n\n_Generated: ${date}_\n`);

// File tree
sections.push('## File tree\n\n```\n.' + '\n' + walk(ROOT).join('\n') + '\n```\n');

// File contents
sections.push('## File contents\n');
for (const file of collectFiles(ROOT)) {
  const rel  = path.relative(ROOT, file).replace(/\\/g, '/');
  const body = fs.readFileSync(file, 'utf8').trimEnd();
  sections.push(`### \`${rel}\`\n\n\`\`\`${langTag(file)}\n${body}\n\`\`\`\n`);
}

fs.writeFileSync(OUT, sections.join('\n'), 'utf8');
console.log(`✓ PROJECT_SNAPSHOT.md written (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
