import type { LessonInput, Question, Skill } from '../types';
import { SKILL_LABELS, TYPE_LABELS, norm } from './grade';

export interface Validation {
  errors: string[];
  lesson: LessonInput | null;
}

const str = (v: unknown): string => (v == null ? '' : String(v));
type Raw = Record<string, unknown>;

/** Kiểm tra và chuẩn hoá JSON bài học do AI xuất ra. */
export function validateLesson(raw: unknown): Validation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['File phải là một đối tượng JSON { ... }.'], lesson: null };
  const r = raw as Raw;
  const errors: string[] = [];
  const lesson: LessonInput = { title: str(r.title).trim(), grade: str(r.grade), unit: str(r.unit).trim(), description: str(r.description).trim(), questions: [] };
  if (!lesson.title) errors.push('Thiếu tên bài học ("title").');
  if (!Array.isArray(r.questions) || !r.questions.length) {
    errors.push('Thiếu danh sách câu hỏi ("questions").');
    return { errors, lesson: null };
  }

  r.questions.forEach((item: unknown, i: number) => {
    const n = 'Câu ' + (i + 1) + ': ';
    if (!item || typeof item !== 'object') return void errors.push(n + 'không hợp lệ.');
    const x = item as Raw;
    const type = str(x.type);
    if (!(type in TYPE_LABELS)) return void errors.push(n + 'dạng bài "' + type + '" chưa được hỗ trợ.');
    const base = {
      skill: (str(x.skill) in SKILL_LABELS ? str(x.skill) : 'vocabulary') as Skill,
      prompt: str(x.prompt).trim(),
      passage: str(x.passage),
      image: str(x.image),
      audio_text: str(x.audio_text),
      audio_url: str(x.audio_url),
      explanation: str(x.explanation),
    };
    if (!base.prompt) errors.push(n + 'thiếu đề bài ("prompt").');

    let q: Question | null = null;
    if (type === 'multiple_choice') {
      if (!Array.isArray(x.options) || x.options.length < 2) return void errors.push(n + 'cần ít nhất 2 lựa chọn ("options").');
      const options = x.options.map(str);
      let a: unknown = x.answer;
      if (typeof a === 'string') {
        const text = a;
        const idx = options.findIndex((o) => norm(o) === norm(text));
        a = idx >= 0 ? idx : Number(text);
      }
      if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a >= options.length) return void errors.push(n + '"answer" phải là vị trí đáp án đúng (bắt đầu từ 0).');
      q = { ...base, type, options, answer: a };
    } else if (type === 'true_false') {
      let a: unknown = x.answer;
      if (typeof a === 'string') a = a.toLowerCase() === 'true' ? true : a.toLowerCase() === 'false' ? false : null;
      if (typeof a !== 'boolean') return void errors.push(n + '"answer" phải là true hoặc false.');
      q = { ...base, type, answer: a };
    } else if (type === 'fill_blank') {
      const a = (Array.isArray(x.answer) ? x.answer : [x.answer]).map(str).filter((s) => s.trim());
      if (!a.length) return void errors.push(n + 'thiếu đáp án ("answer").');
      q = { ...base, type, answer: a };
    } else if (type === 'matching') {
      if (!Array.isArray(x.pairs) || x.pairs.length < 2) return void errors.push(n + 'cần ít nhất 2 cặp ("pairs").');
      const pairs = x.pairs as Raw[];
      if (pairs.some((p) => !p || p.left == null || p.right == null)) return void errors.push(n + 'mỗi cặp cần "left" và "right".');
      q = { ...base, type, pairs: pairs.map((p) => ({ left: str(p.left), right: str(p.right) })) };
    } else if (type === 'word_order') {
      const a = str(x.answer).trim();
      if (a.split(/\s+/).length < 2) return void errors.push(n + '"answer" phải là một câu có ít nhất 2 từ.');
      q = { ...base, type, answer: a };
    }
    if (q) lesson.questions.push(q);
  });
  return { errors, lesson: errors.length ? null : lesson };
}

/** Đọc văn bản giáo viên dán vào. AI hay bọc JSON trong ```json ... ``` nên tự gỡ bỏ. */
export function parseLessonText(text: string): Validation {
  let t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) t = fenced[1].trim();
  let raw: unknown;
  try {
    raw = JSON.parse(t);
  } catch (e) {
    return { errors: ['Không đọc được JSON. Hãy copy lại toàn bộ khối JSON từ AI. (' + (e as Error).message + ')'], lesson: null };
  }
  return validateLesson(raw);
}
