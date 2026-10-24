#!/usr/bin/env node

// Compare a page on the working tree with the same page on another git ref
// (main by default), for checking the plain-HTML rebuilds in #167.
//
// Usage:
//   node scripts/compare-page.mjs <page.html> [--base main] [--widths 320,375,1280]
//                                 [--threshold 3] [--out <dir>]
//
// For each width it prints the page width (flagging sideways scroll), then
// pairs headings, links and images on both sides by their text or image file
// and lists the ones whose position or size differs by more than the
// threshold (px). Screenshots of both sides are saved to the output folder
// and reported as identical or not.
//
// Needs Google Chrome. Set CHROME to its path if it isn't in the usual place.
// Headless Chrome won't make a window narrower than 500px, so pages are
// loaded inside iframes of the target width.

import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);
const ROOT = process.cwd();

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const page = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!page || !fs.existsSync(path.join(ROOT, page))) {
  console.error('Usage: node scripts/compare-page.mjs <page.html> [--base main] [--widths 320,375,1280] [--threshold 3] [--out <dir>]');
  process.exit(2);
}
const base = opt('base', 'main');
const widths = opt('widths', '320,375,1280').split(',').map(Number);
const threshold = Number(opt('threshold', 3));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-page-'));
const out = opt('out', tmp);
fs.mkdirSync(out, { recursive: true });

const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('Google Chrome not found. Set CHROME to its path.');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

// Runs in the browser: loads the page in one iframe per width and reports the
// layout as JSON in #o.
const PROBE = `<!doctype html><body style="margin:0"><pre id="o"></pre><script>
const q = new URLSearchParams(location.search);
const page = q.get('page'), widths = q.get('widths').split(',').map(Number);
const result = {};
const skip = 'header, nav, site-header, #SITE_HEADER, .mob-menu-bar';
const clean = (t) => (t || '').replace(/\\u200b/g, '').replace(/\\s+/g, ' ').trim();
for (const w of widths) {
  const f = document.createElement('iframe');
  f.style.cssText = 'width:' + w + 'px;height:2000px;border:0;display:block';
  f.src = '/' + page;
  document.body.appendChild(f);
  f.onload = () => setTimeout(() => f.contentDocument.fonts.ready.then(() => {
    const d = f.contentDocument, seen = {}, items = [];
    const add = (kind, label, el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest(skip)) return;
      if (f.contentWindow.getComputedStyle(el).visibility === 'hidden') return;
      const key = kind + ': ' + label;
      seen[key] = (seen[key] || 0) + 1;
      items.push({ key: seen[key] > 1 ? key + ' #' + seen[key] : key,
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    };
    d.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((e) => clean(e.textContent) && add('heading', clean(e.textContent).slice(0, 50), e));
    d.querySelectorAll('a[href]').forEach((e) => clean(e.textContent) && add('link', clean(e.textContent).slice(0, 50), e));
    d.querySelectorAll('img').forEach((e) => add('img', (e.currentSrc || e.src).split('/').pop().slice(-40), e));
    const foot = d.querySelector('.site-footer, #SITE_FOOTER, footer');
    if (foot) add('footer', 'top', foot);
    result[w] = { docW: d.documentElement.scrollWidth, docH: d.documentElement.scrollHeight, items };
    if (Object.keys(result).length === widths.length) document.getElementById('o').textContent = JSON.stringify(result);
  }), 1500);
}
</script>`;

// Single iframe of one width, for screenshots below Chrome's 500px minimum.
const FRAME = `<!doctype html><body style="margin:0;background:#fff"><script>
const q = new URLSearchParams(location.search);
document.write('<iframe src="/' + q.get('page') + '" style="width:' + q.get('w') + 'px;height:' + q.get('h') + 'px;border:0;display:block"></iframe>');
</script>`;

function serve(root) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__probe.html') return res.end(PROBE);
    if (url.pathname === '/__frame.html') return res.end(FRAME);
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Each Chrome run gets its own profile so parallel runs don't wait on a lock.
let runs = 0;
const chrome = (extra, url) => run(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--user-data-dir=${path.join(tmp, `chrome-${++runs}`)}`, '--virtual-time-budget=15000', ...extra, url,
], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 });

async function measure(port) {
  const { stdout } = await chrome(['--window-size=1400,900', '--dump-dom'],
    `http://127.0.0.1:${port}/__probe.html?page=${encodeURIComponent(page)}&widths=${widths.join(',')}`);
  const m = stdout.match(/<pre id="o">([\s\S]*?)<\/pre>/);
  if (!m || !m[1]) throw new Error(`no layout data from ${page} (port ${port})`);
  return JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
}

