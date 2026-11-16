import type { Question, QuestionType, Response, Skill } from '../types';

/* Quy tắc chấm ở đây phải khớp với hàm grade() trong apps-script/Code.gs,
   vì điểm chính thức được chấm lại trên máy chủ khi nộp bài. */

export const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Trắc nghiệm',
  true_false: 'Đúng / Sai',
  fill_blank: 'Điền từ',
  matching: 'Nối cặp',
  word_order: 'Sắp xếp câu',
};
export const SKILL_LABELS: Record<Skill, string> = {
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  listening: 'Nghe',
  reading: 'Đọc',
  writing: 'Viết',
};

/** Chuẩn hoá để so sánh: không phân biệt hoa thường, khoảng trắng thừa, dấu câu cuối. */
export function norm(s: unknown): string {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[.,!?;:]+$/g, '');
}

export const words = (sentence: string): string[] => sentence.trim().split(/\s+/);

export function answerText(q: Question): string {
  switch (q.type) {
    case 'multiple_choice':
      return q.options[q.answer];
    case 'true_false':
      return q.answer ? 'Đúng' : 'Sai';
    case 'fill_blank':
      return q.answer[0];
    case 'matching':
      return q.pairs.map((p) => p.left + ' → ' + p.right).join(', ');
    case 'word_order':
      return q.answer;
  }
}

/** Học sinh đã trả lời đủ để bấm "Kiểm tra" chưa. */
export function isAnswered(q: Question, resp: Response): boolean {
  switch (q.type) {
    case 'multiple_choice':
      return typeof resp === 'number';
    case 'true_false':
      return typeof resp === 'boolean';
    case 'fill_blank':
      return typeof resp === 'string' && resp.trim() !== '';
    case 'matching':
      return Array.isArray(resp) && resp.length === q.pairs.length && resp.every((x) => x != null);
    case 'word_order':
      return typeof resp === 'string' && resp.trim() !== '' && words(resp).length === words(q.answer).length;
  }
}

export interface Graded {
  correct: boolean;
  correctText: string;
  responseText: string;
}

export function grade(q: Question, resp: Response): Graded {
  const correctText = answerText(q);
  switch (q.type) {
    case 'multiple_choice':
      return { correct: resp === q.answer, correctText, responseText: typeof resp === 'number' ? (q.options[resp] ?? '') : '' };
    case 'true_false':
      return { correct: resp === q.answer, correctText, responseText: typeof resp === 'boolean' ? (resp ? 'Đúng' : 'Sai') : '' };
    case 'fill_blank':
      return { correct: q.answer.map(norm).includes(norm(resp)), correctText, responseText: typeof resp === 'string' ? resp.trim() : '' };
    case 'matching': {
      const r = Array.isArray(resp) ? resp : [];
      return {
        correct: q.pairs.every((_, i) => r[i] === i),
        correctText,
        responseText: q.pairs.map((p, i) => p.left + ' → ' + (r[i] == null || !q.pairs[r[i] as number] ? '?' : q.pairs[r[i] as number].right)).join(', '),
      };
    }
    case 'word_order':
      return { correct: norm(resp) === norm(q.answer), correctText, responseText: typeof resp === 'string' ? resp : '' };
  }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
