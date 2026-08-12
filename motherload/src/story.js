// Depth-triggered transmissions. Depths, speakers and bounties are the
// original's; the wording is reconstructed except where a line is quoted
// verbatim from the sources (marked below).

import { ALTIMETER_FAIL_FT, GUARDIAN_ALTITUDE_FT, MRDOG_ALTITUDE_FT } from "./config.js";

export const TRANSMISSIONS = [
  {
    id: "start", depth: -Infinity, speaker: "MR. NATAS", face: "natas",
    lines: [
      "Welcome aboard, driver. That pod is the finest on Mars.",
      "Top her up at the Propellent Vendor, then get digging.",
      "Minerals, artefacts, anything you can carry. I pay well.",
    ],
  },
  {
    id: "d500", depth: 500, speaker: "MR. NATAS", face: "natas", bounty: 1000,
    lines: ["Five hundred feet already! Here's a bonus. Keep going."],
  },
  {
    id: "d1000", depth: 1000, speaker: "MR. NATAS", face: "natas", bounty: 3000,
    lines: [
      "A thousand feet. Outstanding work.",
      "Watch for marsquakes down there. They come without warning.",
    ],
  },
  {
    id: "d1750", depth: 1750, speaker: "?????", face: "static",
    lines: ["The eyes... oh my god, THE EYES!!!"],   // verbatim
  },
  {
    id: "d2100", depth: 2100, speaker: "MARTIAN DIGGING POD #3422-2", face: "pod",
    lines: [
      "Hey, new driver! Two more weeks and I retire.",
      "Little place on the ridge, no rock, no gas. Just quiet.",
    ],
  },
  {
    id: "d2500", depth: 2500, speaker: "?????", face: "static",
    lines: ["Help me! Somebody -- please -- HELP ME!"],
  },
  {
    id: "d3100", depth: 3100, speaker: "MARTIAN DIGGING POD #3422-2", face: "pod",
    lines: [
      "Careful now. Lava pockets from here down.",
      "Buy a radiator before you touch one. I mean it.",
    ],
  },
  {
    id: "d3500", depth: 3500, speaker: "MR. NATAS", face: "natas", bounty: 25000,
    lines: [
      "Thirty-five hundred feet. Take the money, you've earned it.",
      "Natural gas below this. It hides in the soil and it does not show.",
      "And driver -- do not dig past six thousand feet. That is an order.",
    ],
  },
  {
    id: "d4100", depth: 4100, speaker: "MARTIAN DIGGING POD #3422-2", face: "pod",
    lines: [
      "I'm stuck. The rock came down on the hull and I can't...",
      "Tell them where I am. Tell somebody.",
    ],
  },
  {
    id: "d4500", depth: 4500, speaker: "MARTIAN DIGGING POD #10043", face: "pod",
    lines: [
      "I found it! I actually found it -- the motherload, it's right --",
      "no. No no no. What is that. WHAT IS THAT --",
    ],
  },
  {
    id: "d5813", depth: ALTIMETER_FAIL_FT, speaker: "MR. NATAS", face: "natas",
    lines: [
      "TURN BACK.",
      "You have no idea what you are digging toward.",
      "Your altimeter is mine now. Go up. While you still can.",
    ],
  },
  {
    id: "d7000", depth: 7000, speaker: "MR. NATAS", face: "natas",
    lines: [
      "You are wasting your last minutes, driver.",
      "There is nothing under that barrier but me.",
    ],
  },
];

export const SKY_TRANSMISSIONS = [
  {
    id: "sky5000", altitude: MRDOG_ALTITUDE_FT, speaker: "MR. DOG", face: "dog",
    lines: [
      "Woof. You are a long way from the dirt, friend.",
      "Have some funds. Buy yourself something nice.",
    ],
    bounty: 50000,
  },
  {
    id: "sky10000", altitude: GUARDIAN_ALTITUDE_FT, speaker: "A VOICE", face: "god",
    lines: [
      "Hast though tired of tunneling the depths before thy time?",
      "Seek ye instead to soar the highest reaches of my heavens?",
      "Return now to thy rightly domain - Carry with thee this guardian to aide thy journey.",
    ],   // verbatim
    grant: "guardian",
  },
  {
    id: "sky100000", altitude: 100000, speaker: "A VOICE", face: "god",
    lines: ["Thou hast too much time on thy hands."],   // verbatim
  },
];

export const OILERS = {
  id: "oilers", speaker: "MARTIAN OILERS CRAFT", face: "dog",
  lines: [
    "Welcome Earthling!",   // verbatim
    "Take the bird. It pays for plain dirt, and there is plenty of that.",
  ],
  grant: "oilbird",
};

export const MARSQUAKE = {
  id: "marsquake", speaker: "SEISMIC ALERT", face: "static",
  lines: ["Marsquake. Brace the hull and hold your line."],
};

export const LAIR_INTRO = {
  id: "lair", speaker: "MR. NATAS", face: "devil",
  lines: [
    "I told you to turn back...",
    "now I have no choice but to kill you.",
    "You've served my factories well, but I think I'll take my machine,",
    "my money, and your pathetic life now. SEE YOU IN HELL!!!",
  ],   // verbatim
};

export const NATAS_FORM2 = {
  id: "form2", speaker: "SATAN", face: "devil",
  lines: [
    "You broke the suit. How quaint.",
    "I am the master of all evil, driver.",
    "Let me show you what is underneath.",
  ],
};

export class Story {
  constructor() {
    this.seen = new Set();
    this.queue = [];
    this.active = null;
    this.lineIndex = 0;
    this.charTimer = 0;
  }

  fire(entry) {
    if (this.seen.has(entry.id)) return false;
    this.seen.add(entry.id);
    this.queue.push(entry);
    if (!this.active) this.next();
    return true;
  }

  /** Force a transmission that can repeat (boss beats). */
  push(entry) {
    this.queue.push(entry);
    if (!this.active) this.next();
  }

  next() {
    this.active = this.queue.shift() || null;
    this.lineIndex = 0;
    this.charTimer = 0;
  }

  get busy() { return !!this.active; }

  advance() {
    if (!this.active) return null;
    // If the line is still typing, finish it instead of skipping.
    const full = this.active.lines[this.lineIndex] || "";
    if (this.charTimer < full.length) { this.charTimer = full.length; return null; }
    this.lineIndex++;
    this.charTimer = 0;
    if (this.lineIndex >= this.active.lines.length) {
      const done = this.active;
      this.next();
      return done;
    }
    return null;
  }

  update(dt) {
    if (!this.active) return;
    this.charTimer += dt * 44;
  }

  visibleLines() {
    if (!this.active) return [];
    const out = [];
    for (let i = 0; i <= this.lineIndex && i < this.active.lines.length; i++) {
      const line = this.active.lines[i];
      out.push(i === this.lineIndex ? line.slice(0, Math.floor(this.charTimer)) : line);
    }
    return out;
  }

  checkDepth(depthFt, game) {
    for (const t of TRANSMISSIONS) {
      if (t.depth === -Infinity) continue;
      if (depthFt >= t.depth) this.tryFire(t, game);
    }
  }
  checkAltitude(altFt, game) {
    for (const t of SKY_TRANSMISSIONS) {
      if (altFt >= t.altitude) this.tryFire(t, game);
    }
  }

  tryFire(t, game) {
    if (!this.fire(t)) return;
    if (t.bounty) game.grantBounty(t.bounty);
    if (t.grant) game.grantEgg(t.grant);
  }
}
