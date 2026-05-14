// Lightweight audio helpers — no external assets.
// Web: uses Web Audio + SpeechSynthesis. Native: silent (could swap to expo-av/expo-speech later).

let _ctx: any | null = null;
function ctx(): any | null {
  try {
    const AC = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!AC) return null;
    if (!_ctx) _ctx = new AC();
    return _ctx;
  } catch { return null; }
}

export function playClick() {
  const c = ctx();
  if (!c) return;
  try {
    const t = c.currentTime;
    // Short noise burst + low-frequency thud
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.07);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch {}
}

export function playTick() {
  const c = ctx();
  if (!c) return;
  try {
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch {}
}

export function playShuffle() {
  const c = ctx();
  if (!c) return;
  // Several quick clicks to suggest tile-on-tile shuffling.
  for (let i = 0; i < 8; i++) {
    setTimeout(() => playClick(), i * 80);
  }
}

function pickFemaleVoice(synth: any): any {
  const voices: any[] = synth.getVoices?.() ?? [];
  if (!voices.length) return null;
  const HINTS = [
    "female", "samantha", "karen", "victoria", "allison", "susan", "zira",
    "jenny", "aria", "michelle", "tessa", "moira", "fiona", "serena",
    "google us english", "google uk english female",
  ];
  const en = voices.filter((v) => /^en/i.test(v.lang ?? ""));
  const pool = en.length ? en : voices;
  return pool.find((v) => HINTS.some((h) => (v.name ?? "").toLowerCase().includes(h))) ?? pool[0] ?? null;
}

export function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  try {
    const synth: any = (globalThis as any).speechSynthesis;
    if (!synth) return;
    const speakNow = () => {
      const u = new (globalThis as any).SpeechSynthesisUtterance(text);
      const v = pickFemaleVoice(synth);
      if (v) u.voice = v;
      u.lang = v?.lang ?? "en-US";
      u.rate = opts?.rate ?? 1.0;
      u.pitch = opts?.pitch ?? 1.25;
      u.volume = 1;
      synth.cancel();
      synth.speak(u);
    };
    if ((synth.getVoices?.() ?? []).length === 0) {
      synth.addEventListener?.("voiceschanged", speakNow, { once: true });
      setTimeout(speakNow, 250);
    } else {
      speakNow();
    }
  } catch {}
}
