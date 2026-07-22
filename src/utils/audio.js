// ============================================================
// CINEMATIC AUDIO ENGINE v2 — Web Audio API
// World: adventurous/heroic march
// Battle: intense/chaotic heavy rhythm
// Boss: dark/ominous Chronomon DM theme
// ============================================================
class AudioManager {
  constructor() {
    this.ctx = null;
    this.bgmInterval = null;
    this.bgmInterval2 = null;
    this.currentBgmType = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._musicVolume = 1.0;
    this._sfxVolume = 1.0;
    this._muted = false;
    this._activeBus = null; // set only for the synchronous span of a BGM beat, so SFX never leaks onto the music bus
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._muted ? 0 : 1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this._musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this._sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ── INTERNAL HELPERS ──────────────────────────────────────
  // Both helpers route through `_activeBus` when set (only true during a BGM beat's
  // synchronous execution — see startBGM), otherwise default to the SFX bus.

  _osc(type, freq, startTime, duration, gainVal, destination, freqEnd = null) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(destination || this._activeBus || this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  _noise(startTime, duration, gainVal, cutoff = 800) {
    const bufferSize = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, startTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._activeBus || this.sfxGain);
    source.start(startTime);
    source.stop(startTime + duration + 0.01);
  }

  // ── BGM ───────────────────────────────────────────────────

  startBGM(type = "WORLD") {
    this.init();
    if (this.currentBgmType === type) return;

    const switchNow = () => {
      this.stopBGM();
      this.currentBgmType = type;
      let beat = 0;

      if (type === "WORLD") {
      // ✅ Adventurous/heroic upbeat march
      // C major pentatonic march melody with strong bass pulse
      const marchMelody = [
        261.63, 329.63, 392.00, 523.25,
        392.00, 440.00, 392.00, 329.63,
        293.66, 349.23, 440.00, 523.25,
        493.88, 440.00, 392.00, 329.63
      ];
      const marchBass = [
        130.81, 130.81, 196.00, 196.00,
        174.61, 174.61, 130.81, 130.81,
        146.83, 146.83, 220.00, 220.00,
        164.81, 164.81, 130.81, 130.81
      ];
      const playBeat = () => {
        this._activeBus = this.musicGain;
        const t = this.ctx.currentTime;
        const idx = beat % marchMelody.length;

        // Heroic square wave melody — bold and bright
        this._osc('square', marchMelody[idx], t, 0.28, 0.06);
        // Triangle harmony a fifth above every 2nd beat
        if (beat % 2 === 0) {
          this._osc('triangle', marchMelody[idx] * 1.5, t, 0.20, 0.03);
        }
        // Strong march bass — triangle for warmth
        this._osc('triangle', marchBass[idx], t, 0.38, 0.08);
        // Sub bass on beat 1 and beat 3 (every 2 beats of 4-beat cycle)
        if (beat % 2 === 0) {
          this._osc('sine', marchBass[idx] * 0.5, t, 0.25, 0.10);
        }
        // March snare-like noise on beats 2 and 4
        if (beat % 4 === 1 || beat % 4 === 3) {
          this._noise(t, 0.06, 0.05, 2000);
        }
        // Bass drum kick on beat 1
        if (beat % 4 === 0) {
          this._osc('sine', 80, t, 0.15, 0.12, null, 30);
          this._noise(t, 0.04, 0.04, 200);
        }
        beat++;
        this._activeBus = null;
      };
      this.bgmInterval = setInterval(playBeat, 280);

    } else if (type === "BATTLE") {
      // ✅ Driving, moderately-paced intense battle theme — a minor-key riff over a punchy
      // kick/snare/hihat groove. Real energy and drive without being chaotic (too fast) or
      // sluggish (too slow).
      const driveMelody = [
        293.66, 349.23, 392.00, 349.23,
        293.66, 261.63, 293.66, 349.23
      ];
      const driveBass = [
        73.42, 73.42, 87.31, 73.42,
        65.41, 65.41, 73.42, 87.31
      ];
      const playBeat = () => {
        this._activeBus = this.musicGain;
        const t = this.ctx.currentTime;
        const idx = beat % driveMelody.length;

        // Driving minor-key riff — the main intensity carrier
        this._osc('sawtooth', driveMelody[idx], t, 0.22, 0.08);
        // Punchy square doubling for extra bite on strong beats
        if (beat % 2 === 0) {
          this._osc('square', driveMelody[idx], t, 0.16, 0.045);
        }

        // Syncopated bass line driving underneath
        this._osc('sawtooth', driveBass[idx], t, 0.24, 0.11);
        this._osc('sine', driveBass[idx] * 0.5, t, 0.22, 0.09);

        // Steady kick every beat for momentum
        this._osc('sine', 100, t, 0.14, 0.16, null, 32);
        this._noise(t, 0.04, 0.06, 250);

        // Snare on the backbeat (2 and 4)
        if (beat % 4 === 1 || beat % 4 === 3) {
          this._noise(t, 0.07, 0.11, 2800);
          this._osc('square', 190, t, 0.05, 0.05);
        }

        // Hi-hat on the offbeat for rhythmic drive
        if (beat % 2 === 1) this._noise(t, 0.025, 0.035, 6500);

        // Punchy rising accent stab every 8 beats
        if (beat % 8 === 6) {
          this._osc('sawtooth', driveMelody[idx] * 1.5, t, 0.20, 0.07, null, driveMelody[idx] * 2.2);
          this._noise(t, 0.10, 0.07, 1800);
        }

        beat++;
        this._activeBus = null;
      };
      this.bgmInterval = setInterval(playBeat, 300);

    } else if (type === "BOSS") {
      // ✅ Chronomon DM — dark, ominous, end-of-world feel
      // Diminished 7th chord progression, deep rumbling, dramatic stabs
      const darkMelody = [
        110.00, 116.54, 98.00, 103.83,
        92.50,  87.31,  98.00, 103.83,
        110.00, 92.50,  87.31, 116.54,
        103.83, 98.00,  92.50, 87.31
      ];
      const voidBass = [
        36.71, 36.71, 34.65, 34.65,
        32.70, 32.70, 36.71, 36.71,
        30.87, 30.87, 32.70, 32.70,
        34.65, 34.65, 36.71, 30.87
      ];
      const playBeat = () => {
        this._activeBus = this.musicGain;
        const t = this.ctx.currentTime;
        const idx = beat % darkMelody.length;

        // Ominous dark melody — sawtooth with downward bend
        this._osc('sawtooth', darkMelody[idx], t, 0.30, 0.07, null, darkMelody[idx] * 0.88);
        // Dark square layer
        this._osc('square', darkMelody[idx] * 0.5, t, 0.28, 0.05);
        // Deep void bass — layered sine + saw
        this._osc('sine',     voidBass[idx], t, 0.55, 0.16);
        this._osc('sawtooth', voidBass[idx], t, 0.50, 0.06);
        // Dramatic orchestral stab every 4 beats
        if (beat % 4 === 0) {
          this._osc('sawtooth', darkMelody[idx] * 2,  t, 0.20, 0.10);
          this._osc('square',   darkMelody[idx] * 1.5, t, 0.18, 0.08);
          this._noise(t, 0.14, 0.14, 1200);
        }
        // Doom kick — very low and heavy
        if (beat % 4 === 0) {
          this._osc('sine', 60, t, 0.20, 0.18, null, 18);
          this._noise(t, 0.06, 0.10, 250);
        }
        // Dread snare on 3
        if (beat % 4 === 2) {
          this._noise(t, 0.10, 0.12, 3500);
          this._osc('sine', 100, t, 0.08, 0.08);
        }
        // Unsettling hi-hat
        if (beat % 2 === 1) this._noise(t, 0.04, 0.03, 5000);
        beat++;
        this._activeBus = null;
      };
      this.bgmInterval = setInterval(playBeat, 200);

      } else if (type === "MENU") {
      // ✅ Calm, welcoming menu theme — a gentle chime arpeggio over a soft sustained pad.
      // Much slower and airier than the World march since there's no urgency on the menu.
      const chimeArpeggio = [
        523.25, 659.25, 783.99, 659.25,
        587.33, 698.46, 880.00, 698.46,
        523.25, 659.25, 783.99, 987.77,
        880.00, 783.99, 659.25, 587.33
      ];
      const padBass = [
        130.81, 130.81, 146.83, 146.83,
        164.81, 164.81, 130.81, 130.81
      ];
      const playBeat = () => {
        this._activeBus = this.musicGain;
        const t = this.ctx.currentTime;
        const idx = beat % chimeArpeggio.length;
        const bassIdx = beat % padBass.length;

        // Soft chime arpeggio — sine/triangle blend for a warm, bell-like tone
        this._osc('sine', chimeArpeggio[idx], t, 0.55, 0.045);
        this._osc('triangle', chimeArpeggio[idx], t, 0.35, 0.025);

        // Gentle sustained pad underneath, only changing every 2 beats
        if (beat % 2 === 0) {
          this._osc('sine', padBass[bassIdx], t, 0.9, 0.05);
          this._osc('triangle', padBass[bassIdx] * 2, t, 0.7, 0.02);
        }

        // A soft sparkle every 8 beats for a touch of magic
        if (beat % 8 === 0) {
          this._osc('sine', chimeArpeggio[idx] * 2, t, 0.4, 0.03);
        }

        beat++;
        this._activeBus = null;
      };
      this.bgmInterval = setInterval(playBeat, 420);

      } else if (type === "SHOP") {
      // ✅ Shop sting — bright, bouncy marimba-style arpeggio with a little "cha-ching"
      // sparkle on the downbeat. Upbeat and transactional: quicker/perkier than MENU's slow
      // ambient chimes, and major-key/playful in contrast to WORLD's heroic march.
      const shopMelody = [
        392.00, 493.88, 587.33, 493.88,
        440.00, 523.25, 659.25, 523.25,
        392.00, 493.88, 587.33, 698.46,
        659.25, 587.33, 493.88, 440.00
      ];
      const shopBass = [
        196.00, 196.00, 220.00, 220.00,
        174.61, 174.61, 196.00, 196.00
      ];
      const playBeat = () => {
        this._activeBus = this.musicGain;
        const t = this.ctx.currentTime;
        const idx = beat % shopMelody.length;
        const bassIdx = beat % shopBass.length;

        // Bright plucky marimba-style melody
        this._osc('triangle', shopMelody[idx], t, 0.22, 0.055);
        this._osc('square', shopMelody[idx] * 2, t, 0.08, 0.015);

        // Light bouncy bass every 2 beats
        if (beat % 2 === 0) {
          this._osc('sine', shopBass[bassIdx], t, 0.30, 0.06);
        }

        // "Cha-ching" sparkle accent every 4 beats
        if (beat % 4 === 0) {
          this._osc('sine', shopMelody[idx] * 2, t, 0.12, 0.035);
          this._osc('triangle', shopMelody[idx] * 3, t, 0.10, 0.02);
        }

        beat++;
        this._activeBus = null;
      };
      this.bgmInterval = setInterval(playBeat, 260);
      }

      // Smoothly fade the new track in instead of snapping straight to full volume
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(0.0001, now);
      this.musicGain.gain.linearRampToValueAtTime(this._musicVolume, now + 0.3);
    };

    if (this.currentBgmType) {
      // ✅ Crossfade instead of a hard cut: fade the current track out, then switch and fade
      // the new one in. (True overlapping playback would clash since each theme has its own
      // key/rhythm — a quick fade-out/fade-in reads as a smooth transition, not an abrupt cut.)
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
      setTimeout(switchNow, 260);
    } else {
      switchNow();
    }
  }

  stopBGM() {
    if (this.bgmInterval)  { clearInterval(this.bgmInterval);  this.bgmInterval  = null; }
    if (this.bgmInterval2) { clearInterval(this.bgmInterval2); this.bgmInterval2 = null; }
    this.currentBgmType = null;
  }

  // ── SFX ───────────────────────────────────────────────────

  playTick(frequency = 800) {
    this.init();
    const t = this.ctx.currentTime;
    this._osc('triangle', frequency, t, 0.04, 0.07);
    this._osc('sine', frequency * 0.5, t, 0.03, 0.04);
  }

  playHit() {
    this.init();
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 180, t, 0.08, 0.34, null, 45);
    this._osc('sine', 90, t, 0.12, 0.42, null, 40);
    this._noise(t, 0.06, 0.16);
  }

