// State
let catalogData = [];
let activeCategory = 'all';
let currentSearch = '';

// DOM Elements
const serverStatusDot = document.getElementById('serverStatusDot');
const serverStatusText = document.getElementById('serverStatusText');
const metricNodeVer = document.getElementById('metricNodeVer');
const metricHeap = document.getElementById('metricHeap');
const metricUptime = document.getElementById('metricUptime');
const categoryFilters = document.getElementById('categoryFilters');
const searchInput = document.getElementById('searchInput');
const cardsContainer = document.getElementById('cardsContainer');
const errorCount = document.getElementById('errorCount');
const jsonViewer = document.getElementById('jsonViewer');
const currentEndpoint = document.getElementById('currentEndpoint');
const requestLatency = document.getElementById('requestLatency');
const responseStatusPill = document.getElementById('responseStatusPill');
const copyResponseBtn = document.getElementById('copyResponseBtn');
const clearResponseBtn = document.getElementById('clearResponseBtn');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const processLogsList = document.getElementById('processLogsList');

// Fetch Health & Metrics
async function checkHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('Health check non-200');
    const data = await res.json();
    serverStatusDot.className = 'status-indicator online';
    serverStatusText.textContent = 'Server Online';
    metricNodeVer.textContent = data.nodeVersion || '-';
    metricHeap.textContent = data.memory?.heapUsedMb ? `${data.memory.heapUsedMb} MB` : '-';
    metricUptime.textContent = `${data.uptimeSeconds}s`;
  } catch (err) {
    serverStatusDot.className = 'status-indicator error';
    serverStatusText.textContent = 'Server Offline / Unreachable';
  }
}

// Fetch Catalog
async function fetchCatalog() {
  try {
    const res = await fetch('/api/errors');
    const data = await res.json();
    catalogData = data.catalog || [];
    renderCategories(data.categories || []);
    renderCards();
  } catch (err) {
    console.error('Failed to load catalog:', err);
    cardsContainer.innerHTML = '<div class="empty-logs">Failed to load error catalog. Ensure server is running.</div>';
  }
}

// Render Categories
function renderCategories(categories) {
  categoryFilters.innerHTML = `<button class="filter-btn active" data-category="all">All Errors</button>`;
  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.category = cat;
    btn.textContent = cat;
    categoryFilters.appendChild(btn);
  });

  categoryFilters.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    activeCategory = e.target.dataset.category;
    renderCards();
  });
}

