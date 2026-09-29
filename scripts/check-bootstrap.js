const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const html = fs.readFileSync(path.join(tmp, 'gudo-live-nocookie.html'), 'utf8');

console.log('Includes hideBrokenPdpImgs:', html.includes('hideBrokenPdpImgs'));
const idx = html.indexOf('hideBrokenPdpImgs');
if (idx >= 0) {
  console.log('Snippet of hideBrokenPdpImgs:', html.slice(idx, idx + 500));
}
