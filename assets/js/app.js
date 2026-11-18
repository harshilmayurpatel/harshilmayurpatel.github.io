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
    themeBtn.addEventListener("click", function () {
      if (switching) return;
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

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
    btn.addEventListener("click", function () {
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

  /* ---------- Copy email ---------- */
  var copyBtn = document.getElementById("copyEmail");
  var toast = document.getElementById("toast");
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var email = copyBtn.getAttribute("data-email");
      var ok = function () { showToast("✓ Copied " + email); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(ok, function () { showToast(email); });
      } else {
        showToast(email);
      }
    });
  }

  /* ---------- Cursor follower ---------- */
  if (finePointer && !reduceMotion) {
    var ring = document.createElement("div");
    ring.className = "cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);
    var tx = 0, ty = 0, cx = 0, cy = 0, moving = false;
    document.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      ring.classList.add("on");
      if (!moving) { moving = true; requestAnimationFrame(follow); }
    });
    document.addEventListener("mouseleave", function () { ring.classList.remove("on"); });
    function follow() {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      ring.style.transform = "translate(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px)";
      if (Math.abs(tx - cx) > 0.3 || Math.abs(ty - cy) > 0.3) requestAnimationFrame(follow);
      else moving = false;
    }
    document.addEventListener("mouseover", function (e) {
      ring.classList.toggle("hover", !!e.target.closest("a, button"));
    });
  }
})();
