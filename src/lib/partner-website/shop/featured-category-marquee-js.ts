/**
 * Vertical featured-category marquee. Only `.pw-featured-cat` — never wrap circle cats.
 * Shared by live bootstrap and Sửa nhanh. No `${` (editor template literal).
 */

export const PW_FEATURED_MARQUEE_JS = `
function featuredSourceGrid(el){
  if(!el||!el.querySelector)return null;
  if(el.classList&&el.classList.contains('pw-featured-cat')){
    return el.querySelector('[data-pw-grid]:not([data-pw-featured-clone]),.pw-featured-cat-grid:not([data-pw-featured-clone])');
  }
  return el.querySelector('[data-pw-grid]:not([data-pw-featured-clone]),.pw-featured-cat-grid:not([data-pw-featured-clone]),.pw-cat-grid:not([data-pw-featured-clone])');
}
function bindFeaturedMarqueePause(viewport){
  if(!viewport||viewport.getAttribute('data-pw-featured-pause-bound')==='1')return;
  viewport.setAttribute('data-pw-featured-pause-bound','1');
  viewport.addEventListener('mouseenter',function(){viewport.classList.add('is-paused');});
  viewport.addEventListener('mouseleave',function(){viewport.classList.remove('is-paused');});
  viewport.addEventListener('touchstart',function(){viewport.classList.add('is-paused');},{passive:true});
  viewport.addEventListener('touchend',function(){viewport.classList.remove('is-paused');});
  viewport.addEventListener('touchcancel',function(){viewport.classList.remove('is-paused');});
}
function ensureFeaturedMarquee(el){
  if(!el||!el.classList||!el.classList.contains('pw-featured-cat'))return;
  if(el.getAttribute('data-pw-featured-categories')!=='1')return;
  var grid=featuredSourceGrid(el);
  if(!grid)return;
  var viewport=el.querySelector('[data-pw-featured-viewport],.pw-featured-cat-viewport');
  var marquee=el.querySelector('[data-pw-featured-marquee],.pw-featured-cat-marquee');
  if(!viewport){
    viewport=document.createElement('div');
    viewport.className='pw-featured-cat-viewport';
    viewport.setAttribute('data-pw-featured-viewport','1');
    marquee=document.createElement('div');
    marquee.className='pw-featured-cat-marquee';
    marquee.setAttribute('data-pw-featured-marquee','1');
    if(grid.parentNode)grid.parentNode.insertBefore(viewport,grid);
    viewport.appendChild(marquee);
    marquee.appendChild(grid);
  }else if(!marquee){
    marquee=document.createElement('div');
    marquee.className='pw-featured-cat-marquee';
    marquee.setAttribute('data-pw-featured-marquee','1');
    viewport.appendChild(marquee);
    if(grid.parentNode!==marquee)marquee.appendChild(grid);
  }else if(grid.parentNode!==marquee){
    marquee.appendChild(grid);
  }
  var olds=marquee.querySelectorAll('[data-pw-featured-clone]');
  for(var r=0;r<olds.length;r++)olds[r].remove();
  var visible=0,nodes=grid.querySelectorAll('[data-pw-el="card"],.pw-featured-cat-card'),i;
  for(i=0;i<nodes.length;i++){
    if(nodes[i].hidden||nodes[i].getAttribute('hidden')!=null)continue;
    visible+=1;
  }
  if(visible<4)return;
  var clone=grid.cloneNode(true);
  clone.removeAttribute('data-pw-grid');
  clone.removeAttribute('data-pw-el');
  clone.classList.remove('pw-featured-cat-grid');
  clone.setAttribute('data-pw-featured-clone','1');
  clone.setAttribute('aria-hidden','true');
  var edits=clone.querySelectorAll('[data-pw-edit],[data-pw-seed-name],[data-pw-seed-href],[data-pw-seed-src],[data-pw-grid-placeholder],[data-pw-el]');
  for(i=0;i<edits.length;i++){
    edits[i].removeAttribute('data-pw-edit');
    edits[i].removeAttribute('data-pw-seed-name');
    edits[i].removeAttribute('data-pw-seed-href');
    edits[i].removeAttribute('data-pw-seed-src');
    edits[i].removeAttribute('data-pw-grid-placeholder');
    if(edits[i].getAttribute('data-pw-el')==='card'||edits[i].getAttribute('data-pw-el')==='card-name'||edits[i].getAttribute('data-pw-el')==='card-media'||edits[i].getAttribute('data-pw-el')==='grid'){
      edits[i].removeAttribute('data-pw-el');
    }
  }
  marquee.appendChild(clone);
  bindFeaturedMarqueePause(viewport);
}
function pwEnsureFeaturedMarquees(){
  var nodes=document.querySelectorAll('.pw-featured-cat[data-pw-featured-categories="1"]');
  for(var i=0;i<nodes.length;i++)ensureFeaturedMarquee(nodes[i]);
}
try{window.pwEnsureFeaturedMarquees=pwEnsureFeaturedMarquees;}catch(ePwFeatMq){}
`.trim()
