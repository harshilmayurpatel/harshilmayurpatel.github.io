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

  /* ---------- Pipeline rail: active section + progress ---------- */
  var railNodes = Array.prototype.slice.call(document.querySelectorAll(".rail-node"));
  var railProgress = document.getElementById("railProgress");
  var sections = railNodes
    .map(function (node) {
      var id = node.getAttribute("data-section");
      return document.getElementById(id);
    })
    .filter(Boolean);

  function updateRail() {
    var scrollY = window.scrollY + window.innerHeight * 0.4;
    var activeIndex = 0;

    sections.forEach(function (section, i) {
      if (section.offsetTop <= scrollY) {
        activeIndex = i;
      }
    });

    railNodes.forEach(function (node, i) {
      node.classList.toggle("active", i === activeIndex);
    });

    if (railProgress && railNodes.length > 1) {
      var pct = activeIndex / (railNodes.length - 1);
      railProgress.style.height = Math.min(100, Math.max(0, pct * 100)) + "%";
    }
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        updateRail();
        ticking = false;
      });
      ticking = true;
    }
  });
  window.addEventListener("resize", updateRail);
  updateRail();

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
