const R = window.Signage;

    const D = window.SubscriptionContracts, el = id => document.getElementById(id);
    // ?demo adds made-up contracts (one healthy, one due soon, one expired) on top of live data. Nothing is written to Odoo.
    if (new URLSearchParams(location.search).has('demo')) {
        const live = D.load;
        D.load = async () => {
            const data = await live().catch(() => ({ jobs: [], partial: false }));
            const at = days => Date.now() + days * D.DAY;
            const demo = [[-1, 'DEMO-1', 'Demo Council', 'Riverside Bridge', 214], [-2, 'DEMO-2', 'Demo Estates Ltd', 'Harbour Tower', 23], [-3, 'DEMO-3', 'Demo Arena', 'Civic Hall', -6]]
                .map(([id, reference, customer, project, days]) => ({ id, reference, customer, project, plan: '1 Year Plan', state: 'Active', expiry: at(days), ends: true, days }));
            return { ...data, jobs: [...demo, ...data.jobs].sort((a, b) => (a.expiry ?? Infinity) - (b.expiry ?? Infinity)) };
        };
    }
    const CYCLE = 24, SOON = 60, HQ = -7.6, CLOUD = -.4, SITE = 6;
    const date = ms => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' });
    const time = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const left = job => {
        const days = D.daysLeft(job.expiry);
        if (days === null) return 'Date not supplied';
        if (days < 0) return `${job.ends ? 'Ended' : 'Invoice overdue'} ${-days} day${days === -1 ? '' : 's'} ago`;
        if (days === 0) return job.ends ? 'Ends today' : 'Invoice due today';
        return `${days} day${days === 1 ? '' : 's'} left`;
    };
    const status = job => job.state === 'Paused' ? 'paused' : job.expiry === null ? 'unknown' : D.daysLeft(job.expiry) < 0 ? 'bad' : D.daysLeft(job.expiry) <= SOON ? 'warn' : '';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const S = { jobs: [], hasData: false, partial: false, stale: false, busy: false, refreshed: 0, current: null, start: 0, speed: 1, previous: null, listSignature: '', pulseSignature: '', scrollStart: 0 };
    const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
    const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const clamp = t => Math.max(0, Math.min(1, t));

    // Flat 2D illustration: older Fire TV sticks cannot run a WebGL scene.
    const G = window.Replay2D.create(el('scene3d'), 'subscriptions', { tone: status });
    G.label(S.current); el('idle-sign').hidden = Boolean(S.current);

    function setPhase(text, step, progress) {
        if (el('phase').textContent !== text) el('phase').textContent = text;
        ['collect', 'load', 'away'].forEach(name => {
            el('step-' + name).classList.toggle('active', name === step);
            el('step-' + name).style.setProperty('--p', (progress?.[name] ?? 0) * 100 + '%');
        });
    }
    function fitCaption() {
        for (const [id, minimum] of [['job-reference', 20], ['job-customer', 14]]) {
            const node = el(id); node.style.removeProperty('font-size');
            const maximum = parseFloat(getComputedStyle(node).fontSize);
            for (let size = maximum; size >= minimum; size--) {
                node.style.fontSize = size + 'px';
                const line = parseFloat(getComputedStyle(node).lineHeight);
                if (node.scrollHeight <= line * 2 + 1) break;
            }
        }
    }
    window.addEventListener('resize', fitCaption);
    function choose(now) {
        const jobs = S.jobs;
        let job = null;
        if (jobs.length) {
            const index = jobs.findIndex(item => item.id === S.previous);
            job = jobs[(index + 1) % jobs.length];
        }
        S.current = job; S.start = now;
        // Long lists play faster so a full rotation stays under ~15 minutes.
        S.speed = Math.min(2, Math.max(1, jobs.length * CYCLE / 900));
        el('idle-sign').hidden = Boolean(job) && Boolean(G);
        G?.label(job);
        if (!job) {
            el('job-reference').textContent = S.hasData ? 'No active contracts.' : 'Ready when you are.';
            el('job-customer').textContent = S.hasData ? 'No active or paused cloud subscriptions were returned.' : 'Waiting for verified subscription contracts.';
            el('job-project').textContent = '';
            el('job-time').textContent = '—'; el('job-time').className = '';
            el('job-ago').textContent = '';
            setPhase(S.hasData ? 'No contracts to show' : 'Waiting for contract data', '');
            return;
        }
        S.previous = job.id;
        el('replay-label').textContent = job.state === 'Paused' ? 'CONTRACT PAUSED' : job.expiry === null ? 'DATE UNAVAILABLE' : status(job) === 'bad' ? 'REVIEW CONTRACT' : status(job) === 'warn' ? 'DATE APPROACHING' : 'CONTRACT ILLUSTRATION';
        el('job-kicker').textContent = `CLOUD CONTRACT · ${job.state.toUpperCase()}${job.plan ? ' · ' + job.plan.toUpperCase() : ''}`;
        el('job-reference').textContent = job.project;
        el('job-customer').textContent = job.customer;
        el('job-project').textContent = job.reference;
        fitCaption();
        el('expiry-label').textContent = job.expiry === null ? 'Expiry' : job.ends ? 'Ends' : 'Next invoice';
        el('job-time').textContent = job.expiry === null ? '—' : date(job.expiry);
        el('job-time').className = status(job);
        el('job-ago').textContent = left(job);
        highlight();
    }
    function highlight() {
        document.querySelectorAll('.history-row').forEach(row => row.classList.toggle('is-current', Number(row.dataset.id) === S.current?.id));
    }
    function pulse(jobs) {
        // Contracts expiring in each of the next 12 calendar months (Europe/London).
        const keyNow = D.londonDay(Date.now()), months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(Number(keyNow.slice(0,4)), Number(keyNow.slice(5,7)) - 1 + i, 1, 12)));
        const key = d => new Date(d).toLocaleDateString('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' });
        const keys = months.map(key), buckets = Array(12).fill(0);
        jobs.forEach(job => { if (job.expiry !== null) { const i = keys.indexOf(key(job.expiry)); if (i >= 0) buckets[i]++; } });
        const signature = buckets.join(',') + (S.hasData ? '' : '?');
        if (signature === S.pulseSignature) return;
        S.pulseSignature = signature;
        const max = Math.max(1, ...buckets), label = d => d.toLocaleDateString('en-GB', { month: 'short' });
        el('pulse-bars').style.gridTemplateColumns = 'repeat(12,1fr)';
        el('pulse-bars').innerHTML = buckets.map((n, i) => `<i class="${n ? 'has' : ''}${i === 0 ? ' now' : ''}" style="height:${Math.max(3, n / max * 100)}%" title="${label(months[i])}: ${n} contract${n === 1 ? '' : 's'}"></i>`).join('');
        el('axis-start').textContent = label(months[0]); el('axis-end').textContent = label(months[11]);
    }
    function list() {
        const jobs = S.jobs;
        const jobsSignature = JSON.stringify(jobs), signature = jobsSignature + new Date().toDateString();
        if (signature !== S.listSignature) {
            const changed = !S.listSignature.startsWith(jobsSignature);
            S.listSignature = signature;
            el('history-list').innerHTML = jobs.map(job => `<article class="history-row ${status(job)}" data-id="${job.id}"><strong>${esc(job.project)}</strong><time>${job.expiry === null ? '—' : date(job.expiry)}<small class="days">${left(job)}</small></time><p>${esc(job.customer)}</p><small>${esc(job.reference)}${job.plan ? ' · ' + esc(job.plan) : ''}${job.state === 'Paused' ? ' · Paused' : ''}</small></article>`).join('');
            if (changed && S.scrollHydrated) S.scrollStart = performance.now();
            S.scrollHydrated = true;
            highlight();
        }
        pulse(jobs);
        jobs.forEach(job => { job.days = D.daysLeft(job.expiry); });
        const counts = D.summary(jobs);
        el('contract-summary').textContent = S.hasData ? `${counts.active} active · ${counts.paused} paused · ${counts.overdue} past date · ${counts.undated} undated` : 'Contract status unavailable';
        const next = jobs.find(job => job.days !== null && job.days >= 0);
        el('next-expiry').textContent = next ? left(next).replace(' left', '') : '—';
        el('due-soon').textContent = S.hasData ? String(jobs.filter(job => job.days !== null && job.days >= 0 && job.days <= SOON).length) : '—';
        el('history-empty').hidden = jobs.length > 0;
        el('history-empty').textContent = S.hasData ? 'No active cloud contracts returned.' : 'Contracts are currently unavailable. Retrying automatically.';
        const count = S.hasData ? String(jobs.length) : '—';
        if (el('count').textContent !== count) el('count').textContent = count;
        el('count-label').textContent = S.partial ? 'contracts · partial coverage' : S.stale ? 'contracts · last known data' : 'contracts in view';
        const overflow = el('history-list').scrollHeight > el('history-viewport').clientHeight;
        el('history-note').textContent = overflow ? 'List scrolls automatically · soonest expiry first' : 'All returned contracts shown · soonest expiry first';
    }
    async function refresh() {
        if (S.busy) return; S.busy = true;
        try {
            const data = await D.load();
            R.sceneReceived(S, data);
            S.jobs = data.jobs; S.partial = data.partial; S.hasData = true; S.stale = false; S.refreshed = Date.now();
            el('source-banner').hidden = !data.partial;
            el('source-banner').textContent = 'Partial coverage: the source returned its 2,000-contract safety limit. Figures show only the returned contracts.';
        } catch (error) {
            S.stale = true; R.report({ stale: true, asOf: S.refreshed, records: S.jobs.length });
            el('source-banner').hidden = false;
            el('source-banner').textContent = S.hasData ? `Connection interrupted · showing last-known contracts from ${time(S.refreshed)} · retrying automatically.` : 'Contracts unavailable · retrying automatically. No contracts are being estimated.';
            console.warn('Subscription contracts unavailable:', error.message);
        } finally {
            S.busy = false;
            document.querySelector('.dispatch-screen').classList.toggle('is-stale', S.stale);
            if (!S.current) choose(performance.now());
            tick();
        }
    }
    function tick() {
        el('clock').textContent = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }) + ' · ' + time(Date.now());
        el('source-status').textContent = S.hasData ? `${S.stale ? 'STALE · Last updated' : 'Odoo · Updated'} ${time(S.refreshed)}` : 'Source unavailable · reconnecting';
        list();
    }
    function pose(t) {
        const idle = { rack: 0, link: 0, cloud: 0, ok: false, fail: false, flicker: false, floors: 0, show: 0, gauge: 0, focus: 0, fx: 0, fy: 2.4 };
        const job = S.current;
        if (!job) return idle;
        const expired = job.ends && D.daysLeft(job.expiry) < 0;
        if (job.state === 'Paused' || job.expiry === null || (!job.ends && D.daysLeft(job.expiry) < 0)) {
            setPhase(job.state === 'Paused' ? 'Contract paused · review required' : job.expiry === null ? 'Contract date unavailable' : 'Invoice date passed · review required', 'away', { collect: 1, load: 1, away: 1 });
            return { ...idle, rack: .3, cloud: .2, gauge: 1 };
        }
        if (reduced.matches) {
            setPhase(expired ? 'Contract expired · renewal needed' : 'Contract in date · illustration', 'away', { collect: 1, load: 1, away: 1 });
            return { ...idle, rack: 1, cloud: .4, ok: !expired, fail: expired, floors: expired ? 0 : 1, show: expired ? 0 : 1, gauge: 1 };
        }
        const p = { ...idle };
        // Engineer opens the session; the packet climbs to the cloud and drops to the site controller.
        p.rack = clamp((t - 1) / .8);
        p.link = t < 2 ? 0 : t < 5 ? ease((t - 2) / 3) : t < 8 ? 1 + ease((t - 5) / 3) : 2;
        p.cloud = clamp((t - 4.2) / .6) * (1 - clamp((t - 7) / 1.5) * .6);
        if (expired) {
            // Expired: the controller refuses the session and the façade stutters, then goes dark.
            p.fail = t >= 8; p.flicker = t >= 8.5 && t < 11;
            p.floors = t >= 8.5 && t < 11 ? .5 : 0; p.show = p.floors ? 1 : 0;
        } else {
            p.ok = t >= 8;
            p.floors = clamp((t - 8.5) / 3);
            p.show = clamp((t - 11) / 1) * (1 - clamp((t - 22.5) / 1.2));
            if (t >= 22.5) p.floors = 1 - clamp((t - 22.5) / 1.2);
        }
        p.gauge = ease((t - 13) / 3);
        const bump = (a, b) => ease((t - a) / 1.5) * (1 - ease((t - b + 1.5) / 1.5));
        const atSite = bump(9, 21.5);
        p.focus = .75 * atSite; p.fx = SITE + 1.8; p.fy = 2.8;
        const step = t < 8 ? 'collect' : t < 13 ? 'load' : 'away';
        setPhase(t < 2 ? 'Opening remote session' : t < 5 ? 'Connecting to the cloud' : t < 8 ? 'Reaching the site controller' : expired ? (t < 13 ? 'Contract end date passed' : 'Review contract coverage') : t < 11.5 ? 'Switching on the lighting' : t < 13 ? 'Running the scene' : status(job) === 'warn' ? 'Contract renewal due soon' : 'Contract in date · illustrated lighting',
            step, { collect: clamp(t / 8), load: clamp((t - 8) / 5), away: clamp((t - 13) / 10) });
        return p;
    }
    let lastFrame = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        if (!R.visible() || now - lastFrame < 250) return;
        lastFrame = now;
        if (S.current && (!S.jobs.some(job => job.id === S.current.id) || (now - S.start) * S.speed >= CYCLE * 1000)) choose(now);
        const t = (now - S.start) / 1000 * S.speed; pose(t); G.render(t, S.speed, reduced.matches);
        R.scrollList(S, now, true);
    }
    R.attachScene(S, choose, tick); refresh(); requestAnimationFrame(frame);
    setInterval(tick, 1000);
    setInterval(() => { if (R.visible()) refresh(); }, 15 * 60000);
    document.addEventListener('visibilitychange', () => { if (R.visible()) { choose(performance.now()); refresh(); } });

