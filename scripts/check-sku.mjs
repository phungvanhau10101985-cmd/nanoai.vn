import pg from 'pg';
import fs from 'fs';

let connectionString = process.env.DATABASE_URL;
if (!connectionString && fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  for (const line of content.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      connectionString = line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
}

const pool = new pg.Pool({ connectionString });
const res = await pool.query(
  'select id, sku, image_url, gallery_urls, detail_image_urls, product_info_json from messaging_partner_inventory where sku = $1',
  ['Cy3139']
);
console.log(JSON.stringify(res.rows[0], null, 2));
await pool.end();
