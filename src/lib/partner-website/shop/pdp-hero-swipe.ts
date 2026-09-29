/**
 * Mobile PDP hero — horizontal snap carousel (live only).
 * Sửa nhanh returns before this runs. Track is runtime DOM, not saved HTML.
 */
export const PW_PDP_HERO_SWIPE_JS = `function heroSlidePage(url){
  return shopPdpPageSrc(url)||String(url||'').trim();
}
function heroSlideFull(url){
  return shopPdpOrigSrc(url)||String(url||'').trim();
}
function heroIndexFromScroll(track){
  var w=track.clientWidth||0;
  if(w<=0)return 0;
  var n=track.children.length||1;
  return Math.max(0,Math.min(n-1,Math.round(track.scrollLeft/w)));
}
function syncHeroChrome(hero,index){
  var items=hero.__pwHeroItems||[];
  var n=items.length;
  if(!n)return;
  index=Math.max(0,Math.min(n-1,index));
  if(hero.__pwHeroIdx===index)return;
  hero.__pwHeroIdx=index;
  hero.setAttribute('data-pw-hero-index',String(index));
  var count=hero.querySelector('.pw-pdp-hero-count');
  if(!count){
    count=document.createElement('span');
    count.className='pw-pdp-hero-count';
    hero.appendChild(count);
  }
  count.textContent=(index+1)+'/'+n;
  var dots=hero.querySelector('.pw-pdp-hero-dots');
  if(!dots){
    dots=document.createElement('div');
    dots.className='pw-pdp-hero-dots';
    hero.appendChild(dots);
  }
  var spans=dots.querySelectorAll('span');
  if(spans.length!==n){
    dots.textContent='';
    for(var d=0;d<n;d++){
      var span=document.createElement('span');
      if(d===index)span.className='is-active';
      dots.appendChild(span);
    }
  }else{
    for(var s=0;s<spans.length;s++)spans[s].classList.toggle('is-active',s===index);
  }
  for(var i=0;i<n;i++){
    var btn=items[i]&&items[i].btn;
    if(btn)btn.classList.toggle('is-active',i===index);
  }
  var item=items[index];
  if(item&&item.kind==='photo'&&item.full){
    document.querySelectorAll('[data-nanoai-try-on],[data-pw-chrome-btn="try-on"]').forEach(function(el){
      el.setAttribute('data-nanoai-image',item.full);
    });
  }
  hero.querySelectorAll('[data-pw-pdp-hero-slide]').forEach(function(slide,si){
    if(si===index)return;
    slide.querySelectorAll('video').forEach(function(v){try{v.pause();}catch(e){}});
  });
  var activeBtn=item&&item.btn;
  var strip=activeBtn&&activeBtn.parentElement;
  if(activeBtn&&strip&&strip.scrollWidth>strip.clientWidth+8){
    var left=activeBtn.offsetLeft-(strip.clientWidth-activeBtn.offsetWidth)/2;
    try{strip.scrollTo({left:Math.max(0,left),behavior:'smooth'});}catch(e){strip.scrollLeft=Math.max(0,left);}
  }
}
function pwPdpHeroScroll(hero,index,behavior){
  var track=hero.querySelector('[data-pw-pdp-hero-track]');
  if(!track)return;
  var n=track.children.length||1;
  index=Math.max(0,Math.min(n-1,index));
  var w=track.clientWidth||0;
  if(w<=0)return;
  var left=index*w;
  track.__pwProg=1;
  try{track.scrollTo({left:left,behavior:behavior||'auto'});}catch(e){track.scrollLeft=left;}
  syncHeroChrome(hero,index);
  clearTimeout(track.__pwProgTimer);
  track.__pwProgTimer=setTimeout(function(){track.__pwProg=0;},behavior==='smooth'?420:48);
}
function heroCollectItems(hero){
  var nav=hero.querySelector('.pw-pdp-hero-thumbs');
  var items=[];
  if(!nav)return items;
  nav.querySelectorAll('[data-pw-el="thumb"],.pw-shop-product-thumb,[data-pw-pdp-video-thumb]').forEach(function(btn){
    if(btn.hidden||btn.hasAttribute('hidden'))return;
    if(btn.hasAttribute('data-pw-pdp-video-thumb')){
      if(hero.querySelector('[data-pw-pdp-hero-video]'))items.push({kind:'video',btn:btn});
      return;
    }
    if(!btn.hasAttribute('data-pw-el'))btn.setAttribute('data-pw-el','thumb');
    var img=btn.querySelector('img');
    var raw=(img&&(img.getAttribute('data-pw-full-src')||img.getAttribute('src')))||'';
    var page=heroSlidePage(raw);
    if(!page)return;
    items.push({kind:'photo',btn:btn,page:page,full:heroSlideFull(raw),alt:(img&&img.getAttribute('alt'))||''});
  });
  return items;
}
function mountPdpHeroSwipe(hero){
  if(!hero||!hero.classList||!hero.classList.contains('pw-pdp-hero'))return;
  if(!galleryFaceVisible(hero))return;
  var items=heroCollectItems(hero);
  var old=hero.querySelector('[data-pw-pdp-hero-track]');
  if(items.length<2){
    if(old){
      var back=old.querySelector('[data-pw-pdp-hero-video]');
      if(back){back.hidden=true;hero.insertBefore(back,old);}
      old.remove();
    }
    hero.__pwHeroItems=null;
    hero.__pwHeroIdx=null;
    return;
  }
  var sig=items.map(function(it){return it.kind==='video'?'v':it.page;}).join('|');
  var track=old;
  if(!track){
    track=document.createElement('div');
    track.className='pw-pdp-hero-track';
    track.setAttribute('data-pw-pdp-hero-track','1');
    var anchor=hero.querySelector('.pw-pdp-share-frame,.pw-pdp-hero-img,[data-pw-el="main-image"],[data-pw-pdp-hero-video]');
    if(anchor)hero.insertBefore(track,anchor);
    else hero.insertBefore(track,hero.firstChild);
    track.addEventListener('scroll',function(){
      if(track.__pwProg)return;
      syncHeroChrome(hero,heroIndexFromScroll(track));
    },{passive:true});
    if(typeof ResizeObserver!=='undefined'){
      var ro=new ResizeObserver(function(){
        if(track.__pwUser)return;
        var idx=Number(hero.getAttribute('data-pw-hero-index')||0);
        var w=track.clientWidth||0;
        if(w>0)track.scrollLeft=idx*w;
      });
      ro.observe(track);
    }
    track.addEventListener('pointerdown',function(){track.__pwUser=1;});
    track.addEventListener('pointerup',function(){setTimeout(function(){track.__pwUser=0;},180);});
    track.addEventListener('pointercancel',function(){track.__pwUser=0;});
  }
  hero.__pwHeroItems=items;
  if(track.getAttribute('data-pw-sig')===sig&&track.children.length===items.length)return;
  var video=hero.querySelector('[data-pw-pdp-hero-video]');
  if(video&&video.parentNode!==hero)hero.insertBefore(video,track);
  track.setAttribute('data-pw-sig',sig);
  track.textContent='';
  items.forEach(function(it,i){
    var slide=document.createElement('div');
    slide.className='pw-pdp-hero-slide';
    slide.setAttribute('data-pw-pdp-hero-slide',String(i));
    if(it.kind==='video')slide.setAttribute('data-pw-hero-kind','video');
    if(it.kind==='video'&&video){
      video.hidden=false;
      video.removeAttribute('hidden');
      slide.appendChild(video);
    }else if(it.kind==='photo'){
      var img=document.createElement('img');
      img.className='pw-pdp-hero-slide-img';
      img.setAttribute('alt',it.alt||'');
      img.setAttribute('decoding','async');
      if(i>0)img.setAttribute('loading','lazy');
      else img.setAttribute('fetchpriority','high');
      img.setAttribute('src',it.page);
      if(it.full)img.setAttribute('data-pw-full-src',it.full);
      slide.appendChild(img);
    }
    track.appendChild(slide);
  });
  hero.__pwHeroIdx=null;
  track.scrollLeft=0;
  syncHeroChrome(hero,0);
  if(typeof hideBrokenPdpImgs==='function')hideBrokenPdpImgs(track);
}
function mountPdpHeroSwipeAll(){
  document.querySelectorAll('.pw-pdp-hero').forEach(mountPdpHeroSwipe);
}
function pwPdpHeroGo(btn){
  var hero=btn&&btn.closest&&btn.closest('.pw-pdp-hero');
  if(!hero)return false;
  mountPdpHeroSwipe(hero);
  var items=hero.__pwHeroItems||[];
  var idx=-1;
  for(var i=0;i<items.length;i++){if(items[i].btn===btn){idx=i;break;}}
  if(idx<0)return false;
  pwPdpHeroScroll(hero,idx,'smooth');
  return true;
}
function pwPdpHeroShowColor(page,full,alt){
  var pageKey=heroSlidePage(page);
  var fullKey=heroSlideFull(full||page);
  document.querySelectorAll('.pw-pdp-hero').forEach(function(hero){
    if(!galleryFaceVisible(hero))return;
    mountPdpHeroSwipe(hero);
    var track=hero.querySelector('[data-pw-pdp-hero-track]');
    if(!track)return;
    var slides=track.children;
    var found=-1;
    for(var i=0;i<slides.length;i++){
      var img=slides[i].querySelector('img');
      if(!img)continue;
      var src=img.getAttribute('src')||'';
      var f=img.getAttribute('data-pw-full-src')||'';
      if(src===page||src===pageKey||f===full||f===fullKey||heroSlideFull(src)===fullKey){found=i;break;}
    }
    if(found>=0){pwPdpHeroScroll(hero,found,'smooth');return;}
    var idx=heroIndexFromScroll(track);
    var cur=slides[idx]&&slides[idx].querySelector('img');
    if(cur)showPdpImage(cur,pageKey||page,fullKey,alt||'');
    var items=hero.__pwHeroItems||[];
    if(items[idx]&&items[idx].kind==='photo'){
      items[idx].page=pageKey||page;
      items[idx].full=fullKey;
    }
    hero.__pwHeroIdx=null;
    syncHeroChrome(hero,idx);
  });
}
`
