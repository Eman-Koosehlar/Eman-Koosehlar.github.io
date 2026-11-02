/* ==========================================================================
   KGraph — small, dependency-free layered knowledge-graph renderer (SVG).
   Used by Health KG and Microbiome projects.

   KGraph.create(container, {
     columns: [{ title, nodes: [{ id, label, value?, state?, detail? }] }, ...],
     edges:   [{ from, to, strength (0..1 = how "active"), width (0..1) }],
     onSelect: function (nodeId | null) {}
   }) -> { update(spec), select(id|null), setAnimate(bool) }

   node.state: 'ok' | 'mid' | 'risk' | 'accent' | 'off'  (colours via CSS vars)
   Edges are drawn faintly when inactive and animated (flowing dashes) when
   strength > 0.15. Hover/focus highlights upstream + downstream paths; click
   (or Enter/Space) pins the selection.
   ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = { ok: 'var(--ok)', mid: 'var(--mid)', risk: 'var(--risk)', accent: 'var(--blue)', off: 'var(--off)' };

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function create(container, spec) {
    var W = 1000, PAD = 10, NODE_W = 182, NODE_H = 30, TOP = 40, ROW_H = spec.rowH || 40;
    var state = { spec: spec, pinned: null, hover: null, animate: true };
    var svg, nodeEls = {}, edgeEls = [], adj = { out: {}, inn: {} };

    function render() {
      container.innerHTML = '';
      nodeEls = {}; edgeEls = []; adj = { out: {}, inn: {} };
      var cols = state.spec.columns, n = cols.length;
      var maxN = Math.max.apply(null, cols.map(function (c) { return c.nodes.length; }));
      var H = TOP + maxN * ROW_H + 14;
      svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'kg-svg', role: 'group', 'aria-label': state.spec.ariaLabel || 'Interactive knowledge graph' });
      if (!state.animate) svg.classList.add('kg-paused');
      var step = (W - 2 * PAD - NODE_W) / (n - 1);
      var pos = {};
      var gEdges = el('g', null, svg), gNodes = el('g', null, svg);

      cols.forEach(function (col, ci) {
        var x = PAD + ci * step;
        var t = el('text', { x: x, y: 20, class: 'kg-coltitle' }, svg);
        t.textContent = col.title;
        var span = maxN * ROW_H / col.nodes.length;
        col.nodes.forEach(function (nd, ri) {
          var y = TOP + span * (ri + 0.5) - NODE_H / 2;
          pos[nd.id] = { x: x, y: y };
        });
      });

      // edges first (under nodes)
      state.spec.edges.forEach(function (e) {
        var a = pos[e.from], b = pos[e.to];
        if (!a || !b) return;
        var x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2, dx = (x2 - x1) * 0.55;
        var d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
        var s = Math.max(0, Math.min(1, e.strength || 0));
        var w = 0.8 + 3.2 * Math.max(0, Math.min(1, e.width == null ? 0.4 : e.width));
        var srcNode = findNode(e.from);
        var colour = COLORS[(srcNode && srcNode.state) || 'off'];
        var p = el('path', { d: d, class: 'kg-edge', style: '--c:' + colour, 'stroke-width': w.toFixed(2), 'stroke-opacity': (s > 0.02 ? 0.25 + 0.6 * s : 0.1).toFixed(2) }, gEdges);
        var f = null;
        if (s > 0.15) f = el('path', { d: d, class: 'kg-flow', style: '--c:' + colour, 'stroke-width': Math.max(1.4, w * 0.6).toFixed(2), 'stroke-opacity': (0.5 + 0.5 * s).toFixed(2) }, gEdges);
        edgeEls.push({ e: e, path: p, flow: f, active: s > 0.02 });
        (adj.out[e.from] = adj.out[e.from] || []).push(e);
        (adj.inn[e.to] = adj.inn[e.to] || []).push(e);
      });

      cols.forEach(function (col) {
        col.nodes.forEach(function (nd) {
          var p = pos[nd.id];
          var g = el('g', { class: 'kg-node', transform: 'translate(' + p.x + ' ' + p.y + ')', tabindex: 0, role: 'button', 'aria-label': nd.label + (nd.value ? ', ' + nd.value : ''), style: '--c:' + COLORS[nd.state || 'off'], 'data-id': nd.id }, gNodes);
          var tip = el('title', null, g); tip.textContent = nd.label + (nd.detail ? ' — ' + nd.detail : '');
          el('rect', { class: 'box', width: NODE_W, height: NODE_H, rx: 7 }, g);
          el('rect', { class: 'bar', x: 0, y: 6, width: 3, height: NODE_H - 12, rx: 1.5 }, g);
          // fit label: shrink font (down to 8.5px) and finally truncate so it never collides with the value
          var hasVal = nd.value != null && nd.value !== '';
          var cap = Math.floor((NODE_W - 13 - (hasVal ? 8 + String(nd.value).length * 6.6 + 6 : 8)) / 6.3), lab = nd.label, fs = 11.5;
          if (lab.length > cap) fs = Math.max(8.5, 11.5 * cap / lab.length);
          var maxChars = Math.floor(cap * 11.5 / fs * 1.0);
          if (lab.length > maxChars) lab = lab.slice(0, maxChars - 1).trim() + '…';
          var t = el('text', { x: 13, y: NODE_H / 2 + 4, style: fs < 11.5 ? 'font-size:' + fs.toFixed(1) + 'px' : '' }, g); t.textContent = lab;
          if (nd.value != null && nd.value !== '') { var v = el('text', { class: 'val', x: NODE_W - 9, y: NODE_H / 2 + 4 }, g); v.textContent = nd.value; }
          g.addEventListener('mouseenter', function () { state.hover = nd.id; paint(); });
          g.addEventListener('mouseleave', function () { state.hover = null; paint(); });
          g.addEventListener('focus', function () { state.hover = nd.id; paint(); });
          g.addEventListener('blur', function () { state.hover = null; paint(); });
          g.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(nd.id); });
          g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(nd.id); } });
          nodeEls[nd.id] = g;
        });
      });
      svg.addEventListener('click', function () { if (state.pinned) toggle(state.pinned); });
      container.appendChild(svg);
      paint();
    }

    function findNode(id) {
      var cols = state.spec.columns;
      for (var i = 0; i < cols.length; i++) for (var j = 0; j < cols[i].nodes.length; j++) if (cols[i].nodes[j].id === id) return cols[i].nodes[j];
      return null;
    }

    function reach(start, dirKey, activeOnly) {
      var seen = {}; seen[start] = true; var q = [start];
      while (q.length) {
        var cur = q.shift();
        (adj[dirKey][cur] || []).forEach(function (e) {
          if (activeOnly && (e.strength || 0) <= 0.02) return;
          var nxt = dirKey === 'out' ? e.to : e.from;
          if (!seen[nxt]) { seen[nxt] = true; q.push(nxt); }
        });
      }
      return seen;
    }

    function paint() {
      var id = state.hover || state.pinned;
      Object.keys(nodeEls).forEach(function (k) {
        nodeEls[k].classList.toggle('kg-sel', k === state.pinned);
        nodeEls[k].classList.remove('kg-dim');
      });
      edgeEls.forEach(function (o) { o.path.classList.remove('kg-dim', 'kg-hl'); if (o.flow) o.flow.classList.remove('kg-dim'); });
      if (!id || !nodeEls[id]) return;
      var up = reach(id, 'inn', true), down = reach(id, 'out', true);
      if (Object.keys(up).length + Object.keys(down).length <= 2) { up = reach(id, 'inn', false); down = reach(id, 'out', false); }
      Object.keys(nodeEls).forEach(function (k) { if (!up[k] && !down[k]) nodeEls[k].classList.add('kg-dim'); });
      edgeEls.forEach(function (o) {
        var on = (up[o.e.from] && up[o.e.to]) || (down[o.e.from] && down[o.e.to]);
        if (on) o.path.classList.add('kg-hl'); else { o.path.classList.add('kg-dim'); if (o.flow) o.flow.classList.add('kg-dim'); }
      });
    }

    function toggle(id) {
      state.pinned = state.pinned === id ? null : id;
      paint();
      if (state.spec.onSelect) state.spec.onSelect(state.pinned);
    }

    render();
    return {
      update: function (next) { state.spec = Object.assign({}, state.spec, next); render(); },
      select: function (id) { state.pinned = id; paint(); },
      setAnimate: function (on) { state.animate = !!on; if (svg) svg.classList.toggle('kg-paused', !on); }
    };
  }

  global.KGraph = { create: create, COLORS: COLORS };
})(window);