  playCriticalHit() {
    this.init();
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 80,  t, 0.40, 0.44, null, 35);
    this._osc('square',   160, t, 0.35, 0.38, null, 60);
    this._osc('sawtooth', 400, t, 0.25, 0.38, null, 1200);
    this._noise(t, 0.15, 0.30);
    this._osc('sine', 40, t, 0.20, 0.48, null, 20);
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      this._osc('sawtooth', 120, t2, 0.25, 0.28, null, 50);
      this._noise(t2, 0.08, 0.16);
    }, 180);
  }

  playMiss() {
    this.init();
    const t = this.ctx.currentTime;
    this._osc('sine',     400, t, 0.22, 0.08, null, 80);
    this._osc('triangle', 300, t, 0.18, 0.06, null, 60);
  }

  playPotionSFX() {
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._osc('sine',     freq,       t, 0.20, 0.07);
        this._osc('triangle', freq * 1.5, t, 0.15, 0.04);
      }, i * 55);
    });
  }

  playItemSFX() {
    this.init();
    const t = this.ctx.currentTime;
    this._osc('sine',     300, t, 0.35, 0.12, null, 1400);
    this._osc('triangle', 600, t, 0.25, 0.08, null, 2000);
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      this._osc('sine', 1200, t2, 0.15, 0.06);
      this._osc('sine', 1600, t2, 0.12, 0.05);
    }, 200);
  }

  playTransformSFX() {
    this.init();
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 80,  t, 0.60, 0.15, null, 800);
    this._osc('square',   160, t, 0.55, 0.12, null, 1200);
    this._osc('sine',     200, t, 0.60, 0.10, null, 1600);
    this._noise(t, 0.20, 0.18);
    this._osc('sine', 40, t, 0.40, 0.18);
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq) => {
        this._osc('triangle', freq, t2, 0.40, 0.09);
      });
    }, 500);
  }

  playVictory() {
    this.init();
    this.stopBGM();
    const fanfare = [
      {freq: 261.63, delay: 0},
      {freq: 329.63, delay: 100},
      {freq: 392.00, delay: 200},
      {freq: 523.25, delay: 300},
      {freq: 659.25, delay: 380},
      {freq: 783.99, delay: 440},
    ];
    fanfare.forEach(({freq, delay}) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._osc('square',   freq,     t, 0.55, 0.14);
        this._osc('triangle', freq * 2, t, 0.40, 0.08);
        this._osc('sine',     freq,     t, 0.55, 0.10);
      }, delay);
    });
    setTimeout(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [261.63, 329.63, 392.00, 523.25].forEach((freq) => {
        this._osc('sine',     freq,     t, 0.80, 0.14);
        this._osc('triangle', freq * 2, t, 0.80, 0.06);
      });
      this._noise(t, 0.15, 0.08);
    }, 600);
  }

  playGameOver() {
    this.init();
    this.stopBGM();
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 220, t, 1.20, 0.28, null, 27.5);
    this._osc('square',   110, t, 1.00, 0.22, null, 30);
    this._osc('sine',     55,  t, 1.20, 0.30, null, 20);
    this._noise(t, 0.40, 0.18);
    this._osc('sine', 40, t + 0.3, 0.80, 0.20, null, 18);
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      this._noise(t2, 0.25, 0.20);
      this._osc('sine', 30, t2, 0.40, 0.25);
    }, 700);
  }

  // ✅ One-shot low-HP warning thump — a quiet double heartbeat, triggered once per "low HP episode"
  playLowHpWarning() {
    this.init();
    const t = this.ctx.currentTime;
    this._osc('sine', 55, t,        0.25, 0.22, null, 30);
    this._osc('sine', 55, t + 0.18, 0.20, 0.18, null, 28);
    this._noise(t, 0.08, 0.08, 400);
  }

  // ✅ Settings panel: independent Music and SFX volume controls (0–1), plus a mute toggle
  // that mutes everything (via masterGain) without disturbing the two individual levels.
  setMusicVolume(vol) {
    this.init();
    const clamped = Math.max(0, Math.min(1, vol));
    this._musicVolume = clamped;
    this.musicGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  setSfxVolume(vol) {
    this.init();
    const clamped = Math.max(0, Math.min(1, vol));
    this._sfxVolume = clamped;
    this.sfxGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  toggleMute() {
    this.init();
    this._muted = !this._muted;
    this.masterGain.gain.setValueAtTime(this._muted ? 0 : 1.0, this.ctx.currentTime);
    return this._muted;
  }
}

export const sfx = new AudioManager();
