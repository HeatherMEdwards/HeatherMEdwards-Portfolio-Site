#!/usr/bin/env node
/**
 * Generates the CollectionPage + ItemList JSON-LD block for each writing
 * section page (issue #148) from the article links/images actually present
 * in the page, so the markup can't drift from the content.
 *
 * Usage: node scripts/generate-collection-jsonld.mjs
 *
 * Rules applied (from issue #148 and its comments):
 * - headline = the visible link text (or slider image alt text on Interviews)
 * - tracking query strings stripped from article URLs
 * - publisher from visible "Published in X" labels when present (Faith),
 *   otherwise from the link domain, with named overrides
 * - links/images with no visible headline are omitted, never invented
 */

import fs from 'fs';

const SITE = 'https://heathermedwards.com';
const PERSON = { '@id': `${SITE}/#person` };
const WEBSITE = { '@id': `${SITE}/#website` };

const PAGES = ['politics', 'culture', 'faith', 'humanrights', 'interviews'];

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“',
  rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', copy: '©',
  ndash: '–', mdash: '—', hellip: '…', eacute: 'é', Eacute: 'É',
  igrave: 'ì', iacute: 'í', ntilde: 'ñ', ouml: 'ö', uuml: 'ü',
  aacute: 'á', egrave: 'è', oacute: 'ó', uacute: 'ú', dollar: '$',
  times: '×', deg: '°', reg: '®', trade: '™', sect: '§',
};

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, body) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? full : String.fromCodePoint(code);
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? full : String.fromCodePoint(code);
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)
      ? NAMED_ENTITIES[body]
      : full;
  });
}

function cleanText(text) {
  return decodeEntities(text)
    .replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuery(url) {
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  let cut = -1;
  if (q !== -1 && (h === -1 || q < h)) cut = q;
  else if (h !== -1) cut = h;
  return cut === -1 ? url : url.slice(0, cut);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isArticleHost(host) {
  return (
    host === 'medium.com' ||
    host.endsWith('.medium.com') ||
    host === 'substack.com' ||
    host.endsWith('.substack.com') ||
    host.endsWith('goodmenproject.com') ||
    host.endsWith('rotarydistrict5110.com')
  );
}

function publisherFromHost(host) {
  if (host === 'rotaryeclubofsiliconvalley.substack.com') return 'Rotary E-Club of Silicon Valley';
  if (host.endsWith('rotarydistrict5110.com')) return 'Rotary District 5110';
  if (host === 'medium.com' || host.endsWith('.medium.com')) return 'Medium';
  if (host === 'substack.com' || host.endsWith('.substack.com')) return 'Substack';
  if (host.endsWith('goodmenproject.com')) return 'The Good Men Project';
  return null;
}

/** Walk the body, yielding { kind: 'text'|'anchor', ... } in document order. */
function* walkBody(rawBody) {
  const bodyHtml = rawBody
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let last = 0;
  let m;
  while ((m = anchorRe.exec(bodyHtml)) !== null) {
    const between = bodyHtml.slice(last, m.index);
    if (between.replace(/<[^>]*>/g, '').trim()) {
      yield { kind: 'text', text: between.replace(/<[^>]*>/g, ' ') };
    }
    last = m.index + m[0].length;
    const hrefM = m[1].match(/href="([^"]*)"/i);
    const text = cleanText(m[2].replace(/<[^>]*>/g, ' '));
    yield { kind: 'anchor', href: hrefM ? decodeEntities(hrefM[1]) : null, text };
  }
  const rest = bodyHtml.slice(last).replace(/<[^>]*>/g, ' ');
  if (rest.trim()) yield { kind: 'text', text: rest };
}

function buildArticle({ headline, url, publisher, image, about }) {
  const article = {
    '@type': 'Article',
    headline,
  };
  if (url) article.url = url;
  if (image) article.image = image;
  article.author = { ...PERSON };
  if (publisher) article.publisher = { '@type': 'Organization', name: publisher };
  if (about) article.about = about;
  return article;
}

function collectFromLinks(bodyHtml) {
  const items = [];
  let publishedIn = null;
  for (const token of walkBody(bodyHtml)) {
    if (token.kind === 'text') {
      const t = cleanText(token.text);
      // "Published in X" labels (Faith page) apply to the links that follow.
      const idx = t.lastIndexOf('Published in ');
      if (idx !== -1) publishedIn = t.slice(idx + 'Published in '.length).trim() || null;
      continue;
    }
    const { href, text } = token;
    if (!href || !/^https?:\/\//i.test(href)) continue;
    const host = hostOf(href);
    if (!isArticleHost(host)) continue;
    if (!text) continue; // no visible headline -> omit, never invent one

    const url = stripQuery(href);
    const prev = items[items.length - 1];
    if (prev && prev.url === url) {
      // Same article split across consecutive links (e.g. Faith headline)
      prev.headline = `${prev.headline} ${text}`.replace(/\s+/g, ' ').trim();
      continue;
    }
    items.push(buildArticle({
      headline: text,
      url,
      publisher: publishedIn || publisherFromHost(host),
    }));
  }
  return items;
}

const LANE_COUNTY = 'Lane County Community & Economic Development Program';
const PROJECT_AMIGO = 'Project Amigo';
const GENERIC_ALTS = new Set(['interview portrait', 'interview photograph']);

function collectFromSliderImages(bodyHtml) {
  const items = [];
  for (const m of bodyHtml.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcM = tag.match(/src="([^"]*)"/i);
    const altM = tag.match(/alt="([^"]*)"/i);
    if (!srcM) continue;
    const src = decodeEntities(srcM[1]);
    if (!src.startsWith('assets/Interviews and Features/')) continue;
    const alt = cleanText(altM ? altM[1] : '');
    if (!alt || GENERIC_ALTS.has(alt.toLowerCase())) continue;

    const isLaneCounty = [
      'SeQuential Biofuels Brownfield Cleanup Grant',
      'Oak Patch Gifts Expansion',
      'Lane County $1M Grant for Blue River',
      'RHRP Helping Families',
      'RHRP Helps Seniors Stay in Their Homes',
    ].includes(alt);

    items.push(buildArticle({
      headline: alt,
      image: SITE + '/' + encodeURI(src).replace(/&/g, '%26'),
      publisher: isLaneCounty ? LANE_COUNTY : PROJECT_AMIGO,
      about: isLaneCounty ? undefined : { '@type': 'Person', name: alt },
    }));
  }
  return items;
}

