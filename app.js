// Cain's Jawbone case file — all state lives in localStorage (key cj-casefile-v1).
(async () => {
let PAGES;
try {
  PAGES = await (await fetch('pages.json')).json();
  if (!Array.isArray(PAGES) || !PAGES.length) throw new Error('empty');
} catch (e) {
  document.querySelector('main').innerHTML = '<p style="padding:24px">Couldn\u2019t load pages.json. Serve this folder over HTTP (opening index.html straight from disk won\u2019t work).</p>';
  return;
}
const N = PAGES.length, CW = 2400, CH = 1600, KEY = 'cj-casefile-v1';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const range = (a, b) => Array.from({length: b - a + 1}, (_, i) => a + i);
const mobile = () => matchMedia('(max-width:899px)').matches;
const fresh = () => ({tags:{}, notes:{}, read:{}, boards:[{id:uid(), name:'Main board', items:[]}], active:0,
  order: range(1, N), sure:{}, ledger: Array.from({length:6}, () => ({v:'', m:'', p:'', n:''})), caseNotes:'', zoom:1, view:'board', next:{}, open:['all'], q:'', whole:false, folders:[], marks:{}});
const valid = s => s && Array.isArray(s.boards) && s.boards.length && Array.isArray(s.order) && s.order.length === N && Array.isArray(s.ledger);
let S = null;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
S = valid(S) ? Object.assign(fresh(), S) : fresh();
if (S.active >= S.boards.length) S.active = 0;
if (!S.next || typeof S.next !== 'object') S.next = {};
if (!Array.isArray(S.folders)) S.folders = [];
if (!S.marks || typeof S.marks !== 'object') S.marks = {};
let saveT;
const flush = () => { clearTimeout(saveT); S.open = [...openF]; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const save = () => { clearTimeout(saveT); saveT = setTimeout(flush, 250); renderStats(); };
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

const openF = new Set(S.open);
let searchRes = null, cur = null;

const allTags = () => [...new Set(Object.values(S.tags).flat())].sort((a, b) => a.localeCompare(b));
const hue = t => { let h = 7; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const chip = (t, x) => `<span class="tag" style="--h:${hue(t)}">${esc(t)}${x ? `<button data-untag="${esc(t)}" aria-label="Remove tag ${esc(t)}">×</button>` : ''}</span>`;
const chips = p => (S.tags[p] || []).map(t => chip(t)).join('');
const first = (p, n = 70) => { const t = PAGES[p - 1].replace(/\n/g, ' '); return t.length > n ? t.slice(0, n).trimEnd() + '…' : t; };
function body(t, r, p) { // user highlights [s,e,note] + search hits; newlines kept, rendered with pre-wrap
  const n = t.length, ri = new Int16Array(n).fill(-1), sr = new Uint8Array(n), marks = (p && S.marks[p]) || [];
  marks.forEach(([s, e], k) => { for (let i = s; i < e && i < n; i++) ri[i] = k; });
  if (r) for (const m of t.matchAll(r)) { if (!m[0]) break; for (let i = m.index; i < m.index + m[0].length; i++) sr[i] = 1; }
  let out = '';
  for (let i = 0, j; i < n; i = j) {
    j = i; while (j < n && ri[j] === ri[i] && sr[j] === sr[i]) j++;
    const seg = esc(t.slice(i, j)), k = ri[i], note = k >= 0 ? marks[k][2] : '';
    out += k >= 0 || sr[i] ? `<mark class="${k >= 0 ? 'hl' : ''}${note ? ' hn' : ''}${sr[i] ? ' sr' : ''}"${k >= 0 ? ` data-k="${k}"` : ''}${note ? ` title="${esc(note)}"` : ''}>${seg}</mark>` : seg;
  }
  return out;
}
function rx(q, whole) {
  const e = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");
  return new RegExp(whole ? `(?<![\\w’'])${e}(?![\\w’'])` : e, 'gi');
}
function hl(t, r) {
  if (!r) return esc(t);
  let out = '', last = 0;
  for (const m of t.matchAll(r)) { if (!m[0]) break; out += esc(t.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
  return out + esc(t.slice(last));
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200); }

/* ---------- modal ---------- */
function modal({title, text = '', input, ok = 'OK', danger, extra = ''}) {
  return new Promise(res => {
    $('#dlg').innerHTML = `<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${input !== undefined ? `<input id="mIn" value="${esc(input)}">` : ''}${extra}
      <div class="acts"><button class="btn" data-m="0">Cancel</button><button class="btn ${danger ? 'red' : 'red'}" data-m="1">${esc(ok)}</button></div>`;
    $('#modal').hidden = false;
    const inp = $('#mIn'); if (inp) { inp.focus(); inp.select(); }
    const done = v => { $('#modal').hidden = true; $('#dlg').onclick = null; $('#dlg').onkeydown = null; res(v); };
    $('#dlg').onclick = e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === '1' ? (inp ? inp.value.trim() : true) : null); };
    $('#dlg').onkeydown = e => { if (e.key === 'Enter' && inp) done(inp.value.trim()); if (e.key === 'Escape') done(null); };
  });
}

/* ---------- stats ---------- */
function renderStats() {
  const r = Object.values(S.read).filter(Boolean).length, s = Object.values(S.sure).filter(Boolean).length;
  $('#stats').textContent = `Read ${r}/${N} · Sure ${s}/${N} · Locks ${Object.keys(S.next).length}`;
}

/* ---------- cabinet ---------- */
function folderList() {
  const f = [];
  if (searchRes) f.push({k:'search', g:'Search', label:`“${searchRes.q}”`, sub:`${searchRes.hits.length} pages · ${searchRes.total} hits`, pages:searchRes.hits.map(h => h.p)});
  f.push({k:'all', g:'Folders', label:'All pages', sub:`${N} pages`, pages:range(1, N)});
  for (const fo of S.folders) f.push({k:'f:' + fo.id, g:'Folders', fid:fo.id, label:fo.name, sub:`${fo.pages.length} pages`, pages:fo.pages});
  for (const t of allTags()) { const pages = range(1, N).filter(p => (S.tags[p] || []).includes(t)); f.push({k:'t:' + t, g:'By tag', tag:t, label:t, sub:`${pages.length} pages`, pages}); }
  return f;
}
const folderOf = id => S.folders.find(f => f.id === id);
function fileIn(fid, p) { const f = folderOf(fid); if (!f) return; if (!f.pages.includes(p)) { f.pages.push(p); save(); toast(`Page ${p} filed in ${f.name}`); } }
function unfile(fid, p) { const f = folderOf(fid); if (!f) return; f.pages = f.pages.filter(x => x !== p); save(); }
async function newFolder(p) {
  const n = await modal({title:'New folder', input:`Folder ${S.folders.length + 1}`, ok:'Create'}); if (!n) return null;
  const f = {id:uid(), name:n.slice(0, 40), pages:[]}; S.folders.push(f); openF.add('f:' + f.id);
  if (p) fileIn(f.id, p);
  save(); renderFolders(); return f;
}
function card(p, hit, fid) {
  return `<div class="card${S.read[p] ? ' read' : ''}" draggable="true" data-card="${p}"><button class="copen" data-open="${p}"><b>p.${p}</b>${hit ? hit.snip : esc(first(p))}</button>
    <div class="cfoot">${chips(p)}${hit ? `<em>${hit.count}×</em>` : ''}${fid ? `<button class="unf" data-unfile="${fid}" data-p="${p}">Remove</button>` : ''}<button class="pin" data-pin="${p}">Pin</button></div></div>`;
}
function renderFolders() {
  let h = '', grp = '';
  for (const f of folderList()) {
    if (f.g !== grp) {
      grp = f.g;
      h += `<h3 class="grp">${grp === 'Search' ? 'Search results<button id="clearS">Clear</button>' : grp === 'Folders' ? 'Folders<button id="newF">+ New folder</button>' : grp}</h3>`;
    }
    const open = openF.has(f.k) || f.k === 'search';
    const read = f.pages.filter(p => S.read[p]).length;
    h += `<div class="folder${f.tag ? ' tagged' : ''}${f.k === 'search' ? ' search' : ''}"${f.tag ? ` style="--h:${hue(f.tag)}"` : ''}${f.fid ? ` data-fid="${f.fid}"` : ''}>
      <button class="ftab" data-folder="${esc(f.k)}" aria-expanded="${open}"><span class="fname">${esc(f.label)}</span><span class="fsub">${esc(f.sub)}${f.pages.length ? ` · ${read} read` : ''}</span></button>
      ${open ? `<div class="fbody">${f.fid ? `<div class="fact"><button data-renf="${f.fid}">Rename</button><button data-delf="${f.fid}">Delete folder</button></div>` : ''}${f.pages.length ? f.pages.map(p => card(p, f.k === 'search' ? searchRes.hits.find(x => x.p === p) : null, f.fid)).join('') : `<p class="empty">${f.fid ? 'Empty. Drag a page card here, or file pages from the page reader.' : 'Empty folder.'}</p>`}</div>` : ''}</div>`;
  }
  if (!allTags().length) h += `<h3 class="grp">By tag</h3><p class="hint">Tag a page and a folder for that tag appears here.</p>`;
  $('#folders').innerHTML = h;
}
$('#folders').addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'clearS') return clearSearch();
  const f = t.closest('[data-folder]');
  if (f) { const k = f.dataset.folder; openF.has(k) ? openF.delete(k) : openF.add(k); save(); renderFolders(); return; }
  const o = t.closest('[data-open]'); if (o) return openPage(+o.dataset.open);
  const p = t.closest('[data-pin]'); if (p) return pin(+p.dataset.pin);
  if (t.id === 'newF') return newFolder();
  const uf = t.closest('[data-unfile]'); if (uf) { unfile(uf.dataset.unfile, +uf.dataset.p); renderFolders(); return; }
  const rn = t.closest('[data-renf]'); if (rn) { const fo = folderOf(rn.dataset.renf); modal({title:'Rename folder', input:fo.name, ok:'Rename'}).then(n => { if (n) { fo.name = n.slice(0, 40); save(); renderFolders(); } }); return; }
  const df = t.closest('[data-delf]'); if (df) { const fo = folderOf(df.dataset.delf); modal({title:`Delete “${fo.name}”?`, text:'Only the folder is removed. Pages, tags and notes stay.', ok:'Delete', danger:1}).then(ok => { if (ok) { S.folders = S.folders.filter(x => x !== fo); save(); renderFolders(); } }); }
});
$('#folders').addEventListener('dragover', e => { const f = e.target.closest('[data-fid]'); if (!f || !isPage(e)) return; e.preventDefault(); f.classList.add('drop'); });
$('#folders').addEventListener('dragleave', e => { const f = e.target.closest('[data-fid]'); if (f && !f.contains(e.relatedTarget)) f.classList.remove('drop'); });
$('#folders').addEventListener('drop', e => { const f = e.target.closest('[data-fid]'); if (!f || !isPage(e)) return; e.preventDefault(); fileIn(f.dataset.fid, +e.dataTransfer.getData('text/x-cj-page')); renderFolders(); });

