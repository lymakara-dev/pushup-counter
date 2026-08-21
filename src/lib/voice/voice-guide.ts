import { Language, getTranslation } from '../i18n/translations';
import { khmerAudio } from './khmer-audio';

export enum VoicePriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

export const VOICE_PRIORITIES: Record<string, VoicePriority> = {
  NO_PERSON: VoicePriority.HIGH,
  BODY_NOT_VISIBLE: VoicePriority.HIGH,
  TOO_CLOSE: VoicePriority.MEDIUM,
  TOO_FAR: VoicePriority.MEDIUM,
  MOVE_LEFT: VoicePriority.MEDIUM,
  MOVE_RIGHT: VoicePriority.MEDIUM,
  MOVE_UP: VoicePriority.MEDIUM,
  MOVE_DOWN: VoicePriority.MEDIUM,
  TURN_SIDEWAYS: VoicePriority.HIGH,
  FACE_CAMERA: VoicePriority.HIGH,
  GET_IN_PUSHUP_POSITION: VoicePriority.HIGH,
  LOW_CONFIDENCE: VoicePriority.HIGH,

  PERFECT_POSITION: VoicePriority.LOW,
  READY: VoicePriority.CRITICAL,
  GO: VoicePriority.CRITICAL,
  DOWN: VoicePriority.CRITICAL,
  UP: VoicePriority.CRITICAL,
  POSE_LOST: VoicePriority.CRITICAL,
  RESET: VoicePriority.LOW,

  // Form Analysis & Anti-Cheat Feedback
  GOOD_FORM: VoicePriority.MEDIUM,
  GO_LOWER: VoicePriority.MEDIUM,
  BODY_STRAIGHT: VoicePriority.HIGH,
  MOVE_WHOLE_BODY: VoicePriority.HIGH,
  REP_NOT_COUNTED: VoicePriority.HIGH,
  INSUFFICIENT_ROM: VoicePriority.MEDIUM,
  TOO_FAST: VoicePriority.HIGH,
  IMPROVE_POSITION: VoicePriority.MEDIUM,
  HIPS_TOO_HIGH: VoicePriority.MEDIUM,
  HIPS_TOO_LOW: VoicePriority.MEDIUM,
  COME_UP: VoicePriority.MEDIUM
};

export const KHMER_AUDIO_MAP: Record<string, string> = {
  // Positioning Issues
  NO_PERSON: 'body-not-detected.mp3',
  BODY_NOT_VISIBLE: 'whole-body.mp3',
  TOO_CLOSE: 'move-farther.mp3',
  TOO_FAR: 'move-closer.mp3',
  MOVE_LEFT: 'move-left.mp3',
  MOVE_RIGHT: 'move-right.mp3',
  MOVE_UP: 'move-up.mp3',
  MOVE_DOWN: 'move-down.mp3',
  TURN_SIDEWAYS: 'side-camera.mp3',
  FACE_CAMERA: 'face-camera.mp3',
  GET_IN_PUSHUP_POSITION: 'get-into-position.mp3',
  LOW_CONFIDENCE: 'whole-body.mp3',

  // States & Feedback
  PERFECT_POSITION: 'pose-ready.mp3',
  READY: 'ready.mp3',
  GO: 'start.mp3',
  DOWN: 'down.mp3',
  UP: 'up.mp3',
  POSE_LOST: 'pose-lost.mp3',
  RESET: 'reset.mp3',

  // Form Analysis Feedback
  GOOD_FORM: 'good-form.mp3',
  GO_LOWER: 'go-lower.mp3',
  BODY_STRAIGHT: 'body-straight.mp3',
  MOVE_WHOLE_BODY: 'whole-body.mp3',
  REP_NOT_COUNTED: 'bad-form.mp3',
  INSUFFICIENT_ROM: 'go-lower.mp3',
  TOO_FAST: 'too-fast.mp3',
  IMPROVE_POSITION: 'improve-position.mp3',
  HIPS_TOO_HIGH: 'hips-too-high.mp3',
  HIPS_TOO_LOW: 'hips-too-low.mp3',
  COME_UP: 'come-up.mp3'
};

