/* A real-time 3D projection of Jarvis modules and their visualized connections. */
(() => {
  'use strict';
  const ANCHORS = [
    {name: 'voce', label: 'VOCE', x: -133, y: -94, z: 24},
    {name: 'memoria', label: 'MEMORIA', x: 133, y: -86, z: -10},
    {name: 'privacy', label: 'PRIVACY', x: -145, y: 102, z: 16},
    {name: 'portabilita', label: 'PORTABILITÀ', x: 147, y: 105, z: 0},
    {name: 'identita', label: 'IDENTITÀ', x: 0, y: 152, z: -30}
  ];
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const between = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  class Neural3D {
    constructor(canvas, onSelect) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onSelect = onSelect;
      this.selected = 'cervello';
      this.angleY = -.22;
      this.angleX = .14;
      this.drag = null;
      this.lastDraw = 0;
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.nodes = this.makeNodes();
      this.edges = this.makeEdges();
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

    makeNodes() {
      const nodes = [{x: 0, y: 0, z: 0, group: 'cervello', core: true}];
      for (let i = 0; i < 145; i++) {
        const u = (i + .5) / 145;
        const y = 1 - 2 * u;
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const angle = i * GOLDEN_ANGLE;
        const layer = i % 5 === 0 ? .5 : i % 3 === 0 ? .78 : 1;
        const point = {x: Math.cos(angle) * ring * 146 * layer, y: y * 146 * layer, z: Math.sin(angle) * ring * 146 * layer};
        let nearest = ANCHORS[0], distance = Infinity;
        for (const anchor of ANCHORS) {
          const value = between(point, anchor);
          if (value < distance) { nearest = anchor; distance = value; }
        }
        point.group = nearest.name;
        nodes.push(point);
      }
      return nodes;
    }

    makeEdges() {
      const edges = [], seen = new Set();
      for (let i = 1; i < this.nodes.length; i++) {
        const nearby = [];
        for (let j = 1; j < this.nodes.length; j++) {
          if (i !== j) nearby.push({j, distance: between(this.nodes[i], this.nodes[j])});
        }
        nearby.sort((a, b) => a.distance - b.distance);
        for (const item of nearby.slice(0, 3)) {
          if (item.distance > 68) continue;
          const a = Math.min(i, item.j), b = Math.max(i, item.j), key = `${a}-${b}`;
          if (!seen.has(key)) { seen.add(key); edges.push([a, b]); }
        }
        if (i % 16 === 0) edges.push([0, i]);
      }
      return edges;
    }

    resize() {
      const width = Math.max(250, this.canvas.getBoundingClientRect().width || 520);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(width * 430 / 520 * dpr);
      this.ctx.setTransform(width / 520 * dpr, 0, 0, width / 520 * dpr, 0, 0);
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
      const perspective = 440 / (440 - rotated.z);
      return {x: 260 + rotated.x * perspective, y: 210 + rotated.y * perspective, z: rotated.z, size: perspective};
    }

    select(name) { this.selected = name; this.draw(performance.now()); }

    frame(time) {
      if (!document.hidden && time - this.lastDraw > 35) {
        if (!this.drag) this.angleY += .0028;
        this.draw(time);
        this.lastDraw = time;
      }
      requestAnimationFrame((next) => this.frame(next));
    }

    draw(time) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 520, 430);
      const backdrop = ctx.createRadialGradient(260, 210, 28, 260, 210, 255);
      backdrop.addColorStop(0, '#0c4054'); backdrop.addColorStop(.62, '#082637'); backdrop.addColorStop(1, '#041624');
      ctx.fillStyle = backdrop; ctx.fillRect(0, 0, 520, 430);

      ctx.strokeStyle = 'rgba(67,191,213,.08)'; ctx.lineWidth = .8;
      for (let x = 0; x <= 520; x += 52) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 430); ctx.stroke(); }
      for (let y = 0; y <= 430; y += 43) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(520, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(67,224,231,.26)';
      for (const radius of [92, 160, 189]) { ctx.beginPath(); ctx.ellipse(260, 210, radius, radius * .72, -.08, 0, Math.PI * 2); ctx.stroke(); }

      const points = this.nodes.map((node) => this.project(node));
      for (const [a, b] of this.edges) {
        const p = points[a], q = points[b];
        const near = (p.z + q.z) / 2;
        const highlighted = this.selected !== 'cervello' && (this.nodes[a].group === this.selected || this.nodes[b].group === this.selected);
        const alpha = Math.max(.06, Math.min(.52, .23 + near / 500)) * (highlighted ? 1.55 : .75);
        ctx.strokeStyle = highlighted ? `rgba(107,255,242,${alpha})` : `rgba(66,192,218,${alpha})`;
        ctx.lineWidth = highlighted ? 1.1 : .7;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }

      if (!this.reducedMotion) {
        for (let i = 0; i < this.edges.length; i += 20) {
          const [a, b] = this.edges[i], p = points[a], q = points[b], phase = (time / 1800 + i * .17) % 1;
          const x = p.x + (q.x - p.x) * phase, y = p.y + (q.y - p.y) * phase;
          ctx.fillStyle = 'rgba(167,255,250,.85)'; ctx.shadowBlur = 8; ctx.shadowColor = '#75f4f4';
          ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
      }

      const order = points.map((point, index) => ({point, index})).slice(1).sort((a, b) => a.point.z - b.point.z);
      for (const {point, index} of order) {
        const neuron = this.nodes[index];
        const selected = neuron.group === this.selected;
        const radius = Math.max(1.3, (selected ? 3.5 : 2.4) * point.size);
        const alpha = Math.max(.3, Math.min(1, .68 + point.z / 320));
        ctx.fillStyle = selected ? `rgba(192,255,250,${alpha})` : `rgba(83,211,231,${alpha})`;
        ctx.shadowBlur = selected ? 14 : point.z > 50 ? 8 : 3;
        ctx.shadowColor = selected ? '#a1fff4' : '#44d9ea';
        ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;

      this.anchorProjections = ANCHORS.map((anchor) => ({...anchor, ...this.project(anchor)}));
      this.anchorProjections.sort((a, b) => a.z - b.z);
      for (const anchor of this.anchorProjections) {
        const active = anchor.name === this.selected;
        const radius = (active ? 18 : 13) * anchor.size;
        const gradient = ctx.createRadialGradient(anchor.x, anchor.y, 1, anchor.x, anchor.y, radius);
        gradient.addColorStop(0, active ? 'rgba(202,255,249,.98)' : 'rgba(124,240,242,.9)');
        gradient.addColorStop(.35, active ? 'rgba(44,221,223,.8)' : 'rgba(23,114,139,.75)');
        gradient.addColorStop(1, 'rgba(7,37,57,0)');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(anchor.x, anchor.y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = active ? '#b7fffb' : 'rgba(92,225,231,.65)'; ctx.lineWidth = active ? 1.8 : 1;
        ctx.beginPath(); ctx.arc(anchor.x, anchor.y, radius * .6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#e5ffff'; ctx.font = '600 9px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText(anchor.label, anchor.x, anchor.y + radius + 14);
      }

      const core = points[0];
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
      ctx.fillText('146 NODES // LIVE', 380, 413);
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
      if (moved > 8) return;
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

  window.JarvisNeural3D = Neural3D;
})();