/* ---------- search ---------- */
function doSearch(init) {
  const q = $('#q').value.trim();
  S.q = q; S.whole = $('#whole').checked; save();
  if (!q) { searchRes = null; renderFolders(); if (S.view === 'seq') renderSeq(); return; }
  const r = rx(q, $('#whole').checked), hits = [];
  let total = 0;
  PAGES.forEach((t, i) => {
    const m = [...t.matchAll(r)].filter(x => x[0]);
    if (!m.length) return;
    total += m.length;
    const at = m[0].index, s = Math.max(0, at - 40), e = Math.min(t.length, at + m[0][0].length + 50);
    hits.push({p:i + 1, count:m.length, snip:(s ? '…' : '') + hl(t.slice(s, e).replace(/\n/g, ' '), r) + (e < t.length ? '…' : '')});
  });
  searchRes = {q, hits, total, r};
  openF.add('search');
  renderFolders();
  $('#files').scrollTop = 0;
  if (S.view === 'seq') renderSeq();
  else if (mobile() && init !== true) setView('files');
}
function clearSearch() { searchRes = null; $('#q').value = ''; S.q = ''; save(); renderFolders(); if (S.view === 'seq') renderSeq(); }
$('#searchF').addEventListener('submit', e => { e.preventDefault(); doSearch(); });
let qT; $('#q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => doSearch(), 300); });
$('#whole').addEventListener('change', () => doSearch());

/* ---------- reader ---------- */
function openPage(p) { cur = p; S.read[p] = true; save(); renderReader(); $('#reader').hidden = false; renderFolders(); }
function closeReader() { $('#reader').hidden = true; cur = null; refresh(); }
function renderReader() {
  const p = cur, tags = S.tags[p] || [], pos = S.order.indexOf(p) + 1;
  const pv = prevOf(p);
  const on = S.boards.filter(b => b.items.some(i => i.page === p)).map(b => esc(b.name));
  $('#sheet').innerHTML = `
    <header class="shead"><button class="navb" data-nav="-1" aria-label="Previous page">‹</button><h2>Page ${p}</h2><button class="navb" data-nav="1" aria-label="Next page">›</button>
      <span class="stamp" title="Your position in the sequence">#${pos}${S.sure[p] ? ' sure' : ''}</span><button class="close" data-close>Close</button></header>
    <div class="typed" id="typed">${body(PAGES[p - 1], searchRes && searchRes.r, p)}</div>
    <div class="hlbar"><button class="btn hlb" id="hlBtn">Highlight selection</button>${(S.marks[p] || []).length ? `<button class="ul" id="hlClear">Clear highlights</button>` : ''}<span>Select words, press Highlight, then add a note if you like (e.g. a definition). Tap a highlight to edit or remove it.</span></div>
    ${hlNotes(p)}
    <div class="meta">
      <div class="tags">${tags.map(t => chip(t, 1)).join('')}<form id="tagF"><input id="tagIn" list="tagList" placeholder="Add a tag, press Enter" aria-label="Add tag"></form></div>
      <div class="links">
        <div>${pv != null ? `Locked to previous: <button class="lk" data-open="${pv}">p.${pv}</button> <button class="ul" data-unlink="${pv}">unlock</button>` : `<form data-linkf="before">Lock to previous page <input type="number" min="1" max="${N}" aria-label="Page this comes after"> <button class="btn">Lock</button></form>`}</div>
        <div>${S.next[p] ? `Locked to next: <button class="lk" data-open="${S.next[p]}">p.${S.next[p]}</button> <button class="ul" data-unlink="${p}">unlock</button>` : `<form data-linkf="after">Lock to next page <input type="number" min="1" max="${N}" aria-label="Page this comes before"> <button class="btn">Lock</button></form>`}</div>
      </div>
      <div class="row">${S.folders.filter(f => f.pages.includes(p)).map(f => `<span class="tag" style="--h:40">${esc(f.name)}<button data-unfile="${f.id}" data-p="${p}" aria-label="Remove from ${esc(f.name)}">×</button></span>`).join('')}
        <select id="fileSel" aria-label="File in folder"><option value="">File in folder…</option>${S.folders.filter(f => !f.pages.includes(p)).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}<option value="__new">New folder…</option></select></div>
      <label>Margin notes<textarea id="pnote" rows="3" placeholder="Who is speaking? Where, and when?">${esc(S.notes[p] || '')}</textarea></label>
      <div class="row"><select id="pinSel" aria-label="Board">${S.boards.map((b, i) => `<option value="${i}"${i === S.active ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
        <button class="btn" id="pinBtn">Pin to board</button>${on.length ? `<span>Already on: ${on.join(', ')}</span>` : ''}</div>
    </div>`;
  $('#tagList').innerHTML = allTags().map(t => `<option value="${esc(t)}">`).join('');
}
$('#sheet').addEventListener('click', e => {
  const t = e.target;
  if ($('#hlPop') && !t.closest('#hlPop') && !t.closest('mark.hl, [data-hl]') && t.id !== 'hlBtn') closePop();
  if (t.closest('[data-close]')) return closeReader();
  const n = t.closest('[data-nav]'); if (n) return openPage(((cur - 1 + +n.dataset.nav + N) % N) + 1);
  const u = t.closest('[data-untag]'); if (u) { S.tags[cur] = (S.tags[cur] || []).filter(x => x !== u.dataset.untag); if (!S.tags[cur].length) delete S.tags[cur]; save(); renderReader(); renderFolders(); return; }
  const uf = t.closest('[data-unfile]'); if (uf) { unfile(uf.dataset.unfile, cur); renderReader(); renderFolders(); return; }
  if (t.id === 'hlBtn') return addMark();
  if (t.id === 'hlClear') { const n = (S.marks[cur] || []).filter(m => m[2]).length; modal({title:'Clear all highlights on this page?', text:n ? `${n} highlight note${n > 1 ? 's' : ''} will be deleted too.` : '', ok:'Clear', danger:1}).then(ok => { if (ok) { delete S.marks[cur]; save(); renderReader(); } }); return; }
  const mk = t.closest('#typed mark.hl, [data-hl]'); if (mk && getSelection().isCollapsed) return openPop(+(mk.dataset.k ?? mk.dataset.hl));
  if (t.id === 'hlDone') return closePop();
  if (t.id === 'hlDel') { S.marks[cur].splice(popK, 1); if (!S.marks[cur].length) delete S.marks[cur]; popK = -1; save(); renderReader(); return; }
  const ul = t.closest('[data-unlink]'); if (ul) { unlink(+ul.dataset.unlink); renderReader(); return; }
  const lk = t.closest('.lk[data-open]'); if (lk) return openPage(+lk.dataset.open);
  if (t.id === 'pinBtn') { pin(cur, +$('#pinSel').value); renderReader(); }
});
$('#sheet').addEventListener('submit', e => {
  e.preventDefault();
  const lf = e.target.dataset.linkf;
  if (lf) { const v = parseInt(e.target.querySelector('input').value, 10); const err = lf === 'before' ? link(v, cur) : link(cur, v); if (err) toast(err); else toast('Locked'); renderReader(); return; }
  const v = $('#tagIn').value.trim().slice(0, 40); if (!v) return;
  const list = S.tags[cur] || (S.tags[cur] = []);
  if (!list.includes(v)) list.push(v);
  save(); renderReader(); renderFolders(); $('#tagIn').focus();
});
$('#sheet').addEventListener('change', async e => {
  if (e.target.id !== 'fileSel') return;
  const v = e.target.value; if (!v) return;
  if (v === '__new') await newFolder(cur); else fileIn(v, cur);
  renderReader(); renderFolders();
});
// highlights: remember the last selection inside the page text (taps on mobile can clear it before the button fires)
let lastSel = null;
document.addEventListener('selectionchange', () => {
  const s = getSelection(), box = document.getElementById('typed');
  if (!box || !s.rangeCount || s.isCollapsed) return;
  const r = s.getRangeAt(0); if (!box.contains(r.startContainer) || !box.contains(r.endContainer)) return;
  const pre = document.createRange(); pre.selectNodeContents(box); pre.setEnd(r.startContainer, r.startOffset);
  const a = pre.toString().length; lastSel = {p:cur, s:a, e:a + r.toString().length};
});
function addMark() {
  if (!lastSel || lastSel.p !== cur || lastSel.e <= lastSel.s) return toast('Select some words on the page first');
  const t = PAGES[cur - 1]; let {s, e} = lastSel;
  while (s < e && /\s/.test(t[s])) s++; while (e > s && /\s/.test(t[e - 1])) e--;
  if (e <= s) return;
  const list = [...(S.marks[cur] || []), [s, e, '']].sort((x, y) => x[0] - y[0]), out = [];
  for (const m of list) { const l = out[out.length - 1]; if (l && m[0] <= l[1]) { l[1] = Math.max(l[1], m[1]); l[2] = [l[2], m[2]].filter(Boolean).join(' / '); } else out.push([m[0], m[1], m[2] || '']); }
  S.marks[cur] = out; lastSel = null; getSelection().removeAllRanges(); save(); renderReader();
  openPop(out.findIndex(m => s >= m[0] && s < m[1]), true);
}
function hlNotes(p) {
  const t = PAGES[p - 1], m = (S.marks[p] || []).map((x, k) => [x, k]).filter(([x]) => x[2]);
  return m.length ? `<ul class="hnotes">${m.map(([x, k]) => `<li><button data-hl="${k}">“${esc(t.slice(x[0], x[1]))}”</button> ${esc(x[2])}</li>`).join('')}</ul>` : '';
}
let popK = -1;
function openPop(k, isNew) {
  const m = (S.marks[cur] || [])[k]; if (!m) return;
  closePop(); popK = k;
  const el = document.querySelector(`#typed mark[data-k="${k}"]`), sh = $('#sheet');
  const sr = sh.getBoundingClientRect(), r = el ? el.getBoundingClientRect() : sr;
  const pop = document.createElement('div'); pop.id = 'hlPop'; pop.className = 'hlpop';
  pop.innerHTML = `<div class="q">“${esc(PAGES[cur - 1].slice(m[0], m[1]))}”</div><textarea id="hlNote" rows="3" placeholder="Note, e.g. a definition or who this refers to" aria-label="Highlight note">${esc(m[2] || '')}</textarea><div class="acts"><button class="ul" id="hlDel">Remove highlight</button><button class="btn" id="hlDone">Done</button></div>`;
  sh.appendChild(pop);
  const w = pop.offsetWidth;
  pop.style.top = (r.bottom - sr.top + 8) + 'px';
  pop.style.left = Math.max(8, Math.min(sr.width - w - 8, r.left - sr.left)) + 'px';
  if (isNew && matchMedia('(pointer: fine)').matches) $('#hlNote').focus({preventScroll:true}); // no auto-focus on touch: avoids popping the keyboard
  if (el) el.scrollIntoView({block:"center"}); pop.scrollIntoView({block:"nearest"});
}
function closePop() { const p = $('#hlPop'); if (!p) return; p.remove(); popK = -1; renderReader(); }
$('#sheet').addEventListener('input', e => { if (e.target.id === 'hlNote' && popK >= 0) { S.marks[cur][popK][2] = e.target.value; save(); } });
$('#sheet').addEventListener('input', e => { if (e.target.id === 'pnote') { const v = e.target.value; v ? S.notes[cur] = v : delete S.notes[cur]; save(); } });
$('#sheet').addEventListener('pointerdown', e => { if (e.target.id === 'hlBtn') e.preventDefault(); });
$('#reader').addEventListener('click', e => { if (e.target.id === 'reader') closeReader(); });

/* ---------- boards ---------- */
const board = () => S.boards[S.active];
const topZ = () => Math.max(1, ...board().items.map(i => i.z || 1));
function pin(p, bi = S.active, at) {
  const b = S.boards[bi], w = $('#corkWrap'), z = S.zoom, j = () => Math.random() * 80 - 40;
  const x = Math.round(Math.min(CW - 280, Math.max(0, at ? at.x : (w.scrollLeft + w.clientWidth / 2) / z - 135 + j())));
  const y = Math.round(Math.min(CH - 300, Math.max(0, at ? at.y : (w.scrollTop + w.clientHeight / 2) / z - 140 + j())));
  b.items.push({id:uid(), type:'page', page:p, x, y, z:Math.max(1, ...b.items.map(i => i.z || 1)) + 1});
  save(); if (bi === S.active) renderBoard();
  toast(`Page ${p} pinned to ${b.name}`);
}
function itemHTML(it) {
  const pos = `left:${it.x}px;top:${it.y}px;z-index:${it.z || 1}`;
  if (it.type === 'page') return `<div class="it pg" data-id="${it.id}" style="${pos}"><div class="grip"><i class="tack"></i><b>p.${it.page}</b>${chips(it.page)}<button data-open="${it.page}">Open</button><button class="rm" data-rm="${it.id}" aria-label="Unpin page">×</button></div><div class="ptext">${body(PAGES[it.page - 1], null, it.page)}</div></div>`;
  return `<div class="it note c${it.color || 0}" data-id="${it.id}" style="${pos}"><div class="grip"><i class="tack"></i><button data-color="${it.id}">Colour</button><button class="rm" data-rm="${it.id}" aria-label="Remove note">×</button></div><textarea data-note="${it.id}"${it.w ? ` style="width:${it.w}px;height:${it.h}px"` : ''} placeholder="Write a clue…" aria-label="Sticky note">${esc(it.text || '')}</textarea></div>`;
}
function renderBoard() {
  $('#boardTabs').innerHTML = S.boards.map((b, i) => `<button class="btab${i === S.active ? ' on' : ''}" data-board="${i}">${esc(b.name)} <small>${b.items.length}</small></button>`).join('');
  const b = board();
  $('#cork').innerHTML = b.items.length ? b.items.map(itemHTML).join('') :
    `<div class="corkempty"><h2>The case</h2><p>One hundred pages, printed out of order. Six people are murdered; six people do the murdering. Put the pages back in sequence and name them all.</p><p>Drag a page from the cabinet onto the cork, or press <b>Pin</b>. Add sticky notes for your theories. Drag anything by its top edge. Everything you do is kept in this browser.</p></div>`;
  $('#delBoard').disabled = S.boards.length < 2;
  applyZoom();
}
function applyZoom() {
  const z = S.zoom;
  $('#cork').style.transform = `scale(${z})`;
  $('#sizer').style.width = CW * z + 'px'; $('#sizer').style.height = CH * z + 'px';
  $('#zv').textContent = Math.round(z * 100) + '%';
}
document.querySelector('.boardbar').addEventListener('click', async e => {
  const t = e.target;
  const bt = t.closest('[data-board]'); if (bt) { S.active = +bt.dataset.board; save(); renderBoard(); return; }
  const zb = t.closest('[data-zoom]'); if (zb) { S.zoom = Math.min(1.5, Math.max(0.3, Math.round((S.zoom + 0.1 * zb.dataset.zoom) * 10) / 10)); save(); applyZoom(); return; }
  if (t.id === 'newBoard') { const n = await modal({title:'New cork board', input:`Board ${S.boards.length + 1}`, ok:'Create'}); if (n) { S.boards.push({id:uid(), name:n.slice(0, 40), items:[]}); S.active = S.boards.length - 1; save(); renderBoard(); } }
  if (t.id === 'renBoard') { const n = await modal({title:'Rename board', input:board().name, ok:'Rename'}); if (n) { board().name = n.slice(0, 40); save(); renderBoard(); } }
  if (t.id === 'delBoard' && S.boards.length > 1) { const ok = await modal({title:`Delete “${board().name}”?`, text:`Its ${board().items.length} pinned items will be removed. Pages stay in the cabinet.`, ok:'Delete', danger:1}); if (ok) { S.boards.splice(S.active, 1); S.active = 0; save(); renderBoard(); } }
  if (t.id === 'addNote') {
    const w = $('#corkWrap'), z = S.zoom;
    board().items.push({id:uid(), type:'note', text:'', color:board().items.filter(i => i.type === 'note').length % 4, x:Math.max(20, (w.scrollLeft + w.clientWidth / 2) / z - 105), y:Math.max(20, (w.scrollTop + w.clientHeight / 2) / z - 90), z:topZ() + 1});
    save(); renderBoard();
    const ta = [...document.querySelectorAll('#cork textarea')].pop(); if (ta) ta.focus({preventScroll:true});
  }
});
$('#folders').addEventListener('dragstart', e => { const c = e.target.closest('[data-card]'); if (!c) return; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/x-cj-page', c.dataset.card); });
const isPage = e => [...e.dataTransfer.types].includes('text/x-cj-page');
$('#corkWrap').addEventListener('dragover', e => { if (!isPage(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; $('#corkWrap').classList.add('dropping'); });
$('#corkWrap').addEventListener('dragleave', e => { if (!$('#corkWrap').contains(e.relatedTarget)) $('#corkWrap').classList.remove('dropping'); });
$('#corkWrap').addEventListener('drop', e => {
  $('#corkWrap').classList.remove('dropping'); if (!isPage(e)) return; e.preventDefault();
  const p = +e.dataTransfer.getData('text/x-cj-page'), r = $('#cork').getBoundingClientRect(), z = S.zoom;
  if (p >= 1 && p <= N) pin(p, S.active, {x:(e.clientX - r.left) / z - 135, y:(e.clientY - r.top) / z - 14});
});
const findItem = id => board().items.find(i => i.id === id);
$('#cork').addEventListener('click', e => {
  const t = e.target;
  const o = t.closest('[data-open]'); if (o) return openPage(+o.dataset.open);
  const r = t.closest('[data-rm]'); if (r) { board().items = board().items.filter(i => i.id !== r.dataset.rm); save(); renderBoard(); return; }
  const c = t.closest('[data-color]'); if (c) { const it = findItem(c.dataset.color); it.color = ((it.color || 0) + 1) % 4; save(); renderBoard(); }
});
$('#cork').addEventListener('input', e => { const id = e.target.dataset.note; if (id) { findItem(id).text = e.target.value; save(); } });
let drag = null;
$('#cork').addEventListener('pointerdown', e => {
  const g = e.target.closest('.grip'); if (!g || e.target.closest('button')) return;
  const el = g.parentElement, it = findItem(el.dataset.id); if (!it) return;
  it.z = topZ() + 1; el.style.zIndex = it.z;
  drag = {el, it, sx:e.clientX, sy:e.clientY, ox:it.x, oy:it.y};
  el.classList.add('dragging'); g.setPointerCapture(e.pointerId); e.preventDefault();
});
$('#cork').addEventListener('pointermove', e => {
  if (!drag) return;
  const z = S.zoom, d = drag;
  d.it.x = Math.round(Math.min(CW - 80, Math.max(0, d.ox + (e.clientX - d.sx) / z)));
  d.it.y = Math.round(Math.min(CH - 60, Math.max(0, d.oy + (e.clientY - d.sy) / z)));
  d.el.style.left = d.it.x + 'px'; d.el.style.top = d.it.y + 'px';
});
const noteSize = e => { const ta = e.target; if (ta.tagName !== 'TEXTAREA' || !ta.dataset.note) return; const it = findItem(ta.dataset.note); if (it && (it.w !== ta.offsetWidth || it.h !== ta.offsetHeight)) { it.w = ta.offsetWidth; it.h = ta.offsetHeight; save(); } };
$('#cork').addEventListener('pointerup', noteSize);
const endDrag = () => { if (!drag) return; drag.el.classList.remove('dragging'); drag = null; save(); };
$('#cork').addEventListener('pointerup', endDrag);
$('#cork').addEventListener('pointercancel', endDrag);

/* ---------- sequence & locks ---------- */
// S.next[a] = b means page b is locked to come immediately after page a.
const prevOf = b => { for (const a in S.next) if (S.next[a] === b) return +a; return null; };
function chainOf(p) {
  let h = p, g, guard = 0;
  while ((g = prevOf(h)) != null && guard++ < N) h = g;
  const c = [h];
  while (S.next[c[c.length - 1]] && c.length <= N) c.push(S.next[c[c.length - 1]]);
  return c;
}
function normalize() { // keep every locked chain contiguous, anchored where its earliest page sits
  const seen = new Set(), out = [];
  for (const p of S.order) { if (seen.has(p)) continue; const c = chainOf(p); c.forEach(x => seen.add(x)); out.push(...c); }
  S.order = out;
}
function link(a, b) {
  if (!(a >= 1 && a <= N && b >= 1 && b <= N)) return 'Enter a page number from 1 to 100.';
  if (a === b) return 'A page can’t follow itself.';
  if (S.next[a] === b) return '';
  if (S.next[a]) return `Page ${a} is already followed by page ${S.next[a]}. Unlock that first.`;
  const pb = prevOf(b); if (pb != null) return `Page ${b} already comes after page ${pb}. Unlock that first.`;
  if (chainOf(b).includes(a)) return 'That would make a loop.';
  const cb = chainOf(b);
  S.order = S.order.filter(x => !cb.includes(x));
  S.order.splice(S.order.indexOf(a) + 1, 0, ...cb);
  S.next[a] = b; save();
  return '';
}
function unlink(a) { delete S.next[a]; save(); }
function moveBlock(p, to) { // to = desired index of the block's first page
  const c = chainOf(p), o = S.order.filter(x => !c.includes(x));
  let t = Math.max(0, Math.min(o.length, to));
  while (t > 0 && t < o.length && S.next[o[t - 1]] === o[t]) t++;
  o.splice(t, 0, ...c); S.order = o; save(); renderSeq();
  const li = $('#seqList').children[S.order.indexOf(c[0])]; if (li) li.scrollIntoView({block:'nearest'});
}
function step(p, d) {
  const c = chainOf(p), h = S.order.indexOf(c[0]), e = h + c.length - 1;
  if (d < 0 && h > 0) moveBlock(p, h - chainOf(S.order[h - 1]).length);
  if (d > 0 && e < N - 1) moveBlock(p, h + chainOf(S.order[e + 1]).length);
}
function renderSeq() {
  const locks = Object.keys(S.next).length;
  const hit = p => searchRes && searchRes.hits.find(h => h.p === p);
  $('#seqList').innerHTML = S.order.map((p, i) => {
    const h = hit(p); if (searchRes && !h) return '';
    const pr = S.order[i - 1], nx = S.order[i + 1], lp = prevOf(p) != null, ln = !!S.next[p], inChain = lp || ln;
    return `<li draggable="true" data-p="${p}" class="${S.sure[p] ? 'sure' : ''}${inChain ? ' chain' : ''}${S.next[p] ? ' joined' : ''}">
    <span class="pos" title="Position in your sequence">#${i + 1}</span>
    <button class="sp" data-open="${p}"><b>p.${p}</b> ${h ? h.snip : esc(first(p, 110))}${chips(p)}</button>
    <div class="ctl"><button data-mv="${p}" data-d="-1" aria-label="Move page ${p} up">↑</button><button data-mv="${p}" data-d="1" aria-label="Move page ${p} down">↓</button>
    <input type="number" min="1" max="${N}" value="${i + 1}" data-to="${p}" aria-label="Position of page ${p}"><label><input type="checkbox" data-sure="${p}"${S.sure[p] ? ' checked' : ''}>sure</label></div>
    <div class="locks">${pr ? `<button class="lockb${lp ? ' on' : ''}" data-lk="prev" data-p="${p}" data-o="${pr}">${lp ? `↑ Locked to previous (p.${pr}) · unlock` : `↑ Lock to previous (p.${pr})`}</button>` : ''}${nx ? `<button class="lockb${ln ? ' on' : ''}" data-lk="next" data-p="${p}" data-o="${nx}">${ln ? `↓ Locked to next (p.${nx}) · unlock` : `↓ Lock to next (p.${nx})`}</button>` : ''}</div></li>`;
  }).join('');
  $('#seqStat').textContent = `${Object.values(S.sure).filter(Boolean).length} of ${N} marked sure · ${locks} lock${locks === 1 ? '' : 's'}.`;
  $('#seqFilter').hidden = !searchRes;
  if (searchRes) $('#seqFilterTxt').textContent = `Showing ${searchRes.hits.length} pages containing “${searchRes.q}”. Positions and moves still apply to the full sequence.`;
}
$('#seqList').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) return openPage(+o.dataset.open);
  const m = e.target.closest('[data-mv]'); if (m) return step(+m.dataset.mv, +m.dataset.d);
  const l = e.target.closest('[data-lk]');
  if (l) {
    const p = +l.dataset.p, o = +l.dataset.o, prev = l.dataset.lk === 'prev';
    if (prev && prevOf(p) != null) unlink(prevOf(p));
    else if (!prev && S.next[p]) unlink(p);
    else { const err = prev ? link(o, p) : link(p, o); if (err) toast(err); }
    renderSeq();
  }
});
$('#seqList').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.to) { const v = parseInt(t.value, 10), p = +t.dataset.to; if (v >= 1 && v <= N) moveBlock(p, v - 1 - (S.order.indexOf(p) - S.order.indexOf(chainOf(p)[0]))); else t.value = S.order.indexOf(p) + 1; }
  if (t.dataset.sure) { const p = +t.dataset.sure; t.checked ? S.sure[p] = true : delete S.sure[p]; save(); renderSeq(); }
});
let dragP = null;
$('#seqList').addEventListener('dragstart', e => { const li = e.target.closest('li'); if (!li) return; dragP = +li.dataset.p; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragP)); } catch (x) {} });
$('#seqList').addEventListener('dragover', e => { const li = e.target.closest('li'); if (!li || dragP == null) return; e.preventDefault(); document.querySelectorAll('#seqList .over').forEach(x => x.classList.remove('over')); li.classList.add('over'); });
$('#seqList').addEventListener('drop', e => {
  const li = e.target.closest('li'); if (!li || dragP == null) return; e.preventDefault();
  const q = +li.dataset.p, c = chainOf(dragP);
  if (!c.includes(q)) { const o = S.order.filter(x => !c.includes(x)); moveBlock(dragP, o.indexOf(q)); }
  dragP = null;
});
$('#seqList').addEventListener('dragend', () => { dragP = null; document.querySelectorAll('#seqList .over').forEach(x => x.classList.remove('over')); });
$('#seqClear').addEventListener('click', clearSearch);
$('#seqReset').addEventListener('click', async () => { if (await modal({title:'Reset the sequence?', text:'Pages go back to book order (locked pairs stay together) and “sure” ticks are cleared.', ok:'Reset', danger:1})) { S.order = range(1, N); S.sure = {}; normalize(); save(); renderSeq(); } });
$('#seqUnlock').addEventListener('click', async () => { if (await modal({title:'Remove every lock?', text:'Pages keep their current positions.', ok:'Unlock all', danger:1})) { S.next = {}; save(); renderSeq(); } });

