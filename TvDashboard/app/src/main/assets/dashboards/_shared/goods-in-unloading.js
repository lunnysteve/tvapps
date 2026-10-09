(function () {
    'use strict';
    const D = window.ReceiptHistory, el = id => document.getElementById(id);
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
            el('lorry').setAttribute('transform', 'translate(500 0)');
            el('job-reference').textContent = S.hasData ? 'Ready for the next one.' : 'Ready when you are.';
            el('job-customer').textContent = S.hasData ? 'No received deliveries in the current 24-hour window.' : 'Waiting for verified received deliveries.';
            el('job-project').textContent = '';
            el('job-time').textContent = '—';
            setPhase(S.hasData ? 'Receiving area clear' : 'Waiting for receipt data', '');
            return;
        }
        S.previous = job.id;
        el('replay-label').textContent = 'RECEIPT REPLAY';
        el('job-kicker').textContent = 'COMPLETED RECEIPT';
        el('job-reference').textContent = job.reference;
        el('job-customer').textContent = job.supplier;
        el('job-project').textContent = job.project;
        el('job-time').textContent = time(job.when);
        fitLabel('box-ref', job.reference, 14);
        fitLabel('box-customer', job.supplier, 23);
        fitLabel('box-project', job.project || job.order, 26);
        el('box-time').textContent = 'IN · ' + date(job.when) + ' · ' + time(job.when);
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
            el('history-list').innerHTML = jobs.map(job => `<article class="history-row" data-id="${job.id}"><strong>${esc(job.reference)}</strong><time>${time(job.when)}</time><p>${esc(job.supplier)}</p><small>${esc(job.project || job.order)} · ${date(job.when)}</small></article>`).join('');
            S.scrollStart = performance.now(); highlight();
        }
        el('history-empty').hidden = jobs.length > 0;
        el('history-empty').textContent = S.hasData ? 'No received deliveries in this 24-hour window.' : 'Receipt history is currently unavailable. Retrying automatically.';
        el('count').textContent = S.hasData ? jobs.length : '—';
        el('count-label').textContent = S.partial ? 'receipts · partial coverage' : S.stale ? 'receipts · last known data' : 'received deliveries';
        el('window-label').textContent = `${date(Date.now() - D.DAY)} ${time(Date.now() - D.DAY)} – ${date(Date.now())} ${time(Date.now())} · London`;
        const overflow = el('history-list').scrollHeight > el('history-viewport').clientHeight;
        el('history-note').textContent = overflow ? 'List scrolls automatically · newest first' : 'All returned receipts shown · newest first';
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
            el('source-banner').textContent = 'Partial coverage: the source returned its 2,000-transfer safety limit. Figures show only the returned receipts.';
        } catch (error) {
            S.stale = true;
            el('source-banner').hidden = false;
            el('source-banner').textContent = S.hasData ? `Connection interrupted · showing last-known receipts from ${time(S.refreshed)} · retrying automatically.` : 'Receipt history unavailable · retrying automatically. No receipts are being estimated.';
            console.warn('Receipt history unavailable:', error.message);
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
        if (S.current && (!recent().some(job => job.id === S.current.id) || now - S.start >= 30000)) choose(now);
        if (S.current) {
            const t = (now - S.start) / 1000;
            let fx = -320, px = 753, py = 246, lift = 0, vx = 0;
            if (reduced.matches) { px = 250; py = 339; setPhase('Received delivery · illustrated replay', 'away'); }
            else {
                // The pallet rides inside the lorry until the forks collect it.
                vx = mix(500, 0, ease(t / 4)); px = 753 + vx;
                if (t >= 3) fx = mix(-320, 340, ease((t - 3) / 4));
                if (t >= 5) lift = mix(0, -93, ease((t - 5) / 2));
                if (t >= 7) fx = mix(340, 543, ease((t - 7) / 3));
                if (t >= 10) {
                    lift = mix(-93, -101, ease(t - 10));
                    px = fx + 210; py = 339 + lift;
                }
                if (t >= 11) { fx = mix(543, 290, ease((t - 11) / 3)); px = fx + 210; }
                if (t >= 14) {
                    fx = mix(290, 240, ease((t - 14) / 2));
                    lift = mix(-101, -24, ease((t - 14) / 2));
                    px = fx + 210; py = 339 + lift;
                }
                if (t >= 16) { fx = mix(240, 40, ease((t - 16) / 4)); px = fx + 210; }
                if (t >= 20) { lift = mix(-24, 0, ease((t - 20) / 2)); py = 339 + lift; }
                if (t >= 22) { px = 250; py = 339; fx = mix(40, -320, ease((t - 22) / 3)); }
                if (t >= 23) vx = mix(0, 500, ease((t - 23) / 4));
                setPhase(t < 4 ? 'Delivery arriving' : t < 7 ? 'Raising the forks' : t < 10 ? 'Collecting the pallet' : t < 14 ? 'Unloading the lorry' : t < 20 ? 'Moving to goods in' : t < 22 ? 'Setting down the delivery' : 'Received · ready for goods in', t < 7 ? 'collect' : t < 22 ? 'load' : 'away');
            }
            el('forklift').setAttribute('transform', `translate(${fx.toFixed(2)} 0)`);
            el('forks').setAttribute('transform', `translate(0 ${lift.toFixed(2)})`);
            el('pallet').setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
            el('pallet').setAttribute('opacity', '1');
            el('lorry').setAttribute('transform', `translate(${vx.toFixed(2)} 0)`);
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
