/**
 * Meta click id (`_fbc`) / browser id (`_fbp`).
 * `_fbc` = `fb.{subdomainIndex}.{creationTimeMs}.{fbclid}`.
 * subdomainIndex: `com` = 0, `example.com` = 1, `www.example.com` = 2.
 */

const FBC_RE = /^fb\.(\d{1,3})\.(\d{13})\.(\S+)$/
const FBP_RE = /^fb\.(\d{1,3})\.(\d{13})\.(\d+)$/

export function metaClickSubdomainIndex(hostname: string | null | undefined): number {
  const parts = String(hostname ?? '')
    .trim()
    .toLowerCase()
    .split('.')
    .filter(Boolean)
  if (parts.length === 0) return 1
  return Math.max(0, parts.length - 1)
}

export function normalizeMetaFbc(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  if (!v || v.length > 512) return null
  const match = FBC_RE.exec(v)
  if (!match) return null
  const fbclid = match[3] ?? ''
  if (fbclid.length < 1 || fbclid.length > 400) return null
  return v
}

export function normalizeMetaFbp(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  if (!v || v.length > 200) return null
  return FBP_RE.test(v) ? v : null
}

/** ID khách ổn định (user / guest account). Meta không bắt buộc băm. */
export function normalizeMetaExternalId(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  if (!v || v.length > 128 || v.includes('@') || /\s/.test(v)) return null
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(v)) return null
  return v
}

/** Ghi `_fbc` từ `fbclid` trước khi Pixel bắn PageView. */
export function metaClickIdHeadBootstrapJs(): string {
  return `(function(){try{var host=String(location.hostname||'').split('.').filter(Boolean);var idx=Math.max(0,host.length-1);function read(name){var parts=document.cookie.split('; ');for(var i=0;i<parts.length;i++){if(parts[i].indexOf(name+'=')===0){try{return decodeURIComponent(parts[i].slice(name.length+1));}catch(e){return parts[i].slice(name.length+1);}}}return '';}function write(name,value){var secure=location.protocol==='https:'?';Secure':'';document.cookie=name+'='+encodeURIComponent(value)+';path=/;max-age=7776000;SameSite=Lax'+secure;}var clid='';try{clid=(new URLSearchParams(location.search).get('fbclid')||'').trim();}catch(e){}if(!clid||clid.length<8||clid.length>400||clid.indexOf(' ')!==-1)return;var fbc=read('_fbc');var suffix='.'+clid;if(!(fbc&&fbc.slice(-suffix.length)===suffix)){fbc='fb.'+idx+'.'+Date.now()+'.'+clid;}write('_fbc',fbc);}catch(e){}})();`
}
