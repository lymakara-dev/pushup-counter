export enum VoicePriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

export const VOICE_MESSAGES = {
  NO_PERSON: { text: "Looking for your body.", priority: VoicePriority.HIGH },
  BODY_NOT_VISIBLE: { text: "Show your whole body.", priority: VoicePriority.HIGH },
  TOO_CLOSE: { text: "Move farther away.", priority: VoicePriority.MEDIUM },
  TOO_FAR: { text: "Move closer.", priority: VoicePriority.MEDIUM },
  MOVE_LEFT: { text: "Move left.", priority: VoicePriority.MEDIUM },
  MOVE_RIGHT: { text: "Move right.", priority: VoicePriority.MEDIUM },
  MOVE_UP: { text: "Move up.", priority: VoicePriority.MEDIUM },
  MOVE_DOWN: { text: "Move down.", priority: VoicePriority.MEDIUM },
  TURN_SIDEWAYS: { text: "Turn sideways.", priority: VoicePriority.HIGH },
  GET_IN_PUSHUP_POSITION: { text: "Get into push-up position.", priority: VoicePriority.HIGH },
  LOW_CONFIDENCE: { text: "Show your whole body.", priority: VoicePriority.HIGH },
  PERFECT_POSITION: { text: "Perfect position.", priority: VoicePriority.LOW },
  READY: { text: "Ready.", priority: VoicePriority.CRITICAL },
  GO: { text: "Go.", priority: VoicePriority.CRITICAL },
  DOWN: { text: "Down.", priority: VoicePriority.CRITICAL },
  UP: { text: "Up.", priority: VoicePriority.CRITICAL },
  POSE_LOST: { text: "Pose lost. Make sure your whole body is visible.", priority: VoicePriority.CRITICAL },
  RESET: { text: "Reset.", priority: VoicePriority.LOW }
};

export class VoiceGuide {
  private enabled: boolean = true;
  private lastSpokenText: string = "";
  private lastSpokenTime: number = 0;
  private cooldownMs: number = 2000;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pushup_voice_enabled');
      if (stored !== null) {
        this.enabled = stored === 'true';
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

  public speak(text: string, priority: VoicePriority = VoicePriority.MEDIUM, force: boolean = false) {
    if (!this.enabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    const now = Date.now();
    
    // Cooldown check for repeating messages
    if (!force && text === this.lastSpokenText && (now - this.lastSpokenTime < this.cooldownMs)) {
      return;
    }

    // Cancel currently speaking if it's a critical override
    if (priority >= VoicePriority.CRITICAL && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    } else if (window.speechSynthesis.speaking && !force) {
      // Don't queue up normal repetitive messages if already speaking
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en-'));
    if (enVoice) utterance.voice = enVoice;

    window.speechSynthesis.speak(utterance);

    this.lastSpokenText = text;
    this.lastSpokenTime = now;
  }

  public speakRep(count: number) {
    // Speak the actual number
    this.speak(count.toString(), VoicePriority.CRITICAL, true);
  }

  public cancel() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

// Singleton instance
export const voiceGuide = new VoiceGuide();
