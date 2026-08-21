import { VoicePriority } from "./voice-guide";

interface AudioTask {
  id: string;
  filename: string;
  priority: VoicePriority;
}

export class KhmerAudioManager {
  private queue: AudioTask[] = [];
  private isPlaying = false;
  private basePath = '/audio/km';
  
  // Single Audio element to bypass mobile autoplay restrictions for dynamically loaded files
  private sharedAudio: HTMLAudioElement | null = null;
  private audioContextUnlocked = false;

  private availabilityCache = new Map<string, boolean>();

  private getSharedAudio(): HTMLAudioElement {
    if (!this.sharedAudio) {
      this.sharedAudio = new Audio();
    }
    return this.sharedAudio;
  }

  public preloadBasic() {
    if (typeof window === 'undefined') return;
    const audio = this.getSharedAudio();

    // Unlock the audio context during the user interaction (Start Camera click)
    if (!this.audioContextUnlocked) {
      audio.src = `${this.basePath}/ready.mp3`;
      audio.load();
      // Silently play and pause to unlock
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => {});
      }
      this.audioContextUnlocked = true;
    }

    // Prefetch common files into browser cache to ensure instant playback later
    const basics = [
      'ready.mp3',
      'start.mp3',
      'down.mp3',
      'up.mp3',
      'body-not-detected.mp3',
      'whole-body.mp3',
      'get-into-position.mp3',
      'pose-ready.mp3',
      'move-closer.mp3',
      'move-farther.mp3',
      'move-left.mp3',
      'move-right.mp3',
      'move-up.mp3',
      'move-down.mp3',
      'pose-lost.mp3',
      'reset.mp3',
      'side-camera.mp3',
      'face-camera.mp3',
      'good-form.mp3',
      'go-lower.mp3',
      'body-straight.mp3',
      'bad-form.mp3',
      'too-fast.mp3',
      'improve-position.mp3',
      'hips-too-high.mp3',
      'hips-too-low.mp3',
      'come-up.mp3'
    ];
    basics.forEach(file => {
      fetch(`${this.basePath}/${file}`).catch(() => {});
    });
  }

  public async checkExists(filename: string): Promise<boolean> {
    if (this.availabilityCache.has(filename)) {
      return this.availabilityCache.get(filename)!;
    }
    try {
      const res = await fetch(`${this.basePath}/${filename}`, { method: 'HEAD' });
      const exists = res.ok;
      this.availabilityCache.set(filename, exists);
      return exists;
    } catch {
      this.availabilityCache.set(filename, false);
      return false;
    }
  }

  public play(filename: string, priority: VoicePriority) {
    if (typeof window === 'undefined') return;

    if (priority === VoicePriority.CRITICAL) {
      this.queue = this.queue.filter(t => t.priority === VoicePriority.CRITICAL);
    }

    this.queue.push({
      id: Math.random().toString(),
      filename,
      priority
    });

    this.queue.sort((a, b) => b.priority - a.priority);
    this.processQueue();
  }

  public cancel() {
    this.queue = [];
    if (this.sharedAudio) {
      this.sharedAudio.pause();
      try {
        // Safari/Chrome throws InvalidStateError if readyState is 0
        if (this.sharedAudio.readyState > 0) {
          this.sharedAudio.currentTime = 0;
        }
      } catch (e) {
        // Ignore
      }
      this.isPlaying = false;
    }
  }

  private async processQueue() {
    if (this.isPlaying || this.queue.length === 0) return;

    const next = this.queue.shift();
    if (!next) return;

    this.isPlaying = true;
    const audio = this.getSharedAudio();

    try {
      await new Promise<void>((resolve) => {
        // Change src to the requested file
        audio.src = `${this.basePath}/${next.filename}`;
        audio.load();

        audio.onended = () => resolve();
        audio.onerror = () => {
          console.warn(`[KhmerVoice] Missing or failed audio: ${this.basePath}/${next.filename}`);
          resolve();
        };
        
        audio.play().catch(e => {
          if (e.name !== "NotAllowedError") {
             console.warn(`[KhmerVoice] Failed to play: ${this.basePath}/${next.filename}`, e);
          }
          resolve();
        });
      });
    } catch (err) {
      console.error(`[KhmerVoice] unexpected error`, err);
    } finally {
      this.isPlaying = false;
      this.processQueue();
    }
  }
}

export const khmerAudio = new KhmerAudioManager();
