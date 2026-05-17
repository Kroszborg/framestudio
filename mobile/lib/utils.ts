export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function getFileExtension(uri: string): string {
  return uri.split('.').pop()?.toLowerCase() || '';
}

export function isVideoFile(uri: string): boolean {
  const ext = getFileExtension(uri);
  return ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'].includes(ext);
}

export function isAudioFile(uri: string): boolean {
  const ext = getFileExtension(uri);
  return ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(ext);
}

export function isImageFile(uri: string): boolean {
  const ext = getFileExtension(uri);
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext);
}

export function getAspectRatioDimensions(ratio: string, maxWidth: number): { width: number; height: number } {
  const [w, h] = ratio.split(':').map(Number);
  const height = Math.round(maxWidth * (h / w));
  return { width: maxWidth, height };
}

export function secondsToPixels(seconds: number, pixelsPerSecond: number): number {
  'worklet';
  return seconds * pixelsPerSecond;
}

export function pixelsToSeconds(pixels: number, pixelsPerSecond: number): number {
  'worklet';
  return pixels / pixelsPerSecond;
}
