// Bootstrap: renderer, input, resize, fixed-ish frame loop.

import * as THREE from '../vendor/three.module.min.js';
import { Game } from './game.js';

export async function boot() {
  // Treat colours as plain sRGB values end to end, the way a 2D canvas would, so the
  // hand-picked palettes come out exactly as authored.
  if (THREE.ColorManagement) THREE.ColorManagement.enabled = false;

  const canvas = document.getElementById('glcanvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x0b1020, 1);
  renderer.autoClear = true;

  const game = new Game(renderer);

  function resize() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    game.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ input
  const down = (e) => {
    if (e.cancelable) e.preventDefault();
    game.press();
  };
  const up = (e) => {
    if (e.cancelable) e.preventDefault();
    game.release();
  };

  window.addEventListener('mousedown', down);
  window.addEventListener('mouseup', up);
  window.addEventListener('touchstart', down, { passive: false });
  window.addEventListener('touchend', up, { passive: false });
  window.addEventListener('touchcancel', up, { passive: false });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && e.pointerType !== 'touch') down(e); });

  let keyHeld = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!keyHeld) { keyHeld = true; game.press(); }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter' || e.key === ' ') {
      e.preventDefault();
      keyHeld = false;
      game.release();
    }
  });
  window.addEventListener('blur', () => { keyHeld = false; game.release(); });

  if (new URLSearchParams(location.search).get('autoplay') === '1') game.press();

  // ------------------------------------------------------------ loop
  let last = performance.now();
  let frames = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    game.update(dt);
    game.render();
    if (frames === 1) game.hud.hideLoading();
    frames++;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // expose for debugging / harnesses
  window.__tinywings = game;
  return game;
}
