// All DOM: the in-game readouts, the build panel, and the full-screen menus.
import {
  BUILD_DEFS, optionsFor, maxLevel, PLOT_LABEL, CASTLE_UPS, RESEARCH, researchOption,
} from './buildings.js';
import { ENEMY_DEFS } from './enemies.js';
import { WEAPONS, PERKS, MUTATORS, perkSlots } from './perks.js';
import { LEVELS } from './levels.js';
import { accountLevel } from './save.js';
import { BIOMES } from './palette.js';
import { overworldSvg } from './overworld.js';

const $ = (id) => document.getElementById(id);

const TIPS = [
  'Economy first — but only what you can actually defend.',
  'Walls do not have to be complete. A funnel is often better than a box.',
  'Your king is a real unit. Ride to whichever side is buckling.',
  'Siege engines outrange your walls. Kill them with towers or troops.',
  'Hunterlings hunt you specifically. Racers ignore you entirely.',
  'Hold Left Ctrl by your soldiers and they follow you. Keep holding it and they hold the ground.',
  'Left Alt locks your attack onto one enemy — and Godly Curse reads that lock.',
  'A Blacksmith project runs for nights, not seconds. Start it early or not at all.',
  'A harbour lays one boat a night. A harbour lost overnight lays none.',
  'You only heal to full when you are out of combat for a second.',
  'Sprint only works at full health.',
  'Mills grow. Houses do not. Mines run dry.',
  'Unspent gold at the end is worth 10 score each.',
];

export class Hud {
  constructor(game) {
    this.g = game;
    this.buildPlot = null;
    this.buildStep = 'root';
    this.buildDef = null;
    this.toastT = 0;
    this.tipI = 0;
    $('tips').textContent = TIPS[0];
    this.wire();
  }

  wire() {
    const g = this.g;
    $('playBtn').onclick = () => { g.wakeAudio(); g.show('levels'); };
    $('howBtn').onclick = () => $('howText').classList.toggle('hidden');
    $('muteBtn').onclick = () => {
      g.save.volume = g.save.volume > 0 ? 0 : 0.5;
      g.audio.setVolume(g.save.volume);
      $('muteBtn').textContent = 'Sound: ' + (g.save.volume > 0 ? 'on' : 'off');
      $('volBtn').textContent = $('muteBtn').textContent;
      g.persist();
    };
    $('volBtn').onclick = $('muteBtn').onclick;
    // The score has its own toggle: some players want the effects and none of
    // the music. Both copies of the button drive the same persisted flag.
    const toggleMusic = () => {
      g.save.musicOn = !(g.save.musicOn !== false);
      g.wakeAudio();
      g.music.setEnabled(g.save.musicOn);
      this.syncMusicButtons();
      g.persist();
    };
    $('musicBtn').onclick = toggleMusic;
    $('musicBtn2').onclick = toggleMusic;
    $('backTitle').onclick = () => g.show('title');
    $('backLevels').onclick = () => g.show('levels');
    $('startRun').onclick = () => g.startRun();
    $('startNight').onclick = () => g.beginNight();
    $('menuBtn').onclick = () => g.togglePause();
    $('resumeBtn').onclick = () => g.togglePause();
    $('quitBtn').onclick = () => { g.abandon(); };
    $('resRetry').onclick = () => g.startRun();
    $('resMap').onclick = () => g.show('levels');
    $('ability').onclick = () => { if (g.hero) g.hero.useAbility(); };
  }

  syncMusicButtons() {
    const on = this.g.save.musicOn !== false;
    const label = 'Music: ' + (on ? 'on' : 'off');
    $('musicBtn').textContent = label;
    $('musicBtn2').textContent = label;
  }

  // ------------------------------------------------------------- screens
  showScreen(name) {
    for (const id of ['title', 'levelSel', 'loadoutScr', 'perkPick', 'result', 'pause']) {
      $(id).classList.add('hidden');
    }
    $('hud').classList.add('hidden');
    $('build').classList.add('hidden');
    const map = {
      title: 'title', levels: 'levelSel', loadout: 'loadoutScr',
      trial: 'perkPick', result: 'result', pause: 'pause',
    };
    if (name === 'play') { $('hud').classList.remove('hidden'); return; }
    if (map[name]) $(map[name]).classList.remove('hidden');
    if (name === 'pause') $('hud').classList.remove('hidden');
  }

