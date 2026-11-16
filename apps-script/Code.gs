/* Bài Giảng Số - máy chủ chạy trên Google Apps Script, dữ liệu nằm trong Google Sheet này.
   Cách cài: xem file HUONG-DAN-GOOGLE-SHEETS.md */

// ĐỔI mật khẩu này trước khi triển khai. Giáo viên dùng nó để vào trang quản trị.
const MAT_KHAU_GV = 'doi-mat-khau-nay';

const TZ = 'Asia/Ho_Chi_Minh';

// Mỗi tab trong Sheet và các cột của nó. Tab tự được tạo ở lần chạy đầu tiên.
const TABS = {
  Lop: ['id', 'ten'],
  HocSinh: ['ma', 'ten', 'lopId'],
  BaiHoc: ['id', 'tieuDe', 'lop', 'unit', 'moTa', 'soCau', 'ngayTao'],
  CauHoi: ['baiId', 'stt', 'dang', 'kyNang', 'deBai', 'dapAn', 'json'],
  LuotNop: ['id', 'ngay', 'gio', 'tenLop', 'maHS', 'tenHS', 'tenBai', 'lanThu', 'diem', 'tong', 'thoiGianGiay', 'baiId', 'nopLuc'],
  TraLoi: ['luotId', 'ngay', 'maHS', 'baiId', 'cau', 'ketQua', 'traLoi'],
};
// Cột số và cột ngày; mọi cột khác để dạng văn bản để Sheets không tự đổi kiểu dữ liệu.
const NUMBER_COLS = { LuotNop: ['lanThu', 'diem', 'tong', 'thoiGianGiay'], TraLoi: ['cau'] };
const DATE_COLS = { LuotNop: ['ngay'], TraLoi: ['ngay'] };

/* ---------------- Cổng vào ---------------- */
function doGet() {
  return out({ ok: true, data: 'Bài Giảng Số đang chạy' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'Yêu cầu không hợp lệ' });
  }
  try {
    if (PUBLIC[req.action]) return out({ ok: true, data: PUBLIC[req.action](req) });
    if (!ADMIN[req.action]) throw new Error('Không có chức năng: ' + req.action);
    if (String(req.key || '') !== MAT_KHAU_GV) throw new Error('SAI_MAT_KHAU');
    return out({ ok: true, data: ADMIN[req.action](req) });
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Chạy hàm này một lần trong trình soạn thảo để tạo sẵn các tab và cấp quyền. */
function caiDat() {
  Object.keys(TABS).forEach(tab);
}

/* ---------------- Đọc / ghi Sheet ---------------- */
function tab(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    const h = TABS[name];
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), h.length).setNumberFormat('@');
    (NUMBER_COLS[name] || []).forEach(function (c) {
      sh.getRange(2, h.indexOf(c) + 1, sh.getMaxRows() - 1, 1).setNumberFormat('0');
    });
    (DATE_COLS[name] || []).forEach(function (c) {
      sh.getRange(2, h.indexOf(c) + 1, sh.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
    });
    sh.getRange(1, 1, 1, h.length).setValues([h]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows(name) {
  const h = TABS[name];
  return tab(name)
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(function (r) {
      return r[0] !== '';
    })
    .map(function (r) {
      const o = {};
      h.forEach(function (k, i) {
        o[k] = r[i];
      });
      return o;
    });
}

function toMatrix(name, objs) {
  const h = TABS[name];
  return objs.map(function (o) {
    return h.map(function (k) {
      return o[k] == null ? '' : o[k];
    });
  });
}

function add(name, objs) {
  if (!objs.length) return;
  const sh = tab(name);
  const start = sh.getLastRow() + 1;
  const missing = start + objs.length - 1 - sh.getMaxRows();
  if (missing > 0) sh.insertRowsAfter(sh.getMaxRows(), missing);
  sh.getRange(start, 1, objs.length, TABS[name].length).setValues(toMatrix(name, objs));
}

function removeWhere(name, pred) {
  const sh = tab(name);
  const keep = rows(name).filter(function (o) {
    return !pred(o);
  });
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, TABS[name].length).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, TABS[name].length).setValues(toMatrix(name, keep));
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function newId(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 7);
}
const same = function (a, b) {
  return String(a) === String(b);
};

/* ---------------- Chấm điểm (giống js/questions.js) ---------------- */
function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[.,!?;:]+$/g, '');
}

