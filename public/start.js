/* Frank Matranga / Matranga Codeworks — the /start sketch wizard.

   Five questions; the board on the right draws the visitor's app as they
   answer. Three answers go to /api/sketch (worker/sketch.js), which
   asks Claude for a working title, the screens and the brief. Whenever that
   isn't available (no Worker under `python3 -m http.server`, the challenge
   blocked, the session's limit reached, the API down), this file draws a
   plainer sketch itself, so the wizard always finishes.

   Contact details are asked for only after the brief, and go only to
   /api/brief (worker/brief.js), never to /api/sketch or Claude.
   PostHog gets step numbers, never answers. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Mirrors the enums in worker/shared.js; the server rejects anything else. */
  var USERS = [['staff', 'Our staff'], ['customers', 'Our customers'], ['clients', 'Patients or clients'],
               ['members', 'Members or volunteers'], ['public', 'The public'], ['me', 'Just me']];
  var PLATFORMS = [['desktop', 'A computer'], ['phone', 'Their phone'], ['both', 'Both']];
  var TODAY = [['sheets', 'Spreadsheets'], ['paper', 'Paper or a whiteboard'], ['tool', "An off-the-shelf tool that doesn't fit"],
               ['email', 'Email and phone calls'], ['existing', 'An app we already have'], ['nothing', "Nothing yet, it's new"]];
  var KINDS = [['startup', "I'm building a product to sell"], ['organization', "We're fixing how our organization works"]];
  var TIMING = [['asap', 'As soon as possible'], ['soon', 'In the next few months'], ['exploring', 'Just exploring']];
  var BLOCKS = ['list', 'table', 'form', 'calendar', 'chart', 'map', 'messages', 'cards', 'payments', 'signin', 'stats', 'upload'];

  var GHOST_TAG = { sheets: 'Today: spreadsheets', paper: 'Today: paper', tool: 'Today: a tool that doesn’t fit',
                    email: 'Today: email & calls', existing: 'Today: your current app' };
  var PLATFORM_ACK = {
    desktop: 'Got it. I’ll draw it for a computer screen.',
    phone: 'Got it. I’ll draw it for a phone.',
    both: 'Got it. I’ll draw it for a computer and a phone.'
  };
  var TODAY_ACK = {
    sheets: 'Got it. Spreadsheets are where most of these projects start.',
    paper: 'Got it. Paper is hard to search and easy to lose.',
    tool: 'Got it. Knowing where that tool falls short will help.',
    email: 'Got it. That usually means a lot of retyping and chasing replies.',
    existing: 'Got it. Knowing what your current app does will help.',
    nothing: 'Got it. Starting from scratch.'
  };

  var label = function (list, id) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1];
    return '';
  };
  var clip = function (s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduced ? 0 : ms); }); };
  var track = function (event, props) { try { if (window.posthog && window.posthog.capture) window.posthog.capture(event, props || {}); } catch (e) {} };
  var uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  var state = {
    sid: uuid(),
    claude: true,        // false once /api/sketch can't help; the rest is drawn here
    canSend: false,      // /api/brief is configured; otherwise the form offers a prefilled email
    ticket: null,        // issued after the first Turnstile check; both endpoints take it instead of a token
    usedClaude: false,
    answers: {
      idea: '', followup_q: '', followup: '', users: [], platform: '', today: '', today_detail: '',
      musts: [], kind: '', timing: ''
    },
    sketch: { app_name: '', screens: [] },
    brief: null,
    screen: 0
  };

  /* ------------------------------------------------------------ Turnstile */

  /* One invisible widget for the session. Each token works once, so takeToken()
     hands it out and resets the widget to fetch the next one. */
  var turnstile = { sitekey: null, widget: null, token: null, waiters: [], failed: false };

  function loadConfig() {
    var request = fetch('/api/sketch', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 5000); });
    return Promise.race([request, timeout])
      .then(function (cfg) {
        state.claude = Boolean(cfg && cfg.enabled && cfg.sitekey);
        state.canSend = Boolean(cfg && cfg.send && cfg.sitekey);
        if (!cfg || !cfg.sitekey) { turnstile.failed = true; return; }
        turnstile.sitekey = cfg.sitekey;
        startTurnstile();
      });
  }

  function settleTurnstile(token) {
    turnstile.token = token;
    if (!token) turnstile.failed = true;
    turnstile.waiters.splice(0).forEach(function (w) { w(token); });
  }

  function startTurnstile() {
    window.skTurnstileReady = function () {
      try {
        turnstile.widget = window.turnstile.render('#sk-turnstile', {
          sitekey: turnstile.sitekey,
          action: 'sketch',
          appearance: 'interaction-only',
          callback: settleTurnstile,
          'error-callback': function () { settleTurnstile(null); },
          'expired-callback': function () { turnstile.token = null; }
        });
      } catch (e) { settleTurnstile(null); }
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=skTurnstileReady&render=explicit';
    s.async = true;
    s.onerror = function () { settleTurnstile(null); };
    document.head.appendChild(s);
  }

  function takeToken() {
    if (turnstile.failed) return Promise.resolve(null);
    var ready = turnstile.token ? Promise.resolve(turnstile.token) : new Promise(function (resolve) {
      turnstile.waiters.push(resolve);
      setTimeout(function () { resolve(turnstile.token); }, 20000);
    });
    return ready.then(function (token) {
      if (!token) return null;
      turnstile.token = null;
      try { if (window.turnstile && turnstile.widget != null) window.turnstile.reset(turnstile.widget); } catch (e) {}
      return token;
    });
  }

  /* ------------------------------------------------------------ the API */

  function post(path, body) {
    var opts = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
    if (window.AbortSignal && AbortSignal.timeout) opts.signal = AbortSignal.timeout(35000);
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) { var e = new Error('api'); e.status = r.status; e.data = data; throw e; }
        return data;
      });
    });
  }

  /* Posts to an endpoint that wants this session's ticket or a fresh Turnstile
     token. A 403 on a ticket means it expired: drop it and retry once with a
     token. Rejects with status 'challenge' when no token can be had. */
  function postGuarded(path, body) {
    function attempt(retried) {
      delete body.turnstile;
      body.ticket = state.ticket;
      var ready = state.ticket ? Promise.resolve(true)
        : takeToken().then(function (t) { if (t) body.turnstile = t; return Boolean(t); });
      return ready.then(function (ok) {
        if (!ok) { var e = new Error('challenge'); e.status = 'challenge'; throw e; }
        return post(path, body);
      }).then(function (data) {
        if (data && data.ticket) state.ticket = data.ticket;
        return data;
      }, function (err) {
        if (err && err.status === 403 && body.ticket && !retried) { state.ticket = null; return attempt(true); }
        throw err;
      });
    }
    return attempt(false);
  }

  /* Returns Claude's result for this step, or null to draw it here instead. */
  function askClaude(step) {
    if (!state.claude) return Promise.resolve(null);
    var body = { step: step, sid: state.sid, answers: state.answers, app_name: state.sketch.app_name };
    return postGuarded('/api/sketch', body).then(function (data) {
      if (data.fallback || !data.result) { if (data.reason === 'limit' || data.reason === 'off') state.claude = false; return null; }
      state.usedClaude = true;
      return data.result;
    }).catch(function (e) {
      if (e && (e.status === 'challenge' || e.status === 403 || e.status === 429)) state.claude = false;
      return null;
    });
  }

  /* ------------------------------------------------------------ conversation */

  var log = $('sk-log');
  var turn = $('sk-turn');

  function scrollTo(node) {
    if (!node || !node.scrollIntoView) return;
    node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }

  function say(text, tag, ack) {
    var typing = el('li', 'msg msg--typing');
    typing.setAttribute('aria-hidden', 'true');
    typing.appendChild(el('i')); typing.appendChild(el('i')); typing.appendChild(el('i'));
    log.appendChild(typing);
    scrollTo(typing);
    return wait(ack ? 350 : 550).then(function () {
      typing.remove();
      var li = el('li', 'msg msg--bot' + (ack ? ' msg--ack' : ''));
      if (tag) li.appendChild(el('span', 'msg__tag', tag));
      li.appendChild(document.createTextNode(text));
      log.appendChild(li);
      scrollTo(li);
    });
  }

  function youSaid(text) {
    var li = el('li', 'msg msg--you', text);
    log.appendChild(li);
    scrollTo(li);
  }

  function progress(n) {
    $('sk-step').textContent = n > 5 ? 'Done' : 'Question ' + n + ' of 5';
    $('sk-bar').style.width = Math.min(100, (n - 1) / 5 * 100) + '%';
  }

  function clearTurn() { while (turn.firstChild) turn.removeChild(turn.firstChild); }

  function nextButton(text) {
    var b = el('button', 'btn sk__next', text || 'Next →');
    b.type = 'submit';
    return b;
  }

  function chipGroup(title, options, multi, onChange) {
    var wrap = el('div');
    var id = 'sk-g-' + Math.random().toString(36).slice(2, 8);
    var lab = el('div', 'label', title);
    lab.id = id;
    var chips = el('div', 'sk-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-labelledby', id);
    var selected = [];
    options.forEach(function (o) {
      var c = el('button', 'sk-chip', o[1]);
      c.type = 'button';
      c.setAttribute('aria-pressed', 'false');
      c.addEventListener('click', function () {
        if (multi) {
          var at = selected.indexOf(o[0]);
          if (at >= 0) selected.splice(at, 1); else selected.push(o[0]);
        } else {
          selected = [o[0]];
        }
        Array.prototype.forEach.call(chips.children, function (x, i) {
          x.setAttribute('aria-pressed', selected.indexOf(options[i][0]) >= 0 ? 'true' : 'false');
        });
        onChange(selected.slice());
      });
      chips.appendChild(c);
    });
    wrap.appendChild(lab);
    wrap.appendChild(chips);
    return wrap;
  }

  /* Puts a form in the turn area and resolves with what the visitor submits. */
  function ask(build) {
    return new Promise(function (resolve) {
      clearTurn();
      var form = el('form');
      form.noValidate = true;
      form.style.display = 'grid';
      form.style.gap = '1.2rem';
      var api = build(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!api.valid()) return;
        var value = api.value();
        clearTurn();
        resolve(value);
      });
      turn.appendChild(form);
      var first = form.querySelector('textarea, input, .sk-chip');
      if (first && !reduced) first.focus({ preventScroll: true });
      else if (first) first.focus();
    });
  }

  function textTurn(placeholder, minLength, multiline) {
    return ask(function (form) {
      var input = el(multiline ? 'textarea' : 'input', 'sk-input');
      input.placeholder = placeholder;
      input.maxLength = 600;
      if (multiline) input.rows = 3;
      input.setAttribute('aria-label', 'Your answer');
      var next = nextButton();
      next.disabled = true;
      input.addEventListener('input', function () { next.disabled = input.value.trim().length < minLength; });
      if (multiline) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!next.disabled) form.requestSubmit ? form.requestSubmit() : next.click(); }
        });
      }
      form.appendChild(input);
      form.appendChild(next);
      return { valid: function () { return input.value.trim().length >= minLength; }, value: function () { return input.value.trim(); } };
    });
  }

  /* ------------------------------------------------------------ the board */

  var board = $('sk-board');

  function setName(name) {
    state.sketch.app_name = name;
    $('sk-name-text').textContent = name;
    var tag = $('sk-name');
    tag.hidden = false;
    tag.style.animation = 'none'; void tag.offsetWidth; tag.style.animation = '';
    board.classList.add('has-name');
  }

  function setPlatform(p) {
    board.setAttribute('data-platform', p || 'none');
    if (p) board.classList.add('has-name');
  }

  function setStatus(text) {
    $('sk-status-text').textContent = text;
    $('sk-status').hidden = false;
  }

  function drawing(on) { board.classList.toggle('is-drawing', Boolean(on)); }

  function showGhost(kind) {
    var g = $('sk-ghost');
    while (g.firstChild) g.removeChild(g.firstChild);
    g.classList.remove('is-replaced');
    if (!kind || kind === 'nothing') return;
    var sheet = el('div', 'gh gh--' + kind);
    sheet.appendChild(el('span', 'gh__tag', GHOST_TAG[kind]));
    var art = el('div', 'gh__art');
    var n = { sheets: 30, paper: 7, tool: 5, email: 3, existing: 5 }[kind] || 4;
    for (var i = 0; i < n; i++) art.appendChild(el('i'));
    sheet.appendChild(art);
    g.appendChild(sheet);
  }

  var ART = {
    list: ['ln', 'ln', 'ln'],
    table: ['th', 'th', 'th', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'td'],
    form: ['fld', 'fld', 'go'],
    calendar: ['cell', 'cell', 'cell', 'cell', 'cell', 'cell', 'cell', 'cell', 'cell', 'cell on', 'cell', 'cell', 'cell', 'cell'],
    chart: ['bar', 'bar', 'bar', 'bar', 'bar'],
    map: ['pin'],
    messages: ['bub', 'bub me', 'bub'],
    cards: ['crd', 'crd', 'crd'],
    payments: ['amt', 'ln', 'go'],
    signin: ['fld', 'fld', 'go'],
    stats: ['tile', 'tile', 'tile'],
    upload: ['drop']
  };
  var BAR_HEIGHTS = ['42%', '68%', '52%', '88%', '60%'];

  function block(b, i) {
    var kind = BLOCKS.indexOf(b.kind) >= 0 ? b.kind : 'cards';
    var node = el('div', 'blk blk--' + kind);
    node.style.setProperty('--i', i);
    node.appendChild(el('span', 'blk__label', b.label));
    var art = el('div', 'blk__art');
    ART[kind].forEach(function (cls, j) {
      var piece = el('i', cls);
      piece.style.setProperty('--i', i);
      piece.style.setProperty('--j', j);
      if (kind === 'chart') piece.style.setProperty('--h', BAR_HEIGHTS[j]);
      art.appendChild(piece);
    });
    node.appendChild(art);
    return node;
  }

  function renderScreens() {
    var screens = state.sketch.screens;
    if (!screens.length) return;
    var cur = screens[state.screen] || screens[0];
    var side = $('sk-side'), main = $('sk-main'), phone = $('sk-screen'), tabs = $('sk-tabs'), picker = $('sk-screens');
    [side, main, phone, tabs, picker].forEach(function (n) { while (n.firstChild) n.removeChild(n.firstChild); });

    screens.forEach(function (s, i) {
      var item = el('span', 'sk-nav' + (i === state.screen ? ' is-on' : ''), s.name);
      item.style.setProperty('--i', i);
      side.appendChild(item);
      tabs.appendChild(el('i', i === state.screen ? 'is-on' : ''));

      var b = el('button', '', s.name);
      b.type = 'button';
      b.setAttribute('aria-pressed', i === state.screen ? 'true' : 'false');
      b.addEventListener('click', function () { state.screen = i; renderScreens(); track('sketch_screen_viewed'); });
      picker.appendChild(b);
    });

    main.appendChild(el('span', 'sk-title', cur.name));
    var grid = el('div', 'sk-blocks');
    cur.blocks.slice(0, 4).forEach(function (b, i) { grid.appendChild(block(b, i)); });
    main.appendChild(grid);

    phone.appendChild(el('span', 'sk-title', cur.name));
    var stack = el('div', 'sk-blocks');
    cur.blocks.slice(0, 3).forEach(function (b, i) { stack.appendChild(block(b, i)); });
    phone.appendChild(stack);

    picker.hidden = screens.length < 2;
  }

  /* ------------------------------------------------------------ drawn here */

  var GUESS = [
    [/book|schedul|shift|appointment|calendar|availab|reserv|date|event/i, 'calendar', 'list', 'Upcoming'],
    [/pay|invoice|bill|donat|checkout|charge|price|subscri/i, 'payments', 'table', 'History'],
    [/message|chat|notif|remind|text|email|alert|announce/i, 'messages', 'list', 'Inbox'],
    [/report|dashboard|track|metric|chart|analytic|progress|insight/i, 'chart', 'stats', 'This week'],
    [/map|locat|route|deliver|near|address|field/i, 'map', 'list', 'Nearby'],
    [/upload|photo|document|file|scan|attach|record|receipt/i, 'upload', 'list', 'Files'],
    [/log ?in|sign ?in|account|profile|member|permission/i, 'signin', 'form', 'Profile'],
    [/inventor|catalog|director|search|browse|list|stock/i, 'table', 'form', 'Add new'],
    [/form|apply|request|submit|intake|regist|order|survey/i, 'form', 'list', 'Submitted']
  ];

  var FILLER = /^(a|an|the|them|their|our|my|your|his|her|its|to|of|by|for|who|that|which|and|or|in|on|at|with|from|it|is|are|be|can)$/i;

  /* "Let volunteers pick an open shift" → "Pick Open Shift". Claude names the
     screens when it can; this is only the fallback. */
  function shortName(text) {
    var t = String(text).replace(/^(let|allow|help|enable)\s+\w+\s+(to\s+)?/i, '').replace(/[.!?]+$/, '');
    var words = t.split(/\s+/).filter(function (w) { return w && !FILLER.test(w); }).slice(0, 3)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); });
    return clip(words.join(' ') || 'Screen', 24);
  }

  function fallbackScreens(musts) {
    return musts.map(function (m) {
      var g = null;
      for (var i = 0; i < GUESS.length; i++) if (GUESS[i][0].test(m)) { g = GUESS[i]; break; }
      g = g || [null, 'cards', 'form', 'Details'];
      return { name: shortName(m), blocks: [{ kind: g[1], label: clip(m, 28) }, { kind: g[2], label: g[3] }] };
    });
  }

  function fallbackBrief() {
    var a = state.answers;
    var who = a.users.map(function (u) { return label(USERS, u); }).join(', ');
    return {
      title: state.sketch.app_name || 'Your app',
      summary: clip(a.idea, 300),
      who: clip(who, 70),
      replaces: clip(label(TODAY, a.today) + (a.today_detail ? ' (' + a.today_detail + ')' : ''), 70),
      musts: a.musts.slice()
    };
  }

  /* ------------------------------------------------------------ the steps */

  function stepIdea() {
    progress(1);
    return say('What’s the problem you want to solve? Or, if you already know, what do you want built?', 'Q1')
      .then(function () { return textTurn('e.g. Our volunteers sign up for shifts by replying to a group email, and someone retypes it all into a spreadsheet.', 12, true); })
      .then(function (idea) {
        state.answers.idea = idea;
        youSaid(idea);
        track('sketch_step', { step: 1 });
        drawing(true);
        return askClaude('idea');
      })
      .then(function (r) {
        drawing(false);
        setName((r && r.app_name) || 'Your app');
        var chain = r && r.ack ? say(r.ack, 'Claude', true) : Promise.resolve();
        if (r && r.follow_up) {
          state.answers.followup_q = r.follow_up;
          chain = chain
            .then(function () { return say(r.follow_up, 'Claude'); })
            .then(function () { return textTurn('Your answer', 2, true); })
            .then(function (text) { state.answers.followup = text; youSaid(text); });
        }
        return chain;
      });
  }

  function stepUsers() {
    progress(2);
    return say('Who’ll use it?', 'Q2').then(function () {
      return ask(function (form) {
        var users = [], platform = '';
        var next = nextButton();
        next.disabled = true;
        var check = function () { next.disabled = !(users.length && platform); };
        form.appendChild(chipGroup('Pick any that fit', USERS, true, function (v) { users = v; check(); }));
        form.appendChild(chipGroup('Where will they mostly use it?', PLATFORMS, false, function (v) { platform = v[0]; setPlatform(platform); check(); }));
        form.appendChild(next);
        return { valid: function () { return users.length && platform; }, value: function () { return { users: users, platform: platform }; } };
      });
    }).then(function (v) {
      state.answers.users = v.users;
      state.answers.platform = v.platform;
      youSaid(v.users.map(function (u) { return label(USERS, u); }).join(', ') + '\nMostly on ' + label(PLATFORMS, v.platform).toLowerCase());
      setPlatform(v.platform);
      track('sketch_step', { step: 2 });
      return say(PLATFORM_ACK[v.platform], null, true);
    });
  }

  function stepToday() {
    progress(3);
    return say('How is this handled today?', 'Q3').then(function () {
      return ask(function (form) {
        var today = '';
        var next = nextButton();
        next.disabled = true;
        form.appendChild(chipGroup('Pick the closest', TODAY, false, function (v) { today = v[0]; showGhost(today); next.disabled = false; }));
        var detail = el('input', 'sk-input');
        detail.placeholder = 'Anything I should know about how it works now? (optional)';
        detail.maxLength = 300;
        detail.setAttribute('aria-label', 'Anything I should know about how it works now? Optional');
        form.appendChild(detail);
        form.appendChild(next);
        return { valid: function () { return Boolean(today); }, value: function () { return { today: today, detail: detail.value.trim() }; } };
      });
    }).then(function (v) {
      state.answers.today = v.today;
      state.answers.today_detail = v.detail;
      youSaid(label(TODAY, v.today) + (v.detail ? '\n' + v.detail : ''));
      showGhost(v.today);
      track('sketch_step', { step: 3 });
      return say(TODAY_ACK[v.today], null, true);
    });
  }

  function stepMusts() {
    progress(4);
    return say('What are the most important things it has to do? Up to three.', 'Q4').then(function () {
      return ask(function (form) {
        var wrap = el('div', 'sk-musts');
        var examples = ['Let volunteers pick an open shift', 'Remind them the day before', 'Show coordinators who’s coming'];
        var inputs = examples.map(function (ex, i) {
          var row = el('label');
          var input = el('input', 'sk-input');
          input.placeholder = (i === 0 ? 'e.g. ' : '') + ex + (i === 0 ? '' : ' (optional)');
          input.maxLength = 120;
          input.setAttribute('aria-label', 'Thing it must do, number ' + (i + 1) + (i ? ', optional' : ''));
          row.appendChild(input);
          wrap.appendChild(row);
          return input;
        });
        var next = nextButton('Draw the screens →');
        next.disabled = true;
        inputs[0].addEventListener('input', function () { next.disabled = inputs[0].value.trim().length < 3; });
        form.appendChild(wrap);
        form.appendChild(next);
        var values = function () { return inputs.map(function (x) { return x.value.trim(); }).filter(Boolean); };
        return { valid: function () { return inputs[0].value.trim().length >= 3; }, value: values };
      });
    }).then(function (musts) {
      state.answers.musts = musts;
      youSaid(musts.map(function (m, i) { return (i + 1) + '. ' + m; }).join('\n'));
      track('sketch_step', { step: 4 });
      drawing(true);
      return askClaude('musts');
    }).then(function (r) {
      drawing(false);
      var screens = r && r.screens && r.screens.length ? r.screens : fallbackScreens(state.answers.musts);
      state.sketch.screens = screens.slice(0, 4);
      state.screen = 0;
      if (board.getAttribute('data-platform') === 'none') setPlatform('both');
      renderScreens();
      var ghost = $('sk-ghost');
      if (ghost.firstChild) ghost.classList.add('is-replaced');
      var where = window.matchMedia && matchMedia('(max-width: 960px)').matches ? 'above' : 'on the right';
      return r && r.ack ? say(r.ack, 'Claude', true) : say('Here’s a first draft of the screens. Use the buttons under the sketch ' + where + ' to switch between them.', null, true);
    });
  }

  function stepKind() {
    progress(5);
    return say('Last one. Which sounds more like you?', 'Q5').then(function () {
      return ask(function (form) {
        var kind = '', timing = '';
        var next = nextButton('Write my summary →');
        next.disabled = true;
        var check = function () { next.disabled = !(kind && timing); };
        form.appendChild(chipGroup('Your situation', KINDS, false, function (v) { kind = v[0]; check(); }));
        form.appendChild(chipGroup('And when would you want to start?', TIMING, false, function (v) { timing = v[0]; check(); }));
        form.appendChild(next);
        return { valid: function () { return kind && timing; }, value: function () { return { kind: kind, timing: timing }; } };
      });
    }).then(function (v) {
      state.answers.kind = v.kind;
      state.answers.timing = v.timing;
      youSaid(label(KINDS, v.kind) + '\n' + label(TIMING, v.timing));
      setStatus((v.kind === 'startup' ? 'Startup' : 'Organization') + ' · ' + label(TIMING, v.timing));
      track('sketch_step', { step: 5 });
      return say('Writing up your summary…', null, true);
    }).then(function () {
      drawing(true);
      return askClaude('brief');
    }).then(function (r) {
      drawing(false);
      state.brief = r && r.title ? r : fallbackBrief();
      progress(6);
      renderBrief();
      return say('Your summary is ready below.', null, true);
    });
  }

  /* ------------------------------------------------------------ the brief */

  function briefNumber() { return String(parseInt(state.sid.replace(/-/g, '').slice(0, 6), 16) % 9000 + 1000); }

  function renderBrief() {
    var b = state.brief, a = state.answers;
    $('brief-h').textContent = b.title;
    $('sk-brief-no').textContent = 'Project summary · No. ' + briefNumber();
    $('sk-brief-summary').textContent = b.summary;

    var dl = $('sk-brief-dl');
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    var on = { desktop: 'Desktop', phone: 'Phone', both: 'Desktop and phone' }[a.platform];
    [['For', b.who], ['Used on', on], ['Replaces', b.replaces],
     ['Screens', state.sketch.screens.map(function (s) { return s.name; }).join(', ')]].forEach(function (row) {
      if (!row[1]) return;
      var d = el('div');
      d.appendChild(el('dt', null, row[0]));
      d.appendChild(el('dd', null, row[1]));
      dl.appendChild(d);
    });

    var ul = $('sk-brief-musts');
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    (b.musts && b.musts.length ? b.musts : a.musts).forEach(function (m) { ul.appendChild(el('li', null, m)); });

    $('sk-brief-credit').textContent = state.usedClaude
      ? 'Sketched by Claude from your answers. Frank reads every summary himself.'
      : 'Sketched from your answers. Frank reads every summary himself.';

    var section = $('brief');
    section.hidden = false;
    setTimeout(function () { section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }, reduced ? 0 : 500);
  }

  function briefAsText() {
    var b = state.brief, a = state.answers;
    return [b.title, '', b.summary, '', 'For: ' + b.who, 'On: ' + label(PLATFORMS, a.platform), 'Replaces: ' + b.replaces,
            'It has to:'].concat((b.musts && b.musts.length ? b.musts : a.musts).map(function (m) { return '- ' + m; }))
      .concat(['', 'In my words: ' + a.idea]).join('\n');
  }

  function showFormError(text, mailto) {
    var p = $('sk-form-error');
    while (p.firstChild) p.removeChild(p.firstChild);
    p.appendChild(document.createTextNode(text));
    if (mailto) {
      p.appendChild(document.createTextNode(' '));
      var a = el('a', 'link-hair', 'Email it to me instead →');
      a.href = 'mailto:frank@matrangacode.works?subject=' + encodeURIComponent('Project sketch: ' + state.brief.title) +
               '&body=' + encodeURIComponent(clip(briefAsText(), 1800));
      a.setAttribute('data-cta', 'sketch-email-fallback');
      p.appendChild(a);
    }
    p.hidden = false;
  }

  function bindForm() {
    var form = $('sk-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var contact = {
        name: f.name.value.trim(), email: f.email.value.trim(), company: f.company.value.trim(),
        phone: f.phone.value.trim(), website: f.website.value
      };
      $('sk-form-error').hidden = true;
      if (!contact.name) { showFormError('Please add your name.'); f.name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) { showFormError('That email doesn’t look right.'); f.email.focus(); return; }
      if (!state.canSend) { showFormError('Sending isn’t available right now.', true); return; }

      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Sending…';
      postGuarded('/api/brief', {
        sid: state.sid, answers: state.answers, sketch: state.sketch,
        brief: state.brief, used_claude: state.usedClaude, contact: contact
      }).then(function () {
        form.hidden = true;
        var sent = $('sk-sent');
        sent.hidden = false;
        sent.focus();
        $('consult-lead').textContent = 'Pick a time and I’ll have read your sketch before we talk.';
        track('sketch_sent', { used_claude: state.usedClaude, screens: state.sketch.screens.length });
      }).catch(function (err) {
        button.disabled = false;
        button.textContent = 'Send it to Frank →';
        if (err && err.status === 400 && err.data && err.data.fields && err.data.fields.indexOf('email') >= 0) {
          showFormError('That email doesn’t look right.');
          f.email.focus();
        } else if (err && err.status === 429) {
          showFormError('Too many summaries have been sent from this connection today.', true);
        } else if (err && err.status === 'challenge') {
          showFormError('Your browser blocked our spam check, so this can’t be sent from the page.', true);
        } else {
          showFormError('This didn’t send.', true);
        }
      });
    });
    $('sk-restart').addEventListener('click', function () { location.assign('/start'); });
  }

  /* ------------------------------------------------------------ start */

  function begin() {
    $('sk-intro').hidden = true;
    $('sk-convo').hidden = false;
    var section = document.querySelector('.sk');
    section.classList.add('is-on');
    section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    track('sketch_started');
    stepIdea()
      .then(stepUsers)
      .then(stepToday)
      .then(stepMusts)
      .then(stepKind)
      .catch(function (e) {
        drawing(false);
        clearTurn();
        say('Something went wrong on my end. You can still book a call below, or email frank@matrangacode.works.', null, true);
        try { if (window.posthog && window.posthog.captureException) window.posthog.captureException(e); } catch (x) {}
      });
  }

  function init() {
    var start = $('sk-start');
    if (!start || !log) return;
    start.hidden = false;
    var configured = loadConfig();
    start.addEventListener('click', function () { configured.then(begin); }, { once: true });
    bindForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
