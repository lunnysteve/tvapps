const R = window.Signage;

    const D = window.ManufacturingHistory, el = id => document.getElementById(id);
    // ?demo adds a made-up order on top of the live data so the line can be previewed. Nothing is written to Odoo.
    if (new URLSearchParams(location.search).has('demo')) {
        const live = D.load;
        D.load = async () => {
            const data = await live().catch(() => ({ jobs: [], partial: false }));
            const demo = { id: -1, reference: 'DEMO/MO/00001', product: 'Architape Indoor Luminaire', code: 'AL-50-14-N5-930-DEMO', origin: 'SO-DEMO (Test order)', when: Date.now() - 5 * 60000 };
            demo.detail = demo.code + ' · ' + demo.origin;
            return { ...data, jobs: [demo, ...data.jobs] };
        };
    }
    const HOUR = 3600000, CYCLE = 28, NEW_FOR = 30 * 60000, CUT = -5.6, TAPE = -1.6, TEST = 2.2, PACK = 6.4, LEN = 1.6, PICK = PACK - 2.2;
    const time = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const date = ms => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' });
    const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ago = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm ago'; };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const S = { jobs: [], hasData: false, partial: false, stale: false, busy: false, refreshed: 0, current: null, fresh: false, queue: [], seen: new Set(), start: 0, speed: 1, previous: null, listSignature: '', pulseSignature: '', scrollStart: 0 };
    const recent = () => S.jobs.filter(job => job.when > Date.now() - D.DAY && job.when <= Date.now());
    const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
    const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const clamp = t => Math.max(0, Math.min(1, t));

    // Flat 2D illustration: older Fire TV sticks cannot run a WebGL scene.
    const G = window.Replay2D.create(el('scene3d'), 'manufacturing');
    G.label(S.current); el('idle-sign').hidden = Boolean(S.current);

    function setPhase(text, step, progress) {
        if (el('phase').textContent !== text) el('phase').textContent = text;
        ['collect', 'load', 'away'].forEach(name => {
            el('step-' + name).classList.toggle('active', name === step);
            el('step-' + name).style.setProperty('--p', (progress?.[name] ?? 0) * 100 + '%');
        });
    }
    function choose(now) {
        const jobs = recent();
        const queued = S.queue.map(id => jobs.find(job => job.id === id)).find(Boolean);
        let job = queued;
        if (job) S.queue = S.queue.filter(id => id !== job.id);
        else if (jobs.length) {
            const index = jobs.findIndex(item => item.id === S.previous);
            job = jobs[(index + 1) % jobs.length];
        }
        S.current = job || null; S.start = now; S.fresh = Boolean(queued);
        // Long lists replay faster so a full rotation stays under ~10 minutes.
        S.speed = Math.min(2, Math.max(1, jobs.length * CYCLE / 600));
        el('idle-sign').hidden = Boolean(job) && Boolean(G);
        el('job-caption').classList.remove('is-new');
        G?.label(job);
        if (!job) {
            el('job-reference').textContent = S.hasData ? 'Ready for the next one.' : 'Ready when you are.';
            el('job-customer').textContent = S.hasData ? 'No completed production orders in the current 24-hour window.' : 'Waiting for verified completed production orders.';
            el('job-project').textContent = '';
            el('job-time').textContent = '—';
            el('job-ago').textContent = '';
            setPhase(S.hasData ? 'Production line clear' : 'Waiting for production data', '');
            return;
        }
        S.previous = job.id;
        if (S.fresh) { void el('job-caption').offsetWidth; el('job-caption').classList.add('is-new'); }
        el('replay-label').textContent = S.fresh ? 'JUST COMPLETED' : 'PRODUCTION REPLAY';
        el('job-kicker').textContent = S.fresh ? 'NEW · JUST FINISHED' : 'COMPLETED ORDER';
        el('job-reference').textContent = job.reference;
        el('job-customer').textContent = job.product;
        el('job-project').textContent = job.detail;
        el('job-time').textContent = time(job.when);
        el('job-ago').textContent = ago(job.when);
        highlight();
    }
    function highlight() {
        document.querySelectorAll('.history-row').forEach(row => row.classList.toggle('is-current', Number(row.dataset.id) === S.current?.id));
    }
    function pulse(jobs) {
        const now = Date.now(), { buckets, start: bucketStart } = R.hours(jobs, now);
        const signature = buckets.join(',') + (S.hasData ? '' : '?');
        if (signature === S.pulseSignature) return;
        S.pulseSignature = signature;
        const max = Math.max(1, ...buckets);
        el('pulse-bars').innerHTML = buckets.map((n, i) => `<i class="${n ? 'has' : ''}${i === 23 ? ' now' : ''}" style="height:${(n ? Math.max(3, n / max * 100) : 0)}%" title="${n} order${n === 1 ? '' : 's'}"></i>`).join('');
        const peak = buckets.indexOf(Math.max(...buckets));
        el('busiest').textContent = S.hasData && buckets[peak] ? `${time(bucketStart + peak * HOUR).slice(0, 2)}:00 · ${buckets[peak]}` : '—';
        el('axis-start').textContent = time(bucketStart);
    }
    function list() {
        const jobs = recent();
        const jobsSignature = JSON.stringify(jobs), signature = jobsSignature + Math.floor(Date.now() / 60000);
        if (signature !== S.listSignature) {
            const changed = !S.listSignature.startsWith(jobsSignature);
            S.listSignature = signature;
            el('history-list').innerHTML = jobs.map(job => `<article class="history-row${Date.now() - job.when < NEW_FOR ? ' is-new' : ''}" data-id="${job.id}"><strong>${esc(job.reference)}</strong><time>${time(job.when)}<small>${ago(job.when)}</small></time><p>${esc(job.product)}</p><small>${esc(job.detail)} · ${date(job.when)}</small></article>`).join('');
            // Only restart the scroll when the orders change, not on the per-minute "ago" refresh.
            if (changed && S.scrollHydrated) S.scrollStart = performance.now();
            S.scrollHydrated = true;
            highlight();
        }
        pulse(jobs);
        el('last-made').textContent = jobs.length ? ago(jobs[0].when) : '—';
        el('history-empty').hidden = jobs.length > 0;
        el('history-empty').textContent = S.hasData ? 'No completed production orders in this 24-hour window.' : 'Production history is currently unavailable. Retrying automatically.';
        const count = S.hasData ? String(jobs.length) : '—';
        if (el('count').textContent !== count) {
            if (S.hasData && Number(count) > Number(el('count').textContent) && !reduced.matches) {
                el('total').classList.remove('bump'); void el('total').offsetWidth; el('total').classList.add('bump');
            }
            el('count').textContent = count;
        }
        el('count-label').textContent = S.partial ? 'orders · partial coverage' : S.stale ? 'orders · last known data' : 'production orders made';
        el('window-label').textContent = `${date(Date.now() - D.DAY)} ${time(Date.now() - D.DAY)} – ${date(Date.now())} ${time(Date.now())} · London`;
        const overflow = el('history-list').scrollHeight > el('history-viewport').clientHeight;
        el('history-note').textContent = overflow ? 'List scrolls automatically · newest first' : 'All returned orders shown · newest first';
    }
    async function refresh() {
        if (S.busy) return; S.busy = true;
        try {
            const data = await D.load();
            R.sceneReceived(S, data);
            // Prioritise newly observed completions at the next animation boundary.
            if (S.hasData) data.jobs.filter(job => !S.seen.has(job.id)).forEach(job => S.queue.push(job.id));
            data.jobs.forEach(job => S.seen.add(job.id));
            S.jobs = data.jobs; S.partial = data.partial; S.hasData = true; S.stale = false; S.refreshed = Date.now();
            el('source-banner').hidden = !data.partial;
            el('source-banner').textContent = 'Partial coverage: the source returned its 2,000-order safety limit. Figures show only the returned orders.';
        } catch (error) {
            S.stale = true; R.report({ stale: true, asOf: S.refreshed, records: S.jobs.length });
            el('source-banner').hidden = false;
            el('source-banner').textContent = S.hasData ? `Connection interrupted · showing last-known orders from ${time(S.refreshed)} · retrying automatically.` : 'Production history unavailable · retrying automatically. No orders are being estimated.';
            console.warn('Production history unavailable:', error.message);
        } finally {
            S.busy = false;
            document.querySelector('.dispatch-screen').classList.toggle('is-stale', S.stale);
            if (!S.current) choose(performance.now());
            tick();
        }
    }
    function tick() {
        el('clock').textContent = date(Date.now()) + ' · ' + time(Date.now());
        el('source-status').textContent = S.hasData ? `${S.stale ? 'STALE · Last updated' : 'Odoo · Updated'} ${time(S.refreshed)}` : 'Source unavailable · reconnecting';
        if (S.current) el('job-ago').textContent = ago(S.current.when);
        list();
    }
    function pose(t) {
        const idle = { piece: false, px: CUT - LEN / 2, py: .9, tape: 0, lit: 0, pass: 0, saw: -.3, spin: 0, sparks: 0, reel: 0, feed: false, probe: 1.6, hx: PACK + .3, hy: 1.6, carton: false, cx: PACK + .3, cz: 0, close: 0, focus: 0, fx: 0 };
        if (!S.current) return idle;
        const still = reduced.matches;
        if (still) t = 15;
        const p = { ...idle, piece: true, carton: true };
        // Stock feeds past the blade, then the saw drops through the profile.
        p.px = mix(CUT - LEN / 2, CUT + LEN / 2, ease(t / 2.5));
        p.saw = t < 3.5 ? mix(-.3, .42, ease(t - 2.5)) : mix(.42, -.3, ease(t - 3.5));
        p.spin = t > 1.5 && t < 5.5 ? 1 : 0; p.sparks = t > 3 && t < 3.9 ? 1 : 0;
        // Along the line to the applicator; tape is laid from the leading end as it passes the roller.
        if (t >= 4.5) p.px = mix(CUT + LEN / 2, TAPE - LEN / 2, ease((t - 4.5) / 2.5));
        if (t >= 7) { p.px = mix(TAPE - LEN / 2, TAPE + LEN / 2, (t - 7) / 3.5); p.tape = clamp((t - 7) / 3.5); p.reel = Math.min(t - 7, 3.5) * 3; p.feed = t < 10.5; }
        if (t >= 10.5) p.px = mix(TAPE + LEN / 2, TEST, ease((t - 10.5) / 2));
        // Probe drops on, the tape lights up and the lamp shows a pass.
        if (t >= 12.5) p.probe = t < 16.3 ? mix(1.6, 1.16, ease((t - 12.5) / .8)) : mix(1.16, 1.6, ease((t - 16.3) / .7));
        if (t >= 13.3 && t < 16.3) p.lit = clamp((t - 13.3) / .4) * clamp((16.3 - t) / .4);
        p.pass = t >= 13.8 && t < 17 ? 1 : 0;
        if (t >= 17) p.px = mix(TEST, PICK, ease((t - 17) / 2));
        // Gantry collects from the end of the line and lowers the light into its carton.
        if (t >= 18) p.hx = mix(PACK + .3, PICK, ease(t - 18));
        if (t >= 19) p.hy = mix(1.6, 1.1, ease((t - 19) / .6));
        if (t >= 19.6) { p.hy = mix(1.1, 1.6, ease((t - 19.6) / .6)); p.py = p.hy - .2; }
        if (t >= 20.2) { p.hx = mix(PICK, PACK + .3, ease((t - 20.2) / 1.2)); p.px = p.hx; }
        if (t >= 21.4) { p.hy = mix(1.6, .77, ease((t - 21.4) / .6)); p.py = p.hy - .2; }
        if (t >= 22) { p.hy = mix(.77, 1.6, ease((t - 22) / .6)); p.py = .57; }
        // Flaps close, the carton is sealed and slides off down the packing table.
        if (t >= 22.6) p.close = ease(t - 22.6);
        if (t >= 23.6) p.piece = false;
        if (t >= 24.5) p.cx = mix(PACK + .3, PACK + 10, ease((t - 24.5) / 3));
        p.cz = mix(-1.6, 0, ease(t / 1.5));
        const bump = (a, b) => ease((t - a) / 1.5) * (1 - ease((t - b + 1.5) / 1.5));
        const focus = [[bump(1.5, 5.5), CUT], [bump(12.8, 17.2), TEST], [bump(22.4, 26), PACK + .3]].sort((a, b) => b[0] - a[0])[0];
        p.focus = still ? 0 : .8 * focus[0]; p.fx = focus[1];
        if (still) { setPhase('Completed order · illustrated replay', 'away', { collect: 1, load: 1, away: 1 }); return p; }
        setPhase(t < 2.5 ? 'Feeding the profile' : t < 4.5 ? 'Cutting to length' : t < 7 ? 'On to taping' : t < 10.5 ? 'Applying LED tape' : t < 12.5 ? 'On to testing' : t < 17 ? 'Power-on light test' : t < 22.6 ? 'Packing' : t < 24.5 ? 'Sealing the box' : 'Boxed · ready to ship', t < 4.5 ? 'collect' : t < 17 ? 'load' : 'away',
            { collect: clamp(t / 4.5), load: clamp((t - 4.5) / 12.5), away: clamp((t - 17) / 9) });
        return p;
    }
    let lastFrame = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        if (!R.visible() || now - lastFrame < 250) return;
        lastFrame = now;
        if (S.current && (!recent().some(job => job.id === S.current.id) || (now - S.start) * S.speed >= CYCLE * 1000)) choose(now);
                const t = (now - S.start) / 1000 * S.speed; pose(t); G.render(t, S.speed, reduced.matches);
        R.scrollList(S, now, true);
    }
    R.attachScene(S, choose, tick); refresh(); requestAnimationFrame(frame);
    setInterval(tick, 1000);
    setInterval(() => { if (R.visible()) refresh(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (R.visible()) { choose(performance.now()); refresh(); } });
  