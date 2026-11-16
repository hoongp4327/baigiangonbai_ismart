/* Lớp dữ liệu. Bản demo lưu trong localStorage của trình duyệt.
   Mọi hàm đều trả về Promise để sau này thay bằng Google Apps Script + Google Sheets
   mà không phải sửa giao diện. Các bảng tương ứng với các tab trong Sheet:
   classes -> Lop, students -> HocSinh, lessons -> BaiHoc/CauHoi, attempts -> LuotNop/TraLoi. */
const LocalStore = (() => {
  const KEY = 'bgs_db_v1';
  const empty = () => ({ classes: [], students: [], lessons: [], attempts: [] });
  const load = () => {
    try {
      return Object.assign(empty(), JSON.parse(localStorage.getItem(KEY)) || {});
    } catch (e) {
      return empty();
    }
  };
  const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  const rid = (p) => p + Math.random().toString(36).slice(2, 8);
  const ok = (v) => Promise.resolve(v);

  function newCode(db) {
    let c;
    do c = 'HS' + Math.floor(1000 + Math.random() * 9000);
    while (db.students.some((s) => s.code === c));
    return c;
  }
  function addNames(db, classId, names) {
    names
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach((name) => db.students.push({ code: newCode(db), name, classId }));
  }
  function pushAttempt(db, lessonId, studentCode, answers, durationSec, submittedAt) {
    const prev = db.attempts.filter((a) => a.lessonId === lessonId && a.studentCode === studentCode);
    const attempt = {
      id: rid('n'),
      lessonId,
      studentCode,
      attemptNo: prev.length + 1,
      score: answers.filter((a) => a.correct).length,
      total: answers.length,
      durationSec,
      submittedAt: submittedAt || new Date().toISOString(),
      answers,
    };
    db.attempts.push(attempt);
    return { attempt, best: Math.max(attempt.score, ...prev.map((a) => a.score)) };
  }

  return {
    remote: false,
    getAll: () => ok(load()),
    listLessons: () => ok(load().lessons.map((l) => ({ id: l.id, title: l.title, count: l.questions.length }))),
    demoCode: () => ok((load().students[0] || {}).code || null),
    hasStudents: () => ok(load().students.length > 0),

    createClass(name, names) {
      const db = load();
      const c = { id: rid('c'), name: name.trim() };
      db.classes.push(c);
      addNames(db, c.id, names);
      save(db);
      return ok(c);
    },
    addStudents(classId, names) {
      const db = load();
      addNames(db, classId, names);
      save(db);
      return ok();
    },
    deleteClass(id) {
      const db = load();
      const codes = db.students.filter((s) => s.classId === id).map((s) => s.code);
      db.classes = db.classes.filter((c) => c.id !== id);
      db.students = db.students.filter((s) => s.classId !== id);
      db.attempts = db.attempts.filter((a) => !codes.includes(a.studentCode));
      save(db);
      return ok();
    },

    saveLesson(lesson) {
      const db = load();
      const l = Object.assign({}, lesson, { id: rid('b'), createdAt: new Date().toISOString() });
      db.lessons.push(l);
      save(db);
      return ok(l);
    },
    deleteLesson(id) {
      const db = load();
      db.lessons = db.lessons.filter((l) => l.id !== id);
      db.attempts = db.attempts.filter((a) => a.lessonId !== id);
      save(db);
      return ok();
    },
    getLesson: (id) => ok(load().lessons.find((l) => l.id === id) || null),

    findStudent(code) {
      const db = load();
      const s = db.students.find((x) => x.code === String(code).trim().toUpperCase());
      if (!s) return ok(null);
      const c = db.classes.find((x) => x.id === s.classId);
      return ok(Object.assign({ className: c ? c.name : '' }, s));
    },

    /* Bản thật: việc chấm điểm nằm ở server (Apps Script), đáp án không gửi xuống máy học sinh. */
    submitAttempt({ lessonId, studentCode, responses, durationSec }) {
      const db = load();
      const lesson = db.lessons.find((l) => l.id === lessonId);
      const answers = lesson.questions.map((q, i) => {
        const g = Q.grade(q, responses[i]);
        return { correct: g.correct, responseText: g.responseText };
      });
      const r = pushAttempt(db, lessonId, studentCode, answers, durationSec);
      save(db);
      return ok(r);
    },

    reset() {
      localStorage.removeItem(KEY);
      return ok();
    },

    /* Tạo sẵn 1 lớp, 1 bài mẫu và kết quả làm bài giả lập để xem thử báo cáo. */
    seedDemo() {
      const db = empty();
      const c = { id: rid('c'), name: 'Lớp 3A' };
      db.classes.push(c);
      addNames(db, c.id, ['Nguyễn Minh Anh', 'Trần Gia Bảo', 'Lê Ngọc Châu', 'Phạm Đức Duy', 'Hoàng Thu Hà', 'Vũ Quang Khải', 'Đỗ Bảo Ngọc', 'Bùi Tuấn Phong', 'Đặng Mai Trang', 'Ngô Hải Yến']);
      const lesson = Object.assign({}, Q.validateLesson(SAMPLE_LESSON).lesson, { id: rid('b'), createdAt: new Date().toISOString() });
      db.lessons.push(lesson);

      const ease = [0.95, 0.75, 0.8, 0.45, 0.7, 0.6, 0.3, 0.85, 0.65, 0.4];
      const wrongText = (q) => {
        if (q.type === 'multiple_choice') {
          const others = q.options.filter((_, i) => i !== q.answer);
          return others[Math.random() < 0.7 ? 0 : others.length - 1];
        }
        if (q.type === 'true_false') return q.answer ? 'Sai' : 'Đúng';
        if (q.type === 'fill_blank') return Math.random() < 0.6 ? q.answer[0].slice(0, -1) : q.answer[0] + 's';
        if (q.type === 'matching') return 'nối nhầm ' + q.pairs[0].left + ' → ' + q.pairs[1].right;
        return q.answer.split(' ').reverse().join(' ');
      };
      const simulate = (boost) =>
        lesson.questions.map((q, i) => {
          const correct = Math.random() < Math.min(0.98, ease[i % ease.length] + boost);
          return { correct, responseText: correct ? Q.grade(q, null).correctText : wrongText(q) };
        });
      db.students.slice(0, 8).forEach((s, i) => {
        const skillBoost = (i % 4) * 0.08 - 0.1;
        const t = Date.now() - (i + 1) * 37 * 60000;
        pushAttempt(db, lesson.id, s.code, simulate(skillBoost), 180 + Math.floor(Math.random() * 240), new Date(t).toISOString());
        if (i % 3 === 0) pushAttempt(db, lesson.id, s.code, simulate(skillBoost + 0.3), 150 + Math.floor(Math.random() * 120), new Date(t + 12 * 60000).toISOString());
      });
      save(db);
      return ok(lesson);
    },
  };
})();

