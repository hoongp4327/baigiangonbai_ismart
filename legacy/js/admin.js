/* Trang giáo viên: bài học (import JSON), lớp & học sinh, báo cáo. */
(function () {
  const main = document.getElementById('main');
  const esc = Q.esc;
  const $ = (id) => document.getElementById(id);
  let tab = location.hash.slice(1) || 'lessons';
  let pending = null; // bài đã kiểm tra, chờ lưu
  let draft = ''; // nội dung JSON đang dán
  let reportSel = { lesson: '', cls: '', from: '', to: '' };
  const pad = (n) => String(n).padStart(2, '0');
  const dayOfDate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayOf = (iso) => dayOfDate(new Date(iso)); // ngày theo giờ máy giáo viên, dạng 2026-11-16
  const timeOf = (iso) => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const showDay = (day) => day.split('-').reverse().join('/');

  const lessonUrl = (id) => new URL('index.html?bai=' + id, location.href).href;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }
  function copy(text, msg) {
    const done = () => toast(msg || 'Đã copy');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      location.hash = tab;
      draw();
    })
  );
  $('seed').addEventListener('click', async () => {
    if (!confirm('Thay toàn bộ dữ liệu hiện tại bằng dữ liệu mẫu (1 lớp, 1 bài, kết quả giả lập)?')) return;
    const l = await Store.seedDemo();
    reportSel = { lesson: l.id, cls: '', from: '', to: '' };
    tab = 'report';
    draw();
    toast('Đã nạp dữ liệu mẫu');
  });
  $('reset').addEventListener('click', async () => {
    if (!confirm('Xoá toàn bộ lớp, bài học và kết quả? Không khôi phục được.')) return;
    await Store.reset();
    pending = null;
    draft = '';
    draw();
  });

  $('mode').textContent = Store.remote ? 'Dữ liệu: Google Sheets' : 'Bản demo · lưu trong trình duyệt';
  $('mode').classList.toggle('live', !!Store.remote);
  if (Store.remote) {
    $('seed').style.display = 'none';
    $('reset').style.display = 'none';
  }
  window.addEventListener('unhandledrejection', (e) => toast('Lỗi: ' + ((e.reason && e.reason.message) || e.reason)));

  /* Khi dùng Google Sheets, giáo viên phải nhập mật khẩu đã đặt trong Code.gs. */
  function drawLogin(error) {
    main.innerHTML =
      '<div class="panel login"><h2>Đăng nhập giáo viên</h2><form id="lf"><label class="field"><span>Mật khẩu giáo viên</span>' +
      '<input type="password" id="pw" style="width:100%;padding:9px 12px;border:1px solid #cfd6e4;border-radius:9px" autocomplete="current-password"></label>' +
      (error ? '<div class="errors">' + esc(error) + '</div>' : '') +
      '<button class="btn sm" type="submit">Vào trang quản trị</button></form></div>';
    $('pw').focus();
    $('lf').addEventListener('submit', (e) => {
      e.preventDefault();
      Store.setKey($('pw').value);
      draw();
    });
  }

  async function draw() {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (Store.remote && !Store.hasKey()) return drawLogin();
    let db;
    try {
      db = await Store.getAll();
    } catch (e) {
      if (e.message === 'SAI_MAT_KHAU') {
        Store.clearKey();
        return drawLogin('Mật khẩu chưa đúng.');
      }
      main.innerHTML = '<div class="panel"><div class="errors"><b>Không tải được dữ liệu.</b> ' + esc(e.message) + '</div><button class="btn sm" id="retry">Thử lại</button></div>';
      $('retry').addEventListener('click', draw);
      return;
    }
    if (tab === 'classes') drawClasses(db);
    else if (tab === 'report') drawReport(db);
    else drawLessons(db);
  }

  /* ---------------- Bài học ---------------- */
  function answerText(q) {
    return Q.grade(q, null).correctText;
  }
  function previewHtml(lesson) {
    return lesson.questions
      .map(
        (q, i) =>
          '<div class="pv"><div class="meta">Câu ' + (i + 1) + ' · ' + esc(Q.TYPES[q.type]) + ' · ' + esc(Q.SKILLS[q.skill]) + (q.audio_text || q.audio_url ? ' · 🔊 có nghe' : '') + '</div>' +
          (q.passage ? '<div class="muted">' + esc(q.passage) + '</div>' : '') +
          '<div><b>' + esc(q.prompt) + '</b> ' + (q.image && !/^(https?:|data:)/.test(q.image) ? esc(q.image) : '') + '</div>' +
          (q.audio_text ? '<div class="muted">Máy đọc: "' + esc(q.audio_text) + '"</div>' : '') +
          (q.options ? '<div class="muted">' + q.options.map(esc).join(' &nbsp;|&nbsp; ') + '</div>' : '') +
          '<div class="ans">✔ ' + esc(answerText(q)) + '</div></div>'
      )
      .join('');
  }

  function drawLessons(db) {
    main.innerHTML =
      '<div class="panel"><h2>Tạo bài ôn tập mới</h2>' +
      '<div class="steps">' +
      '<div class="step"><b>1. Copy prompt mẫu</b>Dán vào ChatGPT / Gemini / Claude kèm ảnh trang sách.<div class="tools"><button class="btn sm" id="copyPrompt">Copy prompt mẫu</button></div></div>' +
      '<div class="step"><b>2. Dán JSON vào đây</b>Dán kết quả AI trả về, hoặc chọn file .json.<div class="tools"><input type="file" id="file" accept=".json,application/json,text/plain"></div></div>' +
      '<div class="step"><b>3. Xem trước và lưu</b>Kiểm tra câu hỏi và đáp án, rồi lấy link gửi học sinh.<div class="tools"><button class="btn sm ghost" id="loadSample">Dùng thử bài mẫu</button></div></div>' +
      '</div>' +
      '<textarea class="json field" id="json" style="width:100%" placeholder=\'{ "title": "...", "questions": [ ... ] }\'></textarea>' +
      '<div class="tools"><button class="btn sm" id="check">Xem trước</button><button class="btn sm green" id="save" ' + (pending ? '' : 'disabled') + '>Lưu bài học</button></div>' +
      '<div id="result"></div></div>' +
      '<div class="panel"><h2>Bài học đã lưu (' + db.lessons.length + ')</h2>' +
      (db.lessons.length
        ? '<table><tr><th>Bài</th><th>Số câu</th><th>Link gửi học sinh</th><th></th></tr>' +
          db.lessons
            .slice()
            .reverse()
            .map((l) => {
              const done = new Set(db.attempts.filter((a) => a.lessonId === l.id).map((a) => a.studentCode)).size;
              return (
                '<tr><td><b>' + esc(l.title) + '</b><br><span class="muted small">' + (l.grade ? 'Lớp ' + esc(l.grade) + ' · ' : '') + done + ' học sinh đã làm</span></td><td>' + l.questions.length + '</td>' +
                '<td><div class="linkbox"><input readonly value="' + esc(lessonUrl(l.id)) + '"><button class="btn sm" data-copy="' + esc(l.id) + '">Copy</button><a class="btn sm ghost" target="_blank" href="' + esc(lessonUrl(l.id)) + '">Mở</a></div></td>' +
                '<td style="white-space:nowrap"><button class="btn sm ghost" data-report="' + esc(l.id) + '">Báo cáo</button> <button class="btn sm danger" data-del="' + esc(l.id) + '">Xoá</button></td></tr>'
              );
            })
            .join('') +
          '</table>'
        : '<p class="muted">Chưa có bài nào.</p>') +
      '</div>';

    const ta = $('json');
    ta.value = draft;
    ta.addEventListener('input', () => {
      draft = ta.value;
      pending = null;
      $('save').disabled = true;
    });
    if (pending) $('result').innerHTML = '<div class="okbox">Hợp lệ: "' + esc(pending.title) + '" · ' + pending.questions.length + ' câu. Bấm Lưu bài học.</div>' + previewHtml(pending);

    $('copyPrompt').addEventListener('click', () => copy(PROMPT_TEMPLATE, 'Đã copy prompt mẫu'));
    $('loadSample').addEventListener('click', () => {
      draft = ta.value = JSON.stringify(SAMPLE_LESSON, null, 2);
      check();
    });
    $('file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        draft = ta.value = String(r.result);
        check();
      };
      r.readAsText(f);
    });
    $('check').addEventListener('click', check);
    $('save').addEventListener('click', async () => {
      if (!pending) return;
      await Store.saveLesson(pending);
      pending = null;
      draft = '';
      toast('Đã lưu bài học');
      draw();
    });
    main.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(lessonUrl(b.dataset.copy), 'Đã copy link bài học')));
    main.querySelectorAll('[data-report]').forEach((b) =>
      b.addEventListener('click', () => {
        reportSel.lesson = b.dataset.report;
        tab = 'report';
        draw();
      })
    );
    main.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Xoá bài học này và toàn bộ kết quả của nó?')) return;
        await Store.deleteLesson(b.dataset.del);
        draw();
      })
    );

    function check() {
      pending = null;
      let text = ta.value.trim();
      // AI hay bọc JSON trong ```json ... ```: tự gỡ bỏ
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) text = m[1].trim();
      let raw;
      try {
        raw = JSON.parse(text);
      } catch (e) {
        $('save').disabled = true;
        $('result').innerHTML = '<div class="errors"><b>Không đọc được JSON.</b> Hãy copy lại toàn bộ khối JSON từ AI.<br><span class="small">' + esc(e.message) + '</span></div>';
        return;
      }
      const v = Q.validateLesson(raw);
      if (v.errors.length) {
        $('save').disabled = true;
        $('result').innerHTML = '<div class="errors"><b>Cần sửa ' + v.errors.length + ' lỗi:</b><ul>' + v.errors.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
        return;
      }
      pending = v.lesson;
      $('save').disabled = false;
      $('result').innerHTML = '<div class="okbox">Hợp lệ: "' + esc(pending.title) + '" · ' + pending.questions.length + ' câu. Bấm Lưu bài học.</div>' + previewHtml(pending);
    }
  }

  /* ---------------- Lớp & học sinh ---------------- */
  function drawClasses(db) {
    main.innerHTML =
      '<div class="panel"><h2>Thêm lớp mới</h2><div class="grid2"><div>' +
      '<label class="field"><span>Tên lớp</span><input type="text" id="cname" placeholder="Ví dụ: Lớp 3A"></label>' +
      '<button class="btn sm" id="addClass">Tạo lớp</button></div>' +
      '<label class="field"><span>Danh sách học sinh (mỗi dòng một tên, dán từ Excel được)</span><textarea id="cnames" rows="5" placeholder="Nguyễn Minh Anh&#10;Trần Gia Bảo"></textarea></label>' +
      '</div><p class="muted small">Hệ thống tự sinh mã cho từng em. Học sinh dùng mã này để vào làm bài.</p></div>' +
      (db.classes.length
        ? db.classes
            .map((c) => {
              const st = db.students.filter((s) => s.classId === c.id);
              return (
                '<div class="panel"><div class="tools" style="margin-top:0"><h2 style="margin:0;flex:1">' + esc(c.name) + ' <span class="muted small">· ' + st.length + ' học sinh</span></h2>' +
                '<button class="btn sm ghost" data-codes="' + esc(c.id) + '">Copy danh sách mã</button><button class="btn sm ghost" data-add="' + esc(c.id) + '">+ Thêm học sinh</button><button class="btn sm danger" data-delc="' + esc(c.id) + '">Xoá lớp</button></div>' +
                '<table><tr><th>#</th><th>Họ tên</th><th>Mã học sinh</th></tr>' +
                st.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s.name) + '</td><td><code class="code">' + esc(s.code) + '</code></td></tr>').join('') +
                '</table></div>'
              );
            })
            .join('')
        : '<div class="panel"><p class="muted">Chưa có lớp nào.</p></div>');

    $('addClass').addEventListener('click', async () => {
      const name = $('cname').value.trim();
      if (!name) return toast('Hãy nhập tên lớp');
      await Store.createClass(name, $('cnames').value.split('\n'));
      draw();
    });
    main.querySelectorAll('[data-codes]').forEach((b) =>
      b.addEventListener('click', () => {
        const st = db.students.filter((s) => s.classId === b.dataset.codes);
        copy(st.map((s) => s.name + '\t' + s.code).join('\n'), 'Đã copy, dán vào Excel/Zalo được');
      })
    );
    main.querySelectorAll('[data-add]').forEach((b) =>
      b.addEventListener('click', async () => {
        const names = prompt('Tên học sinh mới (nhiều em thì cách nhau bằng dấu phẩy):');
        if (!names) return;
        await Store.addStudents(b.dataset.add, names.split(','));
        draw();
      })
    );
    main.querySelectorAll('[data-delc]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Xoá lớp này cùng học sinh và kết quả của lớp?')) return;
        await Store.deleteClass(b.dataset.delc);
        draw();
      })
    );
  }

  /* ---------------- Báo cáo ---------------- */
  const color = (p) => (p >= 0.75 ? '#22b35e' : p >= 0.5 ? '#f0a92b' : '#e5484d');
  const fmtTime = (s) => Math.floor(s / 60) + 'p' + String(s % 60).padStart(2, '0');

  function drawReport(db) {
    if (!db.lessons.length) {
      main.innerHTML = '<div class="panel"><h2>Báo cáo</h2><p class="muted">Chưa có bài học nào. Bấm "Nạp dữ liệu mẫu" ở góc trên để xem thử báo cáo.</p></div>';
      return;
    }
    if (!db.lessons.some((l) => l.id === reportSel.lesson)) reportSel.lesson = db.lessons[db.lessons.length - 1].id;
    if (reportSel.cls && !db.classes.some((c) => c.id === reportSel.cls)) reportSel.cls = '';
    const lesson = db.lessons.find((l) => l.id === reportSel.lesson);
    const students = db.students.filter((s) => !reportSel.cls || s.classId === reportSel.cls);
    const n = lesson.questions.length;

    // Mỗi học sinh: lần đầu (dùng để phân tích), điểm cao nhất, số lần làm
    // Lọc theo ngày nộp bài
    const inRange = (a) => {
      const d = dayOf(a.submittedAt);
      return (!reportSel.from || d >= reportSel.from) && (!reportSel.to || d <= reportSel.to);
    };
    const codes = new Set(students.map((s) => s.code));
    const scoped = db.attempts.filter((a) => a.lessonId === lesson.id && codes.has(a.studentCode) && inRange(a)).sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const ranged = reportSel.from || reportSel.to;

    const rows = students.map((s) => {
      const at = scoped.filter((a) => a.studentCode === s.code).sort((a, b) => a.attemptNo - b.attemptNo);
      return { s, first: at[0] || null, best: at.length ? Math.max(...at.map((a) => a.score)) : null, count: at.length };
    });
    const done = rows.filter((r) => r.first);
    const firsts = done.map((r) => r.first);

    // Mỗi câu: tỉ lệ đúng ở lần đầu + câu trả lời sai phổ biến nhất
    const qs = lesson.questions.map((q, i) => {
      const right = firsts.filter((a) => a.answers[i] && a.answers[i].correct).length;
      const wrong = {};
      firsts.forEach((a) => {
        const x = a.answers[i];
        if (x && !x.correct) wrong[x.responseText || '(bỏ trống)'] = (wrong[x.responseText || '(bỏ trống)'] || 0) + 1;
      });
      const top = Object.entries(wrong).sort((a, b) => b[1] - a[1])[0];
      return { q, i, right, pct: firsts.length ? right / firsts.length : 0, top };
    });
    const sorted = qs.slice().sort((a, b) => a.pct - b.pct);
    const avg = firsts.length ? firsts.reduce((t, a) => t + a.score, 0) / firsts.length : 0;

    main.innerHTML =
      '<div class="panel"><div class="grid2">' +
      '<label class="field"><span>Bài học</span><select id="selLesson">' + db.lessons.map((l) => '<option value="' + esc(l.id) + '"' + (l.id === lesson.id ? ' selected' : '') + '>' + esc(l.title) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Lớp</span><select id="selClass"><option value="">Tất cả các lớp</option>' + db.classes.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === reportSel.cls ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>' +
      '</div><div class="tools"><b>Ngày nộp bài:</b> từ <input type="date" id="dFrom" value="' + esc(reportSel.from) + '"> đến <input type="date" id="dTo" value="' + esc(reportSel.to) + '">' +
      '<button class="btn sm ghost" id="dToday">Hôm nay</button><button class="btn sm ghost" id="d7">7 ngày qua</button><button class="btn sm ghost" id="dAll">Tất cả</button>' +
      '<span style="flex:1"></span><button class="btn sm green" id="export"' + (scoped.length ? '' : ' disabled') + '>⬇ Xuất Excel (' + scoped.length + ' lượt nộp)</button></div>' +
      '<p class="muted small" style="margin:0">' + (ranged ? 'Đang xem các lượt nộp ' + (reportSel.from ? 'từ ' + showDay(reportSel.from) : '') + (reportSel.to ? ' đến ' + showDay(reportSel.to) : '') + '. "Lần đầu" là lần làm sớm nhất trong khoảng ngày này.' : 'Đang xem tất cả các ngày.') + '</p></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + done.length + '/' + students.length + '</b><span>học sinh đã làm bài</span></div>' +
      '<div class="stat"><b>' + (firsts.length ? avg.toFixed(1) + '/' + n : '-') + '</b><span>điểm trung bình (lần đầu)</span></div>' +
      '<div class="stat"><b>' + (firsts.length ? 'Câu ' + (sorted[0].i + 1) : '-') + '</b><span>câu sai nhiều nhất' + (firsts.length ? ' (' + Math.round(sorted[0].pct * 100) + '% đúng)' : '') + '</span></div>' +
      '<div class="stat"><b>' + (firsts.length ? 'Câu ' + (sorted[n - 1].i + 1) : '-') + '</b><span>câu đúng nhiều nhất' + (firsts.length ? ' (' + Math.round(sorted[n - 1].pct * 100) + '% đúng)' : '') + '</span></div>' +
      '</div>' +
      (firsts.length
        ? '<div class="panel"><h2>Từng câu hỏi, xếp từ khó nhất</h2><p class="muted small">Tính theo lần làm đầu tiên của mỗi học sinh. Câu màu đỏ là câu nên giảng lại trên lớp.</p>' +
          sorted
            .map(
              (x) =>
                '<div class="qbar"><span class="qn">C' + (x.i + 1) + '</span><div class="qt"><b>' + esc(x.q.prompt) + '</b><small>' + esc(Q.TYPES[x.q.type]) + ' · ' + esc(Q.SKILLS[x.q.skill]) + ' · Đáp án: ' + esc(answerText(x.q)) + '</small>' +
                (x.top ? '<small class="wrong">Sai nhiều nhất: "' + esc(x.top[0]) + '" (' + x.top[1] + ' em)</small>' : '') +
                '</div><div class="meter"><i style="width:' + x.pct * 100 + '%;background:' + color(x.pct) + '"></i></div><span class="pct" style="color:' + color(x.pct) + '">' + Math.round(x.pct * 100) + '%</span></div>'
            )
            .join('') +
          '</div>'
        : '<div class="panel"><p class="muted">Chưa có học sinh nào nộp bài này.</p></div>') +
      '<div class="panel"><h2>Từng học sinh</h2><p class="muted small">Ô xanh/đỏ là kết quả lần làm đầu tiên. Rê chuột vào ô đỏ để xem em đã trả lời gì.</p><div class="matrix-wrap"><table class="matrix"><tr><th>Học sinh</th>' +
      lesson.questions.map((q, i) => '<th title="' + esc(q.prompt) + '">C' + (i + 1) + '</th>').join('') +
      '<th>Lần đầu</th><th>Cao nhất</th><th>Số lần</th><th>Thời gian</th><th>Ngày làm</th></tr>' +
      rows
        .slice()
        .sort((a, b) => (a.first ? a.first.score : 99) - (b.first ? b.first.score : 99))
        .map((r) =>
          r.first
            ? '<tr><td><b>' + esc(r.s.name) + '</b> <span class="muted small">' + esc(r.s.code) + '</span></td>' +
              lesson.questions.map((_, i) => { const x = r.first.answers[i] || {}; return '<td><span class="cell ' + (x.correct ? 'ok' : 'bad') + '" title="' + esc(x.correct ? 'Đúng' : 'Trả lời: ' + (x.responseText || '(bỏ trống)')) + '">' + (x.correct ? '✓' : '✗') + '</span></td>'; }).join('') +
              '<td><b>' + r.first.score + '/' + n + '</b></td><td>' + r.best + '/' + n + '</td><td>' + r.count + '</td><td>' + fmtTime(r.first.durationSec) + '</td><td>' + showDay(dayOf(r.first.submittedAt)) + ' ' + timeOf(r.first.submittedAt) + '</td></tr>'
            : '<tr class="notdone"><td>' + esc(r.s.name) + ' <span class="small">' + esc(r.s.code) + '</span></td><td colspan="' + (n + 5) + '" style="text-align:left">' + (ranged ? 'Không làm bài trong khoảng ngày này' : 'Chưa làm bài') + '</td></tr>'
        )
        .join('') +
      '</table></div></div>';

    $('selLesson').addEventListener('change', (e) => {
      reportSel.lesson = e.target.value;
      draw();
    });
    $('selClass').addEventListener('change', (e) => {
      reportSel.cls = e.target.value;
      draw();
    });
    const setRange = (from, to) => {
      reportSel.from = from;
      reportSel.to = to;
      draw();
    };
    $('dFrom').addEventListener('change', (e) => setRange(e.target.value, reportSel.to));
    $('dTo').addEventListener('change', (e) => setRange(reportSel.from, e.target.value));
    $('dToday').addEventListener('click', () => setRange(dayOfDate(new Date()), dayOfDate(new Date())));
    $('d7').addEventListener('click', () => setRange(dayOfDate(new Date(Date.now() - 6 * 86400000)), dayOfDate(new Date())));
    $('dAll').addEventListener('click', () => setRange('', ''));
    $('export').addEventListener('click', () => {
      const book = buildExport(db, lesson, scoped);
      const name = 'ketqua_' + lesson.title.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') + '_' + (reportSel.from || 'tat-ca') + (reportSel.to && reportSel.to !== reportSel.from ? '_den_' + reportSel.to : '');
      if (window.XLSX) {
        const wb = XLSX.utils.book_new();
        book.forEach((s) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name));
        XLSX.writeFile(wb, name + '.xlsx');
      } else {
        // Không tải được thư viện Excel (mất mạng): xuất CSV, Excel vẫn mở được.
        const csv = book[0].rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
        a.download = name + '.csv';
        a.click();
      }
    });
  }

  /* Dữ liệu xuất Excel: tab KetQua (mỗi lượt nộp một dòng) và tab ChiTiet (mỗi câu trả lời một dòng). */
  function buildExport(db, lesson, attempts) {
    const info = (code) => {
      const s = db.students.find((x) => x.code === code) || { name: '', classId: '' };
      const c = db.classes.find((x) => x.id === s.classId);
      return { name: s.name, cls: c ? c.name : '' };
    };
    const summary = [['Ngày', 'Giờ', 'Lớp', 'Mã HS', 'Họ tên', 'Bài học', 'Lần thứ', 'Điểm', 'Tổng số câu', 'Thời gian (giây)'].concat(lesson.questions.map((_, i) => 'C' + (i + 1)))];
    const detail = [['Ngày', 'Lớp', 'Mã HS', 'Họ tên', 'Lần thứ', 'Câu', 'Đề bài', 'Kết quả', 'Trả lời của học sinh', 'Đáp án đúng']];
    attempts.forEach((a) => {
      const st = info(a.studentCode);
      const day = dayOf(a.submittedAt);
      summary.push([day, timeOf(a.submittedAt), st.cls, a.studentCode, st.name, lesson.title, a.attemptNo, a.score, a.total, a.durationSec].concat(lesson.questions.map((_, i) => ((a.answers[i] || {}).correct ? 'Đ' : 'S'))));
      lesson.questions.forEach((q, i) => {
        const x = a.answers[i] || {};
        detail.push([day, st.cls, a.studentCode, st.name, a.attemptNo, i + 1, q.prompt, x.correct ? 'Đúng' : 'Sai', x.responseText || '', answerText(q)]);
      });
    });
    return [
      { name: 'KetQua', rows: summary },
      { name: 'ChiTiet', rows: detail },
    ];
  }

  window.addEventListener('hashchange', () => {
    const t = location.hash.slice(1);
    if (t && t !== tab) {
      tab = t;
      draw();
    }
  });
  draw();
})();
