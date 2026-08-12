// Pooled particle system: dust, sparks, smoke, ore pickups, floating text.

const MAX = 900;

export class Particles {
  constructor() {
    this.p = [];
    for (let i = 0; i < MAX; i++) {
      this.p.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#fff", grav: 0, kind: 0, text: "", drag: 1 });
    }
    this.next = 0;
    this.texts = [];
  }

  spawn(o) {
    // Lowest-cost reuse: walk forward from a cursor, overwrite the oldest slot.
    for (let i = 0; i < MAX; i++) {
      const idx = (this.next + i) % MAX;
      const q = this.p[idx];
      if (!q.alive) {
        this.next = (idx + 1) % MAX;
        Object.assign(q, { alive: true, grav: 0, drag: 1, kind: 0, size: 2, color: "#fff" }, o);
        q.max = q.life;
        return q;
      }
    }
    const q = this.p[this.next];
    this.next = (this.next + 1) % MAX;
    Object.assign(q, { alive: true, grav: 0, drag: 1, kind: 0, size: 2, color: "#fff" }, o);
    q.max = q.life;
    return q;
  }

  dust(x, y, color, n = 6, spread = 60) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: (Math.random() - 0.5) * spread - 12,
        life: 0.35 + Math.random() * 0.5,
        size: 1.6 + Math.random() * 2.6,
        color, grav: 150, drag: 0.94,
      });
    }
  }

  sparks(x, y, n = 12, color = "#ffd070") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 220;
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.45,
        size: 1.4 + Math.random() * 1.8,
        color, grav: 260, drag: 0.93, kind: 1,
      });
    }
  }

  smoke(x, y, n = 8, color = "rgba(60,60,66,0.7)") {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * 70,
        vy: -20 - Math.random() * 70,
        life: 0.6 + Math.random() * 0.9,
        size: 4 + Math.random() * 8,
        color, grav: -22, drag: 0.95, kind: 2,
      });
    }
  }

  thrusterPuff(x, y, dirX, dirY) {
    this.spawn({
      x, y,
      vx: dirX * (30 + Math.random() * 60) + (Math.random() - 0.5) * 30,
      vy: dirY * (60 + Math.random() * 90) + (Math.random() - 0.5) * 20,
      life: 0.18 + Math.random() * 0.24,
      size: 2 + Math.random() * 3.5,
      color: Math.random() < 0.5 ? "#ffb43c" : "#ff7020",
      grav: 40, drag: 0.9, kind: 1,
    });
  }

  floatText(x, y, text, color = "#ffffff", life = 1.4) {
    this.texts.push({ x, y, text, color, life, max: life });
  }

  update(dt) {
    for (const q of this.p) {
      if (!q.alive) continue;
      q.life -= dt;
      if (q.life <= 0) { q.alive = false; continue; }
      q.vy += q.grav * dt;
      const d = Math.pow(q.drag, dt * 60);
      q.vx *= d; q.vy *= d;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= dt * 26;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(g) {
    g.save();
    for (const q of this.p) {
      if (!q.alive) continue;
      const a = Math.max(0, Math.min(1, q.life / q.max));
      g.globalAlpha = q.kind === 2 ? a * 0.55 : a;
      g.globalCompositeOperation = q.kind === 1 ? "lighter" : "source-over";
      g.fillStyle = q.color;
      const s = q.kind === 2 ? q.size * (1 + (1 - a) * 1.4) : q.size;
      g.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.font = "bold 13px 'Lucida Console', monospace";
    g.textAlign = "center";
    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.max * 1.6);
      g.globalAlpha = a;
      g.fillStyle = "rgba(0,0,0,0.7)";
      g.fillText(t.text, t.x + 1, t.y + 1);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
    g.restore();
  }
}
