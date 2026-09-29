const fs = require('fs');
const path = require('path');
const tmp = process.env.TEMP || 'C:\\Users\\Mr Hau\\AppData\\Local\\Temp';
const css = fs.readFileSync(path.join(tmp, 'gudo-shop-theme.css'), 'utf8');
const html = fs.readFileSync(path.join(tmp, 'gudo-live-nocookie.html'), 'utf8');

console.log('=== CSS rules for pw-shop-product-detail ===');
const re = /([^{}]*pw-shop-product-detail[^{}]*\{[^}]*\})/g;
let m;
while ((m = re.exec(css)) !== null) {
  console.log(m[1].trim());
}

console.log('=== In HTML styles for pw-shop-product-detail ===');
while ((m = re.exec(html)) !== null) {
  console.log(m[1].trim());
}
