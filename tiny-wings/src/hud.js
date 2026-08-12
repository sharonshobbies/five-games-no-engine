// DOM overlay: readouts, meters, floating score popups, island banner, title/summary.

import { drawLogo } from './textures.js';
import { clamp } from './rng.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'),
      dist: $('vDist'), score: $('vScore'), island: $('vIsland'),
      meter: $('meterFill'), dots: [$('d0'), $('d1'), $('d2')], fever: $('feverTag'),
      night: $('nightFill'),
      pops: $('pops'),
      banner: $('banner'), bnTop: $('bnTop'), bnName: $('bnName'), bnBonus: $('bnBonus'),
      scTitle: $('scTitle'), scEnd: $('scEnd'),
      endWhy: $('endWhy'), endDist: $('endDist'), endScore: $('endScore'),
      endIsl: $('endIsl'), endSlides: $('endSlides'), endPick: $('endPick'),
      endSpeed: $('endSpeed'), endBest: $('endBest'), endNest: $('endNest'),
      newbest: $('newbest'),
      titleNest: $('titleNest'), titleBest: $('titleBest'),
      rush: $('rush'),
      pillDay: $('pillDay'), pillNight: $('pillNight'), pillRace: $('pillRace'),
      raceHow: $('raceHow'),
      raceWrap: $('raceWrap'), raceTrack: $('raceTrack'),
      racePlace: $('racePlace'), raceGap: $('raceGap'),
      endRaceBox: $('endRaceBox'), rowIsl: $('rowIsl'),
      nightWrap: $('nightWrap'),
      muteBtn: $('muteBtn'),
      loading: $('loading'),
    };
    this.onMode = null;
    this.onMute = null;
    this.mode = 'day';
    const pills = [[this.el.pillDay, 'day'], [this.el.pillNight, 'night'], [this.el.pillRace, 'race']];
    const pick = (mode) => (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      this.mode = mode;
      for (const [el, m] of pills) el.classList.toggle('sel', m === mode);
      this.el.raceHow.style.display = mode === 'race' ? '' : 'none';
      if (this.onMode) this.onMode(mode);
    };
    for (const [el, mode] of pills) {
      el.addEventListener('mousedown', pick(mode));
      el.addEventListener('touchstart', pick(mode), { passive: false });
    }

    // Music mute. stopPropagation matters: the dive input is a window-level listener, so
    // without it every press of this button would also launch the bird.
    const toggleMute = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (this.onMute) this.onMute();
    };
    if (this.el.muteBtn) {
      this.el.muteBtn.addEventListener('mousedown', toggleMute);
      this.el.muteBtn.addEventListener('touchstart', toggleMute, { passive: false });
      this.el.muteBtn.addEventListener('keydown', (ev) => {
        if (ev.code === 'Enter' || ev.code === 'Space') toggleMute(ev);
      });
    }

    /** Reflect the persisted preference on the button. */
    this.setMuted = (m) => {
      if (this.el.muteBtn) this.el.muteBtn.classList.toggle('off', !!m);
    };

    // The race ribbon's markers, built once: three rivals then the player.
    this.raceDots = [];
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div');
      d.className = 'rdot' + (i === 3 ? ' me' : '');
      d.style.left = '0%';
      // stagger the rivals a few pixels apart vertically so two on the same stretch of
      // course are both still countable
      if (i < 3) d.style.top = `calc(50% + ${(i - 1) * 4}px)`;
      this.el.raceTrack.appendChild(d);
      this.raceDots.push(d);
    }

    drawLogo($('logo'));
    this._shownScore = 0;
    this._lastDist = -1;
  }

  hideLoading() { if (this.el.loading) this.el.loading.remove(); }

  showTitle(progress) {
    this.el.scTitle.classList.add('on');
    this.el.scEnd.classList.remove('on');
    this.el.hud.classList.remove('on');
    const m = progress.currentMission;
    this.el.titleNest.innerHTML =
      `Nest <b>${progress.data.nest}</b> &middot; score multiplier <b>&times;${progress.multiplier}</b>` +
      (m ? `<br>Next nest: ${m.text}` : '<br>Every nest earned.');
    this.el.titleBest.innerHTML = progress.data.bestDist > 0
      ? `Best <b>${progress.data.bestDist} m</b> &middot; <b>${progress.data.bestScore}</b> pts`
      : '';
  }

  startRun(race = false) {
    this.el.scTitle.classList.remove('on');
    this.el.scEnd.classList.remove('on');
    this.el.hud.classList.add('on');
    this.el.newbest.classList.remove('on');
    this._shownScore = 0;
    this._lastDist = -1;
    this.el.pops.textContent = '';
    // A race has no night chase, so the night bar's place on screen is the race ribbon's.
    this.el.raceWrap.classList.toggle('on', race);
    this.el.nightWrap.style.display = race ? 'none' : '';
    this.el.endRaceBox.classList.remove('on');
  }

  /** Paint the ribbon: `rows` is Race.standings(), already placed. */
  raceUpdate(rows) {
    const rivals = rows.filter((r) => !r.you);
    const me = rows.find((r) => r.you);
    for (let i = 0; i < 3; i++) {
      const d = this.raceDots[i];
      const r = rivals[i];
      if (!r) { d.style.display = 'none'; continue; }
      d.style.display = '';
      d.style.left = `${clamp(r.progress, 0, 1) * 100}%`;
      d.style.background = `rgb(${r.tint.map((c) => Math.round(c * 235)).join(',')})`;
    }
    this.raceDots[3].style.left = `${clamp(me.progress, 0, 1) * 100}%`;

    const ORD = ['1st', '2nd', '3rd', '4th'];
    this.el.racePlace.textContent = ORD[clamp(me.place - 1, 0, 3)];
    // gap to the bird immediately ahead, or to the one behind while leading
    const idx = rows.indexOf(me);
    if (idx > 0) {
      const ahead = rows[idx - 1];
      this.el.raceGap.textContent = `${Math.round(ahead.metres - me.metres)} m behind ${ahead.name}`;
    } else if (rows.length > 1) {
      this.el.raceGap.textContent = `${Math.round(me.metres - rows[1].metres)} m clear`;
    } else {
      this.el.raceGap.textContent = '';
    }
  }

  /** Summary card for a finished race: the placement table instead of the distance. */
  showRaceEnd(run, rows, courseM) {
    this.el.hud.classList.remove('on');
    this.el.scEnd.classList.add('on');
    this.el.raceWrap.classList.remove('on');
    const me = rows.find((r) => r.you);
    const ORD = ['1st', '2nd', '3rd', '4th'];
    this.el.endWhy.textContent = me.place === 1 ? 'You won the race' : `${courseM} m race`;
    this.el.endDist.textContent = ORD[clamp(me.place - 1, 0, 3)];
    this.el.newbest.classList.toggle('on', me.place === 1);
    this.el.newbest.textContent = me.place === 1 ? 'FIRST PLACE!' : '';

    this.el.endRaceBox.classList.add('on');
    this.el.endRaceBox.textContent = '';
    for (const r of rows) {
      const div = document.createElement('div');
      div.className = 'rrow' + (r.you ? ' you' : '');
      const sw = `rgb(${r.tint.map((c) => Math.round(c * 235)).join(',')})`;
      const time = r.time !== null
        ? `${r.time.toFixed(1)}s`
        : `${Math.round(courseM - r.metres)} m to go`;
      div.innerHTML =
        `<span class="pl">${ORD[clamp(r.place - 1, 0, 3)]}</span>` +
        `<span class="sw" style="background:${sw}"></span>` +
        `<span class="nm">${r.name}</span><span class="tm">${time}</span>`;
      this.el.endRaceBox.appendChild(div);
    }

    this.el.rowIsl.style.display = 'none';
    this.el.endScore.textContent = run.score.toLocaleString();
    this.el.endSlides.textContent = run.slides;
    this.el.endPick.textContent = `${run.coins} / ${run.clouds}`;
    this.el.endSpeed.textContent = `${Math.round(run.topSpeed / 10 * 3.6 * 10) / 10} km/h`;
    this._bestLabel('Your time');
    this.el.endBest.textContent = me.time !== null ? `${me.time.toFixed(1)}s` : '—';
    this.el.endNest.innerHTML = 'A race leaves your nest and your best distance alone.';
  }

  /** The last summary row is "Best distance" on a trip and "Your time" in a race. */
  _bestLabel(text) {
    const k = this.el.endBest.parentElement.querySelector('.k');
    if (k) k.textContent = text;
  }

  showEnd(run, progress, res) {
    this.el.hud.classList.remove('on');
    this.el.scEnd.classList.add('on');
    this.el.endRaceBox.classList.remove('on');
    this.el.rowIsl.style.display = '';
    this.el.newbest.textContent = 'NEW BEST!';
    this._bestLabel('Best distance');
    this.el.endWhy.textContent = 'The sun has set';
    this.el.endDist.textContent = `${Math.floor(run.distance)} m`;
    this.el.endScore.textContent = run.score.toLocaleString();
    this.el.endIsl.textContent = run.islands;
    this.el.endSlides.textContent = run.slides;
    this.el.endPick.textContent = `${run.coins} / ${run.clouds}`;
    this.el.endSpeed.textContent = `${Math.round(run.topSpeed / 10 * 3.6 * 10) / 10} km/h`;
    this.el.endBest.textContent = `${progress.data.bestDist} m`;
    if (res.newBestDist || res.newBestScore) this.el.newbest.classList.add('on');
    const m = progress.currentMission;
    let s = `Nest <b>${progress.data.nest}</b> &middot; multiplier <b>&times;${progress.multiplier}</b>`;
    if (res.upgraded.length) s = `NEST UPGRADED! ` + s;
    if (m) s += `<br>Next nest: ${m.text}`;
    this.el.endNest.innerHTML = s;
  }

  update(run, bird, nightFrac) {
    const d = Math.floor(run.distance);
    if (d !== this._lastDist) { this.el.dist.textContent = d; this._lastDist = d; }

    // score counts up so it feels alive
    if (this._shownScore !== run.score) {
      const diff = run.score - this._shownScore;
      this._shownScore += Math.max(1, Math.ceil(Math.abs(diff) * 0.28)) * Math.sign(diff);
      if (Math.abs(run.score - this._shownScore) < 2) this._shownScore = run.score;
      this.el.score.textContent = this._shownScore.toLocaleString();
    }
    this.el.island.textContent = run.islands;

    this.el.meter.style.width = `${clamp(bird.speed / 1100, 0, 1) * 100}%`;
    for (let i = 0; i < 3; i++) {
      this.el.dots[i].classList.toggle('lit', bird.chain > i);
    }
    this.el.fever.classList.toggle('on', bird.fever);
    this.el.night.style.width = `${clamp(nightFrac, 0, 1) * 100}%`;
  }

  /** Speed tunnel intensity, 0..1, plus the warm fever tint. */
  rush(amount, fever) {
    this.el.rush.style.opacity = clamp(amount, 0, 1).toFixed(3);
    this.el.rush.classList.toggle('fev', fever);
  }

  pop(text, cls = '', xFrac = 0.5, yFrac = 0.5) {
    const d = document.createElement('div');
    d.className = `pop ${cls}`;
    d.textContent = text;
    d.style.left = `${clamp(xFrac, 0.12, 0.88) * 100}%`;
    d.style.top = `${clamp(yFrac, 0.12, 0.82) * 100}%`;
    this.el.pops.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  /** `top` overrides the small line above the name (a race is not an island arrival). */
  banner(num, name, bonusText, top = null) {
    this.el.bnTop.textContent = top !== null ? top : `ISLAND ${num}`;
    this.el.bnName.textContent = name;
    this.el.bnBonus.textContent = bonusText || '';
    const b = this.el.banner;
    b.classList.remove('show');
    // force a reflow so the animation restarts
    void b.offsetWidth;
    b.classList.add('show');
  }
}