  /** The overworld: a drawn map of the realm with the holdings joined by roads. */
  renderLevels() {
    const g = this.g;
    const wrap = $('levels');
    wrap.innerHTML = overworldSvg(g.save);
    const info = $('owInfo');

    const describe = (id) => {
      if (id === '__trials') {
        const rec = g.save.cleared.__trials;
        const open = !!g.save.cleared.nordfels;
        return `<div class="owiName">Eternal Trials</div>
          <div class="owiBlurb">${open ? 'A ladder with no top. Each stage is a draft of map, weapon and two perks, and the perks stack for the whole climb.' : 'Hold Nordfels to open the ladder.'}</div>
          <div class="owiRow">${rec ? 'Best run ' + rec.best.toLocaleString() : 'Untried'}</div>`;
      }
      const L = LEVELS.find((x) => x.id === id);
      if (!L) return '';
      const unlocked = !L.unlockedBy || !!g.save.cleared[L.unlockedBy];
      const rec = g.save.cleared[L.id];
      const prev = LEVELS.find((x) => x.id === L.unlockedBy);
      const wp = L.unlocksWeapon && WEAPONS[L.unlocksWeapon];
      return `<div class="owiName">${L.name}</div>
        <div class="owiBiome">${L.biome} · ${L.nights} nights · ${L.spawnAngles.length} approaches${(L.flyOnly || []).length ? ` (${L.flyOnly.length} airborne)` : ''}</div>
        <div class="owiBlurb">${unlocked ? L.blurb : `Hold ${prev ? prev.name : 'the previous holding'} first.`}</div>
        <div class="owiRow">${(L.features || []).join(' · ')}</div>
        ${wp ? `<div class="owiRow gold">Clearing it unlocks ${wp.name}</div>` : ''}
        <div class="owiRow ${rec ? 'gold' : ''}">${rec ? 'Best ' + rec.best.toLocaleString() : 'Not yet held'}</div>`;
    };

    let pinned = null;
    for (const L of LEVELS) {
      const unlocked = !L.unlockedBy || !!g.save.cleared[L.unlockedBy];
      if (unlocked && !g.save.cleared[L.id] && !pinned) pinned = L.id;
    }
    if (!pinned) pinned = LEVELS[LEVELS.length - 1].id;
    info.innerHTML = describe(pinned);

    for (const el of wrap.querySelectorAll('.owNode')) {
      const id = el.getAttribute('data-id');
      const locked = el.classList.contains('locked');
      const show = () => { info.innerHTML = describe(id); };
      el.addEventListener('mouseenter', show);
      el.addEventListener('focus', show);
      el.addEventListener('mouseleave', () => { info.innerHTML = describe(pinned); });
      if (locked) continue;
      const enter = () => {
        g.audio.play('click');
        if (id === '__trials') g.startTrials(); else g.pickLevel(id);
      };
      el.addEventListener('click', enter);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });
    }

    const acc = accountLevel(g.save.xp);
    $('xpFill').style.width = (acc.into / acc.need * 100) + '%';
    $('xpText').textContent = `Level ${acc.level} · ${perkSlots(acc.level)} perk slot${perkSlots(acc.level) > 1 ? 's' : ''} · ${Math.round(acc.into)}/${acc.need} XP`;
  }

  renderLoadout() {
    const g = this.g;
    const acc = accountLevel(g.save.xp);
    const slots = perkSlots(acc.level);
    $('loadTag').textContent = g.pendingLevel ? g.pendingLevel.name : '';
    // weapons
    const wl = $('weaponList');
    wl.innerHTML = '';
    for (const id in WEAPONS) {
      const w = WEAPONS[id];
      const byMap = !w.unlock || !!g.save.cleared[w.unlock];
      const byLvl = !w.lvl || acc.level >= w.lvl;
      const owned = byMap && byLvl;
      const gate = !byMap
        ? 'Hold ' + ((LEVELS.find((x) => x.id === w.unlock) || {}).name || 'the next holding') + ' to unlock'
        : 'Unlocks at level ' + w.lvl;
      const b = document.createElement('button');
      b.className = 'pick' + (g.save.weapon === id ? ' on' : '') + (owned ? '' : ' lock');
      b.innerHTML = `<div class="bicon">${owned ? w.icon : '🔒'}</div><div class="bmain">
        <div class="pn">${w.name}</div><div class="pd">${owned ? w.desc : gate}</div>
        ${owned ? `<div class="pd" style="margin-top:3px"><b>${w.ability.name}</b> — ${w.ability.desc}</div>` : ''}</div>`;
      if (owned) b.onclick = () => { g.save.weapon = id; g.persist(); this.renderLoadout(); g.audio.play('click'); };
      wl.appendChild(b);
    }
    // perks
    const pl = $('perkList');
    pl.innerHTML = '';
    $('perkCount').textContent = `${g.save.perks.length}/${slots}`;
    const sorted = PERKS.slice().sort((a, b) => a.lvl - b.lvl);
    for (const p of sorted) {
      const owned = p.lvl <= acc.level;
      const on = g.save.perks.indexOf(p.id) >= 0;
      const b = document.createElement('button');
      b.className = 'pick' + (on ? ' on' : '') + (owned ? '' : ' lock');
      b.innerHTML = `<div class="bicon">${owned ? p.icon : '🔒'}</div><div class="bmain">
        <div class="pn">${p.name}</div><div class="pd">${owned ? p.desc : 'Unlocks at level ' + p.lvl}</div></div>`;
      if (owned) b.onclick = () => {
        const i = g.save.perks.indexOf(p.id);
        if (i >= 0) g.save.perks.splice(i, 1);
        else if (g.save.perks.length < slots) g.save.perks.push(p.id);
        else { this.toast(`Only ${slots} perk slot${slots > 1 ? 's' : ''} at level ${acc.level}`); return; }
        g.persist(); this.renderLoadout(); g.audio.play('click');
      };
      pl.appendChild(b);
    }
    // mutators
    const ml = $('mutList');
    ml.innerHTML = '';
    for (const mu of MUTATORS) {
      const on = g.save.mutators.indexOf(mu.id) >= 0;
      const b = document.createElement('button');
      b.className = 'pick' + (on ? ' on' : '');
      const sign = mu.score >= 0 ? '+' : '';
      b.innerHTML = `<div class="bicon">${mu.icon}</div><div class="bmain">
        <div class="pn">${mu.name} <span style="color:#8a6412">${sign}${Math.round(mu.score * 100)}%</span></div>
        <div class="pd">${mu.desc}</div></div>`;
      b.onclick = () => {
        const i = g.save.mutators.indexOf(mu.id);
        if (i >= 0) g.save.mutators.splice(i, 1); else g.save.mutators.push(mu.id);
        g.persist(); this.renderLoadout(); g.audio.play('click');
      };
      ml.appendChild(b);
    }
    let mul = 1;
    for (const id of g.save.mutators) {
      const mu = MUTATORS.find((x) => x.id === id);
      if (mu) mul *= (1 + mu.score);
    }
    $('scorePreview').textContent = `Score multiplier ×${mul.toFixed(2)}`;
  }

  renderTrialPick(options, stage) {
    $('perkPickTitle').textContent = `Stage ${stage} — choose your next trial`;
    const wrap = $('perkCards');
    wrap.innerHTML = '';
    for (const o of options) {
      const b = document.createElement('button');
      b.className = 'pcard';
      b.innerHTML = `<div class="pi">${o.weapon.icon}</div>
        <div class="pt">${o.level.name}</div>
        <div class="pb"><b>${o.weapon.name}</b><br>${o.level.nights} nights · ${o.level.spawnAngles.length} approaches</div>
        <div class="pb" style="margin-top:8px;border-top:1px dashed #c9b48d;padding-top:6px">
          ${o.perks.map((p) => `<b>${p.icon} ${p.name}</b><br><span style="font-size:11px">${p.desc}</span>`).join('<br>')}
        </div>`;
      b.onclick = () => { this.g.audio.play('click'); this.g.chooseTrial(o); };
      wrap.appendChild(b);
    }
  }

  renderResult(won, w, xpGain, extra) {
    $('resTag').textContent = won ? 'Victory' : 'Defeat';
    $('resTitle').textContent = won ? 'The realm holds' : 'The keep has fallen';
    const acc = accountLevel(this.g.save.xp);
    $('resBody').innerHTML = won
      ? `You held ${w.level.cfg.name} for all ${w.level.cfg.nights} nights.<br>
         <b>${w.kills}</b> enemies killed · <b>${w.gold}</b> gold unspent · score <b>${w.finalScore().toLocaleString()}</b>
         ${extra || ''}`
      : `${w.level.cfg.name} fell on night <b>${w.night}</b> of ${w.level.cfg.nights}.<br>
         <b>${w.kills}</b> enemies killed · score <b>${w.finalScore().toLocaleString()}</b>
         ${extra || ''}`;
    $('resXpText').textContent = `+${Math.round(xpGain)} XP · Level ${acc.level}`;
    setTimeout(() => { $('resXpFill').style.width = (acc.into / acc.need * 100) + '%'; }, 60);
  }

  // ---------------------------------------------------------- in-game HUD
  update(w, hero, dt) {
    $('goldVal').textContent = w.gold;
    $('scoreVal').textContent = Math.round(w.baseScore + w.gold * 10).toLocaleString();
    const cfg = w.level.cfg;
    if (w.phase === 'night') {
      $('phaseTitle').textContent = `Night ${w.night} / ${cfg.nights}`;
      const left = w.spawnQueue.length + w.enemyCount;
      $('phaseSub').textContent = `${left} enemies remain`;
      $('waveWrap').classList.remove('hidden');
      const total = Math.max(1, w.totalToSpawn);
      $('waveBar').style.width = Math.min(100, (1 - w.spawnQueue.length / total) * 100) + '%';
      $('startWrap').classList.add('hidden');
    } else {
      $('phaseTitle').textContent = `Day ${w.night + 1} / ${cfg.nights}`;
      $('phaseSub').textContent = 'Build. No hurry.';
      $('waveWrap').classList.add('hidden');
      $('startWrap').classList.remove('hidden');
    }
    // hero
    const frac = hero.maxHp ? hero.hp / hero.maxHp : 0;
    $('hpFill').style.width = (frac * 100) + '%';
    $('hpFill').className = frac < 0.35 ? 'low' : '';
    $('hpNum').textContent = `${Math.ceil(hero.hp)}/${Math.round(hero.maxHp)}`;
    let label = 'THE KING';
    if (hero.sprinting) label = 'THE KING — SPRINT';
    else if (hero.invulnT > 0) label = 'THE KING — UNBREAKABLE';
    else if (hero.commanding) {
      label = `${hero.holdX != null ? 'HOLDING' : 'COMMANDING'} ${hero.commandCount()}`;
      if (hero.cmdFilter && hero.cmdFilter !== 'all') label += ` · ${hero.filterName().toUpperCase()}`;
    }
    $('heroName').textContent = label;
    $('abilityIcon').textContent = hero.weapon.icon;
    const cdFrac = hero.abilityCd > 0
      ? hero.abilityCd / (hero.weapon.ability.cd * w.mods.abilityCd) : 0;
    $('abilityCd').style.transform = `scaleY(${Math.max(0, Math.min(1, cdFrac))})`;
    $('ability').title = `${hero.weapon.ability.name} — ${hero.weapon.ability.desc}`;
    // damage vignette
    $('vignette').style.opacity = hero.down ? 0.9 : Math.max(hero.dmgFlash * 3, frac < 0.3 ? 0.45 : 0);
    $('downMsg').style.opacity = hero.down ? 1 : 0;
    if (hero.down) $('downMsg').querySelector('.s').textContent = `Reviving in ${Math.ceil(hero.reviveT)}s`;
    // boss
    const boss = w.bossState();
    if (boss) {
      $('bossBar').style.opacity = 1;
      $('bossName').textContent = boss.def.name;
      $('bossFill').style.width = (boss.hp / boss.maxHp * 100) + '%';
    } else $('bossBar').style.opacity = 0;
    // toast
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) $('toast').style.opacity = 0;
    }
  }

  showMutTags(ids) {
    const wrap = $('mutTags');
    wrap.innerHTML = '';
    for (const id of ids) {
      const mu = MUTATORS.find((x) => x.id === id);
      if (!mu) continue;
      const d = document.createElement('div');
      d.className = 'mtag';
      d.textContent = mu.icon + ' ' + mu.name.replace('Challenge the ', '');
      wrap.appendChild(d);
    }
  }

  toast(msg, secs) {
    $('toast').textContent = msg;
    $('toast').style.opacity = 1;
    this.toastT = secs || 2.4;
  }

  goldDelta(income, loot) {
    const el = $('goldDelta');
    el.textContent = `+${income}${loot ? ' +' + loot + ' loot' : ''}`;
    el.style.opacity = 1;
    el.style.transform = 'translateY(0)';
    setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translateY(-16px)'; }, 1500);
  }

  nextTip() {
    this.tipI = (this.tipI + 1) % TIPS.length;
    $('tips').textContent = TIPS[this.tipI];
  }

  /**
   * Telegraph the coming night, the way the original does before you commit —
   * including how many of each kind arrive as elites, which is decided when the
   * wave is composed rather than at spawn time so this list can be honest.
   */
  showWavePreview(wave) {
    let elites = 0;
    const parts = wave.map((g) => {
      const d = ENEMY_DEFS[g.kind];
      const e = g.elite || 0;
      if (e) elites += e;
      const boss = d.boss ? ' <span class="wBoss">boss</span>' : '';
      return `${d.name} ×${g.n}${e ? ` <span class="wElite">★${e} elite</span>` : ''}${boss}`;
    });
    $('tips').innerHTML = '<b>Tonight</b><br>' + parts.slice(0, 9).join('<br>')
      + (parts.length > 9 ? `<br>+${parts.length - 9} more` : '')
      + (elites ? `<br><span class="wElite">★ ${elites} elite in all — 4× health, 3× damage</span>` : '');
  }

  // -------------------------------------------------------- build panel
  openBuild(plot, screenX, screenY) {
    this.buildPlot = plot;
    this.buildStep = 'root';
    this.buildDef = null;
    this.panelAt(screenX, screenY);
    this.renderBuild();
  }
  closeBuild() {
    this.buildPlot = null;
    $('build').classList.add('hidden');
  }
  panelAt(x, y) {
    const el = $('build');
    el.classList.remove('hidden');
    const w = 300, h = el.offsetHeight || 200;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
    el.style.top = Math.max(8, Math.min(innerHeight - h - 8, y + 18)) + 'px';
  }

  renderBuild() {
    const plot = this.buildPlot;
    if (!plot) return;
    const g = this.g, w = g.world;
    const wrap = $('buildOpts');
    wrap.innerHTML = '';
    $('buildStats').textContent = '';

    // ---- the keep
    if (plot === w.castle) {
      $('buildTitle').textContent = 'Castle Center';
      $('buildKind').textContent = `Level ${w.castle.level}`;
      const step = w.castleUpgradeStep();
      $('buildStats').innerHTML =
        `Health ${Math.ceil(w.castle.hp)}/${Math.round(w.castle.maxHp)} · the run ends if it falls.`;
      if (!step) {
        wrap.innerHTML = '<div class="bdesc">Fully upgraded.</div>';
        return;
      }
      const cost = Math.max(1, step.cost - w.mods.upgradeDiscount);
      for (const o of step.options) {
        wrap.appendChild(this.optRow(o.icon, o.name, o.desc, cost, w.gold >= cost, () => {
          if (w.upgradeCastle(o.id)) { g.hero.refresh(); this.renderBuild(); }
        }));
      }
      return;
    }

    $('buildTitle').textContent = plot.building ? plot.building.stats.name : 'Empty plot';
    $('buildKind').textContent = PLOT_LABEL[plot.kind] || plot.kind;

    // ---- variant choice step
    if (this.buildStep === 'variant' && this.buildDef) {
      const def = this.buildDef;
      $('buildTitle').textContent = def.name;
      $('buildKind').textContent = 'Choose its speciality';
      for (const v of def.variants) {
        wrap.appendChild(this.optRow(v.icon || def.icon, v.name, v.desc, w.buildCost(def), true, () => {
          if (w.place(plot, def.id, v.id)) { this.buildStep = 'root'; this.renderBuild(); }
        }));
      }
      const back = document.createElement('button');
      back.className = 'btn small';
      back.textContent = '← Back';
      back.onclick = () => { this.buildStep = 'root'; this.renderBuild(); };
      wrap.appendChild(back);
      return;
    }

    // ---- empty plot: what can go here
    if (!plot.building) {
      if (plot.rebuildDelay > 0) {
        wrap.innerHTML = '<div class="bdesc">The rubble has not been cleared. Available tomorrow.</div>';
        return;
      }
      const opts = optionsFor(plot.kind);
      if (!opts.length) { wrap.innerHTML = '<div class="bdesc">Nothing can be built here.</div>'; return; }
      for (const def of opts) {
        const cost = w.buildCost(def);
        let why = null;
        if (w.blockedByMutator(def)) why = 'A pact forbids it';
        else if (!w.defAvailable(def)) why = w.unavailableReason(def);
        const ok = !why && w.gold >= cost;
        wrap.appendChild(this.optRow(def.icon, def.name, why || def.desc, cost, ok, () => {
          if (def.variants && def.variants.length > 1) {
            this.buildStep = 'variant'; this.buildDef = def; this.renderBuild();
          } else if (w.place(plot, def.id, null)) this.renderBuild();
        }, why));
      }
      return;
    }

    // ---- built: show stats and the next level
    const b = plot.building;
    const s = b.stats;
    const bits = [`Health ${Math.ceil(b.hp)}/${Math.round(b.maxHp)}`];
    if (s.variantName) bits.push(s.variantName);
    if (w.buildingIncome(b) > 0) bits.push(`${w.buildingIncome(b)} gold each morning`);
    if (s.atk) bits.push(`${s.atk.dmg.toFixed(1)} damage · ${s.atk.rate.toFixed(2)}/s · range ${Math.round(s.atk.range)}`);
    if (s.heal) bits.push(`heals ${s.heal.amount} · range ${Math.round(s.heal.range)}`);
    if (s.squad) bits.push(`${s.squad.n} × ${s.squad.kind}`);
    if (s.thorns) bits.push(`${s.thorns} damage to attackers`);
    if (s.boom) bits.push(`explodes for ${s.boom.dmg}`);
    if (s.needEnergy) bits.push(`energy ${Math.floor(b.energy)}/${s.needEnergy}`);
    if (s.boat) bits.push(`${b.boats}/${s.boatCap} boats · ${s.boat} gold a boat`);
    $('buildStats').innerHTML = bits.join(' · ');

    // ---- research: the running projects, then any free slot's choice of four
    if (s.research) {
      const table = RESEARCH[s.research];
      const cap = w.researchCapacity(b);
      if (b.projects.length) {
        const rows = b.projects.map((r) => {
          const o = researchOption(s.research, r.id);
          if (!o) return '';
          return r.done
            ? `<div class="rline done">${o.icon} ${o.name} — <b>done</b></div>`
            : `<div class="rline">${o.icon} ${o.name} — ${r.left} night${r.left > 1 ? 's' : ''} left
                 <span class="rbar"><i style="width:${Math.round((1 - r.left / r.total) * 100)}%"></i></span></div>`;
        }).join('');
        const d = document.createElement('div');
        d.className = 'rlist';
        d.innerHTML = rows;
        wrap.appendChild(d);
      }
      if (b.projects.length < cap) {
        const h = document.createElement('div');
        h.className = 'bdesc';
        h.style.margin = '2px 0 6px';
        h.innerHTML = `<b>${table.title}</b> — pick one. It runs while you fight.`;
        wrap.appendChild(h);
        for (const o of table.options) {
          const nights = Math.max(1, o.nights - (w.mods.fasterResearch ? 1 : 0));
          wrap.appendChild(this.optRow(o.icon, o.name,
            `${o.desc} Takes ${nights} night${nights > 1 ? 's' : ''}.`, 0, true, () => {
              if (w.startResearch(plot, o.id)) this.renderBuild();
            }));
        }
      }
    }

    const opts = w.levelUpOptions(plot);
    if (!opts.length) {
      wrap.innerHTML = `<div class="bdesc">Level ${b.level} — fully upgraded.</div>`;
      return;
    }
    for (const o of opts) {
      const cost = w.levelUpCost(plot, o.id);
      wrap.appendChild(this.optRow('⬆️', o.name, o.desc || `Level ${b.level + 1}`, cost, w.gold >= cost, () => {
        if (w.levelUp(plot, o.id)) this.renderBuild();
      }));
    }
  }

  optRow(icon, name, desc, cost, affordable, onClick, why) {
    const b = document.createElement('button');
    b.className = 'bopt';
    b.disabled = !affordable;
    b.innerHTML = `<div class="bicon">${icon || '▫️'}</div><div class="bmain">
      <div class="bname"><span>${name}</span><span class="bcost${affordable ? '' : ' no'}">${why ? '—' : cost + '🪙'}</span></div>
      <div class="bdesc">${desc}</div></div>`;
    if (affordable) b.onclick = onClick;
    return b;
  }
}
