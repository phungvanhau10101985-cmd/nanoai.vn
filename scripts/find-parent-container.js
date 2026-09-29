const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const html = fs.readFileSync(path.join(tmp, 'gudo-live-nocookie.html'), 'utf8');

const target = 'data-pw-pdp-slot="tabs"';
const idx = html.indexOf(target);
console.log('Index:', idx);
if (idx >= 0) {
  console.log(html.slice(Math.max(0, idx - 1000), idx + 100));
}
