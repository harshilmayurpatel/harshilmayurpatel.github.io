(function () {
  "use strict";

  /* ---------- Mobile nav ---------- */
  var menuBtn = document.getElementById("menuBtn");
  var mobileNav = document.getElementById("mobileNav");

  function closeMobileNav() {
    mobileNav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.classList.remove("is-open");
  }

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", function () {
      var isOpen = mobileNav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMobileNav);
    });
  }

  /* ---------- Resume dropdown ---------- */
  var resumeBtn = document.getElementById("resumeBtn");
  var resumeMenu = document.getElementById("resumeMenu");

  if (resumeBtn && resumeMenu) {
    resumeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      resumeMenu.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (!resumeMenu.contains(e.target) && e.target !== resumeBtn) {
        resumeMenu.classList.remove("open");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        resumeMenu.classList.remove("open");
        closeMobileNav();
      }
    });
  }

  /* ---------- Pipeline rail: scroll-synced line + ring per stage ----------
     Each stage "owns" the scroll range from where its section starts to
     where the next one starts. Progress through that range:
       - draws a ring around that stage's ball, and
       - fills the line from that ball toward the next one.
     Positions are measured from the real ball centers, so the line always
     meets the balls exactly. */
  var rail = document.getElementById("rail");
  var railLine = rail ? rail.querySelector(".rail-line") : null;
  var railProgress = document.getElementById("railProgress");
  var railNodes = Array.prototype.slice.call(document.querySelectorAll(".rail-node"));
  var SVG_NS = "http://www.w3.org/2000/svg";
  var TRIGGER = 0.4; // a section "starts" when its top reaches 40% down the viewport

  var rings = railNodes.map(function (node) {
    var num = node.querySelector(".rail-num");
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "rail-ring");
    svg.setAttribute("viewBox", "0 0 40 40");
    svg.setAttribute("aria-hidden", "true");
    ["ring-track", "ring-fill"].forEach(function (cls) {
      var c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("class", cls);
      c.setAttribute("cx", "20");
      c.setAttribute("cy", "20");
      c.setAttribute("r", "17");
      c.setAttribute("pathLength", "100");
      svg.appendChild(c);
    });
    num.appendChild(svg);
    return svg.querySelector(".ring-fill");
  });

  var sections = railNodes.map(function (node) {
    return document.getElementById(node.getAttribute("data-section"));
  });

  var centers = []; // ball centers, px from top of the rail
  var anchors = []; // scroll positions where each stage starts (+ the end)

  function measure() {
    if (!rail || !railNodes.length) return;
    var railTop = rail.getBoundingClientRect().top;
    centers = railNodes.map(function (node) {
      var r = node.querySelector(".rail-num").getBoundingClientRect();
      return r.top + r.height / 2 - railTop;
    });
    var first = centers[0];
    var last = centers[centers.length - 1];
    [railLine, railProgress].forEach(function (el) {
      if (el) el.style.top = first + "px";
    });
    if (railLine) railLine.style.height = last - first + "px";

    var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var prev = 0;
    anchors = sections.map(function (sec) {
      var top = sec ? sec.getBoundingClientRect().top + window.scrollY : prev;
      var a = Math.min(Math.max(top - window.innerHeight * TRIGGER, prev), maxScroll - 1);
      prev = a;
      return a;
    });
    anchors.push(maxScroll); // the last stage completes at the bottom of the page
  }

  function updateRail() {
    if (!anchors.length) return;
    var y = window.scrollY;
    var n = railNodes.length;

    railNodes.forEach(function (node, i) {
      var start = anchors[i];
      var end = anchors[i + 1];
      var frac = end > start ? (y - start) / (end - start) : y >= end ? 1 : 0;
      frac = Math.min(1, Math.max(0, frac));
      var isLast = i === n - 1;
      var done = !isLast && y >= end; // moved on to a later stage

      rings[i].style.strokeDashoffset = String(100 - frac * 100);
      // Pulse once when this stage's ring closes
      var closed = done || (isLast && frac >= 1);
      if (railReady && closed && !node.classList.contains("done") && !node.classList.contains("complete")) {
        var numEl = node.querySelector(".rail-num");
        numEl.classList.remove("pulse");
        void numEl.offsetWidth; // restart the animation
        numEl.classList.add("pulse");
        setTimeout(function () { numEl.classList.remove("pulse"); }, 750);
      }
      node.classList.toggle("active", y >= start && !done);
      node.classList.toggle("done", done);
      node.classList.toggle("complete", isLast && frac >= 1);
    });
    // Before the first stage starts, keep stage 01 highlighted
    if (y < anchors[0]) railNodes[0].classList.add("active");

    // Line: from ball i toward ball i+1 by progress through stage i
    var fill = 0;
    for (var i = 0; i < n - 1; i++) {
      var s = anchors[i], e = anchors[i + 1];
      var f = e > s ? Math.min(1, Math.max(0, (y - s) / (e - s))) : y >= e ? 1 : 0;
      fill += (centers[i + 1] - centers[i]) * f;
    }
    if (railProgress) railProgress.style.height = fill + "px";
  }

  var ticking = false;
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        updateRail();
        ticking = false;
      });
      ticking = true;
    }
  }
  function refresh() {
    measure();
    updateRail();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh); // images/fonts change section heights
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  var railReady = false; // no pulses for stages already passed on page load
  refresh();
  railReady = true;

  /* ---------- Reveal on scroll ---------- */
  var revealSelectors = [
    ".edu-card",
    ".timeline-item",
    ".project-card",
    ".mini-card",
    ".skill-card",
    ".deploy-card",
    ".cert-block",
  ];
  var revealEls = document.querySelectorAll(revealSelectors.join(","));

  if ("IntersectionObserver" in window && revealEls.length) {
    revealEls.forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i % 6, 5) * 60 + "ms";
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach(function (el) {
      io.observe(el);
    });
  }

  /* =========================================================
     Interactive upgrades
     ========================================================= */
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;

  function onceVisible(el, cb, threshold) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { cb(); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { obs.disconnect(); cb(); }
      });
    }, { threshold: threshold || 0.3 });
    obs.observe(el);
  }

  /* ---------- Theme toggle ---------- */
  var themeBtn = document.getElementById("themeToggle");
  function syncThemeLabel() {
    if (!themeBtn) return;
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  if (themeBtn) {
    var root = document.documentElement;
    var switching = false;

    var applyTheme = function (next) {
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      syncThemeLabel();
    };

    syncThemeLabel();
    themeBtn.setAttribute("data-haptic-own", "");
    themeBtn.addEventListener("click", function () {
      if (switching) return;
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

      haptic("toggle");
      // Replace (don't queue) so the island always matches the current theme
      setTimeout(function () {
        notify(next === "dark"
          ? { icon: "moon", tone: "info", text: "Dark mode on", dur: 1800 }
          : { icon: "sun", tone: "info", text: "Light mode on", dur: 1800 }, { replace: true });
      }, 180);

      if (reduceMotion) {
        applyTheme(next);
        return;
      }

      switching = true;
      if (document.startViewTransition) {
        // Double ripple from the button's center, sized to reach the far corner
        var r = themeBtn.getBoundingClientRect();
        var x = r.left + r.width / 2;
        var y = r.top + r.height / 2;
        var R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.style.setProperty("--vt-x", x + "px");
        root.style.setProperty("--vt-y", y + "px");
        root.style.setProperty("--vt-R", Math.ceil(R) + "px");

        // Clear any ring layer left from a quick previous switch: two elements
        // with the same view-transition-name would abort the transition
        Array.prototype.forEach.call(document.querySelectorAll(".ripple-layer"), function (el) {
          el.remove();
        });

        root.classList.add("theme-switching");
        var layer;
        var vt = document.startViewTransition(function () {
          applyTheme(next);
          // Rings are added with the new theme so they draw in its colors,
          // in their own transition layer above the page snapshots
          layer = document.createElement("div");
          layer.className = "ripple-layer";
          layer.setAttribute("aria-hidden", "true");
          layer.innerHTML =
            '<span class="ripple-ring ripple-spark"></span>' +
            '<span class="ripple-ring ripple-edge"></span>' +
            '<span class="ripple-ring ripple-echo"></span>';
          document.body.appendChild(layer);
        });
        var finish = function () {
          root.classList.remove("theme-switching");
          switching = false;
          // Release the transition name now, let the echo ring finish fading, then clean up
          if (layer) {
            layer.style.viewTransitionName = "none";
            var oldLayer = layer;
            setTimeout(function () { oldLayer.remove(); }, 250);
          }
        };
        vt.finished.then(finish, finish);
      } else {
        // Older browsers: everything crossfades together
        root.classList.add("theme-fade");
        applyTheme(next);
        setTimeout(function () {
          root.classList.remove("theme-fade");
          switching = false;
        }, 550);
      }
    });
  }

  /* ---------- Hero: typing tagline ---------- */
  var typeEl = document.querySelector("[data-type]");
  if (typeEl && !reduceMotion) {
    var full = typeEl.textContent;
    typeEl.setAttribute("aria-label", full);
    typeEl.textContent = "";
    typeEl.classList.add("typing");
    var ti = 0;
    setTimeout(function step() {
      ti++;
      typeEl.textContent = full.slice(0, ti);
      if (ti < full.length) {
        setTimeout(step, full.charAt(ti - 1) === "·" ? 180 : 38);
      } else {
        typeEl.classList.remove("typing");
        typeEl.classList.add("typed");
      }
    }, 350);
  }

  /* ---------- Hero: photo tilts toward the cursor ---------- */
  var frame = document.querySelector(".photo-frame");
  if (frame && finePointer && !reduceMotion) {
    frame.addEventListener("mousemove", function (e) {
      var r = frame.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      frame.classList.add("tilting");
      frame.style.setProperty("--ry", (px * 10).toFixed(2) + "deg");
      frame.style.setProperty("--rx", (-py * 10).toFixed(2) + "deg");
    });
    frame.addEventListener("mouseleave", function () {
      frame.classList.remove("tilting");
      frame.style.setProperty("--rx", "0deg");
      frame.style.setProperty("--ry", "0deg");
    });
  }

  /* ---------- Ingest: bio decodes from raw CSV into clean text ---------- */
  var decodeEl = document.querySelector("[data-decode]");
  if (decodeEl && !reduceMotion) {
    var clean = decodeEl.textContent.replace(/\s+/g, " ").trim();
    var RAW = "0123456789,,,;;||__\"\"";
    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = clean;
    var shown = document.createElement("span");
    shown.setAttribute("aria-hidden", "true");
    var cleanPart = document.createElement("span");
    var raw = document.createElement("span");
    raw.className = "decode-raw";
    shown.appendChild(cleanPart);
    shown.appendChild(raw);
    decodeEl.textContent = "";
    decodeEl.appendChild(sr);
    decodeEl.appendChild(shown);

    function scramble(n) {
      var s = "";
      for (var k = 0; k < n; k++) {
        var ch = clean.charAt(clean.length - n + k);
        s += ch === " " ? (k % 7 === 0 ? "," : " ") : RAW.charAt((Math.random() * RAW.length) | 0);
      }
      return s;
    }
    raw.textContent = scramble(clean.length);
    onceVisible(decodeEl, function () {
      var start = performance.now();
      var DURATION = 1600;
      (function frameStep(now) {
        var t = Math.min(1, (now - start) / DURATION);
        var cut = Math.floor(clean.length * (1 - Math.pow(1 - t, 2)));
        cleanPart.textContent = clean.slice(0, cut);
        raw.textContent = t < 1 ? scramble(Math.min(clean.length - cut, 120)) : "";
        if (t < 1) requestAnimationFrame(frameStep);
      })(start);
    }, 0.35);
  }

  /* ---------- Count-up numbers ---------- */
  Array.prototype.forEach.call(document.querySelectorAll(".count"), function (el) {
    var to = parseFloat(el.getAttribute("data-to"));
    var dec = parseInt(el.getAttribute("data-dec") || "0", 10);
    if (isNaN(to) || reduceMotion) return;
    el.textContent = (0).toFixed(dec);
    onceVisible(el, function () {
      var start = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - start) / 1200);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (to * eased).toFixed(dec);
        if (t < 1) requestAnimationFrame(step);
      })(start);
    }, 0.6);
  });

  /* ---------- Build: card spotlight follows the cursor ---------- */
  if (finePointer) {
    Array.prototype.forEach.call(document.querySelectorAll(".project-card"), function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - r.left + "px");
        card.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });
  }

  /* ---------- Stack: skill filter ---------- */
  var filterBtns = document.querySelectorAll(".filter-btn");
  var skillGrid = document.querySelector(".skill-grid");
  Array.prototype.forEach.call(filterBtns, function (btn) {
    btn.setAttribute("data-haptic-own", "");
    btn.addEventListener("click", function () {
      haptic("toggle");
      var f = btn.getAttribute("data-filter");
      Array.prototype.forEach.call(filterBtns, function (b) {
        var on = b === btn;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      skillGrid.classList.toggle("filtering", f !== "all");
      Array.prototype.forEach.call(skillGrid.querySelectorAll(".skill-card"), function (card) {
        card.classList.toggle("match", f !== "all" && card.getAttribute("data-group") === f);
      });
    });
  });

  /* ---------- Deploy: terminal types a deploy log ---------- */
  var term = document.getElementById("terminalBody");
  if (term) {
    var LINES = [
      ["$ ", "git push origin harshil", ""],
      ["", "✓ tests passed  ·  data → model → API", "t-ok"],
      ["", "✓ container built  ·  docker + fastapi", "t-ok"],
      ["", "→ deployed: ready to join your team", "t-acc"],
    ];
    var renderAll = function () {
      term.innerHTML = "";
      LINES.forEach(function (l) {
        var line = document.createElement("div");
        var span = document.createElement("span");
        if (l[2]) span.className = l[2];
        span.textContent = l[0] + l[1];
        line.appendChild(span);
        term.appendChild(line);
      });
    };
    if (reduceMotion) {
      renderAll();
    } else {
      onceVisible(term, function () {
        var li = 0;
        var cursor = document.createElement("span");
        cursor.className = "t-cur";
        (function nextLine() {
          if (li >= LINES.length) { term.appendChild(cursor); return; }
          var l = LINES[li++];
          var line = document.createElement("div");
          var span = document.createElement("span");
          if (l[2]) span.className = l[2];
          line.appendChild(span);
          line.appendChild(cursor);
          term.appendChild(line);
          var text = l[0] + l[1];
          var ci = 0;
          var typed = l[0] === "$ "; // only the command is "typed"; output appears faster
          (function typeChar() {
            ci += typed ? 1 : 3;
            span.textContent = text.slice(0, ci);
            if (ci < text.length) setTimeout(typeChar, typed ? 45 : 12);
            else setTimeout(nextLine, typed ? 380 : 260);
          })();
        })();
      }, 0.5);
    }
  }

  /* =========================================================
     Haptics — Android: Vibration API. iPhone (Safari 18+): toggling a
     native <input switch> plays a system haptic tick. Only ever fired
     from a user's own tap.
     ========================================================= */
  var hapticInput = document.querySelector(".haptic-switch input");
  // Android motors need ~20ms+ to be felt at all; very short pulses are silently lost
  var HAPTIC = {
    tap: [22], toggle: [32], success: [26, 70, 38], error: [55, 60, 55],
    celebrate: [30, 60, 30, 60, 70]
  };
  function haptic(kind) {
    var pattern = HAPTIC[kind] || HAPTIC.tap;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
      return;
    }
    if (hapticInput) {
      // One tick per pulse in the pattern (every other entry is a pause)
      var pulses = Math.ceil(pattern.length / 2);
      for (var p = 0; p < pulses; p++) {
        setTimeout(function () { hapticInput.parentNode.click(); }, p * 70);
      }
    }
  }
  // A light tick on any tap on touch screens: buttons, links, cards, text,
  // anywhere. Fired on pointerup, which Chrome counts as a real tap ("user
  // activation") and allows vibration from. Scrolls and long presses don't
  // count: the finger must stay put (<10px) and lift within 450ms.
  var tapStart = null;
  document.addEventListener("pointerdown", function (e) {
    tapStart = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
  }, { passive: true });
  document.addEventListener("pointercancel", function () { tapStart = null; }, { passive: true });
  document.addEventListener("pointerup", function (e) {
    if (e.pointerType !== "touch" || !tapStart) return;
    var moved = Math.abs(e.clientX - tapStart.x) + Math.abs(e.clientY - tapStart.y);
    var quick = e.timeStamp - tapStart.t < 450;
    tapStart = null;
    if (moved > 10 || !quick) return;
    var own = e.target.closest("[data-haptic-own]");
    if (!own) haptic("tap"); // controls with their own pattern play that instead
  }, { passive: true });

  /* =========================================================
     Dynamic Island — queue of short messages in a morphing pill
     ========================================================= */
  var ICONS = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="8.6" y="2.6" width="6.8" height="11.6" rx="3.4" fill="currentColor"/><path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.6v3.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M12 5v14m0 0l-5-5m5 5l5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z" fill="currentColor"/></svg>',
    help: '<svg viewBox="0 0 24 24"><path d="M9.2 9a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.4 1.1-1.4 2.1M12 17.2h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var islandEl = document.getElementById("island");
  var islandInner = document.getElementById("islandInner");
  var islandIcon = document.getElementById("islandIcon");
  var islandText = document.getElementById("islandText");
  var islandQueue = [];
  var islandBusy = false;
  var islandHideTimer = null;
  var islandSticky = null; // a persistent state (e.g. listening) that messages return to

  function islandRender(msg) {
    islandEl.setAttribute("data-tone", msg.tone || "info");
    islandEl.classList.toggle("tall", !!msg.tall);
    islandEl.classList.toggle("listening", !!msg.listening);
    islandIcon.innerHTML = ICONS[msg.icon] || ICONS.spark;
    if (msg.html) islandText.innerHTML = msg.html; else islandText.textContent = msg.text || "";
    // Measure the content so the pill can spring to its exact size
    var w = Math.min(islandInner.scrollWidth, window.innerWidth - 24);
    var h = Math.max(32, islandInner.scrollHeight);
    islandEl.style.setProperty("--iw", Math.ceil(w) + "px");
    islandEl.style.setProperty("--ih", Math.ceil(h) + "px");
  }

  function islandShowNext() {
    if (!islandQueue.length) {
      islandBusy = false;
      if (islandSticky) { swapTo(islandSticky); return; }
      islandEl.classList.remove("show", "listening", "hearing");
      islandEl.style.setProperty("--iw", "32px");
      islandEl.style.setProperty("--ih", "32px");
      return;
    }
    islandBusy = true;
    var msg = islandQueue.shift();
    swapTo(msg);
    clearTimeout(islandHideTimer);
    islandHideTimer = setTimeout(islandShowNext, msg.dur || 2200);
  }

  function swapTo(msg) {
    if (islandEl.classList.contains("show")) {
      // Content blurs out, pill springs to the new size, content blurs in
      islandEl.classList.add("swap");
      setTimeout(function () {
        islandRender(msg);
        islandEl.classList.remove("swap");
      }, 170);
    } else {
      islandRender(msg);
      void islandEl.offsetWidth;
      islandEl.classList.add("show");
    }
  }

  // notify({ icon, text|html, tone, dur, tall, listening }, { queue })
  // The newest event replaces whatever is showing (the pill morphs from it),
  // so the island always reflects the current state. Pass { queue: true }
  // to wait for the current message instead.
  function notify(msg, opts) {
    if (!islandEl) return;
    // The celebration card sits in the same top-center spot: a new
    // notification means the visitor moved on, so the card steps aside
    if (window.Celebrate && document.querySelector(".cc-wrap")) window.Celebrate.close();
    var queue = opts && opts.queue;
    if (!queue) islandQueue = [];
    islandQueue.push(msg);
    if (!islandBusy || !queue) {
      clearTimeout(islandHideTimer);
      islandShowNext();
    }
  }
  function islandSetSticky(msg) {
    islandSticky = msg;
    if (msg && !islandBusy) swapTo(msg);
    if (!msg && !islandBusy) islandShowNext();
  }

  /* ---------- Copy email ---------- */
  var copyBtn = document.getElementById("copyEmail");
  if (copyBtn) {
    copyBtn.setAttribute("data-haptic-own", "");
    copyBtn.addEventListener("click", function () {
      var email = copyBtn.getAttribute("data-email");
      var ok = function () {
        haptic("success");
        notify({ icon: "check", tone: "ok", text: "Email copied" });
      };
      var fail = function () {
        notify({ icon: "alert", tone: "warn", html: "Couldn't copy<small>" + email + "</small>", dur: 3000 });
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(ok, fail);
      } else {
        fail();
      }
    });
  }

  /* ---------- Resume links ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('a[href$=".pdf"]'), function (a) {
    a.addEventListener("click", function () {
      var dl = a.hasAttribute("download");
      notify({ icon: dl ? "down" : "link", tone: "ok", text: dl ? "Resume downloading" : "Opening resume" });
    });
  });

  /* =========================================================
     Voice navigation — push-to-talk with the Web Speech API
     ========================================================= */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var micWrap = document.getElementById("micWrap");
  var micBtn = document.getElementById("micBtn");
  var micTipText = document.getElementById("micTipText");

  function currentSection() {
    var active = document.querySelector(".rail-node.active");
    return active ? active.getAttribute("data-section") : "top";
  }
  function goTo(id, label) {
    var el = id === "top" ? document.body : document.getElementById(id);
    if (!el) return;
    if (id === "top") window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    else el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    notify({ icon: "arrow", tone: "ok", text: label });
  }
  function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }

  // Each command: patterns to match, a label for suggestions, and the action
  var COMMANDS = [
    { re: /\b(dark|night|black)\b|go dark|lights? off/, say: "dark mode",
      when: function () { return !isDark(); },
      run: function () { if (!isDark()) themeBtn.click(); else notify({ icon: "moon", tone: "info", text: "Already in dark mode" }); } },
    { re: /\b(light|day|white|bright)\b|go light|lights? on/, say: "light mode",
      when: function () { return isDark(); },
      run: function () { if (isDark()) themeBtn.click(); else notify({ icon: "sun", tone: "info", text: "Already in light mode" }); } },
    { re: /project|work|built|build|portfolio|show (me )?(your )?stuff/, say: "show projects",
      when: function () { return currentSection() !== "build"; },
      run: function () { goTo("build", "Showing projects"); } },
    { re: /experience|job|intern|history|career|process/, say: "show experience",
      when: function () { return currentSection() !== "process"; },
      run: function () { goTo("process", "Showing experience"); } },
    { re: /skill|stack|tech|tools?\b|language/, say: "show skills",
      when: function () { return currentSection() !== "stack"; },
      run: function () { goTo("stack", "Showing skills"); } },
    { re: /about|education|degree|who is|background|ingest/, say: "about Harshil",
      when: function () { return currentSection() !== "ingest"; },
      run: function () { goTo("ingest", "About Harshil"); } },
    { re: /contact|hire|reach|get in touch|talk|deploy|email me/, say: "contact",
      when: function () { return currentSection() !== "deploy"; },
      run: function () { goTo("deploy", "Let's talk"); } },
    { re: /resume|cv|curriculum/, say: "download resume",
      when: function () { return true; },
      run: function () {
        var a = document.querySelector('a[download][href$=".pdf"]');
        if (a) a.click();
      } },
    { re: /copy.*(mail|email)|(mail|email).*copy/, say: "copy email",
      when: function () { return true; },
      run: function () { if (copyBtn) copyBtn.click(); } },
    { re: /github|git hub|code/, say: "open GitHub",
      when: function () { return true; },
      run: function () { notify({ icon: "link", tone: "ok", text: "Opening GitHub" }); window.open("https://github.com/harshilmayurpatel", "_blank", "noopener"); } },
    { re: /linked ?in/, say: "open LinkedIn",
      when: function () { return true; },
      run: function () { notify({ icon: "link", tone: "ok", text: "Opening LinkedIn" }); window.open("https://www.linkedin.com/in/harshilmayurpatel", "_blank", "noopener"); } },
    { re: /\btop\b|scroll up|go up|home|beginning|start/, say: "go to top",
      when: function () { return window.scrollY > 400; },
      run: function () { goTo("top", "Back to top"); } },
    { re: /surprise|hello|hi there|hey|party|celebrate/, say: "surprise me",
      when: function () { return true; },
      run: function () { surprise(); } },
    { re: /help|what can i (say|do)|commands|options/, say: "help",
      when: function () { return true; },
      run: function () { showHelp(); } }
  ];

  function showHelp() {
    notify({
      icon: "help", tone: "info", tall: true, dur: 6500,
      html: "Things you can say" +
        '<span class="cmd-list"><span>dark / light mode</span><span>show projects</span>' +
        "<span>show skills</span><span>show experience</span><span>about Harshil</span>" +
        "<span>contact</span><span>download resume</span><span>copy email</span>" +
        "<span>open GitHub</span><span>surprise me</span></span>" +
        "<small>Speech is processed by your browser's speech service.</small>"
    }, { replace: true });
  }

  function suggestions() {
    var list = COMMANDS.filter(function (c) { return c.say !== "help" && c.when(); }).map(function (c) { return c.say; });
    return list.length ? list : ["show projects"];
  }

  if (SR && micWrap && micBtn) {
    micWrap.hidden = false;
    micBtn.setAttribute("data-haptic-own", "");

    /* Rotating suggestion: one at a time, every 2s, while hovered */
    var tipTimer = null;
    var tipIndex = 0;
    function setTip(text, animate) {
      if (!animate) { micTipText.textContent = "“" + text + "”"; return; }
      micTipText.classList.remove("swap-in");
      micTipText.classList.add("swap-out");
      setTimeout(function () {
        micTipText.textContent = "“" + text + "”";
        micTipText.classList.remove("swap-out");
        void micTipText.offsetWidth;
        micTipText.classList.add("swap-in");
      }, 200);
    }
    function startTips() {
      var list = suggestions();
      tipIndex = 0;
      setTip(list[0], false);
      clearInterval(tipTimer);
      tipTimer = setInterval(function () {
        var l = suggestions(); // re-read: theme or section may have changed
        tipIndex = (tipIndex + 1) % l.length;
        setTip(l[tipIndex], true);
      }, 2000);
    }
    function stopTips() { clearInterval(tipTimer); }
    micWrap.addEventListener("mouseenter", startTips);
    micWrap.addEventListener("mouseleave", stopTips);
    micBtn.addEventListener("focus", startTips);
    micBtn.addEventListener("blur", stopTips);

    /* Recognition */
    var rec = null;
    var listening = false;
    var handled = false;

    function setListening(on) {
      listening = on;
      micBtn.classList.toggle("listening", on);
      micWrap.classList.toggle("is-listening", on);
      micBtn.setAttribute("aria-pressed", String(on));
      if (!on) {
        islandEl.classList.remove("hearing");
        islandSetSticky(null);
      }
    }

    function handle(transcript) {
      var said = transcript.toLowerCase().trim();
      for (var i = 0; i < COMMANDS.length; i++) {
        if (COMMANDS[i].re.test(said)) {
          haptic("success");
          COMMANDS[i].run();
          return true;
        }
      }
      // "switch theme" / "change mode" without saying which: just flip it
      if (/theme|mode|switch|toggle/.test(said)) { haptic("success"); themeBtn.click(); return true; }
      return false;
    }

    // Stop right away (second click, Esc): abort, not stop, so the browser
    // drops the session instantly instead of finishing it. The session is
    // retired first, so its late abort/end events can't touch the UI or
    // the next session.
    function stopListening() {
      var r = rec;
      rec = null;
      setListening(false);
      haptic("toggle");
      if (r) { try { r.abort(); } catch (e) {} }
    }

    function startListening() {
      if (listening) { stopListening(); return; }
      stopTips();
      var session = new SR();
      rec = session;
      session.lang = "en-US";
      session.interimResults = true;
      session.maxAlternatives = 3;
      session.continuous = false;
      handled = false;

      var hint = suggestions()[0];
      setListening(true);
      haptic("toggle");
      islandSetSticky({ icon: "mic", tone: "live", listening: true,
        html: "Listening<small>“" + hint + "”</small>" });

      // Every handler ignores events from a session that's been stopped or replaced
      function live() { return rec === session; }

      session.onspeechstart = function () { if (live()) islandEl.classList.add("hearing"); };
      session.onspeechend = function () { if (live()) islandEl.classList.remove("hearing"); };
      session.onresult = function (e) {
        if (!live()) return;
        var res = e.results[e.results.length - 1];
        var text = res[0].transcript;
        if (!res.isFinal) {
          // Live transcript in the island
          islandRender({ icon: "mic", tone: "live", listening: true, html: "“" + text + "”" });
          islandEl.classList.add("hearing");
          return;
        }
        var ok = false;
        for (var a = 0; a < res.length && !ok; a++) ok = handle(res[a].transcript);
        handled = true;
        rec = null;
        setListening(false);
        if (!ok) {
          haptic("error");
          notify({ icon: "alert", tone: "warn", html: "Didn't catch that<small>say “help”</small>", dur: 2600 }, { replace: true });
        }
      };
      session.onerror = function (e) {
        if (!live()) return;
        handled = true;
        rec = null;
        setListening(false);
        var msg = e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Mic blocked<small>allow it in site settings</small>"
          : e.error === "no-speech" ? "Didn't hear anything"
          : e.error === "network" ? "Voice needs internet"
          : e.error === "aborted" ? null
          : "Voice isn't available";
        if (msg) { haptic("error"); notify({ icon: "alert", tone: "warn", html: msg, dur: 2600 }, { replace: true }); }
      };
      session.onend = function () {
        if (!live()) return;
        rec = null;
        setListening(false);
        if (!handled) notify({ icon: "alert", tone: "warn", html: "Didn't hear anything", dur: 2400 }, { replace: true });
      };

      try { session.start(); } catch (err) { rec = null; setListening(false); }
    }

    micBtn.addEventListener("click", function (e) {
      micRipple(e, !listening); // ripple color shows the state it's switching to
      startListening();
    });

    // Small ripple from the click point (center for keyboard/V)
    function micRipple(e, turningOn) {
      if (reduceMotion) return;
      var r = micBtn.getBoundingClientRect();
      var x = e && e.clientX ? e.clientX - r.left : r.width / 2;
      var y = e && e.clientY ? e.clientY - r.top : r.height / 2;
      var s = document.createElement("span");
      s.className = "mic-ripple" + (turningOn ? " on" : " off");
      s.style.left = x + "px";
      s.style.top = y + "px";
      micBtn.appendChild(s);
      setTimeout(function () { s.remove(); }, 650);
    }

    // Surprise #1: press V anywhere (outside text fields) to talk, Esc to stop
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return; // holding V mustn't flicker it
      if (e.key === "v" || e.key === "V") { e.preventDefault(); micRipple(null, !listening); startListening(); }
      if (e.key === "Escape" && listening) { micRipple(null, false); stopListening(); }
    });
  }

  /* ---------- Surprise #3: a one-time welcome tip for first-time visitors ---------- */
  (function welcomeOnce() {
    if (!SR || !micWrap || micWrap.hidden) return;
    var seen = false;
    try { seen = localStorage.getItem("voiceTipSeen") === "1"; } catch (e) {}
    if (seen) return;
    setTimeout(function () {
      if (window.scrollY > 200) return; // only greet people still at the top
      var desktop = finePointer;
      notify({ icon: "mic", tone: "info", dur: 3800,
        html: "Try voice" + "<small>" + (desktop ? "press V and say “show projects”" : "tap the mic") + "</small>" });
      try { localStorage.setItem("voiceTipSeen", "1"); } catch (e) {}
    }, 2600);
  })();

  /* ---------- Surprise #2: "surprise me" — a ~3.5s celebration across the page ----------
     greeting (spinning icon) → confetti cannons from both bottom corners + a burst
     from the top → name letters wave → photo jumps out of its frame → rail balls
     pulse in sequence → mic hops → sparkle trail follows the cursor/finger */
  var surprising = false;
  function surprise(originEl) {
    if (surprising) return;
    surprising = true;
    setTimeout(function () { surprising = false; }, 3600);

    haptic("celebrate");

    // The big card: greeting, thank-you, local weather and forecast
    if (window.Celebrate) {
      // Let the confetti open the show, then bring the card in
      setTimeout(function () { window.Celebrate.open(); }, reduceMotion ? 0 : 450);
    } else {
      var hour = new Date().getHours();
      var greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      notify({ icon: "spark", tone: "info", html: "👋 " + greet + "<small>thanks for stopping by</small>", dur: 3400 });
    }
    if (reduceMotion) return;

    // Confetti: two cannons + a top burst (+ a burst from the button, if pressed)
    confetti(originEl);
    // Fireworks over the top half, a beat after the confetti
    if (window.Celebrate) setTimeout(function () { window.Celebrate.fireworks(4); }, 700);

    // Everything on screen joins in, sweeping top → bottom
    celebrateVisible();

    // Rail (always on screen on desktop): balls pulse in turn, line flashes
    Array.prototype.forEach.call(document.querySelectorAll(".rail-num"), function (n, i) {
      setTimeout(function () { restartClass(n, "pulse", 750); }, 250 + i * 130);
    });
    var rp = document.getElementById("railProgress");
    if (rp) restartClass(rp, "sx-flash", 1300);

    // Mic: a happy hop
    if (micBtn) setTimeout(function () { restartClass(micBtn, "cheer", 950); }, 300);

    // A short sparkle trail behind the cursor / finger
    sparkleTrail(1500);
  }

  /* Find what's on screen right now and give each kind of element its effect.
     The delay grows with the element's position, so it reads as a wave. */
  var SX = [
    { cls: "sx-heading", max: 14, split: true,
      sel: ".hero-title, .stage-title, .project-title, .edu-degree, .mini-title, .stage-eyebrow, .skill-cat, .coursework-label, .also-built-label, .timeline-org" },
    { cls: "sx-text", max: 30,
      sel: ".hero-sub, .stage-lede, .about-bio, .project-desc, .timeline-list li, .mini-desc, .edu-school, .edu-meta, .cert-list li, .deploy-value, .deploy-label, .hero-status-line, .timeline-date, .timeline-role, .footer p" },
    { cls: "sx-box", max: 20,
      sel: ".project-card, .edu-card, .skill-card, .mini-card, .deploy-card, .terminal, .cert-block" },
    { cls: "sx-chip", max: 60, step: 25,
      sel: ".chip, .status-stack span, .filter-btn, .project-stats li" },
    { cls: "sx-btn", max: 10,
      sel: "main .btn, .project-link, .hero-links a" },
    { cls: "sx-chart", max: 6, sel: ".chart-bars" },
    { cls: "sx-redraw", max: 6, sel: ".chart-line, .chart-path" },
    { cls: "sx-dot", max: 12, sel: ".timeline-marker, .status-dot, .brand-dot" }
  ];

  function onScreen(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }

  function celebrateVisible() {
    var vh = innerHeight;
    SX.forEach(function (group) {
      var els = Array.prototype.filter.call(document.querySelectorAll(group.sel), onScreen).slice(0, group.max);
      els.forEach(function (el, i) {
        var top = Math.max(0, el.getBoundingClientRect().top);
        // Wave delay from position, plus a small per-item step for rows of chips
        var delay = Math.round(200 + (top / vh) * 700 + (group.step ? (i % 8) * group.step : 0));
        if (group.split) splitLetters(el, delay);
        el.style.setProperty("--sxd", delay + "ms");
        restartClass(el, group.cls, delay + 1300);
        setTimeout(function () { el.style.removeProperty("--sxd"); }, delay + 1350);
      });
    });

    // Photo jumps out of its frame if you can see it
    var photo = document.querySelector(".photo-frame img");
    if (photo && onScreen(photo)) setTimeout(function () { restartClass(photo, "cheer", 1500); }, 150);
  }

  // Split a plain-text heading into letters for the wave, then restore it exactly
  function splitLetters(el, delay) {
    if (el.children.length || el.querySelector(".sx-ch")) return; // only plain text
    var original = el.textContent;
    var hadLabel = el.hasAttribute("aria-label");
    if (!hadLabel) el.setAttribute("aria-label", original.trim());
    el.textContent = "";
    original.split("").forEach(function (ch, i) {
      var s = document.createElement("span");
      s.className = "sx-ch";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", i);
      s.textContent = ch;
      el.appendChild(s);
    });
    setTimeout(function () {
      el.textContent = original;
      if (!hadLabel) el.removeAttribute("aria-label");
    }, delay + 900 + original.length * 32);
  }

  /* Surprise button in the top bar */
  var surpriseBtn = document.getElementById("surpriseBtn");
  if (surpriseBtn) {
    surpriseBtn.setAttribute("data-haptic-own", "");
    surpriseBtn.addEventListener("click", function () {
      restartClass(surpriseBtn, "pop", 850);
      surprise(surpriseBtn);
    });
  }

  function restartClass(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms);
  }

  function confetti(originEl) {
    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:110";
    document.body.appendChild(c);
    var W = innerWidth, H = innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    var colors = isDark()
      ? ["#8B9CF0", "#B7C2F7", "#E8EAF2", "#5E6FD0", "#8FD6A8"]
      : ["#3B4FA0", "#93A2E8", "#262F73", "#B7C2F7", "#1A1E2B"];
    var parts = [];
    function add(n, x, y, vx0, vx1, vy0, vy1, delay) {
      for (var i = 0; i < n; i++) {
        parts.push({
          x: x + (Math.random() - 0.5) * 30, y: y,
          vx: vx0 + Math.random() * (vx1 - vx0), vy: vy0 + Math.random() * (vy1 - vy0),
          r: Math.random() * 5 + 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35,
          col: colors[(Math.random() * colors.length) | 0], shape: (Math.random() * 4) | 0,
          wob: Math.random() * 6, delay: delay || 0
        });
      }
    }
    var scale = Math.min(1, W / 900);
    add(70, 0, H, 4 * scale + 3, 11 * scale + 4, -21, -13, 0);   // bottom-left cannon
    add(70, W, H, -11 * scale - 4, -4 * scale - 3, -21, -13, 0); // bottom-right cannon
    add(60, W / 2, -10, -7, 7, 1, 6, 350);                     // top burst, a beat later
    if (originEl) {                                             // burst from the button pressed
      var ob = originEl.getBoundingClientRect();
      add(36, ob.left + ob.width / 2, ob.top + ob.height / 2, -7, 7, -7, 3, 0);
    }

    function star(r) {
      ctx.beginPath();
      for (var k = 0; k < 10; k++) {
        var a = (Math.PI / 5) * k - Math.PI / 2, rr = k % 2 ? r * 0.45 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    }
    var LIFE = 3300, t0 = performance.now();
    (function draw(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        if (t < p.delay) return;
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.992;
        p.x += p.vx + Math.sin((t / 180) + p.wob) * 0.6; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2200) / (LIFE - 2200));
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(t / 120 + p.wob)); // paper flip
        ctx.fillStyle = p.col;
        if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2); ctx.fill(); }
        else if (p.shape === 2) { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.closePath(); ctx.fill(); }
        else star(p.r);
        ctx.restore();
      });
      if (t < LIFE) requestAnimationFrame(draw); else c.remove();
    })(t0);
  }

  function sparkleTrail(ms) {
    var until = performance.now() + ms, last = 0;
    function onMove(e) {
      var now = performance.now();
      if (now > until) { document.removeEventListener("pointermove", onMove); return; }
      if (now - last < 28) return;
      last = now;
      var s = document.createElement("span");
      s.className = "sparkle";
      s.setAttribute("aria-hidden", "true");
      s.style.left = e.clientX + "px";
      s.style.top = e.clientY + "px";
      s.style.setProperty("--dx", (Math.random() - 0.5) * 40 + "px");
      s.style.setProperty("--dy", Math.random() * 30 + 10 + "px");
      if (Math.random() < 0.4) s.style.background = "var(--accent-light)";
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 820);
    }
    document.addEventListener("pointermove", onMove, { passive: true });
  }

})();
