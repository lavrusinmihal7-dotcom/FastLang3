/* AI course tutor: a chat bubble on lesson and course pages. Talks to /api/chat on the FastLang server. */
(function () {
  var root = document.getElementById('lesson_root') || document.getElementById('overview_root');
  if (!root) return;
  var course = root.getAttribute('data-course'), lesson = parseInt(root.getAttribute('data-lesson') || '0', 10);
  var KEY = 'fl_chat:' + course, msgs = [], busy = false;
  try { msgs = JSON.parse(sessionStorage.getItem(KEY)) || []; } catch (e) { msgs = []; }
  var h2 = document.querySelector('.lesson_card h2'), heading = lesson && h2 ? h2.textContent : 'Course overview';
  var courseName = (document.querySelector('.page_banner h1') || {}).textContent || 'Course';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  var fab = el('button', 'fl_chat_fab'); fab.type = 'button'; fab.setAttribute('aria-label', 'Ask the course tutor'); fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 014 13.5z" fill="currentColor"/></svg><span>Ask the tutor</span>';
  var panel = el('section', 'fl_chat'); panel.setAttribute('aria-label', 'Course tutor chat'); panel.hidden = true;
  var head = el('div', 'fl_chat_head');
  var ttl = el('div', 'fl_chat_title'); ttl.appendChild(el('b', '', 'Course tutor')); ttl.appendChild(el('small', '', courseName.replace(/ - Lesson \d+$/, '') + (lesson ? ' \u00B7 Lesson ' + lesson : '')));
  var close = el('button', 'fl_chat_x', '\u00D7'); close.type = 'button'; close.setAttribute('aria-label', 'Close chat');
  head.appendChild(ttl); head.appendChild(close);
  var log = el('div', 'fl_chat_log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
  var chips = el('div', 'fl_chat_chips');
  var form = el('form', 'fl_chat_form'), input = el('textarea'); input.rows = 1; input.maxLength = 800; input.placeholder = 'Ask about this ' + (lesson ? 'lesson' : 'course') + '...'; input.setAttribute('aria-label', 'Your question');
  var send = el('button', '', 'Send'); send.type = 'submit'; form.appendChild(input); form.appendChild(send);
  var note = el('div', 'fl_chat_note'); note.style.display = 'none';
  panel.appendChild(head); panel.appendChild(log); panel.appendChild(chips); panel.appendChild(note); panel.appendChild(form);
  document.body.appendChild(fab); document.body.appendChild(panel);

  var ideas = lesson ? ['Explain this lesson simply', 'Quiz me on it', 'Give me a memory trick', 'Common mistakes?']
                     : ['How should I study this course?', 'Make me a 10-minute daily plan', 'What will I learn?'];
  ideas.forEach(function (t) { var b = el('button', '', t); b.type = 'button'; b.addEventListener('click', function () { ask(t); }); chips.appendChild(b); });

  /* safe text rendering: only line breaks, "- " bullets and **bold**, all inserted as text */
  function fill(node, text) {
    text.split('\n').forEach(function (line) {
      var p = el('p'); if (/^\s*[-\u2022]\s+/.test(line)) { p.className = 'li'; line = line.replace(/^\s*[-\u2022]\s+/, ''); }
      line.split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
        if (/^\*\*[^*]+\*\*$/.test(part)) p.appendChild(el('b', '', part.slice(2, -2))); else p.appendChild(document.createTextNode(part));
      });
      if (line.trim() || true) node.appendChild(p);
    });
  }
  function add(role, text, cls) { var b = el('div', 'fl_msg ' + role + (cls ? ' ' + cls : '')); fill(b, text); log.appendChild(b); log.scrollTop = log.scrollHeight; return b; }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20))); } catch (e) {} }
  function setBusy(v) { busy = v; send.disabled = v; input.disabled = v; if (!v) input.focus(); }

  /* the same lesson data the server would read, taken from the page, so the built-in tutor works even if the server cannot be reached */
  function domCtx() {
    var cat = window.FL && FL.catalog && FL.catalog.courses[course], q = function (sel) { return [].slice.call(document.querySelectorAll(sel)); };
    var t = function (sel) { var n = document.querySelector(sel); return n ? n.textContent.trim() : ''; };
    return {
      name: cat ? cat.name : courseName, lang: cat ? cat.lang : /japanese/.test(course) ? 'Japanese' : /italian/.test(course) ? 'Italian' : 'English',
      lesson: lesson, total: parseInt(root.getAttribute('data-total'), 10) || 0, reward: cat ? cat.reward : 0, title: t('.lesson_card h2') || courseName, intro: t('.lesson_intro'),
      head: q('.lesson_table thead th').map(function (x) { return x.textContent.trim(); }),
      rows: q('.lesson_table tbody tr').map(function (tr) { return [].map.call(tr.children, function (td) { return td.textContent.trim(); }); }),
      notes: q('.lesson_notes li').map(function (x) { return x.textContent.trim(); }), practice: t('.practice_box').replace(/^Practice:\s*/, ''),
      titles: q('.ov_title').map(function (x) { return x.textContent.trim(); })
    };
  }
  var WHY = { no_key: 'No AI key is set on this server, so I am answering from built-in tips.', bad_key: 'The AI key was rejected, so I am answering from built-in tips.', unavailable: 'The AI service did not respond, so I am answering from built-in tips.', offline: 'The server could not be reached, so I am answering from built-in tips.' };
  function suggest(list) {
    var old = log.querySelector('.fl_sugg'); if (old) old.remove();
    if (!list || !list.length) return;
    var box = el('div', 'fl_sugg');
    list.forEach(function (t) { var b = el('button', '', t); b.type = 'button'; b.addEventListener('click', function () { ask(t); }); box.appendChild(b); });
    log.appendChild(box); log.scrollTop = log.scrollHeight;
  }
  function showReply(text, mode, why, list) {
    add('bot', text); msgs.push({ role: 'assistant', content: text }); save();
    if (mode === 'basic') { note.textContent = WHY[why] || WHY.no_key; note.style.display = 'block'; suggest(list); } else note.style.display = 'none';
  }

  function ask(text) {
    text = (text || '').trim(); if (!text || busy) return;
    chips.style.display = 'none'; suggest(null); add('user', text); msgs.push({ role: 'user', content: text }); save();
    input.value = ''; autosize(); setBusy(true);
    var typing = el('div', 'fl_msg bot typing', ''); typing.innerHTML = '<i></i><i></i><i></i>'; typing.setAttribute('aria-label', 'Tutor is typing'); log.appendChild(typing); log.scrollTop = log.scrollHeight;
    fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course: course, lesson: lesson, messages: msgs.slice(-10) }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        typing.remove();
        if (!x.ok) { add('bot', x.d.error || 'The tutor is not available right now.', 'err'); msgs.pop(); save(); }
        else showReply(x.d.reply, x.d.mode, x.d.why, x.d.suggest);
      }).catch(function () {
        typing.remove();
        if (window.FLTutor) { var t = FLTutor.reply(domCtx(), msgs.slice(-10)); showReply(t.reply, 'basic', 'offline', t.suggest); }
        else { add('bot', 'I can only answer while the FastLang server is running. Start it with "node server.js" and reload this page.', 'err'); msgs.pop(); save(); }
      })
      .then(function () { setBusy(false); });
  }
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(110, input.scrollHeight) + 'px'; }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });

  function toggle(open) {
    panel.hidden = !open; fab.setAttribute('aria-expanded', open ? 'true' : 'false'); fab.classList.toggle('hide', open);
    if (open) { if (!log.children.length) greet(); input.focus(); } else fab.focus();
  }
  function greet() {
    if (msgs.length) { msgs.forEach(function (m) { add(m.role === 'user' ? 'user' : 'bot', m.content); }); chips.style.display = 'none'; return; }
    add('bot', lesson ? 'Hi! I am your tutor for \u201C' + heading + '\u201D. Ask me anything about it, or try a quick action below.' : 'Hi! I can help you plan your study and explain anything in this course. What would you like to know?');
  }
  fab.addEventListener('click', function () { toggle(true); });
  close.addEventListener('click', function () { toggle(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
})();
