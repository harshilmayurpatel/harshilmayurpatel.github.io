/* =========================================================
   Sokoban AI solver
   - Search over "push states": (box positions, player region)
   - DFS (default, heuristic-ordered), BFS (push-optimal) or A*
   - Dead-square + 2x2 freeze deadlock pruning
   Works in the browser (window.SokobanSolver) and in Node.
   ========================================================= */
(function (root) {
  "use strict";

  // Parse an XSB level string: # wall, . goal, $ box, * box on goal, @ player, + player on goal
  function parse(src) {
    var rows = src.replace(/\r/g, "").split("\n");
    while (rows.length && !rows[0].trim()) rows.shift();
    while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
    var h = rows.length, w = 0, i;
    for (i = 0; i < h; i++) w = Math.max(w, rows[i].length);
    var wall = new Uint8Array(w * h), goal = new Uint8Array(w * h);
    var boxes = [], player = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var c = rows[y][x] || " ", p = y * w + x;
        if (c === "#") wall[p] = 1;
        if (c === "." || c === "*" || c === "+") goal[p] = 1;
        if (c === "$" || c === "*") boxes.push(p);
        if (c === "@" || c === "+") player = p;
      }
    }
    // Mark cells outside the walls as void (not reachable by flood from player)
    var inside = new Uint8Array(w * h), stack = [player];
    inside[player] = 1;
    while (stack.length) {
      var q = stack.pop(), qx = q % w, qy = (q / w) | 0;
      var nb = [qx > 0 ? q - 1 : -1, qx < w - 1 ? q + 1 : -1, qy > 0 ? q - w : -1, qy < h - 1 ? q + w : -1];
      for (i = 0; i < 4; i++) {
        var n = nb[i];
        if (n >= 0 && !wall[n] && !inside[n]) { inside[n] = 1; stack.push(n); }
      }
    }
    return { w: w, h: h, wall: wall, goal: goal, inside: inside, boxes: boxes.sort(function (a, b) { return a - b; }), player: player };
  }

  var DIRS = [
    { dx: 0, dy: -1, ch: "u" },
    { dx: 0, dy: 1, ch: "d" },
    { dx: -1, dy: 0, ch: "l" },
    { dx: 1, dy: 0, ch: "r" }
  ];

  function solve(level, boxesIn, playerIn, opts) {
    opts = opts || {};
    var algo = opts.algo || "dfs";
    var maxNodes = opts.maxNodes || 400000;
    var w = level.w, h = level.h, N = w * h;
    var wall = level.wall, goal = level.goal, inside = level.inside;
    var off = DIRS.map(function (d) { return d.dy * w + d.dx; });

    function floor(p) { return p >= 0 && p < N && !wall[p] && inside[p]; }
    function step(p, d) {
      var x = p % w + DIRS[d].dx, y = ((p / w) | 0) + DIRS[d].dy;
      if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      return y * w + x;
    }

    // ---- Dead squares: cells from which no goal can ever be reached by pushing
    var live = new Uint8Array(N), queue = [], i, d;
    for (i = 0; i < N; i++) if (goal[i] && floor(i)) { live[i] = 1; queue.push(i); }
    while (queue.length) {
      var g = queue.shift();
      for (d = 0; d < 4; d++) {
        var prev = step(g, d), pl = prev >= 0 ? step(prev, d) : -1;
        // box was at prev, player at pl, pushed toward g (opposite of d)
        if (floor(prev) && floor(pl) && !live[prev]) { live[prev] = 1; queue.push(prev); }
      }
    }

    // ---- Distance tables for heuristic (push distance ignoring other boxes)
    var goals = [];
    for (i = 0; i < N; i++) if (goal[i] && floor(i)) goals.push(i);
    var minDist = new Int32Array(N).fill(1e6);
    goals.forEach(function (gp) {
      var dist = new Int32Array(N).fill(-1), q2 = [gp];
      dist[gp] = 0;
      while (q2.length) {
        var c = q2.shift();
        for (var dd = 0; dd < 4; dd++) {
          var pb = step(c, dd), pp = pb >= 0 ? step(pb, dd) : -1;
          if (floor(pb) && floor(pp) && dist[pb] < 0) { dist[pb] = dist[c] + 1; q2.push(pb); }
        }
      }
      for (var k = 0; k < N; k++) if (dist[k] >= 0 && dist[k] < minDist[k]) minDist[k] = dist[k];
    });
    function heuristic(boxes) {
      var s = 0;
      for (var k = 0; k < boxes.length; k++) s += minDist[boxes[k]];
      return s;
    }

    var boxMap = new Uint8Array(N);
    function setBoxes(boxes, v) { for (var k = 0; k < boxes.length; k++) boxMap[boxes[k]] = v; }

    // Player reachable region with boxes as obstacles. Returns {mark, min}
    var mark = new Int32Array(N), stamp = 0;
    function region(start) {
      stamp++;
      var st = [start], mn = start;
      mark[start] = stamp;
      while (st.length) {
        var c = st.pop();
        if (c < mn) mn = c;
        for (var dd = 0; dd < 4; dd++) {
          var n = c + off[dd];
          if (n >= 0 && n < N && mark[n] !== stamp && floor(n) && !boxMap[n] && Math.abs((n % w) - (c % w)) <= 1) {
            mark[n] = stamp; st.push(n);
          }
        }
      }
      return mn;
    }

    // 2x2 freeze deadlock around a freshly pushed box
    function blocked(p) { return !floor(p) || boxMap[p]; }
    function frozen2x2(b) {
      var bx = b % w;
      var corners = [[-1, -w, -w - 1], [1, -w, -w + 1], [-1, w, w - 1], [1, w, w + 1]];
      for (var k = 0; k < 4; k++) {
        var c = corners[k];
        if ((c[0] === -1 && bx === 0) || (c[0] === 1 && bx === w - 1)) continue;
        var a = b + c[0], u = b + c[1], dg = b + c[2];
        if (blocked(a) && blocked(u) && blocked(dg)) {
          // all four occupied by wall/box — deadlock if any box in the square is off-goal
          var sq = [b, a, u, dg], bad = false;
          for (var m = 0; m < 4; m++) if (boxMap[sq[m]] && floor(sq[m]) && !goal[sq[m]]) bad = true;
          if (bad) return true;
        }
      }
      return false;
    }

    function isSolved(boxes) {
      for (var k = 0; k < boxes.length; k++) if (!goal[boxes[k]]) return false;
      return true;
    }

    var startBoxes = boxesIn.slice().sort(function (a, b) { return a - b; });
    setBoxes(startBoxes, 1);
    var startNorm = region(playerIn);
    setBoxes(startBoxes, 0);

    var nodes = [{ boxes: startBoxes, player: playerIn, parent: -1, push: null, g: 0 }];
    var seen = new Set();
    seen.add(startBoxes.join(",") + "|" + startNorm);
    var explored = 0, found = -1;

    if (isSolved(startBoxes)) found = 0;

    // Frontier helpers per algorithm
    var frontier = [0], heap = [];
    function heapPush(item) {
      heap.push(item);
      var k = heap.length - 1;
      while (k > 0) {
        var pa = (k - 1) >> 1;
        if (heap[pa].f <= heap[k].f) break;
        var t = heap[pa]; heap[pa] = heap[k]; heap[k] = t; k = pa;
      }
    }
    function heapPop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        var k = 0;
        for (;;) {
          var l = 2 * k + 1, r = l + 1, s = k;
          if (l < heap.length && heap[l].f < heap[s].f) s = l;
          if (r < heap.length && heap[r].f < heap[s].f) s = r;
          if (s === k) break;
          var t = heap[s]; heap[s] = heap[k]; heap[k] = t; k = s;
        }
      }
      return top;
    }
    if (algo === "astar") { frontier = null; heapPush({ id: 0, f: heuristic(startBoxes) }); }
    var head = 0;

    while (found < 0) {
      var id;
      if (algo === "astar") { if (!heap.length) break; id = heapPop().id; }
      else if (algo === "bfs") { if (head >= frontier.length) break; id = frontier[head++]; }
      else { if (!frontier.length) break; id = frontier.pop(); }

      if (++explored > maxNodes) break;
      var node = nodes[id], boxes = node.boxes;
      setBoxes(boxes, 1);
      region(node.player);
      var regionStamp = stamp;
      var children = [];

      for (var bi = 0; bi < boxes.length && found < 0; bi++) {
        var b = boxes[bi];
        for (d = 0; d < 4; d++) {
          var behind = b - off[d], target = step(b, d);
          if (behind < 0 || behind >= N || mark[behind] !== regionStamp) continue;
          if (Math.abs((behind % w) - (b % w)) > 1) continue;
          if (!floor(target) || boxMap[target] || !live[target]) continue;

          boxMap[b] = 0; boxMap[target] = 1;
          var dead = frozen2x2(target), touched = false;
          if (!dead) {
            touched = true;
            var nb2 = boxes.slice(); nb2[bi] = target;
            nb2.sort(function (a, c) { return a - c; });
            var norm = region(b);
            var key = nb2.join(",") + "|" + norm;
            if (!seen.has(key)) {
              seen.add(key);
              nodes.push({ boxes: nb2, player: b, parent: id, push: { from: b, dir: d }, g: node.g + 1 });
              var cid = nodes.length - 1;
              if (isSolved(nb2)) { found = cid; }
              children.push({ id: cid, hv: heuristic(nb2) });
            }
          }
          boxMap[target] = 0; boxMap[b] = 1;
          if (touched) {
            // restore region marks for remaining push checks
            region(node.player);
            regionStamp = stamp;
          }
          if (found >= 0) break;
        }
      }
      setBoxes(boxes, 0);

      if (algo === "astar") {
        children.forEach(function (c) { heapPush({ id: c.id, f: nodes[c.id].g + c.hv }); });
      } else if (algo === "bfs") {
        children.forEach(function (c) { frontier.push(c.id); });
      } else {
        // DFS: explore most promising child first (pushed last onto the stack)
        children.sort(function (a, c) { return c.hv - a.hv; });
        children.forEach(function (c) { frontier.push(c.id); });
      }
    }

    if (found < 0) return { ok: false, explored: explored, limit: explored > maxNodes };

    // Rebuild push list
    var pushes = [];
    for (var cur = found; nodes[cur].parent >= 0; cur = nodes[cur].parent) pushes.push(nodes[cur].push);
    pushes.reverse();

    // Expand pushes into player moves (lowercase = walk, uppercase = push)
    var moves = "", pos = playerIn, bx2 = startBoxes.slice();
    for (var pi = 0; pi < pushes.length; pi++) {
      var ps = pushes[pi], need = ps.from - off[ps.dir];
      setBoxes(bx2, 1);
      var path = walkPath(pos, need);
      setBoxes(bx2, 0);
      moves += path + DIRS[ps.dir].ch.toUpperCase();
      var idx = bx2.indexOf(ps.from);
      bx2[idx] = step(ps.from, ps.dir);
      pos = ps.from;
    }
    return { ok: true, moves: moves, pushes: pushes.length, explored: explored };

    function walkPath(from, to) {
      if (from === to) return "";
      var prevArr = new Int32Array(N).fill(-2), q3 = [from];
      prevArr[from] = -1;
      while (q3.length) {
        var c = q3.shift();
        if (c === to) break;
        for (var dd = 0; dd < 4; dd++) {
          var n = step(c, dd);
          if (n >= 0 && prevArr[n] === -2 && floor(n) && !boxMap[n]) { prevArr[n] = c * 4 + dd; q3.push(n); }
        }
      }
      var s = "";
      for (var c2 = to; c2 !== from;) {
        var v = prevArr[c2];
        s = DIRS[v & 3].ch + s;
        c2 = v >> 2;
      }
      return s;
    }
  }

  var api = { parse: parse, solve: solve, DIRS: DIRS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SokobanSolver = api;

  // Running as a Web Worker: solve off the main thread so the game never freezes
  if (typeof importScripts === "function" && typeof self !== "undefined") {
    self.onmessage = function (e) {
      var m = e.data, t0 = Date.now();
      var r = solve(parse(m.src), m.boxes, m.player, m.opts);
      r.id = m.id; r.ms = Date.now() - t0;
      self.postMessage(r);
    };
  }
})(this);
