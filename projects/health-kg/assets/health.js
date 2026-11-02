/* ==========================================================================
   Health Knowledge Graph — non-clinical educational demonstration
   ---------------------------------------------------------------------------
   Everything here is SYNTHETIC and ILLUSTRATIVE. The "bands", weights and
   thresholds are teaching values chosen for the demo; they are NOT clinical
   reference ranges, risk models or diagnostic criteria.

   Model (two linear layers, fully traceable):
     factor value  --band curve-->  severity (0..1)
     state load    = min(1, Σ a[f→s] · severity[f])
     organ penalty = Σ W[s→organ] · state load        (points off 100)
     organ score   = 100 − penalty   (clamped 0..100)
     overall       = 0.7 · mean(organ scores) + 0.3 · min(organ scores)
   Because each layer is linear, every point of every penalty can be traced back
   to a single input factor — that is what the "explainable report" shows.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ DATA */
  // Band curves: [value, severity] points, linearly interpolated. Illustrative only.
  var FACTORS = [
    { id: 'glucose', label: 'Fasting glucose', short: 'Fasting glucose', unit: 'mg/dL', group: 'Laboratory markers', min: 70, max: 200, step: 1, def: 92, pts: [[70, 0], [99, 0], [110, .3], [125, .65], [160, 1], [200, 1]] },
    { id: 'hba1c', label: 'HbA1c', short: 'HbA1c', unit: '%', group: 'Laboratory markers', min: 4.5, max: 10, step: .1, def: 5.2, pts: [[4.5, 0], [5.6, 0], [6.0, .3], [6.5, .7], [8, 1], [10, 1]] },
    { id: 'ldl', label: 'LDL cholesterol', short: 'LDL cholesterol', unit: 'mg/dL', group: 'Laboratory markers', min: 50, max: 220, step: 1, def: 92, pts: [[50, 0], [100, 0], [130, .35], [160, .65], [190, 1], [220, 1]] },
    { id: 'crp', label: 'hs-CRP (inflammation marker)', short: 'hs-CRP', unit: 'mg/L', group: 'Laboratory markers', min: .2, max: 15, step: .1, def: .8, pts: [[.2, 0], [1, 0], [3, .5], [10, 1], [15, 1]] },
    { id: 'alt', label: 'ALT (liver enzyme)', short: 'ALT', unit: 'U/L', group: 'Laboratory markers', min: 8, max: 150, step: 1, def: 22, pts: [[8, 0], [35, 0], [55, .4], [100, .8], [150, 1]] },
    { id: 'egfr', label: 'eGFR (kidney filtration)', short: 'eGFR', unit: 'mL/min', group: 'Laboratory markers', min: 20, max: 120, step: 1, def: 102, pts: [[20, 1], [45, .85], [60, .6], [75, .25], [90, 0], [120, 0]] },
    { id: 'vitd', label: 'Vitamin D (25-OH)', short: 'Vitamin D', unit: 'ng/mL', group: 'Laboratory markers', min: 8, max: 70, step: 1, def: 38, pts: [[8, 1], [20, .6], [30, .1], [40, 0], [70, 0]] },
    { id: 'sbp', label: 'Systolic blood pressure', short: 'Systolic BP', unit: 'mmHg', group: 'Vitals', min: 90, max: 190, step: 1, def: 116, pts: [[90, .05], [115, 0], [120, 0], [130, .4], [140, .65], [160, 1], [190, 1]] },
    { id: 'sleep', label: 'Sleep duration', short: 'Sleep', unit: 'h/night', group: 'Lifestyle', min: 3, max: 11, step: .1, def: 7.6, pts: [[3, 1], [5, .75], [6, .4], [7, 0], [9, 0], [10, .35], [11, .6]] },
    { id: 'activity', label: 'Moderate activity', short: 'Activity', unit: 'min/week', group: 'Lifestyle', min: 0, max: 400, step: 5, def: 220, pts: [[0, 1], [60, .8], [150, .15], [210, 0], [400, 0]] },
    { id: 'stress', label: 'Perceived stress (0–10)', short: 'Stress', unit: '/10', group: 'Lifestyle', min: 0, max: 10, step: .5, def: 2.5, pts: [[0, 0], [3, 0], [6, .5], [10, 1]] },
    { id: 'alcohol', label: 'Alcohol intake', short: 'Alcohol', unit: 'drinks/week', group: 'Lifestyle', min: 0, max: 30, step: 1, def: 3, pts: [[0, 0], [7, 0], [14, .5], [21, .85], [30, 1]] },
    { id: 'smoking', label: 'Tobacco use', short: 'Tobacco', unit: '', group: 'Lifestyle', type: 'select', def: 'none', options: [['none', 'Never smoked', 0], ['former', 'Former smoker', .25], ['current', 'Current smoker', 1]] }
  ];
  var F = {}; FACTORS.forEach(function (f) { F[f.id] = f; });

  // Intermediate "health-state" nodes. inputs: factor -> {w: weight, why: reason}
  var STATES = [
    { id: 'glycemic', label: 'Glycemic regulation', inputs: {
      glucose: { w: .6, why: 'Fasting glucose reflects short-term glucose regulation.' },
      hba1c: { w: .6, why: 'HbA1c summarizes average glucose over roughly three months.' },
      activity: { w: .2, why: 'Regular activity is associated with better insulin sensitivity.' } } },
    { id: 'vascular', label: 'Lipid & vascular load', inputs: {
      ldl: { w: .7, why: 'LDL cholesterol is a modifiable lipid factor associated with arterial plaque.' },
      sbp: { w: .6, why: 'Higher systolic pressure increases mechanical load on vessels.' },
      smoking: { w: .3, why: 'Tobacco exposure is associated with vessel-wall damage.' } } },
    { id: 'inflammation', label: 'Systemic inflammation', inputs: {
      crp: { w: .8, why: 'hs-CRP is a general, non-specific marker of inflammation.' },
      smoking: { w: .25, why: 'Smoking is associated with raised inflammatory markers.' },
      stress: { w: .15, why: 'Chronic stress is associated with inflammatory signalling.' },
      sleep: { w: .15, why: 'Short or disrupted sleep is associated with higher inflammatory markers.' } } },
    { id: 'hepatic', label: 'Hepatic stress', inputs: {
      alt: { w: .7, why: 'ALT is a liver enzyme that rises with hepatocyte stress.' },
      hba1c: { w: .15, why: 'Insulin resistance is linked to fatty-liver processes.' } } },
    { id: 'renal', label: 'Renal filtration', inputs: {
      egfr: { w: .9, why: 'eGFR estimates how well the kidneys filter blood.' },
      sbp: { w: .25, why: 'Sustained high pressure strains kidney microvasculature.' },
      hba1c: { w: .2, why: 'Long-term high glucose is a recognised kidney stressor.' } } },
    { id: 'sleepstress', label: 'Sleep & stress resilience', inputs: {
      sleep: { w: .6, why: 'Sleep duration outside the typical adult range reduces recovery.' },
      stress: { w: .6, why: 'High perceived stress taxes the stress-response system.' } } },
    { id: 'nutrient', label: 'Nutrient status', inputs: {
      vitd: { w: .9, why: 'Vitamin D status is a proxy for one aspect of nutrient sufficiency.' } } },
    { id: 'conditioning', label: 'Physical conditioning', inputs: {
      activity: { w: .9, why: 'Weekly activity is a simple proxy for cardiorespiratory conditioning.' } } },
    { id: 'tobacco', label: 'Tobacco exposure', inputs: {
      smoking: { w: 1, why: 'Direct inhaled exposure to tobacco smoke.' } } },
    { id: 'alcohol', label: 'Alcohol load', inputs: {
      alcohol: { w: 1, why: 'Weekly alcohol intake is the direct input for this state.' } } }
  ];
  var S = {}; STATES.forEach(function (s) { S[s.id] = s; });

  var ORGANS = [
    { id: 'heart', label: 'Heart' }, { id: 'lungs', label: 'Lungs' }, { id: 'brain', label: 'Brain' },
    { id: 'liver', label: 'Liver' }, { id: 'kidneys', label: 'Kidneys' }
  ];
  var O = {}; ORGANS.forEach(function (o) { O[o.id] = o; });

  // state -> organ: max penalty points at full load, plus a plain-language reason
  var W = {
    glycemic: { kidneys: [18, 'Chronic high glucose strains the kidney’s filtering units.'], liver: [8, 'Glucose dysregulation is associated with fat accumulation in the liver.'], heart: [8, 'Dysglycemia is associated with higher cardiovascular load.'], brain: [8, 'Glucose variability is associated with vascular and cognitive effects.'] },
    vascular: { heart: [34, 'Lipids and pressure directly load the heart and coronary vessels.'], brain: [14, 'Vascular load is associated with cerebrovascular risk.'], kidneys: [14, 'Kidneys are richly vascular and sensitive to pressure.'] },
    inflammation: { heart: [10, 'Inflammation is associated with vessel-wall changes.'], lungs: [14, 'Systemic inflammation is associated with airway and lung stress.'], liver: [6, 'Inflammation is associated with liver stress.'], brain: [6, 'Inflammation is associated with neuro-inflammatory signalling.'], kidneys: [4, 'Inflammation can contribute to kidney stress.'] },
    hepatic: { liver: [58, 'Elevated liver enzymes point to direct liver-cell stress.'] },
    renal: { kidneys: [56, 'Filtration rate is the most direct kidney-function indicator in this demo.'], heart: [6, 'Reduced kidney function is associated with heart strain.'] },
    sleepstress: { brain: [36, 'Sleep and stress strongly shape brain recovery and mood regulation.'], heart: [8, 'Poor sleep and stress are associated with higher cardiac load.'] },
    nutrient: { brain: [6, 'Nutrient insufficiency can influence neuro-muscular and mood function.'], kidneys: [6, 'Vitamin D metabolism involves the kidneys.'], heart: [4, 'Low vitamin D is loosely associated with cardiovascular markers.'] },
    conditioning: { lungs: [22, 'Low activity reduces cardiorespiratory reserve.'], heart: [14, 'Low activity reduces cardiac conditioning.'], brain: [8, 'Activity is associated with better brain health.'] },
    tobacco: { lungs: [42, 'Inhaled smoke directly affects airways and lung tissue.'], heart: [16, 'Smoking is a major cardiovascular risk factor.'], brain: [6, 'Smoking is associated with cerebrovascular risk.'] },
    alcohol: { liver: [26, 'The liver metabolises alcohol, so intake loads it directly.'], brain: [12, 'Heavy alcohol intake is associated with cognitive effects.'], heart: [8, 'Heavy intake is associated with raised blood pressure and rhythm issues.'] }
  };

  // Illustrative recommendation candidates (NOT medical advice)
  var RECS = [
    { id: 'nut-fiber', short: 'Fiber-rich whole foods', cat: 'Nutrition', title: 'Fiber-rich, minimally processed meals', text: 'Emphasize vegetables, legumes, whole grains and nuts; limit refined sugars and ultra-processed foods.', states: { glycemic: .9, vascular: .5, inflammation: .4 }, organs: ['heart', 'kidneys', 'liver'] },
    { id: 'nut-med', short: 'Mediterranean pattern', cat: 'Nutrition', title: 'Mediterranean-style eating pattern', text: 'Olive oil, fish, plants and whole grains — a pattern widely studied in relation to cardiometabolic health.', states: { vascular: .9, inflammation: .5, glycemic: .3 }, organs: ['heart', 'brain'] },
    { id: 'nut-sodium', short: 'Sodium & hydration', cat: 'Nutrition', title: 'Sodium and hydration awareness', text: 'Check salt in packaged foods. Hydration needs vary — ask a clinician if kidney function is a concern.', states: { vascular: .4, renal: .8 }, organs: ['kidneys', 'heart'] },
    { id: 'move', short: 'Regular activity', cat: 'Movement', title: 'Build toward regular moderate activity', text: 'Many public-health guidelines suggest about 150 minutes a week; start gradually and adapt to your ability.', states: { conditioning: 1, glycemic: .5, vascular: .4, inflammation: .2 }, organs: ['heart', 'lungs', 'brain'] },
    { id: 'sleep', short: 'Sleep routine', cat: 'Sleep & stress', title: 'Consistent sleep schedule and wind-down routine', text: 'Regular sleep and wake times, a dark cool room and limited late screens are common sleep-hygiene themes.', states: { sleepstress: .9, inflammation: .2 }, organs: ['brain', 'heart'] },
    { id: 'stress', short: 'Stress recovery', cat: 'Sleep & stress', title: 'Stress-recovery practices', text: 'Breathing exercises, time outdoors, social connection — or professional support when stress persists.', states: { sleepstress: .7, inflammation: .2 }, organs: ['brain', 'heart'] },
    { id: 'alcohol', short: 'Review alcohol', cat: 'Lifestyle habits', title: 'Review alcohol intake', text: 'Reducing intake is a common first step when liver markers or weekly intake are high.', states: { alcohol: 1, hepatic: .5 }, organs: ['liver', 'brain', 'heart'] },
    { id: 'tobacco', short: 'Tobacco cessation', cat: 'Lifestyle habits', title: 'Tobacco-cessation support', text: 'Clinicians and national quitlines offer evidence-based support; quitting benefits lungs, heart and vessels.', states: { tobacco: 1, vascular: .3 }, organs: ['lungs', 'heart'] },
    { id: 'vitd', short: 'Vitamin D discussion', cat: 'Supplement conversation', title: 'Discuss vitamin D status and sources with a clinician', text: 'Sun exposure, diet and supplements all play a role; appropriate amounts depend on the individual.', states: { nutrient: 1 }, organs: ['brain', 'kidneys'] },
    { id: 'mon-glu', short: 'Glucose follow-up', cat: 'Monitoring & follow-up', title: 'Discuss repeat glucose / HbA1c testing', text: 'Trends over time are more informative than a single value; a clinician can advise on timing.', states: { glycemic: .9 }, organs: ['kidneys', 'heart'] },
    { id: 'mon-cv', short: 'BP & lipid monitoring', cat: 'Monitoring & follow-up', title: 'Discuss lipid and blood-pressure monitoring', text: 'Home blood-pressure logs and periodic lipid panels can help a clinician interpret the picture.', states: { vascular: .9 }, organs: ['heart'] },
    { id: 'mon-lk', short: 'Liver/kidney follow-up', cat: 'Monitoring & follow-up', title: 'Discuss liver / kidney panel follow-up and medication review', text: 'Some medicines and supplements affect liver and kidney markers; review them with a clinician.', states: { hepatic: .8, renal: .9 }, organs: ['liver', 'kidneys'] }
  ];
  var CAT_COLORS = { 'Nutrition': '#8ee7b2', 'Movement': '#76b8ff', 'Sleep & stress': '#b79cff', 'Lifestyle habits': '#f2c777', 'Supplement conversation': '#ff9fc0', 'Monitoring & follow-up': '#7fd8e8' };

  // Synthetic example profiles (invented numbers — not real people)
  var PRESETS = {
    A: { name: 'Synthetic profile A · Balanced', v: { glucose: 97, hba1c: 5.4, ldl: 108, crp: 1.2, alt: 26, egfr: 98, vitd: 33, sbp: 119, sleep: 7.0, activity: 170, stress: 3.5, alcohol: 4, smoking: 'none' } },
    B: { name: 'Synthetic profile B · Metabolic strain', v: { glucose: 118, hba1c: 6.1, ldl: 148, crp: 3.2, alt: 52, egfr: 82, vitd: 22, sbp: 136, sleep: 6.2, activity: 70, stress: 6, alcohol: 8, smoking: 'none' } },
    C: { name: 'Synthetic profile C · Mixed lifestyle load', v: { glucose: 104, hba1c: 5.8, ldl: 118, crp: 3.6, alt: 38, egfr: 78, vitd: 19, sbp: 126, sleep: 5.6, activity: 60, stress: 7, alcohol: 14, smoking: 'current' } }
  };

  /* --------------------------------------------------------------- HELPERS */
  function interp(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    }
    return pts[pts.length - 1][1];
  }
  function sevState(s) { return s < .2 ? 'ok' : s < .55 ? 'mid' : 'risk'; }
  function sevBand(s) { return s < .1 ? 'within illustrative range' : s < .35 ? 'slightly outside range' : s < .65 ? 'moderately outside range' : 'well outside range'; }
  function scoreState(n) { return n >= 75 ? 'ok' : n >= 50 ? 'mid' : 'risk'; }
  function scoreLabel(n) { return n >= 75 ? 'Favorable' : n >= 50 ? 'Watch' : 'Attention'; }
  function fmt(f, v) {
    if (f.type === 'select') return f.options.filter(function (o) { return o[0] === v; })[0][1];
    var d = f.step < 1 ? 1 : 0; return Number(v).toFixed(d) + (f.unit ? ' ' + f.unit : '');
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ----------------------------------------------------------------- MODEL */
  function compute(values) {
    var sev = {}, load = {}, raw = {}, organs = {}, byFactor = {};
    FACTORS.forEach(function (f) {
      sev[f.id] = f.type === 'select' ? f.options.filter(function (o) { return o[0] === values[f.id]; })[0][2] : interp(f.pts, +values[f.id]);
    });
    STATES.forEach(function (s) {
      var r = 0; Object.keys(s.inputs).forEach(function (fid) { r += s.inputs[fid].w * sev[fid]; });
      raw[s.id] = r; load[s.id] = Math.min(1, r);
    });
    ORGANS.forEach(function (o) {
      var penalty = 0; byFactor[o.id] = {};
      STATES.forEach(function (s) {
        var wt = W[s.id] && W[s.id][o.id]; if (!wt || load[s.id] <= 0) return;
        var scale = raw[s.id] > 1 ? 1 / raw[s.id] : 1; // keep contributions exact when a state saturates
        Object.keys(s.inputs).forEach(function (fid) {
          var pts = wt[0] * scale * s.inputs[fid].w * sev[fid];
          if (pts <= 0) return;
          penalty += pts;
          var bf = byFactor[o.id][fid] = byFactor[o.id][fid] || { pts: 0, via: [] };
          bf.pts += pts; bf.via.push({ state: s.id, pts: pts });
        });
      });
      organs[o.id] = { penalty: penalty, score: Math.max(0, Math.round(100 - penalty)) };
    });
    var sc = ORGANS.map(function (o) { return organs[o.id].score; });
    var mean = sc.reduce(function (a, b) { return a + b; }, 0) / sc.length, min = Math.min.apply(null, sc);
    var overall = Math.round(.7 * mean + .3 * min);
    // recommendations
    var recs = RECS.map(function (r) {
      var rel = 0, drivers = [];
      Object.keys(r.states).forEach(function (sid) { var c = r.states[sid] * load[sid]; rel += c; if (c > .05) drivers.push({ state: sid, c: c }); });
      drivers.sort(function (a, b) { return b.c - a.c; });
      return { rec: r, rel: Math.min(1, rel), drivers: drivers };
    });
    return { sev: sev, load: load, organs: organs, byFactor: byFactor, mean: mean, min: min, overall: overall, recs: recs };
  }

  /* ----------------------------------------------------------------- STATE */
  var values = {}, model = null, selectedOrgan = 'heart', graph = null, animate = !reduceMotion;
  function setPreset(key) { values = JSON.parse(JSON.stringify(PRESETS[key].v)); $('#preset').value = key; syncControls(); update(); }

  /* -------------------------------------------------------------- CONTROLS */
  function buildControls() {
    var host = $('#controls'), groups = {};
    FACTORS.forEach(function (f) { (groups[f.group] = groups[f.group] || []).push(f); });
    host.innerHTML = Object.keys(groups).map(function (g) {
      return '<fieldset class="ctl-group"><legend>' + esc(g) + '</legend>' + groups[g].map(function (f) {
        if (f.type === 'select') {
          return '<label class="ctl" for="in-' + f.id + '"><span class="ctl-top"><span>' + esc(f.label) + '</span><i class="dot" id="dot-' + f.id + '"></i></span><select id="in-' + f.id + '" data-f="' + f.id + '">' +
            f.options.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>';
        }
        return '<label class="ctl" for="in-' + f.id + '"><span class="ctl-top"><span>' + esc(f.label) + '</span><output id="out-' + f.id + '"></output></span>' +
          '<input type="range" id="in-' + f.id + '" data-f="' + f.id + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '"><i class="bandbar" id="dot-' + f.id + '"></i></label>';
      }).join('') + '</fieldset>';
    }).join('');
    $$('[data-f]', host).forEach(function (inp) {
      inp.addEventListener('input', function () {
        var f = F[inp.dataset.f]; values[f.id] = f.type === 'select' ? inp.value : parseFloat(inp.value);
        $('#preset').value = 'custom'; update();
      });
    });
  }
  function syncControls() {
    FACTORS.forEach(function (f) { var i = $('#in-' + f.id); if (i) i.value = values[f.id]; });
  }
  function paintControls() {
    FACTORS.forEach(function (f) {
      var out = $('#out-' + f.id); if (out) out.textContent = fmt(f, values[f.id]);
      var d = $('#dot-' + f.id); if (d) { d.className = (f.type === 'select' ? 'dot ' : 'bandbar ') + 'st-' + sevState(model.sev[f.id]); d.title = sevBand(model.sev[f.id]); }
    });
  }

  /* ------------------------------------------------------------ BODY + KPI */
  function paintBody() {
    ORGANS.forEach(function (o) {
      var sc = model.organs[o.id].score, st = scoreState(sc);
      $$('[data-organ="' + o.id + '"]').forEach(function (g) {
        g.classList.remove('st-ok', 'st-mid', 'st-risk'); g.classList.add('st-' + st);
        g.classList.toggle('sel', o.id === selectedOrgan);
        g.setAttribute('aria-pressed', o.id === selectedOrgan ? 'true' : 'false');
        if (g.classList.contains('organ')) g.setAttribute('aria-label', o.label + ' score ' + sc + ', ' + scoreLabel(sc));
      });
      $$('[data-score="' + o.id + '"]').forEach(function (t) { t.textContent = sc; });
      $$('[data-status="' + o.id + '"]').forEach(function (t) { t.textContent = scoreLabel(sc); });
    });
    var ov = model.overall, st = scoreState(ov), ring = $('#ring-arc'), C = 2 * Math.PI * 52;
    ring.setAttribute('stroke-dasharray', (C * ov / 100).toFixed(1) + ' ' + C.toFixed(1));
    var box = $('#overall'); box.className = 'overall st-' + st;
    $('#overall-num').textContent = ov; $('#overall-label').textContent = scoreLabel(ov);
    var worst = ORGANS.slice().sort(function (a, b) { return model.organs[a.id].score - model.organs[b.id].score; })[0];
    $('#overall-text').textContent = model.organs[worst.id].score >= 75
      ? 'All five organ scores are in the favorable band for this synthetic profile.'
      : 'Lowest organ score: ' + worst.label + ' (' + model.organs[worst.id].score + '). Select any organ to see exactly which inputs lowered it.';
  }
  function fitBody() {
    var wrap = $('#body-wrap'), svg = $('#body-svg'); if (!wrap || !svg) return;
    var compact = wrap.clientWidth < 520;
    svg.setAttribute('viewBox', compact ? '150 0 320 660' : '0 0 600 660');
    wrap.classList.toggle('compact', compact);
  }

  /* ----------------------------------------------------------------- GRAPH */
  function nid(prefix, id) { return prefix + ':' + id; }
  function graphSpec() {
    var m = model;
    var cols = [
      { title: 'Input factors', nodes: FACTORS.map(function (f) { return { id: nid('f', f.id), label: f.short, value: f.type === 'select' ? fmt(f, values[f.id]).split(' ')[0] : fmt(f, values[f.id]).split(' ')[0], state: sevState(m.sev[f.id]), detail: fmt(f, values[f.id]) + ' — ' + sevBand(m.sev[f.id]) }; }) },
      { title: 'Health states', nodes: STATES.map(function (s) { return { id: nid('s', s.id), label: s.label, value: Math.round(m.load[s.id] * 100) + '%', state: sevState(m.load[s.id]), detail: 'state load ' + Math.round(m.load[s.id] * 100) + '%' }; }) },
      { title: 'Organs', nodes: ORGANS.map(function (o) { var sc = m.organs[o.id].score; return { id: nid('o', o.id), label: o.label, value: String(sc), state: scoreState(sc), detail: 'score ' + sc + ' · ' + scoreLabel(sc) }; }) },
      { title: 'Recommendations', nodes: m.recs.map(function (r) { return { id: nid('r', r.rec.id), label: r.rec.short, value: r.rel >= .2 ? Math.round(r.rel * 100) + '%' : '', state: r.rel >= .2 ? 'accent' : 'off', detail: r.rec.cat + ' — relevance ' + Math.round(r.rel * 100) + '%' }; }) }
    ];
    var edges = [];
    STATES.forEach(function (s) { Object.keys(s.inputs).forEach(function (fid) { edges.push({ from: nid('f', fid), to: nid('s', s.id), strength: Math.min(1, s.inputs[fid].w * m.sev[fid] * 1.4), width: s.inputs[fid].w }); }); });
    Object.keys(W).forEach(function (sid) { Object.keys(W[sid]).forEach(function (oid) { edges.push({ from: nid('s', sid), to: nid('o', oid), strength: m.load[sid] * Math.min(1, W[sid][oid][0] / 18), width: W[sid][oid][0] / 50 }); }); });
    m.recs.forEach(function (r) { r.rec.organs.forEach(function (oid) { edges.push({ from: nid('o', oid), to: nid('r', r.rec.id), strength: r.rel >= .2 ? r.rel : 0, width: .35 }); }); });
    return { columns: cols, edges: edges };
  }
  function paintGraph() {
    var spec = graphSpec();
    if (!graph) {
      spec.ariaLabel = 'Knowledge graph connecting input factors, health states, organs and recommendations';
      spec.onSelect = function (id) { onGraphSelect(id); };
      graph = KGraph.create($('#kg'), spec); graph.setAnimate(animate);
    } else graph.update(spec);
  }
  function onGraphSelect(id) {
    if (!id) { $('#node-info').innerHTML = '<p class="muted">Hover or click any node to trace its connections. Click an organ to open its explanation.</p>'; return; }
    var parts = id.split(':'), type = parts[0], key = parts[1];
    if (type === 'o') selectOrgan(key, true);
    $('#node-info').innerHTML = describeNode(type, key);
  }
  function describeNode(type, key) {
    var m = model, h = '';
    if (type === 'f') {
      var f = F[key], s = m.sev[key];
      h = '<h4>' + esc(f.label) + ' <span class="score-pill st-' + sevState(s) + '">' + esc(fmt(f, values[key])) + '</span></h4><p>Currently <b>' + sevBand(s) + '</b> in this synthetic profile (severity ' + s.toFixed(2) + ').</p><ul>';
      STATES.forEach(function (st) { if (st.inputs[key]) h += '<li>→ <b>' + esc(st.label) + '</b>: ' + esc(st.inputs[key].why) + ' <em>(weight ' + st.inputs[key].w + ')</em></li>'; });
      h += '</ul>';
    } else if (type === 's') {
      var sd = S[key];
      h = '<h4>' + esc(sd.label) + ' <span class="score-pill st-' + sevState(m.load[key]) + '">load ' + Math.round(m.load[key] * 100) + '%</span></h4><p><b>Fed by:</b></p><ul>' +
        Object.keys(sd.inputs).map(function (fid) { return '<li>' + esc(F[fid].short) + ' — ' + sevBand(m.sev[fid]) + '. ' + esc(sd.inputs[fid].why) + '</li>'; }).join('') + '</ul><p><b>Influences:</b></p><ul>' +
        Object.keys(W[key] || {}).map(function (oid) { return '<li>' + esc(O[oid].label) + ' (up to −' + W[key][oid][0] + ' pts): ' + esc(W[key][oid][1]) + '</li>'; }).join('') + '</ul>';
    } else if (type === 'o') {
      var sc = m.organs[key].score;
      h = '<h4>' + esc(O[key].label) + ' <span class="score-pill st-' + scoreState(sc) + '">' + sc + ' · ' + scoreLabel(sc) + '</span></h4><p>Total deduction: <b>' + m.organs[key].penalty.toFixed(1) + ' pts</b>. Full breakdown is in the explainable report below.</p>';
    } else if (type === 'r') {
      var r = m.recs.filter(function (x) { return x.rec.id === key; })[0];
      h = '<h4>' + esc(r.rec.title) + ' <span class="score-pill st-ok">relevance ' + Math.round(r.rel * 100) + '%</span></h4><p>' + esc(r.rec.text) + '</p><p><b>Surfaced by:</b> ' +
        (r.drivers.length ? r.drivers.map(function (d) { return esc(S[d.state].label) + ' (' + Math.round(m.load[d.state] * 100) + '%)'; }).join(', ') : 'no active state — shown for completeness') + '.</p>';
    }
    return h;
  }

  /* ---------------------------------------------------------------- REPORT */
  function paintReport() {
    var m = model, id = selectedOrgan, o = m.organs[id], sc = o.score;
    $$('#organ-tabs button').forEach(function (b) {
      var oid = b.dataset.organ, s = m.organs[oid].score;
      b.setAttribute('aria-selected', oid === id ? 'true' : 'false');
      b.className = 'st-' + scoreState(s) + (oid === id ? ' on' : '');
      b.innerHTML = esc(O[oid].label) + ' <b>' + s + '</b>';
    });
    var rows = Object.keys(m.byFactor[id]).map(function (fid) { return { fid: fid, d: m.byFactor[id][fid] }; }).sort(function (a, b) { return b.d.pts - a.d.pts; });
    var top = rows.slice(0, 2).map(function (r) { return '<b>' + esc(F[r.fid].short) + '</b>'; });
    var head = '<div class="rep-head"><div><span class="kicker">Selected organ</span><h3>' + esc(O[id].label) + ' — ' + sc + ' <span class="score-pill st-' + scoreState(sc) + '">' + scoreLabel(sc) + '</span></h3></div>' +
      '<p class="rep-sum">' + (rows.length ? 'Score = 100 − ' + o.penalty.toFixed(1) + ' pts of deductions. The largest contributors are ' + top.join(' and ') + '.' : 'No deductions: every input that feeds this organ is within the illustrative range, so the score stays at 100.') + '</p></div>';
    var body = rows.map(function (r) {
      var f = F[r.fid], via = r.d.via.slice().sort(function (a, b) { return b.pts - a.pts; });
      var paths = via.map(function (v) {
        return '<div class="path"><span class="chip">' + esc(f.short) + '</span><i>→</i><span class="chip">' + esc(S[v.state].label) + '</span><i>→</i><span class="chip">' + esc(O[id].label) + '</span><b>−' + v.pts.toFixed(1) + '</b></div>' +
          '<p class="why"><b>Why the factor matters:</b> ' + esc(S[v.state].inputs[r.fid].why) + ' <b>Why the state matters for this organ:</b> ' + esc(W[v.state][id][1]) + '</p>';
      }).join('');
      return '<article class="why-card st-' + sevState(m.sev[r.fid]) + '"><div class="why-top"><div><strong>' + esc(f.label) + '</strong><small>' + esc(fmt(f, values[r.fid])) + ' · ' + sevBand(m.sev[r.fid]) + '</small></div><div class="pts">−' + r.d.pts.toFixed(1) + '<small>pts</small></div></div>' +
        '<div class="ptsbar"><i style="width:' + Math.min(100, r.d.pts / Math.max(.1, o.penalty) * 100).toFixed(0) + '%"></i></div>' + paths + '</article>';
    }).join('');
    var neutral = FACTORS.filter(function (f) { return !m.byFactor[id][f.id] && S && STATES.some(function (s) { return s.inputs[f.id] && W[s.id] && W[s.id][id]; }); }).map(function (f) { return f.short; });
    var foot = neutral.length ? '<p class="neutral"><b>No deduction from:</b> ' + esc(neutral.join(', ')) + ' (within the illustrative range, or contribution rounds to zero).</p>' : '';
    $('#organ-report').innerHTML = head + (body ? '<div class="why-grid">' + body + '</div>' : '') + foot;

    var ov = '<p>Overall score = 0.7 × mean(organ scores) + 0.3 × lowest organ score = 0.7 × ' + m.mean.toFixed(1) + ' + 0.3 × ' + m.min + ' = <b>' + m.overall + '</b>. Weighting the minimum keeps one poor organ score from being averaged away.</p>';
    $('#overall-report').innerHTML = ov;
  }

  /* ------------------------------------------------------- RECOMMENDATIONS */
  var recFilter = 'All';
  function paintRecs() {
    var m = model, cats = ['All'].concat(Object.keys(CAT_COLORS));
    var list = m.recs.filter(function (r) { return r.rel >= .2; }).sort(function (a, b) { return b.rel - a.rel; });
    $('#rec-filters').innerHTML = cats.map(function (c) {
      var n = c === 'All' ? list.length : list.filter(function (r) { return r.rec.cat === c; }).length;
      return '<button type="button" class="' + (c === recFilter ? 'on' : '') + '" data-cat="' + esc(c) + '"' + (n === 0 && c !== 'All' ? ' disabled' : '') + '>' + esc(c) + ' <b>' + n + '</b></button>';
    }).join('');
    var shown = list.filter(function (r) { return recFilter === 'All' || r.rec.cat === recFilter; });
    if (!list.length) {
      $('#rec-grid').innerHTML = '<article class="rec-card" style="--cc:#8ee7b2"><span class="cat">Baseline</span><h4>Maintain current habits</h4><p>No input is meaningfully outside the illustrative range, so the demo surfaces no targeted actions. Routine check-ups and balanced habits remain generally sensible.</p></article>';
      return;
    }
    $('#rec-grid').innerHTML = shown.map(function (r) {
      var why = r.drivers.map(function (d) {
        var feeders = Object.keys(S[d.state].inputs).filter(function (fid) { return m.sev[fid] > .2; }).map(function (fid) { return F[fid].short; });
        return esc(S[d.state].label) + (feeders.length ? ' ← ' + esc(feeders.join(', ')) : '');
      });
      return '<article class="rec-card" style="--cc:' + CAT_COLORS[r.rec.cat] + '"><div class="rec-top"><span class="cat">' + esc(r.rec.cat) + '</span><span class="rel">' + Math.round(r.rel * 100) + '%</span></div>' +
        '<h4>' + esc(r.rec.title) + '</h4><p>' + esc(r.rec.text) + '</p><div class="relbar"><i style="width:' + Math.round(r.rel * 100) + '%"></i></div>' +
        '<p class="why-line"><b>Why surfaced:</b> ' + why.join('; ') + '</p><small class="illus">Illustrative example — not personal medical advice.</small></article>';
    }).join('');
  }

  /* ---------------------------------------------------------------- UPDATE */
  function selectOrgan(id, fromGraph) {
    selectedOrgan = id; paintBody(); paintReport();
    if (graph && !fromGraph) graph.select(nid('o', id));
    if (!fromGraph) $('#node-info').innerHTML = describeNode('o', id);
  }
  function update() {
    model = compute(values); paintControls(); paintBody(); paintGraph(); paintReport(); paintRecs();
    var cur = $('#node-info'); if (cur && !cur.dataset.init) { cur.dataset.init = '1'; onGraphSelect(null); }
  }

  /* ----------------------------------------------------------------- INIT */
  function init() {
    buildControls();
    $('#preset').innerHTML = Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '">' + PRESETS[k].name + '</option>'; }).join('') + '<option value="custom" hidden>Custom (edited)</option>';
    $('#preset').addEventListener('change', function (e) { if (PRESETS[e.target.value]) setPreset(e.target.value); });
    $('#reset').addEventListener('click', function () { setPreset('A'); selectOrgan('heart'); if (graph) graph.select(null); onGraphSelect(null); });
    $('#print').addEventListener('click', function () { window.print(); });
    $('#anim').addEventListener('change', function (e) { animate = e.target.checked; document.body.classList.toggle('no-anim', !animate); if (graph) graph.setAnimate(animate); });
    if (reduceMotion) { $('#anim').checked = false; document.body.classList.add('no-anim'); }
    $$('[data-organ]').forEach(function (g) {
      if (!g.classList.contains('organ') && !g.classList.contains('organ-card')) return;
      g.addEventListener('click', function () { selectOrgan(g.dataset.organ); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOrgan(g.dataset.organ); } });
    });
    $('#organ-tabs').innerHTML = ORGANS.map(function (o) { return '<button type="button" role="tab" data-organ="' + o.id + '"></button>'; }).join('');
    $('#organ-tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) selectOrgan(b.dataset.organ); });
    $('#rec-filters').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && !b.disabled) { recFilter = b.dataset.cat; paintRecs(); } });
    window.addEventListener('resize', fitBody); fitBody();
    setPreset('B');
    selectOrgan('heart');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // expose for automated testing only
  window.__healthKG = { compute: compute, PRESETS: PRESETS, FACTORS: FACTORS };
})();
