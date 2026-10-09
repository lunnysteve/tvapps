const R = window.Signage;

    const D = window.ReceiptHistory, el = id => document.getElementById(id);
    const HOUR = 3600000, CYCLE = 32, NEW_FOR = 30 * 60000, BAY = -4.4, REACH = 1.5, PARK = 5;
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
    const G = window.Replay2D.create(el('scene3d'), 'goods_in');
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
            el('job-customer').textContent = S.hasData ? 'No received deliveries in the current 24-hour window.' : 'Waiting for verified received deliveries.';
            el('job-project').textContent = '';
            el('job-time').textContent = '—';
            el('job-ago').textContent = '';
            setPhase(S.hasData ? 'Receiving area clear' : 'Waiting for receipt data', '');
            return;
        }
        S.previous = job.id;
        if (S.fresh) { void el('job-caption').offsetWidth; el('job-caption').classList.add('is-new'); }
        el('replay-label').textContent = S.fresh ? 'JUST RECEIVED' : 'RECEIPT REPLAY';
        el('job-kicker').textContent = S.fresh ? 'NEW · JUST CHECKED IN' : 'COMPLETED RECEIPT';
        el('job-reference').textContent = job.reference;
        el('job-customer').textContent = job.supplier;
        el('job-project').textContent = job.project;
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
        el('pulse-bars').innerHTML = buckets.map((n, i) => `<i class="${n ? 'has' : ''}${i === 23 ? ' now' : ''}" style="height:${(n ? Math.max(3, n / max * 100) : 0)}%" title="${n} receipt${n === 1 ? '' : 's'}"></i>`).join('');
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
            el('history-list').innerHTML = jobs.map(job => `<article class="history-row${Date.now() - job.when < NEW_FOR ? ' is-new' : ''}" data-id="${job.id}"><strong>${esc(job.reference)}</strong><time>${time(job.when)}<small>${ago(job.when)}</small></time><p>${esc(job.supplier)}</p><small>${esc(job.project || job.order)} · ${date(job.when)}</small></article>`).join('');
            // Only restart the scroll when the receipts change, not on the per-minute "ago" refresh.
            if (changed && S.scrollHydrated) S.scrollStart = performance.now();
            S.scrollHydrated = true;
            highlight();
        }
        pulse(jobs);
        el('last-in').textContent = jobs.length ? ago(jobs[0].when) : '—';
        el('history-empty').hidden = jobs.length > 0;
        el('history-empty').textContent = S.hasData ? 'No received deliveries in this 24-hour window.' : 'Receipt history is currently unavailable. Retrying automatically.';
        const count = S.hasData ? String(jobs.length) : '—';
        if (el('count').textContent !== count) {
            if (S.hasData && Number(count) > Number(el('count').textContent) && !reduced.matches) {
                el('total').classList.remove('bump'); void el('total').offsetWidth; el('total').classList.add('bump');
            }
            el('count').textContent = count;
        }
        el('count-label').textContent = S.partial ? 'receipts · partial coverage' : S.stale ? 'receipts · last known data' : 'received deliveries';
        el('window-label').textContent = `${date(Date.now() - D.DAY)} ${time(Date.now() - D.DAY)} – ${date(Date.now())} ${time(Date.now())} · London`;
        const overflow = el('history-list').scrollHeight > el('history-viewport').clientHeight;
        el('history-note').textContent = overflow ? 'List scrolls automatically · newest first' : 'All returned receipts shown · newest first';
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
            el('source-banner').textContent = 'Partial coverage: the source returned its 2,000-transfer safety limit. Figures show only the returned receipts.';
        } catch (error) {
            S.stale = true; R.report({ stale: true, asOf: S.refreshed, records: S.jobs.length });
            el('source-banner').hidden = false;
            el('source-banner').textContent = S.hasData ? `Connection interrupted · showing last-known receipts from ${time(S.refreshed)} · retrying automatically.` : 'Receipt history unavailable · retrying automatically. No receipts are being estimated.';
            console.warn('Receipt history unavailable:', error.message);
        } finally {
            S.busy = false;
            document.querySelector('.dispatch-screen').classList.toggle('is-stale', S.stale);
            if (!S.current) choose(performance.now());
            tick();
        }
    }
    function tick() {
        el('clock').textContent = date(Date.now()) + ' · ' + time(Date.now());
        el('source-status').textContent = S.hasData ? `${S.stale ? 'STALE · Last received' : 'Odoo · Updated'} ${time(S.refreshed)}` : 'Source unavailable · reconnecting';
        if (S.current) el('job-ago').textContent = ago(S.current.when);
        list();
    }
    function pose(t) {
        const idle = { lx: 16, fx: -13, lift: .08, px: 0, py: 0, pz: 0, pallet: false, brake: .2, smoke: 0, smokeAge: 0, shutter: 0, look: 0, focus: 0 };
        if (!S.current) return idle;
        if (reduced.matches) return { ...idle, lx: PARK, fx: BAY - REACH - .6, px: BAY, py: .08, pallet: true };
        const p = { ...idle, pallet: true };
        // Forklift stops with its mast just short of the lorry tail; only the forks reach onto the bed.
        const PICK = PARK - 2.95 - REACH;
        p.lx = mix(16, PARK, ease(t / 4)); if (t < 4) p.brake = 1.2;
        p.px = p.lx - 2.95; p.py = 1.11;
        if (t >= 3) p.fx = mix(-13, PICK - 1.2, ease((t - 3) / 4));
        if (t >= 5) p.lift = mix(.08, 1.19, ease((t - 5) / 2));
        if (t >= 7) p.fx = mix(PICK - 1.2, PICK, ease((t - 7) / 3));
        if (t >= 10) p.lift = mix(1.19, 1.3, ease(t - 10));
        if (t >= 11) p.fx = mix(PICK, -1.2, ease((t - 11) / 3));
        if (t >= 14) p.lift = mix(1.3, .35, ease((t - 14) / 2));
        if (t >= 16) p.fx = mix(-1.2, BAY - REACH, ease((t - 16) / 4));
        if (t >= 20) p.lift = mix(.35, .16, ease((t - 20) / 2));
        if (t >= 10) { p.px = p.fx + REACH; p.py = p.lift - .08; }
        // Driver glances over a shoulder while reversing.
        if (t >= 11 && t < 14.5) p.look = Math.sin(clamp((t - 11) / 3.5) * Math.PI) * 1.4;
        if (t >= 22) { p.px = BAY; p.py = .08; p.fx = mix(BAY - REACH, -13, ease((t - 22) / 3)); p.lift = .08; p.look = Math.sin(clamp((t - 22) / 3) * Math.PI) * 1.4; }
        if (t >= 23) { p.lx = mix(PARK, 17, ease((t - 23) / 4)); p.smoke = mix(1, 0, (t - 23) / 3); p.smokeAge = t - 23; }
        // Gentle camera push-in while picking off the lorry and setting down at goods in.
        const bump = (a, b) => ease((t - a) / 1.5) * (1 - ease((t - b + 1.5) / 1.5));
        p.focus = .55 * Math.max(bump(6, 12), bump(18.5, 23.5));
        // Shutter rolls up, rollers carry the pallet inside, then the shutter drops again.
        p.shutter = t < 28.5 ? ease((t - 23) / 1.5) : 1 - ease((t - 28.5) / 1.5);
        if (t >= 24.5) p.pz = -6.5 * ease((t - 24.5) / 4);
        if (t >= 29) p.pallet = false;
        setPhase(t < 2.5 ? 'Lorry reversing onto the bay' : t < 4.5 ? 'Opening the shutter' : t < 6 ? 'Stopping clear of the lorry' : t < 7.5 ? 'Raising forks to deck height' : t < 10 ? 'Collecting the pallet' : t < 13 ? 'Reversing clear of the lorry' : t < 14.5 ? 'Lowering to travel height' : t < 19 ? 'Bringing it into goods in' : t < 22.5 ? 'Setting down the delivery' : t < 24.5 ? 'Rollers moving the pallet inside' : t < 27.5 ? 'Lorry on its way' : 'Received · stored in goods in', t < 7.5 ? 'collect' : t < 22 ? 'load' : 'away',
            { collect: clamp(t / 7), load: clamp((t - 7) / 15), away: clamp((t - 22) / 8) });
        return p;
    }
    let lastFrame = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        if (!R.visible() || now - lastFrame < 250) return;
        lastFrame = now;
        if (S.current && (!recent().some(job => job.id === S.current.id) || (now - S.start) * S.speed >= CYCLE * 1000)) choose(now);
        if (S.current && reduced.matches) setPhase('Received delivery · illustrated replay', 'away', { collect: 1, load: 1, away: 1 });
        const t = (now - S.start) / 1000 * S.speed; pose(t); G.render(t, S.speed, reduced.matches);
        R.scrollList(S, now, true);
    }
    R.attachScene(S, choose, tick); refresh(); requestAnimationFrame(frame);
    setInterval(tick, 1000);
    setInterval(() => { if (R.visible()) refresh(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (R.visible()) { choose(performance.now()); refresh(); } });

