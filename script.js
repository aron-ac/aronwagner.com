(() => {
  'use strict';

  const photos = [
    {
      src: 'assets/polaroids/img_4932.jpg',
      alt: 'A man and child seated together under red and blue lights.',
    },
    {
      src: 'assets/polaroids/img_5504.jpg',
      alt: 'Two men standing before colorful painted doors under purple lighting.',
    },
    {
      src: 'assets/polaroids/img_5410.jpg',
      alt: 'A man holding a woman beside brightly lit slot machines.',
    },
    {
      src: 'assets/polaroids/img_5148.jpg',
      alt: 'A man wearing sunglasses taking a selfie beside ocean waves at sunset.',
    },
    {
      src: 'assets/polaroids/img_5366.jpg',
      alt: 'A bearded man in a black shirt under purple lighting.',
    },
    { src: 'assets/polaroids/img_8892.jpg', alt: 'A surfer in red shorts riding a small wave.' },
  ];

  // Public-domain George Long translation; exact excerpts from the numbered source.
  const meditationsQuotes = [
    {
      text: 'Let no act be done without a purpose, nor otherwise than according to the perfect principles of art.',
      book: 'IV',
      section: 2,
    },
    { text: 'While thou livest, while it is in thy power, be good.', book: 'IV', section: 17 },
    {
      text: 'Everything which is in any way beautiful is beautiful in itself, and terminates in itself, not having praise as part of itself.',
      book: 'IV',
      section: 20,
    },
    {
      text: 'Be like the promontory against which the waves continually break, but it stands firm and tames the fury of the water around it.',
      book: 'IV',
      section: 49,
    },
    {
      text: 'Look within. Let neither the peculiar quality of anything nor its value escape thee.',
      book: 'VI',
      section: 3,
    },
    {
      text: 'If any man is able to convince me and show me that I do not think or act right, I will gladly change; for I seek the truth, by which no man was ever injured.',
      book: 'VI',
      section: 21,
    },
    {
      text: 'Let not future things disturb thee, for thou wilt come to them, if it shall be necessary, having with thee the same reason which now thou usest for present things.',
      book: 'VII',
      section: 8,
    },
    {
      text: 'Retire into thyself. The rational principle which rules has this nature, that it is content with itself when it does what is just, and so secures tranquillity.',
      book: 'VII',
      section: 28,
    },
    {
      text: 'Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig.',
      book: 'VII',
      section: 59,
    },
    {
      text: 'If a man is mistaken, instruct him kindly and show him his error.',
      book: 'X',
      section: 4,
    },
    {
      text: 'No longer talk at all about the kind of man that a good man ought to be, but be such.',
      book: 'X',
      section: 16,
    },
    {
      text: 'If it is not right, do not do it: if it is not true, do not say it.',
      book: 'XII',
      section: 17,
    },
  ];

  // Public-domain Lionel Giles translation (1910), with numbered passages.
  const artOfWarQuotes = [
    {
      text: 'The Commander stands for the virtues of wisdom, sincerity, benevolence, courage and strictness.',
      chapter: 'I. Laying Plans',
      section: '9',
      anchor: '01',
    },
    {
      text: 'According as circumstances are favourable, one should modify one’s plans.',
      chapter: 'I. Laying Plans',
      section: '17',
      anchor: '01',
    },
    {
      text: 'There is no instance of a country having benefited from prolonged warfare.',
      chapter: 'II. Waging War',
      section: '6',
      anchor: '02',
    },
    {
      text: 'Hence to fight and conquer in all your battles is not supreme excellence; supreme excellence consists in breaking the enemy’s resistance without fighting.',
      chapter: 'III. Attack by Stratagem',
      section: '2',
      anchor: '03',
    },
    {
      text: 'He will win who knows when to fight and when not to fight.',
      chapter: 'III. Attack by Stratagem',
      section: '17(1)',
      anchor: '03',
    },
    {
      text: 'Hence the saying: One may know how to conquer without being able to do it.',
      chapter: 'IV. Tactical Dispositions',
      section: '4',
      anchor: '04',
    },
    {
      text: 'What the ancients called a clever fighter is one who not only wins, but excels in winning with ease.',
      chapter: 'IV. Tactical Dispositions',
      section: '11',
      anchor: '04',
    },
    {
      text: 'There are not more than five musical notes, yet the combinations of these five give rise to more melodies than can ever be heard.',
      chapter: 'V. Energy',
      section: '7',
      anchor: '05',
    },
    {
      text: 'All men can see the tactics whereby I conquer, but what none can see is the strategy out of which victory is evolved.',
      chapter: 'VI. Weak Points and Strong',
      section: '27',
      anchor: '06',
    },
    {
      text: 'Do not repeat the tactics which have gained you one victory, but let your methods be regulated by the infinite variety of circumstances.',
      chapter: 'VI. Weak Points and Strong',
      section: '28',
      anchor: '06',
    },
    {
      text: 'Therefore, just as water retains no constant shape, so in warfare there are no constant conditions.',
      chapter: 'VI. Weak Points and Strong',
      section: '32',
      anchor: '06',
    },
    {
      text: 'Let your rapidity be that of the wind, your compactness that of the forest.',
      chapter: 'VII. Manœuvering',
      section: '17',
      anchor: '07',
    },
  ];

  function initThemeControls() {
    const toggle = document.querySelector('.theme-toggle');
    const root = document.documentElement;
    // The inline head controller is the only source of theme decisions. Keeping
    // that bootstrap inline prevents a network request from delaying first paint.
    const theme = window.markTheme;
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

  function initQuoteDialog({ id, trigger, title, quotes, citation }) {
    const dialog = document.querySelector(`#${id}-dialog`);
    const button = document.querySelector(trigger);
    if (!dialog || !button) return;
    const quote = dialog.querySelector('blockquote p');
    const source = dialog.querySelector('.quote-source');
    const passage = dialog.querySelector('.quote-passage');
    const drawQuote = createShuffledDeck(quotes);

    // Native animated End scrolling can keep a stale destination when successive
    // quotes change the region's height. Give focused readers definite endpoints.
    passage.addEventListener('keydown', (event) => {
      if (
        event.target !== passage ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !['Home', 'End'].includes(event.key)
      )
        return;
      event.preventDefault();
      passage.scrollTop = event.key === 'Home' ? 0 : passage.scrollHeight;
    });

    function showQuote() {
      const entry = drawQuote();
      const { url, reference, label } = citation(entry);
      quote.textContent = entry.text;
      quote.closest('blockquote').cite = url;
      source.href = url;
      source.textContent = `${reference} ↗`;
      source.setAttribute('aria-label', `Read ${title}, ${label} (opens in a new tab)`);
      passage.scrollTop = 0;
    }

    initDialogDismissal(dialog);
    button.disabled = false;
    button.addEventListener('click', () => {
      showQuote();
      if (!dialog.open) dialog.showModal();
    });
    dialog.querySelector('.quote-next').addEventListener('click', showQuote);
  }

  function initMeditations() {
    initQuoteDialog({
      id: 'meditations',
      trigger: '.meditations-toggle',
      title: 'Meditations',
      quotes: meditationsQuotes,
      citation: (entry) => ({
        url: `https://en.wikisource.org/wiki/The_Thoughts_of_the_Emperor_Marcus_Aurelius_Antoninus/Book_${entry.book}`,
        reference: `Book ${entry.book} · ${entry.section}`,
        label: `Book ${entry.book}, section ${entry.section}`,
      }),
    });
  }

  function initArtOfWar() {
    initQuoteDialog({
      id: 'art-of-war',
      trigger: '.katana-toggle',
      title: 'The Art of War',
      quotes: artOfWarQuotes,
      citation: (entry) => ({
        url: `https://www.gutenberg.org/cache/epub/17405/pg17405-images.html#chap${entry.anchor}`,
        reference: `${entry.chapter} · ${entry.section}`,
        label: `${entry.chapter}, section ${entry.section}`,
      }),
    });
  }

  function initSisyphus() {
    const dialog = document.querySelector('#sisyphus-dialog');
    const statue = document.querySelector('.sisyphus-toggle');
    if (!dialog || !statue) return;
    initDialogDismissal(dialog);
    statue.disabled = false;
    statue.addEventListener('click', () => {
      if (!dialog.open) dialog.showModal();
      dialog.querySelector('.quote-passage').scrollTop = 0;
    });
  }

  function initFavoriteBooks() {
    const dialog = document.querySelector('#books-dialog');
    const trigger = document.querySelector('.books-toggle');
    if (!dialog || !trigger) return;
    const carousel = dialog.querySelector('.book-carousel');
    const slide = dialog.querySelector('.book-slide');
    const coverLink = dialog.querySelector('.book-cover-link');
    const cover = dialog.querySelector('.book-cover');
    const fallback = dialog.querySelector('.book-cover-fallback');
    const title = dialog.querySelector('.book-title');
    const author = dialog.querySelector('.book-author');
    const amazon = dialog.querySelector('.book-amazon');
    const position = dialog.querySelector('.book-position');
    const status = dialog.querySelector('.books-status');
    const retry = dialog.querySelector('.books-retry');
    let books;
    let loading;
    let index = 0;
    let swipeStart;
    let suppressClickUntil = 0;

    function showBook(nextIndex) {
      index = (nextIndex + books.length) % books.length;
      const book = books[index];
      cover.hidden = false;
      fallback.hidden = true;
      cover.alt = book.alt;
      cover.src = book.cover;
      title.textContent = book.title;
      author.textContent = book.author;
      for (const link of [coverLink, amazon]) {
        link.href = book.amazonUrl;
        link.setAttribute('aria-label', `${book.title} on Amazon (opens in a new tab)`);
      }
      slide.setAttribute('aria-label', `${index + 1} of ${books.length}: ${book.title}`);
      position.textContent = `${String(index + 1).padStart(2, '0')} / ${books.length}`;
      position.setAttribute('aria-label', `Book ${index + 1} of ${books.length}: ${book.title}`);
      slide.scrollTop = 0;
    }

    async function loadBooks() {
      // Keep keyboard focus inside the modal when the retry control disappears.
      if (document.activeElement === retry) {
        dialog.querySelector('[data-dialog-close]').focus({ preventScroll: true });
      }
      status.hidden = false;
      status.textContent = 'Taking a few books off the shelf…';
      retry.hidden = true;
      carousel.hidden = true;
      try {
        // Fetch only when opened. Reuse an in-flight request across close/reopen.
        if (!books) {
          loading ??= fetch('assets/books/catalog.json').then((response) => {
            if (!response.ok) throw new Error('Book catalog could not be loaded');
            return response.json();
          });
          books = await loading;
          if (!Array.isArray(books) || !books.length) {
            books = undefined;
            throw new Error('Book catalog is empty');
          }
        }
        if (!dialog.open) return;
        showBook(index);
        status.hidden = true;
        carousel.hidden = false;
      } catch {
        loading = undefined;
        if (!dialog.open) return;
        status.textContent = 'The bookshelf couldn’t load. Please try again.';
        retry.hidden = false;
      }
    }

    cover.addEventListener('error', () => {
      cover.hidden = true;
      fallback.hidden = false;
    });
    initDialogDismissal(dialog);
    trigger.disabled = false;
    trigger.addEventListener('click', () => {
      if (!dialog.open) dialog.showModal();
      void loadBooks();
    });
    retry.addEventListener('click', () => void loadBooks());
    dialog.querySelector('.book-prev').addEventListener('click', () => showBook(index - 1));
    dialog.querySelector('.book-next').addEventListener('click', () => showBook(index + 1));
    dialog.addEventListener('keydown', (event) => {
      if (carousel.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
      const nextIndex = {
        ArrowLeft: index - 1,
        ArrowRight: index + 1,
        Home: 0,
        End: books.length - 1,
      }[event.key];
      if (nextIndex === undefined) return;
      event.preventDefault();
      showBook(nextIndex);
    });
    // Horizontal swipes browse covers; vertical gestures keep scrolling natural.
    coverLink.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    dialog.addEventListener('pointerup', (event) => {
      if (!swipeStart || swipeStart.id !== event.pointerId) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = undefined;
      if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
      suppressClickUntil = Date.now() + 400;
      showBook(index + (dx < 0 ? 1 : -1));
    });
    coverLink.addEventListener('click', (event) => {
      if (Date.now() < suppressClickUntil) event.preventDefault();
    });
    for (const event of ['pointercancel', 'close']) {
      dialog.addEventListener(event, () => {
        swipeStart = undefined;
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

  function initCandle() {
    const scene = document.querySelector('.scene');
    const candle = document.querySelector('.candle-toggle');
    if (!scene || !candle) return;
    const hint = document.querySelector('.candle-hint');
    const status = document.querySelector('#candle-status');
    function setLit(lit, announce = true) {
      scene.classList.toggle('candle-lit', lit);
      candle.setAttribute('aria-pressed', String(lit));
      candle.setAttribute('aria-label', lit ? 'Blow out the candle' : 'Light the candle');
      hint.textContent = lit ? 'Blow it out' : 'Light the candle';
      if (announce) status.textContent = lit ? 'The candle is lit.' : 'The candle is out.';
    }
    candle.disabled = false;
    setLit(true, false);
    candle.addEventListener('click', () => setLit(!scene.classList.contains('candle-lit')));
  }

  function initWallSafe() {
    const wall = document.querySelector('.wall-secret');
    const painting = document.querySelector('.painting-toggle');
    if (!wall || !painting) return;
    const safe = document.querySelector('#wall-safe');
    const status = document.querySelector('#safe-status');
    const hint = document.querySelector('.painting-hint');
    function setOpen(open) {
      wall.classList.toggle('is-open', open);
      painting.setAttribute('aria-expanded', String(open));
      painting.setAttribute(
        'aria-label',
        open
          ? 'Put the Warsaw painting back to hide the safe'
          : 'Move the Warsaw painting to reveal a hidden safe',
      );
      safe.setAttribute('aria-hidden', String(!open));
      hint.textContent = open ? 'Close the painting' : 'A little secret…';
      status.textContent = open
        ? 'You found a hidden wall safe. Click the painting again or press Escape to cover it.'
        : 'The Warsaw painting is back in place.';
    }
    wall.hidden = false;
    painting.addEventListener('click', () =>
      setOpen(painting.getAttribute('aria-expanded') !== 'true'),
    );
    document.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        !document.querySelector('dialog[open]') &&
        painting.getAttribute('aria-expanded') === 'true'
      ) {
        setOpen(false);
      }
    });
  }

  function initDog() {
    const dog = document.querySelector('.dog');
    if (!dog) return;
    const status = document.querySelector('#dog-status');
    let petTimer;
    let petCount = 0;
    dog.disabled = false;
    dog.addEventListener('click', () => {
      clearTimeout(petTimer);
      dog.classList.remove('is-petted');
      // Restart the animation when a visitor pets the dog again.
      void dog.offsetWidth;
      dog.classList.add('is-petted');
      petCount += 1;
      status.textContent =
        petCount % 2 ? 'CiCi is one happy pomsky. Tail wags!' : "More pets? You've made a friend.";
      petTimer = setTimeout(() => dog.classList.remove('is-petted'), 1300);
    });
    window.addEventListener('pagehide', () => {
      clearTimeout(petTimer);
      dog.classList.remove('is-petted');
    });
  }

  // Keep feature state private and let independent interactions initialize even
  // if a later markup edit breaks one feature. Report failures rather than hiding them.
  for (const initialize of [
    initThemeControls,
    initBusinessCard,
    initMeditations,
    initArtOfWar,
    initSisyphus,
    initFavoriteBooks,
    initPolaroids,
    initCandle,
    initWallSafe,
    initDog,
  ]) {
    try {
      initialize();
    } catch (error) {
      console.error(`Homepage ${initialize.name} failed to initialize.`, error);
    }
  }
})();
