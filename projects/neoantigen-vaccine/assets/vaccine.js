/* ==========================================================================
   Personalized mRNA vaccine design — conceptual, non-clinical demonstration
   ---------------------------------------------------------------------------
   * All patients, variant allele fractions (VAF), expression values (TPM),
     peptides and scores are SYNTHETIC / ILLUSTRATIVE. Gene/variant names are
     familiar public cancer hotspots used only as recognisable examples; the
     combinations and numbers are invented.
   * No MHC-binding predictor, immunogenicity assay, TCR analysis or
     manufacturing design is performed. "Presentation" is a deterministic
     synthetic proxy so that changing the HLA allele visibly changes ranking.
   * Peptide strings are illustrative 9-mer contexts (not verified against
     UniProt/Ensembl) — they exist to demonstrate the visualisation.
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ----------------------------------------------------------------- DATA */
  // variant: [gene, change, consequence, VAF, TPM]
  var PROFILES = {
    melanoma: { name: 'Melanoma · synthetic patient', info: '7 example variants · BRAF / NRAS / TP53-centered profile', v: [
      ['BRAF', 'V600E', 'missense', .38, 24], ['NRAS', 'Q61R', 'missense', .31, 12], ['TP53', 'R248W', 'missense', .27, 38],
      ['ARID2', 'K1242fs', 'frameshift', .24, 11], ['CDKN2A', 'R80*', 'stop_gained', .42, 3], ['PTEN', 'R130Q', 'missense', .18, .4], ['TERT', 'C228T', 'regulatory', .33, 2]] },
    lung: { name: 'Lung cancer · synthetic patient', info: '7 example variants · KRAS / TP53 / STK11-centered profile', v: [
      ['KRAS', 'G12C', 'missense', .44, 41], ['TP53', 'R175H', 'missense', .32, 55], ['STK11', 'F354L', 'missense', .26, 8],
      ['ARID1A', 'Q1334fs', 'frameshift', .21, 9], ['KEAP1', 'G333C', 'missense', .22, .6], ['EGFR', 'L858R', 'missense', .17, 15], ['RB1', 'Q702*', 'stop_gained', .36, 6]] },
    colorectal: { name: 'Colorectal · synthetic patient', info: '7 example variants · APC / KRAS / TP53-centered profile', v: [
      ['APC', 'R1450*', 'stop_gained', .51, 22], ['KRAS', 'G12D', 'missense', .46, 34], ['TP53', 'R273H', 'missense', .34, 47],
      ['PIK3CA', 'H1047R', 'missense', .29, 18], ['RNF43', 'G659fs', 'frameshift', .29, 14], ['SMAD4', 'D351G', 'missense', .16, .5], ['BRAF', 'V600E', 'missense', .12, 9]] }
  };

  // Illustrative peptide contexts: [wild-type, mutant] (9-mers). For frameshifts the mutant is a synthetic novel peptide.
  var PEPTIDES = {
    'BRAF V600E': ['GLATVKSRW', 'GLATEKSRW'], 'NRAS Q61R': ['TAGQEEYSA', 'TAGREEYSA'], 'TP53 R248W': ['GMNRRPILT', 'GMNWRPILT'],
    'ARID2 K1242fs': ['SQPKEKLRD', 'SQPNMVWSG'], 'PTEN R130Q': ['RCLDQLRLR', 'RCLDQLQLR'],
    'KRAS G12C': ['VVVGAGGVG', 'VVVGACGVG'], 'KRAS G12D': ['VVVGAGGVG', 'VVVGADGVG'], 'TP53 R175H': ['EVVRRCPHH', 'EVVRHCPHH'],
    'STK11 F354L': ['QIPRPFLGE', 'QIPRPLLGE'], 'ARID1A Q1334fs': ['PQQSAGHQL', 'PQHLGTWRS'], 'KEAP1 G333C': ['VGGYCGPVS', 'VGGYCCPVS'],
    'EGFR L858R': ['FGLAKLLGA', 'FGRAKLLGA'], 'TP53 R273H': ['SFEVRVCAC', 'SFEVHVCAC'], 'PIK3CA H1047R': ['YMHRVLLRG', 'YMRRVLLRG'],
    'RNF43 G659fs': ['EAGPGSPVL', 'EAGRSLPQW'], 'SMAD4 D351G': ['PDHYGWCSI', 'PDHYGWCSG']
  };
  // Where the mutant differs from wild-type (index list, 0-based) — computed, not typed
  function diffIdx(wt, mt) { var o = []; for (var i = 0; i < wt.length; i++) if (wt[i] !== mt[i]) o.push(i); return o; }

  var HLA = {
    'HLA-A*02:01': { p2: 'LM', p9: 'VLI', note: 'P2 prefers L/M; C-terminus (P9) prefers V/L/I.' },
    'HLA-A*11:01': { p2: 'VIT', p9: 'KR', note: 'P2 prefers V/I/T; C-terminus prefers basic residues K/R.' },
    'HLA-A*24:02': { p2: 'YF', p9: 'FLI', note: 'P2 prefers Y/F; C-terminus prefers F/L/I.' },
    'HLA-B*07:02': { p2: 'P', p9: 'LMF', note: 'P2 strongly prefers P; C-terminus prefers L/M/F.' }
  };
  var ELIGIBLE = { missense: 'Missense — single amino-acid change creates a mutant peptide.', frameshift: 'Frameshift — creates a novel downstream peptide.' };
  var INELIGIBLE = {
    stop_gained: 'Stop-gained: truncated transcript is typically degraded (NMD); no mutant 9-mer in this model.',
    regulatory: 'Regulatory/non-coding: alters expression, not protein sequence, so no neoepitope.'
  };
  var IMPACT = { missense: .8, frameshift: 1 };
  var W = { presentation: .35, expression: .25, clonality: .20, impact: .20 };

  /* ----------------------------------------------------------------- MODEL */
  function hash01(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
  function presentationProxy(key, allele) { return .42 + .5 * hash01(key + '|' + allele); } // synthetic 0.42–0.92
  function components(v, allele) {
    var key = v[0] + ' ' + v[1];
    var c = {
      presentation: presentationProxy(key, allele),
      expression: clamp(Math.log2(v[4] + 1) / Math.log2(65), 0, 1),
      clonality: clamp(v[3] / .5, 0, 1),
      impact: IMPACT[v[2]] || 0
    };
    c.score = Math.round(100 * (W.presentation * c.presentation + W.expression * c.expression + W.clonality * c.clonality + W.impact * c.impact));
    return c;
  }
  function filterReasons(v, f) {
    var r = [];
    if (v[3] < f.vaf - 1e-9) r.push('VAF ' + v[3].toFixed(2) + ' < ' + f.vaf.toFixed(2));
    if (f.needExpr && v[4] < f.tpm) r.push('TPM ' + v[4] + ' < ' + f.tpm);
    if (f.eligibleOnly && !ELIGIBLE[v[2]]) r.push('not neoantigen-eligible (' + v[2] + ')');
    return r;
  }

  /* ----------------------------------------------------------------- STATE */
  var state = { profile: 'melanoma', current: null, selected: [] };
  function getFilters() { return { vaf: +$('vaf').value, tpm: +$('tpm').value, needExpr: $('expressed').checked, eligibleOnly: $('coding').checked, allele: $('hla').value }; }

  /* ------------------------------------------------------------- RENDERING */
  function analyze() {
    var p = PROFILES[state.profile], f = getFilters();
    $('vafText').textContent = f.vaf.toFixed(2); $('tpmText').textContent = f.tpm;
    var rows = p.v.map(function (v) { var rs = filterReasons(v, f); return { v: v, reasons: rs, pass: rs.length === 0 }; });
    var pass = rows.filter(function (r) { return r.pass; });
    var elig = rows.filter(function (r) { return ELIGIBLE[r.v[2]]; });
    $('variantCount').textContent = pass.length + ' / ' + p.v.length + ' pass';
    $('variantSummary').innerHTML =
      stat(pass.length, 'PASSING FILTERS') + stat(elig.length, 'NEOANTIGEN-ELIGIBLE') + stat(p.v.filter(function (v) { return v[2] === 'missense'; }).length, 'MISSENSE') + stat(p.v.filter(function (v) { return v[2] === 'frameshift'; }).length, 'FRAMESHIFT');
    $('variantTable').innerHTML = rows.map(function (r) {
      var v = r.v;
      return '<tr class="' + (r.pass ? 'is-pass' : 'is-filt') + '"><td><b>' + esc(v[0]) + '</b></td><td>' + esc(v[1]) + ' <span class="vx-faint">· ' + esc(v[2]) + '</span></td>' +
        '<td><div class="vx-vaf"><i style="width:' + (v[3] / .7 * 100).toFixed(0) + '%"></i></div>' + v[3].toFixed(2) + '</td><td>' + v[4] + ' <span class="vx-faint">TPM</span></td>' +
        '<td>' + (r.pass ? '<span class="vx-pass">PASS</span>' : '<span class="vx-filter">FILTERED</span><small>' + esc(r.reasons.join(' · ')) + '</small>') + '</td></tr>';
    }).join('');
    renderCandidates(pass.map(function (r) { return r.v; }), f);
  }
  function stat(n, l) { return '<div class="vx-stat"><b>' + n + '</b><span>' + l + '</span></div>'; }

  function renderCandidates(passV, f) {
    var list = passV.filter(function (v) { return ELIGIBLE[v[2]] && PEPTIDES[v[0] + ' ' + v[1]]; }).map(function (v) {
      var c = components(v, f.allele); return { key: v[0] + ' ' + v[1], v: v, c: c, score: c.score };
    }).sort(function (a, b) { return b.score - a.score; });
    $('candidateCount').textContent = list.length + ' candidates';
    if (state.current && !list.some(function (x) { return x.key === state.current.key; })) { state.current = null; showCandidate(null); }
    else if (state.current) { state.current = list.filter(function (x) { return x.key === state.current.key; })[0]; showCandidate(state.current); }
    $('candidateList').innerHTML = list.length ? list.map(function (c, i) {
      var sel = state.selected.some(function (s) { return s.key === c.key; });
      return '<button type="button" class="vx-candidate' + (state.current && state.current.key === c.key ? ' selected' : '') + '" data-k="' + esc(c.key) + '"><span class="rank">#' + (i + 1) + '</span><div><strong>' + esc(c.key) + '</strong><small>' + esc(f.allele) + ' · ' + esc(c.v[2]) + (sel ? ' · in construct' : '') + '</small></div><div class="vx-score">' + c.score + '<small>/100</small></div></button>';
    }).join('') : '<div class="vx-empty small">No candidates pass these filters. Lower the VAF or TPM threshold, or untick the eligibility filter.</div>';
    $$('.vx-candidate').forEach(function (e) { e.addEventListener('click', function () { state.current = list.filter(function (x) { return x.key === e.dataset.k; })[0]; showCandidate(state.current); $$('.vx-candidate').forEach(function (x) { x.classList.toggle('selected', x === e); }); $('inspector').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }); });
    state.list = list;
  }

  function seqHtml(seq, idx, hla) {
    var h = HLA[hla];
    return seq.split('').map(function (a, i) {
      var cls = 'vx-aa';
      if (idx.indexOf(i) > -1) cls += ' mut';
      if (i === 1) cls += h.p2.indexOf(a) > -1 ? ' anchor ok' : ' anchor';
      if (i === seq.length - 1) cls += h.p9.indexOf(a) > -1 ? ' anchor ok' : ' anchor';
      return '<span class="' + cls + '"><i>' + (i === seq.length - 1 ? 'P' + (i + 1) : 'P' + (i + 1)) + '</i>' + a + '</span>';
    }).join('');
  }
  function showCandidate(c) {
    if (!c) {
      $('candidateName').textContent = 'Candidate inspector'; $('candidateScore').textContent = 'Select one';
      $('candidateContent').innerHTML = '<div class="vx-empty"><div class="symbol">◈</div><p>Choose a candidate above. The mutant and wild-type peptides, HLA context and each score component will appear here.</p></div>'; return;
    }
    var f = getFilters(), pep = PEPTIDES[c.key], idx = diffIdx(pep[0], pep[1]), h = HLA[f.allele], v = c.v;
    var p2ok = h.p2.indexOf(pep[1][1]) > -1, p9ok = h.p9.indexOf(pep[1][8]) > -1;
    $('candidateName').textContent = c.key + ' · candidate neoantigen'; $('candidateScore').textContent = c.score + '/100';
    var comps = [
      ['Presentation (synthetic proxy)', c.c.presentation, W.presentation, 'Deterministic placeholder for HLA presentation; changes with the allele. A real pipeline would use a validated predictor.'],
      ['Expression', c.c.expression, W.expression, 'log₂(TPM+1) scaled to 0–1; ' + v[4] + ' TPM in this synthetic RNA-seq.'],
      ['Clonality', c.c.clonality, W.clonality, 'VAF ' + v[3].toFixed(2) + ' scaled so 0.50 = fully clonal; higher VAF suggests the variant is present in more tumor cells.'],
      ['Mutation impact', c.c.impact, W.impact, v[2] === 'frameshift' ? 'Frameshifts create a fully novel peptide, so they score highest.' : 'Missense changes one residue; the change must alter a presented or TCR-contact position to matter.']
    ];
    $('candidateContent').innerHTML =
      '<div class="vx-pep-block"><label>MUTANT PEPTIDE · ILLUSTRATIVE 9-MER</label><div class="vx-seq">' + seqHtml(pep[1], idx, f.allele) + '</div>' +
      '<label>WILD-TYPE PEPTIDE · ILLUSTRATIVE</label><div class="vx-seq wt">' + seqHtml(pep[0], idx, f.allele) + '</div>' +
      '<p class="vx-legend"><span class="mut">■</span> altered residue <span class="anchor">▢</span> HLA anchor position <span class="ok">▣</span> matches the allele’s anchor preference</p></div>' +
      '<div class="vx-meta"><div><span>HLA</span><b>' + esc(f.allele) + '</b></div><div><span>VARIANT</span><b>' + esc(v[0] + ' ' + v[1]) + '</b></div><div><span>VAF · TPM</span><b>' + v[3].toFixed(2) + ' · ' + v[4] + '</b></div></div>' +
      '<p class="vx-motif"><b>Anchor-motif hint (educational, not scored):</b> ' + esc(h.note) + ' This peptide: P2 = ' + pep[1][1] + (p2ok ? ' ✓' : ' ✗') + ', P9 = ' + pep[1][8] + (p9ok ? ' ✓' : ' ✗') + '.</p>' +
      '<div class="vx-bars">' + comps.map(function (k) { return bar(k[0], k[1], k[2], k[3]); }).join('') + '</div>' +
      '<p class="vx-total">Score = ' + comps.map(function (k) { return (k[2] * 100).toFixed(0) + '% × ' + Math.round(k[1] * 100); }).join(' + ') + ' = <b>' + c.score + '</b></p>' +
      '<button class="vx-run" id="addBtn" type="button">＋ Add this candidate to construct</button>';
    $('addBtn').onclick = function () { add(c); };
  }
  function bar(n, v, w, why) {
    return '<div class="vx-bar-row"><span>' + n + ' <em>×' + (w * 100).toFixed(0) + '%</em></span><div class="vx-bar"><i style="width:' + (v * 100).toFixed(0) + '%"></i></div><b>' + Math.round(v * 100) + '</b><small>' + esc(why) + '</small></div>';
  }

  /* ---------------------------------------------------------- CONSTRUCT */
  var LINKER = 'AAY';
  function add(c) {
    if (!state.selected.some(function (x) { return x.key === c.key; })) { if (state.selected.length === 3) state.selected.shift(); state.selected.push(c); }
    renderConstruct(); renderCandidatesSelectionMarks();
  }
  function renderCandidatesSelectionMarks() { analyze(); }
  function renderConstruct() {
    var sel = state.selected, f = getFilters();
    $$('[data-slot]').forEach(function (e, i) {
      var c = sel[i]; e.classList.toggle('filled', !!c);
      e.innerHTML = c ? '<b>' + esc(c.v[0]) + '</b><span>' + esc(c.v[1]) + '</span><small>' + c.score + '/100</small>' : 'EPITOPE<br><small>empty</small>';
    });
    $('selectionText').textContent = sel.length + ' / 3 selected';
    $('selectionCards').innerHTML = sel.map(function (c, i) {
      return '<span class="vx-chip">' + esc(c.key) + ' · ' + c.score + '<button type="button" data-act="left" data-i="' + i + '" aria-label="Move ' + esc(c.key) + ' earlier"' + (i === 0 ? ' disabled' : '') + '>←</button><button type="button" data-act="right" data-i="' + i + '" aria-label="Move ' + esc(c.key) + ' later"' + (i === sel.length - 1 ? ' disabled' : '') + '>→</button><button type="button" data-act="del" data-i="' + i + '" aria-label="Remove ' + esc(c.key) + '">✕</button></span>';
    }).join('');
    var rep = $('report');
    if (!sel.length) { rep.style.display = 'none'; return; }
    var seqs = sel.map(function (c) { return PEPTIDES[c.key][1]; }), poly = seqs.join(LINKER);
    rep.style.display = 'block';
    rep.innerHTML = '<div class="vx-eyebrow">GENERATED CONCEPT SUMMARY</div><h4>Multi-epitope construct · ' + sel.length + ' epitope' + (sel.length > 1 ? 's' : '') + '</h4>' +
      '<div class="vx-poly" aria-label="Concatenated illustrative epitope string">' + seqs.map(function (s, i) { return '<span class="e' + i + '">' + s + '</span>' + (i < seqs.length - 1 ? '<span class="lk">' + LINKER + '</span>' : ''); }).join('') + '</div>' +
      '<p class="vx-fine">Illustrative polyepitope string: ' + poly.length + ' aa (epitopes joined by the “' + LINKER + '” linker commonly used in multi-epitope design concepts). It is a visual placeholder — no codon optimization, UTR engineering, or manufacturing sequence is generated.</p>' +
      '<ul class="vx-rep-list">' + sel.map(function (c) {
        return '<li><b>' + esc(c.key) + '</b> — score ' + c.score + ' for ' + esc(f.allele) + ': presentation proxy ' + Math.round(c.c.presentation * 100) + ', expression ' + Math.round(c.c.expression * 100) + ' (' + c.v[4] + ' TPM), clonality ' + Math.round(c.c.clonality * 100) + ' (VAF ' + c.v[3].toFixed(2) + '), impact ' + Math.round(c.c.impact * 100) + '.</li>';
      }).join('') + '</ul>' +
      '<p class="vx-fine"><b>Not done here:</b> real HLA typing, binding/processing prediction, immunogenicity or TCR testing, self-similarity screening, safety review, or any experimental validation.</p>' +
      '<button class="vx-clear" id="printRep" type="button">Print / save summary ↗</button>';
    $('printRep').onclick = function () { window.print(); };
  }

  /* ----------------------------------------------------------------- INIT */
  function setProfile(k) {
    state.profile = k; state.current = null; state.selected = [];
    $$('.vx-profile-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.profile === k); b.setAttribute('aria-pressed', b.dataset.profile === k ? 'true' : 'false'); });
    $('profileInfo').innerHTML = '<b>' + esc(PROFILES[k].name) + '</b><br>' + esc(PROFILES[k].info);
    showCandidate(null); renderConstruct(); analyze();
  }
  function init() {
    $$('.vx-profile-btn').forEach(function (b) { b.addEventListener('click', function () { setProfile(b.dataset.profile); }); });
    ['vaf', 'tpm'].forEach(function (id) { $(id).addEventListener('input', analyze); });
    ['expressed', 'coding', 'hla'].forEach(function (id) { $(id).addEventListener('change', analyze); });
    $('runBtn').addEventListener('click', analyze);
    $('clear').addEventListener('click', function () { state.selected = []; renderConstruct(); analyze(); });
    $('selectionCards').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return; var i = +b.dataset.i, s = state.selected;
      if (b.dataset.act === 'del') s.splice(i, 1);
      else { var j = b.dataset.act === 'left' ? i - 1 : i + 1; var t = s[i]; s[i] = s[j]; s[j] = t; }
      renderConstruct(); analyze();
    });
    setProfile('melanoma');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.__vaccine = { PROFILES: PROFILES, PEPTIDES: PEPTIDES, components: components };
})();
