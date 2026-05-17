/**
 * FFmpeg execution wrapper for FrameStudio.
 *
 * Requires: npm install ffmpeg-kit-react-native@min
 * Then rebuild: cd android && ./gradlew clean && cd .. && npx expo run:android
 *
 * This module lazy-loads ffmpeg-kit-react-native so the app still runs
 * without it installed — video export gracefully falls back to metadata-only.
 */

let FFmpegKit: any = null;
let ReturnCode: any = null;

try {
  const kit = require('ffmpeg-kit-react-native');
  FFmpegKit = kit.FFmpegKit;
  ReturnCode = kit.ReturnCode;
} catch {
  // ffmpeg-kit-react-native not installed — export will use fallback
}

export function isFFmpegAvailable(): boolean {
  return FFmpegKit !== null;
}

/**
 * Run a single FFmpeg command string with progress reporting.
 * Progress is parsed from FFmpeg's time= log output.
 */
export async function runFFmpegCommand(
  command: string,
  totalDurationSec: number,
  onProgress?: (progress: number, label: string) => void
): Promise<{ success: boolean; error?: string }> {
  if (!FFmpegKit) {
    return { success: false, error: 'ffmpeg-kit-react-native is not installed' };
  }

  return new Promise((resolve) => {
    FFmpegKit.executeAsync(
      command,
      async (session: any) => {
        try {
          const code = await session.getReturnCode();
          if (ReturnCode.isSuccess(code)) {
            onProgress?.(1.0, 'Done');
            resolve({ success: true });
          } else {
            const logs = await session.getLogsAsString();
            resolve({ success: false, error: logs?.slice(-500) || 'FFmpeg failed' });
          }
        } catch (e: any) {
          resolve({ success: false, error: e?.message || 'Unknown FFmpeg error' });
        }
      },
      (log: any) => {
        // Parse time progress from FFmpeg log lines
        try {
          const msg: string = String(log.getMessage?.() ?? log?.message ?? '');
          const timeMatch = msg.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (timeMatch && totalDurationSec > 0) {
            const encodedSec =
              parseInt(timeMatch[1], 10) * 3600 +
              parseInt(timeMatch[2], 10) * 60 +
              parseFloat(timeMatch[3]);
            const p = Math.min(0.99, encodedSec / totalDurationSec);
            onProgress?.(p, `Encoding… ${Math.round(p * 100)}%`);
          }
        } catch {}
      }
    );
  });
}
