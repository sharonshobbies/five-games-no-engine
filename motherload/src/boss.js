// Mr. Natas, at -66,666 ft. Two forms: the businessman with the monocle and the
// staff (1,000 HP), then the cyborg demon (2,000 HP).
//
// HOW YOU HURT HIM -- this is sourced, and it is not what you would guess from a
// pod with a drill on it. From the Motherload wiki's Ending page: "To damage Mr.
// Natas, you must hit him with Dynamite or Plastic Explosives, bought from
// Emendation Station 3500." His hitbox is deceptively small, the blast has to
// land AT HIS FEET, and an edge-of-blast hit does nothing like full damage.
// Plastic Explosive maxes at 240, Dynamite at 120, and either drops to 60 when
// detonated further away. Because charges only arm on solid ground, the whole
// fight is: close in, touch down, plant, run.
//
// The DJxChrome GameFAQs walkthrough gives the same three numbers as distance
// tiers for one charge (240 direct / 120 close / 60 indirect) rather than as
// per-item maxima. Both readings are honoured below: Plastic runs the full
// 240/120/60 ladder, Dynamite tops out at its documented 120.
//
// Ramming does NOT work, and is worse than useless: contact damages the pod and
// bounces it, which locks out explosives and the teleporter for a moment.
//
// The arena has a ceiling, and it is a soft boundary. Three squares above it is
// a genuine safe pocket -- the Laser Monocle still reaches you there, the
// form-2 claw does not. Four squares up and the fight is abandoned and resets.
//
// Undocumented anywhere, and therefore invented here: every per-attack damage
// number. The wiki gives only a relative scale (a contact hit costs ~3 nanobot
// kits to undo, a pass-through ~2, a laser hit 3-4); these numbers are set to
// that ratio against a 30-HP kit.

import { TILE, POD_W, POD_H } from "./config.js";
import { BARRIER_ROW0, LAIR_ROW0 } from "./world.js";
import { roundRect } from "./textures.js";

/** Max damage per charge, at his feet. Both fall to INDIRECT_DAMAGE at range. */
export const BLAST_DAMAGE = { dynamite: 120, plastic: 240 };
export const CLOSE_DAMAGE = { dynamite: 60, plastic: 120 };
export const INDIRECT_DAMAGE = 60;

/** Invented: the relative scale the wiki's nanobot-kit accounting implies. */
export const HURT = {
  contact: 90,      // ~3 kits
  passThrough: 60,  // ~2 kits
  laser: 105,       // 3-4 kits
  staff: 90,
  claw: 120,        // "faster and harder hitting than the Laser Monocle"
  fireballDps: 150, // constant while you are touching it
};

/** Contact bounces the pod, and the bounce is what blocks your only weapon. */
export const BOUNCE_LOCK = 0.6;

const FORM = [
  { hp: 1000, w: 132, h: 210, name: "MR. NATAS" },
  { hp: 2000, w: 156, h: 232, name: "SATAN" },
];

export class Boss {
  /** `cycle` is the New Game+ count: HP and damage are both x (cycle + 1). */
  constructor(world, cycle = 0) {
    this.world = world;
    this.cycle = Math.max(0, cycle);
    this.scale = this.cycle + 1;
    this.form = 0;
    this.hp = FORM[0].hp * this.scale;
    this.maxHp = this.hp;
    this.x = world.lair.centerX;
    this.floorY = world.lair.floorY;
    this.y = this.floorY - FORM[0].h / 2;
    this.vx = 0;
    this.dir = -1;
    this.timer = 1.6;
    this.attack = null;        // {kind, t, ...}
    this.projectiles = [];
    this.hitFlash = 0;
    this.dead = false;
    this.transitioning = false;
    this.sinking = 0;
    this.laserAngle = 0;
    this.clawReach = 0;
    this.animT = 0;
    this.lastHitLabel = null;
    this.lastHitTimer = 0;
  }

  get w() { return FORM[this.form].w; }
  get h() { return FORM[this.form].h; }
  get name() { return FORM[this.form].name; }
  /** The point a charge has to land on for full damage. */
  get feetY() { return this.floorY - 10; }

