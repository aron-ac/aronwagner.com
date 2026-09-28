(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Edit these. Anything left blank stays a placeholder (the item just wiggles).
  // ---------------------------------------------------------------------------
  const LINKS = {
    board: '', // corkboard  -> "Stuff I've Built"
    laptop: 'surf-riders.html', // laptop     -> "Play Surf Riders"
    books: '', // books      -> "Things I Really Love"
    headphones: '', // headphones -> "Spotify"
    mug: 'https://bitmotive.com', // mug        -> "Bitmotive"
    notebook: 'https://github.com/mhammonds', // notebook   -> "GitHub"
    camera: '', // camera     -> "Instagram"
    octocat: '', // octocat    -> "GitHub"
    map: '', // map        -> "Travels"
    github: 'https://github.com/mhammonds', // phone-width link row
    instagram: '', // phone-width link row
    linkedin: 'https://www.linkedin.com/in/mhammonds/', // phone-width link row
  };
  const PHONE_LINKS = [
    ['github', 'GitHub'],
    ['instagram', 'Instagram'],
    ['linkedin', 'LinkedIn'],
  ];
  const DOG_NAME = 'My sidekick'; // hover label on the dog
  const THEME_KEY = 'mark-site-theme'; // Legacy desk preference; the main homepage uses a timed override.

  const SCENE_WIDTH = 918;
  const SCENE_HEIGHT = 509;

  const ARROW =
    '<svg viewBox="0 0 30 44" aria-hidden="true">' +
    '<path class="arrow-body" pathLength="100" d="M 6 40 C 20 30 22 18 12 5"/>' +
    '<path class="arrow-head" d="M 4 12 L 12 4 L 20 10"/></svg>';

  const body = document.body;
  const root = document.documentElement;
  const $ = function (id) {
    return document.getElementById(id);
  };
  const wrap = $('scene-wrap'),
    scene = $('scene');
  const me = $('me'),
    dog = $('dog'),
    fingers = $('fingers');

  // The head bootstrap has already applied the saved theme before first paint.
  if (location.hash === '#labels')
    setTimeout(function () {
      document.querySelectorAll('.label').forEach(function (l) {
        l.classList.add('show');
      });
    }, 2400);

  document.querySelectorAll('.label-arrow').forEach(function (el) {
    el.innerHTML = ARROW;
  });
  document.querySelectorAll('.label-dog-text').forEach(function (el) {
    el.textContent = DOG_NAME;
  });

  // Links -------------------------------------------------------------------
  const row = document.querySelector('#mobile .links');
  PHONE_LINKS.forEach(function (pair) {
    if (!LINKS[pair[0]]) return;
    const a = document.createElement('a');
    a.href = LINKS[pair[0]];
    a.textContent = pair[1];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    row.appendChild(a);
  });
  document.querySelectorAll('[data-link]').forEach(function (el) {
    const key = el.getAttribute('data-link');
    const url = LINKS[key];
    if (url) {
      el.setAttribute('href', url);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    } else {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        el.classList.remove('wiggle');
        void el.offsetWidth;
        el.classList.add('wiggle');
      });
    }
  });

  // Scale the 918px scene down on narrow screens -------------------------------
  function fit() {
    const cs = getComputedStyle(wrap.parentNode);
    const avail =
      wrap.parentNode.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const k = Math.min(1, avail / SCENE_WIDTH);
    scene.style.transform = 'scale(' + k + ')';
    wrap.style.width = Math.round(SCENE_WIDTH * k) + 'px';
    wrap.style.height = Math.round(SCENE_HEIGHT * k) + 'px';
  }
  fit();
  window.addEventListener('resize', fit);

  // Intro animation: everything pops up from behind the desk ---------------------
  function start(el, i, kind) {
    setTimeout(
      function () {
        el.classList.remove('up', 'done', 'rise', 'rise-slow', 'bounce');
        void el.offsetWidth;
        el.classList.add(kind);
        if (el === me && !root.classList.contains('nightmode')) fingers.classList.add('on');
      },
      300 + i * 150,
    );
  }
  document.addEventListener('animationend', function (e) {
    const el = e.target;
    if (!el.classList) return;
    if (el.classList.contains('rise') || el.classList.contains('rise-slow')) {
      el.classList.remove('rise', 'rise-slow');
      el.classList.add('up');
    } else if (el.classList.contains('bounce')) {
      el.classList.remove('bounce');
      el.classList.add('done');
    } else if (el.classList.contains('wiggle')) {
      el.classList.remove('wiggle');
    }
  });

  let started = false;
  function go() {
    if (started) return;
    started = true;
    body.classList.add('go');
    const sequence = [
      ['board', 'rise-slow'],
      ['window-bounce', 'rise-slow'],
      ['octocat', 'bounce'],
      ['laptop', 'bounce'],
      ['me', 'rise'],
      ['dog', 'rise'],
      ['notebook', 'bounce'],
      ['mug', 'bounce'],
      ['books', 'bounce'],
      ['headphones', 'bounce'],
      ['ball', 'bounce'],
      ['map', 'bounce'],
      ['camera', 'bounce'],
    ];
    sequence.forEach(function ([id, animation], index) {
      start($(id), index, animation);
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  window.addEventListener('load', go);
  setTimeout(go, 2500);

  // Hover labels ---------------------------------------------------------------
  document.querySelectorAll('[data-label]').forEach(function (el) {
    const label = document.querySelector('.label-' + el.getAttribute('data-label'));
    if (!label) return;
    function show() {
      label.classList.remove('show');
      void label.offsetWidth;
      label.classList.add('show');
    }
    function hide() {
      label.classList.remove('show');
    }
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', show);
    el.addEventListener('blur', hide);
  });

  // Night mode: Mark and the dog duck behind the desk, then come back up asleep -----
  let nightTimer;
  $('night').addEventListener('click', function (e) {
    e.preventDefault();
    const toNight = !root.classList.contains('nightmode');
    fingers.classList.remove('on');
    me.classList.remove('up', 'rise');
    dog.classList.remove('up', 'rise');
    try {
      localStorage.setItem(THEME_KEY, toNight ? 'night' : 'day');
    } catch {}
    clearTimeout(nightTimer);
    nightTimer = setTimeout(function () {
      root.classList.toggle('nightmode', toNight);
      start(me, 0, 'rise');
      start(dog, 1, 'rise');
    }, 400);
  });

  // The dog gets excited when you click it (or the tennis ball) ----------------
  let excitementTimer;
  function excite() {
    clearTimeout(excitementTimer);
    dog.classList.remove('excited');
    void dog.offsetWidth;
    dog.classList.add('excited');
    excitementTimer = setTimeout(function () {
      dog.classList.remove('excited');
    }, 1600);
  }
  dog.addEventListener('click', excite);
  $('ball').addEventListener('click', function () {
    const b = $('ball');
    b.classList.remove('wiggle');
    void b.offsetWidth;
    b.classList.add('wiggle');
    excite();
  });
  [dog, $('ball')].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });
})();
