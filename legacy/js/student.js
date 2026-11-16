/* Trang học sinh: nhập mã -> làm bài từng câu -> nộp -> xem kết quả. */
(async function () {
  const app = document.getElementById('app');
  const esc = Q.esc;
  const STUDENT_KEY = 'bgs_student';
  const lessonId = new URLSearchParams(location.search).get('bai');
  const message = (emoji, title, text) => (app.innerHTML = '<div class="center"><div class="big-emoji">' + emoji + '</div><h1>' + esc(title) + '</h1><p class="muted">' + esc(text) + '</p></div>');

  let lesson = null;
  let student = null;
  message('⏳', 'Đang tải...', 'Em chờ một chút nhé.');
  try {
    if (!lessonId) return await home();
    lesson = await Store.getLesson(lessonId);
    if (!lesson) return message('🔍', 'Không tìm thấy bài học', 'Em hãy hỏi lại thầy cô đường link nhé.');
    const saved = localStorage.getItem(STUDENT_KEY);
    if (saved) student = await Store.findStudent(saved);
    student ? intro() : await login();
  } catch (e) {
    message('📡', 'Chưa tải được', e.message + ' Em thử tải lại trang nhé.');
  }

  async function home() {
    const lessons = await Store.listLessons();
    app.innerHTML =
      '<div class="center"><div class="big-emoji">📚</div><h1>Bài Giảng Số</h1>' +
      '<p class="muted">Ôn tập tiếng Anh tại nhà</p>' +
      (lessons.length
        ? '<div class="card"><h3>Bài ôn tập</h3><div class="lesson-list">' +
          lessons.map((l) => '<a href="?bai=' + esc(l.id) + '">' + esc(l.title) + ' <span class="muted small">· ' + l.count + ' câu</span></a>').join('') +
          '</div></div>'
        : '<div class="card"><p>Chưa có bài học nào. Vào trang giáo viên để tạo bài.</p></div>') +
      '<p style="margin-top:22px"><a class="btn ghost" href="admin.html">👩‍🏫 Trang giáo viên</a></p></div>';
  }

  async function login() {
    const demo = await Store.demoCode();
    const hasStudents = await Store.hasStudents();
    app.innerHTML =
      '<div class="center"><div class="big-emoji">👋</div><h1>Chào em!</h1>' +
      '<p>Nhập <b>mã học sinh</b> thầy cô đã phát cho em.</p>' +
      '<form id="f"><input class="code-input" id="code" maxlength="8" placeholder="HS0000" autocomplete="off">' +
      '<p class="err" id="err"></p><button class="btn" type="submit" id="enter">Vào học</button></form>' +
      (demo ? '<p class="muted small" style="margin-top:20px">Bản demo: thử mã <b>' + esc(demo) + '</b></p>' : '') +
      (hasStudents ? '' : '<p class="err" style="margin-top:20px">Chưa có học sinh nào trong hệ thống. Giáo viên cần tạo lớp ở <a href="admin.html#classes">trang giáo viên</a> trước.</p>') +
      '</div>';
    const inp = document.getElementById('code');
    const err = document.getElementById('err');
    const btn = document.getElementById('enter');
    inp.focus();
    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!inp.value.trim()) return;
      btn.disabled = true;
      err.textContent = '';
      try {
        const s = await Store.findStudent(inp.value);
        if (!s) {
          err.textContent = 'Mã chưa đúng, em kiểm tra lại nhé.';
          return;
        }
        student = s;
        localStorage.setItem(STUDENT_KEY, s.code);
        intro();
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        btn.disabled = false;
      }
    });
  }

  function intro() {
    app.innerHTML =
      '<div class="center"><div class="big-emoji">🦊</div><h1>Chào ' + esc(student.name) + '!</h1>' +
      '<p class="muted">' + esc(student.className) + '</p>' +
      '<div class="card" style="margin:18px 0"><h2>' + esc(lesson.title) + '</h2>' +
      (lesson.description ? '<p>' + esc(lesson.description) + '</p>' : '') +
      '<p class="muted" style="margin:0">' + lesson.questions.length + ' câu hỏi · làm lại bao nhiêu lần cũng được</p></div>' +
      '<button class="btn green" id="go">Bắt đầu ▶</button>' +
      '<p class="small" style="margin-top:18px"><a href="#" id="switch">Không phải ' + esc(student.name) + '? Đổi mã</a></p></div>';
    document.getElementById('go').addEventListener('click', run);
    document.getElementById('switch').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem(STUDENT_KEY);
      student = null;
      login();
    });
  }

  function run() {
    const total = lesson.questions.length;
    const responses = [];
    const grades = [];
    const startedAt = Date.now();
    let i = 0;
    show();

    function show() {
      const q = lesson.questions[i];
      const hasAudio = q.audio_text || q.audio_url;
      app.innerHTML =
        '<div class="topbar"><div class="bar"><i style="width:' + (i / total) * 100 + '%"></i></div><span class="count">' + (i + 1) + '/' + total + '</span></div>' +
        '<div class="card"><span class="badge">' + esc(Q.SKILLS[q.skill]) + '</span>' +
        (q.passage ? '<div class="passage">' + esc(q.passage) + '</div>' : '') +
        '<p class="q-prompt">' + esc(q.prompt) + '</p>' +
        (hasAudio ? '<button type="button" class="audio-btn" id="audio">🔊 Nghe</button>' : '') +
        Q.imageHtml(q.image) +
        '<div id="body"></div></div>' +
        '<div class="footer" id="footer"><button class="btn" id="check" disabled>Kiểm tra</button></div>';
      window.scrollTo(0, 0);

      const check = document.getElementById('check');
      const ctl = Q.render(q, document.getElementById('body'), () => (check.disabled = !ctl.answered()));
      if (hasAudio) {
        document.getElementById('audio').addEventListener('click', () => Q.speak(q));
        Q.speak(q);
      }
      check.addEventListener('click', () => {
        const g = Q.grade(q, ctl.get());
        responses[i] = ctl.get();
        grades[i] = g;
        ctl.lock();
        const last = i === total - 1;
        document.getElementById('footer').innerHTML =
          '<div class="feedback ' + (g.correct ? 'ok' : 'bad') + '"><b>' + (g.correct ? '🎉 Giỏi lắm!' : '😅 Chưa đúng rồi') + '</b>' +
          (g.correct ? '' : '<span>Đáp án đúng: ' + esc(g.correctText) + '</span>') +
          (q.explanation ? '<span>' + esc(q.explanation) + '</span>' : '') +
          '</div><p class="err" id="sendErr" style="text-align:center;min-height:0"></p><button class="btn ' + (g.correct ? 'green' : '') + '" id="next">' + (last ? 'Nộp bài' : 'Tiếp theo ▶') + '</button>';
        const next = document.getElementById('next');
        next.focus();
        next.addEventListener('click', () => {
          if (last) return finish(next);
          i++;
          show();
        });
      });
    }

    /* Nộp bài. Nếu mạng lỗi thì giữ nguyên bài làm để em bấm nộp lại. */
    async function finish(btn) {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      btn.disabled = true;
      btn.textContent = 'Đang nộp bài...';
      let r;
      try {
        r = await Store.submitAttempt({ lessonId: lesson.id, studentCode: student.code, responses, durationSec: Math.round((Date.now() - startedAt) / 1000) });
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Nộp lại';
        document.getElementById('sendErr').textContent = 'Chưa nộp được bài. ' + e.message;
        return;
      }
      const a = r.attempt;
      const pct = a.score / a.total;
      const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : pct > 0 ? 1 : 0;
      app.innerHTML =
        '<div class="center"><div class="stars">' + [1, 2, 3].map((n) => '<span class="' + (n <= stars ? '' : 'off') + '">⭐</span>').join('') + '</div>' +
        '<h1>' + (stars === 3 ? 'Xuất sắc!' : stars === 2 ? 'Làm tốt lắm!' : 'Cố gắng thêm nhé!') + '</h1>' +
        '<div class="score">' + a.score + '/' + a.total + '</div>' +
        '<p class="muted">Lần làm thứ ' + a.attemptNo + ' · Điểm cao nhất của em: ' + r.best + '/' + a.total + '</p>' +
        '<div class="review">' +
        lesson.questions
          .map((q, k) => '<div class="' + (grades[k].correct ? 'ok' : 'bad') + '"><b>Câu ' + (k + 1) + '.</b> ' + esc(q.prompt) + (grades[k].correct ? '' : '<br><span class="muted">Đáp án đúng: ' + esc(grades[k].correctText) + '</span>') + '</div>')
          .join('') +
        '</div><div class="row"><button class="btn" id="again">🔁 Làm lại</button></div>' +
        '<p class="muted small" style="margin-top:16px">Bài của em đã được gửi cho thầy cô.</p></div>';
      window.scrollTo(0, 0);
      document.getElementById('again').addEventListener('click', run);
    }
  }
})();
