const fs = require('fs');
const path = require('path');

const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const html = fs.readFileSync(path.join(tmp, 'gudo-live-nocookie.html'), 'utf8');

console.log('html length:', html.length);
console.log('has lazyNotStarted:', html.includes('lazyNotStarted'));
console.log('has content-visibility:visible:', html.includes('content-visibility:visible'));
const editDeviceMatch = html.match(/data-pw-edit-device="([^"]+)"/);
console.log('data-pw-edit-device:', editDeviceMatch ? editDeviceMatch[1] : null);
const pageMatch = html.match(/data-pw-page="([^"]+)"/);
console.log('data-pw-page:', pageMatch ? pageMatch[1] : null);

const bunnyMatches = html.match(/gudo-vn-3f93\.b-cdn\.net[^\s"'>]+/g) || [];
console.log('bunny urls count:', bunnyMatches.length);
bunnyMatches.forEach((u, i) => console.log(` [${i}]:`, u));

const cssMatch = html.match(/\/api\/site\/[^"'>]+shop-theme\.css[^"'>]*/);
console.log('cssUrl:', cssMatch ? cssMatch[0] : null);
