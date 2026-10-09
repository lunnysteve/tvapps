import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Studio pages only. The 3D pages (goods-in-24hrs, goods-out-24hrs, manufacturing-24hrs,
// subscriptions) and weather-forecast are hand-written and are not generated here.
const pages = {
    'charging-status': ['charging', 'overview', 'EV chargepoints'],
    'shipping_weight-overview': ['shipping', 'overview', 'Shipping weight'],
    website_projects: ['projects', 'overview', 'Projects and stories', ['project-stories.js']],
    'digital-clock': ['clock', 'overview', 'Office clock'],
    'lunch-timer': ['lunch', 'overview', 'Lunch break'],
    'end-of-day': ['home', 'overview', 'Hometime']
};
for (const [file, [kind, view, title, extra = []]] of Object.entries(pages)) {
    const dest = path.join(root, 'dashboards', file + '.html');
    fs.writeFileSync(dest, `<!doctype html>
<html lang="en-GB">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title>${title} — Architainment</title>
    <link rel="stylesheet" href="_shared/dashboard-studio.css">
    <script src="_shared/dashboard-data.js" defer></script>
${extra.map(script => `    <script src="_shared/${script}" defer></script>
`).join('')}    <script src="_shared/dashboard-studio.js" defer></script>
</head>
<body data-dashboard="${kind}" data-view="${view}">
    <div id="dashboard"></div>
    <noscript><p style="padding:40px">JavaScript is required to display this dashboard and retrieve current data.</p></noscript>
</body>
</html>
`);
}
console.log(`Built ${Object.keys(pages).length} dashboards.`);
