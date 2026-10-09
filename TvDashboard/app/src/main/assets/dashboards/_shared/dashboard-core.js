/* Shared "core engine" for TV dashboard pages (Architainment theme).
   Clock, live-status indicator, particle background, ticker style injection,
   weather icon lookup, and visibility-aware polling — identical across
   every dashboard. Page-specific data fetch/render logic stays inline. */

function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('hd-time');
    const dateEl = document.getElementById('hd-date');
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    }
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'short'
        });
    }
}

function setLiveError(message) {
    const pip = document.querySelector('.live-pip');
    if (pip) {
        pip.style.backgroundColor = 'var(--wait)';
        pip.style.color = 'var(--wait)';
        pip.style.boxShadow = '0 0 10px var(--wait)';
    }
    const ftStatus = document.getElementById('ft-status');
    if (ftStatus) {
        ftStatus.textContent = message ? "SYNC ERROR: " + message.toUpperCase() : 'SYNC ERROR';
        ftStatus.style.color = 'var(--wait)';
    }
}

function setLiveStale() {
    const pip = document.querySelector('.live-pip');
    if (pip) {
        pip.style.backgroundColor = 'var(--pick)';
        pip.style.color = 'var(--pick)';
        pip.style.boxShadow = '0 0 10px var(--pick)';
    }
    const ftStatus = document.getElementById('ft-status');
    if (ftStatus) {
        ftStatus.textContent = '⚠ OFFLINE / MOCK MODE';
        ftStatus.style.color = 'var(--pick)';
    }
}

function setLiveOk() {
    const pip = document.querySelector('.live-pip');
    if (pip) {
        pip.style.backgroundColor = 'var(--ship)';
        pip.style.color = 'var(--ship)';
        pip.style.boxShadow = '0 0 10px var(--ship)';
    }
    const ftStatus = document.getElementById('ft-status');
    if (ftStatus) {
        ftStatus.textContent = 'SYSTEM OPERATIONAL';
        ftStatus.style.color = 'var(--ship)';
    }
}

function setLiveSyncing() {
    const pip = document.querySelector('.live-pip');
    if (pip) {
        pip.style.backgroundColor = 'var(--accent)';
        pip.style.color = 'var(--accent)';
        pip.style.boxShadow = '0 0 10px var(--accent)';
    }
}

function registerVisibilityRefresh(fetchFn, intervalMs) {
    let intervalId = setInterval(fetchFn, intervalMs);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (intervalId) { clearInterval(intervalId); intervalId = null; }
        } else {
            if (!intervalId) { fetchFn(); intervalId = setInterval(fetchFn, intervalMs); }
        }
    });
}

function initParticles(color) {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const particleColor = color || '#10B981';
    let particles = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedY = -(Math.random() * 0.12 + 0.04);
            this.speedX = (Math.random() * 0.15 - 0.075);
            this.alpha = Math.random() * 0.12 + 0.03;
        }
        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            if (this.y < 0 || this.x < 0 || this.x > canvas.width) {
                this.reset();
                this.y = canvas.height;
            }
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = particleColor;
            ctx.shadowBlur = 2;
            ctx.shadowColor = particleColor;
            ctx.fill();
            ctx.restore();
        }
    }

    for (let i = 0; i < 20; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

(function injectTickerStyle() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ticker-scroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
        }
        .ticking .ti { display: inline-flex !important; width: max-content; }
    `;
    document.head.appendChild(style);
})();

function applyTickerToVisible(selector) {}

function getWeatherIcon(desc) {
    const d = desc.toLowerCase();
    if (d.includes('rain') || d.includes('shower') || d.includes('drizzle')) {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="16" y1="16" x2="16" y2="22"/></svg>';
    } else if (d.includes('cloud') || d.includes('overcast') || d.includes('mist')) {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>';
    } else if (d.includes('snow') || d.includes('sleet') || d.includes('hail')) {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8" y2="22"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="16" y1="16" x2="16" y2="22"/></svg>';
    } else if (d.includes('thunder') || d.includes('storm')) {
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 8.58"/><polyline points="13 11 9 17 12 17 11 23"/></svg>';
    } else { // Sun / Clear
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    }
}
