/* =========================================================
   Ask my AI: chat panel for the RAG assistant (github.com/harshilmayurpatel/ask-my-ai)
   window.AskAI = { open(question?, { send }), close(), available }
   ========================================================= */
(function () {
  "use strict";

  var script = document.currentScript;
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // The deployed Hugging Face Space URL lives on the script tag (data-api).
  // Until it's set, the feature stays hidden on the live site.
  var API = LOCAL ? "http://localhost:7860" : (script && script.getAttribute("data-api")) || "";
  var MAX_LEN = 400;
  var SUGGEST = [
    "What has he built with AI?",
    "Tell me about his experience",
    "Which cloud tools does he use?",
    "Where did he study?",
    "What roles is he looking for?",
    "What's his strongest project?"
  ];

  var fab = document.getElementById("askFab");
  if (!fab) return;
  if (!API) { fab.hidden = true; window.AskAI = { available: false, open: function () {}, close: function () {} }; return; }
  fab.hidden = false;

  var panel, log, form, input, sendBtn, statusEl, chipsEl;
  var history = [];          // [{role, content}] sent back for follow-ups
  var busy = false, ctrl = null, health = "unknown", lastFocus = null;

  /* ---------- Helpers ---------- */
  function esc(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Escape first, then turn emails and known links into anchors
  function format(text) {
    var h = esc(text.trim());
    h = h.replace(/\b([\w.+-]+@[\w-]+\.[\w.]+)\b/g, '<a href="mailto:$1">$1</a>');
    h = h.replace(/\b((?:https?:\/\/)?(?:www\.)?(?:github\.com|linkedin\.com|harshilmayurpatel\.github\.io)(?:\/[\w\-./#?=&%]*)?)/g,
      function (m) {
        var clean = m.replace(/[.,]+$/, ""), tail = m.slice(clean.length);
        var href = /^https?:/.test(clean) ? clean : "https://" + clean;
        return '<a href="' + href + '" target="_blank" rel="noopener">' + clean + "</a>" + tail;
      });
    return h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  }
  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function setStatus(state, text) {
    health = state;
    statusEl.className = "ai-status is-" + state;
    statusEl.lastChild.textContent = text;
  }

  /* ---------- Build the panel once ---------- */
  function build() {
    panel = document.createElement("section");
    panel.className = "ai-panel";
    panel.id = "aiPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "aiTitle");
    panel.innerHTML =
      '<header class="ai-head">' +
        '<span class="ai-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l1.9 4.8L18.7 9.7 13.9 11.6 12 16.4 10.1 11.6 5.3 9.7 10.1 7.8z" fill="currentColor"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor" opacity=".6"/></svg></span>' +
        '<div class="ai-titles"><h2 id="aiTitle">Ask my AI</h2>' +
          '<p class="ai-status is-unknown" id="aiStatus"><i aria-hidden="true"></i><span>Connecting…</span></p></div>' +
        '<button class="ai-close" type="button" aria-label="Close chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>' +
      "</header>" +
      '<div class="ai-log" id="aiLog" aria-live="polite">' +
        '<div class="ai-msg bot"><div class="ai-bubble">Hi! I\'m Harshil\'s AI assistant. Ask me about his projects, skills, education, or experience.</div></div>' +
        '<div class="ai-chips" id="aiChips"></div>' +
      "</div>" +
      '<form class="ai-form" autocomplete="off">' +
        '<input class="ai-input" type="text" maxlength="' + MAX_LEN + '" placeholder="Ask about Harshil…" aria-label="Your question" enterkeyhint="send" />' +
        '<button class="ai-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      "</form>" +
      '<p class="ai-note">Answers come from Harshil\'s resume and notes · Llama 3.3 · can make mistakes</p>';
    document.body.appendChild(panel);

    log = panel.querySelector(".ai-log");
    form = panel.querySelector(".ai-form");
    input = panel.querySelector(".ai-input");
    sendBtn = panel.querySelector(".ai-send");
    statusEl = panel.querySelector(".ai-status");
    chipsEl = panel.querySelector(".ai-chips");

    SUGGEST.slice(0, 3).forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "ai-chip"; b.textContent = q;
      b.addEventListener("click", function () { ask(q); });
      chipsEl.appendChild(b);
    });

    panel.querySelector(".ai-close").addEventListener("click", close);
    form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }

  /* ---------- Wake the Space (free Spaces sleep when idle) ---------- */
  function ping() {
    if (health === "online" || health === "waking") return;
    setStatus("waking", "Connecting…");
    var slow = setTimeout(function () {
      if (health === "waking") setStatus("waking", "Waking up the AI · about 30s");
    }, 1800);
    var t0 = Date.now();
    (function attempt() {
      fetch(API + "/health", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (j) {
          clearTimeout(slow);
          setStatus("online", j.model ? "Online" : "Online · limited mode");
        })
        .catch(function () {
          // A sleeping Space answers with errors while it boots: keep trying for ~90s
          if (Date.now() - t0 < 90000) setTimeout(attempt, 3000);
          else { clearTimeout(slow); setStatus("offline", "Offline right now"); }
        });
    })();
  }

  /* ---------- Messages ---------- */
  function addMsg(role, html) {
    var m = document.createElement("div");
    m.className = "ai-msg " + role;
    m.innerHTML = '<div class="ai-bubble">' + html + "</div>";
    log.appendChild(m);
    scrollDown();
    return m;
  }

  function ask(raw) {
    var q = (raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
    if (!q || busy) return;
    input.value = "";
    if (chipsEl) { chipsEl.remove(); chipsEl = null; }
    addMsg("user", esc(q));
    var bot = addMsg("bot is-typing", '<span class="ai-dots"><i></i><i></i><i></i></span>');
    var bubble = bot.querySelector(".ai-bubble");
    busy = true; sendBtn.disabled = true;

    var answer = "";
    ctrl = window.AbortController ? new AbortController() : null;
    var timeout = setTimeout(function () { if (ctrl) ctrl.abort(); }, 100000);

    fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, history: history.slice(-6) }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (res.status === 429) throw new Error("rate");
      if (!res.ok || !res.body) throw new Error("http " + res.status);
      if (health !== "online") setStatus("online", "Online");
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split("\n\n");
          buf = parts.pop();
          parts.forEach(function (p) {
            if (p.indexOf("data:") !== 0) return;
            var ev; try { ev = JSON.parse(p.slice(5)); } catch (e) { return; }
            if (ev.t) {
              answer += ev.t;
              bot.classList.remove("is-typing");
              bubble.innerHTML = format(answer);
              scrollDown();
            }
            if (ev.done && ev.sources && ev.sources.length) {
              var s = document.createElement("p");
              s.className = "ai-src";
              s.textContent = "From: " + ev.sources.slice(0, 3).join(" · ");
              bot.appendChild(s);
            }
          });
          return pump();
        });
      })();
    }).then(function () {
      if (!answer) throw new Error("empty");
      history.push({ role: "user", content: q }, { role: "assistant", content: answer.slice(0, 1500) });
    }).catch(function (err) {
      bot.classList.remove("is-typing");
      bot.classList.add("is-error");
      var msg = String(err && err.message) === "rate"
        ? "You're asking quickly! Give it a minute and try again."
        : "I couldn't reach the AI just now. You can email Harshil at harshilpatel.co@gmail.com.";
      bubble.innerHTML = format(answer ? answer + "\n\n(" + msg + ")" : msg);
      if (String(err && err.message) !== "rate" && !answer) setStatus("offline", "Offline right now");
    }).then(function () {
      clearTimeout(timeout);
      busy = false; sendBtn.disabled = false; ctrl = null;
      scrollDown();
      if (panel.classList.contains("open") && !matchMedia("(pointer: coarse)").matches) input.focus();
    });
  }

  /* ---------- Open / close ---------- */
  function open(question, opts) {
    if (!panel) build();
    if (!panel.classList.contains("open")) {
      lastFocus = document.activeElement;
      panel.classList.add("open");
      document.body.classList.add("ai-open");
      fab.setAttribute("aria-expanded", "true");
      ping();
    }
    if (question && opts && opts.send) ask(question);
    else if (question) input.value = question;
    // Don't pop the keyboard on phones unless the visitor taps the field
    if (!matchMedia("(pointer: coarse)").matches) setTimeout(function () { input.focus(); }, 60);
  }

  function close() {
    if (!panel || !panel.classList.contains("open")) return;
    panel.classList.remove("open");
    document.body.classList.remove("ai-open");
    fab.setAttribute("aria-expanded", "false");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  fab.addEventListener("click", function () {
    if (panel && panel.classList.contains("open")) close(); else open();
  });

  // Mic helper: what did the visitor mean? Resolves to an action id
  // ("dark", "projects", "ask", "none", …) or null if the API is unreachable.
  function intent(text) {
    var c = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, 6000);
    return fetch(API + "/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text).slice(0, 200) }),
      signal: c ? c.signal : undefined
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.action ? j.action : null; })
      .catch(function () { return null; })
      .then(function (a) { clearTimeout(t); return a; });
  }

  function isOpen() { return !!(panel && panel.classList.contains("open")); }

  window.AskAI = { available: true, open: open, close: close, intent: intent, isOpen: isOpen };
})();
