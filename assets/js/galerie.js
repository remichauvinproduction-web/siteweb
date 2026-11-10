(function(){
  'use strict';
  const $=(s)=>document.querySelector(s), host=location.hostname.toLowerCase(), subdomain=host.endsWith('.remiproduction.fr')?host.slice(0,-'.remiproduction.fr'.length):'', slug=decodeURIComponent((subdomain&&subdomain!=='www'?subdomain:location.pathname.replace(/\/+$/,'').split('/').pop())||'');
  const grid=$('#gallery-grid'), message=$('#gallery-message'), viewer=$('#photo-viewer');
  let photos=[], index=0, onlyFavorites=false, galleryTitle='';
  const esc=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key='rm-gallery-favs:'+slug;
  const favorites=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}};
  const notify=(s)=>{message.textContent=s;message.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>message.hidden=true,2400)};
  function updateCount(){const f=favorites();$('#favorite-count').textContent=f.length;$('#photo-count').textContent=photos.length+' photo'+(photos.length>1?'s':'')}
  function render(){
    const fav=favorites(), visible=photos.map((p,i)=>({...p,_i:i})).filter(p=>!onlyFavorites||fav.includes(p._i));
    grid.innerHTML=visible.length?visible.map(p=>'<figure class="delivery__photo"><img src="'+esc(p.image)+'" alt="'+esc(p.alt||p.label||galleryTitle)+'" loading="lazy" decoding="async" data-index="'+p._i+'"><button type="button" aria-label="Ajouter aux favoris" aria-pressed="'+fav.includes(p._i)+'" data-favorite="'+p._i+'">'+(fav.includes(p._i)?'♥':'♡')+'</button></figure>').join(''):'<p class="delivery__empty">Aucun favori pour le moment. Touchez le cœur sur vos photos préférées.</p>';
    updateCount();
  }
  function show(i){index=(i+photos.length)%photos.length;const p=photos[index];$('#viewer-image').src=p.image;$('#viewer-image').alt=p.alt||p.label||'';$('#viewer-caption').textContent=(p.label||galleryTitle)+' · '+(index+1)+' / '+photos.length}
  grid.addEventListener('click',e=>{
    const fav=e.target.closest('[data-favorite]');
    if(fav){const i=Number(fav.dataset.favorite),set=new Set(favorites());set.has(i)?set.delete(i):set.add(i);localStorage.setItem(key,JSON.stringify([...set]));render();return}
    const im=e.target.closest('img[data-index]');if(im){show(Number(im.dataset.index));viewer.showModal()}
  });
  $('#favorites-only').addEventListener('click',e=>{onlyFavorites=!onlyFavorites;e.currentTarget.setAttribute('aria-pressed',String(onlyFavorites));render()});
  $('#viewer-close').addEventListener('click',()=>viewer.close());
  $('#viewer-prev').addEventListener('click',()=>show(index-1));$('#viewer-next').addEventListener('click',()=>show(index+1));
  viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});
  viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(index-1);if(e.key==='ArrowRight')show(index+1)});
  $('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);notify('Lien de la galerie copié')}catch(e){notify(location.href)}});
  $('#download-all').addEventListener('click',()=>{
    const picked=favorites(), selection=picked.length?photos.filter((_,i)=>picked.includes(i)):photos;
    selection.forEach((p,i)=>setTimeout(()=>{const a=document.createElement('a');a.href=p.download||p.image;a.download='photo-'+String(i+1).padStart(2,'0');document.body.appendChild(a);a.click();a.remove()},i*450));
    notify(selection.length+' téléchargement(s) lancé(s)');
  });
  fetch('/data/galeries/'+encodeURIComponent(slug)+'.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
    galleryTitle=d.title||'Votre galerie';photos=(d.photos||[]).filter(p=>p.image);
    document.title=galleryTitle+' | Galerie photo — Rémi PRODUCTION';$('#gallery-title').textContent=galleryTitle;
    $('#gallery-meta').textContent=[d.client,d.date,d.location].filter(Boolean).join(' · ');
    $('#gallery-description').textContent=d.description||'Retrouvez ici les photos de votre séance. Ajoutez vos préférées à la sélection, puis téléchargez-les.';
    render();
  }).catch(()=>{document.title='Galerie introuvable | Rémi PRODUCTION';$('#gallery-title').textContent='Cette galerie est introuvable';$('#gallery-description').textContent='Vérifiez le lien reçu ou contactez Rémi pour obtenir le bon accès.';grid.innerHTML='';$('#download-all').hidden=true;$('#copy-link').hidden=true});
})();
