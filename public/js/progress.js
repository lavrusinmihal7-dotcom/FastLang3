/* Course pages: animated progress bar, Duolingo-style lesson path, end-of-course chest, lesson completion. */
(function () {
  var root = document.getElementById('lesson_root') || document.getElementById('overview_root');
  if (!root) return;
  var course = root.getAttribute('data-course');
  var total = parseInt(root.getAttribute('data-total'), 10);
  var lesson = parseInt(root.getAttribute('data-lesson') || '0', 10);
  var NS = 'http://www.w3.org/2000/svg';
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  function cs() { return FL.state.courses[course] || { done: [], claimed: false }; }
  function doneList() { return cs().done; }
  function lockSVG() { return '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'; }
  function checkSVG() { return '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function chestSVG() {
    return '<svg class="chest_svg" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="cg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#ffd24a" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse class="chest_glow" cx="50" cy="44" rx="46" ry="36" fill="url(#cg)"/>' +
      '<g class="chest_body"><rect x="14" y="46" width="72" height="40" rx="6" fill="var(--c-body)"/><rect x="14" y="60" width="72" height="6" fill="var(--c-trim)"/><rect x="14" y="46" width="8" height="40" rx="3" fill="var(--c-trim)"/><rect x="78" y="46" width="8" height="40" rx="3" fill="var(--c-trim)"/><rect x="43" y="57" width="14" height="16" rx="3" fill="var(--c-trim)"/><circle cx="50" cy="65" r="2.4" fill="var(--c-body)"/></g>' +
      '<g class="chest_inside"><ellipse cx="50" cy="47" rx="34" ry="5" fill="#ffe27a"/><circle cx="38" cy="45" r="5" fill="#ffc83d"/><circle cx="50" cy="43" r="5" fill="#ffd95e"/><circle cx="61" cy="45" r="5" fill="#ffc83d"/></g>' +
      '<g class="chest_lid"><path d="M14 47Q14 22 50 22Q86 22 86 47Z" fill="var(--c-lid)"/><rect x="14" y="41" width="72" height="6" fill="var(--c-trim)"/><rect x="14" y="30" width="8" height="12" fill="var(--c-trim)"/><rect x="78" y="30" width="8" height="12" fill="var(--c-trim)"/></g></svg>';
  }

  /* ---------- shared: bar + status ---------- */
  var shownPct = 0;
  function renderBar() {
    var n = doneList().length, pct = Math.round(n / total * 100);
    $('lp_fill').style.width = pct + '%';
    $('lp_bar').setAttribute('aria-valuenow', pct);
    $('lp_status').textContent = lesson
      ? 'Lesson ' + lesson + ' of ' + total + ' - ' + n + ' of ' + total + ' lessons completed'
      : n + ' of ' + total + ' lessons completed';
    var out = $('lp_pct'), from = shownPct; shownPct = pct;   // count the % up or down
    if (FL.reduced() || from === pct) { out.textContent = pct + '%'; return; }
    var t0 = performance.now();
    (function step(t) { var k = Math.min(1, (t - t0) / 600); out.textContent = Math.round(from + (pct - from) * k) + '%'; if (k < 1) requestAnimationFrame(step); })(t0);
  }

  /* ================= LESSON PAGE ================= */
  function lessonPage() {
    var btn = $('complete_btn'), next = FL.core.nextLesson(doneList(), total);
    var locked = doneList().indexOf(lesson) === -1 && lesson > next;
    if (locked) {
      var warn = el('div', 'fl_locked', lockSVG() + '<span>This lesson is locked. <a href="' + course + '_' + next + '.html">Finish lesson ' + next + ' first</a> to keep your path in order.</span>');
      var card = document.querySelector('.lesson_card'); card.parentNode.insertBefore(warn, card);
      btn.disabled = true;
    }
    function render() { renderBar(); $('lesson_done').style.display = doneList().indexOf(lesson) !== -1 ? 'inline-block' : 'none'; }
    render();
    btn.addEventListener('click', function () {
      btn.disabled = true;
      FL.act({ type: 'complete', course: course, lesson: lesson }).then(function (r) {
        if (!r.ok) { FL.toast(r.error, 'bad'); btn.disabled = locked; return; }
        render();
        var res = r.result, delay = 900;
        if (res.xp) {
          var pop = el('div', 'fl_xp_pop', '+' + res.xp + ' XP'); btn.parentNode.style.position = 'relative'; btn.parentNode.appendChild(pop);
          btn.classList.add('fl_done_btn'); btn.innerHTML = checkSVG() + ' Done';
        }
        if (res.streak && res.streak.increased) { setTimeout(function () { FL.toast('\uD83D\uDD25 ' + res.streak.count + ' day streak!' + (res.streak.freezesUsed ? ' (Streak Freeze used)' : '')); }, 300); delay = 1400; }
        if (res.courseDone) { setTimeout(function () { FL.toast('Course complete! Your chest is waiting.'); }, 700); delay = 1900; }
        setTimeout(function () { window.location.href = root.getAttribute('data-next'); }, FL.reduced() ? 200 : delay);
      });
    });
    FL.on(render);
  }

  /* ================= OVERVIEW PAGE (the path) ================= */
  function overviewPage() {
    var items = [].slice.call(root.querySelectorAll('.ov_item')).map(function (a) {
      return { n: +a.getAttribute('data-lesson'), title: a.querySelector('.ov_title').textContent, href: a.getAttribute('href') };
    });
    var list = root.querySelector('.ov_list'); list.style.display = 'none';
    var wrap = el('div', 'fl_path'), svg = document.createElementNS(NS, 'svg');
    var base = document.createElementNS(NS, 'path'), prog = document.createElementNS(NS, 'path');
    base.setAttribute('class', 'fl_trail'); prog.setAttribute('class', 'fl_trail_done'); prog.setAttribute('pathLength', '100');
    svg.appendChild(base); svg.appendChild(prog); wrap.appendChild(svg);
    var nodes = items.map(function (it) {
      var a = el('a', 'fl_node'); a.href = it.href;
      a.innerHTML = '<span class="fl_bubble">START</span><span class="fl_disc"></span><span class="fl_lbl"></span>';
      a.querySelector('.fl_lbl').textContent = it.title;
      wrap.appendChild(a); return a;
    });
    var chest = el('button', 'fl_node fl_chest'); chest.type = 'button';
    chest.innerHTML = '<span class="fl_bubble">OPEN</span><span class="fl_disc">' + chestSVG() + '</span><span class="fl_lbl"></span>';
    wrap.appendChild(chest);
    list.parentNode.insertBefore(wrap, list);
    var reward = el('div', 'fl_reward'); reward.style.display = 'none';
    wrap.parentNode.insertBefore(reward, list);

    var ROW = 118, TOP = 70, pts = [];
    function layout() {
      var W = wrap.clientWidth, amp = Math.max(0, Math.min(95, (W - 190) / 2)), d = '';
      pts = [];
      for (var i = 0; i <= total; i++) pts.push({ x: W / 2 + (i === total ? 0 : Math.sin(i * 0.95) * amp), y: TOP + i * ROW });
      wrap.style.height = (TOP + total * ROW + 110) + 'px';
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (TOP + total * ROW + 110));
      pts.forEach(function (p, i) {
        d += i ? ' C' + p0(i).x + ',' + (p0(i).y + ROW / 2) + ' ' + p.x + ',' + (p.y - ROW / 2) + ' ' + p.x + ',' + p.y : 'M' + p.x + ',' + p.y;
        var n = i < total ? nodes[i] : chest; n.style.left = p.x + 'px'; n.style.top = (p.y - 38) + 'px';
      });
      base.setAttribute('d', d); prog.setAttribute('d', d);
    }
    function p0(i) { return pts[i - 1]; }

    var first = true;
    function render() {
      renderBar();
      var d = doneList(), cur = FL.core.nextLesson(d, total), all = d.length >= total, c = cs();
      nodes.forEach(function (a, i) {
        var n = items[i].n, state = d.indexOf(n) !== -1 ? 'done' : (n === cur ? 'current' : 'locked');
        var was = a.getAttribute('data-state'); if (was === state) return;
        a.setAttribute('data-state', state);
        a.className = 'fl_node ' + state + (state === 'done' && was && !first ? ' pop' : '');
        a.querySelector('.fl_disc').innerHTML = state === 'done' ? checkSVG() : state === 'locked' ? lockSVG() : '<b>' + n + '</b>';
        a.querySelector('.fl_bubble').textContent = d.length ? 'CONTINUE' : 'START';
        if (state === 'locked') { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.title = 'Finish lesson ' + cur + ' first'; }
        else { a.setAttribute('href', items[i].href); a.removeAttribute('aria-disabled'); a.removeAttribute('title'); }
      });
      var st = c.claimed ? 'opened' : all ? 'ready' : 'locked';
      chest.className = 'fl_node fl_chest ' + st + (chest.classList.contains('opening') ? ' opening' : '');
      if (c.claimed) chest.classList.add('open');
      chest.querySelector('.fl_lbl').textContent = c.claimed ? FL.catalog.courses[course].reward + ' coins collected' : all ? 'Tap to open!' : 'Reward chest';
      chest.setAttribute('aria-label', chest.querySelector('.fl_lbl').textContent);
      var skin = FL.state.eq.chest && FL.core.item(FL.catalog, FL.state.eq.chest);
      chest.setAttribute('data-skin', skin ? skin.skin : 'wood');
      var f = Math.min(1, d.length / total) * 100;
      prog.style.strokeDashoffset = 100 - f;
      $('finished_msg').style.display = all ? 'block' : 'none';
      if (c.claimed) showReward(true);
      showNext(all);
    }

    function showReward(already) {
      reward.style.display = 'block';
      reward.innerHTML = (already ? 'Chest opened. ' : '<b>+' + FL.catalog.courses[course].reward + ' coins!</b> ') + 'Spend your coins in the <a href="shop.html">shop</a>.';
    }
    var nextBox = el('div', 'fl_next'); nextBox.style.display = 'none'; wrap.parentNode.insertBefore(nextBox, list);
    function showNext(all) {
      var nx = FL.catalog.courses[course].next, nc = nx && FL.catalog.courses[nx];
      if (!all || !nc) { nextBox.style.display = 'none'; return; }
      nextBox.style.display = 'block';
      nextBox.innerHTML = 'Ready for more? <a href="' + nc.overview + '">Start ' + nc.name + ' &rarr;</a>';
    }

    function openChest() {
      var c = cs();
      if (c.claimed) { FL.toast('You already opened this chest.'); return; }
      if (c.done.length < total) { chest.classList.remove('shake'); void chest.offsetWidth; chest.classList.add('shake'); FL.toast('Finish all ' + total + ' lessons to unlock the chest.'); return; }
      if (chest.classList.contains('opening')) return;
      var before = FL.state.coins, amount = FL.catalog.courses[course].reward;
      chest.classList.add('opening');
      setTimeout(function () {
        FL.setShown(before);                                  // keep the top-bar number still until coins land
        FL.act({ type: 'claim', course: course }).then(function (r) {
          chest.classList.remove('opening');
          if (!r.ok) { FL.setShown(null); FL.toast(r.error, 'bad'); return; }
          chest.classList.add('open'); render(); FL.setShown(before);
          var n = 14, per = Math.floor(amount / n), got = before;
          FL.flyCoins(chest.querySelector('.fl_disc'), n, function (i) { got += i === n - 1 ? amount - per * (n - 1) : per; FL.setShown(got); var ico = FL.coinTarget(); if (ico) { ico.classList.remove('bump'); void ico.getBoundingClientRect(); ico.classList.add('bump'); } })
            .then(function () { FL.setShown(null); showReward(false); });
        });
      }, FL.reduced() ? 0 : 650);
    }
    chest.addEventListener('click', openChest);
    nodes.forEach(function (a) { a.addEventListener('click', function (e) { if (a.getAttribute('aria-disabled')) { e.preventDefault(); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); FL.toast(a.title); } }); });

    layout(); prog.style.strokeDashoffset = 100;
    requestAnimationFrame(function () { requestAnimationFrame(function () { render(); first = false; }); });
    window.addEventListener('resize', layout);
    FL.on(function () { if (!first) render(); });

    var rb = $('reset_btn');
    rb.addEventListener('click', function () {
      if (window.confirm('Reset your lesson progress in this course? Coins you already collected stay yours, and the chest cannot be opened twice.')) FL.act({ type: 'reset', course: course });
    });
    var cb = $('continue_btn'); // keep the original button, but make it follow the saved state
    function updateContinue() { var n = FL.core.nextLesson(doneList(), total); if (n > total) { cb.textContent = 'Review lesson 1 \u2192'; cb.href = course + '_1.html'; } else { cb.href = course + '_' + n + '.html'; cb.textContent = (doneList().length ? 'Continue with lesson ' + n : 'Start course') + ' \u2192'; } }
    updateContinue(); FL.on(updateContinue);
    if (/finished=1/.test(location.search)) setTimeout(function () { chest.scrollIntoView({ behavior: FL.reduced() ? 'auto' : 'smooth', block: 'center' }); }, 500);
  }

  FL.ready.then(function () {
    if (lesson) lessonPage(); else overviewPage();
  });
})();
