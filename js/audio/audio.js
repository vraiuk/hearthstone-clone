// Процедурный звук «Звёздной Крови»: музыка и SFX генерируются WebAudio на
// лету — никаких внешних файлов. Меню — космический эмбиент; бой — тот же
// эмбиент + пульс баса и перкуссия. Первый запуск — по жесту пользователя
// (политика автоплея браузеров).

const STORE_KEY = 'star-blood-muted';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = localStorage.getItem(STORE_KEY) === '1';
    this.scene = 'menu';        // 'menu' | 'battle'
    this.schedulerId = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.started = false;

    // Ля-минорная прогрессия: Am — F — C — G (частоты корней в 2-й октаве).
    this.progression = [
      [110.0, 130.81, 164.81],   // A2 C3 E3
      [87.31, 110.0, 130.81],    // F2 A2 C3
      [98.0, 123.47, 146.83],    // G2 B2 D3 → используем C: 130.81? оставим G
      [130.81, 164.81, 196.0],   // C3 E3 G3
    ];
    this.pentatonic = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
  }

  ensureCtx() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.35;
      this.sfxGain.connect(this.master);
      return true;
    } catch (e) { return false; }
  }

  // Called on the first user gesture.
  start() {
    if (this.started) return;
    if (!this.ensureCtx()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.schedulerId = setInterval(() => this.schedule(), 200);
  }

  setScene(scene) { this.scene = scene; }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem(STORE_KEY, this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }

  // ---- music scheduler: 8 шагов на такт, ~66 BPM по четвертям ----
  schedule() {
    if (!this.ctx) return;
    const stepDur = 0.45; // seconds per 8th step
    while (this.nextNoteTime < this.ctx.currentTime + 0.9) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  playStep(step, t, dur) {
    const bar = Math.floor(step / 8) % 4;
    const chord = this.progression[bar];
    const inBar = step % 8;

    // Пад-аккорд в начале такта: мягкие треугольники с долгой атакой.
    if (inBar === 0) {
      for (const f of chord) this.tone(f, t, dur * 8, 'triangle', 0.09, this.musicGain, 1.2, 2.4);
      this.tone(chord[0] / 2, t, dur * 8, 'sine', 0.12, this.musicGain, 0.8, 2.0); // суб-бас
    }
    // Редкие «звёздные» переливы пентатоники.
    if ((step * 7) % 13 === 0) {
      const f = this.pentatonic[(step * 5) % this.pentatonic.length] * 2;
      this.tone(f, t + dur * 0.3, dur * 2, 'sine', 0.05, this.musicGain, 0.02, 1.4);
    }
    // Боевой слой: пульс баса и перкуссия.
    if (this.scene === 'battle') {
      if (inBar % 2 === 0) this.tone(chord[0], t, dur * 0.9, 'sawtooth', 0.045, this.musicGain, 0.01, 0.3);
      if (inBar === 0 || inBar === 4) this.kick(t);
      if (inBar === 2 || inBar === 6) this.hat(t);
    }
  }

  tone(freq, t, dur, type, vol, dest, attack = 0.02, release = 0.3) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + release + 0.05);
  }

  noise(t, dur, vol, filterFreq, dest) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.2);
  }

  hat(t) { this.noise(t, 0.05, 0.12, 6000, this.musicGain); }

  // ---- SFX ----
  sfx(kind) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.01;
    switch (kind) {
      case 'play':   // розыгрыш карты — «вжух»
        this.noise(t, 0.18, 0.3, 1800, this.sfxGain);
        this.tone(660, t, 0.08, 'sine', 0.15, this.sfxGain, 0.01, 0.1);
        break;
      case 'attack': // удар
        this.kickAt(t, 0.7);
        this.noise(t, 0.1, 0.35, 900, this.sfxGain);
        break;
      case 'damage':
        this.tone(220, t, 0.07, 'square', 0.12, this.sfxGain, 0.005, 0.08);
        break;
      case 'power':  // аспект героя
        this.tone(440, t, 0.1, 'sine', 0.15, this.sfxGain, 0.01, 0.15);
        this.tone(660, t + 0.08, 0.12, 'sine', 0.15, this.sfxGain, 0.01, 0.2);
        break;
      case 'win': {
        const notes = [261.63, 329.63, 392, 523.25, 659.25];
        notes.forEach((f, i) => this.tone(f, t + i * 0.12, 0.3, 'triangle', 0.2, this.sfxGain, 0.01, 0.4));
        break;
      }
      case 'lose': {
        const notes = [392, 329.63, 261.63, 196];
        notes.forEach((f, i) => this.tone(f, t + i * 0.16, 0.35, 'triangle', 0.18, this.sfxGain, 0.01, 0.5));
        break;
      }
      case 'click':
        this.tone(880, t, 0.04, 'sine', 0.08, this.sfxGain, 0.005, 0.05);
        break;
    }
  }

  kickAt(t, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + 0.18);
  }
}

export const Audio = new AudioEngine();

// Hook the first user gesture to unlock audio.
export function installAudioUnlock() {
  const unlock = () => { Audio.start(); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock);
}
