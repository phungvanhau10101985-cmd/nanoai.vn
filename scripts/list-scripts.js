const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const html = fs.readFileSync(path.join(tmp, 'gudo-live-nocookie.html'), 'utf8');

const scripts = html.match(/<script\b[^>]*>/gi) || [];
console.log('scripts count:', scripts.length);
scripts.forEach(s => {
  if (s.includes('pw-shop-runtime') || s.includes('pdp') || s.includes('src=')) {
    console.log(' ', s);
  }
});
