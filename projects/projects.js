/* =========================================================
   /projects/: filterable grid + case-study panel
   Data comes from data.js (window.PROJECTS).
   Deep links: /projects/#<slug> opens that case study.
   ========================================================= */
(function () {
  "use strict";

  var DATA = window.PROJECTS || [];
  var CATS = window.PROJECT_CATEGORIES || [["all", "All"]];
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var grid = document.getElementById("pjGrid");
  var filtersEl = document.getElementById("pjFilters");
  var search = document.getElementById("pjSearch");
  var countEl = document.getElementById("pjCount");
  var emptyEl = document.getElementById("pjEmpty");
  var panel = document.getElementById("pjPanel");
  var panelBody = document.getElementById("pjPanelBody");
  var scrim = document.getElementById("pjScrim");
  if (!grid) return;

  var state = { cat: "all", q: "" };
  var BADGE = { featured: "★ Featured", live: "▶ Live demo", new: "New" };
  var CAT_LABEL = {};
  CATS.forEach(function (c) { CAT_LABEL[c[0]] = c[1]; });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isExternal(url) { return /^https?:/.test(url); }
  function linkAttrs(url) { return isExternal(url) ? ' target="_blank" rel="noopener"' : ""; }

  /* ---------- Animated previews (SVG, theme-aware via CSS) ---------- */
  var PREVIEW = {
    chat:
      '<svg viewBox="0 0 120 56" class="pv pv-chat" aria-hidden="true">' +
        '<rect class="pv-b pv-b1" x="6" y="6" width="62" height="14" rx="7"/>' +
        '<rect class="pv-b pv-b2 pv-me" x="52" y="24" width="62" height="12" rx="6"/>' +
        '<rect class="pv-b pv-b3" x="6" y="40" width="44" height="12" rx="6"/>' +
        '<g class="pv-typing"><circle cx="16" cy="46" r="2"/><circle cx="23" cy="46" r="2"/><circle cx="30" cy="46" r="2"/></g>' +
      "</svg>",
    bars:
      '<svg viewBox="0 0 120 56" class="pv pv-bars" aria-hidden="true">' +
        '<line class="pv-axis" x1="2" y1="53" x2="118" y2="53"/>' +
        [26, 38, 20, 48, 32, 24, 14].map(function (h, i) {
          return '<rect x="' + (5 + i * 16.5) + '" y="' + (53 - h) + '" width="11" height="' + h + '" rx="2" style="--i:' + i + '"' + (i === 3 ? ' class="hi"' : "") + "/>";
        }).join("") +
      "</svg>",
    map:
      '<svg viewBox="0 0 120 56" class="pv pv-map" aria-hidden="true">' +
        (function () {
          // A tiny tile-grid "map": darker tiles = higher adoption
          var rows = ["..xx....xx..", ".xxxx.xxxxx.", "xxxxxxxxxxxx", ".xxxxxxxxxx.", "..xxxx.xxx..", "...xx...x..."];
          var heat = [3, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3];
          var out = "";
          rows.forEach(function (r, y) {
            r.split("").forEach(function (ch, x) {
              if (ch !== "x") return;
              var lvl = (heat[(x + y * 5) % heat.length] + y) % 4;
              out += '<rect class="t' + lvl + '" x="' + (6 + x * 9.2) + '" y="' + (2 + y * 9) + '" width="8" height="8" rx="1.6" style="--i:' + (x + y) + '"/>';
            });
          });
          return out;
        })() +
      "</svg>",
    path:
      '<svg viewBox="0 0 120 56" class="pv pv-path" aria-hidden="true">' +
        '<g class="pv-dots">' +
          [0, 1, 2, 3].map(function (r) {
            return [0, 1, 2, 3, 4].map(function (c) { return '<circle cx="' + (10 + c * 25) + '" cy="' + (7 + r * 14) + '" r="1.6"/>'; }).join("");
          }).join("") +
        "</g>" +
        '<path class="pv-dead" pathLength="100" d="M35 49 L35 35 L35 21"/>' +
        '<path class="pv-route" pathLength="100" d="M10 49 L35 49 L60 49 L60 35 L85 35 L85 21 L85 7 L110 7"/>' +
        '<rect class="pv-goal" x="104" y="1" width="12" height="12" rx="2"/>' +
        '<circle class="pv-start" cx="10" cy="49" r="4"/>' +
      "</svg>",
    route:
      '<svg viewBox="0 0 120 56" class="pv pv-route-map" aria-hidden="true">' +
        '<path class="pv-road" d="M0 40 C20 40 24 18 46 18 S78 44 98 30 S114 10 120 12"/>' +
        '<path class="pv-trip" pathLength="100" d="M10 40 C24 39 28 18 46 18 S78 44 98 30"/>' +
        '<circle class="pv-from" cx="10" cy="40" r="3.5"/>' +
        '<g class="pv-pin" transform="translate(98 30)"><path d="M0 0c-4-5-6-7.5-6-10.5a6 6 0 0 1 12 0C6 -7.5 4 -5 0 0z"/><circle cx="0" cy="-10.5" r="2.2"/></g>' +
      "</svg>",
    vr:
      '<svg viewBox="0 0 120 56" class="pv pv-vr" aria-hidden="true">' +
        '<ellipse class="pv-orbit" cx="60" cy="30" rx="50" ry="14"/>' +
        '<rect class="pv-headset" x="38" y="18" width="44" height="22" rx="9"/>' +
        '<circle class="pv-lens" cx="51" cy="29" r="5"/><circle class="pv-lens" cx="69" cy="29" r="5"/>' +
        '<circle class="pv-ball" r="3.2"><animateMotion dur="3.6s" repeatCount="indefinite" path="M10 30 A50 14 0 1 0 110 30 A50 14 0 1 0 10 30"/></circle>' +
      "</svg>",
    pipeline:
      '<svg viewBox="0 0 120 56" class="pv pv-pipe" aria-hidden="true">' +
        '<line class="pv-pipe-line" x1="12" y1="28" x2="108" y2="28"/>' +
        '<line class="pv-pipe-fill" pathLength="100" x1="12" y1="28" x2="108" y2="28"/>' +
        [12, 36, 60, 84, 108].map(function (x, i) { return '<circle class="pv-stage" cx="' + x + '" cy="28" r="6" style="--i:' + i + '"/>'; }).join("") +
      "</svg>"
  };

  /* ---------- Filters ---------- */
  function countFor(cat) {
    return DATA.filter(function (p) { return cat === "all" || p.category === cat; }).length;
  }
  CATS.forEach(function (c) {
    var n = countFor(c[0]);
    if (!n && c[0] !== "all") return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "filter-btn" + (c[0] === "all" ? " is-on" : "");
    b.setAttribute("data-cat", c[0]);
    b.setAttribute("aria-pressed", String(c[0] === "all"));
    b.innerHTML = esc(c[1]) + ' <span class="pj-n">' + n + "</span>";
    b.addEventListener("click", function () { setCat(c[0]); });
    filtersEl.appendChild(b);
  });

  function setCat(cat) {
    state.cat = cat;
    Array.prototype.forEach.call(filtersEl.children, function (b) {
      var on = b.getAttribute("data-cat") === cat;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    apply();
  }

  var searchTimer = null;
  search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { state.q = search.value.trim().toLowerCase(); apply(); }, 120);
  });
  document.getElementById("pjClear").addEventListener("click", function () {
    search.value = ""; state.q = ""; setCat("all");
  });

  function matches(p) {
    if (state.cat !== "all" && p.category !== state.cat) return false;
    if (!state.q) return true;
    var hay = [p.title, p.tagline, CAT_LABEL[p.category] || ""].concat(p.tags).join(" ").toLowerCase();
    return state.q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  // Cards slide to their new places (View Transitions where supported)
  function apply() {
    var run = function () {
      var shown = 0;
      Array.prototype.forEach.call(grid.children, function (card) {
        var p = DATA[+card.getAttribute("data-i")];
        var ok = matches(p);
        card.hidden = !ok;
        if (ok) shown++;
      });
      countEl.textContent = shown === DATA.length ? "(" + DATA.length + ")" : "(" + shown + " of " + DATA.length + ")";
      emptyEl.hidden = shown > 0;
      if (!shown) document.getElementById("pjEmptyQ").textContent = state.q ? "“" + state.q + "”" : "this filter";
    };
    if (document.startViewTransition && !reduceMotion) document.startViewTransition(run);
    else run();
  }

  /* ---------- Cards ---------- */
  function badges(p) {
    return (p.badges || []).map(function (b) {
      return '<span class="pj-badge pj-badge-' + b + '">' + esc(BADGE[b] || b) + "</span>";
    }).join("");
  }

  DATA.forEach(function (p, i) {
    var card = document.createElement("article");
    card.className = "project-card pj-card";
    card.setAttribute("data-i", i);
    card.style.viewTransitionName = "pj-" + p.slug;
    var links = "";
    if (p.links.demo) links += '<a class="project-link pj-demo" href="' + esc(p.links.demo) + '"' + linkAttrs(p.links.demo) + '><svg class="icon"><use href="#i-play"/></svg>' + (p.slug === "portfolio" ? "Home" : "Demo") + "</a>";
    if (p.links.code) links += '<a class="project-link" href="' + esc(p.links.code) + '" target="_blank" rel="noopener"><svg class="icon"><use href="#i-github"/></svg>Code</a>';
    card.innerHTML =
      '<button type="button" class="pj-preview" aria-label="Open case study: ' + esc(p.title) + '">' + (PREVIEW[p.preview] || "") + '<span class="pj-badges">' + badges(p) + "</span></button>" +
      '<p class="project-tag">' + esc(CAT_LABEL[p.category] || "") + "</p>" +
      '<h2 class="project-title"><a href="#' + esc(p.slug) + '" class="pj-open">' + esc(p.title) + "</a></h2>" +
      '<p class="project-desc">' + esc(p.tagline) + "</p>" +
      '<div class="chip-row">' + p.tags.slice(0, 4).map(function (t) { return '<span class="chip chip-sm">' + esc(t) + "</span>"; }).join("") +
        (p.tags.length > 4 ? '<span class="chip chip-sm pj-more">+' + (p.tags.length - 4) + "</span>" : "") + "</div>" +
      '<div class="project-footer pj-footer">' +
        '<a class="project-link pj-details" href="#' + esc(p.slug) + '">Case study <span aria-hidden="true">→</span></a>' + links +
      "</div>";
    card.querySelector(".pj-preview").addEventListener("click", function () { go(p.slug); });
    grid.appendChild(card);
  });
  apply();

  // Every preview runs from page load and loops forever (CSS keyframes)
  Array.prototype.forEach.call(grid.children, function (c) { c.classList.add("in"); });

  /* ---------- Case-study panel ---------- */
  var lastFocus = null, openSlug = null;

  function list(items) {
    return "<ul>" + items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
  }

  function render(p) {
    var i = DATA.indexOf(p);
    var prev = DATA[(i - 1 + DATA.length) % DATA.length], next = DATA[(i + 1) % DATA.length];
    var cs = p.caseStudy || {};
    var actions = "";
    if (p.links.demo) actions += '<a class="btn btn-solid" href="' + esc(p.links.demo) + '"' + linkAttrs(p.links.demo) + '><svg class="icon"><use href="#i-play"/></svg>' + (p.slug === "portfolio" ? "Back to home" : "Live demo") + "</a>";
    if (p.links.code) actions += '<a class="btn btn-outline" href="' + esc(p.links.code) + '" target="_blank" rel="noopener"><svg class="icon"><use href="#i-github"/></svg>View code</a>';

    var shots = (p.shots || []).length
      ? '<div class="pj-shots">' + p.shots.map(function (s) {
          return '<figure><img src="' + esc(s.src) + '" alt="' + esc(s.alt || p.title) + '" decoding="async" />' +
            (s.caption ? "<figcaption>" + esc(s.caption) + "</figcaption>" : "") + "</figure>";
        }).join("") + "</div>"
      : '<div class="pj-hero-visual">' + (PREVIEW[p.preview] || "") + "</div>";

    panelBody.innerHTML =
      '<p class="project-tag">' + esc(CAT_LABEL[p.category] || "") + '</p>' +
      '<h2 class="pj-panel-title" id="pjPanelTitle">' + esc(p.title) + "</h2>" +
      '<p class="pj-panel-lede">' + esc(p.tagline) + "</p>" +
      (p.badges && p.badges.length ? '<div class="pj-badges pj-badges-inline">' + badges(p) + "</div>" : "") +
      (actions ? '<div class="pj-actions">' + actions + "</div>" : "") +
      shots +
      ((p.stats || []).length ? '<ul class="pj-stats">' + p.stats.map(function (s) { return "<li><strong>" + esc(s[0]) + "</strong>" + esc(s[1]) + "</li>"; }).join("") + "</ul>" : "") +
      (cs.problem ? "<section><h3>The problem</h3><p>" + esc(cs.problem) + "</p></section>" : "") +
      (cs.built ? "<section><h3>What I built</h3><p>" + esc(cs.built) + "</p></section>" : "") +
      (cs.how && cs.how.length ? "<section><h3>How it works</h3>" + list(cs.how) + "</section>" : "") +
      (cs.results && cs.results.length ? "<section><h3>Results</h3>" + list(cs.results) + "</section>" : "") +
      (cs.role ? "<section><h3>My role</h3><p>" + esc(cs.role) + "</p></section>" : "") +
      '<section><h3>Stack</h3><div class="chip-row">' + p.tags.map(function (t) { return '<span class="chip chip-sm">' + esc(t) + "</span>"; }).join("") + "</div></section>" +
      '<nav class="pj-nav" aria-label="More projects">' +
        '<a href="#' + esc(prev.slug) + '" class="pj-nav-prev"><span>← Previous</span>' + esc(prev.title) + "</a>" +
        '<a href="#' + esc(next.slug) + '" class="pj-nav-next"><span>Next →</span>' + esc(next.title) + "</a>" +
      "</nav>";
    panel.scrollTop = 0;
    panelBody.scrollTop = 0;
    requestAnimationFrame(function () { panelBody.classList.add("in"); });
  }

  function openPanel(p) {
    if (!openSlug) lastFocus = document.activeElement;
    openSlug = p.slug;
    panelBody.classList.remove("in");
    render(p);
    document.title = p.title + " · Harshil Patel";
    if (panel.hidden) {
      panel.hidden = false; scrim.hidden = false;
      void panel.offsetWidth;
      document.body.classList.add("pj-locked");
      panel.classList.add("open"); scrim.classList.add("open");
    }
    document.getElementById("pjClose").focus({ preventScroll: true });
  }

  function closePanel() {
    if (!openSlug) return;
    openSlug = null;
    document.title = "All projects · Harshil Patel";
    panel.classList.remove("open"); scrim.classList.remove("open");
    document.body.classList.remove("pj-locked");
    setTimeout(function () { if (!openSlug) { panel.hidden = true; scrim.hidden = true; } }, reduceMotion ? 0 : 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // The URL hash is the source of truth: #slug opens it, no hash closes
  function route() {
    var slug = decodeURIComponent(location.hash.slice(1));
    var p = DATA.filter(function (x) { return x.slug === slug; })[0];
    if (p) openPanel(p); else closePanel();
  }
  function go(slug) {
    if (location.hash === "#" + slug) route();
    else location.hash = slug;
  }
  function closeViaHistory() {
    // Remove the hash without leaving a "#" or an extra history entry
    history.pushState(null, "", location.pathname + location.search);
    closePanel();
  }

  window.addEventListener("hashchange", route);
  document.getElementById("pjClose").addEventListener("click", closeViaHistory);
  scrim.addEventListener("click", closeViaHistory);
  document.addEventListener("keydown", function (e) {
    if (!openSlug) {
      // "/" jumps to search (unless typing)
      var tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea") { e.preventDefault(); search.focus(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); closeViaHistory(); }
    // Keep Tab inside the panel while it's open
    if (e.key === "Tab") {
      var f = panel.querySelectorAll("a[href], button:not([disabled])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  route();

  // Used by voice commands ("show the Sokoban project")
  window.ProjectsPage = { open: go, close: closeViaHistory, filter: setCat };
})();
