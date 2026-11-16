/* Bộ câu hỏi: kiểm tra JSON, hiển thị, chấm điểm.
   Dùng chung cho trang học sinh và trang giáo viên. */
const Q = (() => {
  const TYPES = {
    multiple_choice: 'Trắc nghiệm',
    true_false: 'Đúng / Sai',
    fill_blank: 'Điền từ',
    matching: 'Nối cặp',
    word_order: 'Sắp xếp câu',
  };
  const SKILLS = {
    vocabulary: 'Từ vựng',
    grammar: 'Ngữ pháp',
    listening: 'Nghe',
    reading: 'Đọc',
    writing: 'Viết',
  };

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const norm = (s) =>
    String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*[.,!?;:]+$/g, '');

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* Kiểm tra và chuẩn hoá JSON bài học. Trả về { errors, lesson }. */
  function validateLesson(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['File phải là một đối tượng JSON { ... }.'], lesson: null };
    const lesson = {
      title: String(raw.title || '').trim(),
      grade: raw.grade == null ? '' : String(raw.grade),
      unit: String(raw.unit || '').trim(),
      description: String(raw.description || '').trim(),
      questions: [],
    };
    if (!lesson.title) errors.push('Thiếu tên bài học ("title").');
    if (!Array.isArray(raw.questions) || !raw.questions.length) {
      errors.push('Thiếu danh sách câu hỏi ("questions").');
      return { errors, lesson: null };
    }
    raw.questions.forEach((r, i) => {
      const n = 'Câu ' + (i + 1) + ': ';
      if (!r || typeof r !== 'object') return errors.push(n + 'không hợp lệ.');
      const q = {
        type: r.type,
        skill: SKILLS[r.skill] ? r.skill : 'vocabulary',
        prompt: String(r.prompt || '').trim(),
        passage: r.passage ? String(r.passage) : '',
        image: r.image ? String(r.image) : '',
        audio_text: r.audio_text ? String(r.audio_text) : '',
        audio_url: r.audio_url ? String(r.audio_url) : '',
        explanation: r.explanation ? String(r.explanation) : '',
      };
      if (!TYPES[q.type]) return errors.push(n + 'dạng bài "' + r.type + '" chưa được hỗ trợ.');
      if (!q.prompt) errors.push(n + 'thiếu đề bài ("prompt").');

      if (q.type === 'multiple_choice') {
        if (!Array.isArray(r.options) || r.options.length < 2) return errors.push(n + 'cần ít nhất 2 lựa chọn ("options").');
        q.options = r.options.map(String);
        let a = r.answer;
        if (typeof a === 'string') {
          const idx = q.options.findIndex((o) => norm(o) === norm(a));
          a = idx >= 0 ? idx : Number(a);
        }
        if (!Number.isInteger(a) || a < 0 || a >= q.options.length) return errors.push(n + '"answer" phải là vị trí đáp án đúng (bắt đầu từ 0).');
        q.answer = a;
      } else if (q.type === 'true_false') {
        let a = r.answer;
        if (typeof a === 'string') a = a.toLowerCase() === 'true' ? true : a.toLowerCase() === 'false' ? false : null;
        if (typeof a !== 'boolean') return errors.push(n + '"answer" phải là true hoặc false.');
        q.answer = a;
      } else if (q.type === 'fill_blank') {
        const a = (Array.isArray(r.answer) ? r.answer : [r.answer]).filter((x) => x != null && String(x).trim()).map(String);
        if (!a.length) return errors.push(n + 'thiếu đáp án ("answer").');
        q.answer = a;
      } else if (q.type === 'matching') {
        if (!Array.isArray(r.pairs) || r.pairs.length < 2) return errors.push(n + 'cần ít nhất 2 cặp ("pairs").');
        if (r.pairs.some((p) => !p || p.left == null || p.right == null)) return errors.push(n + 'mỗi cặp cần "left" và "right".');
        q.pairs = r.pairs.map((p) => ({ left: String(p.left), right: String(p.right) }));
      } else if (q.type === 'word_order') {
        const a = String(r.answer || '').trim();
        if (a.split(/\s+/).length < 2) return errors.push(n + '"answer" phải là một câu có ít nhất 2 từ.');
        q.answer = a;
      }
      lesson.questions.push(q);
    });
    return { errors, lesson: errors.length ? null : lesson };
  }

  /* Chấm một câu. Trả về { correct, correctText, responseText }. */
  function grade(q, resp) {
    if (q.type === 'multiple_choice')
      return { correct: resp === q.answer, correctText: q.options[q.answer], responseText: resp == null ? '' : q.options[resp] };
    if (q.type === 'true_false') {
      const t = (v) => (v ? 'Đúng' : 'Sai');
      return { correct: resp === q.answer, correctText: t(q.answer), responseText: resp == null ? '' : t(resp) };
    }
    if (q.type === 'fill_blank')
      return { correct: q.answer.map(norm).includes(norm(resp)), correctText: q.answer[0], responseText: String(resp || '').trim() };
    if (q.type === 'matching') {
      const r = resp || [];
      return {
        correct: q.pairs.every((_, i) => r[i] === i),
        correctText: q.pairs.map((p) => p.left + ' → ' + p.right).join(', '),
        responseText: q.pairs.map((p, i) => p.left + ' → ' + (r[i] == null ? '?' : q.pairs[r[i]].right)).join(', '),
      };
    }
    if (q.type === 'word_order')
      return { correct: norm(resp) === norm(q.answer), correctText: q.answer, responseText: String(resp || '') };
    return { correct: false, correctText: '', responseText: '' };
  }

  function speak(q) {
    if (q.audio_url) {
      new Audio(q.audio_url).play().catch(() => {});
      return;
    }
    if (!q.audio_text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(q.audio_text);
    u.lang = 'en-US';
    u.rate = 0.8;
    speechSynthesis.speak(u);
  }

  const imageHtml = (img) => {
    if (!img) return '';
    return /^(https?:|data:)/.test(img) ? '<img class="q-img" src="' + esc(img) + '" alt="">' : '<div class="q-emoji">' + esc(img) + '</div>';
  };

  /* Vẽ phần trả lời của một câu vào el. onChange() được gọi mỗi khi học sinh thao tác.
     Trả về { get, answered, lock }. */
  function render(q, el, onChange) {
    let resp = null;
    let answered = false;
    const changed = () => onChange && onChange();
    const api = { get: () => resp, answered: () => answered, lock: () => el.classList.add('locked') };

    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      const opts = q.type === 'true_false' ? [{ v: true, t: '✔ Đúng' }, { v: false, t: '✘ Sai' }] : q.options.map((t, i) => ({ v: i, t }));
      el.innerHTML = '<div class="opts ' + (q.type === 'true_false' ? 'opts-tf' : '') + '">' + opts.map((o, i) => '<button type="button" class="opt" data-i="' + i + '">' + esc(o.t) + '</button>').join('') + '</div>';
      const btns = [...el.querySelectorAll('.opt')];
      btns.forEach((b, i) =>
        b.addEventListener('click', () => {
          btns.forEach((x) => x.classList.remove('sel'));
          b.classList.add('sel');
          resp = opts[i].v;
          answered = true;
          changed();
        })
      );
      api.lock = () => {
        el.classList.add('locked');
        btns.forEach((b, i) => {
          if (opts[i].v === q.answer) b.classList.add('right');
          else if (b.classList.contains('sel')) b.classList.add('wrong');
        });
      };
    } else if (q.type === 'fill_blank') {
      el.innerHTML = '<input class="fill" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ câu trả lời...">';
      const inp = el.querySelector('input');
      inp.addEventListener('input', () => {
        resp = inp.value;
        answered = !!inp.value.trim();
        changed();
      });
      api.lock = () => {
        el.classList.add('locked');
        inp.disabled = true;
      };
      setTimeout(() => inp.focus(), 50);
    } else if (q.type === 'matching') {
      const n = q.pairs.length;
      const rightOrder = shuffle(q.pairs.map((_, i) => i));
      resp = new Array(n).fill(null);
      let pick = null;
      const draw = () => {
        const colorOf = (li) => (resp[li] == null ? '' : ' pair-' + (li % 6));
        el.innerHTML =
          '<div class="match"><div class="match-col">' +
          q.pairs.map((p, i) => '<button type="button" class="m-item' + colorOf(i) + (pick === i ? ' sel' : '') + '" data-l="' + i + '">' + esc(p.left) + '</button>').join('') +
          '</div><div class="match-col">' +
          rightOrder
            .map((ri) => {
              const li = resp.indexOf(ri);
              return '<button type="button" class="m-item' + (li >= 0 ? ' pair-' + (li % 6) : '') + '" data-r="' + ri + '">' + esc(q.pairs[ri].right) + '</button>';
            })
            .join('') +
          '</div></div><p class="hint">Chạm một ô bên trái, rồi chạm ô đúng bên phải.</p>';
        el.querySelectorAll('[data-l]').forEach((b) =>
          b.addEventListener('click', () => {
            const i = +b.dataset.l;
            if (resp[i] != null) resp[i] = null;
            pick = pick === i ? null : i;
            after();
          })
        );
        el.querySelectorAll('[data-r]').forEach((b) =>
          b.addEventListener('click', () => {
            const ri = +b.dataset.r;
            const used = resp.indexOf(ri);
            if (used >= 0) resp[used] = null;
            if (pick != null) {
              resp[pick] = ri;
              pick = null;
            }
            after();
          })
        );
      };
      const after = () => {
        answered = resp.every((x) => x != null);
        draw();
        changed();
      };
      draw();
    } else if (q.type === 'word_order') {
      const words = q.answer.trim().split(/\s+/);
      let order = shuffle(words.map((_, i) => i));
      if (words.length > 1 && order.every((v, i) => v === i)) order.reverse();
      let chosen = [];
      const draw = () => {
        el.innerHTML =
          '<div class="wo-line">' +
          (chosen.length ? chosen.map((i) => '<button type="button" class="chip" data-c="' + i + '">' + esc(words[i]) + '</button>').join('') : '<span class="wo-empty">Chạm vào các từ bên dưới</span>') +
          '</div><div class="wo-bank">' +
          order.map((i) => '<button type="button" class="chip' + (chosen.includes(i) ? ' used' : '') + '" data-b="' + i + '">' + esc(words[i]) + '</button>').join('') +
          '</div>';
        el.querySelectorAll('[data-b]').forEach((b) =>
          b.addEventListener('click', () => {
            const i = +b.dataset.b;
            if (!chosen.includes(i)) chosen.push(i);
            after();
          })
        );
        el.querySelectorAll('[data-c]').forEach((b) =>
          b.addEventListener('click', () => {
            chosen = chosen.filter((x) => x !== +b.dataset.c);
            after();
          })
        );
      };
      const after = () => {
        resp = chosen.map((i) => words[i]).join(' ');
        answered = chosen.length === words.length;
        draw();
        changed();
      };
      draw();
    }
    return api;
  }

  return { TYPES, SKILLS, esc, norm, validateLesson, grade, render, speak, imageHtml };
})();
