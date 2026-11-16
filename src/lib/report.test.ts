import { describe, expect, it } from 'vitest';
import type { Attempt, Db } from '../types';
import { buildExport, buildReport, dayOf, exportFileName } from './report';
import { validateLesson } from './validate';

const lessonInput = validateLesson({
  title: 'Unit 5 - My Pets',
  questions: [
    { type: 'multiple_choice', prompt: 'Q1', options: ['cat', 'dog', 'bird'], answer: 1 },
    { type: 'fill_blank', prompt: 'Q2', answer: ['cats'] },
    { type: 'true_false', prompt: 'Q3', answer: true },
  ],
}).lesson!;

// Dùng giờ địa phương giữa trưa để ngày không lệch theo múi giờ của máy chạy kiểm thử
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
let n = 0;
const attempt = (studentCode: string, attemptNo: number, day: string, marks: [boolean, string][]): Attempt => ({
  id: 'n' + ++n,
  lessonId: 'b1',
  studentCode,
  attemptNo,
  score: marks.filter((m) => m[0]).length,
  total: marks.length,
  durationSec: 100,
  submittedAt: at(day),
  answers: marks.map(([correct, responseText]) => ({ correct, responseText })),
});

const db: Db = {
  classes: [
    { id: 'c1', name: '3A' },
    { id: 'c2', name: '3B' },
  ],
  students: [
    { code: 'HS1', name: 'An', classId: 'c1' },
    { code: 'HS2', name: 'Bình', classId: 'c1' },
    { code: 'HS3', name: 'Chi', classId: 'c1' },
    { code: 'HS4', name: 'Dũng', classId: 'c2' },
  ],
  lessons: [{ ...lessonInput, id: 'b1', createdAt: at('2026-11-01') }],
  attempts: [
    attempt('HS1', 1, '2026-11-14', [[true, 'dog'], [false, 'cat'], [false, 'Sai']]),
    attempt('HS1', 2, '2026-11-15', [[true, 'dog'], [true, 'cats'], [true, 'Đúng']]),
    attempt('HS2', 1, '2026-11-15', [[true, 'dog'], [false, 'cat'], [true, 'Đúng']]),
    attempt('HS4', 1, '2026-11-15', [[false, 'cat'], [false, 'catz'], [true, 'Đúng']]),
    { ...attempt('HS2', 1, '2026-11-15', [[true, 'x']]), lessonId: 'bai-khac' },
  ],
};
const all = { lessonId: 'b1', classId: '', from: '', to: '' };

describe('buildReport', () => {
  it('phân tích theo lần làm đầu tiên, vẫn ghi nhận điểm cao nhất', () => {
    const r = buildReport(db, all)!;
    expect(r.doneCount).toBe(3);
    expect(r.attempts).toHaveLength(4);
    expect(r.average).toBeCloseTo((1 + 2 + 1) / 3);
    const an = r.rows.find((x) => x.student.code === 'HS1')!;
    expect(an.first?.score).toBe(1);
    expect(an.best).toBe(3);
    expect(an.attempts).toHaveLength(2);
  });
  it('tính tỉ lệ đúng và câu trả lời sai phổ biến nhất của từng câu', () => {
    const r = buildReport(db, all)!;
    expect(r.questions.map((q) => q.right)).toEqual([2, 0, 2]);
    expect(r.questions[1].topWrong).toEqual({ text: 'cat', count: 2 });
    expect(r.questions[0].topWrong).toEqual({ text: 'cat', count: 1 });
    expect(r.hardest[0].index).toBe(1);
  });
  it('học sinh chưa làm xếp cuối, điểm thấp xếp trước', () => {
    const r = buildReport(db, all)!;
    expect(r.rows.at(-1)!.student.code).toBe('HS3');
    expect(r.rows.at(-1)!.first).toBeNull();
    expect(r.rows[0].first!.score).toBeLessThanOrEqual(r.rows[1].first!.score);
  });
  it('lọc theo lớp', () => {
    const r = buildReport(db, { ...all, classId: 'c1' })!;
    expect(r.students).toHaveLength(3);
    expect(r.doneCount).toBe(2);
    expect(r.questions[1].topWrong).toEqual({ text: 'cat', count: 2 });
  });
  it('lọc theo ngày: lần đầu là lần sớm nhất trong khoảng ngày', () => {
    const r = buildReport(db, { ...all, from: '2026-11-15', to: '2026-11-15' })!;
    expect(r.attempts).toHaveLength(3);
    const an = r.rows.find((x) => x.student.code === 'HS1')!;
    expect(an.first?.attemptNo).toBe(2);
    expect(an.first?.score).toBe(3);
    expect(buildReport(db, { ...all, from: '2026-11-14', to: '2026-11-14' })!.doneCount).toBe(1);
    expect(buildReport(db, { ...all, from: '2026-11-16' })!.doneCount).toBe(0);
  });
  it('trả về null khi không có bài học', () => {
    expect(buildReport(db, { ...all, lessonId: 'khong-co' })).toBeNull();
  });
});

describe('buildExport', () => {
  it('mỗi lượt nộp một dòng, mỗi câu trả lời một dòng', () => {
    const f = { ...all, from: '2026-11-15', to: '2026-11-15' };
    const r = buildReport(db, f)!;
    const [summary, detail] = buildExport(db, r);
    expect(summary.name).toBe('KetQua');
    expect(summary.rows).toHaveLength(1 + 3);
    expect(summary.rows[0].slice(-3)).toEqual(['C1', 'C2', 'C3']);
    expect(summary.rows.every((row) => row.length === summary.rows[0].length)).toBe(true);
    const dung = summary.rows.find((row) => row[3] === 'HS4')!;
    expect(dung.slice(0, 3)).toEqual(['2026-11-15', '12:00', '3B']);
    expect(dung.slice(-3)).toEqual(['S', 'S', 'Đ']);
    expect(detail.rows).toHaveLength(1 + 3 * 3);
    expect(detail.rows.find((row) => row[2] === 'HS4' && row[5] === 2)).toEqual(['2026-11-15', '3B', 'HS4', 'Dũng', 1, 2, 'Q2', 'Sai', 'catz', 'cats']);
    expect(exportFileName(r, f)).toBe('ketqua_Unit_5_My_Pets_2026-11-15');
    expect(exportFileName(r, { ...f, from: '2026-11-10' })).toBe('ketqua_Unit_5_My_Pets_2026-11-10_den_2026-11-15');
    expect(exportFileName(r, all)).toBe('ketqua_Unit_5_My_Pets_tat-ca');
  });
});

describe('dayOf', () => {
  it('lấy ngày theo giờ địa phương', () => {
    expect(dayOf(at('2026-01-05', 23))).toBe('2026-01-05');
    expect(dayOf(at('2026-01-05', 0))).toBe('2026-01-05');
  });
});
