/* A real-time 3D projection of Jarvis modules and their visualized connections.
   The node count follows the real brain status; the layout is deterministic. */
(() => {
  'use strict';
  const CLUSTERS = [
    {name: 'voce', label: 'VOCE', x: -133, y: -94, z: 24, share: .13},
    {name: 'memoria', label: 'MEMORIA E METODI', x: 133, y: -86, z: -10, share: .2},
    {name: 'agenti', label: 'AGENTI', x: 0, y: -150, z: -40, share: .1},
    {name: 'archivio', label: 'ARCHIVIO', x: 150, y: 60, z: 60, share: .18},
    {name: 'privacy', label: 'PRIVACY', x: -145, y: 102, z: 16, share: .08},
    {name: 'sistemi', label: 'SISTEMI', x: -60, y: 150, z: -50, share: .15},
    {name: 'portabilita', label: 'PORTABILITÀ', x: 147, y: 105, z: 0, share: .08},
    {name: 'identita', label: 'IDENTITÀ', x: 0, y: 152, z: -30, share: .08}
  ];
  const MAX_NODES = 1500;
  const DEFAULT_NODES = 146;
  const between = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Small deterministic generator so the same count always draws the same brain.
  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Neural3D {
    constructor(canvas, onSelect, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onSelect = onSelect;
      this.cinema = Boolean(options.cinema);
      this.selected = 'cervello';
      this.angleY = -.22;
      this.angleX = .14;
      this.drag = null;
      this.lastDraw = 0;
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.scene = {reveal: 1, zoom: 1, labels: 1};
      this.target = {reveal: 1, zoom: 1, labels: 1};
      this.fault = null;
      this.view = {width: 520, height: 430, scale: 1, offsetX: 0, offsetY: 0};
      this.setStatus({neurons: options.neurons || DEFAULT_NODES});
      this.anchorProjections = [];
      this.resize();
      if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
      else window.addEventListener('resize', () => this.resize());
      canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
      canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
      canvas.addEventListener('pointerup', (event) => this.pointerUp(event));
      canvas.addEventListener('pointercancel', () => this.pointerCancel());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.draw(performance.now()); });
      if (!this.reducedMotion) requestAnimationFrame((time) => this.frame(time));
    }

    get neuronCount() { return this.nodes.length; }

    setStatus(status) {
      const total = Math.max(12, Math.min(MAX_NODES, Math.round(status.neurons || DEFAULT_NODES)));
      this.nodes = this.makeNodes(total);
      this.edges = this.makeEdges();
      this.rankNodes();
      if (this.ctx) this.draw(performance.now());
    }

    makeNodes(total) {
      const nodes = [{x: 0, y: 0, z: 0, group: 'cervello', core: true}];
      const next = random(total * 7919 + 17);
      const gaussian = () => (next() + next() + next() - 1.5) / 1.5;
      for (const cluster of CLUSTERS) {
        const count = Math.max(3, Math.round(cluster.share * (total - 1)));
        const spread = 34 + Math.sqrt(count) * 3.2;
        for (let i = 0; i < count; i++) {
          const pull = i % 7 === 0 ? .45 : i % 4 === 0 ? .72 : 1;
          nodes.push({
            x: cluster.x * pull + gaussian() * spread,
            y: cluster.y * pull + gaussian() * spread,
            z: cluster.z * pull + gaussian() * spread,
            group: cluster.name
          });
        }
      }
      return nodes.slice(0, Math.max(total, 1));
    }

    makeEdges() {
      const edges = [], seen = new Set();
      const cell = 60;
      const buckets = new Map();
      const keyOf = (node) => `${Math.floor(node.x / cell)},${Math.floor(node.y / cell)},${Math.floor(node.z / cell)}`;
      this.nodes.forEach((node, index) => {
        if (!index) return;
        const key = keyOf(node);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(index);
      });
      for (let i = 1; i < this.nodes.length; i++) {
        const node = this.nodes[i];
        const cx = Math.floor(node.x / cell), cy = Math.floor(node.y / cell), cz = Math.floor(node.z / cell);
        const nearby = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          for (const j of buckets.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
            if (j !== i) nearby.push({j, distance: between(node, this.nodes[j])});
          }
        }
        nearby.sort((a, b) => a.distance - b.distance);
        for (const item of nearby.slice(0, 3)) {
          if (item.distance > 72) continue;
          const a = Math.min(i, item.j), b = Math.max(i, item.j), key = `${a}-${b}`;
          if (!seen.has(key)) { seen.add(key); edges.push([a, b]); }
        }
        if (i % 16 === 0 || i <= 3) edges.push([0, i]);
      }
      return edges;
    }

    // Reveal order: the core and its first three branches, then everything by distance from the core.
    rankNodes() {
      const sorted = this.nodes.map((node, index) => ({index, distance: between(node, this.nodes[0])})).slice(1).sort((a, b) => a.distance - b.distance);
      this.nodes[0].order = 0;
      sorted.forEach((item, position) => {
        this.nodes[item.index].order = item.index <= 3 ? .01 : .05 + .95 * position / Math.max(1, sorted.length - 1);
      });
    }

    setScene(values, immediate = false) {
      Object.assign(this.target, values);
      if (immediate || this.reducedMotion) Object.assign(this.scene, values);
      this.draw(performance.now());
    }

    setFault(fault) { this.fault = fault; this.draw(performance.now()); }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (this.cinema) {
        const width = Math.max(300, rect.width || window.innerWidth), height = Math.max(300, rect.height || window.innerHeight);
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        const scale = Math.min(width / 520, height / 430) * 1.2;
        this.view = {width, height, scale, offsetX: (width - 520 * scale) / 2, offsetY: (height - 430 * scale) / 2};
        this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, this.view.offsetX * dpr, this.view.offsetY * dpr);
      } else {
        const width = Math.max(250, rect.width || 520);
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(width * 430 / 520 * dpr);
        this.view = {width, height: width * 430 / 520, scale: width / 520, offsetX: 0, offsetY: 0};
        this.ctx.setTransform(width / 520 * dpr, 0, 0, width / 520 * dpr, 0, 0);
      }
      this.draw(performance.now());
    }

    rotate(point) {
      const cy = Math.cos(this.angleY), sy = Math.sin(this.angleY);
      const cx = Math.cos(this.angleX), sx = Math.sin(this.angleX);
      const x = point.x * cy + point.z * sy;
      const z = point.z * cy - point.x * sy;
      return {x, y: point.y * cx - z * sx, z: point.y * sx + z * cx};
    }

    project(point) {
      const rotated = this.rotate(point);
      const perspective = 440 / (440 - rotated.z) * this.scene.zoom;
      return {x: 260 + rotated.x * perspective, y: 210 + rotated.y * perspective, z: rotated.z, size: perspective};
    }

    select(name) { this.selected = name; this.draw(performance.now()); }

    frame(time) {
      if (!document.hidden && time - this.lastDraw > 35) {
        if (!this.drag) this.angleY += this.cinema ? .0019 : .0028;
        for (const key of Object.keys(this.target)) this.scene[key] = lerp(this.scene[key], this.target[key], key === 'reveal' ? .06 : .08);
        this.draw(time);
        this.lastDraw = time;
      }
      requestAnimationFrame((next) => this.frame(next));
    }

    drawBackdrop(ctx) {
      if (this.cinema) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
        return;
      }
      ctx.clearRect(0, 0, 520, 430);
      const backdrop = ctx.createRadialGradient(260, 210, 28, 260, 210, 255);
      backdrop.addColorStop(0, '#0c4054'); backdrop.addColorStop(.62, '#082637'); backdrop.addColorStop(1, '#041624');
      ctx.fillStyle = backdrop; ctx.fillRect(0, 0, 520, 430);
      ctx.strokeStyle = 'rgba(67,191,213,.08)'; ctx.lineWidth = .8;
      for (let x = 0; x <= 520; x += 52) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 430); ctx.stroke(); }
      for (let y = 0; y <= 430; y += 43) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(520, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(67,224,231,.26)';
      for (const radius of [92, 160, 189]) { ctx.beginPath(); ctx.ellipse(260, 210, radius, radius * .72, -.08, 0, Math.PI * 2); ctx.stroke(); }
    }

    draw(time) {
      const ctx = this.ctx;
      const reveal = this.scene.reveal;
      const glow = this.nodes.length <= 220;
      this.drawBackdrop(ctx);

      const points = this.nodes.map((node) => this.project(node));
      const visible = this.nodes.map((node) => node.order <= reveal);
      for (const [a, b] of this.edges) {
        if (!visible[a] || !visible[b]) continue;
        const p = points[a], q = points[b];
        const near = (p.z + q.z) / 2;
        const highlighted = this.selected !== 'cervello' && (this.nodes[a].group === this.selected || this.nodes[b].group === this.selected);
        const alpha = Math.max(.06, Math.min(.52, .23 + near / 500)) * (highlighted ? 1.55 : .75);
        ctx.strokeStyle = highlighted ? `rgba(107,255,242,${alpha})` : this.cinema ? `rgba(190,232,255,${alpha * .8})` : `rgba(66,192,218,${alpha})`;
        ctx.lineWidth = highlighted ? 1.1 : .7;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }

      if (!this.reducedMotion && reveal > .5) {
        for (let i = 0; i < this.edges.length; i += 20) {
          const [a, b] = this.edges[i];
          if (!visible[a] || !visible[b]) continue;
          const p = points[a], q = points[b], phase = (time / 1800 + i * .17) % 1;
          const x = p.x + (q.x - p.x) * phase, y = p.y + (q.y - p.y) * phase;
          ctx.fillStyle = 'rgba(167,255,250,.85)'; ctx.shadowBlur = glow ? 8 : 0; ctx.shadowColor = '#75f4f4';
          ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
      }

      const order = points.map((point, index) => ({point, index})).slice(1).filter((item) => visible[item.index]).sort((a, b) => a.point.z - b.point.z);
      for (const {point, index} of order) {
        const neuron = this.nodes[index];
        const selected = neuron.group === this.selected;
        const fresh = Math.max(0, Math.min(1, (reveal - neuron.order) * 12));
        const radius = Math.max(1.3, (selected ? 3.5 : 2.4) * point.size) * (1 + (1 - fresh) * 1.6);
        const alpha = Math.max(.3, Math.min(1, .68 + point.z / 320));
        ctx.fillStyle = selected ? `rgba(192,255,250,${alpha})` : this.cinema ? `rgba(236,250,255,${alpha})` : `rgba(83,211,231,${alpha})`;
        ctx.shadowBlur = glow ? (selected ? 14 : point.z > 50 ? 8 : 3) : 0;
        ctx.shadowColor = selected ? '#a1fff4' : '#9ae9f4';
        ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;

      this.anchorProjections = CLUSTERS.map((anchor) => ({...anchor, ...this.project(anchor)}));
      this.anchorProjections.sort((a, b) => a.z - b.z);
      const labelAlpha = this.cinema ? this.scene.labels : 1;
      if (labelAlpha > .02) {
        ctx.globalAlpha = labelAlpha;
        for (const anchor of this.anchorProjections) {
          const active = anchor.name === this.selected;
          const radius = (active ? 18 : 13) * anchor.size;
          if (!this.cinema) {
            const gradient = ctx.createRadialGradient(anchor.x, anchor.y, 1, anchor.x, anchor.y, radius);
            gradient.addColorStop(0, active ? 'rgba(202,255,249,.98)' : 'rgba(124,240,242,.9)');
            gradient.addColorStop(.35, active ? 'rgba(44,221,223,.8)' : 'rgba(23,114,139,.75)');
            gradient.addColorStop(1, 'rgba(7,37,57,0)');
            ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = active ? '#b7fffb' : 'rgba(92,225,231,.65)'; ctx.lineWidth = active ? 1.8 : 1;
            ctx.beginPath(); ctx.arc(anchor.x, anchor.y, radius * .6, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.fillStyle = this.cinema ? '#cfe9ff' : '#e5ffff';
          ctx.font = `600 ${this.cinema ? 8 : 9}px ui-monospace, monospace`; ctx.textAlign = 'center';
          ctx.fillText(anchor.label, anchor.x, anchor.y + (this.cinema ? -9 * anchor.size : radius + 14));
        }
        ctx.globalAlpha = 1;
      }

      if (this.fault) this.drawFault(ctx);

      const core = points[0];
      if (this.cinema) {
        const radius = Math.max(2.2, 4.2 * core.size);
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 18; ctx.shadowColor = '#bfefff';
        ctx.beginPath(); ctx.arc(core.x, core.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        return;
      }
      const coreFill = ctx.createRadialGradient(core.x, core.y, 4, core.x, core.y, 42);
      coreFill.addColorStop(0, '#b9ffff'); coreFill.addColorStop(.3, '#1da8bd'); coreFill.addColorStop(1, 'rgba(8,47,65,.3)');
      ctx.fillStyle = coreFill; ctx.shadowBlur = 26; ctx.shadowColor = '#40ebf2';
      ctx.beginPath(); ctx.arc(core.x, core.y, 42, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(143,250,250,.84)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(core.x, core.y, 47, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(95,232,237,.55)';
      ctx.beginPath(); ctx.arc(core.x, core.y, 57, -.8, 3.9); ctx.stroke();
      ctx.fillStyle = '#e8ffff'; ctx.textAlign = 'center'; ctx.font = '700 16px ui-monospace, monospace';
      ctx.fillText('JARVIS', core.x, core.y + 5);
      ctx.fillStyle = '#a7e9e9'; ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left'; ctx.fillText('NEURAL FIELD / 3D', 18, 23);
      ctx.textAlign = 'right'; ctx.fillText(`${this.nodes.length} NEURONI // LIVE`, 502, 413);
    }

    // A tagged node near its cluster, red while broken and green once repaired.
    drawFault(ctx) {
      const cluster = CLUSTERS.find((item) => item.name === this.fault.cluster) || CLUSTERS[5];
      const point = this.project({x: cluster.x * .72, y: cluster.y * .72 - 36, z: cluster.z * .72});
      const repaired = this.fault.state === 'riparato';
      const color = repaired ? '#5cf0a0' : '#ff5a5a';
      ctx.fillStyle = color; ctx.shadowBlur = 16; ctx.shadowColor = color;
      ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(2, 3.6 * point.size), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.font = '700 8px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${this.fault.label}: ${repaired ? 'RIPARATO' : 'FERMO'}`, point.x + 7, point.y + 3);
    }

    pointerDown(event) {
      this.drag = {x: event.clientX, y: event.clientY, moved: 0};
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add('dragging');
    }
    pointerMove(event) {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.angleY += dx * .009; this.angleX = Math.max(-1.15, Math.min(1.15, this.angleX + dy * .009));
      this.drag.x = event.clientX; this.drag.y = event.clientY;
      this.draw(performance.now());
    }
    pointerUp(event) {
      if (!this.drag) return;
      const moved = this.drag.moved;
      this.pointerCancel();
      if (moved > 8 || this.cinema) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * 520 / rect.width;
      const y = (event.clientY - rect.top) * 430 / rect.height;
      const closest = this.anchorProjections.reduce((best, item) => {
        const distance = Math.hypot(item.x - x, item.y - y);
        return distance < best.distance ? {item, distance} : best;
      }, {item: null, distance: Infinity});
      if (closest.distance < 32) this.onSelect(closest.item.name);
      else if (Math.hypot(x - 260, y - 210) < 48) this.onSelect('cervello');
    }
    pointerCancel() { this.drag = null; this.canvas.classList.remove('dragging'); }
  }

  Neural3D.CLUSTERS = CLUSTERS;
  window.JarvisNeural3D = Neural3D;
})();
