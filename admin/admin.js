(() => {
  'use strict';

  const REPO = 'remichauvinproduction-web/siteweb';
  const BRANCH = 'main';
  const OAUTH = 'https://oauth-proxy.remiproduction.workers.dev';
  const STORE = 'rp-admin-github-token';
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  let token = localStorage.getItem(STORE) || '';
  let galleries = [];
  let selected = null;
  let draftPhotos = [];
  let activeModule = 'galeries';
  let contentFiles = {};
  let dragDepth = 0;

  function say(message, error = false) {
    toast.textContent = message;
    toast.classList.toggle('toast--error', error);
    toast.classList.add('toast--visible');
    clearTimeout(say.timer);
    say.timer = setTimeout(() => toast.classList.remove('toast--visible'), 4200);
  }

  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  }

  function githubHeaders(json = false) {
    return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(json ? { 'Content-Type':'application/json' } : {}) };
  }

  async function github(path, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { ...options, headers: { ...githubHeaders(Boolean(options.body)), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) { localStorage.removeItem(STORE); token = ''; renderLogin(); }
      throw new Error(data.message || `GitHub a répondu ${response.status}.`);
    }
    return data;
  }

  function getTokenFromMessage(data) {
    if (typeof data !== 'string' || !data.startsWith('authorization:github:success:')) return '';
    try { return JSON.parse(data.slice('authorization:github:success:'.length)).token || ''; } catch { return ''; }
  }

  function renderLogin(error = '') {
    $('#logout').hidden = true;
    app.innerHTML = `<div class="login-panel"><div class="login-mark">RP</div><p class="eyebrow">Accès sécurisé</p><h2>Connectez votre compte GitHub</h2><p>La connexion utilise l’autorisation GitHub déjà configurée pour le site. Aucun mot de passe n’est demandé ni enregistré ici.</p>${error ? `<p class="notice notice--error">${esc(error)}</p>` : ''}<button id="login" class="button button--primary">Continuer avec GitHub <span aria-hidden="true">↗</span></button><small>Votre compte doit avoir accès au dépôt du site.</small></div>`;
    $('#login').addEventListener('click', login);
  }

  function login() {
    const popup = window.open(`${OAUTH}/auth?provider=github`, 'rp-github-auth', 'width=600,height=720,menubar=no,toolbar=no');
    if (!popup) return say('Autorisez les fenêtres popup pour ce site puis réessayez.', true);
    const timeout = setTimeout(() => { window.removeEventListener('message', onMessage); if (!popup.closed) popup.close(); say('Connexion interrompue. Réessayez.', true); }, 180000);
    const onMessage = (event) => {
      if (event.origin !== OAUTH || event.source !== popup) return;
      if (event.data === 'authorizing:github') { popup.postMessage('authorizing:github', OAUTH); return; }
      const nextToken = getTokenFromMessage(event.data);
      if (nextToken) {
        clearTimeout(timeout); window.removeEventListener('message', onMessage); popup.close();
        token = nextToken; localStorage.setItem(STORE, token); start();
      } else if (typeof event.data === 'string' && event.data.startsWith('authorization:github:error:')) {
        clearTimeout(timeout); window.removeEventListener('message', onMessage); popup.close(); say('GitHub n’a pas autorisé la connexion.', true);
      }
    };
    window.addEventListener('message', onMessage);
  }

  function renderList() {
    $('#logout').hidden = false;
    const labels = {galeries:'Galeries clients', videos:'Réalisations vidéo', photos:'Galerie photo', showreel:'Bande démo'};
    const toolbarButton = activeModule === 'galeries' ? '<button class="button button--primary" id="new-gallery">＋ Nouvelle galerie</button>' : activeModule === 'showreel' ? '<button class="button button--primary" id="edit-showreel">Modifier la bande démo</button>' : `<button class="button button--primary" id="new-content">＋ Ajouter ${activeModule === 'videos' ? 'une réalisation' : 'une photo'}</button>`;
    app.innerHTML = `<nav class="module-tabs" aria-label="Sections de l’administration">${Object.entries(labels).map(([key,label])=>`<button class="module-tab ${activeModule===key?'is-active':''}" data-module="${key}">${label}</button>`).join('')}<a class="module-tab" href="/admin/outils.html">Outils gratuits ↗</a></nav><div class="admin-toolbar"><div><p class="eyebrow">Votre espace</p><h2>${labels[activeModule]}</h2><p class="muted">${activeModule==='galeries'?`${galleries.length} galerie${galleries.length>1?'s':''} enregistrée${galleries.length>1?'s':''}`:activeModule==='showreel'?'Vidéo et image affichées sur l’accueil':`${(contentFiles[activeModule]?.data.items||[]).length} élément${(contentFiles[activeModule]?.data.items||[]).length===1?'':'s'}`}</p></div>${toolbarButton}</div><div id="gallery-list" class="gallery-list">${activeModule==='galeries'?galleryCards():contentCards()}</div>`;
    app.querySelectorAll('[data-module]').forEach((b)=>b.addEventListener('click',()=>{activeModule=b.dataset.module;renderList()}));
    if (activeModule === 'galeries') $('#new-gallery').addEventListener('click', () => openEditor());
    else if(activeModule==='showreel') $('#edit-showreel').addEventListener('click',editShowreel);
    else $('#new-content').addEventListener('click',()=>editContent(activeModule,-1));
    app.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.edit)));
    app.querySelectorAll('[data-insights]').forEach((b) => b.addEventListener('click', () => showInsights(b.dataset.insights)));
    app.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => deleteGallery(b.dataset.delete)));
    app.querySelectorAll('[data-content-edit]').forEach((b)=>b.addEventListener('click',()=>editContent(activeModule,Number(b.dataset.contentEdit))));
    app.querySelectorAll('[data-content-delete]').forEach((b)=>b.addEventListener('click',()=>deleteContent(activeModule,Number(b.dataset.contentDelete))));
  }

  function galleryCards(){return galleries.length?galleries.map((g)=>{const first=(g.photos||[]).map((p)=>typeof p==='string'?p:p?.image).find(Boolean),cover=g.cover||first;return `<article class="gallery-card"><div class="gallery-card__thumb">${cover?`<img src="${esc(cover)}" alt="">`:'<span>RP</span>'}</div><div class="gallery-card__body"><h3>${esc(g.title||g.slug)}</h3><p>${esc([g.client,g.date,`${(g.photos||[]).length} photos`].filter(Boolean).join(' · '))}</p><a class="gallery-url" href="https://${esc(g.slug)}.remiproduction.fr/" target="_blank" rel="noreferrer">${esc(g.slug)}.remiproduction.fr ↗</a></div><div class="gallery-card__actions"><button class="button button--quiet" data-insights="${esc(g.slug)}">Statistiques</button><button class="button button--quiet" data-edit="${esc(g.slug)}">Modifier</button><button class="icon-button" data-delete="${esc(g.slug)}" aria-label="Supprimer ${esc(g.title||g.slug)}">×</button></div></article>`}).join(''):'<div class="empty-state"><span>✦</span><h3>Pas encore de galerie</h3><p>Créez une galerie et déposez toutes les photos en une seule fois.</p></div>'}

  async function showInsights(slug){try{const response=await fetch(`/api/gallery-insights?slug=${encodeURIComponent(slug)}`,{headers:{Authorization:`Bearer ${token}`}}),data=await response.json();if(!response.ok)throw new Error(data.error||'Statistiques indisponibles.');const top=(data.favorites||[]).slice(0,5).map((f)=>`Photo ${f.photo+1} : ${f.count} favori${f.count===1?'':'s'}`).join('\n')||'Aucun favori enregistré';const choices=(data.selections||[]).slice(0,20).map((s)=>`${new Date(s.date).toLocaleString('fr-FR')} — ${s.email||'Client sans e-mail'} — photos ${(s.photos||[]).map((i)=>i+1).join(', ')}`).join('\n')||'Aucune sélection reçue';alert(`Statistiques · ${slug}\n\nVues : ${data.views}\nTéléchargements individuels : ${data.downloadsSingle}\nTéléchargements ZIP : ${data.downloadsAll}\nSélections reçues : ${data.selectedCount}\n\nFavoris les plus fréquents\n${top}\n\nDernières sélections\n${choices}`)}catch(error){say(`Statistiques indisponibles : ${error.message}`,true)}}

  function contentCards(){
    if(activeModule==='showreel'){const d=contentFiles.showreel?.data||{};return `<article class="gallery-card"><div class="gallery-card__thumb">${d.poster?`<img src="${esc(d.poster)}" alt="">`:'<span>▶</span>'}</div><div class="gallery-card__body"><h3>${esc(d.title||'Bande démo — Rémi PRODUCTION')}</h3><p>${esc([d.youtube?'YouTube':'',d.file?'Fichier vidéo':'',d.duree].filter(Boolean).join(' · ')||'Aucune vidéo configurée')}</p></div></article>`}
    const items=contentFiles[activeModule]?.data.items||[];
    return items.length?items.map((d,i)=>`<article class="gallery-card"><div class="gallery-card__thumb">${(d.thumbnail||d.image)?`<img src="${esc(d.thumbnail||d.image)}" alt="">`:`<span>${activeModule==='videos'?'▶':'RP'}</span>`}</div><div class="gallery-card__body"><h3>${esc(d.title||d.label||`Photo ${i+1}`)}</h3><p>${esc([d.category,d.client,d.type].filter(Boolean).join(' · '))}</p></div><div class="gallery-card__actions"><button class="button button--quiet" data-content-edit="${i}">Modifier</button><button class="icon-button" data-content-delete="${i}" aria-label="Supprimer">×</button></div></article>`).join(''):'<div class="empty-state"><h3>Aucun élément</h3><p>Ajoutez le premier élément avec le bouton ci-dessus.</p></div>';
  }

  function inputField(label,name,value='',type='text',extra=''){return `<label class="field"><span>${label}</span>${type==='textarea'?`<textarea name="${name}" rows="3">${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`}</label>`}
  function editContent(module,index){
    const items=contentFiles[module].data.items, item=index<0?{}:items[index];
    const video=module==='videos';
    app.innerHTML=`<div class="editor-head"><button id="back" class="back-link">← ${video?'Réalisations vidéo':'Galerie photo'}</button><div><p class="eyebrow">${index<0?'Nouvel élément':'Modifier un élément'}</p><h2>${video?esc(item.title||'Réalisation vidéo'):esc(item.label||'Photo de la galerie')}</h2></div></div><form id="content-form" class="simple-editor"><div class="form-grid">${video?inputField('Titre','title',item.title||'')+`<label class="field"><span>Catégorie</span><select name="category">${[['publicite','Publicité'],['entreprise','Entreprise'],['reseaux','Réseaux sociaux'],['evenementiel','Événementiel'],['creation','Créations personnelles / courts métrages']].map(([v,l])=>`<option value="${v}" ${item.category===v?'selected':''}>${l}</option>`).join('')}</select></label>`+inputField('Type de production','type',item.type||'')+inputField('Client','client',item.client||'')+inputField('Description','description',item.description||'','textarea')+inputField('Votre rôle','role',item.role||'')+inputField('Lien YouTube','youtube',item.youtube||'')+inputField('Fichier vidéo local','file',item.file||'')+inputField('Vignette (chemin / URL)','thumbnail',item.thumbnail||''):`<label class="field"><span>Catégorie</span><select name="category">${[['portrait','Portrait'],['evenement','Événement'],['sport','Sport'],['nature','Nature']].map(([v,l])=>`<option value="${v}" ${item.category===v?'selected':''}>${l}</option>`).join('')}</select></label>`+inputField('Image (chemin / URL)','image',item.image||'')+inputField('Légende affichée','label',item.label||'')+inputField('Texte alternatif','alt',item.alt||'')}${video?`<label class="field"><span>Format</span><select name="orientation"><option ${item.orientation==='16:9'?'selected':''}>16:9</option><option ${item.orientation==='9:16'?'selected':''}>9:16</option></select></label><label class="field"><span><input name="featured" type="checkbox" ${item.featured?'checked':''}> Mettre en avant sur l’accueil</span></label>`:''}</div><div class="editor-actions"><button class="button button--quiet" type="button" id="cancel-content">Annuler</button><button class="button button--primary" type="submit">Enregistrer</button></div></form>`;
    $('#back').onclick=renderList;$('#cancel-content').onclick=renderList;
    $('#content-form').onsubmit=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget),next={...item};for(const key of video?['title','category','type','client','description','role','orientation','youtube','file','thumbnail']:['image','category','label','alt'])next[key]=String(f.get(key)||'').trim();if(video)next.featured=f.has('featured');if(video&&!next.title)return say('Le titre est obligatoire.',true);if(!video&&!next.image)return say('Le chemin de l’image est obligatoire.',true);if(index<0)items.push(next);else items[index]=next;await saveContentFile(module);};
  }

  async function deleteContent(module,index){if(!confirm('Supprimer cet élément ?'))return;contentFiles[module].data.items.splice(index,1);await saveContentFile(module)}
  async function editShowreel(){const d=contentFiles.showreel.data;app.innerHTML=`<div class="editor-head"><button id="back" class="back-link">← Bande démo</button><div><p class="eyebrow">Accueil</p><h2>Modifier la bande démo</h2></div></div><form id="showreel-form" class="simple-editor"><div class="form-grid">${inputField('Titre','title',d.title||'')+inputField('Lien ou ID YouTube','youtube',d.youtube||'')+inputField('Fichier vidéo local','file',d.file||'')+inputField('Image de couverture (chemin / URL)','poster',d.poster||'')+inputField('Durée affichée','duree',d.duree||'')}</div><div class="editor-actions"><button class="button button--quiet" type="button" id="cancel-content">Annuler</button><button class="button button--primary" type="submit">Enregistrer</button></div></form>`;$('#back').onclick=renderList;$('#cancel-content').onclick=renderList;$('#showreel-form').onsubmit=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);for(const k of ['title','youtube','file','poster','duree'])d[k]=String(f.get(k)||'').trim();await saveContentFile('showreel')};}

  async function saveContentFile(module){try{const entry=contentFiles[module],bytes=new TextEncoder().encode(JSON.stringify(entry.data,null,2));let binary='';for(const b of bytes)binary+=String.fromCharCode(b);await github(`contents/${entry.path}`,{method:'PUT',body:JSON.stringify({message:`Update ${module} via studio`,content:btoa(binary),branch:BRANCH,sha:entry.sha})});entry.sha=(await github(`contents/${entry.path}?ref=${BRANCH}`)).sha;say('Modifications enregistrées.');renderList()}catch(error){say(`Enregistrement impossible : ${error.message}`,true)}}

  function openEditor(slug = '') {
    selected = galleries.find((g) => g.slug === slug) || null;
    draftPhotos = selected ? (selected.photos || []).map((p) => typeof p === 'string' ? { image:p, label:'' } : { ...p }) : [];
    renderEditor();
  }

  function renderEditor() {
    const g = selected || {};
    app.innerHTML = `<div class="editor-head"><button id="back" class="back-link">← Toutes les galeries</button><div><p class="eyebrow">${selected ? 'Modifier une galerie' : 'Nouvelle livraison'}</p><h2>${selected ? esc(g.title) : 'Créer une galerie'}</h2></div></div><form id="gallery-form" class="gallery-form"><div class="form-main"><label class="field"><span>Nom de la galerie <b>*</b></span><input name="title" required maxlength="120" value="${esc(g.title)}" placeholder="Ex. Mariage de Camille & Thomas"></label><div class="form-grid"><label class="field"><span>Nom du client</span><input name="client" maxlength="120" value="${esc(g.client)}" placeholder="Facultatif"></label><label class="field"><span>Date de la séance</span><input name="date" maxlength="80" value="${esc(g.date)}" placeholder="Ex. 14 juin 2026"></label><label class="field"><span>Lieu</span><input name="location" maxlength="120" value="${esc(g.location)}" placeholder="Facultatif"></label><label class="field"><span>Adresse privée de la galerie</span><div class="slug-input"><span>https://</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${esc(g.slug || '')}" placeholder="nom-client" ${selected ? 'readonly' : ''}><span>.remiproduction.fr</span></div><small>Le slug reçoit un suffixe aléatoire pour rendre le lien difficile à deviner.</small></label></div><label class="field"><span>Message pour le client</span><textarea name="description" rows="3" maxlength="500" placeholder="Un petit mot pour accompagner les photos…">${esc(g.description)}</textarea></label><div class="photos-head"><div><p class="eyebrow">Photos livrées</p><h3>Déposez toutes les photos ici</h3><p class="muted">JPEG, PNG, WebP, AVIF et fichiers RAW pris en charge.</p></div><span id="photo-count" class="count-pill">${draftPhotos.length} photo${draftPhotos.length === 1 ? '' : 's'}</span></div><div id="dropzone" class="dropzone" tabindex="0" role="button" aria-label="Choisir ou déposer des photos"><input id="photo-input" type="file" accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.pef" multiple hidden><div class="dropzone__icon">⇧</div><strong>Glissez-déposez vos photos</strong><span>ou <u>parcourez vos fichiers</u></span></div><div id="photo-grid" class="photo-grid"></div><label class="field cover-select"><span>Photo de couverture</span><select name="cover"><option value="">Première photo de la galerie</option>${draftPhotos.map((p, i) => `<option value="${esc(p.image)}" ${g.cover === p.image ? 'selected' : ''}>Photo ${i + 1}${p.label ? ` — ${esc(p.label)}` : ''}</option>`).join('')}</select></label><div class="gallery-settings"><p class="eyebrow">Options de livraison</p><label><input name="allowDownloads" type="checkbox" ${g.allowDownloads !== false ? 'checked' : ''}> Autoriser les téléchargements gratuits</label><label><input name="allowSelection" type="checkbox" ${g.allowSelection !== false ? 'checked' : ''}> Autoriser l’envoi des favoris</label><label class="field"><span>Version proposée pour les téléchargements gratuits</span><select name="downloadMode"><option value="original" ${g.downloadMode !== 'web' ? 'selected' : ''}>Original haute définition (RAW inclus)</option><option value="web" ${g.downloadMode === 'web' ? 'selected' : ''}>Version optimisée pour le web</option></select></label><label><input name="shopEnabled" type="checkbox" ${g.shopEnabled ? 'checked' : ''}> Activer la vente numérique (paiement Stripe requis)</label><label class="field"><span>Article vendu</span><select name="shopMode"><option value="gallery" ${g.shopMode !== 'selection' ? 'selected' : ''}>Galerie complète</option><option value="selection" ${g.shopMode === 'selection' ? 'selected' : ''}>Sélection de favoris</option></select></label><label class="field"><span>Prix total ou prix par photo sélectionnée (€)</span><input name="priceEuros" type="number" min="0.50" max="10000" step="0.01" value="${(Number(g.priceCents||0)/100).toFixed(2)}"></label><small>Le compte Stripe sera renseigné comme secret du Worker Cloudflare. Les clients paient sur la page sécurisée Stripe.</small></div></div><aside class="editor-aside"><div class="aside-card"><p class="eyebrow">Publication</p><p>Les originaux et les aperçus sont enregistrés dans le stockage Cloudflare R2. Le déploiement de la galerie peut prendre quelques instants.</p><button class="button button--primary button--wide" id="save-gallery" type="submit">${selected ? 'Enregistrer les changements' : 'Créer la galerie'}</button><button class="button button--quiet button--wide" id="cancel-edit" type="button">Annuler</button></div><div class="aside-card aside-card--note"><strong>Adresse client</strong><p>Le client retrouvera sa galerie sur <code>${esc(g.slug || 'votre-slug')}.remiproduction.fr</code> et sur la page galerie du site.</p><p>Les choix de photos sont envoyés dans la boîte de réception des sélections de l’admin.</p></div></aside></form>`;
    $('#back').addEventListener('click', renderList);
    $('#cancel-edit').addEventListener('click', renderList);
    const title = $('[name="title"]'), slug = $('[name="slug"]');
    if (!selected) { const linkCode = crypto.randomUUID().replace(/-/g,'').slice(0,16); title.addEventListener('input', () => { if (!slug.dataset.touched) { const base=slugify(title.value).slice(0,40); slug.value=base?`${base}-${linkCode}`:''; } }); }
    if (!selected) slug.addEventListener('input', () => { slug.dataset.touched = '1'; slug.value = slugify(slug.value); });
    const zone = $('#dropzone'), input = $('#photo-input');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
    zone.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; zone.classList.add('dropzone--active'); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    zone.addEventListener('dragleave', (e) => { e.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) zone.classList.remove('dropzone--active'); });
    zone.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; zone.classList.remove('dropzone--active'); addFiles(e.dataTransfer.files); });
    $('#gallery-form').addEventListener('submit', saveGallery);
    drawPhotos();
  }

  function addFiles(fileList) {
    const files = [...fileList];
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    const rawExt = /\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|pef)$/i;
    const valid = files.filter((f) => allowed.has(f.type) || rawExt.test(f.name));
    if (valid.length !== files.length) say('Formats acceptés : JPEG, PNG, WebP, AVIF et principaux RAW (CR2/CR3, NEF, ARW, DNG, RAF, ORF, RW2, PEF).', true);
    if (!valid.length) return;
    const additions = valid.map((file) => ({ file, image: URL.createObjectURL(file), label: file.name.replace(/\.[^.]+$/, '') }));
    draftPhotos.push(...additions);
    drawPhotos();
    say(`${valid.length} photo${valid.length > 1 ? 's ajoutées' : ' ajoutée'} à la galerie.`);
  }

  function drawPhotos() {
    const grid = $('#photo-grid');
    if (!grid) return;
    $('#photo-count').textContent = `${draftPhotos.length} photo${draftPhotos.length === 1 ? '' : 's'}`;
    grid.innerHTML = draftPhotos.map((p, i) => `<article class="photo-tile"><img src="${esc(p.image)}" alt="Aperçu ${i + 1}"><div class="photo-tile__bar"><span title="${esc(p.file?.name || p.image.split('/').pop())}">${String(i + 1).padStart(2, '0')} · ${esc(p.file?.name || p.image.split('/').pop())}</span><div><button type="button" data-up="${i}" aria-label="Monter la photo" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-down="${i}" aria-label="Descendre la photo" ${i === draftPhotos.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-remove="${i}" aria-label="Retirer la photo">×</button></div></div></article>`).join('');
    grid.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => movePhoto(Number(b.dataset.up), -1)));
    grid.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => movePhoto(Number(b.dataset.down), 1)));
    grid.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { const [p] = draftPhotos.splice(Number(b.dataset.remove), 1); if (p.file) URL.revokeObjectURL(p.image); drawPhotos(); }));
    const select = $('[name="cover"]');
    if (select) select.innerHTML = `<option value="">Première photo de la galerie</option>${draftPhotos.map((p, i) => `<option value="${esc(p.image)}" ${selected?.cover === p.image ? 'selected' : ''}>Photo ${i + 1}${p.label ? ` — ${esc(p.label)}` : ''}</option>`).join('')}`;
  }

  function movePhoto(index, offset) {
    const next = index + offset;
    if (next < 0 || next >= draftPhotos.length) return;
    [draftPhotos[index], draftPhotos[next]] = [draftPhotos[next], draftPhotos[index]];
    drawPhotos();
  }

  async function makeWebPreview(file) {
    let sourceFile = file;
    if (!file.type.startsWith('image/') || /\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|pef)$/i.test(file.name)) {
      const { extractThumbnail } = await import('https://cdn.jsdelivr.net/npm/extract-raw-preview@1.1.0/+esm');
      const rawPreview = await extractThumbnail(new Uint8Array(await file.arrayBuffer()), { maxBytes: 32 * 1024 * 1024 });
      if (!rawPreview.found || !rawPreview.decodable) throw new Error(`Aperçu RAW introuvable pour ${file.name}. Vérifiez que le fichier contient un aperçu JPEG intégré.`);
      sourceFile = new File([rawPreview.data], `${file.name}.preview.jpg`, { type:rawPreview.mimeType });
    }
    const bitmap = await createImageBitmap(sourceFile);
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha:false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .86));
    if (!blob) throw new Error(`La création de l’aperçu a échoué : ${file.name}`);
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-web.webp`, { type:'image/webp' });
  }

  async function uploadMedia(file, slug, name, variant) {
    const response = await fetch(`/api/media/galeries/${encodeURIComponent(slug)}/${encodeURIComponent(name)}`, { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':file.type || 'application/octet-stream', 'X-Gallery-Variant':variant }, body:file });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Envoi du fichier impossible (${response.status}).`);
    return data.url;
  }

  async function uploadPhoto(file, slug, index) {
    const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'raw';
    const safeBase = slugify(file.name.replace(/\.[^.]+$/, '')) || 'photo';
    const stem = `${String(index + 1).padStart(3, '0')}-${safeBase}-${crypto.randomUUID().slice(0, 8)}`;
    const web = await makeWebPreview(file);
    const originalPath = await uploadMedia(file, slug, `${stem}.${ext}`, 'original');
    const webPath = await uploadMedia(web, slug, `${stem}-web.webp`, 'web');
    return { image:webPath, web:webPath, original:originalPath, download:originalPath, label:file.name.replace(/\.[^.]+$/, ''), alt:file.name.replace(/\.[^.]+$/, '') };
  }

  async function saveGallery(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const slug = selected?.slug || slugify(form.get('slug'));
    if (!title || !slug) return say('Ajoutez un nom et une adresse valide pour la galerie.', true);
    if (!draftPhotos.length) return say('Ajoutez au moins une photo avant de publier.', true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return say('L’adresse de la galerie contient un caractère invalide.', true);
    if (!selected && galleries.some((g) => g.slug === slug)) return say('Cette adresse est déjà utilisée par une autre galerie.', true);
    const button = $('#save-gallery'); button.disabled = true;
    try {
      const photos = [];
      for (let i = 0; i < draftPhotos.length; i++) {
        const photo = draftPhotos[i];
        if (photo.file) {
          button.textContent = `Envoi des photos ${i + 1}/${draftPhotos.filter((p) => p.file).length}…`;
          photos.push(await uploadPhoto(photo.file, slug, i));
        } else photos.push({ image:photo.image, label:photo.label || '', alt:photo.alt || photo.label || title });
      }
      const coverSelection = String(form.get('cover') || '');
      const coverIndex = draftPhotos.findIndex((p) => p.image === coverSelection);
      const priceCents = Math.round(Number(form.get('priceEuros') || 0) * 100);
      if (form.has('shopEnabled') && priceCents < 50) throw new Error('Pour activer la vente, indiquez un prix supérieur ou égal à 0,50 €.');
      const gallery = { title, slug, client:String(form.get('client') || '').trim(), date:String(form.get('date') || '').trim(), location:String(form.get('location') || '').trim(), description:String(form.get('description') || '').trim(), allowDownloads:form.has('allowDownloads'), allowSelection:form.has('allowSelection'), downloadMode:String(form.get('downloadMode')||'original'), shopEnabled:form.has('shopEnabled'), shopMode:String(form.get('shopMode')||'gallery'), priceCents, cover:photos[coverIndex]?.image || photos[0]?.image || '', photos };
      const path = `data/galeries/${slug}.json`;
      const old = selected ? await github(`contents/${path}?ref=${BRANCH}`) : null;
      const contentBytes = new TextEncoder().encode(JSON.stringify(gallery, null, 2));
      let binary = ''; for (const byte of contentBytes) binary += String.fromCharCode(byte);
      await github(`contents/${path}`, { method:'PUT', body:JSON.stringify({ message:`${selected ? 'Update' : 'Create'} client gallery ${slug}`, content:btoa(binary), branch:BRANCH, ...(old ? { sha:old.sha } : {}) }) });
      draftPhotos.forEach((p) => { if (p.file) URL.revokeObjectURL(p.image); });
      say('Galerie enregistrée. Le site se met à jour.');
      await loadGalleries(); renderList();
    } catch (error) {
      say(`Enregistrement interrompu : ${error.message} ${error.message.includes('too large') ? 'Essayez avec des photos plus légères.' : ''}`, true);
      button.disabled = false; button.textContent = selected ? 'Enregistrer les changements' : 'Créer la galerie';
    }
  }

  async function deleteGallery(slug) {
    const gallery = galleries.find((g) => g.slug === slug);
    if (!gallery || !confirm(`Supprimer la galerie « ${gallery.title || slug} » ? Cette action ne peut pas être annulée.`)) return;
    try {
      const file = await github(`contents/data/galeries/${slug}.json?ref=${BRANCH}`);
      await github(`contents/data/galeries/${slug}.json`, { method:'DELETE', body:JSON.stringify({ message:`Delete client gallery ${slug}`, sha:file.sha, branch:BRANCH }) });
      say('Galerie supprimée.'); await loadGalleries(); renderList();
    } catch (error) { say(`Suppression impossible : ${error.message}`, true); }
  }

  async function loadGalleries() {
    try {
      const entries = await github(`contents/data/galeries?ref=${BRANCH}`);
      const files = Array.isArray(entries) ? entries.filter((f) => f.type === 'file' && f.name.endsWith('.json')) : [];
      galleries = await Promise.all(files.map(async (f) => {
        const file = await github(`contents/${f.path}?ref=${BRANCH}`);
        const raw = atob(file.content.replace(/\s/g, ''));
        const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        return { ...JSON.parse(new TextDecoder().decode(bytes)), slug:f.name.replace(/\.json$/, ''), _sha:file.sha };
      }));
      galleries.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      for (const [key, path] of Object.entries({ videos:'data/videos.json', photos:'data/gallery.json', showreel:'data/showreel.json' })) {
        const file = await github(`contents/${path}?ref=${BRANCH}`);
        const raw = atob(file.content.replace(/\s/g, ''));
        const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        contentFiles[key] = { path, sha:file.sha, data:JSON.parse(new TextDecoder().decode(bytes)) };
      }
    } catch (error) {
      if (error.message.toLowerCase().includes('not found') && !Object.keys(contentFiles).length) galleries = [];
      else throw error;
    }
  }

  async function start() {
    if (!token) return renderLogin();
    app.innerHTML = '<div class="loading">Connexion au dépôt du site…</div>';
    try {
      await loadGalleries();
      renderList();
      $('#logout').hidden = false;
      $('#logout').onclick = () => { localStorage.removeItem(STORE); token = ''; galleries = []; renderLogin(); };
    } catch (error) { renderLogin(`Connexion au dépôt impossible : ${error.message}`); }
  }

  start();
})();
