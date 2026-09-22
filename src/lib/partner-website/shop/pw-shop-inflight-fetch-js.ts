/**
 * Một GET / in-flight cho mọi script storefront (chrome + personalization + prompt).
 * MutationObserver / hydrate song song dùng chung promise — không stampede pool PG.
 */
export const PW_SHOP_INFLIGHT_FETCH_JS = `
function pwShopInflight(key,factory){
  var bag=window.__pwShopInflight||(window.__pwShopInflight={});
  if(bag[key])return bag[key];
  var started;
  try{started=factory();}catch(errStart){return Promise.reject(errStart);}
  bag[key]=started;
  Promise.resolve(started).then(function(){},function(){}).then(function(){
    if(bag[key]===started)delete bag[key];
  });
  return started;
}
function pwShopInflightFetch(url,headers){
  return pwShopInflight(String(url||''),function(){
    return fetch(url,{credentials:'same-origin',headers:headers||{}}).then(function(r){
      return r.json().then(function(j){
        return {ok:r.ok,status:r.status,j:j,res:r};
      }).catch(function(){
        return {ok:false,status:r.status,j:null,res:r};
      });
    });
  });
}
`
