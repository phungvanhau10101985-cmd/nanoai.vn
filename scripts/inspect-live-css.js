const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const css = fs.readFileSync(path.join(tmp, 'gudo-shop-theme.css'), 'utf8');

console.log('css length:', css.length);
console.log('has content-visibility:', css.includes('content-visibility'));
console.log('has pw-pdp-detail-photos:', css.includes('pw-pdp-detail-photos'));
if (css.includes('pw-pdp-detail-photos')) {
  const idx = css.indexOf('pw-pdp-detail-photos');
  console.log('snippet:', css.slice(Math.max(0, idx - 100), idx + 200));
}
