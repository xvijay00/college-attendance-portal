// Main Application Controller & Dashboard
const App = {
  currentTab: 'tab-dashboard',

  init() {
    this.bindTabNavigation();
    this.bindDashboardActions();

    // Initialize modules
    Auth.init();
    Attendance.init();
    Students.init();
    Holidays.init();
    Reports.init();

    if (Auth.isAuthenticated()) {
      this.loadDashboard();
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  bindTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  },

  switchTab(targetTabId) {
    this.currentTab = targetTabId;

    // Update nav button active states
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === targetTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update section active states
    document.querySelectorAll('.view-section').forEach(sec => {
      if (sec.id === targetTabId) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // Trigger tab specific refreshes
    if (targetTabId === 'tab-dashboard') {
      this.loadDashboard();
    } else if (targetTabId === 'tab-students') {
      Students.loadStudents();
    } else if (targetTabId === 'tab-holidays') {
      Holidays.loadHolidays();
    } else if (targetTabId === 'tab-reports') {
      Reports.updateSubjectDropdown();
      Reports.loadReport();
    } else if (targetTabId === 'tab-attendance') {
      Attendance.loadRoster();
    }
  },

  bindDashboardActions() {
    const btnQuickMark = document.getElementById('btnQuickMarkAttendance');
    if (btnQuickMark) {
      btnQuickMark.addEventListener('click', () => {
        this.switchTab('tab-attendance');
      });
    }

    const btnQuickVac = document.getElementById('btnQuickAddVacation');
    if (btnQuickVac) {
      btnQuickVac.addEventListener('click', () => {
        Holidays.openDeclareModal();
      });
    }
  },

  async loadDashboard() {
    try {
      const stats = await Auth.apiRequest('/api/dashboard/stats');

      // Update KPI numbers
      document.getElementById('kpiTotalStudents').textContent = stats.totalStudents;
      document.getElementById('kpiOverallPct').textContent = `${stats.overallPercentage}%`;
      document.getElementById('kpiPresentCountDesc').textContent = `${stats.totalPresent} Present • ${stats.totalAbsent} Absent`;
      document.getElementById('kpiDefaultersCount').textContent = stats.defaultersCount;
      document.getElementById('kpiTotalHolidays').textContent = stats.totalHolidays;

      // Render recent sessions
      this.renderRecentSessions(stats.recentSessions || []);

      // Render semester distribution
      this.renderSemesterDistribution(stats.semesterDistribution || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  },

  renderRecentSessions(sessions) {
    const tbody = document.getElementById('tbodyRecentSessions');
    if (!tbody) return;

    if (sessions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No attendance records logged yet. Click <strong>Mark New Attendance</strong> to begin.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    sessions.forEach(sess => {
      const isVacation = sess.is_vacation === 1;
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td><strong style="color: #cbd5e1; font-family: monospace;">${sess.date}</strong></td>
        <td><span style="font-weight: 600;">${sess.semester}</span></td>
        <td style="color: var(--text-muted);">${sess.subject}</td>
        <td>
          ${isVacation 
            ? '<span style="color: #f472b6; font-size: 0.8rem; font-weight: 700;">Vacation Escaped</span>' 
            : `<span style="color: var(--color-present); font-weight: 700;">${sess.present_count || 0}</span> / <strong>${sess.student_count || 0}</strong>`}
        </td>
        <td>
          ${isVacation 
            ? '<span class="pct-badge" style="background: rgba(236, 72, 153, 0.2); color: #f472b6;">Holiday</span>' 
            : '<span class="pct-badge good">Logged</span>'}
        </td>
        <td>
          <button type="button" class="btn-batch btn-load-session" data-date="${sess.date}" data-sem="${sess.semester}" data-sub="${sess.subject}">
            View / Edit
          </button>
        </td>
      `;

      tr.querySelector('.btn-load-session').addEventListener('click', () => {
        // Switch to attendance and preload
        document.getElementById('attDatePicker').value = sess.date;
        document.getElementById('attSemesterSelect').value = sess.semester;

        this.switchTab('tab-attendance');
        setTimeout(() => {
          Attendance.loadSubjectsForSelectedSemester().then(() => {
            document.getElementById('attSubjectSelect').value = sess.subject;
            Attendance.loadRoster();
          });
        }, 100);
      });

      tbody.appendChild(tr);
    });
  },

  renderSemesterDistribution(dist) {
    const container = document.getElementById('semesterDistributionList');
    if (!container) return;

    container.innerHTML = '';
    const total = dist.reduce((acc, curr) => acc + curr.count, 0) || 1;

    dist.forEach(item => {
      const pct = Math.round((item.count / total) * 100);
      const row = document.createElement('div');
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
          <span style="font-weight: 600;">${item.semester}</span>
          <span style="color: var(--text-dim);">${item.count} students (${pct}%)</span>
        </div>
        <div class="progress-bar-bg" style="width: 100%; height: 6px;">
          <div class="progress-bar-fill" style="width: ${pct}%; background: var(--accent-gradient);"></div>
        </div>
      `;
      container.appendChild(row);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
