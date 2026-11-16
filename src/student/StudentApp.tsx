import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Lesson, LessonSummary, Response, StudentInfo, SubmitResult } from '../types';
import { SKILL_LABELS, grade, isAnswered, type Graded } from '../lib/grade';
import { hasAudio, speak, stopSpeaking } from '../lib/speak';
import { store } from '../store';
import { QuestionImage, QuestionInput } from './QuestionInput';

const STUDENT_KEY = 'bgs_student';
const lessonId = new URLSearchParams(location.search).get('bai');

type Screen =
  | { name: 'loading' }
  | { name: 'message'; emoji: string; title: string; text: string }
  | { name: 'home'; lessons: LessonSummary[] }
  | { name: 'login' }
  | { name: 'intro' }
  | { name: 'quiz'; run: number }
  | { name: 'result'; result: SubmitResult; grades: Graded[] };

const Center = ({ children }: { children: ReactNode }) => (
  <main className="kid">
    <div className="center">{children}</div>
  </main>
);

export function StudentApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const runs = useRef(0);

  useEffect(() => {
    (async () => {
      if (!lessonId) return setScreen({ name: 'home', lessons: await store.listLessons() });
      const l = await store.getLesson(lessonId);
      if (!l) return setScreen({ name: 'message', emoji: '🔍', title: 'Không tìm thấy bài học', text: 'Em hãy hỏi lại thầy cô đường link nhé.' });
      setLesson(l);
      const saved = localStorage.getItem(STUDENT_KEY);
      const s = saved ? await store.findStudent(saved) : null;
      setStudent(s);
      setScreen(s ? { name: 'intro' } : { name: 'login' });
    })().catch((e: Error) => setScreen({ name: 'message', emoji: '📡', title: 'Chưa tải được', text: e.message + ' Em thử tải lại trang nhé.' }));
  }, []);

  const start = () => setScreen({ name: 'quiz', run: ++runs.current });

  switch (screen.name) {
    case 'loading':
      return (
        <Center>
          <div className="big-emoji">⏳</div>
          <h1>Đang tải...</h1>
          <p className="muted">Em chờ một chút nhé.</p>
        </Center>
      );
    case 'message':
      return (
        <Center>
          <div className="big-emoji">{screen.emoji}</div>
          <h1>{screen.title}</h1>
          <p className="muted">{screen.text}</p>
        </Center>
      );
    case 'home':
      return <Home lessons={screen.lessons} />;
    case 'login':
      return (
        <Login
          onDone={(s) => {
            localStorage.setItem(STUDENT_KEY, s.code);
            setStudent(s);
            setScreen({ name: 'intro' });
          }}
        />
      );
    case 'intro':
      return (
        <Center>
          <div className="big-emoji">🦊</div>
          <h1>Chào {student!.name}!</h1>
          <p className="muted">{student!.className}</p>
          <div className="card" style={{ margin: '18px 0' }}>
            <h2>{lesson!.title}</h2>
            {lesson!.description && <p>{lesson!.description}</p>}
            <p className="muted" style={{ margin: 0 }}>
              {lesson!.questions.length} câu hỏi · làm lại bao nhiêu lần cũng được
            </p>
          </div>
          <button className="btn green" onClick={start}>
            Bắt đầu ▶
          </button>
          <p className="small" style={{ marginTop: 18 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                localStorage.removeItem(STUDENT_KEY);
                setStudent(null);
                setScreen({ name: 'login' });
              }}
            >
              Không phải {student!.name}? Đổi mã
            </a>
          </p>
        </Center>
      );
    case 'quiz':
      return <Quiz key={screen.run} lesson={lesson!} student={student!} onDone={(result, grades) => setScreen({ name: 'result', result, grades })} />;
    case 'result':
      return <Result lesson={lesson!} result={screen.result} grades={screen.grades} onAgain={start} />;
  }
}

function Home({ lessons }: { lessons: LessonSummary[] }) {
  return (
    <Center>
      <div className="big-emoji">📚</div>
      <h1>Bài Giảng Số</h1>
      <p className="muted">Ôn tập tiếng Anh tại nhà</p>
      <div className="card">
        {lessons.length ? (
          <>
            <h3>Bài ôn tập</h3>
            <div className="lesson-list">
              {lessons.map((l) => (
                <a key={l.id} href={'?bai=' + encodeURIComponent(l.id)}>
                  {l.title} <span className="muted small">· {l.count} câu</span>
                </a>
              ))}
            </div>
          </>
        ) : (
          <p>Chưa có bài học nào. Vào trang giáo viên để tạo bài.</p>
        )}
      </div>
      <p style={{ marginTop: 22 }}>
        <a className="btn ghost" href="admin.html">
          👩‍🏫 Trang giáo viên
        </a>
      </p>
    </Center>
  );
}

