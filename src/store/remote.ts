import type { Db, Lesson, LessonSummary, Store, StudentInfo, SubmitResult } from '../types';

const KEY = 'bgs_teacher_key';
type Listener = (busy: boolean) => void;
const listeners = new Set<Listener>();
let pending = 0;

/** Cho giao diện biết khi nào đang chờ Google Sheets trả lời. */
export function onBusy(fn: Listener): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function setBusy(delta: number) {
  pending += delta;
  listeners.forEach((fn) => fn(pending > 0));
}

/** Bản thật: gọi Google Apps Script. Gửi dạng text/plain để trình duyệt không hỏi trước (preflight),
    vì Apps Script không trả lời được câu hỏi đó. */
export function createRemoteStore(apiUrl: string): Store {
  async function call<T>(action: string, data?: object, admin = false): Promise<T> {
    const body: Record<string, unknown> = { action, ...data };
    if (admin) body.key = sessionStorage.getItem(KEY) ?? '';
    setBusy(1);
    try {
      let json: { ok: boolean; data: T; error?: string };
      try {
        const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        json = await res.json();
      } catch {
        throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      }
      if (!json.ok) throw new Error(json.error || 'Lỗi máy chủ');
      return json.data;
    } finally {
      setBusy(-1);
    }
  }
  return {
    remote: true,
    hasKey: () => !!sessionStorage.getItem(KEY),
    setKey: (k) => sessionStorage.setItem(KEY, k),
    clearKey: () => sessionStorage.removeItem(KEY),
    getAll: () => call<Db>('getAll', undefined, true),
    createClass: (name, names) => call('createClass', { name, names }, true),
    addStudents: (classId, names) => call('addStudents', { classId, names }, true),
    deleteClass: (id) => call('deleteClass', { id }, true),
    saveLesson: (lesson) => call('saveLesson', { lesson }, true),
    deleteLesson: (id) => call('deleteLesson', { id }, true),
    listLessons: () => call<LessonSummary[]>('listLessons'),
    getLesson: (id) => call<Lesson | null>('getLesson', { id }),
    findStudent: (code) => call<StudentInfo | null>('findStudent', { code }),
    submitAttempt: (a) => call<SubmitResult>('submitAttempt', a),
    demoCode: () => Promise.resolve(null),
    hasStudents: () => Promise.resolve(true),
  };
}
