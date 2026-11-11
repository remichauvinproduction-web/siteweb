(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let files = [];
  const input = $('#tool-files');
  const drop = $('#tool-drop');
  const list = $('#tool-file-list');
  const run = $('#process-images');
  const status = $('#tool-status');

  function addFiles(incoming) {
    const accepted = [...incoming].filter((f) => f.type.startsWith('image/') || /\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|pef)$/i.test(f.name));
    files.push(...accepted);
    list.innerHTML = files.map((f) => `<span>${esc(f.name)} · ${(f.size/1048576).toFixed(1)} MB</span>`).join('');
    run.disabled = !files.length;
    if (accepted.length !== incoming.length) status.textContent = 'Certains fichiers ont un format non pris en charge.';
  }
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-dragging'); addFiles(e.dataTransfer.files); });
  $('#tool-quality').addEventListener('input', (e) => { $('#quality-value').textContent = `${e.target.value} %`; });

  async function sourceImage(file) {
    if (file.type.startsWith('image/') && !/\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|pef)$/i.test(file.name)) return file;
    const { extractThumbnail } = await import('https://cdn.jsdelivr.net/npm/extract-raw-preview@1.1.0/+esm');
    const raw = await extractThumbnail(new Uint8Array(await file.arrayBuffer()), { maxBytes: 32 * 1024 * 1024 });
    if (!raw.found || !raw.decodable) throw new Error(`Pas d’aperçu JPEG intégré dans ${file.name}.`);
    return new Blob([raw.data], {type:raw.mimeType});
  }
  function loadImage(source) { return createImageBitmap(source); }
  function canvasBlob(canvas, quality) { return new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Export image impossible.')), 'image/webp', quality)); }
  async function drawProcessed(file, logo) {
    const bitmap = await loadImage(await sourceImage(file));
    const max = Number($('#tool-preset').value);
    const scale = max ? Math.min(1, max / Math.max(bitmap.width, bitmap.height)) : 1;
    const canvas = document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    if ($('#watermark-enabled').checked) {
      const pad=Math.max(18,Math.round(Math.min(canvas.width,canvas.height)*.035));
      if (logo) {
        const maxW=canvas.width*.2,maxH=canvas.height*.2,k=Math.min(maxW/logo.width,maxH/logo.height,1),w=logo.width*k,h=logo.height*k;
        const pos=$('#watermark-position').value;const x=pos==='bl'?pad:pos==='center'?(canvas.width-w)/2:canvas.width-w-pad;const y=pos==='center'?(canvas.height-h)/2:canvas.height-h-pad;
        ctx.globalAlpha=.8;ctx.drawImage(logo,x,y,w,h);ctx.globalAlpha=1;
      }
      const text=$('#watermark-text').value.trim();
      if(text){const size=Math.max(18,Math.round(canvas.width*.025));ctx.font=`600 ${size}px Arial`;ctx.textAlign='right';ctx.textBaseline='bottom';ctx.lineWidth=Math.max(2,size*.12);ctx.strokeStyle='rgba(0,0,0,.6)';ctx.fillStyle='rgba(255,255,255,.93)';const x=canvas.width-pad,y=canvas.height-pad;ctx.strokeText(text,x,y);ctx.fillText(text,x,y);}
    }
    const blob=await canvasBlob(canvas,Number($('#tool-quality').value)/100);
    return {name:`${file.name.replace(/\.[^.]+$/,'')}-web.webp`,bytes:new Uint8Array(await blob.arrayBuffer())};
  }
  function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
  function zip(filesToZip){
    const enc=new TextEncoder(),local=[],central=[];let offset=0;
    const put=(v,p,n,z)=>z===2?v.setUint16(p,n,true):v.setUint32(p,n,true);
    const d=new Date(),time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date=((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
    for(const f of filesToZip){const name=enc.encode(f.name),crc=crc32(f.bytes),l=new Uint8Array(30+name.length),v=new DataView(l.buffer);put(v,0,0x04034b50,4);put(v,4,20,2);put(v,6,0x0800,2);put(v,8,0,2);put(v,10,time,2);put(v,12,date,2);put(v,14,crc,4);put(v,18,f.bytes.length,4);put(v,22,f.bytes.length,4);put(v,26,name.length,2);put(v,28,0,2);l.set(name,30);local.push(l,f.bytes);const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);put(w,0,0x02014b50,4);put(w,4,20,2);put(w,6,20,2);put(w,8,0x0800,2);put(w,10,0,2);put(w,12,time,2);put(w,14,date,2);put(w,16,crc,4);put(w,20,f.bytes.length,4);put(w,24,f.bytes.length,4);put(w,28,name.length,2);put(w,30,0,2);put(w,32,0,2);put(w,34,0,2);put(w,36,0,2);put(w,38,0,4);put(w,42,offset,4);c.set(name,46);central.push(c);offset+=l.length+f.bytes.length;}
    const size=central.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);put(v,0,0x06054b50,4);put(v,4,0,2);put(v,6,0,2);put(v,8,filesToZip.length,2);put(v,10,filesToZip.length,2);put(v,12,size,4);put(v,16,offset,4);put(v,20,0,2);return new Blob([...local,...central,end],{type:'application/zip'});
  }
  run.addEventListener('click', async () => {
    run.disabled=true;$('#tool-download').hidden=true;status.textContent='Préparation locale des photos…';
    try {
      let logo=null;const logoFile=$('#watermark-logo').files[0];if(logoFile)logo=await loadImage(logoFile);
      const output=[];for(let i=0;i<files.length;i++){status.textContent=`Traitement de ${i+1}/${files.length} : ${files[i].name}`;output.push(await drawProcessed(files[i],logo));}
      if(logo)logo.close();const blob=zip(output),url=URL.createObjectURL(blob),link=$('#tool-download');link.href=url;link.download='photos-preparees.zip';link.hidden=false;status.textContent=`${output.length} fichier${output.length>1?'s':''} prêt${output.length>1?'s':''}. Les originaux n’ont pas été modifiés.`;
    }catch(error){status.textContent=error.message;}
    finally{run.disabled=!files.length;}
  });

  function money(amount){return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(amount)}
  function calculate(){const costs=Number($('#costs').value)||0,jobs=Math.max(1,Number($('#jobs').value)||1),hours=Number($('#hours').value)||0,hourly=Number($('#hourly').value)||0,variable=Number($('#variable').value)||0,margin=Math.min(90,Math.max(0,Number($('#margin').value)||0))/100;const base=costs/jobs+hours*hourly+variable,ht=base/(1-margin);$('#price-ht').textContent=money(ht);$('#price-ttc').textContent=money(ht*1.2)}
  document.querySelectorAll('#tarifs input').forEach((el)=>el.addEventListener('input',calculate));calculate();

  function generateDocument(){
    const kind=$('#doc-type').value,labels={devis:'Devis',facture:'Facture',contrat:'Contrat de prestation'},provider=$('#doc-provider').value.trim()||'Rémi PRODUCTION',client=$('#doc-client').value.trim()||'Client',service=$('#doc-service').value.trim()||'Prestation audiovisuelle',qty=Number($('#doc-quantity').value)||1,unit=Number($('#doc-unit').value)||0,vat=Number($('#doc-vat').value)||0,ht=qty*unit,tax=ht*vat/100,ttc=ht+tax,date=$('#doc-date').value||new Date().toISOString().slice(0,10),contact=$('#doc-contact').value.trim(),number=$('#doc-number').value.trim(),terms=$('#doc-terms').value.trim();
    const table=kind==='contrat'?'':`<table><thead><tr><th>Prestation</th><th>Qté</th><th>Prix HT</th><th>Total HT</th></tr></thead><tbody><tr><td>${esc(service)}</td><td>${qty}</td><td>${money(unit)}</td><td>${money(ht)}</td></tr></tbody><tfoot><tr><td colspan="3">Total HT</td><td>${money(ht)}</td></tr><tr><td colspan="3">TVA (${vat} %)</td><td>${money(tax)}</td></tr><tr><td colspan="3"><strong>Total TTC</strong></td><td><strong>${money(ttc)}</strong></td></tr></tfoot></table>`;
    const contract=kind==='contrat'?`<h2>Objet de la prestation</h2><p>${esc(service)}</p><h2>Conditions</h2><p>${esc(terms||'Les parties conviennent des livrables, du calendrier de réalisation et des droits d’utilisation décrits au présent document.')}</p><p>Le client et le prestataire reconnaissent avoir lu et accepté les conditions ci-dessus.</p><div class="signatures"><div>Le prestataire<br><br>Signature :</div><div>Le client<br><br>Signature précédée de « Bon pour accord » :</div></div>`:`<h2>Informations</h2><p>${esc(terms||'Document établi selon les informations communiquées par le client.')}</p><p>Échéance / date : ${esc(date)}</p>`;
    const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><title>${labels[kind]} ${esc(number)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px/1.55 Arial,sans-serif;color:#202124}header{display:flex;justify-content:space-between;border-bottom:3px solid #f4c928;padding-bottom:18px}h1{font-size:30px;margin:22px 0 5px}h2{font-size:16px;margin:25px 0 7px}.muted{color:#62666b}.columns{display:flex;justify-content:space-between;margin:28px 0}.columns p{margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:30px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f4f4}tfoot td{text-align:right}.signatures{display:flex;justify-content:space-between;margin-top:80px}.signatures div{width:45%;border-top:1px solid #777;padding-top:10px}.hint{margin-top:60px;color:#777;font-size:11px}@media print{.hint{display:none}}</style><header><div><strong>${esc(provider)}</strong><br>${esc(contact)}</div><div>${esc(number)}<br>${esc(date)}</div></header><h1>${labels[kind]}</h1><p class="muted">${esc(number)}</p><div class="columns"><div><strong>Émetteur</strong><p>${esc(provider)}</p><p>${esc(contact)}</p></div><div><strong>Client</strong><p>${esc(client)}</p><p>${esc($('#doc-email').value)}</p></div></div>${table}${contract}<p class="hint">Ouvrez la boîte d’impression puis choisissez « Enregistrer au format PDF ».</p><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></html>`;
    const win=window.open('','_blank');if(!win){alert('Autorisez les fenêtres popup pour créer le document.');return}win.document.open();win.document.write(html);win.document.close();
  }
  $('#generate-doc').addEventListener('click',generateDocument);
})();