function Login({ onDone }: { onDone: (s: StudentInfo) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const [hasStudents, setHasStudents] = useState(true);

  useEffect(() => {
    void store.demoCode().then(setDemo);
    void store.hasStudents().then(setHasStudents);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const s = await store.findStudent(code);
      if (s) onDone(s);
      else setError('Mã chưa đúng, em kiểm tra lại nhé.');
    } catch (ex) {
      setError((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Center>
      <div className="big-emoji">👋</div>
      <h1>Chào em!</h1>
      <p>
        Nhập <b>mã học sinh</b> thầy cô đã phát cho em.
      </p>
      <form onSubmit={submit}>
        <input className="code-input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} placeholder="HS0000" autoComplete="off" autoFocus />
        <p className="err">{error}</p>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Đang kiểm tra...' : 'Vào học'}
        </button>
      </form>
      {demo && (
        <p className="muted small" style={{ marginTop: 20 }}>
          Bản demo: thử mã <b>{demo}</b>
        </p>
      )}
      {!hasStudents && (
        <p className="err" style={{ marginTop: 20 }}>
          Chưa có học sinh nào trong hệ thống. Giáo viên cần tạo lớp ở <a href="admin.html#classes">trang giáo viên</a> trước.
        </p>
      )}
    </Center>
  );
}

function Quiz({ lesson, student, onDone }: { lesson: Lesson; student: StudentInfo; onDone: (r: SubmitResult, grades: Graded[]) => void }) {
  const total = lesson.questions.length;
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<Response>(null);
  const [checked, setChecked] = useState<Graded | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const responses = useRef<Response[]>([]);
  const grades = useRef<Graded[]>([]);
  const startedAt = useRef(Date.now());
  const nextButton = useRef<HTMLButtonElement>(null);

  const q = lesson.questions[index];
  const last = index === total - 1;

  // Sang câu mới: cuộn lên đầu và tự phát phần nghe
  useEffect(() => {
    window.scrollTo(0, 0);
    if (hasAudio(q)) speak(q);
    return stopSpeaking;
  }, [q]);
  useEffect(() => {
    if (checked) nextButton.current?.focus();
  }, [checked]);

  const check = () => {
    const g = grade(q, value);
    responses.current[index] = value;
    grades.current[index] = g;
    setChecked(g);
  };

  // Nộp bài. Nếu mạng lỗi thì giữ nguyên bài làm để em bấm nộp lại.
  const submit = async () => {
    setSending(true);
    setSendError('');
    try {
      const result = await store.submitAttempt({ lessonId: lesson.id, studentCode: student.code, responses: responses.current, durationSec: Math.round((Date.now() - startedAt.current) / 1000) });
      onDone(result, grades.current);
    } catch (e) {
      setSendError('Chưa nộp được bài. ' + (e as Error).message);
      setSending(false);
    }
  };

  const next = () => {
    if (last) return void submit();
    setIndex(index + 1);
    setValue(null);
    setChecked(null);
  };

  return (
    <main className="kid">
      <div className="topbar">
        <div className="bar">
          <i style={{ width: (index / total) * 100 + '%' }} />
        </div>
        <span className="count">
          {index + 1}/{total}
        </span>
      </div>
      <div className="card">
        <span className="badge">{SKILL_LABELS[q.skill]}</span>
        {q.passage && <div className="passage">{q.passage}</div>}
        <p className="q-prompt">{q.prompt}</p>
        {hasAudio(q) && (
          <button type="button" className="audio-btn" onClick={() => speak(q)}>
            🔊 Nghe
          </button>
        )}
        <QuestionImage image={q.image} />
        <QuestionInput key={index} q={q} value={value} onChange={setValue} locked={!!checked} />
      </div>
      <div className="footer">
        {checked ? (
          <>
            <div className={'feedback ' + (checked.correct ? 'ok' : 'bad')}>
              <b>{checked.correct ? '🎉 Giỏi lắm!' : '😅 Chưa đúng rồi'}</b>
              {!checked.correct && <span>Đáp án đúng: {checked.correctText}</span>}
              {q.explanation && <span>{q.explanation}</span>}
            </div>
            {sendError && (
              <p className="err" style={{ textAlign: 'center' }}>
                {sendError}
              </p>
            )}
            <button ref={nextButton} className={'btn' + (checked.correct ? ' green' : '')} disabled={sending} onClick={next}>
              {sending ? 'Đang nộp bài...' : sendError ? 'Nộp lại' : last ? 'Nộp bài' : 'Tiếp theo ▶'}
            </button>
          </>
        ) : (
          <button className="btn" disabled={!isAnswered(q, value)} onClick={check}>
            Kiểm tra
          </button>
        )}
      </div>
    </main>
  );
}

function Result({ lesson, result, grades, onAgain }: { lesson: Lesson; result: SubmitResult; grades: Graded[]; onAgain: () => void }) {
  const a = result.attempt;
  const pct = a.total ? a.score / a.total : 0;
  const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : pct > 0 ? 1 : 0;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <Center>
      <div className="stars">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= stars ? '' : 'off'}>
            ⭐
          </span>
        ))}
      </div>
      <h1>{stars === 3 ? 'Xuất sắc!' : stars === 2 ? 'Làm tốt lắm!' : 'Cố gắng thêm nhé!'}</h1>
      <div className="score">
        {a.score}/{a.total}
      </div>
      <p className="muted">
        Lần làm thứ {a.attemptNo} · Điểm cao nhất của em: {result.best}/{a.total}
      </p>
      <div className="review">
        {lesson.questions.map((q, i) => (
          <div key={i} className={grades[i]?.correct ? 'ok' : 'bad'}>
            <b>Câu {i + 1}.</b> {q.prompt}
            {!grades[i]?.correct && (
              <>
                <br />
                <span className="muted">Đáp án đúng: {grades[i]?.correctText}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn" onClick={onAgain}>
          🔁 Làm lại
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        Bài của em đã được gửi cho thầy cô.
      </p>
    </Center>
  );
}
