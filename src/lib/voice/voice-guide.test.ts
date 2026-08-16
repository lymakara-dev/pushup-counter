import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VoiceGuide, VoicePriority } from './voice-guide';

describe('VoiceGuide', () => {
  let voiceGuide: VoiceGuide;
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let mockUtteranceConstructor: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockUtteranceConstructor = vi.fn();
    
    // Mock global window objects
    global.window = {
      speechSynthesis: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: vi.fn().mockReturnValue([{ lang: 'en-US' }]),
        speaking: false
      } as any
    } as any;
    
    class MockSpeechSynthesisUtterance {
      text: string;
      rate: number = 1.0;
      pitch: number = 1.0;
      volume: number = 1.0;
      constructor(text: string) {
        this.text = text;
        mockUtteranceConstructor(text);
      }
    }
    global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;
    
    global.localStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    } as any;

    voiceGuide = new VoiceGuide();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should speak when enabled', () => {
    voiceGuide.speak('Ready.', VoicePriority.CRITICAL);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockUtteranceConstructor).toHaveBeenCalledWith('Ready.');
  });

  it('should not speak when disabled', () => {
    voiceGuide.setEnabled(false);
    voiceGuide.speak('Ready.', VoicePriority.CRITICAL);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('should prevent repeated speech within cooldown', () => {
    voiceGuide.speak('Move left.');
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    
    // Immediate repeat
    voiceGuide.speak('Move left.');
    expect(mockSpeak).toHaveBeenCalledTimes(1); // Blocked by cooldown
    
    // After cooldown
    vi.advanceTimersByTime(2500);
    voiceGuide.speak('Move left.');
    expect(mockSpeak).toHaveBeenCalledTimes(2); // Allowed
  });

  it('should cancel active speech for critical priority', () => {
    global.window.speechSynthesis.speaking = true;
    voiceGuide.speak('Down.', VoicePriority.CRITICAL);
    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('should not queue medium priority if already speaking', () => {
    global.window.speechSynthesis.speaking = true;
    voiceGuide.speak('Move left.', VoicePriority.MEDIUM);
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('should speak rep counts using forced critical priority', () => {
    voiceGuide.speakRep(1);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockUtteranceConstructor).toHaveBeenCalledWith('1');
    
    // Even if repeated quickly (which shouldn't happen naturally, but testing force)
    voiceGuide.speakRep(1);
    expect(mockSpeak).toHaveBeenCalledTimes(2);
  });
});
