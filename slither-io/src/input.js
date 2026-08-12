// Player input -> steering intent.
//
// The original steers by pointing: the head turns toward the cursor's world
// position at its own limited rate, and never snaps. Boost is any of left
// mouse, right mouse, space or arrow-up, matching the original's bindings.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mx = window.innerWidth / 2;
    this.my = window.innerHeight / 2 - 100;
    this.mouseDown = false;
    this.keyBoost = false;
    this.hasPointer = false;
    this.intent = { angle: 0, boost: false };

    const move = (e) => {
      this.mx = e.clientX;
      this.my = e.clientY;
      this.hasPointer = true;
    };
    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length) {
        this.mx = e.touches[0].clientX;
        this.my = e.touches[0].clientY;
        this.hasPointer = true;
      }
    }, { passive: true });

    window.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      if (e.button === 2) e.preventDefault();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('touchstart', (e) => {
      this.mouseDown = true;
      if (e.touches.length) {
        this.mx = e.touches[0].clientX;
        this.my = e.touches[0].clientY;
        this.hasPointer = true;
      }
    }, { passive: true });
    window.addEventListener('touchend', () => { this.mouseDown = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => {
      this.mouseDown = false;
      this.keyBoost = false;
    });

    const isBoostKey = (k) => k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W';
    window.addEventListener('keydown', (e) => {
      if (isBoostKey(e.key)) {
        this.keyBoost = true;
        if (e.key === ' ' || e.key === 'ArrowUp') e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (isBoostKey(e.key)) this.keyBoost = false;
    });
  }

  /**
   * @param {number} cx camera centre world x
   * @param {number} cy camera centre world y
   * @param {number} pxPerUnit
   * @param {number} w viewport css width
   * @param {number} h viewport css height
   * @param {Snake} snake
   */
  read(cx, cy, pxPerUnit, w, h, snake) {
    // Screen -> world. Screen y is down, world y is up.
    const wx = cx + (this.mx - w / 2) / pxPerUnit;
    const wy = cy - (this.my - h / 2) / pxPerUnit;
    const dx = wx - snake.x;
    const dy = wy - snake.y;
    // A cursor sitting on the head would produce a garbage heading; hold.
    if (dx * dx + dy * dy > 4) this.intent.angle = Math.atan2(dy, dx);
    else this.intent.angle = snake.angle;
    this.intent.boost = this.mouseDown || this.keyBoost;
    return this.intent;
  }
}
