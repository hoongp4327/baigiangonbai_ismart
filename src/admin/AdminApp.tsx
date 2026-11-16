import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Db } from '../types';
import type { ReportFilter } from '../lib/report';
import { onBusy, store } from '../store';
import { toast } from './ui';
import { LessonsTab } from './LessonsTab';
import { ClassesTab } from './ClassesTab';
import { ReportTab } from './ReportTab';

type Tab = 'lessons' | 'classes' | 'report';
const TABS: { id: Tab; label: string }[] = [
  { id: 'lessons', label: 'Bài học' },
  { id: 'classes', label: 'Lớp & học sinh' },
  { id: 'report', label: 'Báo cáo' },
];
const tabFromHash = (): Tab => (TABS.find((t) => t.id === location.hash.slice(1))?.id ?? 'lessons');

export interface TabProps {
  db: Db;
  /** Chạy một thao tác ghi dữ liệu rồi tải lại; lỗi được báo bằng thông báo. */
  act: (work: () => Promise<unknown>, done?: string) => Promise<boolean>;
}

export function AdminApp() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState('');
  const [needLogin, setNeedLogin] = useState(store.remote && !store.hasKey());
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>({ lessonId: '', classId: '', from: '', to: '' });

  useEffect(() => onBusy(setBusy), []);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const reload = useCallback(async () => {
    setError('');
    try {
      setDb(await store.getAll());
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'SAI_MAT_KHAU') {
        store.clearKey();
        setLoginError('Mật khẩu chưa đúng.');
        setNeedLogin(true);
      } else setError(msg);
    }
  }, []);
  useEffect(() => {
    if (!needLogin) void reload();
  }, [needLogin, reload]);

  const act: TabProps['act'] = async (work, done) => {
    try {
      await work();
      await reload();
      if (done) toast(done);
      return true;
    } catch (e) {
      toast('Lỗi: ' + (e as Error).message);
      return false;
    }
  };

  const go = (t: Tab) => {
    location.hash = t;
    setTab(t);
  };

  return (
    <>
      <header className="a-head">
        <h1>📚 Bài Giảng Số · Giáo viên</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <span className={'mode' + (store.remote ? ' live' : '')}>{store.remote ? 'Dữ liệu: Google Sheets' : 'Bản demo · lưu trong trình duyệt'}</span>
        {!store.remote && (
          <>
            <button
              className="btn sm ghost"
              onClick={() => {
                if (!confirm('Thay toàn bộ dữ liệu hiện tại bằng dữ liệu mẫu (1 lớp, 1 bài, kết quả giả lập)?')) return;
                void act(async () => {
                  const l = await store.seedDemo!();
                  setFilter({ lessonId: l.id, classId: '', from: '', to: '' });
                  go('report');
                }, 'Đã nạp dữ liệu mẫu');
              }}
            >
              Nạp dữ liệu mẫu
            </button>
            <button className="btn sm danger" onClick={() => confirm('Xoá toàn bộ lớp, bài học và kết quả? Không khôi phục được.') && void act(() => store.reset!())}>
              Xoá hết
            </button>
          </>
        )}
        {store.remote && !needLogin && (
          <button
            className="btn sm ghost"
            onClick={() => {
              store.clearKey();
              setDb(null);
              setLoginError('');
              setNeedLogin(true);
            }}
          >
            Đăng xuất
          </button>
        )}
      </header>
      {busy && <div className="busy">Đang tải…</div>}
      <main className="a-main">
        {needLogin ? (
          <Login
            error={loginError}
            onSubmit={(key) => {
              store.setKey(key);
              setLoginError('');
              setNeedLogin(false);
            }}
          />
        ) : error ? (
          <div className="panel">
            <div className="errors">
              <b>Không tải được dữ liệu.</b> {error}
            </div>
            <button className="btn sm" onClick={() => void reload()}>
              Thử lại
            </button>
          </div>
        ) : !db ? (
          <div className="panel muted">Đang tải dữ liệu…</div>
        ) : tab === 'classes' ? (
          <ClassesTab db={db} act={act} />
        ) : tab === 'report' ? (
          <ReportTab db={db} filter={filter} setFilter={setFilter} />
        ) : (
          <LessonsTab
            db={db}
            act={act}
            openReport={(lessonId) => {
              setFilter({ ...filter, lessonId });
              go('report');
            }}
          />
        )}
      </main>
    </>
  );
}

/** Khi dùng Google Sheets, giáo viên phải nhập mật khẩu đã đặt trong Code.gs. */
function Login({ error, onSubmit }: { error: string; onSubmit: (key: string) => void }) {
  const [key, setKey] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (key) onSubmit(key);
  };
  return (
    <form className="panel login" onSubmit={submit}>
      <h2>Đăng nhập giáo viên</h2>
      <label className="field">
        <span>Mật khẩu giáo viên</span>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" autoFocus />
      </label>
      {error && <div className="errors">{error}</div>}
      <button className="btn sm" type="submit">
        Vào trang quản trị
      </button>
    </form>
  );
}
