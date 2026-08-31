import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceGuide } from './voice-guide';
import { en } from '../i18n/translations';
import { khmerAudio } from './khmer-audio';

vi.mock('./khmer-audio', () => {
  return {
    khmerAudio: {
      play: vi.fn(),
      preloadBasic: vi.fn(),
      cancel: vi.fn(),
      checkExists: vi.fn(),
    }
  };
});

describe('VoiceGuide', () => {
  let voiceGuide: VoiceGuide;
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let mockUtteranceConstructor: ReturnType<typeof vi.fn>;
  let mockGetVoices: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockUtteranceConstructor = vi.fn();
    
    mockGetVoices = vi.fn().mockReturnValue([
      { lang: 'en-US', name: 'English Voice' }
    ]);
    
    global.window = {
      speechSynthesis: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: mockGetVoices,
        speaking: false,
      } as any
    } as any;
    
    (global as any).SpeechSynthesisUtterance = function(this: any, text: string) {
      (mockUtteranceConstructor as any)(text);
      this.text = text;
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.lang = '';
    } as any;
    
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn()
    } as any;

    voiceGuide = new VoiceGuide();
    voiceGuide.setEnabled(true);
    voiceGuide.setLanguage('en');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with English by default', () => {
    voiceGuide.speakKey('DOWN');
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockUtteranceConstructor).toHaveBeenCalledWith(en.DOWN);
  });

  it('should use khmerAudio when Khmer is selected', () => {
    voiceGuide.setLanguage('km');
    voiceGuide.speakKey('DOWN');
    
    expect(mockSpeak).toHaveBeenCalledTimes(0);
    expect(khmerAudio.play).toHaveBeenCalledWith('down.mp3', 3, false);
  });

  it('should map Khmer positioning and feedback audio keys properly', () => {
    voiceGuide.setLanguage('km');
    
    voiceGuide.speakKey('NO_PERSON');
    expect(khmerAudio.play).toHaveBeenCalledWith('body-not-detected.mp3', 2, false);

    voiceGuide.speakKey('BODY_NOT_VISIBLE');
    expect(khmerAudio.play).toHaveBeenCalledWith('whole-body.mp3', 2, false);

    voiceGuide.speakKey('TURN_SIDEWAYS');
    expect(khmerAudio.play).toHaveBeenCalledWith('side-camera.mp3', 2, false);

    voiceGuide.speakKey('FACE_CAMERA');
    expect(khmerAudio.play).toHaveBeenCalledWith('face-camera.mp3', 2, false);

    voiceGuide.speakKey('GET_IN_PUSHUP_POSITION');
    expect(khmerAudio.play).toHaveBeenCalledWith('get-into-position.mp3', 2, false);

    voiceGuide.speakKey('MOVE_UP');
    expect(khmerAudio.play).toHaveBeenCalledWith('move-up.mp3', 1, false);

    voiceGuide.speakKey('MOVE_DOWN');
    expect(khmerAudio.play).toHaveBeenCalledWith('move-down.mp3', 1, false);

    voiceGuide.speakKey('PERFECT_POSITION');
    expect(khmerAudio.play).toHaveBeenCalledWith('pose-ready.mp3', 0, false);

    voiceGuide.speakKey('POSE_LOST');
    expect(khmerAudio.play).toHaveBeenCalledWith('pose-lost.mp3', 3, false);

    voiceGuide.speakKey('RESET');
    expect(khmerAudio.play).toHaveBeenCalledWith('reset.mp3', 0, false);

    voiceGuide.speakKey('GOOD_FORM');
    expect(khmerAudio.play).toHaveBeenCalledWith('good-form.mp3', 1, false);

    voiceGuide.speakKey('GO_LOWER');
    expect(khmerAudio.play).toHaveBeenCalledWith('go-lower.mp3', 1, false);

    voiceGuide.speakKey('BODY_STRAIGHT');
    expect(khmerAudio.play).toHaveBeenCalledWith('body-straight.mp3', 2, false);

    voiceGuide.speakKey('REP_NOT_COUNTED');
    expect(khmerAudio.play).toHaveBeenCalledWith('bad-form.mp3', 2, false);

    voiceGuide.speakKey('TOO_FAST');
    expect(khmerAudio.play).toHaveBeenCalledWith('too-fast.mp3', 2, false);
  });

  it('should enforce cooldown to prevent spam in Khmer', () => {
    voiceGuide.setLanguage('km');
    voiceGuide.speakKey('NO_PERSON');
    voiceGuide.speakKey('NO_PERSON');
    
    expect(khmerAudio.play).toHaveBeenCalledTimes(1);
  });

  it('should use en-US voice when English is selected', () => {
    voiceGuide.setLanguage('en');
    voiceGuide.speakKey('DOWN');
    
    const utteranceArg = mockSpeak.mock.calls[0][0];
    expect(utteranceArg.lang).toBe('en-US');
  });

  it('should enforce cooldown to prevent spam in English', () => {
    voiceGuide.speakKey('MOVE_DOWN');
    voiceGuide.speakKey('MOVE_DOWN');
    
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('should bypass cooldown if force is true in English', () => {
    voiceGuide.speakKey('DOWN', false);
    voiceGuide.speakKey('DOWN', true); 
    
    expect(mockSpeak).toHaveBeenCalledTimes(2);
  });

  it('should cancel current speech if a CRITICAL message arrives in English', () => {
    (global.window.speechSynthesis as any).speaking = true; 
    
    voiceGuide.speakKey('READY'); 
    
    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('should play Khmer numbers via mp3 files if they exist', async () => {
    (khmerAudio.checkExists as any).mockResolvedValue(true);
    voiceGuide.setLanguage('km');
    await voiceGuide.speakRep(12);
    
    expect(khmerAudio.play).toHaveBeenCalledWith('numbers/12.mp3', 3, true);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('should fallback to English SpeechSynthesis if Khmer number mp3 is missing', async () => {
    (khmerAudio.checkExists as any).mockResolvedValue(false);
    voiceGuide.setLanguage('km');
    await voiceGuide.speakRep(12);
    
    expect(khmerAudio.play).not.toHaveBeenCalled();
    expect(mockUtteranceConstructor).toHaveBeenCalledWith('Twelve');
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('should speak translated English strings for English reps', async () => {
    voiceGuide.setLanguage('en');
    await voiceGuide.speakRep(12);
    
    expect(mockUtteranceConstructor).toHaveBeenCalledWith('Twelve');
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('should play nothing when voice is OFF for Khmer', async () => {
    voiceGuide.setEnabled(false);
    voiceGuide.setLanguage('km');
    await voiceGuide.speakRep(12);
    
    expect(khmerAudio.play).not.toHaveBeenCalled();
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('should play nothing when voice is OFF for English', async () => {
    voiceGuide.setEnabled(false);
    voiceGuide.setLanguage('en');
    await voiceGuide.speakRep(12);
    
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('should switch dynamically without dropping logic', async () => {
    (khmerAudio.checkExists as any).mockResolvedValue(true);
    voiceGuide.setLanguage('km');
    await voiceGuide.speakRep(1);
    expect(khmerAudio.play).toHaveBeenCalledWith('numbers/1.mp3', 3, true);
    expect(mockSpeak).not.toHaveBeenCalled();

    voiceGuide.setLanguage('en');
    await voiceGuide.speakRep(2);
    expect(mockUtteranceConstructor).toHaveBeenCalledWith('Two');
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });
});
