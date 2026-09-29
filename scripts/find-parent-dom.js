const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const html = fs.readFileSync(path.join(tmp, 'gudo-live-nocookie.html'), 'utf8');

const target = 'data-pw-pdp-slot="detail-images"';
const idx = html.indexOf(target);
console.log('Index:', idx);
if (idx >= 0) {
  // Let's print 1500 chars before target to see its parent structure
  console.log(html.slice(Math.max(0, idx - 1500), idx + 200));
}
