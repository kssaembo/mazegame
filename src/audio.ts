export type SoundName = 'click' | 'confirm' | 'cancel' | 'danger' | 'ticket' | 'abundance' | 'famine' | 'reveal' | 'success' | 'timer-end';

const MUTE_KEY = 'abundance-famine:audio-muted';
const VOLUME_KEY = 'abundance-famine:bgm-volume';
const MAIN_BGM = '/assets/audio/bgm_main_strategy_loop.mp3';
const RESULT_BGM = '/assets/audio/bgm_result_reveal.mp3';
const VICTORY_SFX = '/assets/audio/sfx_final_victory_cheer.wav';

class AudioManager {
  private context: AudioContext | null = null;
  private muted = false;
  private mainUnavailable = false;
  private resultUnavailable = false;
  private bgmEnabled = false;
  private activeTrack: 'main' | 'result' = 'main';
  private volume = (() => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw === null) return 0.2;
      const saved = Number(raw);
      return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.2;
    } catch { return 0.2; }
  })();
  private listeners = new Set<() => void>();
  private main = new Audio(MAIN_BGM);
  private result = new Audio(RESULT_BGM);
  private victory = new Audio(VICTORY_SFX);

  constructor() {
    this.main.loop = true;
    this.main.volume = this.volume;
    this.main.preload = 'metadata';
    this.result.volume = this.volume;
    this.result.preload = 'none';
    this.victory.volume = 0.4;
    this.victory.preload = 'none';
  }

  isMuted() { return this.muted; }

  getBgmState() { return { playing: !this.main.paused || !this.result.paused, volume: this.volume }; }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit() { this.listeners.forEach(listener => listener()); }

  setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.2));
    this.main.volume = this.volume;
    this.result.volume = this.volume;
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* Audio preference is non-critical. */ }
    this.emit();
  }

  setMuted(value: boolean) {
    this.muted = value;
    try { localStorage.setItem(MUTE_KEY, String(value)); } catch { /* Audio preference is non-critical. */ }
    this.main.muted = value;
    this.result.muted = value;
    this.victory.muted = value;
    if (!value) this.ensureContext();
  }

  private ensureContext() {
    if (!this.context) this.context = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private tone(frequency: number, duration: number, delay = 0, type: OscillatorType = 'sine', volume = 0.035) {
    if (this.muted) return;
    try {
      const context = this.ensureContext();
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch { /* Sound must never block game logic. */ }
  }

  play(name: SoundName = 'click') {
    const patterns: Record<SoundName, () => void> = {
      click: () => { this.tone(720, .035); this.tone(1080, .025, .012); },
      confirm: () => { this.tone(523, .09); this.tone(659, .14, .07); },
      cancel: () => this.tone(420, .07, 0, 'triangle'),
      danger: () => { this.tone(240, .16, 0, 'sawtooth', .025); this.tone(180, .18, .1, 'sawtooth', .02); },
      ticket: () => { this.tone(880, .05); this.tone(1180, .045, .04); },
      abundance: () => { this.tone(660, .08); this.tone(880, .12, .06); },
      famine: () => { this.tone(440, .09, 0, 'triangle'); this.tone(370, .12, .06, 'triangle'); },
      reveal: () => { this.tone(196, .25, 0, 'sawtooth', .025); this.tone(784, .3, .23, 'triangle', .04); },
      success: () => { this.tone(523, .09); this.tone(659, .1, .08); this.tone(784, .16, .16); },
      'timer-end': () => { this.tone(523, .12); this.tone(523, .12, .18); this.tone(784, .28, .36); },
    };
    patterns[name]();
  }

  async startMain() {
    this.activeTrack = 'main';
    if (!this.bgmEnabled || this.muted || this.mainUnavailable || !this.main.paused || !this.result.paused) return;
    try {
      await this.main.play();
      this.emit();
      if (this.result.preload !== 'auto') {
        this.result.preload = 'auto';
        this.victory.preload = 'auto';
        this.result.load();
        this.victory.load();
      }
    } catch { this.mainUnavailable = true; }
  }

  private playFinalResult() {
    this.activeTrack = 'result';
    this.main.pause();
    if (!this.bgmEnabled || this.muted || this.resultUnavailable) { this.emit(); return; }
    this.result.currentTime = 0;
    void this.result.play().then(() => this.emit()).catch(() => { this.resultUnavailable = true; this.emit(); });
  }

  resumeMain() {
    this.result.pause();
    this.result.currentTime = 0;
    this.activeTrack = 'main';
    void this.startMain();
    this.emit();
  }

  async toggleBgm() {
    const active = this.activeTrack === 'result' ? this.result : this.main;
    if (!active.paused) {
      this.bgmEnabled = false;
      active.pause();
      this.emit();
      return false;
    }
    this.bgmEnabled = true;
    try {
      await active.play();
      this.emit();
      return true;
    } catch {
      if (this.activeTrack === 'main') this.mainUnavailable = true;
      else this.resultUnavailable = true;
      this.emit();
      return false;
    }
  }

  playVictory() {
    this.main.pause();
    this.result.pause();
    this.playFinalResult();
    this.play('success');
    this.victory.currentTime = 0;
    void this.victory.play().catch(() => undefined);
  }
}

export const audioManager = new AudioManager();

export const installGlobalButtonSounds = () => {
  const handler = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button, a[data-button], [role="button"]') : null;
    if (!target || target.matches(':disabled') || target.getAttribute('aria-disabled') === 'true') return;
    const sound = target.dataset.sound as SoundName | undefined;
    audioManager.play(sound ?? 'click');
  };
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
};
