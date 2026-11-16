import { useState } from 'react';
import { store } from '../store';
import type { TabProps } from './AdminApp';
import { copyText, toast } from './ui';

export function ClassesTab({ db, act }: TabProps) {
  const [name, setName] = useState('');
  const [names, setNames] = useState('');
  const [adding, setAdding] = useState<{ classId: string; text: string } | null>(null);

  const create = async () => {
    if (!name.trim()) return toast('Hãy nhập tên lớp');
    if (await act(() => store.createClass(name, names.split('\n')), 'Đã tạo lớp')) {
      setName('');
      setNames('');
    }
  };
  const addStudents = async () => {
    if (!adding) return;
    const list = adding.text.split(/[\n,]/).filter((x) => x.trim());
    if (!list.length) return;
    if (await act(() => store.addStudents(adding.classId, list), 'Đã thêm ' + list.length + ' học sinh')) setAdding(null);
  };

  return (
    <>
      <div className="panel">
        <h2>Thêm lớp mới</h2>
        <div className="grid2">
          <div>
            <label className="field">
              <span>Tên lớp</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Lớp 3A" />
            </label>
            <button className="btn sm" onClick={() => void create()}>
              Tạo lớp
            </button>
          </div>
          <label className="field">
            <span>Danh sách học sinh (mỗi dòng một tên, dán từ Excel được)</span>
            <textarea rows={5} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Nguyễn Minh Anh\nTrần Gia Bảo'} />
          </label>
        </div>
        <p className="muted small">Hệ thống tự sinh mã cho từng em. Học sinh dùng mã này để vào làm bài.</p>
      </div>

      {db.classes.length === 0 && (
        <div className="panel">
          <p className="muted">Chưa có lớp nào.</p>
        </div>
      )}
      {db.classes.map((c) => {
        const students = db.students.filter((s) => s.classId === c.id);
        return (
          <div className="panel" key={c.id}>
            <div className="tools" style={{ marginTop: 0 }}>
              <h2 style={{ margin: 0, flex: 1 }}>
                {c.name} <span className="muted small">· {students.length} học sinh</span>
              </h2>
              <button className="btn sm ghost" onClick={() => copyText(students.map((s) => s.name + '\t' + s.code).join('\n'), 'Đã copy, dán vào Excel/Zalo được')}>
                Copy danh sách mã
              </button>
              <button className="btn sm ghost" onClick={() => setAdding(adding?.classId === c.id ? null : { classId: c.id, text: '' })}>
                + Thêm học sinh
              </button>
              <button className="btn sm danger" onClick={() => confirm('Xoá lớp “' + c.name + '” cùng học sinh và kết quả của lớp?') && void act(() => store.deleteClass(c.id), 'Đã xoá lớp')}>
                Xoá lớp
              </button>
            </div>
            {adding?.classId === c.id && (
              <div className="addbox">
                <textarea rows={3} autoFocus value={adding.text} onChange={(e) => setAdding({ classId: c.id, text: e.target.value })} placeholder="Mỗi dòng một tên" />
                <div className="tools">
                  <button className="btn sm green" onClick={() => void addStudents()}>
                    Thêm
                  </button>
                  <button className="btn sm ghost" onClick={() => setAdding(null)}>
                    Huỷ
                  </button>
                </div>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Họ tên</th>
                  <th>Mã học sinh</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.code}>
                    <td>{i + 1}</td>
                    <td>{s.name}</td>
                    <td>
                      <code className="code">{s.code}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