  bounds() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  /**
   * A charge went off. Returns the damage dealt so the caller can report it.
   * `radiusTiles` is the crater radius, which is also how far "close" reaches.
   */
  applyBlast(kind, px, py, radiusTiles, game) {
    if (this.dead || this.transitioning) return 0;
    const d = Math.hypot(px - this.x, py - this.feetY);
    const max = BLAST_DAMAGE[kind] ?? INDIRECT_DAMAGE;
    const close = CLOSE_DAMAGE[kind] ?? INDIRECT_DAMAGE;
    let dmg = 0, label = null;
    if (d < TILE * 0.95) { dmg = max; label = "DIRECT HIT"; }
    else if (d < radiusTiles * TILE * 0.8) { dmg = close; label = "CLOSE"; }
    else if (d < radiusTiles * TILE + this.w * 0.5) { dmg = INDIRECT_DAMAGE; label = "INDIRECT"; }
    if (dmg <= 0) return 0;
    this.lastHitLabel = `${label}  -${dmg}`;
    this.lastHitTimer = 1.3;
    this.takeDamage(dmg, game);
    return dmg;
  }

  takeDamage(amount, game) {
    if (this.dead || this.transitioning) return;
    this.hp -= amount;
    this.hitFlash = 0.18;
    game.renderer.addShake(4);
    if (this.hp <= 0) {
      if (this.form === 0) {
        this.form = 1;
        this.maxHp = FORM[1].hp * this.scale;
        this.hp = this.maxHp;
        this.y = this.floorY - FORM[1].h / 2;
        this.transitioning = true;
        this.sinking = 0;
        this.projectiles.length = 0;
        this.attack = null;
        this.timer = 3.2;
        game.onBossPhase();
      } else {
        this.dead = true;
        game.onBossDefeated();
      }
    }
  }

  /** How far above the arena ceiling the pod is, in tiles. */
  ceilingClearance(pod) {
    return (LAIR_ROW0 * TILE - (pod.y + POD_H / 2)) / TILE;
  }

  update(dt, game) {
    if (this.dead) return;
    this.animT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.lastHitTimer = Math.max(0, this.lastHitTimer - dt);
    const pod = game.pod;
    const dmgMul = this.scale;

    // Four squares above the ceiling abandons the fight, and he heals up.
    if (pod.y + POD_H / 2 < BARRIER_ROW0 * TILE) { game.abandonBossFight(); return; }
    // Three squares up is the safe pocket: the monocle reaches, the claw cannot.
    const inPocket = this.ceilingClearance(pod) > 0.2;

    if (this.transitioning) {
      // He sinks into the ground while the transmission runs, then comes back up.
      this.timer -= dt;
      this.sinking = Math.min(1, this.sinking + dt * 1.4);
      if (this.timer <= 0 && !game.story.busy) {
        this.transitioning = false;
        this.sinking = 0;
      }
      return;
    }

    // drift toward the pod
    const want = pod.x + Math.sin(this.animT * 0.7) * 90;
    this.vx += Math.sign(want - this.x) * 120 * dt;
    this.vx *= Math.pow(0.92, dt * 60);
    this.vx = Math.max(-190, Math.min(190, this.vx));
    this.x += this.vx * dt;
    const minX = this.w / 2 + TILE;
    const maxX = (this.world.w - 1) * TILE - this.w / 2;
    if (this.x < minX) { this.x = minX; this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; this.vx = 0; }
    this.dir = pod.x < this.x ? -1 : 1;

    // attack cadence
    if (!this.attack) {
      this.timer -= dt;
      if (this.timer <= 0) this.startAttack(game, inPocket);
    } else {
      this.runAttack(dt, game, inPocket);
    }

    // Fireballs persist and bounce: they deal damage the whole time you are in
    // contact with one, rather than popping on the first touch.
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const q = this.projectiles[i];
      q.vy += 620 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (q.y > this.floorY - 8) { q.y = this.floorY - 8; q.vy = -Math.abs(q.vy) * 0.78; q.bounces++; }
      if (q.y < LAIR_ROW0 * TILE + 8 && q.vy < 0) { q.y = LAIR_ROW0 * TILE + 8; q.vy = -q.vy * 0.6; }
      if (q.x < TILE + q.r) { q.x = TILE + q.r; q.vx = Math.abs(q.vx); }
      if (q.x > (this.world.w - 1) * TILE - q.r) {
        q.x = (this.world.w - 1) * TILE - q.r;
        q.vx = -Math.abs(q.vx);
      }
      const touching = Math.abs(q.x - pod.x) < POD_W / 2 + q.r
        && Math.abs(q.y - pod.y) < POD_H / 2 + q.r;
      if (touching) {
        pod.damage(HURT.fireballDps * dmgMul * dt, game, q.x, q.y);
        if (Math.random() < dt * 30) game.particles.sparks(q.x, q.y, 4, "#ff7a2a");
      }
      if (q.life <= 0 || q.bounces > 7) this.projectiles.splice(i, 1);
    }