function grade(q, resp) {
  if (q.type === 'multiple_choice') return { correct: resp === q.answer, text: resp == null || q.options[resp] == null ? '' : q.options[resp] };
  if (q.type === 'true_false') return { correct: resp === q.answer, text: resp == null ? '' : resp ? 'Đúng' : 'Sai' };
  if (q.type === 'fill_blank') return { correct: q.answer.map(norm).indexOf(norm(resp)) >= 0, text: String(resp || '').trim() };
  if (q.type === 'matching') {
    const r = Array.isArray(resp) ? resp : [];
    return {
      correct: q.pairs.every(function (_, i) {
        return r[i] === i;
      }),
      text: q.pairs
        .map(function (p, i) {
          return p.left + ' → ' + (r[i] == null || !q.pairs[r[i]] ? '?' : q.pairs[r[i]].right);
        })
        .join(', '),
    };
  }
  if (q.type === 'word_order') return { correct: norm(resp) === norm(q.answer), text: String(resp || '') };
  return { correct: false, text: '' };
}

function answerText(q) {
  if (q.type === 'multiple_choice') return q.options[q.answer];
  if (q.type === 'true_false') return q.answer ? 'Đúng' : 'Sai';
  if (q.type === 'fill_blank') return q.answer.join(' / ');
  if (q.type === 'matching')
    return q.pairs
      .map(function (p) {
        return p.left + ' → ' + p.right;
      })
      .join(', ');
  return q.answer;
}

/* ---------------- Dữ liệu ---------------- */
function lessonById(id) {
  const b = rows('BaiHoc').filter(function (x) {
    return same(x.id, id);
  })[0];
  if (!b) return null;
  return lessonFrom(b, rows('CauHoi'));
}

function lessonFrom(b, allQuestions) {
  const qs = allQuestions
    .filter(function (q) {
      return same(q.baiId, b.id);
    })
    .sort(function (x, y) {
      return Number(x.stt) - Number(y.stt);
    })
    .map(function (q) {
      return JSON.parse(q.json);
    });
  return { id: String(b.id), title: String(b.tieuDe), grade: String(b.lop), unit: String(b.unit), description: String(b.moTa), createdAt: String(b.ngayTao), questions: qs };
}

function newStudentRows(classId, names, existing) {
  const used = {};
  existing.forEach(function (s) {
    used[String(s.ma)] = true;
  });
  return names
    .map(function (n) {
      return String(n).trim();
    })
    .filter(String)
    .map(function (name) {
      let code;
      do code = 'HS' + Math.floor(1000 + Math.random() * 9000);
      while (used[code]);
      used[code] = true;
      return { ma: code, ten: name, lopId: classId };
    });
}

/* ---------------- Chức năng cho học sinh (không cần mật khẩu) ---------------- */
const PUBLIC = {
  listLessons: function () {
    return rows('BaiHoc').map(function (b) {
      return { id: String(b.id), title: String(b.tieuDe), count: Number(b.soCau) };
    });
  },

  getLesson: function (req) {
    return lessonById(req.id);
  },

  findStudent: function (req) {
    const code = String(req.code || '').trim().toUpperCase();
    const s = rows('HocSinh').filter(function (x) {
      return same(x.ma, code);
    })[0];
    if (!s) return null;
    const c = rows('Lop').filter(function (x) {
      return same(x.id, s.lopId);
    })[0];
    return { code: String(s.ma), name: String(s.ten), classId: String(s.lopId), className: c ? String(c.ten) : '' };
  },

  submitAttempt: function (req) {
    return withLock(function () {
      const lesson = lessonById(req.lessonId);
      if (!lesson) throw new Error('Không tìm thấy bài học');
      const st = PUBLIC.findStudent({ code: req.studentCode });
      if (!st) throw new Error('Không tìm thấy học sinh');
      const responses = req.responses || [];
      const graded = lesson.questions.map(function (q, i) {
        return grade(q, responses[i]);
      });
      const score = graded.filter(function (g) {
        return g.correct;
      }).length;
      const prev = rows('LuotNop').filter(function (a) {
        return same(a.baiId, lesson.id) && same(a.maHS, st.code);
      });
      const now = new Date();
      const day = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
      const attempt = {
        id: newId('n'),
        ngay: day,
        gio: Utilities.formatDate(now, TZ, 'HH:mm'),
        tenLop: st.className,
        maHS: st.code,
        tenHS: st.name,
        tenBai: lesson.title,
        lanThu: prev.length + 1,
        diem: score,
        tong: graded.length,
        thoiGianGiay: Math.max(0, Math.round(Number(req.durationSec) || 0)),
        baiId: lesson.id,
        nopLuc: now.toISOString(),
      };
      add('LuotNop', [attempt]);
      add(
        'TraLoi',
        graded.map(function (g, i) {
          return { luotId: attempt.id, ngay: day, maHS: st.code, baiId: lesson.id, cau: i + 1, ketQua: g.correct ? 'Đúng' : 'Sai', traLoi: g.text };
        })
      );
      const best = prev.reduce(function (m, a) {
        return Math.max(m, Number(a.diem));
      }, score);
      return {
        attempt: { id: attempt.id, lessonId: lesson.id, studentCode: st.code, attemptNo: attempt.lanThu, score: score, total: graded.length, durationSec: attempt.thoiGianGiay, submittedAt: attempt.nopLuc },
        best: best,
      };
    });
  },
};

