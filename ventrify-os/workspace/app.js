// ============================================================
// Ventrify OS — Operator Workspace · Shell + utilities
// Renders the top bar + sidebar consistently across all views.
// ============================================================

(function() {
  if (typeof window === 'undefined') return;
  if (!window.WORKSPACE) return;

  const { org, helpers } = window.WORKSPACE;
  const current = helpers.currentOperator();

  // Determine which page is active based on the URL
  const path = window.location.pathname.split('/').pop() || 'dashboard.html';
  const activeMap = {
    'dashboard.html': 'dashboard',
    'queue.html': 'queue',
    'program.html': 'programs',
    'team.html': 'team',
    'settings.html': 'settings',
    '': 'dashboard'
  };
  const active = activeMap[path] || 'dashboard';

  function renderTopbar() {
    return `
      <div class="topbar">
        <a href="dashboard.html" class="topbar-logo">
          VENTRIFY <span class="os">OS</span>
          <span class="tag">Workspace</span>
        </a>
        <div class="topbar-org">
          <span class="topbar-org-name">${org.name}</span>
          <span class="topbar-org-tier">${org.tier}</span>
        </div>
        <div class="topbar-spacer"></div>
        <div class="topbar-utility">
          <a href="../index.html" class="topbar-utility-link">OS site</a>
          <a href="../pricing.html" class="topbar-utility-link">Pricing</a>
          <a href="#" class="topbar-utility-link">Docs</a>
          <a href="#" class="topbar-utility-link">Help</a>
          <div class="topbar-divider"></div>
          <div class="avatar topbar-avatar" style="background:${current.avatarColor};">${current.avatar}</div>
        </div>
      </div>
    `;
  }

  const queueCount = window.WORKSPACE.actions.length;
  const programCount = window.WORKSPACE.programs.length;
  const teamCount = window.WORKSPACE.operators.length;

  function renderSidebar() {
    return `
      <aside class="sidebar">
        <div class="sidebar-section">Operate</div>
        <a href="dashboard.html" class="sidebar-link ${active === 'dashboard' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25A4;</span>
          <span>Portfolio</span>
          <span class="badge">${programCount}</span>
        </a>
        <a href="queue.html" class="sidebar-link ${active === 'queue' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25C6;</span>
          <span>Action queue</span>
          <span class="badge">${queueCount}</span>
        </a>

        <div class="sidebar-section">Manage</div>
        <a href="team.html" class="sidebar-link ${active === 'team' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25CB;</span>
          <span>Team</span>
          <span class="badge">${teamCount}</span>
        </a>
        <a href="settings.html" class="sidebar-link ${active === 'settings' ? 'active' : ''}">
          <span class="sidebar-link-icon">&#x25C7;</span>
          <span>Settings</span>
        </a>
      </aside>
    `;
  }

  window.renderShell = function(mainContentHTML) {
    document.body.innerHTML = renderTopbar() + `
      <div class="app-shell">
        ${renderSidebar()}
        <main class="main">
          <div class="main-inner">
            ${mainContentHTML}
          </div>
        </main>
      </div>
    `;
  };

  // Hub status icon helper
  window.hubStatusClass = function(status) {
    return status || 'pending';
  };

  // Friendly date formatter (just outputs the passed string for the prototype)
  window.fmtDate = function(s) { return s; };

  // Health pill class
  window.healthClass = function(h) {
    return {
      'on-track': 'health-on-track',
      'attention': 'health-attention',
      'stuck': 'health-stuck'
    }[h] || 'pill';
  };
  window.healthLabel = function(h) {
    return { 'on-track': 'On track', 'attention': 'Needs attention', 'stuck': 'Stuck' }[h] || h;
  };
})();
