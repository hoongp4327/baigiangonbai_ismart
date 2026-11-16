/** Thông báo ngắn ở cuối màn hình. */
export function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

export function copyText(text: string, done = 'Đã copy'): void {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(done);
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast(done), fallback);
  else fallback();
}

/** Link bài học để gửi cho học sinh. */
export const lessonUrl = (id: string): string => new URL('index.html?bai=' + encodeURIComponent(id), location.href).href;
