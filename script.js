(() => {
  'use strict';

  const photos = [
    {
      src: 'assets/polaroids/aron-and-jack.jpg',
      alt: 'Aron holding Jack on his lap on a backyard deck.',
    },
    {
      src: 'assets/polaroids/bmw-6-series.jpg',
      alt: 'A classic black BMW 6 Series coupe parked in the sun.',
    },
    {
      src: 'assets/polaroids/jack-face-to-face.jpg',
      alt: 'Baby Jack face to face with Aron on the couch.',
    },
    {
      src: 'assets/polaroids/beach-selfie.jpg',
      alt: 'Aron and Rebecca taking a selfie on a sunny beach.',
    },
    {
      src: 'assets/polaroids/army-unit.jpg',
      alt: 'An Army unit gathered for a group photo in the desert beneath an American flag.',
    },
    {
      src: 'assets/polaroids/mountain-overlook.jpg',
      alt: 'Aron and Rebecca bundled up at a snowy mountain overlook.',
    },
    {
      src: 'assets/polaroids/jack-headphones.jpg',
      alt: 'Jack wearing oversized white headphones.',
    },
  ];

  function initThemeControls() {
    const toggle = document.querySelector('.theme-toggle');
    const root = document.documentElement;
    // The inline head controller is the only source of theme decisions. Keeping
    // that bootstrap inline prevents a network request from delaying first paint.
    const theme = window.siteTheme;
    if (!toggle || !theme) return;

    function syncControl(night) {
      toggle.setAttribute('aria-pressed', String(night));
      toggle.setAttribute('title', night ? 'Switch to day mode' : 'Switch to night mode');
    }

    function refresh(syncStorage = false) {
      syncControl(theme.refresh(syncStorage));
    }

    let readyFrame;
    function enableTransitions() {
      cancelAnimationFrame(readyFrame);
      readyFrame = requestAnimationFrame(() => {
        readyFrame = requestAnimationFrame(() => root.classList.add('theme-ready'));
      });
    }

    let checkTimer;
    function scheduleCheck() {
      clearTimeout(checkTimer);
      if (document.hidden) return;
      // Align checks to the minute, with only one active timer per page.
      checkTimer = setTimeout(
        () => {
          refresh();
          scheduleCheck();
        },
        60_000 - (Date.now() % 60_000),
      );
    }

    refresh();
    toggle.hidden = false;
    toggle.addEventListener('click', () => syncControl(theme.toggle()));
    enableTransitions();
    scheduleCheck();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh(true);
      scheduleCheck();
    });
    window.addEventListener('focus', () => refresh(true));
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key === theme.key) refresh(true);
    });
    window.addEventListener('pagehide', () => {
      clearTimeout(checkTimer);
      cancelAnimationFrame(readyFrame);
    });
    window.addEventListener('pageshow', () => {
      root.classList.remove('theme-ready');
      refresh(true);
      enableTransitions();
      scheduleCheck();
    });
  }

  // Native dialogs supply Escape handling, focus trapping, and focus restoration.
  // Dialogs share only their close-button and outside-content dismissal.
  function initDialogDismissal(dialog) {
    dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        dialog.close();
    });
  }

  function initBusinessCard() {
    const dialog = document.querySelector('#business-card-dialog');
    if (!dialog) return;
    initDialogDismissal(dialog);
    document.querySelectorAll('[data-business-card]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        if (!dialog.open) dialog.showModal();
      });
    });
  }

  function initExternalLinks() {
    const dialog = document.querySelector('#external-link-dialog');
    if (!dialog) return;
    const title = dialog.querySelector('#external-link-title');
    const destination = dialog.querySelector('.external-link-url');
    const continueLink = dialog.querySelector('.external-link-continue');
    initDialogDismissal(dialog);

    document.querySelectorAll('.scene a[data-confirm-external]').forEach((link) => {
      function confirmNavigation(event) {
        if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
        const url = new URL(link.href);
        if (!['http:', 'https:'].includes(url.protocol) || url.origin === location.origin) return;
        event.preventDefault();
        const name = link.dataset.destination || url.hostname;
        title.textContent = `Open ${name}?`;
        destination.textContent = url.href;
        continueLink.href = url.href;
        continueLink.textContent = `Open ${name} ↗`;
        continueLink.setAttribute('aria-label', `Open ${name} in a new tab`);
        // Explicit focus also restores the right hotspot on touch browsers.
        link.focus({ preventScroll: true });
        if (!dialog.open) dialog.showModal();
      }
      link.addEventListener('click', confirmNavigation);
      link.addEventListener('auxclick', confirmNavigation);
    });

    // Keep the real link's synchronous default navigation, so the new tab is
    // opened by the visitor's click rather than an asynchronous popup request.
    continueLink.addEventListener('click', () => dialog.close());
    continueLink.addEventListener('auxclick', (event) => {
      if (event.button === 1) dialog.close();
    });
  }

  function createShuffledDeck(items) {
    let bag = [];
    let lastItem = null;
    return function drawItem() {
      if (!bag.length) {
        bag = [...items];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        // Avoid an immediate repeat where two shuffled batches meet.
        if (bag.length > 1 && bag[bag.length - 1] === lastItem) {
          [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        }
      }
      lastItem = bag.pop();
      return lastItem;
    };
  }

  // Cards with fixed content: the Bible verse, service note, golf invitation and wedding photo.
  function initCards() {
    for (const [trigger, id] of [
      ['.bible-toggle', 'verse-dialog'],
      ['.uniform-toggle', 'service-dialog'],
      ['.golf-toggle', 'golf-dialog'],
      ['.rebecca', 'wedding-dialog'],
    ]) {
      const button = document.querySelector(trigger);
      const dialog = document.getElementById(id);
      if (!button || !dialog) continue;
      initDialogDismissal(dialog);
      button.disabled = false;
      button.addEventListener('click', () => {
        if (!dialog.open) dialog.showModal();
        const passage = dialog.querySelector('.quote-passage');
        if (passage) passage.scrollTop = 0;
      });
    }
  }

  function initPolaroids() {
    const dialog = document.querySelector('#polaroid-dialog');
    const camera = document.querySelector('.camera-toggle');
    if (!dialog || !camera) return;
    const photo = dialog.querySelector('.polaroid-photo');
    const status = dialog.querySelector('#polaroid-status');
    const count = dialog.querySelector('.polaroid-count');
    const next = dialog.querySelector('.polaroid-next');
    const drawPhoto = createShuffledDeck(photos);
    let photoRequest = 0;

    // Invalidating the generation makes a late decode harmless after closing or
    // reopening. Aborting a download alone would not cover an in-flight decode.
    function invalidateRequest() {
      photoRequest++;
      next.disabled = false;
    }

    async function showNextPhoto() {
      if (next.disabled) return;
      const entry = drawPhoto();
      const request = ++photoRequest;
      const restoreNextFocus = document.activeElement === next;
      next.disabled = true;
      status.textContent = 'Developing…';
      try {
        // Load on demand and retain the previous print until its replacement is ready.
        const loaded = new Image();
        loaded.src = entry.src;
        await loaded.decode();
        if (request !== photoRequest) return;
        photo.src = loaded.src;
        photo.alt = entry.alt;
        photo.width = loaded.naturalWidth;
        photo.height = loaded.naturalHeight;
        photo.hidden = false;
        count.textContent = `${String(photos.indexOf(entry) + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
        status.textContent = '';
      } catch {
        if (request === photoRequest) status.textContent = 'This photo couldn’t load. Try another.';
      } finally {
        if (request === photoRequest) {
          next.disabled = false;
          if (restoreNextFocus && dialog.open && document.activeElement === document.body) {
            next.focus({ preventScroll: true });
          }
        }
      }
    }

    initDialogDismissal(dialog);
    camera.disabled = false;
    camera.addEventListener('click', () => {
      if (!dialog.open) {
        // Reopening can precede the previous dialog's queued close event.
        invalidateRequest();
        dialog.showModal();
      }
      showNextPhoto();
    });
    next.addEventListener('click', showNextPhoto);
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      invalidateRequest();
      status.textContent = '';
    });
  }

  function initDog() {
    const scene = document.querySelector('.scene');
    const dog = document.querySelector('.dog');
    if (!scene || !dog) return;
    const toys = document.querySelector('.toys-toggle');
    const status = document.querySelector('#dog-status');
    const timers = new Set();
    let petCount = 0;
    let tripCount = 0;

    function later(callback, delay) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
    }
    // Restart a CSS animation when a visitor repeats the interaction.
    function replay(element, className, duration) {
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
      later(() => element.classList.remove(className), duration);
    }

    dog.disabled = false;
    dog.addEventListener('click', () => {
      replay(dog, 'is-petted', 1300);
      petCount += 1;
      status.textContent =
        petCount % 2
          ? 'Maggie leans in for more scratches. Tail wags!'
          : 'More pets? Maggie says you can stay.';
    });

    if (toys) {
      const fetches = [
        'Maggie fetched a squeaky pink bone. Squeak!',
        'Nice throw! Maggie is already back for another.',
        'Maggie would play fetch all day if you let her.',
      ];
      toys.disabled = false;
      toys.addEventListener('click', () => {
        replay(scene, 'toy-thrown', 900);
        later(() => replay(dog, 'is-squeaking', 1300), 650);
        status.textContent = fetches[tripCount % fetches.length];
        tripCount += 1;
      });
    }

    window.addEventListener('pagehide', () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      dog.classList.remove('is-petted', 'is-squeaking');
      scene.classList.remove('toy-thrown');
    });
  }

  // Keep feature state private and let independent interactions initialize even
  // if a later markup edit breaks one feature. Report failures rather than hiding them.
  for (const initialize of [
    initThemeControls,
    initBusinessCard,
    initExternalLinks,
    initCards,
    initPolaroids,
    initDog,
  ]) {
    try {
      initialize();
    } catch (error) {
      console.error(`Homepage ${initialize.name} failed to initialize.`, error);
    }
  }
})();
