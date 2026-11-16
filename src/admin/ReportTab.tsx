import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Db, Lesson } from '../types';
import { SKILL_LABELS, TYPE_LABELS, answerText } from '../lib/grade';
import { buildExport, buildReport, dayOf, dayOfDate, downloadExcel, exportFileName, fmtDuration, showDay, timeOf, type ReportFilter, type StudentRow } from '../lib/report';
import { toast } from './ui';

const color = (p: number) => (p >= 0.75 ? '#22b35e' : p >= 0.5 ? '#f0a92b' : '#e5484d');

export function ReportTab({ db, filter, setFilter }: { db: Db; filter: ReportFilter; setFilter: (f: ReportFilter) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Chưa chọn bài (hoặc bài đã bị xoá) thì lấy bài mới nhất
  const lessonId = db.lessons.some((l) => l.id === filter.lessonId) ? filter.lessonId : (db.lessons.at(-1)?.id ?? '');
  const classId = db.classes.some((c) => c.id === filter.classId) ? filter.classId : '';
  const f = useMemo(() => ({ ...filter, lessonId, classId }), [filter, lessonId, classId]);
  const report = useMemo(() => buildReport(db, f), [db, f]);
  useEffect(() => {
    setOpen(null);
  }, [f]);

  if (!report) {
    return (
      <div className="panel">
        <h2>Báo cáo</h2>
        <p className="muted">Chưa có bài học nào.{db.lessons.length === 0 && ' Vào tab “Bài học” để tạo bài trước.'}</p>
      </div>
    );
  }

  const { lesson } = report;
  const n = lesson.questions.length;
  const ranged = !!(f.from || f.to);
  const today = dayOfDate(new Date());
  const setRange = (from: string, to: string) => setFilter({ ...f, from, to });
  const any = report.doneCount > 0;
  const hardest = report.hardest[0];
  const easiest = report.hardest[n - 1];

  const doExport = async () => {
    setExporting(true);
    try {
      await downloadExcel(buildExport(db, report), exportFileName(report, f));
    } catch (e) {
      toast('Không xuất được Excel: ' + (e as Error).message);
    }
    setExporting(false);
  };

  return (
    <>
      <div className="panel">
        <div className="grid2">
          <label className="field">
            <span>Bài học</span>
            <select value={lessonId} onChange={(e) => setFilter({ ...f, lessonId: e.target.value })}>
              {db.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Lớp</span>
            <select value={classId} onChange={(e) => setFilter({ ...f, classId: e.target.value })}>
              <option value="">Tất cả các lớp</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tools">
          <b>Ngày nộp bài:</b> từ <input type="date" value={f.from} onChange={(e) => setRange(e.target.value, f.to)} /> đến <input type="date" value={f.to} onChange={(e) => setRange(f.from, e.target.value)} />
          <button className="btn sm ghost" onClick={() => setRange(today, today)}>
            Hôm nay
          </button>
          <button className="btn sm ghost" onClick={() => setRange(dayOfDate(new Date(Date.now() - 6 * 86400000)), today)}>
            7 ngày qua
          </button>
          <button className="btn sm ghost" onClick={() => setRange('', '')}>
            Tất cả
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn sm green" disabled={!report.attempts.length || exporting} onClick={() => void doExport()}>
            ⬇ Xuất Excel ({report.attempts.length} lượt nộp)
          </button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {ranged ? `Đang xem các lượt nộp ${f.from ? 'từ ' + showDay(f.from) : ''}${f.to ? ' đến ' + showDay(f.to) : ''}. “Lần đầu” là lần làm sớm nhất trong khoảng ngày này.` : 'Đang xem tất cả các ngày.'}
        </p>
      </div>

      <div className="stats">
        <div className="stat">
          <b>
            {report.doneCount}/{report.students.length}
          </b>
          <span>học sinh đã làm bài</span>
        </div>
        <div className="stat">
          <b>{any ? report.average.toFixed(1) + '/' + n : '-'}</b>
          <span>điểm trung bình (lần đầu)</span>
        </div>
        <div className="stat">
          <b>{any ? 'Câu ' + (hardest.index + 1) : '-'}</b>
          <span>câu sai nhiều nhất{any ? ` (${Math.round(hardest.pct * 100)}% đúng)` : ''}</span>
        </div>
        <div className="stat">
          <b>{any ? 'Câu ' + (easiest.index + 1) : '-'}</b>
          <span>câu đúng nhiều nhất{any ? ` (${Math.round(easiest.pct * 100)}% đúng)` : ''}</span>
        </div>
      </div>

      {any ? (
        <div className="panel">
          <h2>Từng câu hỏi, xếp từ khó nhất</h2>
          <p className="muted small">Tính theo lần làm đầu tiên của mỗi học sinh. Câu màu đỏ là câu nên giảng lại trên lớp.</p>
          {report.hardest.map((x) => (
            <div className="qbar" key={x.index}>
              <span className="qn">C{x.index + 1}</span>
              <div className="qt">
                <b>{x.question.prompt}</b>
                <small>
                  {TYPE_LABELS[x.question.type]} · {SKILL_LABELS[x.question.skill]} · Đáp án: {answerText(x.question)}
                </small>
                {x.topWrong && (
                  <small className="wrong">
                    Sai nhiều nhất: “{x.topWrong.text}” ({x.topWrong.count} em)
                  </small>
                )}
              </div>
              <div className="meter">
                <i style={{ width: x.pct * 100 + '%', background: color(x.pct) }} />
              </div>
              <span className="pct" style={{ color: color(x.pct) }}>
                {Math.round(x.pct * 100)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <p className="muted">{ranged ? 'Không có lượt nộp nào trong khoảng ngày này.' : 'Chưa có học sinh nào nộp bài này.'}</p>
        </div>
      )}

      <div className="panel">
        <h2>Từng học sinh</h2>
        <p className="muted small">Ô xanh/đỏ là kết quả lần làm đầu tiên. Bấm vào một học sinh để xem em đã trả lời gì ở từng câu.</p>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Học sinh</th>
                {lesson.questions.map((q, i) => (
                  <th key={i} title={q.prompt}>
                    C{i + 1}
                  </th>
                ))}
                <th>Lần đầu</th>
                <th>Cao nhất</th>
                <th>Số lần</th>
                <th>Thời gian</th>
                <th>Ngày làm</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) =>
                r.first ? (
                  <Fragment key={r.student.code}>
                    <tr className={'clickable' + (open === r.student.code ? ' open' : '')} onClick={() => setOpen(open === r.student.code ? null : r.student.code)}>
                      <td>
                        <span className="caret">{open === r.student.code ? '▾' : '▸'}</span> <b>{r.student.name}</b> <span className="muted small">{r.student.code}</span>
                      </td>
                      {lesson.questions.map((_, i) => {
                        const x = r.first!.answers[i];
                        return (
                          <td key={i}>
                            <span className={'cell ' + (x?.correct ? 'ok' : 'bad')} title={x?.correct ? 'Đúng' : 'Trả lời: ' + (x?.responseText || '(bỏ trống)')}>
                              {x?.correct ? '✓' : '✗'}
                            </span>
                          </td>
                        );
                      })}
                      <td>
                        <b>
                          {r.first.score}/{n}
                        </b>
                      </td>
                      <td>
                        {r.best}/{n}
                      </td>
                      <td>{r.attempts.length}</td>
                      <td>{fmtDuration(r.first.durationSec)}</td>
                      <td>
                        {showDay(dayOf(r.first.submittedAt))} {timeOf(r.first.submittedAt)}
                      </td>
                    </tr>
                    {open === r.student.code && (
                      <tr className="detail-row">
                        <td colSpan={n + 6}>
                          <StudentDetail row={r} lesson={lesson} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ) : (
                  <tr className="notdone" key={r.student.code}>
                    <td>
                      {r.student.name} <span className="small">{r.student.code}</span>
                    </td>
                    <td colSpan={n + 5} style={{ textAlign: 'left' }}>
                      {ranged ? 'Không làm bài trong khoảng ngày này' : 'Chưa làm bài'}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Chi tiết một học sinh: từng lần làm, mỗi câu hiện câu trả lời của em cạnh đáp án đúng. */
function StudentDetail({ row, lesson }: { row: StudentRow; lesson: Lesson }) {
  const [which, setWhich] = useState(0);
  const a = row.attempts[which] ?? row.attempts[0];
  return (
    <div className="detail">
      <div className="tools" style={{ marginTop: 0 }}>
        {row.attempts.map((x, i) => (
          <button key={x.id} className={'btn sm ' + (i === which ? '' : 'ghost')} onClick={() => setWhich(i)}>
            Lần {x.attemptNo} · {x.score}/{x.total} · {showDay(dayOf(x.submittedAt))}
          </button>
        ))}
      </div>
      {lesson.questions.map((q, i) => {
        const x = a.answers[i];
        return (
          <div key={i} className={'detail-q ' + (x?.correct ? 'ok' : 'bad')}>
            <b>
              Câu {i + 1}. {q.prompt}
            </b>
            {x?.correct ? (
              <span>✓ {x.responseText}</span>
            ) : (
              <>
                <span className="wrong">✗ Em trả lời: {x?.responseText || '(bỏ trống)'}</span>
                <span>Đáp án đúng: {answerText(q)}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
