import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

export function buildPartnerSiteNewsletterBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const t = getPartnerSiteShopCopy(input.locale)
  const ph = JSON.stringify(t.footerNewsletterPlaceholder)
  const ok = JSON.stringify(t.footerNewsletterOk)
  const err = JSON.stringify(t.footerNewsletterError)
  const api = JSON.stringify(`/api/site/${encodeURIComponent(slug)}/newsletter`)
  return `<script data-pw-newsletter-bootstrap>
(function(){
  if (window.__pwNewsletterBound) return;
  window.__pwNewsletterBound = 1;
  var API = ${api};
  var OK = ${ok};
  var ERR = ${err};
  var PH = ${ph};
  document.querySelectorAll('[data-pw-newsletter], form.pw-newsletter').forEach(function(form){
    if (!form || form.getAttribute('data-pw-newsletter-live')) return;
    form.setAttribute('data-pw-newsletter-live','1');
    var input = form.querySelector('input[type="email"], input[name="email"]');
    if (input && !input.getAttribute('placeholder')) input.setAttribute('placeholder', PH);
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var email = input && input.value ? String(input.value).trim() : '';
      var btn = form.querySelector('button');
      if (btn) btn.disabled = true;
      fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({email:email})})
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok && j && j.ok, j:j}; }); })
        .then(function(res){
          var note = form.querySelector('[data-pw-newsletter-status]') || document.createElement('p');
          note.setAttribute('data-pw-newsletter-status','1');
          note.style.fontSize = '12px';
          note.style.margin = '8px 0 0';
          note.textContent = res.ok ? OK : ERR;
          if (!note.parentNode) form.appendChild(note);
        })
        .catch(function(){
          var note = form.querySelector('[data-pw-newsletter-status]') || document.createElement('p');
          note.setAttribute('data-pw-newsletter-status','1');
          note.style.fontSize = '12px';
          note.textContent = ERR;
          if (!note.parentNode) form.appendChild(note);
        })
        .finally(function(){ if (btn) btn.disabled = false; });
    });
  });
})();
</script>`
}
