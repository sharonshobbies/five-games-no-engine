// Bird physics + the slide/great-slide state machine.
//
// Model, matching what the original actually rewards:
//  * One input. Holding it multiplies gravity (the original's description: "putting
//    pressure on the screen to fight gravity and bring your bird down sooner than it
//    should"). Releasing restores normal gravity plus a whisper of glide.
//  * Airborne: free body, gravity + light air drag.
//  * Grounded: the bird is constrained to the surface and driven by the along-slope
//    component of gravity, so diving on a downslope is pure acceleration. It leaves
//    the ground when the surface curves away faster than gravity can hold it
//    (v^2*|kappa| > g*cos(theta)) — which is exactly "launch off the crest".
//  * Landing: if the impact speed into the surface is small the bird sticks (a clean
//    slide); if it is large it bounces, and a bounce is what kills a Great Slide
//    ("a Great Slide is when your bird slides down a hill perfectly without bouncing").

import { SEA_LEVEL } from './terrain.js';
import { clamp } from './rng.js';

export const G = 620;              // base gravity (world units / s^2)
export const DIVE_MUL = 4.0;       // gravity multiplier while holding, ON A DOWNSLOPE
// ...and while holding UP a slope. Between the two it blends over the first 0.25 of
// slope. See the long note at the use site: this is what lets a player who just holds the
// button get off the ground at all, without turning holding into the optimal play.
export const DIVE_MUL_CLIMB = 1.6;
// ...and a much smaller one in the AIR. These used to be the same number, and that was
// the second half of why the game did not read as flying. On the ground the ×4 is the
// whole pump: hold down a slope to gain 4·g·h, release on the way up to give back only
// 1·g·h. In the air it does nothing for the pump and everything against the arc — a bird
// holding the button mid-flight fell under 2480 units/s² and was back on the grass in
// 0.27 s. Since the one control the player has is "hold", and the instinct while airborne
// is to keep holding, every arc a new player produced was cancelled by their own input.
// At 2.2 a held arc lasts ~0.4 s instead, and releasing still doubles it — the aim-your-
// landing tap stays useful without being a self-inflicted ground slam.
export const DIVE_MUL_AIR = 2.2;
const AIR_DRAG = 0.044;            // per second, applied to velocity magnitude in air
const AIR_DRAG_DIVE = 0.018;       // tucked = slipperier
const GLIDE_LIFT = 170;            // gentle upward push when falling with wings out
// Friction along the surface. This trio is where the whole skill curve lives: pressing
// down on a DOWNSLOPE tucks the bird and it barely scrubs at all, but pressing down on
// an UPSLOPE drives it into the hill and bleeds speed hard. Diving is therefore not a
// free "fast mode" — it is a choice you have to time against the terrain.
const GROUND_DRAG = 0.46;          // wings out, either direction
const GROUND_DRAG_DIVE = 0.10;     // diving down the slope: slippery
const GROUND_DRAG_PLOW = 1.05;     // diving into the slope: plowing
// Landing. The original is forgiving mid-slide: a bad landing costs momentum and your
// slide chain, but the bird settles into a slide rather than pinballing down the hill.
// So the stick window is wide, and a hard-but-stuck landing pays its cost in SPEED
// rather than in a bounce: above SOFT_LAND the tangential speed is scrubbed, ramping to
// HARD_SCRUB at the very edge of the window.
const STICK_SPEED = 152;           // impact speed into the surface below which we stick
const SOFT_LAND = 56;              // above this, a stick still costs speed
const HARD_SCRUB = 0.45;           // tangential speed lost at the edge of the stick window
const PLANT_SCRUB = 0.42;          // extra loss when the bounce cap forces the stick —
                                   // this is what mistiming a dive costs you now that
                                   // the bird plants instead of pinballing
const LAND_REF = 132;              // impact that scores landing quality 0 — deliberately
                                   // decoupled from STICK_SPEED so widening the stick
                                   // window cannot inflate the perfect-landing kick
const RESTITUTION = 0.15;
const MAX_BOUNCES = 1;             // one bounce, then it plants and plows (no pinball)
// How hard the bird is held onto the surface, beyond gravity. This is the other half of
// the one-button mechanic: pressing down PINS the bird to the hill, so it can ride a
// whole valley at speed without ever leaving the ground; letting go lets it pop off the
// very next crest. Hold through the valley, release on the way up the far side.
const ADHESION_DIVE = 2200;
const ADHESION_GLIDE = 150;
const MAX_SPEED = 1350;
// Water slows you and breaks your slide chain, but it is never a dead end: the bird
// paddles forward so it always reaches the far shore. Night is the only fail state.
const WATER_DRAG = 0.85;
const WATER_BUOY = 1150;
const PADDLE = 150;
// The bird is not a marble: it runs and flaps, so it always has forward drive that
// fades out once real momentum arrives. Scaling it slightly above the *effective*
// gravity guarantees the bird can always crawl up any slope, because the along-slope
// component of gravity is g*sin(theta) and sin(theta) < 1. Without that invariant the
// bird can end up parked in a valley pocket forever, which the original never does.
const WADDLE_K = 1.06;             // multiple of effective gravity available at a standstill
const WADDLE_FADE = 72;            // forward drive is gone by this speed
const MIN_BACK = -170;             // it can roll back down a slope, but only so fast