/* ---------- ledger ---------- */
function renderLedger() {
  $('#lgrid').innerHTML = S.ledger.map((r, i) => `<div class="lrow"><span class="n">${i + 1}</span>
    <label>Victim<input data-l="${i}.v" value="${esc(r.v)}" autocomplete="off"></label>
    <label>Murderer<input data-l="${i}.m" value="${esc(r.m)}" autocomplete="off"></label>
    <label>Key pages<input data-l="${i}.p" value="${esc(r.p)}" placeholder="e.g. 12, 47" autocomplete="off"></label>
    <textarea class="wide" data-l="${i}.n" placeholder="How, where, and the clue that gave it away" aria-label="Notes for murder ${i + 1}">${esc(r.n)}</textarea></div>`).join('');
  $('#caseNotes').value = S.caseNotes;
  $('#ledgerBox').open = !!S.ledgerOpen;
  ledSum();
}
function ledSum() { const n = S.ledger.filter(r => r.v.trim() && r.m.trim()).length; $('#ledSum').textContent = `${n} of 6 named`; }
$('#lgrid').addEventListener('input', e => { const k = e.target.dataset.l; if (!k) return; const [i, f] = k.split('.'); S.ledger[i][f] = e.target.value; save(); ledSum(); });
$('#caseNotes').addEventListener('input', e => { S.caseNotes = e.target.value; save(); });

