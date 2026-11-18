/* =========================================================
   Celebration card — greeting, thank-you, local weather + forecast
   ---------------------------------------------------------
   Location: asks the browser (visitor's permission). If declined or
   unavailable, falls back to Jersey City (where Harshil is).
   Weather: Open-Meteo (free, no key). City name: BigDataCloud's free
   client-side reverse geocoder. Coordinates are rounded to ~1 km and
   results are cached for the browser session.
   Exposes window.Celebrate = { open, fireworks, ambient }.
   ========================================================= */
(function () {
  "use strict";

  var HOME = { lat: 40.72, lon: -74.04, city: "Jersey City", tz: "America/New_York" };
  var CACHE_KEY = "wxCache.v1";
  var CACHE_MS = 20 * 60 * 1000;

  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }

  /* ---------- Units: °F / mph for US English visitors, °C / km/h otherwise ---------- */
  var lang = (navigator.language || "en-US");
  var imperial = /^en-(US|LR|MM)$/i.test(lang) || /^(en|es)-US$/i.test(lang);
  var UNIT_T = imperial ? "°F" : "°C";
  var UNIT_W = imperial ? "mph" : "km/h";

  /* ---------- Location ---------- */
  function getPosition() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 7000);
      navigator.geolocation.getCurrentPosition(
        function (p) {
          if (done) return;
          done = true; clearTimeout(timer);
          resolve({ lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) });
        },
        function () { if (!done) { done = true; clearTimeout(timer); resolve(null); } },
        { enableHighAccuracy: false, timeout: 6500, maximumAge: 30 * 60 * 1000 }
      );
    });
  }

  function fetchJSON(url, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 8000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function cityName(lat, lon) {
    return fetchJSON("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat +
      "&longitude=" + lon + "&localityLanguage=en", 5000)
      .then(function (j) { return j.city || j.locality || j.principalSubdivision || j.countryName || null; })
      .catch(function () { return null; });
  }

  function weather(lat, lon) {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
      "&timezone=auto&forecast_days=4" +
      (imperial ? "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" : "");
    return fetchJSON(url, 8000);
  }

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (c && Date.now() - c.at < CACHE_MS && c.imperial === imperial) return c;
    } catch (e) {}
    return null;
  }
  function writeCache(c) {
    try { c.at = Date.now(); c.imperial = imperial; sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
  }

  // Resolves to { place, isHome, wx } or { error }
  function loadWeather(onAsking) {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    if (onAsking) onAsking();
    return getPosition().then(function (pos) {
      var isHome = !pos;
      var p = pos || HOME;
      return Promise.all([weather(p.lat, p.lon), isHome ? Promise.resolve(HOME.city) : cityName(p.lat, p.lon)])
        .then(function (res) {
          var out = { place: res[1] || "your area", isHome: isHome, wx: res[0] };
          writeCache(out);
          return out;
        });
    }).catch(function (err) { return { error: String(err) }; });
  }

  /* ---------- WMO weather codes → kind + label ---------- */
  function describe(code, isDay, wind) {
    var k, label;
    if (code === 0) { k = isDay ? "sun" : "moon"; label = isDay ? "Clear and sunny" : "Clear night"; }
    else if (code === 1) { k = isDay ? "sun" : "moon"; label = "Mostly clear"; }
    else if (code === 2) { k = isDay ? "partly" : "partly-night"; label = "Partly cloudy"; }
    else if (code === 3) { k = "cloud"; label = "Overcast"; }
    else if (code === 45 || code === 48) { k = "fog"; label = "Foggy"; }
    else if (code >= 51 && code <= 57) { k = "drizzle"; label = "Light drizzle"; }
    else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) { k = "rain"; label = code >= 65 || code === 82 ? "Heavy rain" : code >= 80 ? "Rain showers" : "Rain"; }
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) { k = "snow"; label = code >= 75 ? "Heavy snow" : "Snow"; }
    else if (code >= 95) { k = "thunder"; label = "Thunderstorms"; }
    else { k = "cloud"; label = "Cloudy"; }
    var windy = wind >= (imperial ? 20 : 32);
    if (windy && (k === "sun" || k === "moon" || k === "cloud" || k === "partly" || k === "partly-night")) {
      k = "wind"; label = label + " and windy";
    }
    return { kind: k, label: label, windy: windy };
  }

  /* ---------- Animated weather icons (inline SVG, CSS-animated) ---------- */
  function icon(kind, cls) {
    var sun = '<g class="wi-sun"><g class="wi-rays">' +
      [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) {
        return '<line x1="32" y1="6" x2="32" y2="12" transform="rotate(' + a + ' 32 32)"/>';
      }).join("") + '</g><circle class="wi-core" cx="32" cy="32" r="11"/></g>';
    var moon = '<g class="wi-moonwrap"><path class="wi-moon" d="M40 14a18 18 0 1 0 12 26A15 15 0 0 1 40 14z"/>' +
      '<circle class="wi-star s1" cx="14" cy="16" r="1.6"/><circle class="wi-star s2" cx="22" cy="8" r="1.1"/><circle class="wi-star s3" cx="52" cy="12" r="1.3"/></g>';
    var cloud = function (x, y, s, c2) {
      return '<g class="wi-cloud' + (c2 ? " c2" : "") + '" transform="translate(' + x + " " + y + ") scale(" + s + ')">' +
        '<path d="M16 40h30a10 10 0 0 0 0-20 14 14 0 0 0-27-3A10 10 0 0 0 16 40z"/></g>';
    };
    var drops = function (n, cls2) {
      var s = "";
      for (var i = 0; i < n; i++) s += '<line class="' + cls2 + '" style="--d:' + (i * 0.22).toFixed(2) + 's" x1="' + (20 + i * 9) + '" y1="44" x2="' + (17 + i * 9) + '" y2="52"/>';
      return s;
    };
    var flakes = function () {
      var s = "";
      [20, 31, 42].forEach(function (x, i) {
        s += '<g class="wi-flake" style="--d:' + (i * 0.5) + 's"><path d="M' + x + ' 44v8M' + (x - 4) + ' 46l8 4M' + (x - 4) + ' 50l8-4"/></g>';
      });
      return s;
    };
    var body;
    switch (kind) {
      case "sun": body = sun; break;
      case "moon": body = moon; break;
      case "partly": body = '<g transform="translate(-8 -8) scale(.85)">' + sun + "</g>" + cloud(6, 10, 1, true); break;
      case "partly-night": body = '<g transform="translate(-6 -6) scale(.8)">' + moon + "</g>" + cloud(6, 10, 1, true); break;
      case "cloud": body = cloud(-6, 2, 1.05, false) + cloud(10, 12, .8, true); break;
      case "fog": body = cloud(0, -2, 1, false) + '<g class="wi-fog"><line x1="10" y1="48" x2="46" y2="48"/><line x1="18" y1="55" x2="54" y2="55"/></g>'; break;
      case "drizzle": body = cloud(0, -4, 1, false) + drops(3, "wi-drop thin"); break;
      case "rain": body = cloud(0, -4, 1, false) + drops(4, "wi-drop"); break;
      case "snow": body = cloud(0, -4, 1, false) + flakes(); break;
      case "thunder": body = cloud(0, -4, 1, false) + '<path class="wi-bolt" d="M34 38l-8 12h7l-4 10 12-15h-7l4-7z"/>' + drops(2, "wi-drop"); break;
      case "wind": body = '<g class="wi-wind"><path d="M8 24h30a6 6 0 1 0-6-6"/><path class="w2" d="M8 34h42a6 6 0 1 1-6 6"/><path class="w3" d="M8 44h22"/></g>'; break;
      default: body = cloud(0, 0, 1, false);
    }
    return '<svg class="wi ' + (cls || "") + ' wi-' + kind + '" viewBox="0 0 64 64" aria-hidden="true">' + body + "</svg>";
  }

  /* ---------- Friendly copy ---------- */
  function greeting(h) {
    if (h < 5) return { hi: "Up late?", part: "night" };
    if (h < 12) return { hi: "Good morning", part: "morning" };
    if (h < 17) return { hi: "Good afternoon", part: "afternoon" };
    if (h < 21) return { hi: "Good evening", part: "evening" };
    return { hi: "Good night", part: "night" };
  }
  function wish(kind, temp, part) {
    var cold = imperial ? temp <= 40 : temp <= 4;
    var hot = imperial ? temp >= 86 : temp >= 30;
    var base = "Have a " + (part === "night" ? "restful night" : "lovely " + part);
    if (kind === "rain" || kind === "drizzle") return base + " — maybe grab an umbrella ☔";
    if (kind === "thunder") return base + " — stay cozy indoors ⛈️";
    if (kind === "snow") return base + " — bundle up, it's snowing ❄️";
    if (kind === "fog") return base + " — take it slow out there 🌫️";
    if (kind === "wind") return base + " — hold onto your hat 🌬️";
    if (cold) return base + " — stay warm 🧣";
    if (hot) return base + " — stay cool and hydrated 🥤";
    if (kind === "sun") return base + " — enjoy the sunshine ☀️";
    if (kind === "moon") return base + " — clear skies tonight ✨";
    return base + " 🙂";
  }

  // At night, the next sunrise is today's if it's still ahead (after midnight), else tomorrow's
  function nextSunrise(d) {
    return new Date(d.sunrise[0]) > new Date() ? d.sunrise[0] : (d.sunrise[1] || d.sunrise[0]);
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  /* ---------- The card ---------- */
  var cardEl = null, remaining = 0, lastTick = 0, paused = false, loading = false, rafId = 0;
  var AUTO_MS = 12000;

  function close() {
    loading = false;
    if (!cardEl) return;
    var el = cardEl;
    cardEl = null;
    cancelAnimationFrame(rafId);
    document.removeEventListener("keydown", onKey);
    el.classList.remove("show");
    el.classList.add("hide");
    setTimeout(function () { el.remove(); }, 380);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function tickAuto(now) {
    if (!cardEl) return;
    // The countdown only runs once the weather is showing, and pauses on hover
    if (!paused && !loading) remaining -= now - lastTick;
    lastTick = now;
    var bar = cardEl.querySelector(".cc-timer i");
    if (bar) bar.style.transform = "scaleX(" + Math.max(0, remaining / AUTO_MS) + ")";
    if (remaining <= 0) { close(); return; }
    rafId = requestAnimationFrame(tickAuto);
  }

  function open(opts) {
    opts = opts || {};
    if (cardEl) close();
    var now = new Date();
    var g = greeting(now.getHours());
    var dateStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    var timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    // Harshil's local time, shown when the visitor is in a different time zone
    var visitorTz = "";
    try { visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var harshilLine = "";
    if (visitorTz && visitorTz !== HOME.tz) {
      try {
        var ht = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: HOME.tz });
        harshilLine = '<span class="cc-chip">🕑 ' + ht + " for Harshil in Jersey City</span>";
      } catch (e) {}
    }

    var wrap = document.createElement("div");
    wrap.className = "cc-wrap";
    wrap.innerHTML =
      '<div class="cc-backdrop"></div>' +
      '<section class="cc-card" role="dialog" aria-modal="false" aria-labelledby="ccTitle">' +
        '<button class="cc-close" type="button" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>' +
        '<div class="cc-head">' +
          '<div class="cc-greet">' +
            '<p class="cc-hi">' + g.hi + ' <span class="cc-wave" aria-hidden="true">👋</span></p>' +
            '<h2 class="cc-title" id="ccTitle">Thanks for visiting!</h2>' +
            '<p class="cc-when">' + dateStr + " · " + timeStr + "</p>" +
          "</div>" +
          '<div class="cc-icon" aria-hidden="true">' + icon("loading", "wi-lg") + "</div>" +
        "</div>" +
        '<div class="cc-weather" aria-live="polite">' +
          '<div class="cc-loading"><span class="cc-dots"><i></i><i></i><i></i></span> <span class="cc-load-text">Checking the sky…</span></div>' +
        "</div>" +
        '<p class="cc-wish"></p>' +
        '<div class="cc-foot">' + harshilLine + '<span class="cc-src">Weather by Open-Meteo</span></div>' +
        '<div class="cc-timer" aria-hidden="true"><i></i></div>' +
      "</section>";
    document.body.appendChild(wrap);
    cardEl = wrap;

    var card = wrap.querySelector(".cc-card");
    wrap.querySelector(".cc-close").addEventListener("click", close);
    wrap.querySelector(".cc-backdrop").addEventListener("click", close);
    card.addEventListener("mouseenter", function () { paused = true; });
    card.addEventListener("mouseleave", function () { paused = false; });
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(function () { wrap.classList.add("show"); });
    setTimeout(function () { var b = wrap.querySelector(".cc-close"); if (b) b.focus({ preventScroll: true }); }, 400);

    remaining = AUTO_MS; lastTick = performance.now(); paused = false; loading = true;
    rafId = requestAnimationFrame(tickAuto);

    var wishEl = wrap.querySelector(".cc-wish");
    wishEl.textContent = "Have a lovely " + (g.part === "night" ? "night" : g.part) + " 🙂";

    loadWeather(function () {
      var t = wrap.querySelector(".cc-load-text");
      if (t) t.textContent = "Checking the sky… allow location for your local weather";
    }).then(function (res) {
      if (cardEl !== wrap) return; // closed meanwhile
      loading = false;
      remaining = AUTO_MS; // full reading time from the moment the weather appears
      var box = wrap.querySelector(".cc-weather");
      if (!res || res.error || !res.wx || !res.wx.current) {
        box.innerHTML = '<p class="cc-noweather">Couldn\'t reach the weather service right now — but thanks for stopping by!</p>';
        wrap.querySelector(".cc-icon").innerHTML = icon(now.getHours() >= 6 && now.getHours() < 19 ? "sun" : "moon", "wi-lg");
        return;
      }
      var c = res.wx.current, d = res.wx.daily;
      var desc = describe(c.weather_code, c.is_day === 1, c.wind_speed_10m);
      var T = Math.round(c.temperature_2m);
      wrap.querySelector(".cc-icon").innerHTML = icon(desc.kind, "wi-lg");

      var days = "";
      for (var i = 1; i < Math.min(4, d.time.length); i++) {
        var dd = describe(d.weather_code[i], true, 0);
        var name = new Date(d.time[i] + "T12:00:00").toLocaleDateString([], { weekday: "short" });
        days += '<div class="cc-day"><span class="cc-dname">' + name + "</span>" + icon(dd.kind, "wi-sm") +
          '<span class="cc-dtemp"><b>' + Math.round(d.temperature_2m_max[i]) + "°</b> " + Math.round(d.temperature_2m_min[i]) + "°</span>" +
          (d.precipitation_probability_max[i] >= 30 ? '<span class="cc-dpop">💧' + d.precipitation_probability_max[i] + "%</span>" : '<span class="cc-dpop"></span>') +
          "</div>";
      }

      box.innerHTML =
        '<div class="cc-now">' +
          '<span class="cc-temp">' + T + '<sup>' + UNIT_T + "</sup></span>" +
          '<div class="cc-cond"><b>' + desc.label + "</b><span>" + (res.isHome ? "in Jersey City, where Harshil is" : "in " + res.place) + "</span></div>" +
        "</div>" +
        '<div class="cc-stats">' +
          '<span><em>Feels like</em>' + Math.round(c.apparent_temperature) + "°</span>" +
          '<span><em>High / Low</em>' + Math.round(d.temperature_2m_max[0]) + "° / " + Math.round(d.temperature_2m_min[0]) + "°</span>" +
          '<span><em>Rain chance</em>' + (d.precipitation_probability_max[0] == null ? "–" : d.precipitation_probability_max[0] + "%") + "</span>" +
          '<span><em>Wind</em>' + Math.round(c.wind_speed_10m) + " " + UNIT_W + "</span>" +
          '<span><em>Humidity</em>' + c.relative_humidity_2m + "%</span>" +
          '<span><em>' + (c.is_day === 1 ? "Sunset" : "Sunrise") + "</em>" + fmtTime(c.is_day === 1 ? d.sunset[0] : nextSunrise(d)) + "</span>" +
        "</div>" +
        '<div class="cc-forecast">' + days + "</div>";
      wishEl.textContent = wish(desc.kind, T, g.part);
      if (res.isHome) {
        var src = wrap.querySelector(".cc-src");
        if (src) src.textContent = "Location off · showing Jersey City · Weather by Open-Meteo";
      }
      // Weather-themed particles across the screen
      if (opts.ambient !== false) ambient(desc.kind);
      if (opts.onWeather) opts.onWeather(desc);
    });
  }

  /* ---------- Fireworks ---------- */
  function fireworks(count) {
    if (reduceMotion) return;
    var c = makeCanvas(108);
    var ctx = c.ctx, W = c.W, H = c.H;
    var colors = isDark() ? ["#8B9CF0", "#B7C2F7", "#F2D27A", "#8FD6A8", "#E8EAF2"] : ["#3B4FA0", "#5E6FD0", "#E0A93B", "#2F9E6B", "#262F73"];
    var rockets = [], sparks = [];
    for (var i = 0; i < (count || 4); i++) {
      rockets.push({
        x: W * (0.2 + 0.6 * Math.random()), y: H + 10, vy: -(H / 75 + Math.random() * 3),
        tx: H * (0.18 + Math.random() * 0.25), delay: i * 380, col: colors[i % colors.length], done: false
      });
    }
    var t0 = performance.now(), LIFE = 3800;
    (function draw(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, W, H);
      rockets.forEach(function (r) {
        if (t < r.delay || r.done) return;
        r.y += r.vy; r.vy *= 0.985;
        ctx.fillStyle = r.col; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2); ctx.fill();
        if (r.y <= r.tx || r.vy > -1.5) {
          r.done = true;
          for (var k = 0; k < 46; k++) {
            var a = (Math.PI * 2 * k) / 46, sp = 2 + Math.random() * 3.2;
            sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col: r.col });
          }
        }
      });
      sparks.forEach(function (s) {
        s.vy += 0.05; s.vx *= 0.985; s.vy *= 0.985; s.x += s.vx; s.y += s.vy; s.life -= 0.012;
        if (s.life <= 0) return;
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2); ctx.fill();
      });
      if (t < LIFE) requestAnimationFrame(draw); else c.el.remove();
    })(t0);
  }

  /* ---------- Weather particles across the screen ---------- */
  function ambient(kind) {
    if (reduceMotion) return;
    var c = makeCanvas(104);
    var ctx = c.ctx, W = c.W, H = c.H;
    var dark = isDark();
    var parts = [], n, LIFE = 6000, flash = 0;
    var type = (kind === "rain" || kind === "drizzle" || kind === "thunder") ? "rain"
      : kind === "snow" ? "snow" : kind === "wind" ? "wind"
      : (kind === "moon" || kind === "partly-night") ? "stars"
      : kind === "fog" ? "fog" : "sun";
    n = type === "rain" ? 140 : type === "snow" ? 90 : type === "stars" ? 70 : type === "wind" ? 26 : type === "fog" ? 6 : 40;
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W, y: type === "stars" || type === "sun" || type === "fog" ? Math.random() * H : -Math.random() * H,
        v: type === "rain" ? 9 + Math.random() * 6 : type === "snow" ? 0.8 + Math.random() * 1.4 : 2 + Math.random() * 3,
        r: Math.random() * 2 + 1, ph: Math.random() * 6.28, len: 30 + Math.random() * 60
      });
    }
    var t0 = performance.now();
    (function draw(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, W, H);
      var fade = Math.min(1, t / 600) * Math.max(0, Math.min(1, (LIFE - t) / 1000));
      if (type === "rain" && kind === "thunder" && (t > 900 && t < 1000 || t > 3200 && t < 3280)) flash = 0.25;
      if (flash > 0) { ctx.globalAlpha = flash * fade; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); flash -= 0.03; }
      parts.forEach(function (p) {
        ctx.globalAlpha = fade;
        if (type === "rain") {
          p.y += p.v; p.x -= p.v * 0.15;
          if (p.y > H) { p.y = -20; p.x = Math.random() * W * 1.1; }
          ctx.strokeStyle = dark ? "rgba(147,162,232,.55)" : "rgba(59,79,160,.35)";
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.v * 0.15 * 1.6, p.y + 12); ctx.stroke();
        } else if (type === "snow") {
          p.y += p.v; p.x += Math.sin(t / 900 + p.ph) * 0.6;
          if (p.y > H) { p.y = -10; p.x = Math.random() * W; }
          ctx.fillStyle = dark ? "rgba(232,234,242,.85)" : "rgba(147,162,232,.75)";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 0.8, 0, Math.PI * 2); ctx.fill();
        } else if (type === "wind") {
          p.x += p.v * 3; if (p.x > W + p.len) { p.x = -p.len; p.y = Math.random() * H; }
          ctx.strokeStyle = dark ? "rgba(183,194,247,.35)" : "rgba(59,79,160,.22)";
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo(p.x + p.len / 2, p.y - 6 * Math.sin(t / 300 + p.ph), p.x + p.len, p.y); ctx.stroke();
        } else if (type === "stars") {
          var tw = 0.35 + 0.65 * Math.abs(Math.sin(t / 500 + p.ph));
          ctx.globalAlpha = fade * tw;
          ctx.fillStyle = dark ? "#E8EAF2" : "#5E6FD0";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.9, 0, Math.PI * 2); ctx.fill();
        } else if (type === "fog") {
          p.x += 0.4; if (p.x > W + 300) p.x = -300;
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 260);
          g.addColorStop(0, dark ? "rgba(160,170,200,.10)" : "rgba(150,160,190,.12)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g; ctx.fillRect(p.x - 260, p.y - 260, 520, 520);
        } else { // sun: warm floating motes
          p.y -= 0.35; p.x += Math.sin(t / 700 + p.ph) * 0.3;
          if (p.y < -10) p.y = H + 10;
          var a = 0.35 + 0.65 * Math.abs(Math.sin(t / 600 + p.ph));
          ctx.globalAlpha = fade * a;
          ctx.fillStyle = dark ? "rgba(242,210,122,.9)" : "rgba(224,169,59,.8)";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 0.6, 0, Math.PI * 2); ctx.fill();
        }
      });
      if (t < LIFE) requestAnimationFrame(draw); else c.el.remove();
    })(t0);
  }

  function makeCanvas(z) {
    var el = document.createElement("canvas");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:" + z;
    document.body.appendChild(el);
    var W = innerWidth, H = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = W * dpr; el.height = H * dpr;
    var ctx = el.getContext("2d");
    ctx.scale(dpr, dpr);
    return { el: el, ctx: ctx, W: W, H: H };
  }

  window.Celebrate = { open: open, close: close, fireworks: fireworks, ambient: ambient, icon: icon, describe: describe };
})();
