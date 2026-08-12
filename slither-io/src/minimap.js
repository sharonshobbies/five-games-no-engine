// Circular minimap, 2D canvas.
//
// Drawing every body node of thirty snakes every frame is pointless at 168px
// across, so each snake contributes a short polyline sampled at a fixed count,
// and the map only redraws a few times a second.

import { ARENA_R } from './config.js';
import { rgbToCss } from './math.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.acc = 0;
    this.tmp = [0, 0];
  }

  update(dt, world, player) {
    this.acc += dt;
    if (this.acc < 1 / 18) return;
    this.acc = 0;
    this.draw(world, player);
  }

  draw(world, player) {
    const g = this.g;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = w / 2 - 3;
    const k = R / ARENA_R;

    g.clearRect(0, 0, w, h);

    // Arena disc.
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fillStyle = 'rgba(9,13,28,0.72)';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,72,88,0.55)';
    g.stroke();

    g.save();
    g.beginPath();
    g.arc(cx, cy, R - 1, 0, Math.PI * 2);
    g.clip();

    const out = this.tmp;
    for (const s of world.snakes) {
      if (!s.alive || s === player) continue;
      const col = s.avgColor();
      g.strokeStyle = rgbToCss(col);
      g.globalAlpha = 0.95;
      g.lineWidth = Math.max(1.8, Math.min(4.6, 1.2 + s.sc * 0.6));
      g.lineCap = 'round';
      g.beginPath();
      const N = 7;
      const len = s.bodyLength;
      for (let i = 0; i <= N; i++) {
        s.pointBack((i / N) * len, out);
        const px = cx + out[0] * k;
        const py = cy - out[1] * k;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }

    // The player last, in white, so they never get lost in the swarm.
    if (player && player.alive) {
      g.globalAlpha = 1;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.4;
      g.beginPath();
      const N = 9;
      const len = player.bodyLength;
      for (let i = 0; i <= N; i++) {
        player.pointBack((i / N) * len, out);
        const px = cx + out[0] * k;
        const py = cy - out[1] * k;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
      const hx = cx + player.x * k;
      const hy = cy - player.y * k;
      g.beginPath();
      g.arc(hx, hy, 3.4, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.shadowColor = '#ffffff';
      g.shadowBlur = 7;
      g.fill();
      g.shadowBlur = 0;
    }

    g.restore();
    g.globalAlpha = 1;
  }
}
