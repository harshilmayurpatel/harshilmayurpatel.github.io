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
  refresh();

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
})();
