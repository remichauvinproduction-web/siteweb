(function(){
  'use strict';
  const $=(s)=>document.querySelector(s), host=location.hostname.toLowerCase(), subdomain=host.endsWith('.remiproduction.fr')?host.slice(0,-'.remiproduction.fr'.length):'', slug=decodeURIComponent((subdomain&&subdomain!=='www'?subdomain:location.pathname.replace(/\/+$/,'').split('/').pop())||'');
  const grid=$('#gallery-grid'), message=$('#gallery-message'), viewer=$('#photo-viewer'), downloadDialog=$('#download-dialog');
  let photos=[], index=0, onlyFavorites=false, galleryTitle='', pendingDownload=null;
  const esc=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key='rm-gallery-favs:'+slug;
  const favorites=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}};
  const notify=(s)=>{message.textContent=s;message.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>message.hidden=true,3000)};
  function updateCount(){const f=favorites();$('#favorite-count').textContent=f.length;$('#photo-count').textContent=photos.length+' photo'+(photos.length>1?'s':'')}
  function render(){
    const fav=favorites(), visible=photos.map((p,i)=>({...p,_i:i})).filter(p=>!onlyFavorites||fav.includes(p._i));
    grid.innerHTML=visible.length?visible.map(p=>'<figure class="delivery__photo"><img src="'+esc(p.image)+'" alt="'+esc(p.alt||p.label||galleryTitle)+'" loading="lazy" decoding="async" data-index="'+p._i+'"><div class="delivery__photo-actions"><button type="button" aria-label="Télécharger cette photo" title="Télécharger" data-download="'+p._i+'">↓</button><button type="button" aria-label="Ajouter aux favoris" title="Ajouter aux favoris" aria-pressed="'+fav.includes(p._i)+'" data-favorite="'+p._i+'">'+(fav.includes(p._i)?'♥':'♡')+'</button></div></figure>').join(''):'<p class="delivery__empty">Aucun favori pour le moment. Touchez le cœur sur vos photos préférées.</p>';
    updateCount();
  }
  function show(i){index=(i+photos.length)%photos.length;const p=photos[index];$('#viewer-image').src=p.image;$('#viewer-image').alt=p.alt||p.label||'';$('#viewer-caption').textContent=(p.label||galleryTitle)+' · '+(index+1)+' / '+photos.length}
  function requestDownload(type,photoIndex){pendingDownload={type,index:photoIndex};$('#download-error').hidden=true;$('#download-email').value='';downloadDialog.showModal();$('#download-email').focus()}
  grid.addEventListener('click',e=>{
    const dl=e.target.closest('[data-download]');if(dl){requestDownload('single',Number(dl.dataset.download));return}
    const fav=e.target.closest('[data-favorite]');
    if(fav){const i=Number(fav.dataset.favorite),set=new Set(favorites());set.has(i)?set.delete(i):set.add(i);localStorage.setItem(key,JSON.stringify([...set]));render();return}
    const im=e.target.closest('img[data-index]');if(im){show(Number(im.dataset.index));viewer.showModal()}
  });
  $('#favorites-only').addEventListener('click',e=>{onlyFavorites=!onlyFavorites;e.currentTarget.setAttribute('aria-pressed',String(onlyFavorites));render()});
  $('#viewer-close').addEventListener('click',()=>viewer.close());
  $('#viewer-prev').addEventListener('click',()=>show(index-1));$('#viewer-next').addEventListener('click',()=>show(index+1));
  $('#viewer-download').addEventListener('click',()=>requestDownload('single',index));
  viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});
  viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(index-1);if(e.key==='ArrowRight')show(index+1)});
  $('#download-cancel').addEventListener('click',()=>downloadDialog.close());
  $('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);notify('Lien de la galerie copié')}catch(e){notify(location.href)}});
  $('#download-all').addEventListener('click',()=>requestDownload('all',-1));

  function crc32(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
  function zipFiles(files){
    const encoder=new TextEncoder(),locals=[],central=[];let offset=0;
    const dt=new Date(),time=(dt.getHours()<<11)|(dt.getMinutes()<<5)|(dt.getSeconds()>>1),date=((Math.max(1980,dt.getFullYear())-1980)<<9)|((dt.getMonth()+1)<<5)|dt.getDate();
    const put=(view,pos,n,size)=>size===2?view.setUint16(pos,n,true):view.setUint32(pos,n,true);
    files.forEach(file=>{
      const name=encoder.encode(file.name),bytes=file.bytes,crc=crc32(bytes),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
      put(lv,0,0x04034b50,4);put(lv,4,20,2);put(lv,6,0x0800,2);put(lv,8,0,2);put(lv,10,time,2);put(lv,12,date,2);put(lv,14,crc,4);put(lv,18,bytes.length,4);put(lv,22,bytes.length,4);put(lv,26,name.length,2);put(lv,28,0,2);local.set(name,30);locals.push(local,bytes);
      const dir=new Uint8Array(46+name.length),dv=new DataView(dir.buffer);put(dv,0,0x02014b50,4);put(dv,4,20,2);put(dv,6,20,2);put(dv,8,0x0800,2);put(dv,10,0,2);put(dv,12,time,2);put(dv,14,date,2);put(dv,16,crc,4);put(dv,20,bytes.length,4);put(dv,24,bytes.length,4);put(dv,28,name.length,2);put(dv,30,0,2);put(dv,32,0,2);put(dv,34,0,2);put(dv,36,0,2);put(dv,38,0,4);put(dv,42,offset,4);dir.set(name,46);central.push(dir);offset+=local.length+bytes.length;
    });
    const centralSize=central.reduce((n,p)=>n+p.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);put(ev,0,0x06054b50,4);put(ev,4,0,2);put(ev,6,0,2);put(ev,8,files.length,2);put(ev,10,files.length,2);put(ev,12,centralSize,4);put(ev,16,offset,4);put(ev,20,0,2);
    return new Blob([...locals,...central,end],{type:'application/zip'});
  }
  function safeName(value,fallback){const base=String(value||fallback).split('/').pop().split('?')[0].normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-');return base||fallback}
  async function savePhoto(p,i){
    const url=new URL(p.download||p.image,location.origin);if(url.origin!==location.origin)throw Error('Cette image est hébergée ailleurs. Demandez à Rémi de la déposer dans la galerie depuis l’administration.');
    const res=await fetch(url.href);if(!res.ok)throw Error('Une photo n’a pas pu être récupérée.');const blob=await res.blob(),objectUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=objectUrl;a.download=safeName(p.download||p.image,'photo-'+String(i+1).padStart(2,'0')+'.jpg');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }
  async function saveArchive(){
    if(!photos.length)throw Error('Cette galerie ne contient aucune photo.');
    const files=[];
    for(let i=0;i<photos.length;i++){
      const p=photos[i],url=new URL(p.download||p.image,location.origin);if(url.origin!==location.origin)throw Error('Toutes les images doivent être déposées dans la médiathèque du site pour créer le ZIP.');
      const res=await fetch(url.href);if(!res.ok)throw Error('Impossible de récupérer la photo '+(i+1)+'.');
      const bytes=new Uint8Array(await res.arrayBuffer());files.push({name:String(i+1).padStart(3,'0')+'-'+safeName(p.download||p.image,'photo.jpg'),bytes});
    }
    const objectUrl=URL.createObjectURL(zipFiles(files)),a=document.createElement('a');a.href=objectUrl;a.download=safeName(slug||galleryTitle,'galerie')+'.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
  }
  $('#download-form').addEventListener('submit',async e=>{
    e.preventDefault();const email=$('#download-email').value.trim().toLowerCase(),submit=$('#download-submit'),error=$('#download-error');
    if(!pendingDownload)return;submit.disabled=true;submit.textContent='Préparation…';error.hidden=true;
    try{
      const res=await fetch('/api/gallery-download',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,slug,action:pendingDownload.type})});
      if(!res.ok){const body=await res.json().catch(()=>({}));throw Error(body.error||'Enregistrement indisponible. Réessayez plus tard.')}
      if(pendingDownload.type==='single'){await savePhoto(photos[pendingDownload.index],pendingDownload.index);downloadDialog.close();notify('Téléchargement lancé')}else{notify('Préparation du ZIP…');await saveArchive();downloadDialog.close();notify('Téléchargement du ZIP lancé')}
    }catch(err){error.textContent=err.message||'Le téléchargement a échoué. Réessayez.';error.hidden=false}
    finally{submit.disabled=false;submit.textContent='Continuer'}
  });
  fetch('/data/galeries/'+encodeURIComponent(slug)+'.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
    galleryTitle=d.title||'Votre galerie';photos=(d.photos||[]).map(p=>typeof p==='string'?{image:p}:p).filter(p=>p&&p.image);
    document.title=galleryTitle+' | Galerie photo — Rémi PRODUCTION';$('#gallery-title').textContent=galleryTitle;
    $('#gallery-meta').textContent=[d.client,d.date,d.location].filter(Boolean).join(' · ');
    $('#gallery-description').textContent=d.description||'Retrouvez ici les photos de votre séance. Ajoutez vos préférées à la sélection, puis téléchargez-les.';
    render();
  }).catch(()=>{document.title='Galerie introuvable | Rémi PRODUCTION';$('#gallery-title').textContent='Cette galerie est introuvable';$('#gallery-description').textContent='Vérifiez le lien reçu ou contactez Rémi pour obtenir le bon accès.';grid.innerHTML='';$('#download-all').hidden=true;$('#copy-link').hidden=true});
})();
