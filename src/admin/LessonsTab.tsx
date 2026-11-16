import { useState, type ChangeEvent } from 'react';
import type { LessonInput } from '../types';
import { SKILL_LABELS, TYPE_LABELS, answerText } from '../lib/grade';
import { hasAudio } from '../lib/speak';
import { parseLessonText } from '../lib/validate';
import { DEFAULT_PROMPT, SAMPLE_LESSON } from '../lib/sample';
import { store } from '../store';
import type { TabProps } from './AdminApp';
import { copyText, lessonUrl, toast } from './ui';

const PROMPT_KEY = 'bgs_prompt';

export function LessonsTab({ db, act, openReport }: TabProps & { openReport: (lessonId: string) => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<LessonInput | null>(null);
  const [saving, setSaving] = useState(false);

  const check = (source: string) => {
    const v = parseLessonText(source);
    setErrors(v.errors);
    setPending(v.lesson);
  };
  const edit = (value: string) => {
    setText(value);
    setPending(null);
    setErrors([]);
  };
  const load = (value: string) => {
    setText(value);
    check(value);
  };
  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    void f.text().then(load);
    e.target.value = '';
  };
  const save = async () => {
    if (!pending) return;
    setSaving(true);
    if (await act(() => store.saveLesson(pending), 'Đã lưu bài học')) edit('');
    setSaving(false);
  };

  return (
    <>
      <PromptEditor />

      <div className="panel">
        <h2>Tạo bài ôn tập mới</h2>
        <p className="muted small">Dán khối JSON mà AI trả về vào ô dưới đây, hoặc chọn file .json.</p>
        <textarea className="json" value={text} onChange={(e) => edit(e.target.value)} placeholder={'{ "title": "...", "questions": [ ... ] }'} />
        <div className="tools">
          <button className="btn sm" disabled={!text.trim()} onClick={() => check(text)}>
            Xem trước
          </button>
          <button className="btn sm green" disabled={!pending || saving} onClick={() => void save()}>
            {saving ? 'Đang lưu…' : 'Lưu bài học'}
          </button>
          <label className="btn sm ghost">
            Chọn file .json
            <input type="file" accept=".json,application/json,text/plain" hidden onChange={pickFile} />
          </label>
          <button className="btn sm ghost" onClick={() => load(JSON.stringify(SAMPLE_LESSON, null, 2))}>
            Dùng thử bài mẫu
          </button>
        </div>
        {errors.length > 0 && (
          <div className="errors">
            <b>Cần sửa {errors.length} lỗi:</b>
            <ul>
              {errors.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        )}
        {pending && (
          <>
            <div className="okbox">
              Hợp lệ: “{pending.title}” · {pending.questions.length} câu. Kiểm tra đáp án bên dưới rồi bấm Lưu bài học.
            </div>
            <Preview lesson={pending} />
          </>
        )}
      </div>

      <div className="panel">
        <h2>Bài học đã lưu ({db.lessons.length})</h2>
        {db.lessons.length ? (
          <div className="matrix-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bài</th>
                  <th>Số câu</th>
                  <th>Link gửi học sinh</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {db.lessons
                  .slice()
                  .reverse()
                  .map((l) => {
                    const done = new Set(db.attempts.filter((a) => a.lessonId === l.id).map((a) => a.studentCode)).size;
                    const url = lessonUrl(l.id);
                    return (
                      <tr key={l.id}>
                        <td>
                          <b>{l.title}</b>
                          <br />
                          <span className="muted small">
                            {l.grade ? 'Lớp ' + l.grade + ' · ' : ''}
                            {done} học sinh đã làm
                          </span>
                        </td>
                        <td>{l.questions.length}</td>
                        <td>
                          <div className="linkbox">
                            <input readOnly value={url} onFocus={(e) => e.target.select()} />
                            <button className="btn sm" onClick={() => copyText(url, 'Đã copy link bài học')}>
                              Copy
                            </button>
                            <a className="btn sm ghost" target="_blank" rel="noreferrer" href={url}>
                              Mở
                            </a>
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn sm ghost" onClick={() => openReport(l.id)}>
                            Báo cáo
                          </button>{' '}
                          <button className="btn sm danger" onClick={() => confirm('Xoá bài “' + l.title + '” và toàn bộ kết quả của nó?') && void act(() => store.deleteLesson(l.id), 'Đã xoá bài học')}>
                            Xoá
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Chưa có bài nào.</p>
        )}
      </div>
    </>
  );
}

/** Prompt gửi cho AI. Giáo viên sửa được theo nhu cầu; bản đã sửa lưu trong trình duyệt này. */
function PromptEditor() {
  const [saved, setSaved] = useState(() => localStorage.getItem(PROMPT_KEY));
  const [draft, setDraft] = useState(saved ?? DEFAULT_PROMPT);
  const [open, setOpen] = useState(false);
  const dirty = draft !== (saved ?? DEFAULT_PROMPT);

  const save = () => {
    if (draft === DEFAULT_PROMPT) localStorage.removeItem(PROMPT_KEY);
    else localStorage.setItem(PROMPT_KEY, draft);
    setSaved(draft === DEFAULT_PROMPT ? null : draft);
    toast('Đã lưu prompt');
  };
  const restore = () => {
    if (!confirm('Bỏ bản prompt đã sửa và quay về prompt mặc định?')) return;
    localStorage.removeItem(PROMPT_KEY);
    setSaved(null);
    setDraft(DEFAULT_PROMPT);
  };

  return (
    <div className="panel">
      <div className="tools" style={{ margin: 0 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0 }}>Prompt cho AI {saved != null && <span className="tag">đã sửa</span>}</h2>
          <span className="muted small">Copy prompt, dán vào ChatGPT / Gemini / Claude kèm ảnh trang sách, rồi lấy JSON về.</span>
        </div>
        <button className="btn sm" onClick={() => copyText(draft, 'Đã copy prompt')}>
          Copy prompt
        </button>
        <button className="btn sm ghost" onClick={() => setOpen(!open)}>
          {open ? 'Đóng' : 'Xem / sửa prompt'}
        </button>
      </div>
      {open && (
        <>
          <textarea className="json prompt" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
          <div className="tools">
            <button className="btn sm green" disabled={!dirty} onClick={save}>
              Lưu thay đổi
            </button>
            <button className="btn sm ghost" disabled={saved == null && !dirty} onClick={restore}>
              Khôi phục mặc định
            </button>
            <span className="muted small">Giữ nguyên phần mô tả cấu trúc JSON và 5 dạng bài, nếu không file AI trả về sẽ không import được. Bản đã sửa chỉ lưu trên trình duyệt này.</span>
          </div>
        </>
      )}
    </div>
  );
}

function Preview({ lesson }: { lesson: LessonInput }) {
  return (
    <>
      {lesson.questions.map((q, i) => (
        <div className="pv" key={i}>
          <div className="meta">
            Câu {i + 1} · {TYPE_LABELS[q.type]} · {SKILL_LABELS[q.skill]}
            {hasAudio(q) ? ' · 🔊 có nghe' : ''}
          </div>
          {q.passage && <div className="muted">{q.passage}</div>}
          <div>
            <b>{q.prompt}</b> {q.image && !/^(https?:|data:)/.test(q.image) ? q.image : ''}
          </div>
          {q.audio_text && <div className="muted">Máy đọc: “{q.audio_text}”</div>}
          {q.type === 'multiple_choice' && <div className="muted">{q.options.join('  |  ')}</div>}
          <div className="ans">✔ {q.type === 'fill_blank' ? q.answer.join(' / ') : answerText(q)}</div>
        </div>
      ))}
    </>
  );
}
