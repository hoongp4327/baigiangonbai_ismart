import type { Answer, Attempt, Db, Lesson, Question, Store } from '../types';
import { answerText, grade } from '../lib/grade';
import { validateLesson } from '../lib/validate';
import { SAMPLE_LESSON } from '../lib/sample';

const KEY = 'bgs_db_v1';
const empty = (): Db => ({ classes: [], students: [], lessons: [], attempts: [] });
const load = (): Db => {
  try {
    return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Db>) };
  } catch {
    return empty();
  }
};
const save = (db: Db) => localStorage.setItem(KEY, JSON.stringify(db));
const rid = (p: string) => p + Math.random().toString(36).slice(2, 8);

function newCode(db: Db): string {
  let c: string;
  do c = 'HS' + Math.floor(1000 + Math.random() * 9000);
  while (db.students.some((s) => s.code === c));
  return c;
}
function addNames(db: Db, classId: string, names: string[]) {
  for (const name of names.map((n) => n.trim()).filter(Boolean)) db.students.push({ code: newCode(db), name, classId });
}
function pushAttempt(db: Db, lessonId: string, studentCode: string, answers: Answer[], durationSec: number, submittedAt = new Date().toISOString()) {
  const prev = db.attempts.filter((a) => a.lessonId === lessonId && a.studentCode === studentCode);
  const attempt: Attempt = { id: rid('n'), lessonId, studentCode, attemptNo: prev.length + 1, score: answers.filter((a) => a.correct).length, total: answers.length, durationSec, submittedAt, answers };
  db.attempts.push(attempt);
  return { attempt, best: Math.max(attempt.score, ...prev.map((a) => a.score)) };
}

/** Bản demo: mọi thứ nằm trong localStorage của trình duyệt này. */
export function createLocalStore(): Store {
  return {
    remote: false,
    hasKey: () => true,
    setKey: () => {},
    clearKey: () => {},
    getAll: async () => load(),
    async createClass(name, names) {
      const db = load();
      const c = { id: rid('c'), name: name.trim() };
      db.classes.push(c);
      addNames(db, c.id, names);
      save(db);
      return c;
    },
    async addStudents(classId, names) {
      const db = load();
      addNames(db, classId, names);
      save(db);
    },
    async deleteClass(id) {
      const db = load();
      const codes = db.students.filter((s) => s.classId === id).map((s) => s.code);
      db.classes = db.classes.filter((c) => c.id !== id);
      db.students = db.students.filter((s) => s.classId !== id);
      db.attempts = db.attempts.filter((a) => !codes.includes(a.studentCode));
      save(db);
    },
    async saveLesson(lesson) {
      const db = load();
      const l: Lesson = { ...lesson, id: rid('b'), createdAt: new Date().toISOString() };
      db.lessons.push(l);
      save(db);
      return l;
    },
    async deleteLesson(id) {
      const db = load();
      db.lessons = db.lessons.filter((l) => l.id !== id);
      db.attempts = db.attempts.filter((a) => a.lessonId !== id);
      save(db);
    },
    listLessons: async () => load().lessons.map((l) => ({ id: l.id, title: l.title, count: l.questions.length })),
    getLesson: async (id) => load().lessons.find((l) => l.id === id) ?? null,
    async findStudent(code) {
      const db = load();
      const s = db.students.find((x) => x.code === code.trim().toUpperCase());
      if (!s) return null;
      return { ...s, className: db.classes.find((c) => c.id === s.classId)?.name ?? '' };
    },
    async submitAttempt({ lessonId, studentCode, responses, durationSec }) {
      const db = load();
      const lesson = db.lessons.find((l) => l.id === lessonId);
      if (!lesson) throw new Error('Không tìm thấy bài học');
      const answers = lesson.questions.map((q, i) => {
        const g = grade(q, responses[i] ?? null);
        return { correct: g.correct, responseText: g.responseText };
      });
      const r = pushAttempt(db, lessonId, studentCode, answers, durationSec);
      save(db);
      return r;
    },
    demoCode: async () => load().students[0]?.code ?? null,
    hasStudents: async () => load().students.length > 0,
    async reset() {
      localStorage.removeItem(KEY);
    },

    /** Tạo sẵn 1 lớp, 1 bài mẫu và kết quả làm bài giả lập để xem thử báo cáo. */
    async seedDemo() {
      const db = empty();
      const c = { id: rid('c'), name: 'Lớp 3A' };
      db.classes.push(c);
      addNames(db, c.id, ['Nguyễn Minh Anh', 'Trần Gia Bảo', 'Lê Ngọc Châu', 'Phạm Đức Duy', 'Hoàng Thu Hà', 'Vũ Quang Khải', 'Đỗ Bảo Ngọc', 'Bùi Tuấn Phong', 'Đặng Mai Trang', 'Ngô Hải Yến']);
      const lesson: Lesson = { ...validateLesson(SAMPLE_LESSON).lesson!, id: rid('b'), createdAt: new Date().toISOString() };
      db.lessons.push(lesson);

      const ease = [0.95, 0.75, 0.8, 0.45, 0.7, 0.6, 0.3, 0.85, 0.65, 0.4];
      const wrongText = (q: Question): string => {
        switch (q.type) {
          case 'multiple_choice': {
            const others = q.options.filter((_, i) => i !== q.answer);
            return others[Math.random() < 0.7 ? 0 : others.length - 1];
          }
          case 'true_false':
            return q.answer ? 'Sai' : 'Đúng';
          case 'fill_blank':
            return Math.random() < 0.6 ? q.answer[0].slice(0, -1) : q.answer[0] + 's';
          case 'matching':
            return 'nối nhầm ' + q.pairs[0].left + ' → ' + q.pairs[1].right;
          case 'word_order':
            return q.answer.split(' ').reverse().join(' ');
        }
      };
      const simulate = (boost: number): Answer[] =>
        lesson.questions.map((q, i) => {
          const correct = Math.random() < Math.min(0.98, ease[i % ease.length] + boost);
          return { correct, responseText: correct ? answerText(q) : wrongText(q) };
        });
      db.students.slice(0, 8).forEach((s, i) => {
        const boost = (i % 4) * 0.08 - 0.1;
        // Rải các lượt nộp ra vài ngày để thử bộ lọc ngày
        const t = Date.now() - (i % 4) * 86400000 - (i + 1) * 37 * 60000;
        pushAttempt(db, lesson.id, s.code, simulate(boost), 180 + Math.floor(Math.random() * 240), new Date(t).toISOString());
        if (i % 3 === 0) pushAttempt(db, lesson.id, s.code, simulate(boost + 0.3), 150 + Math.floor(Math.random() * 120), new Date(t + 12 * 60000).toISOString());
      });
      save(db);
      return lesson;
    },
  };
}
