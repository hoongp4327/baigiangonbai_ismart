import type { Attempt, Db, Lesson, Question, Student } from '../types';
import { answerText } from './grade';

const pad = (n: number) => String(n).padStart(2, '0');
export const dayOfDate = (d: Date): string => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
/** Ngày theo giờ máy đang xem, dạng 2026-11-16. */
export const dayOf = (iso: string): string => dayOfDate(new Date(iso));
export const timeOf = (iso: string): string => {
  const d = new Date(iso);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};
export const showDay = (day: string): string => day.split('-').reverse().join('/');
export const fmtDuration = (s: number): string => Math.floor(s / 60) + 'p' + pad(s % 60);

export interface ReportFilter {
  lessonId: string;
  classId: string; // '' = tất cả các lớp
  from: string; // '' = không giới hạn
  to: string;
}
export interface StudentRow {
  student: Student;
  attempts: Attempt[]; // các lượt trong khoảng ngày, theo thứ tự làm
  first: Attempt | null; // lượt sớm nhất trong khoảng ngày: dùng để phân tích
  best: number | null;
}
export interface QuestionStat {
  index: number;
  question: Question;
  right: number;
  pct: number;
  topWrong: { text: string; count: number } | null;
}
export interface Report {
  lesson: Lesson;
  students: Student[];
  attempts: Attempt[]; // mọi lượt nộp khớp bộ lọc, cũ trước mới sau
  rows: StudentRow[]; // điểm lần đầu thấp xếp trước, chưa làm xếp cuối
  doneCount: number;
  average: number;
  questions: QuestionStat[]; // theo thứ tự trong bài
  hardest: QuestionStat[]; // tỉ lệ đúng thấp xếp trước
}

export function buildReport(db: Db, f: ReportFilter): Report | null {
  const lesson = db.lessons.find((l) => l.id === f.lessonId);
  if (!lesson) return null;
  const students = db.students.filter((s) => !f.classId || s.classId === f.classId);
  const codes = new Set(students.map((s) => s.code));
  const inRange = (a: Attempt) => {
    const d = dayOf(a.submittedAt);
    return (!f.from || d >= f.from) && (!f.to || d <= f.to);
  };
  const attempts = db.attempts
    .filter((a) => a.lessonId === lesson.id && codes.has(a.studentCode) && inRange(a))
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  const rows: StudentRow[] = students.map((student) => {
    const at = attempts.filter((a) => a.studentCode === student.code).sort((a, b) => a.attemptNo - b.attemptNo);
    return { student, attempts: at, first: at[0] ?? null, best: at.length ? Math.max(...at.map((a) => a.score)) : null };
  });
  const firsts = rows.flatMap((r) => (r.first ? [r.first] : []));

  const questions: QuestionStat[] = lesson.questions.map((question, index) => {
    const wrong = new Map<string, number>();
    let right = 0;
    for (const a of firsts) {
      const x = a.answers[index];
      if (x?.correct) right++;
      else {
        const text = x?.responseText || '(bỏ trống)';
        wrong.set(text, (wrong.get(text) ?? 0) + 1);
      }
    }
    const top = [...wrong.entries()].sort((a, b) => b[1] - a[1])[0];
    return { index, question, right, pct: firsts.length ? right / firsts.length : 0, topWrong: top ? { text: top[0], count: top[1] } : null };
  });

  return {
    lesson,
    students,
    attempts,
    rows: rows.slice().sort((a, b) => (a.first ? a.first.score : Infinity) - (b.first ? b.first.score : Infinity)),
    doneCount: firsts.length,
    average: firsts.length ? firsts.reduce((t, a) => t + a.score, 0) / firsts.length : 0,
    questions,
    hardest: questions.slice().sort((a, b) => a.pct - b.pct),
  };
}

export type Cell = string | number;
export interface ExportSheet {
  name: string;
  rows: Cell[][];
}

/** Dữ liệu xuất Excel: tab KetQua (mỗi lượt nộp một dòng), tab ChiTiet (mỗi câu trả lời một dòng). */
export function buildExport(db: Db, report: Report): ExportSheet[] {
  const { lesson } = report;
  const info = (code: string) => {
    const s = db.students.find((x) => x.code === code);
    const c = s && db.classes.find((x) => x.id === s.classId);
    return { name: s?.name ?? '', cls: c?.name ?? '' };
  };
  const summary: Cell[][] = [['Ngày', 'Giờ', 'Lớp', 'Mã HS', 'Họ tên', 'Bài học', 'Lần thứ', 'Điểm', 'Tổng số câu', 'Thời gian (giây)', ...lesson.questions.map((_, i) => 'C' + (i + 1))]];
  const detail: Cell[][] = [['Ngày', 'Lớp', 'Mã HS', 'Họ tên', 'Lần thứ', 'Câu', 'Đề bài', 'Kết quả', 'Trả lời của học sinh', 'Đáp án đúng']];
  for (const a of report.attempts) {
    const st = info(a.studentCode);
    const day = dayOf(a.submittedAt);
    summary.push([day, timeOf(a.submittedAt), st.cls, a.studentCode, st.name, lesson.title, a.attemptNo, a.score, a.total, a.durationSec, ...lesson.questions.map((_, i) => (a.answers[i]?.correct ? 'Đ' : 'S'))]);
    lesson.questions.forEach((q, i) => {
      const x = a.answers[i];
      detail.push([day, st.cls, a.studentCode, st.name, a.attemptNo, i + 1, q.prompt, x?.correct ? 'Đúng' : 'Sai', x?.responseText ?? '', answerText(q)]);
    });
  }
  return [
    { name: 'KetQua', rows: summary },
    { name: 'ChiTiet', rows: detail },
  ];
}

export function exportFileName(report: Report, f: ReportFilter): string {
  const title = report.lesson.title.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  return 'ketqua_' + title + '_' + (f.from || 'tat-ca') + (f.to && f.to !== f.from ? '_den_' + f.to : '');
}

/** Tải file .xlsx. Thư viện Excel chỉ được nạp khi giáo viên bấm nút xuất. */
export async function downloadExcel(sheets: ExportSheet[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  XLSX.writeFile(wb, fileName + '.xlsx');
}
