// Persistent progression: best distance/score, plus the "nest" the original upgrades
// through missions. Nest level sets the score multiplier — 10x at nest 1, +2 per nest.

const KEY = 'tinywings.save.v1';

export const MISSIONS = [
  { id: 'i2', text: 'Reach island 2', test: (r) => r.islands >= 2 },
  { id: 'gs5', text: 'Make 5 Great Slides in one trip', test: (r) => r.slides >= 5 },
  { id: 'i4', text: 'Reach island 4', test: (r) => r.islands >= 4 },
  { id: 'fev', text: 'Start Fever mode twice in one trip', test: (r) => r.fevers >= 2 },
  { id: 'c30', text: 'Collect 30 coins in one trip', test: (r) => r.coins >= 30 },
  { id: 'i6', text: 'Reach island 6', test: (r) => r.islands >= 6 },
  { id: 'cl6', text: 'Touch 6 clouds in one trip', test: (r) => r.clouds >= 6 },
  { id: 'd2500', text: 'Fly 2500 m in one trip', test: (r) => r.distance >= 2500 },
];

const DEFAULT = { bestDist: 0, bestScore: 0, nest: 1, done: [], plays: 0 };

export class Progress {
  constructor() {
    this.data = { ...DEFAULT };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* private mode — run without persistence */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
  }

  get multiplier() { return 10 + (this.data.nest - 1) * 2; }

  /** The mission currently being worked on (first not-yet-done). */
  get currentMission() {
    return MISSIONS.find((m) => !this.data.done.includes(m.id)) || null;
  }

  /** Fold a finished run in. Returns { newBestDist, newBestScore, upgraded:[missions] }. */
  finishRun(r) {
    this.data.plays++;
    const newBestDist = r.distance > this.data.bestDist;
    const newBestScore = r.score > this.data.bestScore;
    if (newBestDist) this.data.bestDist = Math.floor(r.distance);
    if (newBestScore) this.data.bestScore = r.score;

    const upgraded = [];
    // only the current mission can complete, so nests come in order
    let guard = 0;
    while (guard++ < MISSIONS.length) {
      const m = this.currentMission;
      if (!m || !m.test(r)) break;
      this.data.done.push(m.id);
      this.data.nest = Math.min(MISSIONS.length + 1, this.data.nest + 1);
      upgraded.push(m);
    }
    this.save();
    return { newBestDist, newBestScore, upgraded };
  }
}