    // Contact: hurts, shoves, and locks out the charge you were about to plant.
    if (Math.abs(pod.x - this.x) < this.w / 2 + POD_W / 2 - 6
      && Math.abs(pod.y - this.y) < this.h / 2 + POD_H / 2 - 6) {
      this.contactCd = (this.contactCd || 0) - dt;
      if (this.contactCd <= 0) {
        pod.damage(HURT.contact * dmgMul, game, pod.x, pod.y);
        this.contactCd = 0.75;
        game.audio.hit();
      } else {
        pod.damage(HURT.passThrough * dmgMul * dt * 0.6, game, pod.x, pod.y);
      }
      // The bounce IS the punishment: no explosives, no teleport, while it lasts.
      pod.vx += Math.sign(pod.x - this.x || 1) * 340 * dt * 6;
      pod.vy -= 60 * dt * 6;
      pod.bounceLock = BOUNCE_LOCK;
      game.setWarning("KNOCKED BACK - CHARGES AND TELEPORT LOCKED OUT");
    }
  }

  startAttack(game, inPocket) {
    // In the pocket only the monocle can reach him, so that is what he uses.
    let kinds;
    if (this.form === 0) kinds = ["staff", "laser", "staff", "laser"];
    else kinds = inPocket ? ["fireball", "fireball", "claw"] : ["claw", "fireball", "claw", "fireball"];
    if (inPocket && this.form === 0) kinds = ["laser"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    this.attack = { kind, t: 0, fired: false };
    if (kind === "laser") game.audio.sweep(220, 1400, 0.5, "sawtooth", 0.16);
    if (kind === "staff") game.audio.blip(160, 0.2, "square", 0.12);
    if (kind === "claw") game.audio.blip(120, 0.26, "sawtooth", 0.13);
  }

  runAttack(dt, game, inPocket) {
    const a = this.attack;
    const pod = game.pod;
    const dmgMul = this.scale;
    a.t += dt;

    if (a.kind === "staff") {
      // A slow wind-up and a wide swing with a big knockback.
      if (a.t > 0.6 && !a.fired) {
        a.fired = true;
        const reach = this.w * 0.9;
        if (!inPocket && Math.abs(pod.x - this.x) < reach && Math.abs(pod.y - this.y) < this.h * 0.6) {
          pod.damage(HURT.staff * dmgMul, game, pod.x, pod.y);
          pod.vx += this.dir * 620;
          pod.vy -= 220;
          pod.bounceLock = BOUNCE_LOCK;
          game.renderer.addShake(10);
          game.audio.hit();
        }
        game.particles.dust(this.x + this.dir * this.w * 0.6, this.y + 20, "#5a2020", 14, 220);
      }
      if (a.t > 1.25) { this.attack = null; this.timer = 1.0 + Math.random() * 0.9; }
      return;
    }

    if (a.kind === "claw") {
      // The arm extends, then sweeps forward: faster and harder than the
      // monocle, and shorter ranged. It cannot reach above the ceiling.
      this.clawReach = a.t < 0.34 ? a.t / 0.34 : Math.max(0, 1 - (a.t - 0.34) / 0.5);
      if (a.t > 0.34 && !a.fired) {
        a.fired = true;
        const reach = this.w * 1.15;
        const below = pod.y + POD_H / 2 > LAIR_ROW0 * TILE + 4;
        if (below && !inPocket && Math.abs(pod.x - this.x) < reach
          && Math.abs(pod.y - this.y) < this.h * 0.55) {
          pod.damage(HURT.claw * dmgMul, game, pod.x, pod.y);
          pod.vx += this.dir * 430;
          pod.vy -= 120;
          pod.bounceLock = BOUNCE_LOCK;
          game.renderer.addShake(12);
          game.audio.hit();
        }
        game.particles.sparks(this.x + this.dir * this.w * 0.9, this.y, 12, "#c8d0dc");
      }
      if (a.t > 0.92) { this.attack = null; this.clawReach = 0; this.timer = 0.7 + Math.random() * 0.6; }
      return;
    }

    if (a.kind === "laser") {
      // The monocle beam sweeps, and it reaches through the ceiling.
      if (a.t > 0.4) {
        this.laserAngle = Math.atan2(pod.y - (this.y - this.h * 0.28), pod.x - this.x)
          + Math.sin(a.t * 3.2) * 0.22;
        const ox = this.x, oy = this.y - this.h * 0.28;
        const dx = pod.x - ox, dy = pod.y - oy;
        const dist = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        const diff = Math.abs(((ang - this.laserAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (dist < 1400 && diff < 0.10) {
          this.laserCd = (this.laserCd || 0) - dt;
          if (this.laserCd <= 0) {
            pod.damage(HURT.laser * dmgMul, game, pod.x, pod.y);
            pod.vx += Math.cos(this.laserAngle) * 180;
            this.laserCd = 0.55;
            game.particles.sparks(pod.x, pod.y, 8, "#ff4060");
          }
        }
      }
      if (a.t > 2.0) { this.attack = null; this.timer = 1.1 + Math.random(); this.laserAngle = 0; }
      return;
    }

    if (a.kind === "fireball") {
      // A brief pause with the chest-oven open, then the ball comes out.
      if (a.t > 0.45 && !a.fired) {
        a.fired = true;
        const n = this.form === 1 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          this.projectiles.push({
            x: this.x, y: this.y - 10,
            vx: (this.dir * 150) + (i - (n - 1) / 2) * 150,
            vy: -300 - Math.random() * 120,
            r: 13, life: 9, bounces: 0,
          });
        }
        game.audio.noiseBurst(0.3, 1800, 300, 0.2);
      }
      if (a.t > 1.0) { this.attack = null; this.timer = 0.9 + Math.random() * 0.8; }
    }
  }

  draw(g, time) {
    if (this.dead) return;
    const devil = this.form === 1;
    const { x, y } = this;
    const w = this.w, h = this.h;

    g.save();
    // While transitioning he sinks into the floor, so clip him at the ground.
    if (this.sinking > 0) {
      g.beginPath();
      g.rect(x - w, y - h, w * 2, (this.floorY - (y - h / 2)) - this.sinking * h * 0.95);
      g.clip();
    }
    g.translate(x, y + this.sinking * h * 0.9);
    if (this.hitFlash > 0) {
      g.globalCompositeOperation = "source-over";
      g.filter = "none";
    }

    // laser beam
    if (this.attack && this.attack.kind === "laser" && this.attack.t > 0.4) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.translate(0, -h * 0.28);
      g.rotate(this.laserAngle);
      const grd = g.createLinearGradient(0, 0, 900, 0);
      grd.addColorStop(0, "rgba(255,90,120,0.95)");
      grd.addColorStop(1, "rgba(255,40,80,0)");
      g.fillStyle = grd;
      g.fillRect(0, -5, 900, 10);
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.fillRect(0, -1.6, 900, 3.2);
      g.restore();
    }

    const bodyCol = devil ? "#5c1410" : "#1b1e28";
    // legs
    g.fillStyle = bodyCol;
    g.fillRect(-w * 0.3, h * 0.1, w * 0.22, h * 0.4);
    g.fillRect(w * 0.08, h * 0.1, w * 0.22, h * 0.4);
    if (devil) {
      g.fillStyle = "#2b0d0a";
      g.fillRect(-w * 0.32, h * 0.44, w * 0.26, h * 0.08);
      g.fillRect(w * 0.06, h * 0.44, w * 0.26, h * 0.08);
    }
    // torso
    const grd = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grd.addColorStop(0, devil ? "#8f2418" : "#2b303c");
    grd.addColorStop(1, devil ? "#3d0c08" : "#12141b");
    g.fillStyle = grd;
    roundRect(g, -w * 0.36, -h * 0.18, w * 0.72, h * 0.34, 8);
    g.fill();

    if (devil) {
      // exposed machinery
      g.fillStyle = "#3a3f4a";
      g.fillRect(-w * 0.2, -h * 0.10, w * 0.4, h * 0.16);
      g.fillStyle = "#ff6a20";
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      g.globalAlpha = 0.5 + pulse * 0.5;
      g.beginPath(); g.arc(0, -h * 0.02, 13, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    } else {
      // shirt + tie
      g.fillStyle = "#e6e8ee";
      g.beginPath();
      g.moveTo(-w * 0.1, -h * 0.18);
      g.lineTo(0, h * 0.06);
      g.lineTo(w * 0.1, -h * 0.18);
      g.closePath(); g.fill();
      g.fillStyle = "#9c1a1a";
      g.beginPath();
      g.moveTo(-w * 0.04, -h * 0.16);
      g.lineTo(0, h * 0.06);
      g.lineTo(w * 0.04, -h * 0.16);
      g.closePath(); g.fill();
    }

    // arms / staff / claw
    const swing = this.attack && (this.attack.kind === "staff" || this.attack.kind === "claw")
      ? Math.min(1, this.attack.t / 0.7) : 0;
    g.save();
    g.translate(this.dir * w * 0.34, -h * 0.10);
    g.rotate(this.dir * (-0.6 + swing * 2.0));
    g.fillStyle = devil ? "#6d1a12" : "#20242e";
    g.fillRect(-6, 0, 12, h * 0.3);
    if (devil) {
      // The arm telescopes out before the sweep, then retracts.
      const ext = this.clawReach * 44;
      if (ext > 1) {
        g.fillStyle = "#4a5260";
        g.fillRect(-5, h * 0.3, 10, ext);
        g.fillStyle = "rgba(255,255,255,0.12)";
        for (let k = 0; k < ext; k += 9) g.fillRect(-5, h * 0.3 + k, 10, 2);
      }
      g.fillStyle = "#8a929c";
      for (let i = 0; i < 3; i++) {
        g.save();
        g.translate(0, h * 0.3 + ext);
        g.rotate((i - 1) * (0.35 + this.clawReach * 0.25));
        g.fillRect(-2.5, 0, 5, 26);
        g.restore();
      }
    } else {
      g.fillStyle = "#3a2a12";
      g.fillRect(-3, h * 0.28, 6, h * 0.36);
      g.fillStyle = "#ffd451";
      g.beginPath(); g.arc(0, h * 0.66, 9, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    // head
    g.fillStyle = devil ? "#7d1f14" : "#c99a72";
    g.beginPath(); g.ellipse(0, -h * 0.30, w * 0.16, h * 0.10, 0, 0, Math.PI * 2); g.fill();
    if (devil) {
      g.fillStyle = "#2b0f0a";
      g.beginPath(); g.moveTo(-w * 0.14, -h * 0.36); g.lineTo(-w * 0.26, -h * 0.50); g.lineTo(-w * 0.06, -h * 0.39); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(w * 0.14, -h * 0.36); g.lineTo(w * 0.26, -h * 0.50); g.lineTo(w * 0.06, -h * 0.39); g.closePath(); g.fill();
    } else {
      g.fillStyle = "#14171e";
      g.fillRect(-w * 0.22, -h * 0.40, w * 0.44, 6);
      g.fillRect(-w * 0.14, -h * 0.58, w * 0.28, h * 0.19);
      g.fillStyle = "#8a1c1c";
      g.fillRect(-w * 0.14, -h * 0.43, w * 0.28, 5);
    }
    // eyes
    const eyeX = w * 0.085, eyeY = -h * 0.315;
    g.fillStyle = "#2a0604";
    g.beginPath(); g.ellipse(-eyeX, eyeY, 7, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(eyeX, eyeY, 7, 5, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.globalCompositeOperation = "lighter";
    const ep = 0.6 + 0.4 * Math.sin(time * 5);
    for (const ex of [-eyeX, eyeX]) {
      const gr = g.createRadialGradient(ex, eyeY, 0.5, ex, eyeY, devil ? 16 : 12);
      gr.addColorStop(0, `rgba(255,240,220,${ep})`);
      gr.addColorStop(0.3, `rgba(255,60,20,${ep})`);
      gr.addColorStop(1, "rgba(255,20,0,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(ex, eyeY, devil ? 16 : 12, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // monocle over the right eye, chain trailing into the lapel
    if (!devil) {
      g.strokeStyle = "#ffd451";
      g.lineWidth = 2.4;
      g.beginPath(); g.arc(eyeX, eyeY, 11, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "rgba(255,212,81,0.7)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(eyeX + 10, eyeY + 5);
      g.quadraticCurveTo(eyeX + 20, eyeY + 26, eyeX + 8, eyeY + 44);
      g.stroke();
    }

    if (this.hitFlash > 0) {
      // A hit spark centred on him, not a white plate over him.
      g.globalCompositeOperation = "lighter";
      const fg = g.createRadialGradient(0, 0, 4, 0, 0, w * 0.85);
      const a = Math.min(0.8, this.hitFlash * 2.4);
      fg.addColorStop(0, `rgba(255,240,200,${a})`);
      fg.addColorStop(0.55, `rgba(255,150,80,${a * 0.45})`);
      fg.addColorStop(1, "rgba(255,80,30,0)");
      g.fillStyle = fg;
      g.beginPath(); g.arc(0, 0, w * 0.85, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    // fireballs
    for (const q of this.projectiles) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const grd2 = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, q.r * 2);
      grd2.addColorStop(0, "#fff6c0");
      grd2.addColorStop(0.4, "#ff8a20");
      grd2.addColorStop(1, "rgba(255,40,0,0)");
      g.fillStyle = grd2;
      g.beginPath(); g.arc(q.x, q.y, q.r * 2, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
}
