/**
 * Audio playback engine using expo-av
 * 
 * Manages audio clip playback during timeline scrubbing and preview.
 * Handles:
 * - Loading audio clips on demand
 * - Volume control per clip
 * - Playback rate (speed) control
 * - Seeking to specific positions
 * - Auto-unloading when clips are removed
 */

import { Platform } from 'react-native';

let Audio: any = null;
if (Platform.OS !== 'web') {
  try {
    Audio = require('expo-av').Audio;
  } catch {}
}

interface AudioInstance {
  sound: any;
  clipId: string;
  uri: string;
  isLoaded: boolean;
}

class AudioEngine {
  private instances = new Map<string, AudioInstance>();
  private initialized = false;

  async init() {
    if (this.initialized || !Audio) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      this.initialized = true;
    } catch {}
  }

  /**
   * Load an audio clip for playback
   */
  async loadClip(clipId: string, uri: string, volume: number = 1): Promise<void> {
    if (!Audio) return;
    await this.init();

    // Skip if already loaded with same URI
    const existing = this.instances.get(clipId);
    if (existing && existing.uri === uri && existing.isLoaded) {
      try {
        await existing.sound.setVolumeAsync(volume);
      } catch {}
      return;
    }

    // Unload previous if exists
    await this.unloadClip(clipId);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay: false,
          volume,
          isLooping: false,
        }
      );

      this.instances.set(clipId, {
        sound,
        clipId,
        uri,
        isLoaded: true,
      });
    } catch {}
  }

  /**
   * Play a loaded clip from a specific position
   */
  async playClip(clipId: string, positionMs: number = 0, rate: number = 1): Promise<void> {
    const instance = this.instances.get(clipId);
    if (!instance?.isLoaded) return;

    try {
      await instance.sound.setPositionMillisAsync(positionMs);
      await instance.sound.setRateAsync(rate, true);
      await instance.sound.playAsync();
    } catch {}
  }

  /**
   * Pause a playing clip
   */
  async pauseClip(clipId: string): Promise<void> {
    const instance = this.instances.get(clipId);
    if (!instance?.isLoaded) return;
    try {
      await instance.sound.pauseAsync();
    } catch {}
  }

  /**
   * Pause all playing clips
   */
  async pauseAll(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(inst => {
      return inst.sound?.pauseAsync?.().catch(() => {});
    });
    await Promise.all(promises);
  }

  /**
   * Seek a clip to a specific position
   */
  async seekClip(clipId: string, positionMs: number): Promise<void> {
    const instance = this.instances.get(clipId);
    if (!instance?.isLoaded) return;
    try {
      await instance.sound.setPositionMillisAsync(positionMs);
    } catch {}
  }

  /**
   * Update volume for a clip
   */
  async setVolume(clipId: string, volume: number): Promise<void> {
    const instance = this.instances.get(clipId);
    if (!instance?.isLoaded) return;
    try {
      await instance.sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
    } catch {}
  }

  /**
   * Get playback status of a clip
   */
  async getStatus(clipId: string): Promise<{
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;
  } | null> {
    const instance = this.instances.get(clipId);
    if (!instance?.isLoaded) return null;
    try {
      const status = await instance.sound.getStatusAsync();
      if (status.isLoaded) {
        return {
          isPlaying: status.isPlaying,
          positionMs: status.positionMillis,
          durationMs: status.durationMillis || 0,
        };
      }
    } catch {}
    return null;
  }

  /**
   * Unload a specific clip
   */
  async unloadClip(clipId: string): Promise<void> {
    const instance = this.instances.get(clipId);
    if (!instance) return;
    try {
      await instance.sound.unloadAsync();
    } catch {}
    this.instances.delete(clipId);
  }

  /**
   * Unload all clips
   */
  async unloadAll(): Promise<void> {
    const promises = Array.from(this.instances.keys()).map(id => this.unloadClip(id));
    await Promise.all(promises);
  }

  /**
   * Check if audio engine is available
   */
  get isAvailable(): boolean {
    return Audio !== null;
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
