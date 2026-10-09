/* Builds dashboards/_shared/project-stories.js from the Architape website project pages
   (QWeb templates in the website repo). Text and photographs are copied exactly as published;
   only the sales call-to-action and button labels are left out.

   node tools/dashboard_runner/build_project_stories.mjs [path/to/site-pages/projects] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.resolve(process.argv[2] || 'C:/Users/slunn/Projects/Work/Architape Website V2/website/xml_pages/site-pages/projects');
const dest = path.join(root, 'dashboards/_shared/project-stories.js');

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', times: '×', deg: '°', middot: '·', eacute: 'é', reg: '®', trade: '™' };
function text(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : entities[e.toLowerCase()] ?? m)
        .replace(/\s+/g, ' ')
        .trim();
}
const attr = (tag, name) => text((new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1]);
const between = (html, start, end) => { const a = html.indexOf(start); if (a < 0) return ''; const b = end ? html.indexOf(end, a) : -1; return html.slice(a, b < 0 ? undefined : b); };
const first = (html, cls) => { const m = new RegExp(`<(\\w+)[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`).exec(html); return m ? text(m[2]) : ''; };

function parse(file) {
    const html = fs.readFileSync(file, 'utf8');
    const slug = path.basename(file, path.extname(file));
    let article = {};
    try { article = (JSON.parse((/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html) || [])[1] || '{}')['@graph'] || []).find(n => n['@type'] === 'Article') || {}; } catch (_) { /* Structured data is optional. */ }
    const heroTag = (/<img[^>]*class="[^"]*\bat-hero-img\b[^"]*"[^>]*>/.exec(html) || [''])[0];
    const specBlock = html.slice(Math.max(0, html.lastIndexOf('<section', html.indexOf('at-spec-value'))), html.indexOf('id="project-story"'));
    const specs = [...specBlock.matchAll(/class="[^"]*\bat-label\b[^"]*">([\s\S]*?)<\/span>\s*<span[^>]*class="[^"]*\bat-spec-value\b[^"]*">([\s\S]*?)<\/span>/g)].map(m => ({ label: text(m[1]), value: text(m[2]) }));
    // Story blocks in document order: headings, paragraphs, eyebrows, callouts and photographs.
    const story = between(html, 'id="project-story"', 'id="products-specified"');
    const blocks = [], images = [];
    const token = /<img\b[^>]*>|<(h2|h3|p|span|strong)\b([^>]*)class="([^"]*)"([^>]*)>([\s\S]*?)<\/\1>/g;
    for (const m of story.matchAll(token)) {
        if (m[0].startsWith('<img')) { const src = attr(m[0], 'src'); if (src && !images.some(i => i.src === src)) images.push({ src, alt: attr(m[0], 'alt') }); continue; }
        const cls = m[3], value = text(m[5]);
        if (!value) continue;
        const type = /\bat-h2\b/.test(cls) ? 'h2' : /\bat-h3\b/.test(cls) ? 'h3' : /\bat-body\b/.test(cls) ? 'p' : /\bat-eyebrow\b/.test(cls) ? 'eyebrow' : /\bat-label\b/.test(cls) ? 'label' : /\bat-callout-text\b/.test(cls) ? 'callout' : null;
        if (type) blocks.push({ type, text: value });
    }
    const productsHtml = between(html, 'id="products-specified"', 'at-cta-title');
    const products = [...productsHtml.matchAll(/<div class="card\b[\s\S]*?class="[^"]*\bat-card-title\b[^"]*">([\s\S]*?)<\/h3>/g)].map(m => ({
        name: text(m[1]),
        category: first(m[0].slice(m[0].lastIndexOf('card-body')), 'at-label'),
        tag: first(m[0], 'at-badge')
    }));
    const hero = attr(heroTag, 'src') || article.image || '';
    if (hero && !images.some(i => i.src === hero)) images.unshift({ src: hero, alt: attr(heroTag, 'alt') });
    return {
        slug,
        title: first(html, 'at-hero-title'),
        meta: first(html, 'at-hero-meta'),
        headline: text(article.headline),
        description: text(article.description),
        url: text(article.url),
        specs, blocks, images, products
    };
}

const files = fs.readdirSync(source).filter(f => /\.(txt|xml)$/i.test(f)).sort();
if (!files.length) throw new Error('No project pages found in ' + source);
const projects = files.map(f => parse(path.join(source, f)));
for (const p of projects) {
    if (!p.title || !p.blocks.some(b => b.type === 'p') || !p.images.length) throw new Error(`${p.slug}: title, story text or photographs not found; has the page structure changed?`);
}
const generated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(dest, `/* Generated ${generated} by tools/dashboard_runner/build_project_stories.mjs from the Architape website
   project pages. Do not edit by hand; rebuild after the website pages change. */
window.ProjectStories = ${JSON.stringify({ generated, source: 'Architape website · Projects', projects }, null, 1)};
`);
console.log(`${projects.length} projects → ${path.relative(root, dest)}`);
for (const p of projects) console.log(`  ${p.slug}: ${p.blocks.length} text blocks, ${p.blocks.map(b => b.text).join(' ').split(' ').length} words, ${p.images.length} photos, ${p.products.length} products, ${p.specs.length} specs`);
