#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['assets', 'original-wix', 'node_modules', 'docs', '.git', '.github']);

let filesScanned = 0;
let blocksFound = 0;
let errors = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.html')) {
        processFile(fullPath);
      }
    }
  }
}

function processFile(filePath) {
  filesScanned++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(ROOT, filePath);
  
  // Find all script tags with type application/ld+json
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocksFound++;
    const jsonContent = match[1].trim();
    if (jsonContent === '') {
      errors.push(`${relativePath}: empty JSON-LD script block`);
      continue;
    }
    try {
      JSON.parse(jsonContent);
    } catch (e) {
      errors.push(`${relativePath}: ${e.message}`);
    }
  }
}

walk(ROOT);
console.log(`Summary: ${filesScanned} HTML files scanned, ${blocksFound} JSON-LD blocks found.`);
if (errors.length > 0) {
  console.error(`\nErrors:`);
  for (const err of errors) {
    console.error(`  ${err}`);
  }
  process.exit(1);
}
process.exit(0);
