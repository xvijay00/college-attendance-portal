// Student Directory & Profile Management
const Students = {
  studentsList: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterAndRender());
    }

    const semFilter = document.getElementById('studentSemesterFilter');
    if (semFilter) {
      semFilter.addEventListener('change', () => this.loadStudents());
    }

    // Modal Triggers
    const btnOpenAdd = document.getElementById('btnOpenAddStudentModal');
    if (btnOpenAdd) {
      btnOpenAdd.addEventListener('click', () => this.openAddModal());
    }

    const btnCloseModal = document.getElementById('btnCloseStudentModal');
    const btnCancelModal = document.getElementById('btnCancelStudentModal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => this.closeModal());
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => this.closeModal());

    // Student Form Submit
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
      studentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // History Modal Close
    const btnCloseHist = document.getElementById('btnCloseHistoryModal');
    const btnCloseHistBtn = document.getElementById('btnCloseHistoryBtn');
    if (btnCloseHist) btnCloseHist.addEventListener('click', () => this.closeHistoryModal());
    if (btnCloseHistBtn) btnCloseHistBtn.addEventListener('click', () => this.closeHistoryModal());
  },

  async loadStudents() {
    const sem = document.getElementById('studentSemesterFilter').value;
    try {
      const url = `/api/students?semester=${encodeURIComponent(sem)}`;
      this.studentsList = await Auth.apiRequest(url);
      this.filterAndRender();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  filterAndRender() {
    const query = (document.getElementById('studentSearchInput').value || '').toLowerCase().trim();
    const filtered = this.studentsList.filter(s => {
      const matchQuery =
        s.name.toLowerCase().includes(query) ||
        s.roll_no.toLowerCase().includes(query) ||
        (s.email && s.email.toLowerCase().includes(query));
      return matchQuery;
    });

    const countEl = document.getElementById('studentListCount');
    if (countEl) countEl.textContent = filtered.length;

    const tbody = document.getElementById('tbodyStudents');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No students found matching current filters. Click <strong>+ Add New Student</strong> to enroll.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="student-roll-tag">${s.roll_no}</span></td>
        <td>
          <div class="student-name-cell">${s.name}</div>
          <div class="student-meta-sub">${s.gender || 'Student'}</div>
        </td>
        <td><strong style="color: #cbd5e1;">${s.semester}</strong></td>
        <td>${s.section || 'A'}</td>
        <td style="color: var(--text-muted);">${s.email || '-'}</td>
        <td style="color: var(--text-muted); font-family: monospace;">${s.phone || '-'}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button type="button" class="btn-batch btn-hist" data-id="${s.id}" title="View Attendance History">
              History
            </button>
            <button type="button" class="btn-batch btn-edit" data-id="${s.id}" title="Edit Student">
              Edit
            </button>
            <button type="button" class="btn-batch btn-del" data-id="${s.id}" style="color: #f87171;" title="Delete Student">
              Delete
            </button>
          </div>
        </td>
      `;

      // Event handlers
      tr.querySelector('.btn-hist').addEventListener('click', () => this.showStudentHistory(s.id));
      tr.querySelector('.btn-edit').addEventListener('click', () => this.openEditModal(s));
      tr.querySelector('.btn-del').addEventListener('click', () => this.deleteStudent(s.id, s.name));

      tbody.appendChild(tr);
    });
  },

  openAddModal() {
    document.getElementById('modalStudentTitle').textContent = 'Add New BCA Student';
    document.getElementById('studentFormId').value = '';
    document.getElementById('formRollNo').value = '';
    document.getElementById('formName').value = '';
    document.getElementById('formSection').value = 'A';
    document.getElementById('formEmail').value = '';
    document.getElementById('formPhone').value = '';
    document.getElementById('modalStudent').classList.add('active');
  },

  openEditModal(student) {
    document.getElementById('modalStudentTitle').textContent = `Edit Student: ${student.name}`;
    document.getElementById('studentFormId').value = student.id;
    document.getElementById('formRollNo').value = student.roll_no;
    document.getElementById('formName').value = student.name;
    document.getElementById('formSemester').value = student.semester;
    document.getElementById('formSection').value = student.section || 'A';
    document.getElementById('formEmail').value = student.email || '';
    document.getElementById('formPhone').value = student.phone || '';
    document.getElementById('formGender').value = student.gender || 'Male';
    document.getElementById('modalStudent').classList.add('active');
  },

  closeModal() {
    document.getElementById('modalStudent').classList.remove('active');
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('studentFormId').value;
    const roll_no = document.getElementById('formRollNo').value.trim();
    const name = document.getElementById('formName').value.trim();
    const semester = document.getElementById('formSemester').value;
    const section = document.getElementById('formSection').value;
    const email = document.getElementById('formEmail').value.trim();
    const phone = document.getElementById('formPhone').value.trim();
    const gender = document.getElementById('formGender').value;

    try {
      if (id) {
        // Edit student
        await Auth.apiRequest(`/api/students/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ roll_no, name, semester, section, email, phone, gender })
        });
        App.showToast(`Student ${name} updated successfully!`, 'success');
      } else {
        // Add student
        await Auth.apiRequest('/api/students', {
          method: 'POST',
          body: JSON.stringify({ roll_no, name, semester, section, email, phone, gender })
        });
        App.showToast(`Student ${name} added to ${semester}!`, 'success');
      }

      this.closeModal();
      this.loadStudents();
      App.loadDashboard();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async deleteStudent(id, name) {
    if (!confirm(`Are you sure you want to delete student "${name}"? This will permanently remove their attendance records.`)) {
      return;
    }

    try {
      await Auth.apiRequest(`/api/students/${id}`, { method: 'DELETE' });
      App.showToast(`Student "${name}" deleted.`, 'info');
      this.loadStudents();
      App.loadDashboard();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async showStudentHistory(studentId) {
    try {
      const data = await Auth.apiRequest(`/api/students/${studentId}/attendance`);
      const student = data.student;
      const sum = data.summary;

      document.getElementById('historyStudentName').textContent = student.name;
      document.getElementById('historyStudentRoll').textContent = `${student.roll_no} • ${student.semester} (${student.section || 'A'})`;

      const pctEl = document.getElementById('histPct');
      pctEl.textContent = `${sum.percentage}%`;
      pctEl.style.color = parseFloat(sum.percentage) >= 75 ? '#34d399' : (parseFloat(sum.percentage) >= 65 ? '#fbbf24' : '#f87171');

      document.getElementById('histPresent').textContent = sum.presentCount;
      document.getElementById('histAbsent').textContent = sum.absentCount;
      document.getElementById('histLeave').textContent = sum.leaveCount;

      const tbody = document.getElementById('tbodyStudentHistory');
      if (data.records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
              No past attendance records found for this student.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = '';
        data.records.forEach(r => {
          let badgeClass = 'good';
          let statusText = 'Present';
          if (r.status === 'ABSENT') {
            badgeClass = 'danger';
            statusText = 'Absent';
          } else if (r.status === 'LEAVE') {
            badgeClass = 'warning';
            statusText = 'Leave';
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${r.date}</strong></td>
            <td>${r.subject}</td>
            <td style="color: var(--text-dim);">${r.teacher_name || 'Faculty'}</td>
            <td><span class="pct-badge ${badgeClass}">${statusText}</span></td>
            <td style="color: var(--text-dim); font-size: 0.8rem;">${r.remarks || '-'}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      document.getElementById('modalStudentHistory').classList.add('active');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  closeHistoryModal() {
    document.getElementById('modalStudentHistory').classList.remove('active');
  }
};
