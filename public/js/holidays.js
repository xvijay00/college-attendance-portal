// Vacations & Official Holidays Exemption Module
const Holidays = {
  holidaysList: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnOpenModal = document.getElementById('btnOpenDeclareVacationModal');
    if (btnOpenModal) {
      btnOpenModal.addEventListener('click', () => this.openDeclareModal());
    }

    const btnCloseModal = document.getElementById('btnCloseVacationModal');
    const btnCancelModal = document.getElementById('btnCancelVacationModal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => this.closeModal());
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => this.closeModal());

    const form = document.getElementById('vacationForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  },

  async loadHolidays() {
    try {
      this.holidaysList = await Auth.apiRequest('/api/holidays');
      this.render();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  render() {
    const tbody = document.getElementById('tbodyHolidays');
    if (!tbody) return;

    if (this.holidaysList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No vacations or official holidays recorded yet. Click <strong>Add New Vacation Day</strong> to declare one.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    this.holidaysList.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: #f472b6; font-family: monospace;">${h.date}</strong></td>
        <td>
          <div style="font-weight: 700; color: #fff;">${h.title}</div>
          <span style="font-size: 0.75rem; color: #34d399;">Attendance Escaped</span>
        </td>
        <td style="color: var(--text-muted);">${h.description || 'College declared holiday.'}</td>
        <td style="color: var(--text-dim); font-size: 0.85rem;">${h.created_by || 'Admin'}</td>
        <td>
          <button type="button" class="btn-batch btn-del-holiday" data-id="${h.id}" style="color: #f87171;" title="Remove Vacation Exemption">
            Delete
          </button>
        </td>
      `;

      tr.querySelector('.btn-del-holiday').addEventListener('click', () => this.deleteHoliday(h.id, h.title));
      tbody.appendChild(tr);
    });
  },

  openDeclareModal(presetDate = '') {
    const dateInput = document.getElementById('formVacationDate');
    const titleInput = document.getElementById('formVacationTitle');
    const descInput = document.getElementById('formVacationDesc');

    if (dateInput) {
      if (presetDate) {
        dateInput.value = presetDate;
      } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';

    document.getElementById('modalVacation').classList.add('active');
  },

  closeModal() {
    document.getElementById('modalVacation').classList.remove('active');
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('formVacationDate').value;
    const title = document.getElementById('formVacationTitle').value.trim();
    const description = document.getElementById('formVacationDesc').value.trim();

    try {
      const res = await Auth.apiRequest('/api/holidays', {
        method: 'POST',
        body: JSON.stringify({ date, title, description })
      });

      App.showToast(res.message, 'success');
      this.closeModal();
      this.loadHolidays();
      App.loadDashboard();

      // If we are currently on the attendance page with this date, refresh the check
      const attDate = document.getElementById('attDatePicker').value;
      if (attDate === date) {
        Attendance.checkVacationForDate(date);
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async deleteHoliday(id, title) {
    if (!confirm(`Remove official vacation "${title}"? Attendance marking will no longer be exempted for this date.`)) {
      return;
    }

    try {
      await Auth.apiRequest(`/api/holidays/${id}`, { method: 'DELETE' });
      App.showToast(`Vacation "${title}" removed.`, 'info');
      this.loadHolidays();
      App.loadDashboard();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};
