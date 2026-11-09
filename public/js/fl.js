/* FastLang client: loads the player's state (server account or guest), shows the top-bar coins/streak,
 * applies the equipped theme, and gives the other scripts window.FL. */
(function () {
  var GUEST_KEY = 'fl_state:guest';
  var FL = window.FL = { core: window.FLCore, catalog: null, state: null, server: false, shown: null };
  var listeners = [];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  FL.today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  FL.on = function (fn) { listeners.push(fn); };
  function emit() { applyTheme(); renderHud(); listeners.forEach(function (fn) { try { fn(FL.state); } catch (e) {} }); }
  FL.reduced = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  /* ---------- storage ---------- */
  function loadGuest() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(GUEST_KEY)); } catch (e) {}
    if (s && s.courses) return s;
    s = FL.core.newState();
    Object.keys(FL.catalog.courses).forEach(function (id) { // bring over progress saved by the older version
      var old = legacy('guest', id); if (old.length) { s.courses[id] = { done: old, claimed: false }; s.xp += old.length * 10; }
    });
    return s;
  }
  function legacy(who, id) {
    try { var v = JSON.parse(localStorage.getItem('fl_progress:' + who + ':' + id)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function saveGuest() { try { localStorage.setItem(GUEST_KEY, JSON.stringify(FL.state)); } catch (e) {} }

  /* ---------- actions: same rules either way, FLCore decides ---------- */
  FL.act = function (action) {
    if (FL.server) {
      return fetch('/api/action', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, action, { day: FL.today() })) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) return { ok: false, error: x.d.error || 'Something went wrong.' };
          FL.state = x.d.state; emit(); return { ok: true, result: x.d.result };
        }).catch(function () { return { ok: false, error: 'Could not reach the server.' }; });
    }
    var r = FL.core.apply(FL.state, FL.catalog, Object.assign({}, action, { day: FL.today() }));
    if (!r.ok) return Promise.resolve({ ok: false, error: r.error });
    FL.state = r.state; saveGuest(); emit();
    return Promise.resolve({ ok: true, result: r.result });
  };

  /* ---------- little helpers ---------- */
  FL.coinSVG = function (px) {
    return '<svg class="fl_coin_ico" width="' + px + '" height="' + px + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#e8a317"/><circle cx="12" cy="12" r="9" fill="#ffc83d"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#e8a317" stroke-width="1.6"/><path d="M12 8.2v7.6M9.9 10.2h3.1a1.2 1.2 0 010 2.4h-2a1.2 1.2 0 000 2.4h3.1" fill="none" stroke="#e8a317" stroke-width="1.3" stroke-linecap="round"/></svg>';
  };
  FL.flameSVG = function (px) {
    return '<svg class="fl_flame_ico" width="' + px + '" height="' + px + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.4 5.5 5.6 5.5 11a5.5 5.5 0 01-11 0c0-2 .9-3.4 2-4.5.2 1.4.9 2.3 1.8 2.6C10 8.3 10.6 4.6 12 2z" fill="currentColor"/><path d="M12 11.5c.6 1.4 2.3 2.1 2.3 3.9a2.3 2.3 0 01-4.6 0c0-1 .6-1.6 1-2.2.4.5.8.7 1.3.6z" fill="#fff" opacity=".85"/></svg>';
  };
  FL.toast = function (msg, kind) {
    var t = document.createElement('div');
    t.className = 'fl_toast' + (kind ? ' ' + kind : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 350); }, 2800);
  };
  FL.setShown = function (n) { FL.shown = n; renderHud(); };   // lets the chest animation count coins up as they land
  FL.coinTarget = function () {
    var all = document.querySelectorAll('.fl_hud .fl_coin_ico');
    for (var i = 0; i < all.length; i++) if (all[i].getBoundingClientRect().width) return all[i];
    return null;
  };
  /* coins burst out of an element and fly to the top-bar coin; onLand(i) fires for each coin */
  FL.flyCoins = function (fromEl, count, onLand) {
    var tgt = FL.coinTarget(), a = fromEl.getBoundingClientRect(), pending = count;
    return new Promise(function (done) {
      function landed(i) { onLand && onLand(i); if (--pending === 0) done(); }
      if (FL.reduced() || !tgt || !tgt.animate) { for (var k = 0; k < count; k++) landed(k); return; }
      var b = tgt.getBoundingClientRect(), sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2;
      for (var i = 0; i < count; i++) (function (i) {
        var c = document.createElement('div'); c.className = 'fl_fly'; c.innerHTML = FL.coinSVG(26);
        document.body.appendChild(c);
        var ang = Math.random() * Math.PI * 2, r = 50 + Math.random() * 70;
        var mx = sx + Math.cos(ang) * r, my = sy - 40 + Math.sin(ang) * r * .6;
        var anim = c.animate([
          { transform: 'translate(' + (sx - 13) + 'px,' + (sy - 13) + 'px) scale(.4)', opacity: 0 },
          { transform: 'translate(' + (mx - 13) + 'px,' + (my - 13) + 'px) scale(1.1)', opacity: 1, offset: .35 },
          { transform: 'translate(' + (ex - 13) + 'px,' + (ey - 13) + 'px) scale(.6)', opacity: 1 }
        ], { duration: 1000 + Math.random() * 300, delay: 120 + i * 70, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' });
        anim.onfinish = function () { c.remove(); landed(i); };
      })(i);
    });
  };

  /* ---------- theme + top bar ---------- */
  function applyTheme() {
    var t = FL.state && FL.state.eq.theme;
    if (t) document.documentElement.setAttribute('data-fl-theme', t.replace('theme_', '')); else document.documentElement.removeAttribute('data-fl-theme');
  }
  var hudHTML = '<a class="fl_hud" href="shop.html" title="Open the shop"><span class="fl_badge"></span>' +
    '<span class="fl_pill fl_streak" title="Day streak">' + '</span><span class="fl_pill fl_coins" title="Your coins"></span></a>';
  function mountHud() {
    var spots = [document.querySelector('.top_bar_right'), document.querySelector('.menu_extra')];
    spots.forEach(function (el, i) {
      if (!el || el.querySelector('.fl_hud')) return;
      var w = document.createElement('div'); w.innerHTML = hudHTML;
      var hud = w.firstChild; if (i === 1) hud.classList.add('fl_hud_menu');
      el.insertBefore(hud, el.firstChild);
    });
    Array.prototype.forEach.call(document.querySelectorAll('a[href="contact.html"]'), function (a) { // "Shop" in both menus
      var li = a.parentNode; if (!li || li.tagName !== 'LI') return;
      var n = document.createElement('li'); n.className = li.className;
      var l = document.createElement('a'); l.href = 'shop.html'; l.textContent = 'Shop';
      if (/shop\.html/.test(location.pathname)) n.classList.add('active');
      n.appendChild(l); li.parentNode.insertBefore(n, li);
    });
  }
  function renderHud() {
    var s = FL.state; if (!s) return;
    var coins = FL.shown !== null ? FL.shown : s.coins, live = FL.core.liveStreak(s, FL.today()), today = s.streak.last === FL.today();
    var eq = s.eq.badge && FL.core.item(FL.catalog, s.eq.badge);
    Array.prototype.forEach.call(document.querySelectorAll('.fl_hud'), function (h) {
      h.querySelector('.fl_badge').textContent = eq ? eq.icon : '';
      var st = h.querySelector('.fl_streak');
      st.className = 'fl_pill fl_streak' + (today ? ' lit' : (live ? ' warm' : ''));
      st.innerHTML = FL.flameSVG(18) + '<b>' + live + '</b>';
      h.querySelector('.fl_coins').innerHTML = FL.coinSVG(18) + '<b>' + coins + '</b>';
    });
  }

  /* ---------- start ---------- */
  FL.ready = fetch('data/catalog.json').then(function (r) { return r.json(); }).then(function (cat) {
    FL.catalog = cat;
    return fetch('/api/state', { credentials: 'same-origin' }).then(function (r) {
      if (r.ok) return r.json().then(function (d) { FL.server = true; FL.state = d.state; return importLegacy(); });
      FL.state = loadGuest();                         // not logged in, or no back end (static hosting)
    }).catch(function () { FL.state = loadGuest(); });
  }).then(function () {
    mountHud(); emit();
  });

  function importLegacy() {  // progress saved in this browser by the older version moves into the account once
    var any = FL.state.xp > 0; Object.keys(FL.state.courses).forEach(function (k) { if (FL.state.courses[k].done.length) any = true; });
    if (any) return;
    return fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.user) return;
      var courses = {}, found = false;
      Object.keys(FL.catalog.courses).forEach(function (id) { var old = legacy(d.user.email, id); if (old.length) { courses[id] = old; found = true; } });
      if (found) return FL.act({ type: 'import', courses: courses });
    }).catch(function () {});
  }
})();
