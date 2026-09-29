const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const html = fs.readFileSync(path.join(tmp, 'gudo-live-desktop.html'), 'utf8');

console.log('desktop html length:', html.length);
const m = html.match(/data-pw-edit-device="([^"]+)"/);
console.log('edit-device:', m ? m[1] : null);
const bunnyMatches = html.match(/gudo-vn-3f93\.b-cdn\.net[^\s"'>]+/g) || [];
console.log('desktop bunny urls count:', bunnyMatches.length);

const target = 'data-pw-pdp-slot="detail-images"';
const idx = html.indexOf(target);
console.log('detail-images idx in desktop:', idx);