/* ---------------- Chức năng cho giáo viên (cần mật khẩu) ---------------- */
const ADMIN = {
  getAll: function () {
    const allQ = rows('CauHoi');
    const byAttempt = {};
    rows('TraLoi').forEach(function (t) {
      (byAttempt[t.luotId] = byAttempt[t.luotId] || []).push(t);
    });
    return {
      classes: rows('Lop').map(function (c) {
        return { id: String(c.id), name: String(c.ten) };
      }),
      students: rows('HocSinh').map(function (s) {
        return { code: String(s.ma), name: String(s.ten), classId: String(s.lopId) };
      }),
      lessons: rows('BaiHoc').map(function (b) {
        return lessonFrom(b, allQ);
      }),
      attempts: rows('LuotNop').map(function (a) {
        const ans = (byAttempt[a.id] || []).sort(function (x, y) {
          return Number(x.cau) - Number(y.cau);
        });
        return {
          id: String(a.id),
          lessonId: String(a.baiId),
          studentCode: String(a.maHS),
          attemptNo: Number(a.lanThu),
          score: Number(a.diem),
          total: Number(a.tong),
          durationSec: Number(a.thoiGianGiay),
          submittedAt: String(a.nopLuc),
          answers: ans.map(function (t) {
            return { correct: t.ketQua === 'Đúng', responseText: String(t.traLoi) };
          }),
        };
      }),
    };
  },

  createClass: function (req) {
    return withLock(function () {
      const c = { id: newId('c'), ten: String(req.name || '').trim() };
      add('Lop', [c]);
      add('HocSinh', newStudentRows(c.id, req.names || [], rows('HocSinh')));
      return { id: c.id, name: c.ten };
    });
  },

  addStudents: function (req) {
    return withLock(function () {
      add('HocSinh', newStudentRows(req.classId, req.names || [], rows('HocSinh')));
      return true;
    });
  },

  deleteClass: function (req) {
    return withLock(function () {
      const codes = {};
      rows('HocSinh').forEach(function (s) {
        if (same(s.lopId, req.id)) codes[String(s.ma)] = true;
      });
      removeWhere('Lop', function (c) {
        return same(c.id, req.id);
      });
      removeWhere('HocSinh', function (s) {
        return same(s.lopId, req.id);
      });
      removeWhere('LuotNop', function (a) {
        return codes[String(a.maHS)];
      });
      removeWhere('TraLoi', function (t) {
        return codes[String(t.maHS)];
      });
      return true;
    });
  },

  saveLesson: function (req) {
    return withLock(function () {
      const l = req.lesson;
      if (!l || !l.questions || !l.questions.length) throw new Error('Bài học không có câu hỏi');
      const id = newId('b');
      const created = new Date().toISOString();
      add('BaiHoc', [{ id: id, tieuDe: l.title, lop: l.grade, unit: l.unit, moTa: l.description, soCau: l.questions.length, ngayTao: created }]);
      add(
        'CauHoi',
        l.questions.map(function (q, i) {
          return { baiId: id, stt: i + 1, dang: q.type, kyNang: q.skill, deBai: q.prompt, dapAn: answerText(q), json: JSON.stringify(q) };
        })
      );
      return { id: id, title: l.title, createdAt: created };
    });
  },

  deleteLesson: function (req) {
    return withLock(function () {
      ['BaiHoc', 'CauHoi', 'LuotNop', 'TraLoi'].forEach(function (name) {
        removeWhere(name, function (o) {
          return same(name === 'BaiHoc' ? o.id : o.baiId, req.id);
        });
      });
      return true;
    });
  },
};