/* Bản thật: gọi Google Apps Script, dữ liệu nằm trong Google Sheets.
   Gửi dạng text/plain để trình duyệt không phải hỏi trước (preflight) - Apps Script không trả lời được câu hỏi đó. */
const RemoteStore = (() => {
  const KEY = 'bgs_teacher_key';
  let pending = 0;
  function busy(on) {
    pending += on ? 1 : -1;
    let el = document.getElementById('busy');
    if (!el) {
      el = document.createElement('div');
      el.id = 'busy';
      el.className = 'busy';
      el.textContent = 'Đang tải…';
      document.body.appendChild(el);
    }
    el.style.display = pending > 0 ? 'block' : 'none';
  }
  async function call(action, data, admin) {
    const body = Object.assign({ action }, data || {});
    if (admin) body.key = sessionStorage.getItem(KEY) || '';
    busy(true);
    try {
      let json;
      try {
        const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        json = await res.json();
      } catch (e) {
        throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      }
      if (!json.ok) throw new Error(json.error || 'Lỗi máy chủ');
      return json.data;
    } finally {
      busy(false);
    }
  }
  return {
    remote: true,
    hasKey: () => !!sessionStorage.getItem(KEY),
    setKey: (k) => sessionStorage.setItem(KEY, k),
    clearKey: () => sessionStorage.removeItem(KEY),

    getAll: () => call('getAll', null, true),
    createClass: (name, names) => call('createClass', { name, names }, true),
    addStudents: (classId, names) => call('addStudents', { classId, names }, true),
    deleteClass: (id) => call('deleteClass', { id }, true),
    saveLesson: (lesson) => call('saveLesson', { lesson }, true),
    deleteLesson: (id) => call('deleteLesson', { id }, true),

    listLessons: () => call('listLessons'),
    getLesson: (id) => call('getLesson', { id }),
    findStudent: (code) => call('findStudent', { code }),
    submitAttempt: (a) => call('submitAttempt', a),
    demoCode: () => Promise.resolve(null),
    hasStudents: () => Promise.resolve(true),
  };
})();

const Store = typeof API_URL === 'string' && API_URL ? RemoteStore : LocalStore;
