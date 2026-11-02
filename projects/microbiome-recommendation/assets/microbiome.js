/* ==========================================================================
   Microbiome Recommendation Engine — non-clinical educational demonstration
   ---------------------------------------------------------------------------
   ALL abundance profiles below are SYNTHETIC (hand-written teaching examples).
   Targets, weights and thresholds are illustrative, NOT validated reference
   ranges. Real microbiome interpretation depends on sequencing method, sample
   type, cohort, diet, medication and clinical context.

   Scoring per body site (transparent, weighted components, each 0..100):
     site score = Σ weight × component score
   Graph goodness (0..1) per taxon → theme → health association → recommendation
   priority = 1 − weighted mean goodness of the associations a recommendation serves.
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function scoreState(n) { return n >= 75 ? 'ok' : n >= 50 ? 'mid' : 'risk'; }
  function statusLabel(n) { return n >= 75 ? 'Balanced pattern' : n >= 50 ? 'Mild shift' : 'Marked shift'; }
  function gState(g) { return g >= .75 ? 'ok' : g >= .45 ? 'mid' : 'risk'; }
  function sum(ab, ids) { return ids.reduce(function (a, id) { return a + (ab[id] || 0); }, 0); }
  function evenness(ab, ids) {
    var tot = sum(ab, ids) + (ab.Other || 0), H = 0;
    ids.concat(['Other']).forEach(function (id) { var p = (ab[id] || 0) / tot; if (p > 0) H -= p * Math.log(p); });
    return { H: H, J: H / Math.log(ids.length + 1) };
  }

  /* ---------------------------------------------------------- SITE DATA */
  var GROUP_COLORS = { scfa: '#8ee7b2', lactic: '#7fd8e8', barrier: '#76b8ff', commensal: '#8b98a5', path: '#ff8a8a', lacto: '#7fd8e8', bv: '#ff8a8a', other: '#59656f', comm: '#8ee7b2', nitrate: '#76b8ff', perio: '#ff8a8a', neutral: '#8b98a5' };
  var GROUP_LABELS = { scfa: 'SCFA producer', lactic: 'Lactic / bifido', barrier: 'Barrier-associated', commensal: 'Commensal', path: 'Pathobiont-associated', lacto: 'Lactobacillus', bv: 'BV-associated', comm: 'Health-associated commensal', nitrate: 'Nitrate reducer', perio: 'Periodontal-associated', neutral: 'Other commensal' };

  var SITES = {
    gut: {
      label: 'Gut', sub: 'stool-like synthetic profile',
      taxa: [
        { id: 'Faecalibacterium', g: 'scfa', kind: 'ben', t: 8 }, { id: 'Roseburia', g: 'scfa', kind: 'ben', t: 4 }, { id: 'Ruminococcus', g: 'scfa', kind: 'ben', t: 4 },
        { id: 'Bifidobacterium', g: 'lactic', kind: 'ben', t: 4 }, { id: 'Lactobacillus', g: 'lactic', kind: 'ben', t: .8 }, { id: 'Akkermansia', g: 'barrier', kind: 'ben', t: 2.5 },
        { id: 'Blautia', g: 'commensal' }, { id: 'Bacteroides', g: 'commensal' }, { id: 'Prevotella', g: 'commensal' },
        { id: 'Enterobacteriaceae', g: 'path', kind: 'path', t: 5 }, { id: 'Fusobacterium', g: 'path', kind: 'path', t: 2 }
      ],
      profiles: {
        balanced: { Faecalibacterium: 14, Roseburia: 6, Ruminococcus: 7, Bifidobacterium: 6, Lactobacillus: 1.2, Akkermansia: 3.2, Blautia: 10, Bacteroides: 22, Prevotella: 8, Enterobacteriaceae: .8, Fusobacterium: .2 },
        inflammatory: { Faecalibacterium: 4, Roseburia: 2, Ruminococcus: 3, Bifidobacterium: 2.5, Lactobacillus: .4, Akkermansia: 1, Blautia: 7, Bacteroides: 30, Prevotella: 5, Enterobacteriaceae: 14, Fusobacterium: 2.5 },
        metabolic: { Faecalibacterium: 8, Roseburia: 3, Ruminococcus: 5, Bifidobacterium: 3, Lactobacillus: .6, Akkermansia: .8, Blautia: 11, Bacteroides: 28, Prevotella: 6, Enterobacteriaceae: 6, Fusobacterium: .8 }
      },
      components: function (ab) {
        var scfa = sum(ab, ['Faecalibacterium', 'Roseburia', 'Ruminococcus']), lac = sum(ab, ['Bifidobacterium', 'Lactobacillus']), path = sum(ab, ['Enterobacteriaceae', 'Fusobacterium']);
        var ev = evenness(ab, SITES.gut.taxa.map(function (t) { return t.id; }));
        return [
          { label: 'SCFA-producer capacity', meas: scfa.toFixed(1) + '% of reads', target: '≥ 24 % (toy)', score: clamp(scfa / 24 * 100, 0, 100), w: .30, why: 'Faecalibacterium, Roseburia and Ruminococcus ferment fiber to short-chain fatty acids such as butyrate.' },
          { label: 'Pathobiont-associated load (inverse)', meas: path.toFixed(1) + '% of reads', target: '≤ 10 % (toy)', score: 100 - clamp(path / 10 * 100, 0, 100), w: .25, why: 'Enterobacteriaceae and Fusobacterium expansions are commonly reported in inflammatory settings.' },
          { label: 'Lactic / Bifidobacterium share', meas: lac.toFixed(1) + '% of reads', target: '≥ 6 % (toy)', score: clamp(lac / 6 * 100, 0, 100), w: .15, why: 'Lactic-acid producers acidify the gut lumen and cross-feed other taxa.' },
          { label: 'Barrier-associated Akkermansia', meas: (ab.Akkermansia || 0).toFixed(1) + '% of reads', target: '≥ 3 % (toy)', score: clamp((ab.Akkermansia || 0) / 3 * 100, 0, 100), w: .15, why: 'Akkermansia lives in the mucus layer and is studied in relation to barrier and metabolic health.' },
          { label: 'Community evenness', meas: 'J = ' + ev.J.toFixed(2), target: 'higher is better (toy)', score: clamp(ev.J * 100, 0, 100), w: .15, why: 'More even communities tend to be more resilient in the gut (toy Shannon evenness over 12 bins).' }
        ];
      },
      metrics: function (ab) {
        var scfa = sum(ab, ['Faecalibacterium', 'Roseburia', 'Ruminococcus']), path = sum(ab, ['Enterobacteriaceae', 'Fusobacterium']), ev = evenness(ab, SITES.gut.taxa.map(function (t) { return t.id; }));
        var ratio = Math.log10((path + .5) / (scfa + .5));
        return [
          { k: 'Toy Shannon H′', v: ev.H.toFixed(2), s: gState(ev.J / .8), h: '12-bin toy index; not comparable with real data' },
          { k: 'SCFA-producer share', v: scfa.toFixed(1) + '%', s: gState(scfa / 24), h: 'Butyrate-associated taxa' },
          { k: 'Pathobiont-associated share', v: path.toFixed(1) + '%', s: gState(1 - path / 10), h: 'Enterobacteriaceae + Fusobacterium' },
          { k: 'Dysbiosis ratio (log₁₀)', v: ratio.toFixed(2), s: gState(1 - clamp((ratio + 1) / 2.2, 0, 1)), h: 'log₁₀ (pathobiont ÷ SCFA producers); higher = more shifted' }
        ];
      },
      graph: {
        themes: [
          { id: 'scfa', label: 'SCFA production', m: [['Faecalibacterium', 1], ['Roseburia', 1], ['Ruminococcus', .7]] },
          { id: 'barrier', label: 'Mucosal barrier support', m: [['Akkermansia', 1], ['Faecalibacterium', .6]] },
          { id: 'lactic', label: 'Lactic-acid / acidification', m: [['Bifidobacterium', 1], ['Lactobacillus', .8]] },
          { id: 'proinf', label: 'Pro-inflammatory potential (inv.)', m: [['Enterobacteriaceae', 1], ['Fusobacterium', .7]] }
        ],
        assocs: [
          { id: 'gutbarrier', label: 'Gut-barrier integrity', m: [['scfa', 1], ['barrier', 1], ['proinf', .6]] },
          { id: 'inflam', label: 'Inflammation context', m: [['proinf', 1], ['scfa', .7]] },
          { id: 'metab', label: 'Metabolic-health context', m: [['scfa', 1], ['barrier', .8], ['lactic', .4]] },
          { id: 'immune', label: 'Immune-balance context', m: [['lactic', 1], ['proinf', .6], ['barrier', .4]] }
        ],
        recs: [
          { id: 'fiber', label: 'Diverse plant fibers', a: ['gutbarrier', 'metab', 'inflam'] },
          { id: 'ferm', label: 'Fermented foods', a: ['immune', 'gutbarrier'] },
          { id: 'poly', label: 'Polyphenol-rich foods', a: ['metab', 'inflam'] },
          { id: 'upf', label: 'Limit ultra-processed foods', a: ['inflam', 'metab', 'gutbarrier'] },
          { id: 'prebio', label: 'Prebiotic fiber discussion', a: ['gutbarrier', 'immune'] },
          { id: 'probio', label: 'Probiotic discussion', a: ['immune', 'inflam'] }
        ]
      },
      eat: [
        { i: 'beans', n: 'Legumes (beans, lentils, chickpeas)', d: 'Fermentable fiber and resistant starch that feed butyrate-associated taxa.', th: ['scfa', 'barrier'] },
        { i: 'leafy', n: 'Leafy greens & cruciferous vegetables', d: 'Fiber and plant compounds that support a diverse set of fermenters.', th: ['scfa', 'lactic'] },
        { i: 'oats', n: 'Oats & intact whole grains', d: 'β-glucan and resistant starch; studied in relation to Bifidobacterium.', th: ['lactic', 'scfa'] },
        { i: 'onion', n: 'Onion, garlic & leeks', d: 'Rich in fructans, a classic prebiotic fiber.', th: ['lactic', 'scfa'] },
        { i: 'berries', n: 'Berries & polyphenol-rich fruit', d: 'Polyphenols are studied in relation to Akkermansia and barrier function.', th: ['barrier', 'proinf'] },
        { i: 'yogurt', n: 'Yogurt or kefir with live cultures', d: 'Fermented dairy delivers live lactic-acid bacteria; effects are strain-dependent.', th: ['lactic'] },
        { i: 'ferment', n: 'Fermented vegetables (sauerkraut, kimchi)', d: 'Provide live microbes and organic acids; introduce gradually.', th: ['lactic', 'proinf'] },
        { i: 'olive', n: 'Olive oil & nuts', d: 'Core of Mediterranean-style eating, associated with lower inflammatory markers.', th: ['proinf', 'barrier'] }
      ],
      limit: [
        { i: 'chips', n: 'Ultra-processed snacks', d: 'Low in fiber and often high in emulsifiers, salt and refined starch.', th: ['proinf', 'scfa'] },
        { i: 'soda', n: 'Sugar-sweetened drinks', d: 'Rapidly absorbed sugars add little for colonic fermenters.', th: ['proinf', 'scfa'] },
        { i: 'sausage', n: 'Processed or heavily charred meats', d: 'High intake is associated with less favorable microbial and health markers.', th: ['proinf', 'barrier'] },
        { i: 'wine', n: 'Heavy alcohol intake', d: 'Alcohol can disturb gut barrier and community composition.', th: ['proinf', 'barrier'] },
        { i: 'cake', n: 'Refined sweets & pastries', d: 'Refined carbohydrates displace fiber-rich foods in the diet.', th: ['scfa', 'lactic'] }
      ],
      habits: ['Regular physical activity and consistent sleep are associated with a more diverse gut community.', 'Introduce new fibers gradually to limit gas and bloating; drink water with extra fiber.', 'Persistent bowel changes, blood in stool or unexplained weight loss should be discussed with a clinician.'],
      supps: [
        { n: 'Multi-strain probiotic', d: 'Effects are strain- and outcome-specific; evidence differs by condition.', c: 'Ask a clinician first if you are immunocompromised, critically ill or have a central line.', link: 'nccih' },
        { n: 'Prebiotic fiber (inulin, GOS, PHGG)', d: 'Fermentable fibers studied for Bifidobacterium support; may cause gas and bloating — start low.', c: 'Not suitable for everyone, e.g. some people with IBS.', link: null },
        { n: 'Omega-3 (EPA/DHA)', d: 'Studied mainly for cardiometabolic outcomes; microbiome effects are modest and less established.', c: 'May interact with blood-thinning medicines.', link: 'omega' }
      ]
    },

    vaginal: {
      label: 'Vaginal', sub: 'swab-like synthetic profile',
      taxa: [
        { id: 'L. crispatus', g: 'lacto', kind: 'ben', t: 50 }, { id: 'L. iners', g: 'lacto', kind: 'ben', t: 40 }, { id: 'L. gasseri', g: 'lacto', kind: 'ben', t: 20 }, { id: 'L. jensenii', g: 'lacto', kind: 'ben', t: 20 },
        { id: 'Gardnerella', g: 'bv', kind: 'path', t: 8 }, { id: 'Fannyhessea', g: 'bv', kind: 'path', t: 4 }, { id: 'Prevotella', g: 'bv', kind: 'path', t: 8 },
        { id: 'Sneathia', g: 'bv', kind: 'path', t: 3 }, { id: 'Megasphaera', g: 'bv', kind: 'path', t: 3 }, { id: 'Streptococcus', g: 'neutral' }
      ],
      profiles: {
        balanced: { 'L. crispatus': 78, 'L. iners': 6, 'L. gasseri': 3, 'L. jensenii': 3, Gardnerella: 2.5, Fannyhessea: .5, Prevotella: .8, Sneathia: .2, Megasphaera: .2, Streptococcus: 1 },
        inflammatory: { 'L. crispatus': 4, 'L. iners': 14, 'L. gasseri': 1, 'L. jensenii': 1, Gardnerella: 32, Fannyhessea: 9, Prevotella: 14, Sneathia: 6, Megasphaera: 7, Streptococcus: 3 },
        metabolic: { 'L. crispatus': 20, 'L. iners': 42, 'L. gasseri': 3, 'L. jensenii': 2, Gardnerella: 12, Fannyhessea: 2, Prevotella: 4, Sneathia: 1, Megasphaera: 1.5, Streptococcus: 2 }
      },
      components: function (ab) {
        var lac = sum(ab, ['L. crispatus', 'L. iners', 'L. gasseri', 'L. jensenii']), bv = sum(ab, ['Gardnerella', 'Fannyhessea', 'Prevotella', 'Sneathia', 'Megasphaera']);
        var ev = evenness(ab, SITES.vaginal.taxa.map(function (t) { return t.id; }));
        return [
          { label: 'Lactobacillus dominance', meas: lac.toFixed(1) + '% of reads', target: '≥ 80 % (toy)', score: clamp(lac / 80 * 100, 0, 100), w: .35, why: 'Lactobacilli produce lactic acid that keeps the vaginal environment acidic.' },
          { label: 'BV-associated taxa (inverse)', meas: bv.toFixed(1) + '% of reads', target: '≤ 30 % (toy)', score: 100 - clamp(bv / 30 * 100, 0, 100), w: .35, why: 'Gardnerella, Fannyhessea, Prevotella, Sneathia and Megasphaera are enriched in bacterial-vaginosis-like profiles.' },
          { label: 'L. crispatus share', meas: (ab['L. crispatus'] || 0).toFixed(1) + '% of reads', target: '≥ 60 % (toy)', score: clamp((ab['L. crispatus'] || 0) / 60 * 100, 0, 100), w: .15, why: 'L. crispatus–dominant communities are generally reported as the most stable.' },
          { label: 'Low diversity (inverse evenness)', meas: 'J = ' + ev.J.toFixed(2), target: 'lower is typical (toy)', score: clamp((1 - ev.J) * 100 + 20, 0, 100), w: .15, why: 'Unlike the gut, low diversity is typical of a Lactobacillus-dominated vaginal community.' }
        ];
      },
      metrics: function (ab) {
        var lac = sum(ab, ['L. crispatus', 'L. iners', 'L. gasseri', 'L. jensenii']), bv = sum(ab, ['Gardnerella', 'Fannyhessea', 'Prevotella', 'Sneathia', 'Megasphaera']);
        var ev = evenness(ab, SITES.vaginal.taxa.map(function (t) { return t.id; }));
        var lacs = ['L. crispatus', 'L. iners', 'L. gasseri', 'L. jensenii'], top = lacs.slice().sort(function (a, b) { return (ab[b] || 0) - (ab[a] || 0); })[0];
        var cst = (lac >= 50 && (ab[top] || 0) / lac >= .5) ? { 'L. crispatus': 'I', 'L. gasseri': 'II', 'L. iners': 'III', 'L. jensenii': 'V' }[top] : 'IV';
        return [
          { k: 'Lactobacillus dominance', v: lac.toFixed(0) + '%', s: gState(lac / 80), h: 'Sum of four Lactobacillus species' },
          { k: 'BV-associated share', v: bv.toFixed(0) + '%', s: gState(1 - bv / 30), h: 'Gardnerella, Fannyhessea, Prevotella, Sneathia, Megasphaera' },
          { k: 'CST-like type (simplified)', v: 'CST ' + cst, s: cst === 'I' || cst === 'V' || cst === 'II' ? 'ok' : cst === 'III' ? 'mid' : 'risk', h: 'Simplified rule inspired by Ravel et al. 2011; I=crispatus, II=gasseri, III=iners, V=jensenii, IV=diverse' },
          { k: 'Evenness J', v: ev.J.toFixed(2), s: gState(1 - ev.J / .8), h: 'Lower is typical for this site' }
        ];
      },
      graph: {
        themes: [
          { id: 'acid', label: 'Lactic-acid / low-pH protection', m: [['L. crispatus', 1], ['L. jensenii', .8], ['L. gasseri', .7], ['L. iners', .5]] },
          { id: 'stable', label: 'Community stability', m: [['L. crispatus', 1], ['L. iners', .4]] },
          { id: 'biofilm', label: 'Biofilm-forming taxa (inv.)', m: [['Gardnerella', 1], ['Fannyhessea', .8], ['Sneathia', .6]] },
          { id: 'anaer', label: 'Anaerobic overgrowth (inv.)', m: [['Prevotella', 1], ['Megasphaera', .8], ['Sneathia', .6]] }
        ],
        assocs: [
          { id: 'balance', label: 'Vaginal-ecosystem balance', m: [['acid', 1], ['stable', .8], ['anaer', .6]] },
          { id: 'bvlike', label: 'BV-like dysbiosis context', m: [['biofilm', 1], ['anaer', 1]] },
          { id: 'mucimm', label: 'Mucosal-immune context', m: [['stable', 1], ['anaer', .6], ['acid', .5]] }
        ],
        recs: [
          { id: 'pattern', label: 'Balanced whole-food pattern', a: ['balance', 'mucimm'] },
          { id: 'douche', label: 'Avoid douching / harsh products', a: ['balance', 'bvlike'] },
          { id: 'clin', label: 'Discuss symptoms with clinician', a: ['bvlike', 'mucimm'] },
          { id: 'probio', label: 'Strain-specific probiotic talk', a: ['balance', 'bvlike'] },
          { id: 'smoke', label: 'Smoking-cessation support', a: ['balance', 'mucimm'] }
        ]
      },
      eat: [
        { i: 'leafy', n: 'Folate-rich leafy greens', d: 'General diet quality is associated with healthier mucosal environments; direct evidence is limited.', th: ['stable', 'acid'] },
        { i: 'yogurt', n: 'Yogurt with live cultures', d: 'Evidence for dietary lactobacilli changing the vaginal community is mixed and strain-dependent.', th: ['acid'] },
        { i: 'beans', n: 'Legumes & whole grains', d: 'Fiber-rich patterns accompany lower inflammatory load in observational work.', th: ['stable', 'anaer'] },
        { i: 'fish', n: 'Oily fish (omega-3)', d: 'Part of anti-inflammatory dietary patterns; vaginal-specific evidence is limited.', th: ['anaer', 'biofilm'] },
        { i: 'berries', n: 'Colorful fruit & vegetables', d: 'Carotenoid- and polyphenol-rich diets are associated with lower BV prevalence in some studies.', th: ['biofilm', 'anaer'] }
      ],
      limit: [
        { i: 'soda', n: 'High free-sugar drinks', d: 'High-glycemic patterns show associations with BV in some observational studies (limited evidence).', th: ['biofilm', 'anaer'] },
        { i: 'chips', n: 'Ultra-processed foods', d: 'Poor overall diet quality tracks with less favorable community patterns in observational data.', th: ['anaer', 'stable'] },
        { i: 'wine', n: 'Heavy alcohol intake', d: 'Alcohol is associated with a less stable mucosal environment in some studies.', th: ['stable', 'biofilm'] },
        { i: 'cake', n: 'Frequent refined sweets', d: 'Refined-sugar-heavy diets are tied to higher dysbiosis odds in some cohorts.', th: ['biofilm', 'anaer'] }
      ],
      habits: ['Avoid douching and heavily scented intimate products; they can disturb a Lactobacillus-dominated community.', 'Persistent discharge, odor, itching, pain or recurrent episodes need clinical evaluation — this demo cannot assess symptoms.', 'Smoking is associated with a less Lactobacillus-dominated community; cessation support is available.'],
      supps: [
        { n: 'Lactobacillus-containing probiotics (oral or vaginal)', d: 'Some strain combinations, such as L. rhamnosus GR-1 with L. reuteri RC-14, have been studied; many vaginal-probiotic candidates are still investigational and product quality varies.', c: 'Discuss with a clinician, especially in pregnancy or with recurrent symptoms.', link: 'nccih' }
      ]
    },

    oral: {
      label: 'Oral', sub: 'saliva / plaque-like synthetic profile',
      taxa: [
        { id: 'Streptococcus', g: 'comm', kind: 'ben', t: 25 }, { id: 'Rothia', g: 'nitrate', kind: 'ben', t: 5 }, { id: 'Neisseria', g: 'nitrate', kind: 'ben', t: 5 }, { id: 'Actinomyces', g: 'comm', kind: 'ben', t: 4 },
        { id: 'Veillonella', g: 'neutral' }, { id: 'Haemophilus', g: 'neutral' }, { id: 'Prevotella', g: 'neutral' },
        { id: 'Fusobacterium', g: 'perio', kind: 'path', t: 3 }, { id: 'Porphyromonas', g: 'perio', kind: 'path', t: 1 }, { id: 'Treponema', g: 'perio', kind: 'path', t: .5 }, { id: 'Aggregatibacter', g: 'perio', kind: 'path', t: .6 }
      ],
      profiles: {
        balanced: { Streptococcus: 32, Rothia: 8, Neisseria: 9, Actinomyces: 6, Veillonella: 12, Haemophilus: 5, Prevotella: 8, Fusobacterium: 2, Porphyromonas: .4, Treponema: .1, Aggregatibacter: .3 },
        inflammatory: { Streptococcus: 17, Rothia: 3, Neisseria: 3, Actinomyces: 4, Veillonella: 10, Haemophilus: 4, Prevotella: 14, Fusobacterium: 8, Porphyromonas: 6, Treponema: 4, Aggregatibacter: 2.5 },
        metabolic: { Streptococcus: 25, Rothia: 5, Neisseria: 5, Actinomyces: 5, Veillonella: 14, Haemophilus: 5, Prevotella: 11, Fusobacterium: 4, Porphyromonas: 1.5, Treponema: .8, Aggregatibacter: .7 }
      },
      components: function (ab) {
        var com = sum(ab, ['Streptococcus', 'Rothia', 'Neisseria', 'Actinomyces']), per = sum(ab, ['Fusobacterium', 'Porphyromonas', 'Treponema', 'Aggregatibacter']), nit = sum(ab, ['Rothia', 'Neisseria']);
        return [
          { label: 'Health-associated commensals', meas: com.toFixed(1) + '% of reads', target: '≥ 55 % (toy)', score: clamp(com / 55 * 100, 0, 100), w: .40, why: 'Streptococcus, Rothia, Neisseria and Actinomyces are early colonizers typical of healthy oral biofilms.' },
          { label: 'Periodontal-associated taxa (inverse)', meas: per.toFixed(1) + '% of reads', target: '≤ 15 % (toy)', score: 100 - clamp(per / 15 * 100, 0, 100), w: .40, why: 'Porphyromonas, Treponema, Fusobacterium and Aggregatibacter are enriched in periodontitis-like profiles.' },
          { label: 'Nitrate-reducing capacity', meas: nit.toFixed(1) + '% of reads', target: '≥ 14 % (toy)', score: clamp(nit / 14 * 100, 0, 100), w: .20, why: 'Rothia and Neisseria reduce dietary nitrate; this is an active research topic in oral–cardiometabolic links.' }
        ];
      },
      metrics: function (ab) {
        var com = sum(ab, ['Streptococcus', 'Rothia', 'Neisseria', 'Actinomyces']), per = sum(ab, ['Fusobacterium', 'Porphyromonas', 'Treponema', 'Aggregatibacter']), nit = sum(ab, ['Rothia', 'Neisseria']);
        var red = sum(ab, ['Porphyromonas', 'Treponema']), ev = evenness(ab, SITES.oral.taxa.map(function (t) { return t.id; }));
        return [
          { k: 'Commensal share', v: com.toFixed(0) + '%', s: gState(com / 55), h: 'Streptococcus + Rothia + Neisseria + Actinomyces' },
          { k: 'Periodontal-associated share', v: per.toFixed(1) + '%', s: gState(1 - per / 15), h: 'Fusobacterium, Porphyromonas, Treponema, Aggregatibacter' },
          { k: 'Red-complex-like share', v: red.toFixed(1) + '%', s: gState(1 - red / 3), h: 'Porphyromonas + Treponema (cf. Socransky 1998 complexes)' },
          { k: 'Evenness J', v: ev.J.toFixed(2), s: gState(1 - Math.max(0, ev.J - .6) / .3), h: 'Very even oral communities can reflect periodontal-like disease' }
        ];
      },
      graph: {
        themes: [
          { id: 'early', label: 'Early-colonizer commensal biofilm', m: [['Streptococcus', 1], ['Actinomyces', .7], ['Rothia', .7]] },
          { id: 'nitrate', label: 'Nitrate-reducing capacity', m: [['Rothia', 1], ['Neisseria', 1]] },
          { id: 'perio', label: 'Periodontal-associated consortium (inv.)', m: [['Porphyromonas', 1], ['Treponema', 1], ['Aggregatibacter', .6]] },
          { id: 'bridge', label: 'Bridging anaerobes (inv.)', m: [['Fusobacterium', 1]] }
        ],
        assocs: [
          { id: 'gingival', label: 'Gingival-health context', m: [['early', 1], ['perio', 1], ['bridge', .6]] },
          { id: 'oralinf', label: 'Oral inflammation context', m: [['perio', 1], ['bridge', .8]] },
          { id: 'cardio', label: 'Oral–cardiometabolic research link', m: [['nitrate', 1], ['perio', .5]] }
        ],
        recs: [
          { id: 'hygiene', label: 'Daily plaque control', a: ['gingival', 'oralinf'] },
          { id: 'nitratefoods', label: 'Nitrate-rich vegetables', a: ['cardio'] },
          { id: 'sugar', label: 'Limit frequent free sugars', a: ['gingival', 'oralinf'] },
          { id: 'dentist', label: 'Dental check-up discussion', a: ['gingival', 'oralinf', 'cardio'] },
          { id: 'tobacco', label: 'Tobacco-cessation support', a: ['oralinf', 'gingival'] }
        ]
      },
      eat: [
        { i: 'leafy', n: 'Nitrate-rich leafy greens', d: 'Dietary nitrate is the substrate for Rothia/Neisseria nitrate reduction (research context).', th: ['nitrate', 'early'] },
        { i: 'carrot', n: 'Crunchy fibrous vegetables & fruit', d: 'Chewing stimulates saliva flow and gives some mechanical cleansing.', th: ['early', 'perio'] },
        { i: 'yogurt', n: 'Plain yogurt & cheese', d: 'Provide calcium and help buffer acidity; choose unsweetened versions.', th: ['early', 'bridge'] },
        { i: 'tea', n: 'Unsweetened green tea', d: 'Polyphenols have been studied for oral-bacteria effects; evidence is limited.', th: ['perio', 'bridge'] },
        { i: 'nuts', n: 'Nuts (unsalted)', d: 'A low-fermentable-sugar snack alternative.', th: ['early', 'bridge'] }
      ],
      limit: [
        { i: 'candy', n: 'Sticky sweets & frequent sugary snacking', d: 'Frequency of sugar exposure matters as much as amount for plaque acidity.', th: ['early', 'bridge'] },
        { i: 'soda', n: 'Sugary or acidic drinks sipped all day', d: 'Prolonged exposure keeps the biofilm acidic.', th: ['early', 'perio'] },
        { i: 'cake', n: 'Frequent refined carbohydrates', d: 'Fermentable carbohydrates fuel acid-producing species.', th: ['early', 'bridge'] },
        { i: 'wine', n: 'Heavy alcohol', d: 'Alcohol use is associated with shifts in oral community composition.', th: ['perio', 'bridge'] }
      ],
      habits: ['Brush twice a day with fluoride toothpaste and clean between teeth daily.', 'Regular dental check-ups: bleeding gums, loose teeth or persistent bad breath need professional assessment.', 'Tobacco use strongly shifts the oral community toward periodontal-associated taxa; cessation support is available.'],
      supps: [
        { n: 'Oral probiotic lozenges (e.g., Streptococcus salivarius strains)', d: 'Early-stage research for oral-health outcomes such as halitosis; evidence is limited.', c: 'Check with a dentist or clinician, particularly if immunocompromised.', link: 'nccih' },
        { n: 'Xylitol gum or lozenges', d: 'Non-fermentable sweetener studied in caries prevention; large amounts may cause digestive upset.', c: 'Xylitol is toxic to dogs — store safely.', link: null }
      ]
    }
  };

  var LINKS = {
    nccih: { href: 'https://www.nccih.nih.gov/health/probiotics-usefulness-and-safety', label: 'NIH NCCIH · Probiotics: usefulness and safety' },
    omega: { href: 'https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/', label: 'NIH ODS · Omega-3 fatty acids fact sheet' }
  };

  var CONTEXT_PROFILES = {
    balanced: 'Balanced reference-like profile', inflammatory: 'Inflammation-associated demo profile', metabolic: 'Metabolic-health demo profile'
  };

  // Original ranked interventions — preserved, but now computed without mutating the source list
  var INTERVENTIONS = [
    { name: 'Increase dietary diversity & fiber-rich plant foods', base: 94, evidence: 'high coverage', fit: 'broad microbiome relevance', why: 'Supports a diverse substrate environment for multiple taxa at once; especially relevant when several beneficial taxa are lower in the demo profile.', how: 'Gradually increase variety of vegetables, legumes, whole grains, nuts, seeds and other minimally processed plant foods as tolerated.' },
    { name: 'Mediterranean-style dietary pattern', base: 91, evidence: 'high coverage', fit: 'diet + metabolic context', why: 'Connects the intervention layer to several microbial and metabolic outcomes rather than targeting one organism.', how: 'Emphasize plant foods, whole grains, legumes, nuts, olive oil and fish where appropriate; reduce highly processed foods.' },
    { name: 'Regular physical activity', base: 84, evidence: 'moderate coverage', fit: 'lifestyle', why: 'Provides a non-pharmacological intervention that can interact with host metabolic state and microbiome composition.', how: 'Use a sustainable activity routine appropriate to the person’s baseline fitness and health status.' },
    { name: 'Sleep regularity', base: 79, evidence: 'moderate coverage', fit: 'lifestyle', why: 'Adds patient lifestyle metadata to the recommendation layer rather than interpreting taxa in isolation.', how: 'Aim for a consistent sleep/wake schedule and address persistent sleep problems with a qualified professional.' },
    { name: 'Probiotic food / selected probiotic option', base: 72, evidence: 'variable by strain', fit: 'taxon-specific', why: 'Some interventions are strain- and outcome-specific, so the prototype assigns a lower generic score than broad dietary actions.', how: 'If considering a probiotic, evaluate the specific strain, target outcome, evidence and individual suitability rather than treating all probiotics as equivalent.' }
  ];

  /* ------------------------------------------------------------ STATE */
  var state = { profile: 'balanced', site: 'gut', ab: {}, animate: !reduceMotion, graph: null, ctx: { bmi: 27.4, diet: 'Mediterranean-style', life: 'Moderately active' } };

  function loadProfile(p) {
    state.profile = p; state.ab = {};
    Object.keys(SITES).forEach(function (k) { state.ab[k] = Object.assign({}, SITES[k].profiles[p]); });
  }
  function fullAb(site) {
    var ab = Object.assign({}, state.ab[site]), tot = sum(ab, Object.keys(ab));
    if (tot > 100) { var f = 100 / tot; Object.keys(ab).forEach(function (k) { ab[k] *= f; }); tot = 100; }
    ab.Other = Math.max(0, 100 - tot);
    return ab;
  }
  function evaluate(site) {
    var S = SITES[site], ab = fullAb(site), comps = S.components(ab);
    var score = Math.round(comps.reduce(function (a, c) { return a + c.score * c.w; }, 0));
    // graph goodness
    var g = {};
    S.taxa.forEach(function (t) { if (t.kind === 'ben') g['t:' + t.id] = clamp((ab[t.id] || 0) / t.t, 0, 1); else if (t.kind === 'path') g['t:' + t.id] = 1 - clamp((ab[t.id] || 0) / t.t, 0, 1); });
    function wmean(list, pre) { var n = 0, d = 0; list.forEach(function (m) { var v = g[pre + m[0]]; if (v == null) return; n += v * m[1]; d += m[1]; }); return d ? n / d : 1; }
    S.graph.themes.forEach(function (t) { g['h:' + t.id] = wmean(t.m, 't:'); });
    S.graph.assocs.forEach(function (a) { g['a:' + a.id] = wmean(a.m, 'h:'); });
    var recRel = {};
    S.graph.recs.forEach(function (r) { var s = 0; r.a.forEach(function (aid) { s += 1 - g['a:' + aid]; }); recRel[r.id] = s / r.a.length; });
    return { ab: ab, comps: comps, score: score, g: g, recRel: recRel, metrics: S.metrics(ab) };
  }

  /* ---------------------------------------------------------- RENDERING */
  var evals = {};
  function evalAll() { Object.keys(SITES).forEach(function (k) { evals[k] = evaluate(k); }); }

  function paintScorecards() {
    $('#scorecards').innerHTML = Object.keys(SITES).map(function (k) {
      var e = evals[k], st = scoreState(e.score), C = 2 * Math.PI * 30;
      return '<button type="button" class="scorecard st-' + st + (k === state.site ? ' on' : '') + '" data-site="' + k + '" aria-pressed="' + (k === state.site) + '">' +
        '<svg viewBox="0 0 70 70" class="mini-ring" aria-hidden="true"><circle cx="35" cy="35" r="30" class="rbg"/><circle cx="35" cy="35" r="30" class="rarc" transform="rotate(-90 35 35)" stroke-dasharray="' + (C * e.score / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
        '<b class="sc-num">' + e.score + '</b><span class="sc-name">' + SITES[k].label + ' microbiome</span><span class="score-pill">' + statusLabel(e.score) + '</span><small>' + SITES[k].sub + '</small></button>';
    }).join('');
  }

  function paintSite(opts) {
    var k = state.site, S = SITES[k], e = evals[k];
    $$('#site-tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.site === k ? 'true' : 'false'); b.classList.toggle('on', b.dataset.site === k); });
    // header
    var st = scoreState(e.score);
    var weakest = e.comps.slice().sort(function (a, b) { return (b.w * (100 - b.score)) - (a.w * (100 - a.score)); })[0];
    $('#site-head').innerHTML = '<div class="site-score st-' + st + '"><b>' + e.score + '</b><small>/ 100</small></div><div><span class="kicker">' + esc(S.label) + ' microbiome · synthetic profile</span><h3>' + statusLabel(e.score) + '</h3><p class="muted">' +
      (e.score >= 75 ? 'Every component is near its illustrative target.' : 'Largest shortfall: <b>' + esc(weakest.label) + '</b> (' + esc(weakest.meas) + ', target ' + esc(weakest.target) + ').') + ' Scores are illustrative, not a clinical assessment.</p></div>';

    // abundance bars
    var maxv = Math.max.apply(null, S.taxa.map(function (t) { return e.ab[t.id] || 0; }).concat([5]));
    $('#bars').innerHTML = S.taxa.map(function (t) {
      var v = e.ab[t.id] || 0;
      return '<div class="bar-row"><span class="bn" title="' + esc(GROUP_LABELS[t.g]) + '">' + esc(t.id) + '</span><div class="bt"><i style="width:' + (v / maxv * 100).toFixed(1) + '%;background:' + GROUP_COLORS[t.g] + '"></i></div><b>' + v.toFixed(1) + '%</b></div>';
    }).join('') + '<div class="bar-row"><span class="bn">Other / unassigned</span><div class="bt"><i style="width:' + (e.ab.Other / maxv * 100).toFixed(1) + '%;background:' + GROUP_COLORS.other + '"></i></div><b>' + e.ab.Other.toFixed(1) + '%</b></div>';
    var groups = {}; S.taxa.forEach(function (t) { groups[t.g] = 1; });
    $('#bar-legend').innerHTML = Object.keys(groups).map(function (g) { return '<span><i style="background:' + GROUP_COLORS[g] + '"></i>' + GROUP_LABELS[g] + '</span>'; }).join('');
    // metrics
    $('#metrics').innerHTML = e.metrics.map(function (m) {
      return '<div class="metric st-' + m.s + '"><span>' + esc(m.k) + '</span><b>' + esc(m.v) + '</b><small>' + esc(m.h) + '</small></div>';
    }).join('');
    // sliders (not rebuilt while dragging, so the pointer keeps control of the handle)
    if (!(opts && opts.keepSliders)) {
      $('#taxa-sliders').innerHTML = S.taxa.map(function (t) {
        var mx = Math.ceil(Math.max.apply(null, ['balanced', 'inflammatory', 'metabolic'].map(function (p) { return S.profiles[p][t.id] || 0; })) * 1.3);
        return '<label class="tslide"><span>' + esc(t.id) + ' <output>' + (state.ab[k][t.id] || 0).toFixed(1) + '%</output></span><input type="range" min="0" max="' + Math.max(5, mx) + '" step="0.1" value="' + (state.ab[k][t.id] || 0) + '" data-taxon="' + esc(t.id) + '" aria-label="' + esc(t.id) + ' relative abundance"></label>';
      }).join('');
    }
    paintGraph(); paintReport(); paintFoods(); paintExtras();
  }

  function paintGraph() {
    var k = state.site, S = SITES[k], e = evals[k], G = S.graph;
    var cols = [
      { title: 'Microbial taxa', nodes: S.taxa.filter(function (t) { return t.kind; }).map(function (t) { return { id: 't:' + t.id, label: t.id, value: (e.ab[t.id] || 0).toFixed(1) + '%', state: gState(e.g['t:' + t.id]), detail: GROUP_LABELS[t.g] + ' · goodness ' + e.g['t:' + t.id].toFixed(2) }; }) },
      { title: 'Functional themes', nodes: G.themes.map(function (t) { return { id: 'h:' + t.id, label: t.label, value: '', state: gState(e.g['h:' + t.id]), detail: 'goodness ' + e.g['h:' + t.id].toFixed(2) }; }) },
      { title: 'Health associations', nodes: G.assocs.map(function (a) { return { id: 'a:' + a.id, label: a.label, value: '', state: gState(e.g['a:' + a.id]), detail: 'goodness ' + e.g['a:' + a.id].toFixed(2) }; }) },
      { title: 'Recommendations', nodes: G.recs.map(function (r) { var p = e.recRel[r.id]; return { id: 'r:' + r.id, label: r.label, value: Math.round(p * 100) + '', state: p >= .25 ? 'accent' : 'off', detail: 'priority ' + Math.round(p * 100) + '%' }; }) }
    ];
    var edges = [];
    G.themes.forEach(function (t) { t.m.forEach(function (m) { var gd = e.g['t:' + m[0]]; if (gd == null) return; edges.push({ from: 't:' + m[0], to: 'h:' + t.id, strength: Math.max(.12, 1 - gd), width: m[1] * .8 }); }); });
    G.assocs.forEach(function (a) { a.m.forEach(function (m) { edges.push({ from: 'h:' + m[0], to: 'a:' + a.id, strength: Math.max(.12, 1 - e.g['h:' + m[0]]), width: m[1] * .8 }); }); });
    G.recs.forEach(function (r) { r.a.forEach(function (aid) { edges.push({ from: 'a:' + aid, to: 'r:' + r.id, strength: Math.max(.1, e.recRel[r.id]), width: .5 }); }); });
    var spec = { columns: cols, edges: edges, rowH: 44, ariaLabel: S.label + ' microbiome knowledge graph', onSelect: onGraphSelect };
    if (!state.graph) { state.graph = KGraph.create($('#kg'), spec); state.graph.setAnimate(state.animate); } else { state.graph.update(spec); state.graph.select(null); }
    onGraphSelect(null, false);
  }
  function onGraphSelect(id, quiet) {
    var host = $('#node-info'), k = state.site, S = SITES[k], e = evals[k];
    if (!id) { if (!quiet || !host.innerHTML) host.innerHTML = '<p class="muted">Hover or click a node to trace connections. Color shows how close that node is to its illustrative target: green favorable, yellow shifted, red markedly shifted. Flowing lines mark deviations that drive recommendations.</p>'; return; }
    var p = id.split(':'), t = p[0], key = p.slice(1).join(':'), h = '';
    if (t === 't') { var tx = S.taxa.filter(function (x) { return x.id === key; })[0]; h = '<h4>' + esc(key) + '</h4><p>' + esc(GROUP_LABELS[tx.g]) + ' · ' + (e.ab[key] || 0).toFixed(1) + '% in this synthetic profile; toy ' + (tx.kind === 'ben' ? 'target ≥ ' : 'limit ≤ ') + tx.t + '%. Feeds: ' + S.graph.themes.filter(function (th) { return th.m.some(function (m) { return m[0] === key; }); }).map(function (th) { return esc(th.label); }).join(', ') + '.</p>'; }
    else if (t === 'h') { var th = S.graph.themes.filter(function (x) { return x.id === key; })[0]; h = '<h4>' + esc(th.label) + '</h4><p>Built from: ' + th.m.map(function (m) { return esc(m[0]) + ' (weight ' + m[1] + ')'; }).join(', ') + '. Goodness ' + e.g['h:' + key].toFixed(2) + '.</p>'; }
    else if (t === 'a') { var a = S.graph.assocs.filter(function (x) { return x.id === key; })[0]; h = '<h4>' + esc(a.label) + '</h4><p>Combines themes: ' + a.m.map(function (m) { return esc(S.graph.themes.filter(function (x) { return x.id === m[0]; })[0].label); }).join('; ') + '. Associations here are research-level and context-dependent, never diagnoses.</p>'; }
    else { var r = S.graph.recs.filter(function (x) { return x.id === key; })[0]; h = '<h4>' + esc(r.label) + ' <span class="score-pill st-ok">priority ' + Math.round(e.recRel[key] * 100) + '%</span></h4><p>Priority = 1 − mean goodness of the associations it serves: ' + r.a.map(function (aid) { var A = S.graph.assocs.filter(function (x) { return x.id === aid; })[0]; return esc(A.label) + ' (' + e.g['a:' + aid].toFixed(2) + ')'; }).join('; ') + '.</p>'; }
    host.innerHTML = h;
  }

  function paintReport() {
    var k = state.site, S = SITES[k], e = evals[k];
    var rows = e.comps.map(function (c) {
      var pts = c.score * c.w, lost = (100 - c.score) * c.w;
      return '<tr><td><b>' + esc(c.label) + '</b><small>' + esc(c.why) + '</small></td><td>' + esc(c.meas) + '<small>target ' + esc(c.target) + '</small></td><td><div class="cbar st-' + scoreState(c.score) + '"><i style="width:' + c.score.toFixed(0) + '%"></i></div>' + c.score.toFixed(0) + '</td><td>' + (c.w * 100).toFixed(0) + '%</td><td class="pts-col">' + pts.toFixed(1) + '<small>−' + lost.toFixed(1) + ' lost</small></td></tr>';
    }).join('');
    var topRecs = S.graph.recs.slice().sort(function (a, b) { return e.recRel[b.id] - e.recRel[a.id]; }).slice(0, 3);
    var why = topRecs.map(function (r) {
      var weakTaxa = S.taxa.filter(function (t) { return t.kind && e.g['t:' + t.id] < .6 && S.graph.themes.some(function (th) { return th.m.some(function (m) { return m[0] === t.id; }) && S.graph.assocs.some(function (a) { return r.a.indexOf(a.id) > -1 && a.m.some(function (m) { return m[0] === th.id; }); }); }); }).map(function (t) { return t.id + ' (' + (e.ab[t.id] || 0).toFixed(1) + '%)'; });
      return '<li><b>' + esc(r.label) + '</b> — priority ' + Math.round(e.recRel[r.id] * 100) + '%. ' + (weakTaxa.length ? 'Linked shifts: ' + esc(weakTaxa.join(', ')) + '.' : 'No strongly shifted taxa feed this recommendation; it is kept as a maintenance habit.') + '</li>';
    }).join('');
    $('#report').innerHTML = '<div class="table-scroll"><table class="rep-table"><thead><tr><th>Score component</th><th>Measured (synthetic)</th><th>Component score</th><th>Weight</th><th>Points</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="4"><b>Site score</b> = Σ weight × component score</td><td class="pts-col"><b>' + e.score + '</b></td></tr></tfoot></table></div>' +
      '<div class="rep-why"><h4>Why these recommendations rank highest</h4><ul>' + why + '</ul><p class="fine">Targets (“toy”) are teaching values. Real thresholds depend on cohort, sequencing method and clinical context, so this report never labels anyone’s microbiome as healthy or unhealthy.</p></div>';
  }

  function paintFoods() {
    var k = state.site, S = SITES[k], e = evals[k];
    function pri(item) { var gs = item.th.map(function (id) { return e.g['h:' + id]; }); return 1 - gs.reduce(function (a, b) { return a + b; }, 0) / gs.length; }
    function card(item, kind) {
      var p = pri(item), tag = kind === 'eat' ? (p >= .5 ? 'Prioritize' : p >= .25 ? 'Helpful' : 'Maintain') : (p >= .5 ? 'Limit first' : p >= .25 ? 'Moderate' : 'Keep in check');
      var th = item.th.map(function (id) { return S.graph.themes.filter(function (t) { return t.id === id; })[0].label.replace(' (inv.)', ''); });
      return '<article class="food ' + kind + '"><svg class="ficon" aria-hidden="true"><use href="#i-' + item.i + '"/></svg><div><div class="ftop"><h4>' + esc(item.n) + '</h4><span class="ftag">' + tag + '</span></div><p>' + esc(item.d) + '</p><small>Linked theme' + (th.length > 1 ? 's' : '') + ': ' + esc(th.join(', ')) + '</small></div></article>';
    }
    $('#eat').innerHTML = S.eat.slice().sort(function (a, b) { return pri(b) - pri(a); }).map(function (i) { return card(i, 'eat'); }).join('');
    $('#limit').innerHTML = S.limit.slice().sort(function (a, b) { return pri(b) - pri(a); }).map(function (i) { return card(i, 'limit'); }).join('');
  }

  function paintExtras() {
    var k = state.site, S = SITES[k];
    $('#habits').innerHTML = S.habits.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('');
    $('#supps').innerHTML = S.supps.map(function (s) {
      var l = s.link ? LINKS[s.link] : null;
      return '<article class="supp"><span class="demo-tag">DEMONSTRATION EXAMPLE</span><h4>' + esc(s.n) + '</h4><p>' + esc(s.d) + '</p><p class="caut"><b>Caution:</b> ' + esc(s.c || 'Discuss with a clinician or pharmacist before use.') + '</p>' +
        (l ? '<a class="demolink" href="' + l.href + '" target="_blank" rel="noopener noreferrer">Demo link ↗ ' + esc(l.label) + '</a>' : '<span class="demolink off">Demo link placeholder — no reference attached</span>') + '</article>';
    }).join('');
  }

  function paintInterventions() {
    var ctx = state.ctx, mean = Object.keys(evals).reduce(function (a, k) { return a + evals[k].score; }, 0) / 3;
    var recs = INTERVENTIONS.map(function (r, i) {
      var s = r.base, notes = [];
      if (ctx.diet.indexOf('Mediterranean') > -1 && i === 1) { s += 3; notes.push('already Mediterranean-style (+3)'); }
      if (ctx.diet.indexOf('ultra-processed') > -1 && (i === 0 || i === 1)) { s += 4; notes.push('high ultra-processed pattern (+4)'); }
      if (ctx.life.indexOf('Low') > -1 && (i === 2 || i === 3)) { s += 4; notes.push('low activity / irregular sleep (+4)'); }
      if (ctx.bmi >= 30 && (i === 0 || i === 2)) { s += 2; notes.push('BMI ≥ 30 context (+2)'); }
      if (mean < 60 && i < 2) { s += 2; notes.push('mean site score < 60 (+2)'); }
      return Object.assign({}, r, { score: Math.min(99, s), notes: notes });
    }).sort(function (a, b) { return b.score - a.score; });
    $('#interventions').innerHTML = recs.map(function (r, i) {
      return '<article class="rec"><div class="rank">' + String(i + 1).padStart(2, '0') + '</div><div><h4>' + esc(r.name) + '</h4><p class="meta">' + esc(r.fit) + ' · ' + esc(r.evidence) + '</p><p><b>Why:</b> ' + esc(r.why) + ' <b>How:</b> ' + esc(r.how) + '</p>' + (r.notes.length ? '<p class="fine">Context adjustments: ' + esc(r.notes.join('; ')) + '</p>' : '') + '</div><div class="score"><b>' + r.score + '</b><span>DEMO SCORE / 100</span></div></article>';
    }).join('');
    $('#ctx-report').innerHTML = '<div class="report-row"><span>INPUT</span><div>Synthetic abundance profile (“' + esc(CONTEXT_PROFILES[state.profile]) + '”) + BMI ' + ctx.bmi + ' + ' + esc(ctx.diet) + ' + ' + esc(ctx.life) + '.</div></div>' +
      '<div class="report-row"><span>SITE SCORES</span><div>' + Object.keys(SITES).map(function (k) { return SITES[k].label + ' ' + evals[k].score + ' (' + statusLabel(evals[k].score) + ')'; }).join(' · ') + '.</div></div>' +
      '<div class="report-row"><span>TOP ACTION</span><div>' + esc(recs[0].name) + ' — ranked highest because of broad relevance and high evidence coverage in this illustrative list.</div></div>' +
      '<div class="report-row"><span>IMPORTANT</span><div>Synthetic data, illustrative scores. This output does not diagnose disease, define a healthy microbiome, or prescribe treatment.</div></div>';
  }

  function refresh() { evalAll(); paintScorecards(); paintSite(); paintInterventions(); }

  /* ---------------------------------------------------------------- INIT */
  function init() {
    $('#profile').innerHTML = Object.keys(CONTEXT_PROFILES).map(function (k) { return '<option value="' + k + '">' + CONTEXT_PROFILES[k] + '</option>'; }).join('');
    $('#site-tabs').innerHTML = Object.keys(SITES).map(function (k) { return '<button type="button" role="tab" data-site="' + k + '">' + SITES[k].label + '</button>'; }).join('');
    loadProfile('balanced');
    $('#profile').addEventListener('change', function (e) { loadProfile(e.target.value); refresh(); });
    ['bmi', 'diet', 'lifestyle'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () { state.ctx = { bmi: parseFloat($('#bmi').value) || 0, diet: $('#diet').value, life: $('#lifestyle').value }; paintInterventions(); });
    });
    $('#analyze').addEventListener('click', function () { state.ctx = { bmi: parseFloat($('#bmi').value) || 0, diet: $('#diet').value, life: $('#lifestyle').value }; refresh(); $('#results').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); });
    function pick(e) { var b = e.target.closest('[data-site]'); if (b) { state.site = b.dataset.site; paintScorecards(); paintSite(); } }
    $('#site-tabs').addEventListener('click', pick); $('#scorecards').addEventListener('click', pick);
    $('#taxa-sliders').addEventListener('input', function (e) {
      var t = e.target.dataset.taxon; if (!t) return;
      state.ab[state.site][t] = parseFloat(e.target.value);
      e.target.parentNode.querySelector('output').textContent = parseFloat(e.target.value).toFixed(1) + '%';
      evals[state.site] = evaluate(state.site);
      paintScorecards(); paintSite({ keepSliders: true }); paintInterventions();
    });
    $('#reset-site').addEventListener('click', function () { state.ab[state.site] = Object.assign({}, SITES[state.site].profiles[state.profile]); refresh(); });
    $('#anim').addEventListener('change', function (e) { state.animate = e.target.checked; if (state.graph) state.graph.setAnimate(state.animate); });
    if (reduceMotion) $('#anim').checked = false;
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.__microbiome = { SITES: SITES, evaluate: evaluate, loadProfile: loadProfile };
})();
