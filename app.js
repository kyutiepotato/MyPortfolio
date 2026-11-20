/* =====================================================================
   apps.js  -  Music Player + Arcade (Chess & Flappy Bird)
   Load this AFTER your main <script> block in index.html:
       <script src="apps.js"></script>
   ===================================================================== */

// Per-window cleanup callbacks (stop audio, stop game loops, ...)
const windowCleanup = {};

const escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

/* ---------------------------------------------------------------------
   Styles (injected so you don't have to touch your <style> block)
   --------------------------------------------------------------------- */
(function injectAppStyles() {
    if (typeof document === 'undefined') return;
    const css = `
    /* desktop icons made with Font Awesome */
    .icon-img i { font-size: 40px; line-height: 48px; text-shadow: 0 2px 6px rgba(0,0,0,.6); }

    /* ---------- Music player ---------- */
    .music { display:flex; flex-direction:column; height:100%; gap:.75rem; padding:1rem;
             background:linear-gradient(#1b2a41,#0c1524); color:#fff; }
    .music-now { display:flex; align-items:center; gap:1rem; }
    .music-disc { font-size:4rem; color:#4a90e2; width:72px; text-align:center; }
    .music.is-playing .music-disc i { animation: music-spin 3s linear infinite; }
    @keyframes music-spin { to { transform: rotate(360deg); } }
    .music-title { font-size:1.1rem; font-weight:600; }
    .music-artist { font-size:.8rem; color:#9fb3c8; }
    .music-seek { display:flex; align-items:center; gap:.5rem; font-size:.75rem; }
    .music-seek input { flex:1; }
    .music-controls { display:flex; align-items:center; gap:.75rem; }
    .music-controls button { width:36px; height:36px; border:none; border-radius:50%;
                             background:#2c5aa0; color:#fff; cursor:pointer; }
    .music-controls button:hover { background:#3a6fc0; }
    .music-controls .m-play { width:46px; height:46px; font-size:1.1rem; background:#4a90e2; }
    .music-controls .m-volicon { margin-left:auto; color:#9fb3c8; }
    .music-controls .m-vol { width:90px; }
    .music-list { list-style:none; flex:1; overflow-y:auto; border-top:1px solid rgba(255,255,255,.15); }
    .music-list li { display:flex; gap:.75rem; padding:.5rem; cursor:pointer; font-size:.85rem;
                     border-bottom:1px solid rgba(255,255,255,.07); }
    .music-list li:hover { background:rgba(255,255,255,.08); }
    .music-list li.playing { background:rgba(74,144,226,.25); color:#8fc1ff; }
    .music-list li span { width:1.5rem; color:#789; }
    .music-list li em { margin-left:auto; font-style:normal; color:#9fb3c8; }

    /* ---------- Arcade ---------- */
    .arcade { display:flex; flex-direction:column; height:100%; background:#2b2b2b; color:#fff; }
    .arcade-tabs { display:flex; gap:4px; padding:6px 6px 0; background:#1e1e1e; }
    .arcade-tabs button { padding:6px 14px; border:none; border-radius:4px 4px 0 0; cursor:pointer;
                          background:#3a3a3a; color:#ccc; font-size:.8rem; }
    .arcade-tabs button i { margin-right:6px; }
    .arcade-tabs button.active { background:#4a90e2; color:#fff; }
    .arcade-pane { flex:1; display:flex; flex-direction:column; align-items:center;
                   justify-content:center; gap:6px; padding:6px; }

    .chess-bar { display:flex; gap:6px; }
    .chess-bar select, .chess-bar button { padding:4px 10px; font-size:.8rem; border-radius:3px;
                                           border:1px solid #555; background:#444; color:#fff; cursor:pointer; }
    .chess-status { font-size:.85rem; min-height:1.2rem; color:#ddd; }
    .chess-board { display:grid; grid-template-columns:repeat(8,42px); grid-template-rows:repeat(8,42px);
                   border:3px solid #5a3b1e; }
    .chess-board .sq { position:relative; display:flex; align-items:center; justify-content:center; cursor:pointer; }
    .chess-board .sq.lt { background:#f0d9b5; }
    .chess-board .sq.dk { background:#b58863; }
    .chess-board .sq.last { box-shadow: inset 0 0 0 3px rgba(255,200,0,.85); }
    .chess-board .sq.sel { background:#f6f669; }
    .chess-board .sq.chk { background:#e74c3c; }
    .chess-board .sq.dot::after { content:''; position:absolute; width:12px; height:12px;
                                  border-radius:50%; background:rgba(0,0,0,.28); }
    .chess-board .sq.cap::after { content:''; position:absolute; inset:2px;
                                  border:4px solid rgba(0,0,0,.28); border-radius:50%; }
    .chess-board .pc { font-size:32px; line-height:1; pointer-events:none; }
    .chess-board .pc.w { color:#fff; text-shadow:0 0 2px #000, 0 0 2px #000, 0 0 1px #000; }
    .chess-board .pc.b { color:#1a1a1a; }

    .arcade canvas { border:3px solid #111; border-radius:4px; cursor:pointer; background:#4ec0ca; }
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
})();


/* =====================================================================
   MUSIC PLAYER
   ===================================================================== */
const musicData = {};

async function getMusicContent(id) {
    try {
        const res = await fetch('data/music.json');
        const songs = await res.json();
        if (!Array.isArray(songs) || !songs.length) {
            return '<div style="padding:2rem;">No songs yet. Add rows to the <b>music</b> table.</div>';
        }
        musicData[id] = songs;

        return `
        <div class="music" id="music-${id}">
            <div class="music-now">
                <div class="music-disc"><i class="fas fa-compact-disc"></i></div>
                <div>
                    <div class="music-title">-</div>
                    <div class="music-artist">-</div>
                </div>
            </div>
            <div class="music-seek">
                <span class="m-cur">0:00</span>
                <input type="range" class="m-seek" min="0" max="100" step="0.1" value="0">
                <span class="m-dur">0:00</span>
            </div>
            <div class="music-controls">
                <button class="m-prev" title="Previous"><i class="fas fa-backward-step"></i></button>
                <button class="m-play" title="Play / Pause"><i class="fas fa-play"></i></button>
                <button class="m-next" title="Next"><i class="fas fa-forward-step"></i></button>
                <i class="fas fa-volume-high m-volicon"></i>
                <input type="range" class="m-vol" min="0" max="1" step="0.05" value="0.8">
            </div>
            <ul class="music-list">
                ${songs.map((s, i) => `
                    <li data-i="${i}"><span>${i + 1}</span><b>${escHtml(s.title)}</b><em>${escHtml(s.artist)}</em></li>
                `).join('')}
            </ul>
        </div>`;
    } catch (err) {
        console.error('Error loading music:', err);
        return '<div style="padding:2rem;">Could not load music. Did you create the <b>music</b> table and add the <code>music</code> case to api.php?</div>';
    }
}

function initMusic(id) {
    const root = document.getElementById(`music-${id}`);
    const songs = musicData[id];
    if (!root || !songs) return;

    const q = sel => root.querySelector(sel);
    const audio = new Audio();
    SystemVolume.register(audio);
    let idx = 0, seeking = false;

    const fmt = t => (!isFinite(t) || isNaN(t)) ? '0:00'
        : Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

    function load(i, autoplay) {
        idx = (i + songs.length) % songs.length;
        const s = songs[idx];
        audio.src = s.file_url;
        q('.music-title').textContent = s.title;
        q('.music-artist').textContent = s.artist || 'Unknown artist';
        q('.m-seek').value = 0;
        q('.m-cur').textContent = '0:00';
        q('.m-dur').textContent = '0:00';
        root.querySelectorAll('.music-list li').forEach((li, n) => li.classList.toggle('playing', n === idx));
        if (autoplay) audio.play().catch(() => {});
    }

    function syncPlayIcon() {
        q('.m-play i').className = audio.paused ? 'fas fa-play' : 'fas fa-pause';
        root.classList.toggle('is-playing', !audio.paused);
    }

    q('.m-play').onclick = () => audio.paused ? audio.play().catch(() => {}) : audio.pause();
    q('.m-prev').onclick = () => load(idx - 1, true);
    q('.m-next').onclick = () => load(idx + 1, true);
    q('.m-vol').oninput = e => SystemVolume.set(+e.target.value);
    SystemVolume.onChange(v => { q('.m-vol').value = v.muted ? 0 : v.level; }, root);
    q('.m-seek').oninput = e => {
        seeking = true;
        q('.m-cur').textContent = fmt(audio.duration * e.target.value / 100);
    };
    q('.m-seek').onchange = e => {
        if (audio.duration) audio.currentTime = audio.duration * e.target.value / 100;
        seeking = false;
    };
    root.querySelectorAll('.music-list li').forEach(li => { li.onclick = () => load(+li.dataset.i, true); });

    audio.addEventListener('play', syncPlayIcon);
    audio.addEventListener('pause', syncPlayIcon);
    audio.addEventListener('loadedmetadata', () => { q('.m-dur').textContent = fmt(audio.duration); });
    audio.addEventListener('timeupdate', () => {
        if (seeking || !audio.duration) return;
        q('.m-seek').value = audio.currentTime / audio.duration * 100;
        q('.m-cur').textContent = fmt(audio.currentTime);
    });
    audio.addEventListener('ended', () => load(idx + 1, true));
    audio.addEventListener('error', () => {
        if (!audio.getAttribute('src')) return;
        q('.music-artist').textContent = 'File not found: ' + songs[idx].file_url;
    });

    load(0, false);
    windowCleanup[id] = () => { audio.pause(); audio.removeAttribute('src'); audio.load(); };
}


/* =====================================================================
   CHESS ENGINE  (legal moves, castling, en passant, promotion -> queen,
                  check / checkmate / stalemate, simple AI)
   Board: array of 64, index = row*8 + col, row 0 = rank 8 (top).
   Pieces: 'wK','bP', ...
   ===================================================================== */
const ChessEngine = (() => {
    const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟\uFE0E' };
    const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
    const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const DIRS = ORTH.concat(DIAG);
    const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
    const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
    const other = c => (c === 'w' ? 'b' : 'w');

    function init() {
        const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
        const b = Array(64).fill(null);
        for (let c = 0; c < 8; c++) {
            b[c] = 'b' + back[c];
            b[8 + c] = 'bP';
            b[48 + c] = 'wP';
            b[56 + c] = 'w' + back[c];
        }
        return { b, turn: 'w', castle: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1 };
    }

    function kingSq(b, color) { return b.indexOf(color + 'K'); }

    // Is square `sq` attacked by color `by`?
    function attacked(b, sq, by) {
        const r = sq >> 3, c = sq & 7;
        const pr = by === 'w' ? r + 1 : r - 1;
        for (const dc of [-1, 1]) {
            if (inb(pr, c + dc) && b[pr * 8 + c + dc] === by + 'P') return true;
        }
        for (const [dr, dc] of KN) {
            if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'N') return true;
        }
        for (const [dr, dc] of DIRS) {
            if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'K') return true;
        }
        for (const [dirs, kinds] of [[DIAG, 'BQ'], [ORTH, 'RQ']]) {
            for (const [dr, dc] of dirs) {
                let rr = r + dr, cc = c + dc;
                while (inb(rr, cc)) {
                    const p = b[rr * 8 + cc];
                    if (p) {
                        if (p[0] === by && kinds.includes(p[1])) return true;
                        break;
                    }
                    rr += dr; cc += dc;
                }
            }
        }
        return false;
    }

    function pseudo(s) {
        const { b, turn: me, castle, ep } = s;
        const op = other(me), out = [];
        for (let f = 0; f < 64; f++) {
            const p = b[f];
            if (!p || p[0] !== me) continue;
            const r = f >> 3, c = f & 7, t = p[1];

            if (t === 'P') {
                const d = me === 'w' ? -1 : 1;
                const start = me === 'w' ? 6 : 1;
                const end = me === 'w' ? 0 : 7;
                const r1 = r + d;
                if (inb(r1, c) && !b[r1 * 8 + c]) {
                    out.push({ f, t: r1 * 8 + c, promo: r1 === end });
                    if (r === start && !b[(r + 2 * d) * 8 + c]) out.push({ f, t: (r + 2 * d) * 8 + c, dbl: true });
                }
                for (const dc of [-1, 1]) {
                    const cc = c + dc;
                    if (!inb(r1, cc)) continue;
                    const to = r1 * 8 + cc, tp = b[to];
                    if (tp && tp[0] === op) out.push({ f, t: to, promo: r1 === end });
                    else if (!tp && to === ep) out.push({ f, t: to, ep: true });
                }
            } else if (t === 'N' || t === 'K') {
                for (const [dr, dc] of (t === 'N' ? KN : DIRS)) {
                    const rr = r + dr, cc = c + dc;
                    if (!inb(rr, cc)) continue;
                    const tp = b[rr * 8 + cc];
                    if (!tp || tp[0] === op) out.push({ f, t: rr * 8 + cc });
                }
                if (t === 'K' && f === (me === 'w' ? 60 : 4) && !attacked(b, f, op)) {
                    if (castle[me + 'K'] && !b[f + 1] && !b[f + 2] && b[f + 3] === me + 'R' &&
                        !attacked(b, f + 1, op) && !attacked(b, f + 2, op)) {
                        out.push({ f, t: f + 2, castle: 'K' });
                    }
                    if (castle[me + 'Q'] && !b[f - 1] && !b[f - 2] && !b[f - 3] && b[f - 4] === me + 'R' &&
                        !attacked(b, f - 1, op) && !attacked(b, f - 2, op)) {
                        out.push({ f, t: f - 2, castle: 'Q' });
                    }
                }
            } else {
                const dirs = t === 'B' ? DIAG : t === 'R' ? ORTH : DIRS;
                for (const [dr, dc] of dirs) {
                    let rr = r + dr, cc = c + dc;
                    while (inb(rr, cc)) {
                        const tp = b[rr * 8 + cc];
                        if (!tp) out.push({ f, t: rr * 8 + cc });
                        else { if (tp[0] === op) out.push({ f, t: rr * 8 + cc }); break; }
                        rr += dr; cc += dc;
                    }
                }
            }
        }
        return out;
    }

    function apply(s, m) {
        const b = s.b.slice();
        const p = b[m.f], me = p[0];
        const castle = Object.assign({}, s.castle);
        b[m.t] = m.promo ? me + 'Q' : p;
        b[m.f] = null;
        if (m.ep) b[m.t + (me === 'w' ? 8 : -8)] = null;
        if (m.castle === 'K') { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = null; }
        if (m.castle === 'Q') { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = null; }
        if (p[1] === 'K') { castle[me + 'K'] = 0; castle[me + 'Q'] = 0; }
        for (const sq of [m.f, m.t]) {
            if (sq === 63) castle.wK = 0;
            if (sq === 56) castle.wQ = 0;
            if (sq === 7) castle.bK = 0;
            if (sq === 0) castle.bQ = 0;
        }
        return { b, turn: other(me), castle, ep: m.dbl ? (m.f + m.t) / 2 : -1 };
    }

    function legal(s) {
        return pseudo(s).filter(m => {
            const n = apply(s, m);
            return !attacked(n.b, kingSq(n.b, s.turn), n.turn);
        });
    }

    function inCheck(s) {
        return attacked(s.b, kingSq(s.b, s.turn), other(s.turn));
    }

    // ---- AI ----
    function evaluate(s) {
        let v = 0;
        for (let i = 0; i < 64; i++) {
            const p = s.b[i];
            if (!p) continue;
            const r = i >> 3, c = i & 7;
            let x = VAL[p[1]];
            if ('NBP'.includes(p[1])) x += 10 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) * 3;
            if (p[1] === 'P') x += (p[0] === 'w' ? 6 - r : r - 1) * 5;
            v += p[0] === 'w' ? x : -x;
        }
        return s.turn === 'w' ? v : -v;
    }

    function negamax(s, depth, alpha, beta, ply) {
        if (depth === 0) return evaluate(s);
        const mv = legal(s);
        if (!mv.length) return inCheck(s) ? -100000 + ply : 0;
        mv.sort((x, y) => (s.b[y.t] ? 1 : 0) - (s.b[x.t] ? 1 : 0));
        for (const m of mv) {
            const sc = -negamax(apply(s, m), depth - 1, -beta, -alpha, ply + 1);
            if (sc >= beta) return sc;
            if (sc > alpha) alpha = sc;
        }
        return alpha;
    }

    function bestMove(s, depth) {
        const mv = legal(s);
        let best = [], bestScore = -Infinity;
        for (const m of mv) {
            const sc = -negamax(apply(s, m), depth - 1, -Infinity, Infinity, 1);
            if (sc > bestScore) { bestScore = sc; best = [m]; }
            else if (sc === bestScore) best.push(m);
        }
        return best[Math.floor(Math.random() * best.length)];
    }

    return { init, legal, apply, inCheck, kingSq, bestMove, glyph: t => GLYPH[t] };
})();


/* =====================================================================
   ARCADE WINDOW  (tabs: Chess | Flappy Bird)
   ===================================================================== */
function getArcadeContent(id) {
    return `
    <div class="arcade" id="arcade-${id}">
        <div class="arcade-tabs">
            <button class="active" data-tab="chess"><i class="fas fa-chess-knight"></i>Chess</button>
            <button data-tab="flappy"><i class="fas fa-dove"></i>Flappy Bird</button>
        </div>
        <div class="arcade-pane" data-pane="chess">
            <div class="chess-bar">
                <select class="chess-mode">
                    <option value="ai">vs Computer</option>
                    <option value="2p">2 Players</option>
                </select>
                <button class="chess-new">New game</button>
            </div>
            <div class="chess-status"></div>
            <div class="chess-board"></div>
        </div>
        <div class="arcade-pane" data-pane="flappy" style="display:none">
            <canvas width="300" height="400"></canvas>
        </div>
    </div>`;
}

function initArcade(id) {
    const root = document.getElementById(`arcade-${id}`);
    if (!root) return;

    let tab = 'chess';
    root.querySelectorAll('.arcade-tabs button').forEach(btn => {
        btn.onclick = () => {
            tab = btn.dataset.tab;
            root.querySelectorAll('.arcade-tabs button').forEach(b => b.classList.toggle('active', b === btn));
            root.querySelectorAll('.arcade-pane').forEach(p => {
                p.style.display = p.dataset.pane === tab ? '' : 'none';
            });
            btn.blur();
        };
    });

    initChess(root);
    const stopFlappy = initFlappy(root, id, () => tab === 'flappy');
    windowCleanup[id] = () => stopFlappy();
}


/* ---------------------------------------------------------------------
   Chess UI
   --------------------------------------------------------------------- */
function initChess(root) {
    const E = ChessEngine;
    const pane = root.querySelector('[data-pane="chess"]');
    const boardEl = pane.querySelector('.chess-board');
    const statusEl = pane.querySelector('.chess-status');
    const modeEl = pane.querySelector('.chess-mode');

    let st, moves, sel, last, over, thinking, legalAll, gameId = 0;

    function newGame() {
        gameId++;
        st = E.init();
        sel = -1; moves = []; last = null; over = false; thinking = false;
        legalAll = E.legal(st);
        render();
    }

    function render() {
        const chk = E.inCheck(st);
        const ksq = chk ? E.kingSq(st.b, st.turn) : -1;
        let h = '';
        for (let i = 0; i < 64; i++) {
            const p = st.b[i];
            let cls = 'sq ' + ((((i >> 3) + (i & 7)) % 2) ? 'dk' : 'lt');
            if (last && (i === last.f || i === last.t)) cls += ' last';
            if (i === sel) cls += ' sel';
            if (i === ksq) cls += ' chk';
            const mv = moves.find(m => m.t === i);
            if (mv) cls += (p || mv.ep) ? ' cap' : ' dot';
            h += `<div class="${cls}" data-sq="${i}">${p ? `<span class="pc ${p[0]}">${E.glyph(p[1])}</span>` : ''}</div>`;
        }
        boardEl.innerHTML = h;

        let msg;
        if (over === 'mate') msg = `Checkmate! ${st.turn === 'w' ? 'Black' : 'White'} wins`;
        else if (over === 'stale') msg = 'Stalemate - draw';
        else if (thinking) msg = 'Computer is thinking...';
        else if (modeEl.value === 'ai') msg = (st.turn === 'w' ? 'Your move (White)' : 'Computer to move') + (chk ? ' - check!' : '');
        else msg = (st.turn === 'w' ? 'White' : 'Black') + ' to move' + (chk ? ' - check!' : '');
        statusEl.textContent = msg;
    }

    function play(m) {
        st = E.apply(st, m);
        last = m; sel = -1; moves = [];
        legalAll = E.legal(st);
        over = legalAll.length ? false : (E.inCheck(st) ? 'mate' : 'stale');

        if (!over && modeEl.value === 'ai' && st.turn === 'b') {
            const my = gameId;
            thinking = true;
            render();
            setTimeout(() => {
                if (my !== gameId || !root.isConnected) return;
                const reply = E.bestMove(st, 3);
                thinking = false;
                if (reply) play(reply); else render();
            }, 60);
        } else {
            render();
        }
    }

    boardEl.onclick = e => {
        const el = e.target.closest('[data-sq]');
        if (!el || over || thinking) return;
        if (modeEl.value === 'ai' && st.turn !== 'w') return;
        const i = +el.dataset.sq;

        const mv = moves.find(m => m.t === i);
        if (sel !== -1 && mv) { play(mv); return; }

        const p = st.b[i];
        if (p && p[0] === st.turn) {
            sel = i;
            moves = legalAll.filter(m => m.f === i);
        } else {
            sel = -1; moves = [];
        }
        render();
    };

    pane.querySelector('.chess-new').onclick = newGame;
    modeEl.onchange = newGame;
    newGame();
}


/* ---------------------------------------------------------------------
   Flappy Bird  (fixed 60 FPS timestep, so it plays the same on any monitor)
   Returns a cleanup function.
   --------------------------------------------------------------------- */
function initFlappy(root, id, isActiveTab) {
    const cv = root.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, GROUND = H - 50;
    const BX = 70, R = 12, GRAVITY = 0.32, JUMP = -5.6, GAP = 120, PW = 52, SPEED = 2;
    const STEP = 1000 / 60;
    const FONT = '"Segoe UI", Tahoma, sans-serif';

    let bird, pipes, score, state, tick = 0, groundX = 0, overAt = 0;
    let raf = 0, lastT = 0, acc = 0, best = 0;
    try { best = +localStorage.getItem('flappyBest') || 0; } catch (e) {}

    function reset() {
        bird = { y: H / 2 - 30, vy: 0 };
        pipes = []; score = 0; state = 'ready';
    }

    function die() {
        if (state === 'over') return;
        state = 'over';
        overAt = Date.now();
        if (score > best) {
            best = score;
            try { localStorage.setItem('flappyBest', best); } catch (e) {}
        }
    }

    function flap() {
        if (state === 'ready') state = 'play';
        if (state === 'play') bird.vy = JUMP;
        else if (state === 'over' && Date.now() - overAt > 400) reset();
    }

    function update() {
        tick++;
        if (state === 'ready') {
            bird.y = H / 2 - 30 + Math.sin(tick / 8) * 6;
            groundX = (groundX - SPEED) % 24;
            return;
        }
        if (state === 'over') {
            if (bird.y + R < GROUND) {
                bird.vy += GRAVITY;
                bird.y = Math.min(GROUND - R, bird.y + bird.vy);
            }
            return;
        }
        groundX = (groundX - SPEED) % 24;
        bird.vy += GRAVITY;
        bird.y += bird.vy;

        const lastPipe = pipes[pipes.length - 1];
        if (!lastPipe || lastPipe.x < W - 160) {
            pipes.push({ x: W, top: 50 + Math.random() * (GROUND - GAP - 100), passed: false });
        }
        pipes.forEach(p => { p.x -= SPEED; });
        if (pipes[0].x < -PW) pipes.shift();

        for (const p of pipes) {
            if (!p.passed && p.x + PW < BX - R) { p.passed = true; score++; }
            if (BX + R > p.x && BX - R < p.x + PW && (bird.y - R < p.top || bird.y + R > p.top + GAP)) die();
        }
        if (bird.y + R >= GROUND) { bird.y = GROUND - R; die(); }
        if (bird.y - R < 0) { bird.y = R; bird.vy = 0; }
    }

    function banner(line1, line2) {
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(0, 70, W, 90);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = `bold 24px ${FONT}`;
        ctx.fillText(line1, W / 2, 105);
        ctx.font = `14px ${FONT}`;
        ctx.fillText(line2, W / 2, 135);
    }

    function draw() {
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
        sky.addColorStop(0, '#4ec0ca');
        sky.addColorStop(1, '#bfe9f0');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#5cb82e';
        ctx.strokeStyle = '#2e6b12';
        ctx.lineWidth = 2;
        for (const p of pipes) {
            const rects = [
                [p.x, 0, PW, p.top],
                [p.x, p.top + GAP, PW, GROUND - p.top - GAP],
                [p.x - 3, p.top - 16, PW + 6, 16],
                [p.x - 3, p.top + GAP, PW + 6, 16]
            ];
            for (const r of rects) { ctx.fillRect(...r); ctx.strokeRect(...r); }
        }

        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = '#8fcf4f';
        ctx.fillRect(0, GROUND, W, 10);
        ctx.fillStyle = '#c9bf7a';
        for (let x = groundX; x < W; x += 24) ctx.fillRect(x, GROUND + 10, 12, 6);

        ctx.save();
        ctx.translate(BX, bird.y);
        ctx.rotate(Math.max(-0.5, Math.min(1.2, bird.vy * 0.08)));
        ctx.fillStyle = '#f7d51d';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(5, -4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(6, -4, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4511e';
        ctx.fillRect(R - 2, 0, 9, 5);
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.font = `bold 36px ${FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#fff';
        ctx.strokeText(score, W / 2, 60);
        ctx.fillText(score, W / 2, 60);

        if (state === 'ready') banner('Get ready!', 'Click or press Space to flap');
        if (state === 'over') banner('Game over', `Score ${score}  |  Best ${best}  -  click to retry`);
    }

    function loop(t) {
        raf = requestAnimationFrame(loop);
        if (!cv.offsetParent) { lastT = 0; return; }   // tab hidden or window minimized
        if (!lastT) lastT = t;
        acc += Math.min(t - lastT, 100);
        lastT = t;
        while (acc >= STEP) { update(); acc -= STEP; }
        draw();
    }

    cv.addEventListener('mousedown', flap);
    cv.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });
    const onKey = e => {
        if (e.repeat) return;
        if ((e.code === 'Space' || e.code === 'ArrowUp') && activeWindowId === id && isActiveTab()) {
            e.preventDefault();
            flap();
        }
    };
    document.addEventListener('keydown', onKey);

    reset();
    raf = requestAnimationFrame(loop);

    return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
    };
}