export const BIRD_R = 6.6;

export class Bird {
  constructor(terrain) {
    this.t = terrain;
    this.reset(terrain.startX());
  }

  reset(x) {
    this.x = x;
    this.y = this.t.height(x) + BIRD_R;
    this.vx = 40;
    this.vy = 0;
    this.grounded = true;
    this.diving = false;
    this.angle = 0;
    this.inWater = false;

    // slide tracking
    this.slide = null;          // { entryX, minSlope, passedValley, clean }
    this.chain = 0;             // consecutive great slides
    this.fever = false;
    this.airTime = 0;
    this.groundTime = 0;
    this.lastLaunchSpeed = 0;
    this.bounces = 0;

    // events drained by the game each frame
    this.events = [];
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  emit(type, data) { this.events.push({ type, ...data }); }

  /**
   * Advance one substep. dt should be small (<= 1/240) for a stable slide.
   */
  step(dt) {
    const t = this.t;

    if (this.grounded) {
      const s = t.slope(this.x);
      // Dive gravity, softened on the way UP. The full ×4 on a downslope is the pump;
      // applying that same ×4 to the climb meant a bird that never let go could not carry
      // speed over a hill AT ALL — it ground to the crawl speed at every crest, and since
      // a launch needs v²·|κ| to beat gravity plus adhesion, it could never leave the
      // ground anywhere. Holding the one button you have and never flying is exactly the
      // complaint this is fixed for.
      //
      // Releasing is still strictly better, and the energy accounting is why: over a
      // valley the releaser gains 4·g·h going down and gives back only 1·g·h climbing,
      // netting +3·g·h, while a holder nets (4 − 1.6)·g·h = +2.4·g·h and pays the plow
      // friction (1.05 vs 0.46) on top. Measured over eight seeds, constant hold reaches
      // 813 m against diving's 2434 m — it got FURTHER from optimal, not closer, because
      // a holder that now launches also now spends time in the air and scrubs speed on
      // every landing. It flies a little and travels less, which is the shape you want.
      const gEff = this.diving
        ? G * (DIVE_MUL + (DIVE_MUL_CLIMB - DIVE_MUL) * clamp(s * 4, 0, 1))
        : G;
      const inv = 1 / Math.sqrt(1 + s * s);          // = cos(theta)
      // signed speed along the tangent, tangent = (1, s) * inv
      let vt = this.vx * inv + this.vy * (s * inv);

      // gravity along the tangent: (0,-g) . (1,s)*inv  =  -g*s*inv
      let at = -gEff * s * inv;

      // friction opposes motion, grows with speed
      let drag = GROUND_DRAG;
      if (this.diving) drag = s < 0 ? GROUND_DRAG_DIVE : GROUND_DRAG_PLOW;
      at -= drag * vt;

      // little legs / wingbeats: forward drive that fades out as real speed arrives
      at += gEff * WADDLE_K * clamp(1 - vt / WADDLE_FADE, 0, 1);

      vt += at * dt;
      vt = clamp(vt, MIN_BACK, MAX_SPEED);

      this.x += vt * inv * dt;
      this.y = t.height(this.x) + BIRD_R;

      const s2 = t.slope(this.x);
      const inv2 = 1 / Math.sqrt(1 + s2 * s2);
      this.vx = vt * inv2;
      this.vy = vt * s2 * inv2;
      this.angle = Math.atan2(s2, 1);
      this.groundTime += dt;
      this.airTime = 0;
      if (this.groundTime > 0.12) this.bounces = 0;

      // --- slide bookkeeping ---
      if (!this.slide && s2 < -0.16) {
        this.slide = { entryX: this.x, entrySpeed: vt, passedValley: false, clean: true, deepest: s2 };
      }
      if (this.slide) {
        if (s2 < this.slide.deepest) this.slide.deepest = s2;
        if (!this.slide.passedValley && s2 > 0.02) this.slide.passedValley = true;
      }

      // --- leave the ground where the hill curves away from under us ---
      const kap = t.kappa(this.x);
      if (kap < 0) {
        const need = vt * vt * (-kap);
        const hold = gEff * inv2 + (this.diving ? ADHESION_DIVE : ADHESION_GLIDE);
        if (need > hold) {
          this.grounded = false;
          this.lastLaunchSpeed = vt;
          this._finishSlide(true);
          this.emit('launch', { speed: vt, x: this.x, y: this.y, slope: s2 });
        }
      }
      return;
    }

    // ---------------- airborne ----------------
    // Note the separate multiplier: holding in the air steepens the descent for aiming a
    // landing, but does not slam the bird down hard enough to erase the arc.
    const gAir = G * (this.diving ? DIVE_MUL_AIR : 1);
    this.vy -= gAir * dt;
    if (!this.diving && this.vy < 0) {
      // tiny wings still catch a little air on the way down
      this.vy += GLIDE_LIFT * dt * clamp(this.speed / 300, 0.25, 1.1);
    }
    const d = this.diving ? AIR_DRAG_DIVE : AIR_DRAG;
    this.vx -= this.vx * d * dt;
    this.vy -= this.vy * d * dt * 0.6;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.airTime += dt;
    this.groundTime = 0;

    // face the direction of travel, nose-down harder while diving
    const want = Math.atan2(this.vy, Math.max(20, this.vx));
    this.angle += (want - this.angle) * Math.min(1, dt * 12);

    // ---------------- water ----------------
    const groundY = t.height(this.x) + BIRD_R;
    const waterY = SEA_LEVEL + BIRD_R * 0.55;
    if (this.y < waterY && t.height(this.x) < SEA_LEVEL - 1) {
      if (!this.inWater) {
        this.inWater = true;
        this.emit('splash', { x: this.x, y: waterY, speed: this.speed });
        this._breakSlide();
      }
      const depth = clamp((waterY - this.y) / (BIRD_R * 3), 0, 1);
      this.vy += WATER_BUOY * depth * dt;
      this.vx -= this.vx * WATER_DRAG * dt * (0.35 + depth);
      this.vy -= this.vy * WATER_DRAG * dt * 0.8;
      this.vx += G * 1.1 * clamp(1 - this.vx / PADDLE, 0, 1) * depth * dt;
      if (this.y < waterY - BIRD_R * 1.6) this.y = waterY - BIRD_R * 1.6;
    } else if (this.inWater) {
      this.inWater = false;
    }

    // ---------------- ground contact ----------------
    if (this.y <= groundY) {
      this.y = groundY;
      const s = t.slope(this.x);
      const inv = 1 / Math.sqrt(1 + s * s);
      const nx = -s * inv, ny = inv;                 // surface normal
      const vn = this.vx * nx + this.vy * ny;        // negative = moving into the surface
      let vt = this.vx * inv + this.vy * (s * inv);

      // A run of bounces would turn a steep upslope into a pinball table, so cap it:
      // after MAX_BOUNCES the bird just plants and plows, which is what mistiming a
      // dive should feel like.
      if (vn > -STICK_SPEED || this.bounces >= MAX_BOUNCES) {
        // Clean landing: stick to the surface and keep the tangential speed. A hard one
        // still sticks, but scrubs speed on the way in — the cost of mistiming a dive is
        // paid in momentum, not in a bounce.
        this.grounded = true;
        const planted = vn <= -STICK_SPEED;   // sticking only because the cap said so
        let scrub = 1 - HARD_SCRUB * clamp((-vn - SOFT_LAND) / (STICK_SPEED - SOFT_LAND), 0, 1);
        if (planted) scrub *= 1 - PLANT_SCRUB;
        vt *= scrub;
        this.vx = vt * inv;
        this.vy = vt * s * inv;
        this.angle = Math.atan2(s, 1);
        const quality = clamp(1 - (-vn) / LAND_REF, 0, 1);
        // A landing whose velocity is already parallel to the slope loses nothing and
        // is rewarded with a small kick — the original's "perfect slide" where you lose
        // no speed and get the maximum air out the far side.
        if (quality > 0.72) {
          const kick = 1 + 0.16 * ((quality - 0.72) / 0.28);
          this.vx *= kick; this.vy *= kick;
        }
        this.emit('land', { x: this.x, y: this.y, speed: Math.abs(vt), impact: -vn, quality, bounce: false });
        // starting a fresh descent right here counts as a slide attempt
        this.slide = s < -0.16
          ? { entryX: this.x, entrySpeed: Math.abs(vt), passedValley: false, clean: true, deepest: s }
          : null;
      } else {
        // bounce — this is what breaks a Great Slide
        const bvn = -vn * RESTITUTION;
        const tvt = vt * 0.82;
        this.vx = tvt * inv + bvn * nx;
        this.vy = tvt * s * inv + bvn * ny;
        this.y = groundY + 0.4;
        this.bounces++;
        this._breakSlide();
        this.emit('land', { x: this.x, y: this.y, speed: Math.abs(vt), impact: -vn, quality: 0, bounce: true });
      }
    }

    if (this.speed > MAX_SPEED) {
      const k = MAX_SPEED / this.speed;
      this.vx *= k; this.vy *= k;
    }
  }

  _finishSlide(launched) {
    const sl = this.slide;
    this.slide = null;
    if (!sl || !sl.clean) return;
    // A great slide: entered a real downslope, rode through the valley floor and up
    // the other side without ever bouncing, and came off the far crest.
    if (sl.passedValley && launched && sl.deepest < -0.30) {
      this.chain++;
      if (this.chain >= 3) this.fever = true;
      this.emit('greatSlide', { x: this.x, y: this.y, chain: this.chain, fever: this.fever });
    }
  }

  _breakSlide() {
    if (this.slide) this.slide.clean = false;
    this.slide = null;
    if (this.chain > 0 || this.fever) {
      const had = this.fever;
      this.chain = 0;
      this.fever = false;
      if (had) this.emit('feverEnd', {});
    }
  }
}
