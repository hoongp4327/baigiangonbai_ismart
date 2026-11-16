import type { Question } from '../types';

export const hasAudio = (q: Question): boolean => !!(q.audio_text || q.audio_url);

/** Phát phần nghe: file âm thanh nếu có link, không thì để trình duyệt đọc câu tiếng Anh. */
export function speak(q: Question): void {
  if (q.audio_url) {
    void new Audio(q.audio_url).play().catch(() => {});
    return;
  }
  if (!q.audio_text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(q.audio_text);
  u.lang = 'en-US';
  u.rate = 0.8;
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