function numberToEnglish(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  if (num < 20) return ones[num];
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? "-" + ones[num % 10].toLowerCase() : "");
  }
  if (num === 100) return "One hundred";
  if (num > 100 && num < 1000) {
    return ones[Math.floor(num / 100)] + " hundred" + (num % 100 !== 0 ? " " + numberToEnglish(num % 100).toLowerCase() : "");
  }
  return num.toString();
}

export class VoiceGuide {
  private enabled: boolean = true;
  private lang: Language = "en";
  private lastSpokenText: string = "";
  private lastSpokenKey: string = "";
  private lastSpokenTime: number = 0;
  private cooldownMs: number = 2000;
  private voiceUnavailable: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const storedEnabled = localStorage.getItem('pushup_voice_enabled');
      if (storedEnabled !== null) {
        this.enabled = storedEnabled === 'true';
      }
      const storedLang = localStorage.getItem('pushup_lang');
      if (storedLang === 'km' || storedLang === 'en') {
        this.lang = storedLang as Language;
      }
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('pushup_voice_enabled', enabled.toString());
      if (!enabled) this.cancel();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setLanguage(lang: Language) {
    this.lang = lang;
    this.voiceUnavailable = false;
    this.lastSpokenKey = "";
    this.lastSpokenText = "";
    this.lastSpokenTime = 0;
    this.cancel(); // Stop currently playing audio when switching
  }

  public isVoiceUnavailable(): boolean {
    return this.voiceUnavailable;
  }

  public speakKey(key: keyof typeof VOICE_PRIORITIES, force: boolean = false) {
    if (!this.enabled) return;
    const priority = VOICE_PRIORITIES[key] ?? VoicePriority.MEDIUM;
    const now = Date.now();
    
    if (this.lang === "km") {
      const filename = KHMER_AUDIO_MAP[key];
      if (filename) {
        if (!force && key === this.lastSpokenKey && (now - this.lastSpokenTime < this.cooldownMs)) {
          return;
        }
        this.lastSpokenKey = key;
        this.lastSpokenTime = now;
        khmerAudio.play(filename, priority);
      }
      return;
    }

    // English logic
    const t = getTranslation(this.lang);
    const text = (t as any)[key] as string;
    this.speakEnglish(text, priority, force);
  }

  private speakEnglish(text: string, priority: VoicePriority = VoicePriority.MEDIUM, force: boolean = false) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
       this.voiceUnavailable = true;
       return;
    }

    const now = Date.now();
    
    // Cooldown check for repeating messages
    if (!force && text === this.lastSpokenText && (now - this.lastSpokenTime < this.cooldownMs)) {
      return;
    }

    if (priority >= VoicePriority.CRITICAL && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    } else if (window.speechSynthesis.speaking && !force) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.lang.startsWith('en-'));
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);

    this.lastSpokenText = text;
    this.lastSpokenTime = now;
  }

  public async speakRep(count: number) {
    if (!this.enabled) return;

    if (this.lang === "km") {
      const filename = `numbers/${count}.mp3`;
      const exists = await khmerAudio.checkExists(filename);
      if (exists) {
        khmerAudio.play(filename, VoicePriority.CRITICAL);
        return;
      }
      // Fall back to English SpeechSynthesis below if missing
    }

    // English
    this.speakEnglish(numberToEnglish(count), VoicePriority.CRITICAL, true);
  }

  public cancel() {
    if (typeof window !== 'undefined') {
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          // Ignore unsupported environments
        }
      }
      khmerAudio.cancel();
    }
  }

  // Called after user interaction (Start Camera)
  public preload() {
    if (this.lang === "km") {
       khmerAudio.preloadBasic();
    }
    // Trick to initialize SpeechSynthesis on iOS/Android
    this.speakEnglish("", VoicePriority.LOW, true);
  }
}

// Singleton instance
export const voiceGuide = new VoiceGuide();
