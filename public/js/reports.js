// Attendance Reports, Defaulters Analysis, and CSV Export Module
const Reports = {
  currentReportData: null,
  activeSubTab: 'all', // 'all' or 'defaulters'

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnFilter = document.getElementById('btnFilterReports');
    if (btnFilter) {
      btnFilter.addEventListener('click', () => this.loadReport());
    }

    const semSelect = document.getElementById('reportSemesterSelect');
    if (semSelect) {
      semSelect.addEventListener('change', () => this.updateSubjectDropdown());
    }

    // Sub-tab toggles
    const tabAll = document.getElementById('tabSubReportAll');
    const tabDef = document.getElementById('tabSubReportDefaulters');

    if (tabAll && tabDef) {
      tabAll.addEventListener('click', () => {
        this.activeSubTab = 'all';
        tabAll.style.background = 'var(--accent-gradient)';
        tabAll.style.color = '#fff';
        tabDef.style.background = 'rgba(244, 63, 94, 0.12)';
        tabDef.style.color = '#fb7185';
        this.renderTable();
      });

      tabDef.addEventListener('click', () => {
        this.activeSubTab = 'defaulters';
        tabDef.style.background = 'var(--color-absent)';
        tabDef.style.color = '#fff';
        tabAll.style.background = 'transparent';
        tabAll.style.color = 'var(--text-muted)';
        this.renderTable();
      });
    }

    // Export & Print
    const btnExport = document.getElementById('btnExportCSV');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCSV());
    }

    const btnPrint = document.getElementById('btnPrintReport');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }
  },

  async updateSubjectDropdown() {
    const sem = document.getElementById('reportSemesterSelect').value;
    const subSelect = document.getElementById('reportSubjectSelect');
    if (!subSelect) return;

    if (sem === 'ALL') {
      subSelect.innerHTML = '<option value="ALL">All Subjects</option>';
      return;
    }

    try {
      const subjects = await Auth.apiRequest(`/api/subjects?semester=${encodeURIComponent(sem)}`);
      subSelect.innerHTML = '<option value="ALL">All Subjects</option>';
      subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = `${sub.name} (${sub.code})`;
        opt.textContent = `${sub.code} - ${sub.name}`;
        subSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error fetching subjects for report:', err);
    }
  },

  async loadReport() {
    const semester = document.getElementById('reportSemesterSelect').value;
    const subject = document.getElementById('reportSubjectSelect').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    let url = `/api/attendance/summary?semester=${encodeURIComponent(semester)}&subject=${encodeURIComponent(subject)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;

    try {
      this.currentReportData = await Auth.apiRequest(url);
      this.renderKPIs();
      this.renderTable();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  renderKPIs() {
    if (!this.currentReportData) return;
    const agg = this.currentReportData.aggregates;
    const scope = this.currentReportData.scope;

    document.getElementById('repTotalSessions').textContent = scope.totalWorkingSessions;
    document.getElementById('repTotalPresent').textContent = agg.overallPresent;
    document.getElementById('repTotalAbsent').textContent = agg.overallAbsent;
    document.getElementById('repTotalLeave').textContent = agg.overallLeave;
  },

  renderTable() {
    if (!this.currentReportData) return;
    const tbody = document.getElementById('tbodyAttendanceReport');
    if (!tbody) return;

    let list = this.currentReportData.students || [];

    if (this.activeSubTab === 'defaulters') {
      list = list.filter(s => s.percentage < 75 && s.totalSessions > 0);
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            ${this.activeSubTab === 'defaulters' 
              ? 'Outstanding! No students are currently below the 75% attendance threshold.' 
              : 'No student attendance records found for selected filters.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    list.forEach(s => {
      const pct = s.percentage;
      let badgeClass = 'good';
      let statusLabel = 'Safe (≥ 75%)';
      let progressColor = '#10b981';

      if (pct < 65) {
        badgeClass = 'danger';
        statusLabel = 'Critical Shortage';
        progressColor = '#f43f5e';
      } else if (pct < 75) {
        badgeClass = 'warning';
        statusLabel = 'Warning (< 75%)';
        progressColor = '#f59e0b';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="student-roll-tag">${s.roll_no}</span></td>
        <td>
          <div class="student-name-cell">${s.name}</div>
          <div class="student-meta-sub">${s.email || '-'}</div>
        </td>
        <td><strong>${s.semester}</strong> (${s.section || 'A'})</td>
        <td style="font-weight: 700;">${s.totalSessions}</td>
        <td style="color: var(--color-present); font-weight: 700;">${s.present}</td>
        <td style="color: var(--color-absent); font-weight: 700;">${s.absent}</td>
        <td style="color: var(--color-leave); font-weight: 700;">${s.leave}</td>
        <td>
          <span class="pct-badge ${badgeClass}">${pct}%</span>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(pct, 100)}%; background: ${progressColor};"></div>
          </div>
        </td>
        <td>
          <span style="font-size: 0.8rem; font-weight: 600; color: ${progressColor};">${statusLabel}</span>
        </td>
        <td>
          <button type="button" class="btn-batch btn-view-single-hist" data-id="${s.id}">
            Log
          </button>
        </td>
      `;

      tr.querySelector('.btn-view-single-hist').addEventListener('click', () => {
        Students.showStudentHistory(s.id);
      });

      tbody.appendChild(tr);
    });
  },

  exportCSV() {
    if (!this.currentReportData || !this.currentReportData.students) {
      App.showToast('Please load a report first before exporting.', 'warning');
      return;
    }

    const students = this.currentReportData.students;
    const headers = ['Roll No', 'Name', 'Semester', 'Section', 'Total Classes', 'Present', 'Absent', 'Leave', 'Percentage', 'Status'];

    const rows = students.map(s => {
      const status = s.percentage >= 75 ? 'ELIGIBLE' : 'DEFAULTER (< 75%)';
      return [
        `"${s.roll_no}"`,
        `"${s.name}"`,
        `"${s.semester}"`,
        `"${s.section}"`,
        s.totalSessions,
        s.present,
        s.absent,
        s.leave,
        `${s.percentage}%`,
        `"${status}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);

    const now = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `BCA_Department_Attendance_Report_${now}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    App.showToast('CSV report downloaded successfully!', 'success');
  }
};
