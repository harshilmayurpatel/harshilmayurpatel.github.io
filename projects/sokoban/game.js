/* =========================================================
   SOKOBAN // AI PUZZLE SOLVER — retro edition
   ========================================================= */
(function () {
  "use strict";

  var S = window.SokobanSolver;
  var LEVELS = window.SOKOBAN_LEVELS.map(function (l) { return { name: l.name, src: l.map.join("\n") }; });
  var T = 16;                       // native sprite size (px)
  var MOVE_MS = 95;                 // tween time per step
  var AUTO_MS = 115;                // AI playback speed
  var ALGOS = ["astar", "dfs", "bfs"];
  var ALGO_LABEL = { dfs: "DFS", bfs: "BFS", astar: "A*" };

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("board"), ctx = canvas.getContext("2d");
  var stageEl = $("stage");

  // ---------- persistence (best-effort) ----------
  var store = { best: {}, last: 0, algo: "astar", muted: false };
  try {
    var raw = localStorage.getItem("sokoban.retro.v1");
    if (raw) { var parsed = JSON.parse(raw); for (var k in parsed) store[k] = parsed[k]; }
  } catch (e) {}
  function save() { try { localStorage.setItem("sokoban.retro.v1", JSON.stringify(store)); } catch (e) {} }
  if (ALGOS.indexOf(store.algo) < 0) store.algo = "astar";

  // ---------- game state ----------
  var screen = "title";             // title | levels | play | win
  var G = null;                     // current game
  var anim = null, queue = [];
  var particles = [];
  var solution = null;              // { moves, ptr, explored, algo }
  var hintOn = false;
  var thinking = false;
  var auto = null;                  // autoplay timer
  var reqId = 0;

  var DIR = { u: 0, d: 1, l: 2, r: 3 };
  var DV = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  var DCH = ["u", "d", "l", "r"];

  function loadLevel(i) {
    stopAuto();
    var lv = S.parse(LEVELS[i].src);
    G = {
      idx: i, lv: lv, w: lv.w, h: lv.h,
      boxes: lv.boxes.slice(), player: lv.player, facing: 1,
      moves: 0, pushes: 0, history: [], usedAI: false, won: false
    };
    anim = null; queue = []; particles = [];
    solution = null; hintOn = false; thinking = false; reqId++;
    store.last = i; save();
    resize();
    hud();
    status("LEVEL " + pad(i + 1, 2) + " — " + LEVELS[i].name, "");
  }

  function cellX(p) { return p % G.w; }
  function cellY(p) { return (p / G.w) | 0; }
  function isFloor(p) { return p >= 0 && p < G.w * G.h && !G.lv.wall[p] && G.lv.inside[p]; }
  function boxAt(p) { return G.boxes.indexOf(p); }

  // ---------- movement ----------
  function tryMove(d, fromAI) {
    if (screen !== "play" || G.won) return;
    if (!fromAI && auto) { stopAuto(); status("AI PLAYBACK STOPPED", ""); }
    settle();
    if (anim) { if (queue.length < 2) queue.push(d); return; }

    var x = cellX(G.player) + DV[d][0], y = cellY(G.player) + DV[d][1];
    G.facing = d;
    if (x < 0 || y < 0 || x >= G.w || y >= G.h) return bump();
    var t = y * G.w + x;
    if (!isFloor(t)) return bump();

    var bi = boxAt(t), bFrom = -1, bTo = -1;
    if (bi >= 0) {
      var bx = x + DV[d][0], by = y + DV[d][1];
      if (bx < 0 || by < 0 || bx >= G.w || by >= G.h) return bump();
      var b2 = by * G.w + bx;
      if (!isFloor(b2) || boxAt(b2) >= 0) return bump();
      bFrom = t; bTo = b2;
    }

    G.history.push({ player: G.player, boxes: G.boxes.slice(), moves: G.moves, pushes: G.pushes, facing: d });
    if (G.history.length > 2000) G.history.shift();

    anim = { t0: performance.now(), pFrom: G.player, pTo: t, bi: bi, bFrom: bFrom, bTo: bTo };
    setTimeout(settle, MOVE_MS + 5);
    G.player = t;
    G.moves++;
    var ch = DCH[d];
    if (bi >= 0) {
      G.boxes[bi] = bTo;
      G.pushes++;
      ch = ch.toUpperCase();
      if (G.lv.goal[bTo]) { sfx("goal"); burst(bTo, "#3df27a"); vibrate(12); }
      else sfx("push");
    } else sfx("step");

    // keep the cached AI plan if the player is following it
    if (solution) {
      if (solution.moves[solution.ptr] === ch) {
        solution.ptr++;
        if (bi >= 0) hintOn = false;
      } else { solution = null; hintOn = false; }
    } else hintOn = false;

    hud();
  }

  function bump() { sfx("bump"); }

  // Finish the current step once its tween time has passed. Driven by a timer as well as
  // the render loop, so game logic keeps going even when animation frames are throttled.
  function settle() {
    if (anim && performance.now() - anim.t0 >= MOVE_MS) afterAnim();
  }

  function afterAnim() {
    anim = null;
    if (checkWin()) return;
    if (queue.length) tryMove(queue.shift(), !!auto);
  }

  function checkWin() {
    for (var i = 0; i < G.boxes.length; i++) if (!G.lv.goal[G.boxes[i]]) return false;
    G.won = true;
    stopAuto();
    queue = [];
    var key = String(G.idx), prev = store.best[key], record = false;
    if (!G.usedAI && (prev == null || G.moves < prev)) { store.best[key] = G.moves; record = prev != null; save(); }
    setTimeout(function () {
      sfx("win");
      G.boxes.forEach(function (b, i) { setTimeout(function () { burst(b, i % 2 ? "#ffd24a" : "#3df27a"); }, i * 90); });
      showWin(record);
    }, 160);
    return true;
  }

  function undo() {
    if (screen !== "play" || !G.history.length || G.won) return;
    stopAuto();
    var s = G.history.pop();
    G.player = s.player; G.boxes = s.boxes; G.moves = s.moves; G.pushes = s.pushes; G.facing = s.facing;
    anim = null; queue = [];
    solution = null; hintOn = false;
    sfx("undo");
    hud();
  }

  function restart() {
    if (screen !== "play" && screen !== "win") return;
    hideOverlays(); screen = "play";
    loadLevel(G.idx);
    sfx("undo");
  }

  // ---------- AI: hint + autoplay ----------
  var worker = null;
  try { worker = new Worker("solver.js"); } catch (e) { worker = null; }
  var pending = {};
  if (worker) {
    worker.onmessage = function (e) { var cb = pending[e.data.id]; delete pending[e.data.id]; if (cb) cb(e.data); };
    worker.onerror = function () { worker = null; };
  }

  function requestPlan(cb) {
    if (solution && solution.ptr < solution.moves.length) return cb(solution);
    if (thinking) return;
    thinking = true;
    var id = ++reqId, algo = store.algo;
    var msg = { id: id, src: LEVELS[G.idx].src, boxes: G.boxes.slice(), player: G.player, opts: { algo: algo, maxNodes: 300000 } };
    status(ALGO_LABEL[algo] + " SEARCHING", "blink");
    function done(r) {
      thinking = false;
      if (id !== reqId || screen !== "play") return;
      if (!r.ok) {
        sfx("bump");
        status(r.limit ? "SEARCH LIMIT HIT (" + fmt(r.explored) + " STATES) — TRY UNDO" : "DEADLOCK! NO SOLUTION FROM HERE — UNDO", "bad");
        return;
      }
      solution = { moves: r.moves, ptr: 0, explored: r.explored, algo: algo, pushes: r.pushes };
      cb(solution);
    }
    var fire = function () {
      if (worker) { pending[id] = done; worker.postMessage(msg); }
      else {
        var t0 = performance.now();
        var r = S.solve(S.parse(msg.src), msg.boxes, msg.player, msg.opts);
        r.ms = Math.round(performance.now() - t0); r.id = id; done(r);
      }
    };
    setTimeout(fire, 30);
  }

  function hint() {
    if (screen !== "play" || G.won || auto) return;
    requestPlan(function (sol) {
      hintOn = true;
      sfx("hint");
      var left = 0;
      for (var i = sol.ptr; i < sol.moves.length; i++) if (sol.moves[i] === sol.moves[i].toUpperCase()) left++;
      status("HINT · " + ALGO_LABEL[sol.algo] + " EXPLORED " + fmt(sol.explored) + " STATES · " + left + " PUSHES TO GO", "good");
    });
  }

  function autoSolve() {
    if (screen !== "play" || G.won) return;
    if (auto) { stopAuto(); status("AI PLAYBACK STOPPED", ""); return; }
    requestPlan(function (sol) {
      G.usedAI = true;
      hintOn = false;
      status("AI PLAYING · " + ALGO_LABEL[sol.algo] + " · " + fmt(sol.explored) + " STATES EXPLORED", "good");
      $("btn-solve").classList.add("on");
      auto = setInterval(function () {
        if (!solution || solution.ptr >= solution.moves.length || G.won) return stopAuto();
        settle();
        if (anim) return;
        tryMove(DIR[solution.moves[solution.ptr].toLowerCase()], true);
      }, AUTO_MS);
    });
  }

  function stopAuto() {
    if (auto) { clearInterval(auto); auto = null; }
    var b = $("btn-solve"); if (b) b.classList.remove("on");
  }

  function cycleAlgo() {
    var i = (ALGOS.indexOf(store.algo) + 1) % ALGOS.length;
    store.algo = ALGOS[i]; save();
    solution = null; hintOn = false;
    $("btn-algo").textContent = "AI:" + ALGO_LABEL[store.algo];
    var desc = { dfs: "DEPTH-FIRST — FAST, NOT OPTIMAL", bfs: "BREADTH-FIRST — FEWEST PUSHES", astar: "A* — HEURISTIC GUIDED" };
    status("SOLVER: " + desc[store.algo], "");
    sfx("hint");
  }

  // ---------- HUD / status ----------
  function pad(n, l) { n = String(n); while (n.length < l) n = "0" + n; return n; }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function hud() {
    if (!G) return;
    $("hud-level").textContent = pad(G.idx + 1, 2);
    $("hud-moves").textContent = pad(G.moves, 4);
    $("hud-pushes").textContent = pad(G.pushes, 4);
    var b = store.best[String(G.idx)];
    $("hud-best").textContent = b == null ? "----" : pad(b, 4);
    $("btn-undo").disabled = !G.history.length;
  }
  function status(text, cls) {
    var el = $("status");
    el.textContent = text;
    el.className = "status" + (cls ? " " + cls : "");
  }

  // ---------- screens ----------
  function hideOverlays() {
    ["title", "levels", "win"].forEach(function (id) { $(id).hidden = true; });
  }
  function showTitle() { hideOverlays(); screen = "title"; $("title").hidden = false; }
  function showLevels() {
    stopAuto();
    hideOverlays(); screen = "levels";
    var grid = $("level-grid");
    grid.innerHTML = "";
    LEVELS.forEach(function (l, i) {
      var b = document.createElement("button");
      var best = store.best[String(i)];
      b.className = "lvl" + (best != null ? " done" : "") + (G && G.idx === i ? " current" : "");
      b.innerHTML = '<span class="lvl-n">' + pad(i + 1, 2) + '</span><span class="lvl-name">' + l.name + '</span><span class="lvl-best">' + (best != null ? "★ " + best : "· · ·") + "</span>";
      b.addEventListener("click", function () { startLevel(i); });
      grid.appendChild(b);
    });
    $("levels").hidden = false;
    var focus = grid.children[G ? G.idx : store.last] || grid.children[0];
    focus.focus();
  }
  function startLevel(i) {
    hideOverlays();
    screen = "play";
    loadLevel(i);
    sfx("start");
  }
  function showWin(record) {
    screen = "win";
    var last = G.idx === LEVELS.length - 1;
    $("win-title").textContent = last ? "ALL CLEAR!" : "STAGE CLEAR!";
    $("win-moves").textContent = G.moves;
    $("win-pushes").textContent = G.pushes;
    var b = store.best[String(G.idx)];
    $("win-best").textContent = b == null ? "--" : b;
    $("win-note").textContent = G.usedAI ? "SOLVED BY AI — PLAY IT YOURSELF FOR A RECORD" : record ? "NEW RECORD!" : (b === G.moves ? "PERSONAL BEST" : "");
    $("btn-next").textContent = last ? "▶ LEVEL SELECT" : "▶ NEXT LEVEL";
    $("win").hidden = false;
    $("btn-next").focus();
  }
  function next() {
    if (G.idx >= LEVELS.length - 1) return showLevels();
    startLevel(G.idx + 1);
  }

  // ---------- rendering ----------
  var PAL = {
    void: "#07080f",
    floorA: "#141a33", floorB: "#171e3b", floorDot: "#222a52",
    wallBase: "#a8432f", wallHi: "#d9674a", wallLo: "#6e2618", mortar: "#2a0f0b",
    goal: "#3df27a",
    crate: { k: "#1a0d05", l: "#f2b45e", m: "#c47f32", d: "#7c4818", x: "#e39a45" },
    crateOn: { k: "#06200f", l: "#a6ffc4", m: "#2fbf63", d: "#147038", x: "#6ff09a" },
    hint: "#ffd24a"
  };

  var ROBOT = [
    "................",
    ".......kk.......",
    ".......rr.......",
    "....kkkkkkkk....",
    "...khhhhhhhhk...",
    "...khkkkkkkhk...",
    "...khkvvvvkhk...",
    "...khkkkkkkhk...",
    "...kssssssssk...",
    "....kkkkkkkk....",
    "..kkbbbbbbbbkk..",
    "..kbkbbggbbkbk..",
    "..kbkbbbbbbkbk..",
    "..kkkbbbbbbkkk..",
    "....kkk..kkk....",
    "....kdk..kdk...."
  ];
  var ROBOT_PAL = { k: "#0b0d1a", r: "#ff4a6e", h: "#b8e6ff", s: "#6aa9dc", v: "#1a2348", b: "#4a6dff", g: "#3df27a", d: "#2b3a8a" };

  // Pre-render static tiles into tiny canvases
  function makeTile(draw) {
    var c = document.createElement("canvas"); c.width = c.height = T;
    var x = c.getContext("2d");
    draw(function (px, py, w, h, col) { x.fillStyle = col; x.fillRect(px, py, w, h); });
    return c;
  }
  var TILE = {};
  TILE.floorA = makeTile(function (r) { r(0, 0, T, T, PAL.floorA); r(3, 3, 1, 1, PAL.floorDot); r(11, 11, 1, 1, PAL.floorDot); });
  TILE.floorB = makeTile(function (r) { r(0, 0, T, T, PAL.floorB); r(11, 4, 1, 1, PAL.floorDot); r(4, 12, 1, 1, PAL.floorDot); });
  TILE.wall = makeTile(function (r) {
    r(0, 0, T, T, PAL.wallBase);
    for (var row = 0; row < 4; row++) {
      var y = row * 4;
      r(0, y, T, 1, PAL.wallHi);
      r(0, y + 3, T, 1, PAL.mortar);
      var offs = row % 2 ? [3, 11] : [7, 15];
      offs.forEach(function (ox) { r(ox, y, 1, 3, PAL.mortar); r(ox - 1, y + 1, 1, 2, PAL.wallLo); });
    }
  });
  function crateTile(p) {
    return makeTile(function (r) {
      r(0, 0, T, T, p.k);
      r(1, 1, 14, 14, p.m);
      r(1, 1, 14, 1, p.l); r(1, 1, 1, 14, p.l);
      r(1, 14, 14, 1, p.d); r(14, 1, 1, 14, p.d);
      r(3, 3, 10, 10, p.d);
      r(4, 4, 8, 8, p.m);
      for (var i = 0; i < 8; i++) { r(4 + i, 4 + i, 1, 1, p.x); r(11 - i, 4 + i, 1, 1, p.x); }
      r(2, 2, 1, 1, p.k); r(13, 2, 1, 1, p.k); r(2, 13, 1, 1, p.k); r(13, 13, 1, 1, p.k);
    });
  }
  TILE.crate = crateTile(PAL.crate);
  TILE.crateOn = crateTile(PAL.crateOn);
  TILE.robot = makeTile(function (r) {
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var ch = ROBOT[y][x];
      if (ch !== ".") r(x, y, 1, 1, ROBOT_PAL[ch]);
    }
  });

  function drawGoal(x, y, t) {
    var a = 0.55 + 0.45 * Math.sin(t / 260);
    ctx.globalAlpha = a;
    ctx.fillStyle = PAL.goal;
    var cx = x + 7, cy = y + 7;
    // pixel diamond
    for (var i = 0; i < 4; i++) {
      ctx.fillRect(cx - i, cy - 3 + i, 1, 1); ctx.fillRect(cx + 1 + i, cy - 3 + i, 1, 1);
      ctx.fillRect(cx - i, cy + 4 - i, 1, 1); ctx.fillRect(cx + 1 + i, cy + 4 - i, 1, 1);
    }
    ctx.fillRect(cx, cy, 2, 2);
    ctx.globalAlpha = 1;
  }

  function drawArrow(x, y, d, col) {
    ctx.fillStyle = col;
    // 7px arrow pointing up, rotated by direction
    var pts = [[3, 0], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [3, 3], [3, 4], [3, 5]];
    pts.forEach(function (p) {
      var px = p[0], py = p[1], rx, ry;
      if (d === 0) { rx = px; ry = py; }
      else if (d === 1) { rx = px; ry = 6 - py; }
      else if (d === 2) { rx = py; ry = px; }
      else { rx = 6 - py; ry = px; }
      ctx.fillRect(x + 4 + rx, y + 4 + ry, 1, 1);
    });
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function render(now) {
    requestAnimationFrame(render);
    if (!G) return;
    var t = 1;
    if (anim) {
      t = Math.min(1, (now - anim.t0) / MOVE_MS);
      if (t >= 1) { afterAnim(); t = 1; }
    }
    var et = ease(t);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var w = G.w, h = G.h, lv = G.lv, p, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      p = y * w + x;
      if (lv.wall[p]) {
        // only draw walls that touch the playfield
        if (touchesInside(x, y)) ctx.drawImage(TILE.wall, x * T, y * T);
      } else if (lv.inside[p]) {
        ctx.drawImage((x + y) % 2 ? TILE.floorB : TILE.floorA, x * T, y * T);
        if (lv.goal[p]) drawGoal(x * T, y * T, now);
      }
    }

    // hint: walking path + push arrow
    if (hintOn && solution && solution.ptr < solution.moves.length && !anim) {
      var blink = Math.floor(now / 220) % 2;
      var pp = G.player;
      for (var i = solution.ptr; i < solution.moves.length; i++) {
        var c = solution.moves[i], d = DIR[c.toLowerCase()];
        var nx = cellX(pp) + DV[d][0], ny = cellY(pp) + DV[d][1];
        if (c !== c.toLowerCase()) {
          drawArrow(nx * T, ny * T, d, blink ? PAL.hint : "#fff3b0");
          ctx.strokeStyle = PAL.hint; ctx.lineWidth = 1;
          ctx.strokeRect(nx * T + 0.5, ny * T + 0.5, T - 1, T - 1);
          break;
        }
        pp = ny * w + nx;
        ctx.fillStyle = PAL.hint;
        ctx.globalAlpha = blink ? 0.9 : 0.5;
        ctx.fillRect(cellX(pp) * T + 7, cellY(pp) * T + 7, 2, 2);
        ctx.globalAlpha = 1;
      }
    }

    // boxes
    G.boxes.forEach(function (b, i) {
      var bx = cellX(b) * T, by = cellY(b) * T;
      if (anim && anim.bi === i) {
        bx = lerp(cellX(anim.bFrom), cellX(anim.bTo), et) * T;
        by = lerp(cellY(anim.bFrom), cellY(anim.bTo), et) * T;
      }
      var on = lv.goal[b] && !(anim && anim.bi === i && t < 1);
      ctx.drawImage(on ? TILE.crateOn : TILE.crate, Math.round(bx), Math.round(by));
    });

    // hint arrow drawn over the box so it's visible
    if (hintOn && solution && !anim) {
      var pp2 = G.player;
      for (var j = solution.ptr; j < solution.moves.length; j++) {
        var c2 = solution.moves[j], d2 = DIR[c2.toLowerCase()];
        var nx2 = cellX(pp2) + DV[d2][0], ny2 = cellY(pp2) + DV[d2][1];
        if (c2 !== c2.toLowerCase()) {
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = "rgba(7,8,15,0.55)"; ctx.fillRect(nx2 * T + 3, ny2 * T + 3, 10, 10);
          drawArrow(nx2 * T, ny2 * T, d2, Math.floor(now / 220) % 2 ? PAL.hint : "#fff3b0");
          ctx.globalAlpha = 1;
          break;
        }
        pp2 = ny2 * w + nx2;
      }
    }

    // player
    var px = cellX(G.player) * T, py = cellY(G.player) * T, bob = 0;
    if (anim) {
      px = lerp(cellX(anim.pFrom), cellX(anim.pTo), et) * T;
      py = lerp(cellY(anim.pFrom), cellY(anim.pTo), et) * T;
      bob = t < 1 ? -Math.round(Math.sin(t * Math.PI)) : 0;
    } else if (G.won) {
      bob = -Math.round(Math.abs(Math.sin(now / 140)) * 2);
    }
    px = Math.round(px); py = Math.round(py) + bob;
    ctx.drawImage(TILE.robot, px, py);
    // eyes follow facing direction
    ctx.fillStyle = "#7ff6ff";
    var eo = { 0: null, 1: [6, 9], 2: [6, 8], 3: [7, 9] }[G.facing];
    if (eo) { ctx.fillRect(px + eo[0], py + 6, 1, 1); ctx.fillRect(px + eo[1], py + 6, 1, 1); }
    else { ctx.fillStyle = "#3a4c8a"; ctx.fillRect(px + 6, py + 6, 4, 1); }

    // particles
    for (var k = particles.length - 1; k >= 0; k--) {
      var q = particles[k];
      q.x += q.vx; q.y += q.vy; q.vy += 0.06; q.life--;
      if (q.life <= 0) { particles.splice(k, 1); continue; }
      ctx.fillStyle = q.c;
      ctx.globalAlpha = Math.min(1, q.life / 20);
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function touchesInside(x, y) {
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < G.w && ny < G.h && G.lv.inside[ny * G.w + nx]) return true;
    }
    return false;
  }

  function burst(cell, color) {
    if (reduceMotion) return;
    var cx = cellX(cell) * T + 8, cy = cellY(cell) * T + 8;
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.2;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 26 + Math.random() * 16, c: Math.random() < 0.3 ? "#ffffff" : color });
    }
  }

  function resize() {
    if (!G) return;
    canvas.width = G.w * T;
    canvas.height = G.h * T;
    ctx.imageSmoothingEnabled = false;
    var availW = stageEl.clientWidth - 8;
    var availH = Math.max(200, Math.min(window.innerHeight - 330, 560));
    var s = Math.min(availW / canvas.width, availH / canvas.height);
    if (s >= 2) s = Math.floor(s);          // crisp integer scaling when there's room
    s = Math.max(1, Math.min(s, 5));
    canvas.style.width = Math.round(canvas.width * s) + "px";
    canvas.style.height = Math.round(canvas.height * s) + "px";
  }
  window.addEventListener("resize", resize);

  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- chiptune sfx ----------
  var AC = null;
  function audio() {
    if (store.muted) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === "suspended") AC.resume();
    return AC;
  }
  function tone(freq, dur, opts) {
    var a = audio(); if (!a) return;
    opts = opts || {};
    var t0 = a.currentTime + (opts.delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = opts.type || "square";
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    var vol = opts.vol || 0.06;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function sfx(name) {
    switch (name) {
      case "step": tone(320, 0.035, { vol: 0.025 }); break;
      case "push": tone(140, 0.08, { to: 90, vol: 0.06 }); break;
      case "bump": tone(80, 0.07, { type: "sawtooth", to: 50, vol: 0.04 }); break;
      case "goal": [660, 880, 1320].forEach(function (f, i) { tone(f, 0.08, { delay: i * 0.05, vol: 0.05 }); }); break;
      case "undo": tone(520, 0.06, { to: 300, vol: 0.04 }); break;
      case "hint": tone(990, 0.05, { vol: 0.04 }); tone(1480, 0.07, { delay: 0.05, vol: 0.035 }); break;
      case "start": [392, 523, 659, 784].forEach(function (f, i) { tone(f, 0.09, { delay: i * 0.07, vol: 0.045 }); }); break;
      case "select": tone(660, 0.04, { vol: 0.035 }); break;
      case "win":
        [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3], [784, 0.42], [1047, 0.5]].forEach(function (n) {
          tone(n[0], n[1] >= 0.5 ? 0.35 : 0.1, { delay: n[1], vol: 0.05 });
        });
        tone(131, 0.6, { type: "triangle", vol: 0.08, delay: 0.3 });
        break;
    }
  }
  function vibrate(ms) { try { var ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} }
  function setMute(m) {
    store.muted = m; save();
    $("btn-sound").textContent = m ? "SND:OFF" : "SND:ON";
    $("btn-sound").setAttribute("aria-pressed", String(!m));
  }

  // ---------- input ----------
  var KEYMAP = {
    ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3,
    w: 0, s: 1, a: 2, d: 3, W: 0, S: 1, A: 2, D: 3
  };
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && screen === "play") { e.preventDefault(); undo(); }
      return;
    }
    var k = e.key;
    if (screen === "title") {
      if (k === "Enter" || k === " ") { e.preventDefault(); sfx("select"); showLevels(); }
      return;
    }
    if (screen === "levels") {
      if (k === "Escape" && G) { hideOverlays(); screen = "play"; return; }
      var grid = $("level-grid"), items = Array.prototype.slice.call(grid.children);
      var cur = items.indexOf(document.activeElement);
      var cols = Math.max(1, Math.round(grid.clientWidth / (items[0].offsetWidth + 8)));
      var mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[k];
      if (mv != null) {
        e.preventDefault();
        var n = Math.max(0, Math.min(items.length - 1, (cur < 0 ? 0 : cur) + mv));
        items[n].focus(); sfx("select");
      }
      return;
    }
    if (screen === "win") {
      if (k === "Enter" || k === " " || k === "n" || k === "N") { e.preventDefault(); next(); }
      else if (k === "r" || k === "R") restart();
      else if (k === "Escape") showLevels();
      return;
    }
    // play
    if (k in KEYMAP) { e.preventDefault(); tryMove(KEYMAP[k]); return; }
    switch (k) {
      case "z": case "Z": case "u": case "U": case "Backspace": e.preventDefault(); undo(); break;
      case "r": case "R": restart(); break;
      case "h": case "H": case "x": case "X": case "?": hint(); break;
      case "p": case "P": autoSolve(); break;
      case "i": case "I": cycleAlgo(); break;
      case "m": case "M": setMute(!store.muted); break;
      case "Escape": showLevels(); break;
    }
  });

  // swipe on the board
  var touch = null;
  stageEl.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  stageEl.addEventListener("touchmove", function (e) { if (touch && screen === "play") e.preventDefault(); }, { passive: false });
  stageEl.addEventListener("touchend", function (e) {
    if (!touch) return;
    var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 3 : 2); else tryMove(dy > 0 ? 1 : 0);
  });

  // on-screen d-pad with hold-to-repeat
  Array.prototype.forEach.call(document.querySelectorAll("[data-dir]"), function (b) {
    var d = +b.getAttribute("data-dir"), rep = null, first = null;
    function start(e) {
      e.preventDefault();
      tryMove(d); vibrate(6);
      first = setTimeout(function () { rep = setInterval(function () { tryMove(d); }, 150); }, 260);
    }
    function end() { clearTimeout(first); clearInterval(rep); }
    b.addEventListener("pointerdown", start);
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { b.addEventListener(ev, end); });
  });

  function on(id, fn) { $(id).addEventListener("click", function () { sfx("select"); fn(); }); }
  on("btn-start", showLevels);
  on("btn-undo", undo);
  on("btn-reset", restart);
  on("btn-hint", hint);
  on("btn-solve", autoSolve);
  on("btn-algo", cycleAlgo);
  on("btn-levels", showLevels);
  on("btn-next", next);
  on("btn-retry", restart);
  on("btn-win-levels", showLevels);
  on("btn-back", function () { if (G) { hideOverlays(); screen = "play"; } else showTitle(); });
  $("btn-sound").addEventListener("click", function () { setMute(!store.muted); sfx("select"); });
  $("title").addEventListener("click", function (e) { if (e.target.id !== "btn-start") { sfx("select"); showLevels(); } });

  // ---------- boot ----------
  setMute(!!store.muted);
  $("btn-algo").textContent = "AI:" + ALGO_LABEL[store.algo];
  loadLevel(Math.min(store.last || 0, LEVELS.length - 1));
  showTitle();
  requestAnimationFrame(render);

  // exposed for debugging / tests
  window.__sokoban = { levels: LEVELS, solver: S, state: function () { return G; } };
})();
