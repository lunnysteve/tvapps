(function () {
    'use strict';
    const D = window.DispatchHistory, el = id => document.getElementById(id);
    const time = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const date = ms => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' });
    const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const S = { jobs: [], hasData: false, partial: false, stale: false, busy: false, refreshed: 0, current: null, queue: [], seen: new Set(), start: 0, previous: null, listSignature: '', scrollStart: 0 };
    const recent = () => S.jobs.filter(job => job.when > Date.now() - D.DAY && job.when <= Date.now());
    function setPhase(text, step) {
        if (el('phase').textContent !== text) el('phase').textContent = text;
        ['collect', 'load', 'away'].forEach(name => el('step-' + name).classList.toggle('active', name === step));
    }
    function fitLabel(id, value, max) {
        el(id).textContent = value.length > max ? value.slice(0, max - 1) + '…' : value;
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
        S.current = job || null; S.start = now;
        el('idle-sign').style.display = job ? 'none' : '';
        if (!job) {
            el('pallet').setAttribute('opacity', '0');
            el('forklift').setAttribute('transform', 'translate(-320 0)');
            el('van').setAttribute('transform', 'translate(0 0)');
            el('job-reference').textContent = S.hasData ? 'Ready for the next one.' : 'Ready when you are.';
            el('job-customer').textContent = S.hasData ? 'No fully delivered jobs in the current 24-hour window.' : 'Waiting for verified completed dispatches.';
            el('job-project').textContent = '';
            el('job-time').textContent = '—';
            setPhase(S.hasData ? 'Loading bay clear' : 'Waiting for dispatch data', '');
            return;
        }
        S.previous = job.id;
        el('replay-label').textContent = 'DISPATCH REPLAY';
        el('job-kicker').textContent = 'COMPLETED DISPATCH';
        el('job-reference').textContent = job.reference;
        el('job-customer').textContent = job.customer;
        el('job-project').textContent = job.project;
        el('job-time').textContent = time(job.when);
        fitLabel('box-ref', job.reference, 14);
        fitLabel('box-customer', job.customer, 23);
        fitLabel('box-project', job.project || job.transfer, 26);
        el('box-time').textContent = 'OUT · ' + date(job.when) + ' · ' + time(job.when);
        highlight();
    }
    function highlight() {
        document.querySelectorAll('.history-row').forEach(row => row.classList.toggle('is-current', Number(row.dataset.id) === S.current?.id));
    }
    function list() {
        const jobs = recent();
        const signature = JSON.stringify(jobs);
        if (signature !== S.listSignature) {
            S.listSignature = signature;
            el('history-list').innerHTML = jobs.map(job => `<article class="history-row" data-id="${job.id}"><strong>${esc(job.reference)}</strong><time>${time(job.when)}</time><p>${esc(job.customer)}</p><small>${esc(job.project || job.transfer)} · ${date(job.when)}</small></article>`).join('');
            S.scrollStart = performance.now(); highlight();
        }
        el('history-empty').hidden = jobs.length > 0;
        el('history-empty').textContent = S.hasData ? 'No completed dispatches in this 24-hour window.' : 'Dispatch history is currently unavailable. Retrying automatically.';
        el('count').textContent = S.hasData ? jobs.length : '—';
        el('count-label').textContent = S.partial ? 'jobs · partial coverage' : S.stale ? 'jobs · last known data' : 'fully delivered jobs';
        el('window-label').textContent = `${date(Date.now() - D.DAY)} ${time(Date.now() - D.DAY)} – ${date(Date.now())} ${time(Date.now())} · London`;
        const overflow = el('history-list').scrollHeight > el('history-viewport').clientHeight;
        el('history-note').textContent = overflow ? 'List scrolls automatically · newest first' : 'All returned jobs shown · newest first';
    }
    async function refresh() {
        if (S.busy) return; S.busy = true;
        try {
            const data = await D.load();
            // Prioritise newly observed completions at the next animation boundary.
            if (S.hasData) data.jobs.filter(job => !S.seen.has(job.id)).forEach(job => S.queue.push(job.id));
            data.jobs.forEach(job => S.seen.add(job.id));
            S.jobs = data.jobs; S.partial = data.partial; S.hasData = true; S.stale = false; S.refreshed = Date.now();
            el('source-banner').hidden = !data.partial;
            el('source-banner').textContent = 'Partial coverage: the source returned its 2,000-transfer safety limit. Figures show only the returned jobs.';
        } catch (error) {
            S.stale = true;
            el('source-banner').hidden = false;
            el('source-banner').textContent = S.hasData ? `Connection interrupted · showing last-known dispatches from ${time(S.refreshed)} · retrying automatically.` : 'Dispatch history unavailable · retrying automatically. No jobs are being estimated.';
            console.warn('Dispatch history unavailable:', error.message);
        } finally {
            S.busy = false;
            document.querySelector('.dispatch-screen').classList.toggle('is-stale', S.stale);
            list();
            if (!S.current) choose(performance.now());
            tick();
        }
    }
    function tick() {
        el('clock').textContent = date(Date.now()) + ' · ' + time(Date.now());
        el('source-status').textContent = S.hasData ? `${S.stale ? 'STALE · Last received' : 'Odoo · Updated'} ${time(S.refreshed)}` : 'Source unavailable · reconnecting';
        list();
    }
    const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
    const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    let lastFrame = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden || now - lastFrame < 32) return;
        lastFrame = now;
        if (S.current && (!recent().some(job => job.id === S.current.id) || now - S.start >= 24000)) choose(now);
        if (S.current) {
            const t = (now - S.start) / 1000;
            let fx = -320, px = 370, py = 339, lift = 0, opacity = 1, vx = 0, scale = 1;
            if (reduced.matches) { fx = 180; setPhase('Completed dispatch · illustrated replay', 'away'); }
            else {
                fx = mix(-320, 180, ease(t / 5));
                if (t >= 5) { lift = mix(0, -93, ease((t - 5) / 2)); py = 339 + lift; }
                if (t >= 8) { fx = mix(180, 600, ease((t - 8) / 6)); px = fx + 190; }
                if (t >= 14) { px = mix(790, 825, ease((t - 14) / 2)); scale = mix(1, .7, ease((t - 14) / 2)); py = 417 - 171 * scale; opacity = mix(1, 0, (t - 15.5) / .5); }
                if (t >= 16) { fx = mix(600, -320, ease((t - 16) / 5)); lift = mix(-93, 0, ease((t - 16) / 2)); }
                if (t >= 19) vx = mix(0, 500, ease((t - 19) / 4));
                setPhase(t < 5 ? 'Collecting the job' : t < 8 ? 'Lifting the pallet' : t < 16 ? 'Loading the van' : t < 19 ? 'Loaded and ready' : 'On its way', t < 8 ? 'collect' : t < 19 ? 'load' : 'away');
            }
            el('forklift').setAttribute('transform', `translate(${fx.toFixed(2)} 0)`);
            el('forks').setAttribute('transform', `translate(0 ${lift.toFixed(2)})`);
            el('pallet').setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)}) scale(${scale.toFixed(3)})`);
            el('pallet').setAttribute('opacity', opacity.toFixed(2));
            el('van').setAttribute('transform', `translate(${vx.toFixed(2)} 0)`);
        }
        const overflow = Math.max(0, el('history-list').scrollHeight - el('history-viewport').clientHeight);
        if (overflow) {
            // Pause at each end, move slowly enough to read, then return to newest.
            const travel = overflow / 22 * 1000, cycle = 8000 + travel * 2, t = (now - S.scrollStart) % cycle;
            let y = t < 4000 ? 0 : t < 4000 + travel ? (t - 4000) / travel * overflow : t < 8000 + travel ? overflow : overflow * (1 - (t - 8000 - travel) / travel);
            if (reduced.matches) y = Math.min(overflow, Math.floor((now - S.scrollStart) / 8000) % (Math.ceil(overflow / el('history-viewport').clientHeight) + 1) * el('history-viewport').clientHeight);
            el('history-list').style.transform = `translateY(-${y.toFixed(1)}px)`;
        } else el('history-list').style.transform = '';
    }
    choose(performance.now()); tick(); refresh(); requestAnimationFrame(frame);
    setInterval(tick, 1000);
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { choose(performance.now()); refresh(); } });
})();
