/* FastLang game rules: XP, streaks, chests, coins and shop.
 * One file used by BOTH the browser (guest mode) and server.js (logged-in users),
 * so the rules can never get out of sync. No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FLCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var SLOTS = ['theme', 'chest', 'badge'];

  function newState() {
    return { v: 1, coins: 0, xp: 0, streak: { count: 0, last: null }, freezes: 0, courses: {}, inv: [], eq: { theme: null, chest: null, badge: null } };
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dayNum(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null;
  }
  function courseState(s, id) { return s.courses[id] || (s.courses[id] = { done: [], claimed: false }); }
  function nextLesson(done, total) { var n = 1; while (n <= total && done.indexOf(n) !== -1) n++; return n; }
  function item(cat, id) { for (var i = 0; i < cat.shop.length; i++) if (cat.shop[i].id === id) return cat.shop[i]; return null; }

  /* streak the learner should SEE today (a missed day with no freeze left shows 0) */
  function liveStreak(s, day) {
    var t = dayNum(day), l = dayNum(s.streak.last);
    if (t === null || l === null || !s.streak.count) return s.streak.count && l === null ? s.streak.count : 0;
    var missed = t - l - 1;
    return missed <= 0 || missed <= s.freezes ? s.streak.count : 0;
  }

  function bumpStreak(s, day) {
    var t = dayNum(day), l = dayNum(s.streak.last), out = { increased: false, freezesUsed: 0, count: s.streak.count };
    if (t === null) return out;
    if (l === t) return out;
    var missed = l === null ? 0 : t - l - 1;
    if (l !== null && missed > 0) {
      if (missed <= s.freezes) { s.freezes -= missed; out.freezesUsed = missed; s.streak.count += 1; }
      else s.streak.count = 1;
    } else s.streak.count += 1;
    s.streak.last = day; out.increased = true; out.count = s.streak.count;
    return out;
  }

  /* apply(state, catalog, action) -> { ok, state, result } or { ok:false, error } */
  function apply(state, cat, a) {
    var s = clone(state || newState()), c, cs, it, res = {};
    if (!a || typeof a !== 'object') return { ok: false, error: 'Bad request.' };
    var t = a.type;

    if (t === 'complete') {
      c = cat.courses[a.course]; var n = a.lesson;
      if (!c || !(n >= 1 && n <= c.total) || n !== Math.floor(n)) return { ok: false, error: 'Unknown lesson.' };
      cs = courseState(s, a.course);
      if (cs.done.indexOf(n) !== -1) return { ok: true, state: s, result: { already: true, xp: 0, streak: { increased: false, count: s.streak.count } } };
      var next = nextLesson(cs.done, c.total);
      if (n > next) return { ok: false, error: 'Finish lesson ' + next + ' first.' };
      cs.done.push(n); cs.done.sort(function (x, y) { return x - y; });
      var gain = cat.xpPerLesson || 10;
      res.courseDone = cs.done.length === c.total;
      if (res.courseDone) gain += cat.xpCourseBonus || 40;
      s.xp += gain; res.xp = gain; res.streak = bumpStreak(s, a.day);
      return { ok: true, state: s, result: res };
    }

    if (t === 'claim') {
      c = cat.courses[a.course]; if (!c) return { ok: false, error: 'Unknown course.' };
      cs = courseState(s, a.course);
      if (cs.claimed) return { ok: false, error: 'You already opened this chest.' };
      if (cs.done.length < c.total) return { ok: false, error: 'Finish every lesson to unlock the chest.' };
      cs.claimed = true; s.coins += c.reward;
      return { ok: true, state: s, result: { coins: c.reward } };
    }

    if (t === 'buy') {
      it = item(cat, a.item); if (!it) return { ok: false, error: 'Unknown item.' };
      if (it.type === 'power') {
        if (s.freezes >= (it.max || 1)) return { ok: false, error: 'You already hold the maximum (' + (it.max || 1) + ').' };
      } else if (s.inv.indexOf(it.id) !== -1) return { ok: false, error: 'You already own this.' };
      if (s.coins < it.price) return { ok: false, error: 'Not enough coins.' };
      s.coins -= it.price;
      if (it.type === 'power') s.freezes += 1; else s.inv.push(it.id);
      return { ok: true, state: s, result: { item: it.id } };
    }

    if (t === 'equip') {
      if (SLOTS.indexOf(a.slot) === -1) return { ok: false, error: 'Bad slot.' };
      if (a.item === null) { s.eq[a.slot] = null; return { ok: true, state: s, result: {} }; }
      it = item(cat, a.item);
      if (!it || it.type !== a.slot || s.inv.indexOf(it.id) === -1) return { ok: false, error: 'You do not own this item.' };
      s.eq[a.slot] = it.id;
      return { ok: true, state: s, result: {} };
    }

    if (t === 'reset') {
      if (!cat.courses[a.course]) return { ok: false, error: 'Unknown course.' };
      courseState(s, a.course).done = []; // the chest stays claimed, so coins cannot be farmed
      return { ok: true, state: s, result: {} };
    }

    if (t === 'import') { // one-time move of old browser-only progress into a fresh account
      var any = s.xp > 0; Object.keys(s.courses).forEach(function (k) { if (s.courses[k].done.length) any = true; });
      if (any || !a.courses || typeof a.courses !== 'object') return { ok: true, state: s, result: {} };
      Object.keys(a.courses).forEach(function (id) {
        c = cat.courses[id]; if (!c || !Array.isArray(a.courses[id])) return;
        var set = a.courses[id], k = 0; while (k < c.total && set.indexOf(k + 1) !== -1) k++;
        if (!k) return;
        cs = courseState(s, id); for (var i = 1; i <= k; i++) cs.done.push(i);
        s.xp += k * (cat.xpPerLesson || 10);
      });
      return { ok: true, state: s, result: {} };
    }
    return { ok: false, error: 'Unknown action.' };
  }

  return { newState: newState, apply: apply, liveStreak: liveStreak, nextLesson: nextLesson, dayNum: dayNum, item: item };
});