function buildCollectionPage(page, items, meta) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE}/${page}.html#page`,
    url: `${SITE}/${page}.html`,
    name: meta.title,
    description: meta.description,
    isPartOf: { ...WEBSITE },
    author: { ...PERSON },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item,
      })),
    },
  };
}

function scriptBlock(data) {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

function injectIntoHead(html, block) {
  const existing = html.match(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type":\s*"CollectionPage"[\s\S]*?<\/script>/i
  );
  if (existing) {
    return html.slice(0, existing.index) + block + html.slice(existing.index + existing[0].length);
  }
  const marker = '<style id="page-transitions">';
  const at = html.indexOf(marker);
  if (at === -1) throw new Error('insertion point not found');
  return html.slice(0, at) + `${block}\n\n` + html.slice(at);
}

let failed = false;
for (const page of PAGES) {
  const file = `${page}.html`;
  const html = fs.readFileSync(file, 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const body = html.slice(html.indexOf('<body'));

  const title = cleanText(head.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const description = decodeEntities(
    head.match(/name="description"\s+content="([^"]*)"/i)?.[1] ?? ''
  );
  const canonical = head.match(/rel="canonical"\s+href="([^"]*)"/i)?.[1];
  if (canonical && stripQuery(canonical) !== `${SITE}/${page}.html`) {
    console.error(`${file}: canonical ${canonical} does not match expected ${SITE}/${page}.html`);
    failed = true;
  }

  const items = page === 'interviews' ? collectFromSliderImages(body) : collectFromLinks(body);
  if (items.length === 0) {
    console.error(`${file}: no article items found`);
    failed = true;
    continue;
  }

  const jsonld = buildCollectionPage(page, items, { title, description });
  const updated = injectIntoHead(html, scriptBlock(jsonld));
  fs.writeFileSync(file, updated);

  let visibleCount;
  if (page === 'interviews') {
    const cleanBody = body
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '');
    visibleCount = [...cleanBody.matchAll(/<img\b[^>]*>/gi)].filter((m) => {
      const src = decodeEntities(m[0].match(/src="([^"]*)"/i)?.[1] ?? '');
      const alt = cleanText(m[0].match(/alt="([^"]*)"/i)?.[1] ?? '');
      return src.startsWith('assets/Interviews and Features/') && alt && !GENERIC_ALTS.has(alt.toLowerCase());
    }).length;
  } else {
    const seen = new Set();
    for (const t of walkBody(body)) {
      if (t.kind !== 'anchor' || !t.href || !t.text) continue;
      if (!isArticleHost(hostOf(t.href))) continue;
      seen.add(stripQuery(t.href));
    }
    visibleCount = seen.size;
  }

  console.log(
    `${file}: ${items.length} ItemList items (${visibleCount} visible article links counted)`
  );
  if (items.length !== visibleCount) {
    console.error(`${file}: MISMATCH between items and visible article links`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
