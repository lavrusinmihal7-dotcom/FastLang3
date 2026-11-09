/* Shop page: spend chest coins on power-ups, themes, chest skins and badges. */
(function () {
  var grid = document.getElementById('shop_grid'); if (!grid) return;
  var tabs = document.getElementById('shop_tabs'), bal = document.getElementById('shop_balance'), guest = document.getElementById('shop_guest');
  var filter = 'all', LABEL = { all: 'All', power: 'Power-ups', theme: 'Themes', chest: 'Chests', badge: 'Badges' };
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h) e.innerHTML = h; return e; }

  function art(it) {
    if (it.type === 'power') return '<span class="shop_emoji">' + it.icon + '</span>';
    if (it.type === 'badge') return '<span class="shop_emoji">' + it.icon + '</span>';
    if (it.type === 'theme') return '<span class="shop_swatch" style="background:linear-gradient(135deg,' + it.swatch[0] + ',' + it.swatch[1] + ')"></span>';
    return '<span class="shop_chest" data-skin="' + it.skin + '"><svg viewBox="0 0 100 70" aria-hidden="true"><path d="M14 30Q14 6 50 6Q86 6 86 30Z" fill="var(--c-lid)"/><rect x="14" y="24" width="72" height="6" fill="var(--c-trim)"/><rect x="14" y="30" width="72" height="34" rx="6" fill="var(--c-body)"/><rect x="14" y="42" width="72" height="6" fill="var(--c-trim)"/><rect x="43" y="38" width="14" height="16" rx="3" fill="var(--c-trim)"/></svg></span>';
  }
  function render() {
    var s = FL.state; bal.innerHTML = FL.coinSVG(34) + '<b>' + s.coins + '</b>';
    if (guest) guest.style.display = FL.server ? 'none' : 'block';
    tabs.innerHTML = '';
    Object.keys(LABEL).forEach(function (k) {
      var b = el('button', 'shop_tab' + (k === filter ? ' on' : ''), LABEL[k]); b.type = 'button'; b.setAttribute('aria-pressed', k === filter);
      b.addEventListener('click', function () { filter = k; render(); }); tabs.appendChild(b);
    });
    grid.innerHTML = '';
    FL.catalog.shop.filter(function (it) { return filter === 'all' || it.type === filter; }).forEach(function (it) {
      var owned = it.type === 'power' ? s.freezes : (s.inv.indexOf(it.id) !== -1 ? 1 : 0), on = s.eq[it.type] === it.id;
      var card = el('div', 'shop_card' + (on ? ' equipped' : ''));
      card.appendChild(el('div', 'shop_art', art(it)));
      card.appendChild(el('h3', '', it.name)); card.appendChild(el('p', '', it.desc));
      var foot = el('div', 'shop_foot'), btn = el('button', 'shop_btn'); btn.type = 'button';
      if (it.type === 'power') {
        foot.appendChild(el('span', 'shop_owned', 'You have ' + owned + ' / ' + it.max));
        if (owned >= it.max) { btn.textContent = 'Full'; btn.disabled = true; } else buy(btn, it, s);
      } else if (owned) {
        btn.className = 'shop_btn ' + (on ? 'alt' : ''); btn.textContent = on ? 'Equipped (tap to remove)' : 'Equip';
        btn.addEventListener('click', function () { FL.act({ type: 'equip', slot: it.type, item: on ? null : it.id }).then(function (r) { if (!r.ok) FL.toast(r.error, 'bad'); }); });
      } else buy(btn, it, s);
      if (it.type !== 'power' || owned < it.max) foot.insertBefore(el('span', 'shop_price', FL.coinSVG(18) + '<b>' + it.price + '</b>'), foot.firstChild);
      foot.appendChild(btn); card.appendChild(foot); grid.appendChild(card);
    });
  }
  function buy(btn, it, s) {
    var need = it.price - s.coins; btn.textContent = need > 0 ? 'Need ' + need + ' more' : 'Buy'; btn.disabled = need > 0;
    btn.addEventListener('click', function () {
      btn.disabled = true;
      FL.act({ type: 'buy', item: it.id }).then(function (r) {
        if (!r.ok) { FL.toast(r.error, 'bad'); return; }
        FL.toast(it.name + ' is yours!');
        var b = grid.querySelector('.shop_card.just'); if (b) b.classList.remove('just');
      });
    });
  }
  FL.ready.then(function () {
    render();
    var prev = FL.state.coins;
    FL.on(function (s) { // animate the balance when it changes
      if (!FL.reduced() && s.coins !== prev) { bal.classList.remove('flash'); void bal.offsetWidth; bal.classList.add('flash'); }
      prev = s.coins; render();
    });
  });
})();