// Render Cards
function renderCards() {
  const filtered = catalogData.filter((item) => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory;
    const q = currentSearch.toLowerCase();
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchCategory && matchSearch;
  });

  errorCount.textContent = filtered.length;

  if (filtered.length === 0) {
    cardsContainer.innerHTML = '<div class="empty-logs">No errors matching the filter criteria.</div>';
    return;
  }

  cardsContainer.innerHTML = filtered
    .map((item) => {
      const isCrashable = item.id === 'uncaught-exception' || item.id === 'out-of-memory';
      const hasAlternative = item.id === 'type-error' || item.id === 'range-error' || item.id === 'system-fs-enoent';

      let altButtonsHtml = '';
      if (item.id === 'type-error') {
        altButtonsHtml = `<button class="btn-alt" onclick="triggerEndpoint('${item.endpoint}?mode=call')">Call Non-Function</button>`;
      } else if (item.id === 'range-error') {
        altButtonsHtml = `<button class="btn-alt" onclick="triggerEndpoint('${item.endpoint}?type=precision')">Precision Out of Range</button>`;
      } else if (item.id === 'system-fs-enoent') {
        altButtonsHtml = `<button class="btn-alt" onclick="triggerEndpoint('${item.endpoint}?async=true')">Async FS Error</button>`;
      } else if (item.id === 'custom-http-status') {
        altButtonsHtml = `
          <button class="btn-alt" onclick="triggerEndpoint('${item.endpoint}?status=401')">401</button>
          <button class="btn-alt" onclick="triggerEndpoint('${item.endpoint}?status=404')">404</button>
          <button class="btn-alt" onclick="triggerEndpoint('${item.endpoint}?status=503')">503</button>
        `;
      } else if (isCrashable) {
        altButtonsHtml = `<button class="btn-alt" style="color: #ef4444; border-color: rgba(239,68,68,0.3)" onclick="confirmCrash('${item.endpoint}?crash=true')">⚠️ Crash Process</button>`;
      }

      return `
        <div class="error-card" id="card-${item.id}">
          <div class="card-top">
            <div class="card-title-group">
              <h3 class="card-title">${escapeHtml(item.name)}</h3>
              <span class="category-tag">${escapeHtml(item.category)}</span>
            </div>
            <span class="endpoint-slug">${escapeHtml(item.endpoint)}</span>
          </div>
          <p class="card-desc">${escapeHtml(item.description)}</p>
          <pre class="code-snippet-box"><code>${escapeHtml(item.snippet)}</code></pre>
          <div class="card-actions">
            <div class="action-buttons-group">
              <button class="btn-trigger" onclick="triggerEndpoint('${item.endpoint}')">
                <span>💥 Trigger Error</span>
              </button>
              ${altButtonsHtml}
              <button class="btn-alt" onclick="copyCurl('${item.endpoint}')" title="Copy curl command">
                📋 cURL
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// Trigger Endpoint
async function triggerEndpoint(endpoint) {
  const startTime = performance.now();
  currentEndpoint.textContent = endpoint;
  requestLatency.textContent = 'Executing...';
  responseStatusPill.className = 'status-pill';
  responseStatusPill.textContent = 'Pending...';
  jsonViewer.innerHTML = '<code>Waiting for server response...</code>';

  try {
    const res = await fetch(endpoint);
    const duration = Math.round(performance.now() - startTime);
    requestLatency.textContent = `${duration} ms`;

    const statusText = `${res.status} ${res.statusText || ''}`;
    responseStatusPill.textContent = statusText;
    if (res.ok) {
      responseStatusPill.className = 'status-pill success';
    } else {
      responseStatusPill.className = 'status-pill error';
    }

    const data = await res.json();
    jsonViewer.textContent = JSON.stringify(data, null, 2);

    // Refresh background logs in case an unhandled rejection occurred
    setTimeout(fetchProcessLogs, 300);
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    requestLatency.textContent = `${duration} ms`;
    responseStatusPill.textContent = 'Connection Failed / Process Crashed';
    responseStatusPill.className = 'status-pill error';
    jsonViewer.textContent = JSON.stringify(
      {
        clientError: err.message,
        hint: 'If you triggered a fatal process crash or OOM, the Node.js server may have terminated.',
      },
      null,
      2
    );
  }
}

// Confirm Crash Warning
function confirmCrash(endpoint) {
  if (confirm('Warning: This will deliberately crash the Node.js process or trigger an uncaught fatal exception! Proceed?')) {
    triggerEndpoint(endpoint);
  }
}

// Copy cURL
function copyCurl(endpoint) {
  const host = window.location.origin;
  const curlCmd = `curl -i "${host}${endpoint}"`;
  navigator.clipboard.writeText(curlCmd).then(() => {
    alert(`Copied cURL command to clipboard:\n\n${curlCmd}`);
  });
}

// Fetch Background Process Logs
async function fetchProcessLogs() {
  try {
    const res = await fetch('/api/errors/logs');
    if (!res.ok) return;
    const data = await res.json();
    const logs = data.logs || [];

    if (logs.length === 0) {
      processLogsList.innerHTML = '<div class="empty-logs">No process-level background errors recorded yet.</div>';
      return;
    }

    processLogsList.innerHTML = logs
      .map(
        (log) => `
        <div class="log-entry">
          <div class="log-entry-header">
            <span class="log-type">[${escapeHtml(log.type)}] ${escapeHtml(log.name)}</span>
            <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="log-msg">${escapeHtml(log.message)}</div>
        </div>
      `
      )
      .join('');
  } catch (e) {
    // Ignore fetch log error
  }
}

// Clear logs
async function clearLogs() {
  try {
    await fetch('/api/errors/logs', { method: 'DELETE' });
    fetchProcessLogs();
  } catch (e) {
    console.error(e);
  }
}

// Search input
searchInput.addEventListener('input', (e) => {
  currentSearch = e.target.value;
  renderCards();
});

// Inspector buttons
copyResponseBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(jsonViewer.textContent).then(() => {
    const prev = copyResponseBtn.textContent;
    copyResponseBtn.textContent = 'Copied!';
    setTimeout(() => (copyResponseBtn.textContent = prev), 1500);
  });
});

clearResponseBtn.addEventListener('click', () => {
  jsonViewer.innerHTML = '<code>// Panel cleared.</code>';
  currentEndpoint.textContent = '-';
  requestLatency.textContent = '-';
  responseStatusPill.className = 'status-pill';
  responseStatusPill.textContent = 'Idle';
});

refreshLogsBtn.addEventListener('click', fetchProcessLogs);
clearLogsBtn.addEventListener('click', clearLogs);

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize
checkHealth();
fetchCatalog();
fetchProcessLogs();

// Heartbeat
setInterval(checkHealth, 5000);
setInterval(fetchProcessLogs, 4000);