async function screenshot(port, w, h, file) {
  const url = w < 500
    ? `http://127.0.0.1:${port}/__frame.html?page=${encodeURIComponent(page)}&w=${w}&h=${h}`
    : `http://127.0.0.1:${port}/${page}`;
  await chrome([`--window-size=${Math.max(w, 500)},${h}`, `--screenshot=${file}`], url);
}

const worktree = path.join(tmp, 'base');
execFileSync('git', ['worktree', 'add', '--detach', '--quiet', worktree, base]);
// Remove the worktree and Chrome profiles; the screenshots stay in `out`.
const cleanup = () => {
  try { execFileSync('git', ['worktree', 'remove', '--force', worktree]); } catch {}
  for (const f of fs.readdirSync(tmp)) {
    if (f.startsWith('chrome-')) fs.rmSync(path.join(tmp, f), { recursive: true, force: true });
  }
};
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

try {
  const [baseServer, headServer] = await Promise.all([serve(worktree), serve(ROOT)]);
  const ports = { base: baseServer.address().port, head: headServer.address().port };
  const [before, after] = await Promise.all([measure(ports.base), measure(ports.head)]);

  console.log(`${page}: ${base} vs working tree (threshold ${threshold}px)\n`);
  let problems = 0;
  for (const w of widths) {
    const a = before[w], b = after[w];
    const scroll = (d) => (d.docW > w ? `${d.docW}px, SIDEWAYS SCROLL` : `${d.docW}px`);
    console.log(`== ${w}px  page width: ${base} ${scroll(a)} | branch ${scroll(b)}`);
    if (b.docW > w) problems++;

    const bByKey = new Map(b.items.map((i) => [i.key, i]));
    const aKeys = new Set(a.items.map((i) => i.key));

    // A layout that is centred differently shifts everything sideways by the
    // same amount; report that once and compare the rest relative to it.
    const dxs = a.items.filter((i) => bByKey.has(i.key)).map((i) => bByKey.get(i.key).x - i.x).sort((p, q) => p - q);
    const shift = dxs.length ? dxs[Math.floor(dxs.length / 2)] : 0;
    const dx0 = Math.abs(shift) > threshold ? shift : 0;
    if (dx0) console.log(`  most elements are ${Math.abs(dx0)}px further ${dx0 < 0 ? 'left' : 'right'}; x is compared after allowing for that`);

    let matched = 0;
    for (const i of a.items) {
      const j = bByKey.get(i.key);
      if (!j) continue;
      // x matches with or without the shift (some things stay put, e.g. a
      // footer centred on the window).
      const dx = j.x - i.x;
      const d = [Math.abs(dx - dx0) < Math.abs(dx) ? dx - dx0 : dx, j.y - i.y, j.w - i.w, j.h - i.h];
      if (d.every((v) => Math.abs(v) <= threshold)) {
        matched++;
        continue;
      }
      problems++;
      const fmt = ['x', 'y', 'w', 'h'].map((k, n) => (d[n] ? `${k} ${i[k]}→${j[k]}` : null)).filter(Boolean).join(', ');
      console.log(`  moved  ${i.key}: ${fmt}`);
    }
    for (const i of a.items) if (!bByKey.has(i.key)) console.log(`  only in ${base}: ${i.key}`);
    for (const j of b.items) if (!aKeys.has(j.key)) console.log(`  only in branch: ${j.key}`);
    console.log(`  ${matched} of ${a.items.length} elements within ${threshold}px\n`);

    const h = Math.min(Math.max(a.docH, b.docH), 8000);
    const files = ['base', 'branch'].map((s) => path.join(out, `${path.basename(page, '.html')}-${w}-${s}.png`));
    await screenshot(ports.base, w, h, files[0]);
    await screenshot(ports.head, w, h, files[1]);
    const same = fs.readFileSync(files[0]).equals(fs.readFileSync(files[1]));
    console.log(`  screenshots ${same ? 'IDENTICAL' : 'differ'}: ${files[0]}\n${' '.repeat(16)}${files[1]}\n`);
  }

  baseServer.close();
  headServer.close();
  console.log(problems ? `${problems} difference(s) to review.` : 'No differences over the threshold.');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
