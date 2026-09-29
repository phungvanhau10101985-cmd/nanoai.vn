const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const html = fs.readFileSync(path.join(tmp, 'gudo-live-nocookie.html'), 'utf8');

// Find all occurrences of bunny cdn
let pos = 0;
let count = 0;
while (true) {
  const idx = html.indexOf('gudo-vn-3f93.b-cdn.net', pos);
  if (idx === -1) break;
  count++;
  console.log(`=== OCCURRENCE #${count} at ${idx} ===`);
  const start = Math.max(0, idx - 400);
  const end = Math.min(html.length, idx + 400);
  console.log(html.slice(start, end));
  console.log('--------------------------------------------------\n');
  pos = idx + 22;
}
