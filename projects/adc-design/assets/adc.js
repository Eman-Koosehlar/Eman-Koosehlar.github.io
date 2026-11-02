/* ==========================================================================
   Computational ADC Design — illustrative portfolio use case
   ---------------------------------------------------------------------------
   Adapted from the standalone reference "ADC Builder — Real Molecular
   Structure". Molecular data are PUBLIC deposited PDB coordinates fetched at
   runtime from RCSB; drawn bonds between components are schematic cylinders,
   NOT a chemically valid covalent conjugate. Nothing here is proprietary or
   claims efficacy, stability, drug-antibody ratio or any experimental result.

   Changes from the standalone version (behaviour of the builder is unchanged):
   • stale-redraw protection (rapid clicks no longer leave orphaned models)
   • 3Dmol.js CDN fallback + clear error / retry states
   • one-click example constructs, view controls, live construct summary
   • styling moved to the portfolio design system (assets/adc.css)
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- Real reference data (unchanged from reference) ---------------- */
  var CHEMISTRIES = [
    { id: 'thiomab', name: 'Engineered cysteine', caveat: true, note: 'Site-specific THIOMAB-style engineering. This structure has the native residue here — position shown for illustration, not a resolved mutant.',
      siteOptions: [
        { id: 's239c', label: 'S239C (heavy chain)', chain: 'H', resi: 239, atom: 'CB' },
        { id: 'a114c', label: 'A114C (heavy chain)', chain: 'H', resi: 114, atom: 'CB' }
      ] }
  ];
  var SUGARS = [
    { id: 'none', name: 'No sugar chain', note: 'Skip directly to the click handle / linker.' },
    { id: 'native', name: 'Native N-glycan chain', note: 'This antibody’s own real, resolved sugar residues, taken straight from the loaded structure.' }
  ];
  var CLICK_HANDLES = [
    { id: 'none', name: 'No click handle', note: 'Skip directly to the linker.' },
    { id: 'azide', name: 'Azide', note: 'Real azide-ion coordinates from PDB 1AZI (bound in horse-heart myoglobin).',
      sdfUrl: 'https://models.rcsb.org/v1/1azi/ligand?auth_seq_id=300&label_asym_id=C&encoding=sdf&filename=1azi_C_AZI.sdf', sourcePdb: '1AZI' },
    { id: 'alkyne', name: 'Alkyne', note: 'Real coordinates of L-propargylglycine, a genuine terminal-alkyne compound, from PDB 1I29.',
      sdfUrl: 'https://models.rcsb.org/v1/1i29/ligand?auth_seq_id=460&label_asym_id=B&encoding=sdf&filename=1i29_B_LPG.sdf', sourcePdb: '1I29' }
  ];
  var LINKERS = [
    { id: 'pegchain', name: 'PEG chain', abbr: 'PEG', note: 'Real tetraethylene-glycol coordinates from PDB 2BLX, standing in for a PEG-based linker.',
      sdfUrl: 'https://models.rcsb.org/v1/2blx/ligand?auth_seq_id=1131&label_asym_id=C&encoding=sdf&filename=2blx_C_PG4.sdf', sourcePdb: '2BLX' }
  ];
  var PAYLOADS = [
    { id: 'mmae', name: 'MMAE', abbr: 'MMAE', note: 'Monomethyl auristatin E — real coordinates from its tubulin-bound structure (PDB 5IYZ).',
      sdfUrl: 'https://models.rcsb.org/v1/5iyz/ligand?auth_seq_id=503&label_asym_id=S&encoding=sdf&filename=5iyz_S_4Q5.sdf', sourcePdb: '5IYZ' },
    { id: 'dm1', name: 'DM1 (mertansine)', abbr: 'DM1', note: 'Maytansinoid — shown using the real coordinates of its L-DM1-SMe crystallization analog (PDB 7E4Q).',
      sdfUrl: 'https://models.rcsb.org/v1/7e4q/ligand?auth_seq_id=503&label_asym_id=R&encoding=sdf&filename=7e4q_R_BKX.sdf', sourcePdb: '7E4Q' }
  ];
  var ORDER = ['chemistry', 'site', 'sugar', 'click', 'linker', 'payload'];
  var STEP_META = {
    chemistry: { title: 'Attachment chemistry', sub: 'Engineered-cysteine conjugation on this structure.' },
    site: { title: 'Site', sub: 'One real atom on chain H — the structure is symmetric.' },
    sugar: { title: 'Sugar chain', sub: 'This antibody’s own real glycan residues.' },
    click: { title: 'Click handle', sub: 'Bioorthogonal handle for downstream conjugation.' },
    linker: { title: 'Linker', sub: 'Spacer between handle and payload.' },
    payload: { title: 'Cytotoxic payload', sub: 'Real 3D coordinates from a drug–target structure.' }
  };
  var SUGAR_RESN = ['NAG', 'BMA', 'MAN', 'GAL', 'FUC', 'SIA'];
  var LOOKUP = { chemistry: CHEMISTRIES, sugar: SUGARS, click: CLICK_HANDLES, linker: LINKERS, payload: PAYLOADS };
  var COLORS = { pin: '#F2C744', sugar: '#34D399', click: '#F2C744', linker: '#9AA7B4', payload: '#FB6B90', warn: '#E0A93A' };
  var RCSB = function (id) { return 'https://www.rcsb.org/structure/' + id; };

  // One-click example constructs (replace the old "pre-built construct library")
  var PRESETS = [
    { name: 'S239C · azide · PEG · MMAE', s: { chemistry: 'thiomab', site: 's239c', sugar: 'none', click: 'azide', linker: 'pegchain', payload: 'mmae' } },
    { name: 'A114C · alkyne · PEG · DM1', s: { chemistry: 'thiomab', site: 'a114c', sugar: 'none', click: 'alkyne', linker: 'pegchain', payload: 'dm1' } },
    { name: 'S239C · native glycan · azide · PEG · DM1', s: { chemistry: 'thiomab', site: 's239c', sugar: 'native', click: 'azide', linker: 'pegchain', payload: 'dm1' } },
    { name: 'A114C · direct PEG · MMAE (minimal)', s: { chemistry: 'thiomab', site: 'a114c', sugar: 'none', click: 'none', linker: 'pegchain', payload: 'mmae' } }
  ];

  /* ---------------- State ---------------- */
  var EMPTY = function () { return { chemistry: null, site: null, sugar: null, click: null, linker: null, payload: null }; };
  var state = EMPTY();
  var viewer = null, antibodyModel = null, proteinCentroid = null, surfaceOn = true, surfaceId = null, spinning = false;
  var textCache = new Map(), addedModels = [], drawToken = 0;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Viewer setup ---------------- */
  function setStatus(msg, retry) {
    var s = $('viewerStatus');
    if (msg === null) { s.classList.add('hidden'); return; }
    s.classList.remove('hidden');
    s.innerHTML = '';
    var p = document.createElement('p'); p.textContent = msg; s.appendChild(p);
    if (retry) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = 'Retry'; b.addEventListener('click', function () { setStatus('Loading real antibody structure (PDB 1HZH) from RCSB…'); boot(); }); s.appendChild(b); }
  }
  function setBusy(msg) { var b = $('busy'); if (!b) return; b.hidden = !msg; b.textContent = msg || ''; }

  function loadScript(src) {
    return new Promise(function (resolve, reject) { var s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); });
  }
  async function ensure3Dmol() {
    if (window.$3Dmol) return true;
    try { await loadScript('https://3Dmol.org/build/3Dmol-min.js'); } catch (e) { /* fall through */ }
    return !!window.$3Dmol;
  }

  async function boot() {
    if (!(await ensure3Dmol())) { setStatus('The 3Dmol.js viewer library could not be loaded (cdnjs.cloudflare.com and 3Dmol.org were both unreachable). Check your network or content blocker, then retry.', true); return; }
    if (!viewer) {
      try { viewer = window.$3Dmol.createViewer($('viewport'), { backgroundColor: '#05070A' }); }
      catch (e) { setStatus('This viewer needs WebGL, which is not available in this browser.'); return; }
    }
    loadAntibody();
  }

  async function loadAntibody() {
    try {
      var res = await fetch('https://files.rcsb.org/download/1HZH.pdb');
      if (!res.ok) throw new Error('RCSB fetch failed: ' + res.status);
      var pdbText = await res.text();
      viewer.clear();
      antibodyModel = viewer.addModel(pdbText, 'pdb');
      viewer.setStyle({}, {});
      viewer.setStyle({ hetflag: false }, { cartoon: { colorfunc: chainColor } });
      viewer.setStyle({ hetflag: true, resn: SUGAR_RESN }, { stick: { radius: 0.18, colorscheme: 'greenCarbon' } });
      addProteinSurface();
      proteinCentroid = centroidOf(antibodyModel.selectedAtoms({ hetflag: false, atom: 'CA' }));
      viewer.zoomTo(); viewer.render();
      setStatus(null);
      renderSidebar();
      if (state.site) redraw();
    } catch (err) {
      console.error(err);
      setStatus('Could not load the antibody structure from RCSB (files.rcsb.org). This usually means there is no network access or a browser/extension is blocking cross-origin requests.', true);
    }
  }

  function chainColor(atom) {
    switch (atom.chain) { case 'H': return '#38BDF8'; case 'K': return '#2DD4BF'; case 'L': return '#A78BFA'; case 'M': return '#C4B5FD'; default: return '#94A3B8'; }
  }
  function addProteinSurface() {
    if (!viewer) return;
    if (surfaceId !== null) { viewer.removeSurface(surfaceId); surfaceId = null; }
    if (!surfaceOn) return;
    viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.4, color: '#3AA9D6' }, { hetflag: false }, {}, function (id) { surfaceId = id; });
  }
  function centroidOf(atoms) {
    if (!atoms.length) return { x: 0, y: 0, z: 0 };
    var x = 0, y = 0, z = 0; atoms.forEach(function (a) { x += a.x; y += a.y; z += a.z; });
    return { x: x / atoms.length, y: y / atoms.length, z: z / atoms.length };
  }
  function outwardDir(pos, c) { var dx = pos.x - c.x, dy = pos.y - c.y, dz = pos.z - c.z, l = Math.hypot(dx, dy, dz) || 1; return { x: dx / l, y: dy / l, z: dz / l }; }
  function advancePoint(p, d, n) { return { x: p.x + d.x * n, y: p.y + d.y * n, z: p.z + d.z * n }; }
  function getSiteAtom(site) { var a = antibodyModel.selectedAtoms({ chain: site.chain, resi: site.resi, atom: site.atom }); return a.length ? a[0] : null; }

  // Groups this antibody's own resolved glycan HETATMs (chain A or B) into monosaccharide residues.
  function getNativeGlycanResidues() {
    var chains = ['A', 'B'];
    for (var c = 0; c < chains.length; c++) {
      var atoms = antibodyModel.selectedAtoms({ chain: chains[c], hetflag: true }).filter(function (a) { return SUGAR_RESN.indexOf(a.resn) > -1; });
      if (!atoms.length) continue;
      var by = new Map(); atoms.forEach(function (a) { if (!by.has(a.resi)) by.set(a.resi, []); by.get(a.resi).push(a); });
      return Array.from(by.keys()).sort(function (x, y) { return x - y; }).map(function (r) { return { resi: r, resn: by.get(r)[0].resn, atoms: by.get(r) }; });
    }
    return [];
  }

  /* ---------------- Real-structure embedding ---------------- */
  async function fetchAndCache(url) {
    if (textCache.has(url)) return textCache.get(url);
    var res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed (' + res.status + '): ' + url);
    var text = await res.text(); textCache.set(url, text); return text;
  }
  function embedFromText(text, format, target, token) {
    if (token !== drawToken) return null; // a newer redraw has started — do not add stale models
    var m;
    try { m = viewer.addModel(text, format); } catch (e) { console.error(e); return null; }
    var atoms = m.selectedAtoms({});
    if (!atoms.length) { try { viewer.removeModel(m); } catch (e) { /* ignore */ } return null; }
    var c = centroidOf(atoms), dx = target.x - c.x, dy = target.y - c.y, dz = target.z - c.z;
    atoms.forEach(function (a) { a.x += dx; a.y += dy; a.z += dz; });
    m.setStyle({}, { stick: { radius: 0.15, colorscheme: 'default' }, sphere: { scale: 0.22, colorscheme: 'default' } });
    addedModels.push(m);
    return atoms;
  }
  async function embedInstanceSDF(url, target, token) {
    try { var text = await fetchAndCache(url); return embedFromText(text, 'sdf', target, token); }
    catch (e) { console.error(e); return null; }
  }
  // Minimal V2000 SDF from real atoms already in the loaded model (bonds inferred by distance < 1.9 Å).
  function residueAtomsToSDF(atoms) {
    var bonds = [], i, j;
    for (i = 0; i < atoms.length; i++) for (j = i + 1; j < atoms.length; j++) {
      if (Math.hypot(atoms[i].x - atoms[j].x, atoms[i].y - atoms[j].y, atoms[i].z - atoms[j].z) < 1.9) bonds.push([i + 1, j + 1]);
    }
    var L = ['residue', '', '', String(atoms.length).padStart(3, ' ') + String(bonds.length).padStart(3, ' ') + '  0  0  0  0  0  0  0  0999 V2000'];
    atoms.forEach(function (a) {
      var el = ((a.elem || a.el || 'C') + '').trim() || 'C';
      L.push(a.x.toFixed(4).padStart(10, ' ') + a.y.toFixed(4).padStart(10, ' ') + a.z.toFixed(4).padStart(10, ' ') + ' ' + el.padEnd(3, ' ') + ' 0  0  0  0  0  0  0  0  0  0  0  0');
    });
    bonds.forEach(function (b) { L.push(String(b[0]).padStart(3, ' ') + String(b[1]).padStart(3, ' ') + '  1  0  0  0  0'); });
    L.push('M  END');
    return L.join('\n');
  }
  function embedNativeResidue(res, target, token) {
    try { return embedFromText(residueAtomsToSDF(res.atoms), 'sdf', target, token); } catch (e) { console.error(e); return null; }
  }
  function clearAddedModels() { addedModels.forEach(function (m) { try { viewer.removeModel(m); } catch (e) { /* ignore */ } }); addedModels = []; }

  /* ---------------- Scene helpers ---------------- */
  function drawPin(pos, dir) {
    var tip = advancePoint(pos, dir, 9);
    viewer.addCylinder({ start: pos, end: tip, radius: 0.3, color: COLORS.pin, opacity: 0.95, fromCap: true, toCap: true });
    viewer.addSphere({ center: pos, radius: 0.55, color: COLORS.pin, opacity: 0.9 });
    return tip;
  }
  function addBond(p1, p2, color) { viewer.addCylinder({ start: p1, end: p2, radius: 0.09, color: color, opacity: 0.85 }); }
  function addMarker(pos, color) { viewer.addSphere({ center: pos, radius: 0.5, color: color, opacity: 0.85 }); }
  function addLabel(pos, text, color) {
    viewer.addLabel(text, { position: pos, backgroundColor: '#12181F', backgroundOpacity: 0.88, fontColor: color || '#E7ECF2', fontSize: 11.5, borderRadius: 3, inFront: true, showBackground: true, alignment: 'bottomCenter' });
  }
  function findIn(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

  async function buildChain(startPos, dir, token) {
    var cursor = { x: startPos.x, y: startPos.y, z: startPos.z }, prev = startPos, atoms, def, i;
    var alive = function () { return token === drawToken; };

    if (state.sugar === 'native') {
      var residues = getNativeGlycanResidues().slice(0, 4);
      if (!residues.length) {
        cursor = advancePoint(cursor, dir, 4.5); addMarker(cursor, COLORS.sugar); addBond(prev, cursor, COLORS.sugar);
        addLabel(cursor, 'no resolved glycan on this chain', COLORS.warn); prev = cursor;
      } else {
        for (i = 0; i < residues.length; i++) {
          cursor = advancePoint(cursor, dir, 4.5);
          atoms = embedNativeResidue(residues[i], cursor, token);
          if (!alive()) return;
          if (atoms) addBond(prev, cursor, COLORS.sugar);
          else { addMarker(cursor, COLORS.sugar); addBond(prev, cursor, COLORS.sugar); addLabel(cursor, residues[i].resn + ' (unavailable)', COLORS.warn); }
          prev = cursor;
        }
      }
    }
    if (state.click && state.click !== 'none') {
      def = findIn(CLICK_HANDLES, state.click); cursor = advancePoint(cursor, dir, 4.5);
      setBusy('Fetching ' + def.name + ' (PDB ' + def.sourcePdb + ')…');
      atoms = await embedInstanceSDF(def.sdfUrl, cursor, token); if (!alive()) return;
      if (atoms) addBond(prev, cursor, COLORS.click); else { addMarker(cursor, COLORS.click); addBond(prev, cursor, COLORS.click); addLabel(cursor, def.name + ' (unavailable)', COLORS.warn); }
      prev = cursor;
    }
    if (state.linker) {
      def = findIn(LINKERS, state.linker); cursor = advancePoint(cursor, dir, 5.5);
      setBusy('Fetching ' + def.name + ' (PDB ' + def.sourcePdb + ')…');
      atoms = await embedInstanceSDF(def.sdfUrl, cursor, token); if (!alive()) return;
      if (atoms) addBond(prev, cursor, COLORS.linker); else { addMarker(cursor, COLORS.linker); addBond(prev, cursor, COLORS.linker); addLabel(cursor, def.name + ' (unavailable)', COLORS.warn); }
      prev = cursor;
    }
    if (state.payload) {
      def = findIn(PAYLOADS, state.payload); cursor = advancePoint(cursor, dir, 6);
      setBusy('Fetching ' + def.name + ' (PDB ' + def.sourcePdb + ')…');
      atoms = await embedInstanceSDF(def.sdfUrl, cursor, token); if (!alive()) return;
      if (atoms) { addBond(prev, cursor, COLORS.payload); addLabel(cursor, def.name + ' (' + def.sourcePdb + ')'); }
      else { addMarker(cursor, COLORS.payload); addBond(prev, cursor, COLORS.payload); addLabel(cursor, def.name + ' (unavailable)', COLORS.warn); }
    }
  }

  /* ---------------- State + redraw ---------------- */
  function resetDownstream(from) { ORDER.slice(ORDER.indexOf(from) + 1).forEach(function (k) { state[k] = null; }); }
  function refreshUI() { renderSidebar(); renderLegend(); renderConjugatePanel(); renderSummary(); }
  function selectOption(step, value) { state[step] = value; resetDownstream(step); refreshUI(); redraw(); }
  function resetAll() { state = EMPTY(); refreshUI(); redraw(); }
  function applyPreset(p) { state = Object.assign(EMPTY(), p.s); refreshUI(); redraw(); }

  async function redraw() {
    if (!antibodyModel) return;
    var token = ++drawToken;
    clearAddedModels(); viewer.removeAllShapes(); viewer.removeAllLabels();
    if (state.chemistry && state.site) {
      var site = findIn(findIn(CHEMISTRIES, state.chemistry).siteOptions, state.site), atom = getSiteAtom(site);
      if (atom) {
        var pos = { x: atom.x, y: atom.y, z: atom.z }, dir = outwardDir(pos, proteinCentroid), tip = drawPin(pos, dir);
        viewer.render();
        await buildChain(tip, dir, token);
      } else addLabel({ x: proteinCentroid.x, y: proteinCentroid.y, z: proteinCentroid.z }, 'site atom not found in structure', COLORS.warn);
    }
    if (token === drawToken) { setBusy(null); viewer.render(); }
  }

  /* ---------------- Sidebar ---------------- */
  function optionsFor(key) { return key === 'site' ? (state.chemistry ? findIn(CHEMISTRIES, state.chemistry).siteOptions : []) : (LOOKUP[key] || []); }
  function renderSidebar() {
    var host = $('sidebar'); host.innerHTML = '';
    ORDER.forEach(function (key, idx) {
      var unlocked = idx === 0 || (state[ORDER[idx - 1]] !== null), done = state[key] !== null, meta = STEP_META[key];
      var el = document.createElement('div'); el.className = 'step' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
      el.innerHTML = '<div class="step-head"><span class="step-num">0' + (idx + 1) + '</span><span class="step-title">' + meta.title + '</span></div><div class="step-sub">' + meta.sub + '</div>';
      var row = document.createElement('div'); row.className = 'chip-row';
      optionsFor(key).forEach(function (opt) {
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'chip' + (state[key] === opt.id ? ' selected' : '') + (opt.caveat ? ' caveat' : '');
        b.setAttribute('aria-pressed', state[key] === opt.id ? 'true' : 'false');
        if (!unlocked) b.disabled = true;
        var note = key === 'site' ? 'Real atom: chain ' + opt.chain + ', residue ' + opt.resi + ' (' + opt.atom + ')' : (opt.note || '');
        b.innerHTML = '<span class="chip-name">' + (opt.name || opt.label) + '</span><span class="chip-note">' + note + '</span>';
        b.addEventListener('click', function () { selectOption(key, opt.id); });
        row.appendChild(b);
      });
      el.appendChild(row); host.appendChild(el);
    });
  }

  /* ---------------- Legend, components, summary ---------------- */
  function chosen() {
    var out = [];
    if (state.chemistry) { var chem = findIn(CHEMISTRIES, state.chemistry), site = state.site ? findIn(chem.siteOptions, state.site) : null; out.push({ role: 'Attachment', name: chem.name + (site ? ' — ' + site.label : ''), color: COLORS.pin, src: 'PDB 1HZH' }); }
    if (state.sugar === 'native') out.push({ role: 'Sugar', name: 'Native N-glycan', color: COLORS.sugar, src: 'PDB 1HZH', pdb: '1HZH' });
    if (state.click && state.click !== 'none') { var c = findIn(CLICK_HANDLES, state.click); out.push({ role: 'Click handle', name: c.name, color: COLORS.click, src: 'PDB ' + c.sourcePdb, pdb: c.sourcePdb }); }
    if (state.linker) { var l = findIn(LINKERS, state.linker); out.push({ role: 'Linker', name: l.name, color: COLORS.linker, src: 'PDB ' + l.sourcePdb, pdb: l.sourcePdb }); }
    if (state.payload) { var p = findIn(PAYLOADS, state.payload); out.push({ role: 'Payload', name: p.name, color: COLORS.payload, src: 'PDB ' + p.sourcePdb, pdb: p.sourcePdb }); }
    return out;
  }
  function renderLegend() {
    var host = $('legend'), parts = chosen(); host.innerHTML = '';
    if (!parts.length) { host.innerHTML = '<span>Choose an attachment chemistry and site to begin.</span>'; return; }
    parts.forEach(function (p) { var s = document.createElement('span'); s.innerHTML = '<i style="background:' + p.color + '"></i>' + p.name; host.appendChild(s); });
    if (state.linker && state.payload) { var n = document.createElement('span'); n.className = 'name'; n.textContent = 'IgG1-' + findIn(LINKERS, state.linker).abbr + '-' + findIn(PAYLOADS, state.payload).abbr; host.appendChild(n); }
  }
  function renderConjugatePanel() {
    var host = $('cpRow'), cards = chosen().filter(function (c) { return c.role !== 'Attachment'; }); host.innerHTML = '';
    if (!cards.length) { host.innerHTML = '<span class="cp-empty">Choose a site, then add components.</span>'; return; }
    cards.forEach(function (c) {
      var d = document.createElement('div'); d.className = 'cp-card';
      d.innerHTML = '<div class="cp-icon3d" style="--c:' + c.color + '"><i></i><span>' + c.role + '</span></div><div class="cp-name">' + c.name + '</div><div class="cp-cid">' + (c.pdb ? '<a href="' + RCSB(c.pdb) + '" target="_blank" rel="noopener noreferrer">' + c.src + ' ↗</a>' : c.src) + '</div>';
      host.appendChild(d);
    });
  }
  function renderSummary() {
    var host = $('summary'), parts = chosen();
    if (!parts.length) { host.innerHTML = '<p class="muted">No construct yet. Pick a site on the left, or load an example construct above.</p>'; return; }
    var name = state.linker && state.payload ? 'IgG1-' + findIn(LINKERS, state.linker).abbr + '-' + findIn(PAYLOADS, state.payload).abbr : 'Incomplete construct';
    host.innerHTML = '<h4>' + name + '</h4><ol class="sum-list">' + parts.map(function (p) { return '<li><i style="background:' + p.color + '"></i><b>' + p.role + '</b> ' + p.name + ' <small>' + p.src + '</small></li>'; }).join('') + '</ol>' +
      '<p class="fine">Visualization only: components are placed along an outward axis from the chosen atom and joined with schematic cylinders. Bond geometry, stoichiometry (DAR), linker chemistry and payload release are not modeled.</p>';
  }

  /* ---------------- Init ---------------- */
  function init() {
    $('presets').innerHTML = PRESETS.map(function (p, i) { return '<button type="button" class="btn small" data-p="' + i + '">' + p.name + '</button>'; }).join('');
    $('presets').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) applyPreset(PRESETS[+b.dataset.p]); });
    $('resetBtn').addEventListener('click', resetAll);
    $('surfaceBtn').addEventListener('click', function () { if (!viewer) return; surfaceOn = !surfaceOn; addProteinSurface(); viewer.render(); });
    $('viewBtn').addEventListener('click', function () { if (!viewer) return; viewer.zoomTo(); viewer.render(); });
    $('spinBtn').addEventListener('click', function (e) { if (!viewer) return; spinning = !spinning; viewer.spin(spinning); e.currentTarget.setAttribute('aria-pressed', spinning ? 'true' : 'false'); });
    window.addEventListener('resize', function () { if (viewer) viewer.resize(); });
    refreshUI();
    boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
