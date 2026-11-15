/*
 * Women Vibe Coders — draft review comments
 *
 * Right-click anything on the page (or use "Add comment") to leave a comment.
 * Comments appear in the panel on the right, ordered by where they sit on the
 * page, top to bottom. People can reply, and edit or delete their own comments.
 *
 * Storage:
 *   - With window.WVC_FIREBASE_CONFIG set (see firebase-config.js), comments are
 *     shared live through Firebase Firestore. Each browser signs in anonymously,
 *     so only the author's browser can edit or delete a comment (enforced by
 *     firestore.rules).
 *   - Without it, comments stay in this browser only ("local preview").
 */
(function () {
  'use strict';

  var CONFIG = window.WVC_FIREBASE_CONFIG || null;
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var COLLECTION = 'comments';
  var NAME_KEY = 'wvc-draft-name';
  var LOCAL_KEY = 'wvc-draft-local-comments';
  var LOCAL_UID_KEY = 'wvc-draft-local-uid';
  var MAX_TEXT = 2000;
  var MAX_NAME = 60;

  // ── Small helpers ─────────────────────────────────────────────────────────
  var storage = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function squash(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function timeAgo(ms) {
    if (!ms) return 'just now';
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var hr = Math.round(m / 60);
    if (hr < 24) return hr + ' h ago';
    var d = Math.round(hr / 24);
    if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function randomId() {
    return 'l' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var state = {
    uid: null,
    name: squash(storage.get(NAME_KEY)).slice(0, MAX_NAME),
    comments: [],            // [{id, uid, name, text, parentId, anchor, createdAt(ms), editedAt(ms)}]
    status: CONFIG ? 'connecting' : 'local',
    statusText: '',
    active: null,            // thread id highlighted
    replying: null,          // thread id with open reply box
    editing: null,           // comment id being edited
    confirmDelete: null,     // comment id waiting for delete confirmation
    drafts: {},              // unsent text keyed by 'reply:<id>' / 'edit:<id>'
    mentions: {},            // the "@Name " a reply box was started with, keyed like drafts
    editingName: false,
    panelOpen: false,
    picking: false
  };

  // ── Backends ──────────────────────────────────────────────────────────────
  var backend = null;

  function localBackend() {
    var uid = storage.get(LOCAL_UID_KEY);
    if (!uid) { uid = randomId(); storage.set(LOCAL_UID_KEY, uid); }
    var listeners = [];
    function read() {
      try { return JSON.parse(storage.get(LOCAL_KEY) || '[]'); } catch (e) { return []; }
    }
    function write(list) {
      storage.set(LOCAL_KEY, JSON.stringify(list));
      listeners.forEach(function (fn) { fn(list.slice()); });
    }
    return {
      uid: function () { return uid; },
      subscribe: function (fn) { listeners.push(fn); fn(read()); },
      add: function (c) {
        var list = read();
        list.push(Object.assign({ id: randomId(), uid: uid, createdAt: Date.now(), editedAt: null }, c));
        write(list);
        return Promise.resolve();
      },
      update: function (id, text) {
        write(read().map(function (c) { return c.id === id ? Object.assign({}, c, { text: text, editedAt: Date.now() }) : c; }));
        return Promise.resolve();
      },
      remove: function (id) {
        write(read().filter(function (c) { return c.id !== id; }));
        return Promise.resolve();
      }
    };
  }

  function firebaseBackend() {
    return Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-firestore.js'),
      import(SDK + 'firebase-auth.js')
    ]).then(function (mods) {
      var appMod = mods[0], fs = mods[1], au = mods[2];
      var app = appMod.initializeApp(CONFIG);
      var db = fs.getFirestore(app);
      var auth = au.getAuth(app);
      var uid = null;
      var signedIn = new Promise(function (resolve, reject) {
        au.onAuthStateChanged(auth, function (u) {
          if (u) { uid = u.uid; state.uid = uid; resolve(uid); render(); }
        });
        au.signInAnonymously(auth).catch(reject);
      });
      function ms(t) { return t && typeof t.toMillis === 'function' ? t.toMillis() : null; }
      return {
        uid: function () { return uid; },
        ready: signedIn,
        subscribe: function (fn, onError) {
          fs.onSnapshot(fs.collection(db, COLLECTION), function (snap) {
            fn(snap.docs.map(function (d) {
              var x = d.data({ serverTimestamps: 'estimate' });
              return {
                id: d.id, uid: x.uid, name: x.name, text: x.text,
                parentId: x.parentId || null, anchor: x.anchor || null,
                createdAt: ms(x.createdAt), editedAt: ms(x.editedAt)
              };
            }));
          }, onError);
        },
        add: function (c) {
          return signedIn.then(function (id) {
            return fs.addDoc(fs.collection(db, COLLECTION), {
              uid: id, name: c.name, text: c.text,
              parentId: c.parentId || null, anchor: c.anchor || null,
              createdAt: fs.serverTimestamp(), editedAt: null
            });
          });
        },
        update: function (id, text) {
          return fs.updateDoc(fs.doc(db, COLLECTION, id), { text: text, editedAt: fs.serverTimestamp() });
        },
        remove: function (id) {
          return fs.deleteDoc(fs.doc(db, COLLECTION, id));
        }
      };
    });
  }

  function friendlyError(e) {
    var code = (e && e.code) || '';
    if (code.indexOf('permission-denied') !== -1) return 'The comment service refused this. Check the Firestore rules and that Anonymous sign-in is enabled.';
    if (code.indexOf('admin-restricted-operation') !== -1 || code.indexOf('operation-not-allowed') !== -1) return 'Anonymous sign-in is turned off in Firebase. Turn it on under Authentication › Sign-in method.';
    if (code.indexOf('unavailable') !== -1) return 'You seem to be offline. Comments will sync when you reconnect.';
    return 'Something went wrong talking to the comment service. Please try again.';
  }

  // ── Anchoring comments to page elements ───────────────────────────────────
  function isOurs(node) {
    return !!(node && node.closest && node.closest('.wvc-ui'));
  }

  function anchorElementFor(target) {
    if (!(target instanceof Element) || isOurs(target)) return null;
    // Drawings (the map, the blueprint) are redrawn by script: anchor to the whole drawing.
    var svg = target.closest('svg');
    if (svg) {
      var outer = svg;
      while (outer.parentElement && outer.parentElement.closest('svg')) outer = outer.parentElement.closest('svg');
      target = outer;
    }
    if (target === document.documentElement || target === document.body) return null;
    return target;
  }

  function cssPath(node) {
    var parts = [];
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.id && node.id.indexOf('wvc-') !== 0) {
        parts.unshift('#' + CSS.escape(node.id));
        return parts.join(' > ');
      }
      var tag = node.tagName.toLowerCase();
      var i = 1, sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++;
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      node = node.parentElement;
    }
    parts.unshift('body');
    return parts.join(' > ');
  }

  function describe(node) {
    var label = node.getAttribute('aria-label') || node.getAttribute('alt') || node.textContent || '';
    label = squash(label);
    if (!label) label = node.tagName.toLowerCase() === 'img' ? 'Image' : 'This part of the page';
    return label.length > 90 ? label.slice(0, 88) + '…' : label;
  }

  function makeAnchor(node, clientX, clientY) {
    var r = node.getBoundingClientRect();
    var fx = r.width ? (clientX - r.left) / r.width : 0;
    var fy = r.height ? (clientY - r.top) / r.height : 0;
    var docH = Math.max(document.documentElement.scrollHeight, 1);
    return {
      path: cssPath(node),
      tag: node.tagName.toLowerCase(),
      snippet: describe(node),
      fx: Math.min(1, Math.max(0, Math.round(fx * 1000) / 1000)),
      fy: Math.min(1, Math.max(0, Math.round(fy * 1000) / 1000)),
      docY: Math.round(((r.top + window.scrollY) / docH) * 10000) / 10000
    };
  }

  function resolveAnchor(anchor) {
    if (!anchor) return null;
    var node = null;
    try { node = document.querySelector(anchor.path); } catch (e) { node = null; }
    if (node && !isOurs(node)) return node;
    // The page changed since the comment was made: look for the same text instead.
    if (anchor.snippet && anchor.tag) {
      var start = anchor.snippet.replace(/…$/, '').slice(0, 40);
      var candidates = document.getElementsByTagName(anchor.tag);
      for (var i = 0; i < candidates.length; i++) {
        if (!isOurs(candidates[i]) && describe(candidates[i]).indexOf(start) === 0) return candidates[i];
      }
    }
    return null;
  }

  function visibleBox(node) {
    while (node && node !== document.body) {
      var r = node.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) return r;
      node = node.parentElement;
    }
    return null;
  }

  // Where a thread's pin goes, in page coordinates.
  function pinPoint(anchor) {
    var node = resolveAnchor(anchor);
    var r = node ? visibleBox(node) : null;
    if (r) {
      return {
        x: r.left + window.scrollX + r.width * (anchor.fx || 0),
        y: r.top + window.scrollY + r.height * (anchor.fy || 0),
        node: node,
        found: true
      };
    }
    var docH = document.documentElement.scrollHeight;
    return { x: 24, y: (anchor ? anchor.docY || 0 : 0) * docH, node: null, found: false };
  }

  // ── UI scaffolding ────────────────────────────────────────────────────────
  var ui = {};

  function buildUI() {
    document.body.classList.add('wvc-on');

    ui.pins = h('div', { class: 'wvc-ui wvc-pins', 'aria-hidden': 'true' });

    ui.count = h('span', { class: 'wvc-count', text: '0' });
    ui.toggleCount = h('span', { class: 'wvc-toggle-count', text: '0' });
    ui.identity = h('div', { class: 'wvc-identity' });
    ui.status = h('p', { class: 'wvc-status', role: 'status' });
    ui.list = h('ol', { class: 'wvc-list', 'aria-label': 'Comments, in page order' });
    ui.empty = h('div', { class: 'wvc-empty' }, [
      h('p', { class: 'wvc-empty-title', text: 'No comments yet' }),
      h('p', { text: 'Right-click any heading, sentence, button or picture on the page to leave the first one.' })
    ]);

    ui.panel = h('aside', { class: 'wvc-ui wvc-panel', id: 'wvc-panel', 'aria-label': 'Draft comments' }, [
      h('div', { class: 'wvc-head' }, [
        h('div', { class: 'wvc-title-row' }, [
          h('span', { class: 'wvc-badge', text: 'Draft' }),
          h('h2', { class: 'wvc-title' }, ['Comments ', ui.count])
        ]),
        h('button', { type: 'button', class: 'wvc-icon-btn wvc-close', 'aria-label': 'Close comments', onclick: function () { setPanel(false); } }, ['×'])
      ]),
      ui.identity,
      h('button', { type: 'button', class: 'wvc-add', onclick: startPicking }, ['+ Add comment']),
      h('p', { class: 'wvc-hint', text: 'Tip: right-click anything on the page to comment on it. Shift + right-click opens the normal browser menu.' }),
      ui.status,
      ui.empty,
      ui.list
    ]);

    ui.toggle = h('button', {
      type: 'button', class: 'wvc-ui wvc-toggle', 'aria-controls': 'wvc-panel',
      onclick: function () { setPanel(!state.panelOpen); }
    }, ['Comments ', ui.toggleCount]);

    ui.pickBar = h('div', { class: 'wvc-ui wvc-pickbar', role: 'status', hidden: true }, [
      h('span', { text: 'Click the part of the page you want to comment on.' }),
      h('button', { type: 'button', class: 'wvc-btn-quiet', onclick: stopPicking }, ['Cancel'])
    ]);

    // Composer for new comments
    ui.cTarget = h('p', { class: 'wvc-composer-target' });
    ui.cNameWrap = h('label', { class: 'wvc-field', for: 'wvc-composer-name' }, [
      h('span', { text: 'Your name (shown with your comments)' })
    ]);
    ui.cName = h('input', { id: 'wvc-composer-name', type: 'text', maxlength: String(MAX_NAME), autocomplete: 'name', placeholder: 'e.g. Gigi' });
    ui.cNameWrap.appendChild(ui.cName);
    ui.cText = h('textarea', { id: 'wvc-composer-text', rows: '4', maxlength: String(MAX_TEXT), placeholder: 'What do you think about this part?', 'aria-label': 'Comment' });
    ui.cError = h('p', { class: 'wvc-error', role: 'alert' });
    ui.cSubmit = h('button', { type: 'submit', class: 'wvc-btn' }, ['Post comment']);
    ui.composer = h('form', { class: 'wvc-ui wvc-composer', hidden: true, 'aria-label': 'New comment' }, [
      ui.cTarget, ui.cNameWrap, ui.cText, ui.cError,
      h('div', { class: 'wvc-actions-row' }, [
        h('span', { class: 'wvc-kbd', text: '⌘/Ctrl + Enter to post' }),
        h('button', { type: 'button', class: 'wvc-btn-quiet', onclick: closeComposer }, ['Cancel']),
        ui.cSubmit
      ])
    ]);
    ui.composer.addEventListener('submit', function (e) { e.preventDefault(); submitComposer(); });
    ui.cText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComposer(); }
    });

    ui.highlight = h('div', { class: 'wvc-ui wvc-highlight', 'aria-hidden': 'true', hidden: true });

    [ui.pins, ui.highlight, ui.panel, ui.toggle, ui.pickBar, ui.composer].forEach(function (n) { document.body.appendChild(n); });
  }

  function setPanel(open) {
    state.panelOpen = open;
    document.body.classList.toggle('wvc-panel-open', open);
    ui.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setStatus(status, text) {
    state.status = status;
    state.statusText = text || '';
    render();
  }

  // ── Picking a spot & composing ────────────────────────────────────────────
  var pending = null; // {node, anchor}

  function startPicking() {
    closeComposer();
    state.picking = true;
    document.body.classList.add('wvc-picking');
    ui.pickBar.hidden = false;
    if (window.matchMedia('(max-width: 1099px)').matches) setPanel(false);
  }

  function stopPicking() {
    state.picking = false;
    document.body.classList.remove('wvc-picking');
    ui.pickBar.hidden = true;
    hideHighlight();
  }

  function openComposer(node, clientX, clientY) {
    pending = { node: node, anchor: makeAnchor(node, clientX, clientY) };
    ui.cTarget.textContent = '';
    ui.cTarget.appendChild(h('span', { class: 'wvc-on-label', text: 'On ' }));
    ui.cTarget.appendChild(h('q', { text: pending.anchor.snippet }));
    ui.cNameWrap.hidden = !!state.name;
    ui.cName.value = state.name;
    ui.cError.textContent = '';
    ui.cText.value = '';
    ui.cSubmit.disabled = false;
    ui.composer.hidden = false;

    // Place it next to the click, kept inside the window.
    var w = ui.composer.offsetWidth, ht = ui.composer.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(12, clientX + 12), vw - w - 12);
    var top = Math.min(Math.max(12, clientY + 12), vh - ht - 12);
    ui.composer.style.left = Math.max(12, left) + 'px';
    ui.composer.style.top = Math.max(12, top) + 'px';
    showHighlight(node);
    (state.name ? ui.cText : ui.cName).focus();
  }

  function closeComposer() {
    pending = null;
    if (ui.composer) ui.composer.hidden = true;
    hideHighlight();
  }

  function submitComposer() {
    if (!pending) return;
    var name = squash(state.name || ui.cName.value).slice(0, MAX_NAME);
    var text = String(ui.cText.value || '').trim();
    if (!name) { ui.cError.textContent = 'Please add your name first.'; ui.cName.focus(); return; }
    if (!text) { ui.cError.textContent = 'Write a comment before posting.'; ui.cText.focus(); return; }
    if (!backend) { ui.cError.textContent = 'Still connecting to the comment service. Try again in a moment.'; return; }
    saveName(name);
    ui.cSubmit.disabled = true;
    var anchor = pending.anchor;
    backend.add({ name: name, text: text.slice(0, MAX_TEXT), parentId: null, anchor: anchor })
      .then(function () {
        closeComposer();
        setPanel(true);
      })
      .catch(function (e) {
        ui.cSubmit.disabled = false;
        ui.cError.textContent = friendlyError(e);
      });
  }

  function saveName(name) {
    state.name = name;
    storage.set(NAME_KEY, name);
  }

  // ── Highlight box around an element ───────────────────────────────────────
  function showHighlight(node) {
    var r = node && visibleBox(node);
    if (!r) { hideHighlight(); return; }
    ui.highlight.hidden = false;
    ui.highlight.style.left = (r.left + window.scrollX - 4) + 'px';
    ui.highlight.style.top = (r.top + window.scrollY - 4) + 'px';
    ui.highlight.style.width = (r.width + 8) + 'px';
    ui.highlight.style.height = (r.height + 8) + 'px';
  }
  function hideHighlight() { if (ui.highlight) ui.highlight.hidden = true; }

  // ── Page event wiring ─────────────────────────────────────────────────────
  function wireEvents() {
    document.addEventListener('contextmenu', function (e) {
      if (e.shiftKey || isOurs(e.target)) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      var sel = window.getSelection && String(window.getSelection());
      if (sel && sel.trim()) return; // keep Copy available for selected text
      var node = anchorElementFor(e.target);
      if (!node) return;
      e.preventDefault();
      stopPicking();
      openComposer(node, e.clientX, e.clientY);
    });

    // "Add comment" mode: the next click picks the spot.
    document.addEventListener('mousemove', function (e) {
      if (!state.picking) return;
      var node = anchorElementFor(e.target);
      if (node) showHighlight(node); else hideHighlight();
    });
    document.addEventListener('click', function (e) {
      if (!state.picking || isOurs(e.target)) return;
      var node = anchorElementFor(e.target);
      if (!node) return;
      e.preventDefault();
      e.stopPropagation();
      stopPicking();
      openComposer(node, e.clientX, e.clientY);
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (state.picking) stopPicking();
      else if (!ui.composer.hidden) closeComposer();
    });

    // Close the composer when clicking elsewhere on the page.
    document.addEventListener('mousedown', function (e) {
      if (!ui.composer.hidden && !isOurs(e.target) && !state.picking) {
        if (!String(ui.cText.value).trim()) closeComposer();
      }
    });

    var queued = false;
    function schedulePins() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; placePins(); });
    }
    window.addEventListener('scroll', schedulePins, { passive: true });
    window.addEventListener('resize', schedulePins);
    if (window.ResizeObserver) new ResizeObserver(schedulePins).observe(document.body);
    // Content that appears later (the map, step cards) moves things around.
    setInterval(placePins, 1500);
    // Keep "5 min ago" labels fresh.
    setInterval(render, 60000);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  function threads() {
    var byId = {};
    state.comments.forEach(function (c) { byId[c.id] = c; });
    var tops = state.comments.filter(function (c) { return !c.parentId; });
    var orphanParents = {};
    var replies = {};
    state.comments.forEach(function (c) {
      if (!c.parentId) return;
      (replies[c.parentId] = replies[c.parentId] || []).push(c);
      if (!byId[c.parentId]) orphanParents[c.parentId] = true;
    });
    // A deleted comment whose replies remain still shows as a thread.
    Object.keys(orphanParents).forEach(function (pid) {
      tops.push({ id: pid, deleted: true, anchor: null, createdAt: replies[pid][0].createdAt });
    });
    var list = tops.map(function (c) {
      var pt = pinPoint(c.anchor);
      var rs = (replies[c.id] || []).slice().sort(function (a, b) { return (a.createdAt || Infinity) - (b.createdAt || Infinity); });
      return { root: c, replies: rs, y: c.anchor ? pt.y : Infinity, x: pt.x, point: pt };
    });
    list.sort(function (a, b) { return (a.y - b.y) || ((a.root.createdAt || 0) - (b.root.createdAt || 0)); });
    return list;
  }

  function render() {
    if (!ui.panel) return;
    var all = threads();
    var total = state.comments.length;
    ui.count.textContent = String(total);
    ui.toggleCount.textContent = String(total);

    renderIdentity();

    // Connection status
    var statusText = '';
    if (state.status === 'local') statusText = 'Local preview: comments are saved in this browser only. Connect Firebase to share them.';
    else if (state.status === 'connecting') statusText = 'Connecting to shared comments…';
    else if (state.status === 'error') statusText = state.statusText;
    ui.status.textContent = statusText;
    ui.status.hidden = !statusText;
    ui.status.className = 'wvc-status' + (state.status === 'error' ? ' is-error' : '');

    ui.empty.hidden = all.length > 0 || state.status === 'connecting';

    // Remember focus inside the list so live updates don't steal it.
    var focusKey = document.activeElement && document.activeElement.getAttribute('data-wvc-key');

    ui.list.textContent = '';
    all.forEach(function (t, i) {
      ui.list.appendChild(renderThread(t, i + 1));
    });

    // Just clicked Edit: put the cursor in the edit box.
    if (state.focusEdit && state.editing) {
      state.focusEdit = false;
      focusKey = 'edit:' + state.editing;
    }
    if (focusKey) {
      var again = ui.list.querySelector('[data-wvc-key="' + focusKey + '"]');
      if (again) {
        again.focus();
        if (again.setSelectionRange) again.setSelectionRange(again.value.length, again.value.length);
      }
    }
    placePins(all);
  }

  function renderIdentity() {
    ui.identity.textContent = '';
    if (state.editingName) {
      var input = h('input', { id: 'wvc-identity-name', type: 'text', maxlength: String(MAX_NAME), value: state.name, 'aria-label': 'Your name' });
      var save = function () {
        var v = squash(input.value).slice(0, MAX_NAME);
        if (v) saveName(v);
        state.editingName = false;
        render();
      };
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { state.editingName = false; render(); }
      });
      ui.identity.appendChild(input);
      ui.identity.appendChild(h('button', { type: 'button', class: 'wvc-btn-small', onclick: save }, ['Save']));
      setTimeout(function () { input.focus(); input.select(); }, 0);
      return;
    }
    if (state.name) {
      ui.identity.appendChild(h('span', { text: 'Commenting as ' }));
      ui.identity.appendChild(h('b', { text: state.name }));
      ui.identity.appendChild(h('button', { type: 'button', class: 'wvc-link', onclick: function () { state.editingName = true; render(); } }, ['Change']));
    } else {
      ui.identity.appendChild(h('span', { text: 'You’ll add your name with your first comment.' }));
    }
  }

  function canChange(c) {
    return !!(c && !c.deleted && state.uid && c.uid === state.uid);
  }

  function renderComment(c, threadId, isReply) {
    var item = h('div', { class: 'wvc-comment' + (isReply ? ' is-reply' : '') });
    if (c.deleted) {
      item.appendChild(h('p', { class: 'wvc-deleted', text: 'This comment was deleted.' }));
      return item;
    }
    var meta = h('div', { class: 'wvc-meta' }, [
      h('span', { class: 'wvc-avatar', 'aria-hidden': 'true', text: (c.name || '?').charAt(0).toUpperCase() }),
      h('span', { class: 'wvc-name', text: c.name || 'Someone' }),
      h('span', { class: 'wvc-time', text: timeAgo(c.createdAt) + (c.editedAt ? ' · edited' : '') })
    ]);
    item.appendChild(meta);

    if (state.editing === c.id) {
      var key = 'edit:' + c.id;
      if (state.drafts[key] == null) state.drafts[key] = c.text;
      var ta = h('textarea', { class: 'wvc-inline-input', rows: '3', maxlength: String(MAX_TEXT), 'data-wvc-key': key, 'aria-label': 'Edit comment' });
      ta.value = state.drafts[key];
      ta.addEventListener('input', function () { state.drafts[key] = ta.value; });
      var err = h('p', { class: 'wvc-error', role: 'alert' });
      var saveEdit = function () {
        var text = String(ta.value).trim();
        if (!text) { err.textContent = 'A comment can’t be empty. Use Delete to remove it.'; return; }
        backend.update(c.id, text.slice(0, MAX_TEXT)).then(function () {
          delete state.drafts[key];
          state.editing = null;
          render();
        }).catch(function (e) { err.textContent = friendlyError(e); });
      };
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
        if (e.key === 'Escape') { e.stopPropagation(); delete state.drafts[key]; state.editing = null; render(); }
      });
      item.appendChild(ta);
      item.appendChild(err);
      item.appendChild(h('div', { class: 'wvc-actions-row' }, [
        h('button', { type: 'button', class: 'wvc-btn-quiet', onclick: function () { delete state.drafts[key]; state.editing = null; render(); } }, ['Cancel']),
        h('button', { type: 'button', class: 'wvc-btn', onclick: saveEdit }, ['Save'])
      ]));
      return item;
    }

    item.appendChild(h('p', { class: 'wvc-text', text: c.text }));

    var actions = h('div', { class: 'wvc-actions' });
    // Every comment can be answered. Replies stay in one thread; answering a
    // reply starts with "@Name" so it's clear who you're responding to.
    actions.appendChild(h('button', { type: 'button', class: 'wvc-link', onclick: function (e) {
      e.stopPropagation();
      var key = 'reply:' + threadId;
      if (isReply && c.name) {
        var mention = '@' + c.name + ' ';
        var current = state.drafts[key] || '';
        var previous = state.mentions[key];
        if (previous && current.indexOf(previous) === 0) current = current.slice(previous.length);
        state.mentions[key] = mention;
        state.drafts[key] = mention + current;
        state.replying = threadId;
      } else {
        state.replying = state.replying === threadId ? null : threadId;
      }
      state.active = threadId;
      state.focusReply = state.replying === threadId;
      render();
    } }, ['Reply']));
    if (canChange(c)) {
      if (state.confirmDelete === c.id) {
        actions.appendChild(h('span', { class: 'wvc-confirm', text: 'Delete this comment?' }));
        actions.appendChild(h('button', { type: 'button', class: 'wvc-link is-danger', onclick: function (e) {
          e.stopPropagation();
          backend.remove(c.id).then(function () { state.confirmDelete = null; render(); })
            .catch(function (er) { setStatus('error', friendlyError(er)); });
        } }, ['Yes, delete']));
        actions.appendChild(h('button', { type: 'button', class: 'wvc-link', onclick: function (e) { e.stopPropagation(); state.confirmDelete = null; render(); } }, ['Keep']));
      } else {
        actions.appendChild(h('button', { type: 'button', class: 'wvc-link', onclick: function (e) { e.stopPropagation(); state.editing = c.id; state.focusEdit = true; state.confirmDelete = null; render(); } }, ['Edit']));
        actions.appendChild(h('button', { type: 'button', class: 'wvc-link', onclick: function (e) { e.stopPropagation(); state.confirmDelete = c.id; render(); } }, ['Delete']));
      }
    }
    if (actions.childNodes.length) item.appendChild(actions);
    return item;
  }

  function renderThread(t, number) {
    var c = t.root;
    var li = h('li', {
      class: 'wvc-thread' + (state.active === c.id ? ' is-active' : ''),
      'data-thread': c.id
    });

    var head = h('button', {
      type: 'button', class: 'wvc-thread-head',
      title: t.point.found ? 'Show this spot on the page' : 'This part of the page has changed',
      onclick: function () { focusThread(c.id, true); }
    }, [
      h('span', { class: 'wvc-num', text: String(number) }),
      h('span', { class: 'wvc-snippet' }, c.anchor
        ? [h('q', { text: c.anchor.snippet }), t.point.found ? null : h('span', { class: 'wvc-moved', text: ' (moved or removed)' })]
        : [h('span', { text: 'Replies to a deleted comment' })])
    ]);
    li.appendChild(head);

    li.appendChild(renderComment(c, c.id, false));
    if (t.replies.length) {
      var rl = h('div', { class: 'wvc-replies' });
      t.replies.forEach(function (r) { rl.appendChild(renderComment(r, c.id, true)); });
      li.appendChild(rl);
    }

    if (state.replying === c.id) {
      var key = 'reply:' + c.id;
      var form = h('form', { class: 'wvc-reply-form' });
      var nameInput = null;
      if (!state.name) {
        nameInput = h('input', { type: 'text', class: 'wvc-inline-name', maxlength: String(MAX_NAME), placeholder: 'Your name', 'aria-label': 'Your name', 'data-wvc-key': key + ':name' });
        nameInput.value = state.drafts[key + ':name'] || '';
        nameInput.addEventListener('input', function () { state.drafts[key + ':name'] = nameInput.value; });
        form.appendChild(nameInput);
      }
      var ta = h('textarea', { class: 'wvc-inline-input', rows: '2', maxlength: String(MAX_TEXT), placeholder: 'Write a reply…', 'aria-label': 'Reply', 'data-wvc-key': key });
      ta.value = state.drafts[key] || '';
      ta.addEventListener('input', function () { state.drafts[key] = ta.value; });
      var err = h('p', { class: 'wvc-error', role: 'alert' });
      var send = function () {
        var name = squash(state.name || (nameInput && nameInput.value)).slice(0, MAX_NAME);
        var text = String(ta.value).trim();
        if (!name) { err.textContent = 'Please add your name first.'; if (nameInput) nameInput.focus(); return; }
        if (!text) { err.textContent = 'Write a reply before sending.'; ta.focus(); return; }
        saveName(name);
        backend.add({ name: name, text: text.slice(0, MAX_TEXT), parentId: c.id, anchor: null }).then(function () {
          delete state.drafts[key];
          state.replying = null;
          render();
        }).catch(function (e) { err.textContent = friendlyError(e); });
      };
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
        if (e.key === 'Escape') { e.stopPropagation(); state.replying = null; render(); }
      });
      form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
      form.appendChild(ta);
      form.appendChild(err);
      form.appendChild(h('div', { class: 'wvc-actions-row' }, [
        h('button', { type: 'button', class: 'wvc-btn-quiet', onclick: function () { state.replying = null; render(); } }, ['Cancel']),
        h('button', { type: 'submit', class: 'wvc-btn' }, ['Reply'])
      ]));
      li.appendChild(form);
      var focusNow = state.focusReply;
      state.focusReply = false;
      setTimeout(function () {
        var target = nameInput && !nameInput.value ? nameInput : ta;
        if (focusNow || !li.contains(document.activeElement)) {
          target.focus();
          if (target === ta) ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      }, 0);
    }
    return li;
  }

  function placePins(list) {
    if (!ui.pins) return;
    list = list || threads();
    ui.pins.textContent = '';
    list.forEach(function (t, i) {
      if (!t.root.anchor) return;
      var p = t.point = pinPoint(t.root.anchor);
      var pin = h('button', {
        type: 'button',
        class: 'wvc-pin' + (state.active === t.root.id ? ' is-active' : '') + (p.found ? '' : ' is-lost'),
        'aria-label': 'Comment ' + (i + 1),
        tabindex: '-1',
        text: String(i + 1),
        onclick: function (e) { e.stopPropagation(); focusThread(t.root.id, false); }
      });
      pin.style.left = Math.round(p.x) + 'px';
      pin.style.top = Math.round(p.y) + 'px';
      ui.pins.appendChild(pin);
    });
  }

  function focusThread(id, scrollPage) {
    state.active = id;
    render();
    var t = threads().filter(function (x) { return x.root.id === id; })[0];
    if (scrollPage && t && t.point.node) {
      if (window.matchMedia('(max-width: 1099px)').matches) setPanel(false);
      t.point.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { showHighlight(t.point.node); }, 350);
      setTimeout(hideHighlight, 2200);
    }
    if (!scrollPage) {
      setPanel(true);
      var card = ui.list.querySelector('[data-thread="' + CSS.escape(id) + '"]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function start() {
    buildUI();
    wireEvents();
    render();

    var onData = function (list) { state.comments = list; if (state.status === 'connecting') state.status = 'live'; render(); };

    if (!CONFIG) {
      backend = localBackend();
      state.uid = backend.uid();
      backend.subscribe(onData);
      return;
    }
    firebaseBackend().then(function (b) {
      backend = b;
      b.ready.catch(function (e) { setStatus('error', friendlyError(e)); });
      b.subscribe(onData, function (e) { setStatus('error', friendlyError(e)); });
    }).catch(function () {
      setStatus('error', 'Could not load the comment service. Check your connection and reload.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
