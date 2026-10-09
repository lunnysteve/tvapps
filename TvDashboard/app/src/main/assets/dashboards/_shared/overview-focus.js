/* Honest, action-oriented content shared by the four operational overviews. */
const OverviewFocus = (() => {
    let list;

    function init(kind) {
        const chart = document.getElementById('yearChart');
        const panel = chart.closest('.panel');
        const snapshot = panel.querySelector('.year-snapshot');
        if (snapshot) snapshot.remove();
        chart.closest('.chart-wrap').remove();
        const divider = panel.querySelector('.divider');
        if (divider) divider.remove();
        const historyLabel = Array.from(panel.querySelectorAll('.panel-sub'))
            .find(el => /Monthly .* History/i.test(el.textContent));
        if (historyLabel) historyLabel.remove();

        if (kind === 'subscriptions') {
            panel.querySelector('.year-stats').remove();
            panel.querySelector('.panel-title').textContent = 'Upcoming Renewals';
            panel.querySelector('.panel-sub').textContent = 'Contracts with an invoice or end date';
        } else {
            panel.querySelector('.panel-title').textContent = 'Yearly Totals & Open Items';
            panel.querySelector('.panel-sub').textContent = 'Year to date against prior full year';
            panel.querySelector('.y-item:last-child .y-lbl').textContent = 'Difference to prior full year';
            const title = document.createElement('div');
            title.className = 'panel-title';
            title.textContent = 'Open Items';
            panel.appendChild(title);
        }

        list = document.createElement('div');
        list.className = 'overview-focus-list';
        list.id = 'overview-focus-list';
        panel.appendChild(list);

        const sidebar = document.querySelector('.state-bars').closest('.panel');
        const recentTitle = Array.from(sidebar.children)
            .find(el => el.classList.contains('panel-title') && el.textContent.includes('Record List'));
        for (const child of Array.from(sidebar.children)) {
            if (child === recentTitle) break;
            child.style.display = 'none';
        }
        sidebar.classList.add('focused-sidebar');
    }

    function dateValue(value) {
        if (!value) return null;
        const date = new Date(String(value).replace(' ', 'T'));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function nameValue(value) {
        return Array.isArray(value) ? value[1] : value;
    }

    function render(items, kind) {
        if (kind === 'subscriptions') {
            const planPanel = document.getElementById('prod-bars').closest('.panel');
            const singlePlan = document.querySelectorAll('#prod-bars .pbar').length <= 1;
            planPanel.style.display = singlePlan ? 'none' : '';
            planPanel.parentElement.classList.toggle('single-plan', singlePlan);
        }
        const now = new Date();
        const records = items.map(item => {
            let date, detail, state;
            if (kind === 'manufacturing') {
                if (item.state === 'done' || item.state === 'cancel') return null;
                date = dateValue(item.date_start);
                detail = nameValue(item.product_id) || 'Production order';
                state = item.state === 'progress' ? 'Working' : item.state === 'to_close' ? 'To close' : 'Queued';
            } else if (kind === 'inbound') {
                if (item.receipt_status === 'full') return null;
                date = dateValue(item.date_planned);
                detail = nameValue(item.partner_id) || 'Supplier not listed';
                state = date && date < now ? 'Late' : 'Incoming';
            } else if (kind === 'outbound') {
                const status = String(item.delivery_status || '').toLowerCase();
                if (['full', 'shipped', 'fully delivered'].includes(status)) return null;
                date = dateValue(item.commitment_date);
                detail = nameValue(item.partner_id) || 'Customer not listed';
                state = date && date < now ? 'Late' : status === 'picking' ? 'Picking' : 'To dispatch';
            } else {
                const status = String(item.subscription_state || '').toLowerCase();
                if (status.includes('close') || status.includes('churn') || status === 'cancel') return null;
                date = dateValue(item.next_invoice_date || item.end_date);
                if (!date) return null;
                detail = nameValue(item.partner_id) || 'Account not listed';
                state = date < now ? 'Past due' : 'Upcoming';
            }
            return {
                name: item.name || 'Unnamed record', detail, date, state,
                sort: date ? date.getTime() : Number.MAX_SAFE_INTEGER
            };
        }).filter(Boolean).sort((a, b) => a.sort - b.sort)
            .slice(0, kind === 'subscriptions' ? 6 : 5);

        list.replaceChildren();
        if (!records.length) {
            const empty = document.createElement('div');
            empty.className = 'overview-focus-empty';
            empty.textContent = kind === 'subscriptions' ? 'No dated renewals in this view.' : 'No open items in this view.';
            list.appendChild(empty);
            return;
        }
        for (const record of records) {
            const row = document.createElement('div');
            row.className = 'overview-focus-row';
            const name = document.createElement('div');
            name.className = 'overview-focus-name';
            name.textContent = record.name;
            const date = document.createElement('div');
            date.className = 'overview-focus-date';
            date.textContent = record.date
                ? record.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + record.state
                : record.state;
            const detail = document.createElement('div');
            detail.className = 'overview-focus-detail';
            detail.textContent = record.detail;
            row.append(name, date, detail);
            list.appendChild(row);
        }
    }

    function error() {
        list.replaceChildren();
        const message = document.createElement('div');
        message.className = 'overview-focus-empty';
        message.textContent = 'Live records unavailable. Check the connection.';
        list.appendChild(message);
    }

    return { init, render, error };
})();
