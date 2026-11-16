export type Skill = 'vocabulary' | 'grammar' | 'listening' | 'reading' | 'writing';
export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching' | 'word_order';

interface QuestionBase {
  skill: Skill;
  prompt: string;
  passage: string;
  image: string;
  audio_text: string;
  audio_url: string;
  explanation: string;
}

export type Question =
  | (QuestionBase & { type: 'multiple_choice'; options: string[]; answer: number })
  | (QuestionBase & { type: 'true_false'; answer: boolean })
  | (QuestionBase & { type: 'fill_blank'; answer: string[] })
  | (QuestionBase & { type: 'matching'; pairs: { left: string; right: string }[] })
  | (QuestionBase & { type: 'word_order'; answer: string });

/** Câu trả lời thô của học sinh: vị trí lựa chọn, đúng/sai, chữ gõ vào, hoặc mảng nối cặp. */
export type Response = number | boolean | string | (number | null)[] | null;

export interface LessonInput {
  title: string;
  grade: string;
  unit: string;
  description: string;
  questions: Question[];
}
export interface Lesson extends LessonInput {
  id: string;
  createdAt: string;
}
export interface LessonSummary {
  id: string;
  title: string;
  count: number;
}

export interface ClassRoom {
  id: string;
  name: string;
}
export interface Student {
  code: string;
  name: string;
  classId: string;
}
export interface StudentInfo extends Student {
  className: string;
}

export interface Answer {
  correct: boolean;
  responseText: string;
}
export interface AttemptSummary {
  id: string;
  lessonId: string;
  studentCode: string;
  attemptNo: number;
  score: number;
  total: number;
  durationSec: number;
  submittedAt: string;
}
export interface Attempt extends AttemptSummary {
  answers: Answer[];
}
export interface SubmitResult {
  attempt: AttemptSummary;
  best: number;
}

export interface Db {
  classes: ClassRoom[];
  students: Student[];
  lessons: Lesson[];
  attempts: Attempt[];
}

/** Lớp dữ liệu. Có hai bản: lưu trong trình duyệt (demo) và Google Sheets. */
export interface Store {
  remote: boolean;
  // Giáo viên
  hasKey(): boolean;
  setKey(key: string): void;
  clearKey(): void;
  getAll(): Promise<Db>;
  createClass(name: string, names: string[]): Promise<unknown>;
  addStudents(classId: string, names: string[]): Promise<unknown>;
  deleteClass(id: string): Promise<unknown>;
  saveLesson(lesson: LessonInput): Promise<unknown>;
  deleteLesson(id: string): Promise<unknown>;
  // Học sinh
  listLessons(): Promise<LessonSummary[]>;
  getLesson(id: string): Promise<Lesson | null>;
  findStudent(code: string): Promise<StudentInfo | null>;
  submitAttempt(a: { lessonId: string; studentCode: string; responses: Response[]; durationSec: number }): Promise<SubmitResult>;
  demoCode(): Promise<string | null>;
  hasStudents(): Promise<boolean>;
  // Chỉ có ở bản demo
  seedDemo?(): Promise<Lesson>;
  reset?(): Promise<void>;
}