/* ---------- save / load ---------- */
async function saveDialog() {
  const json = JSON.stringify(S);
  const extra = `<p style="font-size:14px">Your work saves automatically in this browser. To move it to another device, copy the case file below and paste it there.</p><textarea id="mJson" aria-label="Case file JSON">${esc(json)}</textarea>
    <div class="acts" style="justify-content:flex-start"><button class="btn" id="mCopy">Copy</button><button class="btn" id="mLoad">Load pasted case</button><button class="btn" id="mWipe">Start over</button></div>`;
  const p = modal({title:'Save & load', extra, ok:'Done'});
  $('#mCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#mJson').value); toast('Copied'); } catch (e) { $('#mJson').select(); toast('Select all and copy'); } };
  $('#mLoad').onclick = () => { try { const s = JSON.parse($('#mJson').value); if (!valid(s)) throw 0; S = Object.assign(fresh(), s); save(); $('#modal').hidden = true; refreshAll(); toast('Case loaded'); } catch (e) { toast('That isn’t a valid case file'); } };
  $('#mWipe').onclick = () => { $('#mJson').value = JSON.stringify(fresh()); toast('Fresh file pasted — press Load to confirm'); };
  await p;
}

/* ---------- views ---------- */
function setView(v) {
  if (v === 'ledger' || v === 'save') v = 'seq';
  if (v === 'files' && !mobile()) v = 'board';
  S.view = v; document.body.dataset.view = v; save();
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.v === v));
  refresh();
}
function refresh() { const v = S.view; if (v === 'board' || v === 'files') renderBoard(); if (v === 'seq') { renderSeq(); renderLedger(); } renderFolders(); }
function refreshAll() { renderFolders(); renderBoard(); renderSeq(); renderLedger(); renderStats(); setView(S.view); }
$('#saveBtn').addEventListener('click', saveDialog);
function showSearch(on) {
  $('#searchF').hidden = !on; $('#searchBtn').setAttribute('aria-expanded', on);
  if (on) $('#q').focus(); else if (searchRes || $('#q').value) clearSearch();
}
$('#searchBtn').addEventListener('click', () => showSearch($('#searchF').hidden));
$('#searchX').addEventListener('click', () => showSearch(false));
$('#q').addEventListener('keydown', e => { if (e.key === 'Escape') showSearch(false); });
document.addEventListener('keydown', e => { if (e.key === '/' && $('#reader').hidden && $('#modal').hidden && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); showSearch(true); } });
$('#ledgerBox').addEventListener('toggle', e => { S.ledgerOpen = e.target.open; save(); });
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
document.addEventListener('keydown', e => {
  if ($('#reader').hidden) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === 'Escape') { if ($('#hlPop')) closePop(); else closeReader(); }
  else if (!typing && e.key === 'ArrowLeft') openPage(((cur - 2 + N) % N) + 1);
  else if (!typing && e.key === 'ArrowRight') openPage((cur % N) + 1);
});

$('#q').value = S.q || ''; $('#whole').checked = !!S.whole;
refreshAll();
if (S.q) { $('#searchF').hidden = false; $('#searchBtn').setAttribute('aria-expanded', true); doSearch(true); }
})();
