/* =====================================================================
   tray.js  -  working system tray for the Windows 7 portfolio
   Volume | Network | Hidden icons | Clock + calendar
   Load AFTER your main script and app.js:
       <script src="tray.js"></script>
   ===================================================================== */
(function () {
    'use strict';
    if (typeof document === 'undefined') return;

    const $ = id => document.getElementById(id);
    const clamp01 = v => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

    /* -----------------------------------------------------------------
       Styles
       ----------------------------------------------------------------- */
    const css = `
    .taskbar-time { text-align:center; line-height:1.25; padding:2px 8px; border-radius:3px;
                    cursor:pointer; white-space:nowrap; font-size:.72rem; }
    .taskbar-time:hover { background:rgba(255,255,255,.15); }
    .system-icon { border-radius:3px; }
    .system-icon:hover { background:rgba(255,255,255,.15); }

    .fly { position:fixed; bottom:46px; z-index:9990; display:none; color:#fff; font-size:.8rem;
           background:linear-gradient(rgba(40,70,110,.93), rgba(14,32,60,.96));
           border:1px solid rgba(255,255,255,.35); border-radius:6px 6px 0 0;
           box-shadow:0 0 0 1px rgba(0,0,0,.5), 0 6px 24px rgba(0,0,0,.55);
           backdrop-filter:blur(6px); user-select:none; }
    .fly.open { display:block; }

    /* volume */
    .fly-volume { width:70px; padding:10px 8px; text-align:center; }
    .vol-title { font-size:.7rem; opacity:.85; }
    .vol-slider { position:relative; width:30px; height:120px; margin:10px auto; cursor:pointer; touch-action:none; }
    .vol-slider::before { content:''; position:absolute; left:50%; top:0; bottom:0; width:6px; margin-left:-3px;
                          border-radius:3px; background:rgba(255,255,255,.25); box-shadow:inset 0 1px 2px rgba(0,0,0,.5); }
    .vol-fill { position:absolute; left:50%; bottom:0; width:6px; margin-left:-3px; border-radius:3px;
                background:linear-gradient(#8be88b, #2ca02c); }
    .vol-thumb { position:absolute; left:50%; width:22px; height:10px; margin-left:-11px; border-radius:3px;
                 background:linear-gradient(#f4f8fd, #b9c9de); border:1px solid #567; }
    .vol-pct { font-size:.75rem; margin-bottom:6px; }
    .vol-mute { background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.3); border-radius:4px;
                width:34px; height:28px; cursor:pointer; font-size:1rem; }
    .vol-mute:hover { background:rgba(255,255,255,.25); }

    /* network */
    .fly-network { width:250px; padding:12px; }
    .net-title { font-size:.75rem; opacity:.85; margin-bottom:8px; }
    .net-row { display:flex; gap:10px; align-items:center; }
    .net-icon { font-size:1.8rem; }
    .net-name { font-size:.9rem; }
    .net-state { font-size:.75rem; opacity:.85; }
    .net-detail { margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,.2);
                  font-size:.72rem; opacity:.85; line-height:1.5; }

    /* hidden icons */
    .fly-hidden { padding:8px; }
    .hid-grid { display:flex; gap:6px; }
    .hid-item { width:36px; height:36px; font-size:1.2rem; border-radius:4px; cursor:pointer;
                background:transparent; border:1px solid transparent; color:#fff; }
    .hid-item:hover { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.35); }

    /* clock + calendar */
    .fly-clock { width:248px; padding:12px; }
    .cal-time { font-size:1.35rem; font-weight:300; }
    .cal-date { font-size:.75rem; opacity:.85; margin-bottom:10px; padding-bottom:8px;
                border-bottom:1px solid rgba(255,255,255,.2); }
    .cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
    .cal-title { cursor:pointer; font-size:.85rem; }
    .cal-title:hover { text-decoration:underline; }
    .cal-head button { width:26px; height:24px; border-radius:3px; cursor:pointer; color:#fff; font-size:1rem;
                       background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.25); }
    .cal-head button:hover { background:rgba(255,255,255,.25); }
    .cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:1px; text-align:center; }
    .cal-dow { font-size:.7rem; opacity:.75; padding:3px 0; }
    .cal-cell { height:26px; display:flex; align-items:center; justify-content:center; border-radius:3px; }
    .cal-cell:hover { background:rgba(255,255,255,.18); }
    .cal-cell.other { opacity:.4; }
    .cal-cell.today { background:linear-gradient(#5aa7ee, #2a6fc4); font-weight:600; opacity:1;
                      box-shadow:0 0 0 1px rgba(255,255,255,.6); }
    .analog { display:block; margin:10px auto 0; }
    .a-face { fill:rgba(255,255,255,.1); stroke:rgba(255,255,255,.7); stroke-width:2; }
    .analog line { stroke-linecap:round; }
    .a-tick { stroke:#fff; stroke-width:1.5; }
    .a-hour, .a-min { stroke:#fff; stroke-width:3; }
    .a-sec { stroke:#ff6b6b; stroke-width:1.2; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);


    /* -----------------------------------------------------------------
       Shared system volume (the music player plugs into this)
       ----------------------------------------------------------------- */
    const SystemVolume = (() => {
        let level = 0.8, muted = false;
        try {
            const saved = JSON.parse(localStorage.getItem('sysVolume') || 'null');
            if (saved) { level = clamp01(+saved.level); muted = !!saved.muted; }
        } catch (e) {}

        const audios = new Set();
        const subs = new Set();

        function emit() {
            audios.forEach(a => {
                if (!a.getAttribute('src')) { audios.delete(a); return; }   // closed player
                a.volume = level;
                a.muted = muted;
            });
            const state = { level, muted };
            subs.forEach(s => {
                if (s.el && !s.el.isConnected) subs.delete(s);               // closed window
                else s.fn(state);
            });
            try { localStorage.setItem('sysVolume', JSON.stringify(state)); } catch (e) {}
        }

        return {
            get level() { return level; },
            get muted() { return muted; },
            set(v) { level = clamp01(v); if (level > 0) muted = false; emit(); },
            toggleMute() { muted = !muted; emit(); },
            register(audio) { audios.add(audio); audio.volume = level; audio.muted = muted; },
            onChange(fn, el) {
                const s = { fn, el };
                subs.add(s);
                fn({ level, muted });
                return () => subs.delete(s);
            }
        };
    })();
    window.SystemVolume = SystemVolume;


    /* -----------------------------------------------------------------
       Anchors + flyout plumbing
       ----------------------------------------------------------------- */
    const anchors = {
        hidden: $('tray-hidden'),
        network: $('tray-network'),
        volume: $('tray-volume'),
        clock: $('clock')
    };
    if (Object.values(anchors).some(a => !a)) {
        console.warn('tray.js: tray elements not found. Add id="tray-hidden", "tray-network", "tray-volume" and "clock" to the tray in index.html.');
        return;
    }

    const flies = {};
    const renderers = {};
    let openName = null;

    function makeFly(name, html) {
        const el = document.createElement('div');
        el.className = 'fly fly-' + name;
        el.innerHTML = html;
        document.body.appendChild(el);
        flies[name] = el;
        return el;
    }

    function closeAll() {
        Object.values(flies).forEach(f => f.classList.remove('open'));
        openName = null;
    }

    function place(f, anchor) {
        const r = anchor.getBoundingClientRect();
        const w = f.offsetWidth;
        let left = r.left + r.width / 2 - w / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
        f.style.left = left + 'px';
    }

    function toggle(name) {
        if (openName === name) { closeAll(); return; }
        closeAll();
        const startMenu = $('start-menu');
        if (startMenu) startMenu.style.display = 'none';
        renderers[name]();
        flies[name].classList.add('open');
        place(flies[name], anchors[name]);
        openName = name;
    }

    Object.keys(anchors).forEach(name => {
        anchors[name].addEventListener('click', () => toggle(name));
    });

    document.addEventListener('mousedown', e => {
        if (!openName) return;
        if (e.target.closest('.fly') || e.target.closest('#tray-hidden, #tray-network, #tray-volume, #clock')) return;
        closeAll();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });


    /* -----------------------------------------------------------------
       Volume
       ----------------------------------------------------------------- */
    const volFly = makeFly('volume', `
        <div class="vol-title">Speakers</div>
        <div class="vol-slider"><div class="vol-fill"></div><div class="vol-thumb"></div></div>
        <div class="vol-pct"></div>
        <button class="vol-mute" title="Mute / Unmute"></button>`);
    const vSlider = volFly.querySelector('.vol-slider');
    const vFill = volFly.querySelector('.vol-fill');
    const vThumb = volFly.querySelector('.vol-thumb');
    const vPct = volFly.querySelector('.vol-pct');
    const vMute = volFly.querySelector('.vol-mute');

    const volEmoji = v => (v.muted || v.level === 0) ? '🔇' : v.level < 0.35 ? '🔈' : v.level < 0.7 ? '🔉' : '🔊';

    SystemVolume.onChange(v => {
        const pct = Math.round((v.muted ? 0 : v.level) * 100);
        anchors.volume.textContent = volEmoji(v);
        anchors.volume.title = v.muted ? 'Speakers: Muted' : `Speakers: ${Math.round(v.level * 100)}%`;
        vFill.style.height = pct + '%';
        vThumb.style.bottom = `calc(${pct}% - 5px)`;
        vPct.textContent = v.muted ? 'Muted' : pct;
        vMute.textContent = volEmoji(v);
    });

    function dragVolume(e) {
        const r = vSlider.getBoundingClientRect();
        if (!r.height) return;
        SystemVolume.set(1 - (e.clientY - r.top) / r.height);
    }
    vSlider.addEventListener('pointerdown', e => {
        try { vSlider.setPointerCapture(e.pointerId); } catch (err) {}
        dragVolume(e);
    });
    vSlider.addEventListener('pointermove', e => {
        let captured = false;
        try { captured = vSlider.hasPointerCapture(e.pointerId); } catch (err) {}
        if (captured) dragVolume(e);
    });
    vMute.addEventListener('click', () => SystemVolume.toggleMute());

    const wheelVolume = e => {
        e.preventDefault();
        SystemVolume.set(SystemVolume.level + (e.deltaY < 0 ? 0.05 : -0.05));
    };
    anchors.volume.addEventListener('wheel', wheelVolume, { passive: false });
    volFly.addEventListener('wheel', wheelVolume, { passive: false });
    renderers.volume = () => {};


    /* -----------------------------------------------------------------
       Network
       ----------------------------------------------------------------- */
    const netFly = makeFly('network', `
        <div class="net-title"></div>
        <div class="net-row">
            <div class="net-icon"></div>
            <div><b class="net-name"></b><div class="net-state"></div></div>
        </div>
        <div class="net-detail"></div>`);

    function syncNetIcon() {
        const online = navigator.onLine;
        anchors.network.textContent = online ? '📡' : '❌';
        anchors.network.title = online ? 'Network: Internet access' : 'Network: No Internet access';
    }

    renderers.network = () => {
        const online = navigator.onLine;
        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        netFly.querySelector('.net-title').textContent = online ? 'Currently connected to:' : 'Not connected';
        netFly.querySelector('.net-icon').textContent = online ? '📡' : '❌';
        netFly.querySelector('.net-name').textContent = online ? (location.hostname || 'Local network') : 'No network';
        netFly.querySelector('.net-state').textContent = online ? 'Internet access' : 'No Internet access';

        const parts = [];
        if (online && c) {
            if (c.type) parts.push('Type: ' + c.type);
            if (c.effectiveType) parts.push('Quality: ' + c.effectiveType.toUpperCase());
            if (c.downlink != null) parts.push('Speed: ~' + c.downlink + ' Mbps');
            if (c.rtt != null) parts.push('Latency: ' + c.rtt + ' ms');
        }
        netFly.querySelector('.net-detail').innerHTML = parts.length
            ? parts.join('<br>')
            : (online ? 'Connection details are not available in this browser.' : 'Check your cable or Wi-Fi.');
    };

    window.addEventListener('online', () => { syncNetIcon(); if (openName === 'network') renderers.network(); });
    window.addEventListener('offline', () => { syncNetIcon(); if (openName === 'network') renderers.network(); });
    syncNetIcon();


    /* -----------------------------------------------------------------
       Hidden icons
       ----------------------------------------------------------------- */
    const hidFly = makeFly('hidden', '<div class="hid-grid"></div>');
    let battery = null;
    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            battery = b;
            ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, () => {
                if (openName === 'hidden') renderers.hidden();
            }));
        }).catch(() => {});
    }

    function toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    }

    renderers.hidden = () => {
        const items = [
            battery
                ? { icon: battery.charging ? '🔌' : '🔋',
                    label: `Battery: ${Math.round(battery.level * 100)}%${battery.charging ? ' (plugged in)' : ''}` }
                : { icon: '🔋', label: 'Battery status is not available' },
            { icon: '<img src="images-removebg-preview.png" width="22" height="22" alt="">', label: 'Open Music Player', action: () => window.openWindow && window.openWindow('Music Player') },
            { icon: '⛶', label: document.fullscreenElement ? 'Exit full screen' : 'Full screen', action: toggleFullscreen }
        ];
        const grid = hidFly.querySelector('.hid-grid');
        grid.innerHTML = items.map((it, i) => `<button class="hid-item" data-i="${i}" title="${it.label}">${it.icon}</button>`).join('');
        grid.onclick = e => {
            const btn = e.target.closest('.hid-item');
            if (!btn) return;
            const item = items[+btn.dataset.i];
            closeAll();
            if (item.action) item.action();
        };
    };


    /* -----------------------------------------------------------------
       Clock + calendar
       ----------------------------------------------------------------- */
    let ticks = '';
    for (let i = 0; i < 12; i++) {
        const major = i % 3 === 0;
        ticks += `<line class="a-tick" x1="0" y1="${major ? -41 : -43}" x2="0" y2="-38" transform="rotate(${i * 30})"/>`;
    }
    const clockFly = makeFly('clock', `
        <div class="cal-time"></div>
        <div class="cal-date"></div>
        <div class="cal-head">
            <button class="cal-prev" title="Previous month">&#8249;</button>
            <span class="cal-title" title="Go to today"></span>
            <button class="cal-next" title="Next month">&#8250;</button>
        </div>
        <div class="cal-grid"></div>
        <svg class="analog" viewBox="-50 -50 100 100" width="130" height="130">
            <circle class="a-face" r="47"/>
            ${ticks}
            <line class="a-hour" x1="0" y1="3" x2="0" y2="-22"/>
            <line class="a-min" x1="0" y1="4" x2="0" y2="-33"/>
            <line class="a-sec" x1="0" y1="8" x2="0" y2="-38"/>
        </svg>`);

    let calYear, calMonth;

    function renderCalendar() {
        const today = new Date();
        const firstDow = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const daysInPrev = new Date(calYear, calMonth, 0).getDate();

        let cells = '';
        for (let i = 0; i < 42; i++) {                 // always 6 rows so the height never jumps
            const n = i - firstDow + 1;
            let day = n, other = false;
            if (n < 1) { day = daysInPrev + n; other = true; }
            else if (n > daysInMonth) { day = n - daysInMonth; other = true; }
            const isToday = !other && day === today.getDate() &&
                calMonth === today.getMonth() && calYear === today.getFullYear();
            cells += `<div class="cal-cell${other ? ' other' : ''}${isToday ? ' today' : ''}">${day}</div>`;
        }
        const dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="cal-dow">${d}</div>`).join('');
        clockFly.querySelector('.cal-grid').innerHTML = dow + cells;
        clockFly.querySelector('.cal-title').textContent =
            new Date(calYear, calMonth, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
    }

    function shiftMonth(delta) {
        calMonth += delta;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar();
    }
    function goToday() {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        renderCalendar();
    }
    clockFly.querySelector('.cal-prev').addEventListener('click', () => shiftMonth(-1));
    clockFly.querySelector('.cal-next').addEventListener('click', () => shiftMonth(1));
    clockFly.querySelector('.cal-title').addEventListener('click', goToday);

    function updateAnalog(now) {
        const s = now.getSeconds();
        const m = now.getMinutes() + s / 60;
        const h = (now.getHours() % 12) + m / 60;
        clockFly.querySelector('.a-hour').setAttribute('transform', `rotate(${h * 30})`);
        clockFly.querySelector('.a-min').setAttribute('transform', `rotate(${m * 6})`);
        clockFly.querySelector('.a-sec').setAttribute('transform', `rotate(${s * 6})`);
        clockFly.querySelector('.cal-time').textContent =
            now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
        clockFly.querySelector('.cal-date').textContent =
            now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    renderers.clock = () => { goToday(); updateAnalog(new Date()); };

    // Taskbar clock: time on top, date below (replaces the old one-line updateClock)
    let lastHtml = '';
    function tick() {
        const now = new Date();
        const html =
            `<div>${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>` +
            `<div>${now.toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' })}</div>`;
        if (html !== lastHtml) {
            anchors.clock.innerHTML = html;
            anchors.clock.title = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            lastHtml = html;
        }
        if (openName === 'clock') updateAnalog(now);
    }
    window.updateClock = tick;   // login() calls updateClock(), so it now uses this version
    tick();
    setInterval(tick, 1000);
})();