document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const status=btn.closest('.code-panel')?.querySelector('.copy-status');try{await navigator.clipboard.writeText(btn.dataset.copy);if(status)status.textContent='Template copied. Replace the placeholders before use.';btn.textContent='Copied';}catch(e){if(status)status.textContent='Copy is unavailable in this context; select and copy the template manually.';}}));const filters=[...document.querySelectorAll('[data-filter]')];const cards=[...document.querySelectorAll('.case-card[data-category]')];filters.forEach(btn=>btn.addEventListener('click',()=>{const f=btn.dataset.filter;filters.forEach(b=>{const on=b===btn;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});let count=0;cards.forEach(card=>{const show=f==='all'||card.dataset.category===f;card.hidden=!show;if(show)count++;});const label=document.getElementById('case-count');if(label)label.textContent=String(count).padStart(2,'0')+' STORIES';}));document.querySelectorAll('.glow-cta').forEach(btn=>{let glow=btn.querySelector('.cta-cursor-glow');if(!glow){glow=document.createElement('span');glow.className='cta-cursor-glow';glow.setAttribute('aria-hidden','true');btn.prepend(glow);}Object.assign(glow.style,{position:'absolute',width:'190px',height:'190px',left:'0',top:'0',borderRadius:'50%',pointerEvents:'none',zIndex:'0',opacity:'0',transform:'translate(-50%,-50%)',background:'radial-gradient(circle,rgba(94,213,255,.35),rgba(46,143,237,.15) 38%,transparent 72%)',transition:'opacity .15s ease',willChange:'left,top'});[...btn.children].forEach(ch=>{if(ch!==glow){ch.style.position='relative';ch.style.zIndex='1';}});const move=e=>{const r=btn.getBoundingClientRect();glow.style.left=(e.clientX-r.left)+'px';glow.style.top=(e.clientY-r.top)+'px';glow.style.opacity='1';};btn.addEventListener('pointermove',move);btn.addEventListener('pointerenter',move);btn.addEventListener('pointerleave',()=>glow.style.opacity='0');});});
// Pointer-following edge glow: use pointer coordinates relative to each card.
(function installPointerEdgeGlow(){
  const selectors='.case-card,.plan-card,.onepager-grid article,.process-step,.usecase-card,.feed-card,.feed-wall-card,.compare-table-wrap,.faq-item,.industry-card,.step-list li,.code-panel,.notice-card,.horizontal-steps article,.process-flow article,.tag-cloud span';
  const install=()=>document.querySelectorAll(selectors).forEach(card=>{
    if(card.dataset.edgeGlowReady==='1') return; card.dataset.edgeGlowReady='1';
    const move=e=>{const r=card.getBoundingClientRect();if(!r.width||!r.height)return;const x=Math.max(0,Math.min(r.width,e.clientX-r.left));const y=Math.max(0,Math.min(r.height,e.clientY-r.top));const px=x/r.width*100,py=y/r.height*100;const dx=x-r.width/2,dy=y-r.height/2;const edge=Math.min(1,Math.max(Math.abs(dx)/(r.width/2),Math.abs(dy)/(r.height/2)));const deg=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;card.style.setProperty('--pointer-x',px.toFixed(2)+'%');card.style.setProperty('--pointer-y',py.toFixed(2)+'%');card.style.setProperty('--pointer-deg',deg.toFixed(1)+'deg');card.style.setProperty('--edge-alpha',String(.72+edge*.28));card.style.setProperty('--glow-alpha',String(.25+edge*.45));};
    const leave=()=>{card.style.setProperty('--edge-alpha','0');card.style.setProperty('--glow-alpha','0');};
    card.addEventListener('pointerenter',move,{passive:true});card.addEventListener('pointermove',move,{passive:true});card.addEventListener('pointerleave',leave,{passive:true});card.addEventListener('focusin',()=>{card.style.setProperty('--edge-alpha','.85');card.style.setProperty('--glow-alpha','.4');});card.addEventListener('focusout',leave);
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
})();


/* v69: accessible mobile navigation for secondary pages */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const menuButton = header?.querySelector('.menu-toggle');
  const nav = header?.querySelector('.desktop-nav');
  if (!menuButton || !nav) return;
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    nav.classList.toggle('open', !isOpen);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  }));
});
