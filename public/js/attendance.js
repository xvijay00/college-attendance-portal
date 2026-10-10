// Attendance Taking & Management Module
const Attendance = {
  currentRoster: [],
  isVacationActive: false,

  init() {
    this.bindEvents();
    this.setTodayDate();
    this.loadSubjectsForSelectedSemester();
  },

  setTodayDate() {
    const dateInput = document.getElementById('attDatePicker');
    if (dateInput) {
      // Default to current date YYYY-MM-DD
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
  },

  bindEvents() {
    const semSelect = document.getElementById('attSemesterSelect');
    if (semSelect) {
      semSelect.addEventListener('change', () => {
        this.loadSubjectsForSelectedSemester();
      });
    }

    const btnToday = document.getElementById('btnAttToday');
    if (btnToday) {
      btnToday.addEventListener('click', () => {
        this.setTodayDate();
        this.loadRoster();
      });
    }

    const btnLoad = document.getElementById('btnLoadRoster');
    if (btnLoad) {
      btnLoad.addEventListener('click', () => {
        this.loadRoster();
      });
    }

    const datePicker = document.getElementById('attDatePicker');
    if (datePicker) {
      datePicker.addEventListener('change', () => {
        this.checkVacationForDate(datePicker.value);
      });
    }

    // Quick Batch Actions
    const btnAllPresent = document.getElementById('btnMarkAllPresent');
    if (btnAllPresent) {
      btnAllPresent.addEventListener('click', () => this.markAllStatus('PRESENT'));
    }

    const btnAllAbsent = document.getElementById('btnMarkAllAbsent');
    if (btnAllAbsent) {
      btnAllAbsent.addEventListener('click', () => this.markAllStatus('ABSENT'));
    }

    const btnInvert = document.getElementById('btnInvertAttendance');
    if (btnInvert) {
      btnInvert.addEventListener('click', () => this.invertStatuses());
    }

    // Save Attendance
    const btnSave = document.getElementById('btnSaveAttendance');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveAttendance());
    }

    // Declare Vacation from Attendance tab
    const btnVacation = document.getElementById('btnMarkVacationFromAttendance');
    if (btnVacation) {
      btnVacation.addEventListener('click', () => {
        const currentDate = document.getElementById('attDatePicker').value;
        Holidays.openDeclareModal(currentDate);
      });
    }

    const btnProceedAnyway = document.getElementById('btnProceedAnyway');
    if (btnProceedAnyway) {
      btnProceedAnyway.addEventListener('click', () => {
        const banner = document.getElementById('vacationBanner');
        if (banner) banner.classList.remove('show');
        App.showToast('Vacation warning dismissed for this session.', 'info');
      });
    }
  },

  async loadSubjectsForSelectedSemester() {
    const semSelect = document.getElementById('attSemesterSelect');
    const subSelect = document.getElementById('attSubjectSelect');
    if (!semSelect || !subSelect) return;

    const semester = semSelect.value;
    try {
      const subjects = await Auth.apiRequest(`/api/subjects?semester=${encodeURIComponent(semester)}`);
      subSelect.innerHTML = '';
      if (subjects.length === 0) {
        subSelect.innerHTML = '<option value="General Lecture">General Lecture</option>';
      } else {
        subjects.forEach(sub => {
          const opt = document.createElement('option');
          opt.value = `${sub.name} (${sub.code})`;
          opt.textContent = `${sub.code} - ${sub.name}`;
          subSelect.appendChild(opt);
        });
      }

      // Automatically load the roster for this semester/subject
      this.loadRoster();
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  },

  async checkVacationForDate(date) {
    if (!date) return;
    try {
      const data = await Auth.apiRequest(`/api/holidays/check/${date}`);
      const banner = document.getElementById('vacationBanner');
      const titleEl = document.getElementById('vacationBannerTitle');
      const descEl = document.getElementById('vacationBannerDesc');

      if (data.isVacation && data.holiday) {
        this.isVacationActive = true;
        if (titleEl) titleEl.textContent = `Official Vacation: ${data.holiday.title}`;
        if (descEl) descEl.textContent = data.holiday.description || 'Attendance for students is officially escaped and exempted on this day.';
        if (banner) banner.classList.add('show');
      } else {
        this.isVacationActive = false;
        if (banner) banner.classList.remove('show');
      }
    } catch (err) {
      console.error('Error checking vacation:', err);
    }
  },

  async loadRoster() {
    const semester = document.getElementById('attSemesterSelect').value;
    const subject = document.getElementById('attSubjectSelect').value;
    const date = document.getElementById('attDatePicker').value;

    if (!semester || !subject || !date) {
      App.showToast('Please select Semester, Subject, and Date', 'warning');
      return;
    }

    try {
      const data = await Auth.apiRequest(
        `/api/attendance/session?date=${encodeURIComponent(date)}&semester=${encodeURIComponent(semester)}&subject=${encodeURIComponent(subject)}`
      );

      this.currentRoster = data.students || [];

      // Update Vacation Alert Banner
      const banner = document.getElementById('vacationBanner');
      const titleEl = document.getElementById('vacationBannerTitle');
      const descEl = document.getElementById('vacationBannerDesc');

      if (data.isVacation) {
        this.isVacationActive = true;
        if (titleEl) titleEl.textContent = `Official Vacation: ${data.vacationReason || 'College Holiday'}`;
        if (descEl) descEl.textContent = 'Attendance is exempted for this date in the academic calendar.';
        if (banner) banner.classList.add('show');
      } else {
        this.isVacationActive = false;
        if (banner) banner.classList.remove('show');
      }

      // Update Saved Status Badge
      const statusBadge = document.getElementById('savedStatusBadge');
      if (statusBadge) {
        if (data.isAlreadySaved) {
          statusBadge.innerHTML = `<strong>Attendance Already Recorded</strong> on ${date} by ${data.teacherName || 'Faculty'}. You can modify and re-save.`;
          statusBadge.style.color = '#34d399';
        } else {
          statusBadge.innerHTML = `<strong>New Session:</strong> Ready to mark attendance for ${this.currentRoster.length} students.`;
          statusBadge.style.color = 'var(--text-muted)';
        }
      }

      this.renderRoster();
      this.updateCounters();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  renderRoster() {
    const tbody = document.getElementById('tbodyAttendanceRoster');
    if (!tbody) return;

    if (this.currentRoster.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No students found enrolled in this semester. You can add students via the <strong>Students</strong> tab.
          </td>
        </tr>
      `;
      this.updateCounters();
      return;
    }

    tbody.innerHTML = '';
    this.currentRoster.forEach((student, index) => {
      const isPresent = student.status === 'PRESENT';
      const isAbsent = student.status === 'ABSENT';
      const isLeave = student.status === 'LEAVE';

      const tr = document.createElement('tr');
      tr.id = `roster-row-${student.student_id}`;

      tr.innerHTML = `
        <td style="text-align: center;">
          <div class="quick-tick-box ${isPresent ? 'checked' : ''}" 
               id="tick-${student.student_id}" 
               data-id="${student.student_id}" 
               title="Click to toggle Present / Absent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </td>
        <td>
          <span class="student-roll-tag">${student.roll_no}</span>
        </td>
        <td>
          <div class="student-name-cell">${student.name}</div>
          <div class="student-meta-sub">${student.email || 'No email provided'}</div>
        </td>
        <td>
          <span style="font-weight: 700; color: var(--text-dim);">${student.section || 'A'}</span>
        </td>
        <td>
          <div class="status-switch-group">
            <label class="status-radio-label ${isPresent ? 'is-present-active' : ''}" id="lbl-present-${student.student_id}">
              <input type="radio" name="status-${student.student_id}" value="PRESENT" ${isPresent ? 'checked' : ''} data-id="${student.student_id}">
              Present
            </label>
            <label class="status-radio-label ${isAbsent ? 'is-absent-active' : ''}" id="lbl-absent-${student.student_id}">
              <input type="radio" name="status-${student.student_id}" value="ABSENT" ${isAbsent ? 'checked' : ''} data-id="${student.student_id}">
              Absent
            </label>
            <label class="status-radio-label ${isLeave ? 'is-leave-active' : ''}" id="lbl-leave-${student.student_id}">
              <input type="radio" name="status-${student.student_id}" value="LEAVE" ${isLeave ? 'checked' : ''} data-id="${student.student_id}">
              Leave
            </label>
          </div>
        </td>
        <td>
          <input type="text" class="form-input" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; width: 100%;" 
                 id="remark-${student.student_id}" 
                 placeholder="e.g. Medical leave, Late entry..." 
                 value="${student.remarks || ''}" 
                 data-id="${student.student_id}">
        </td>
      `;

      tbody.appendChild(tr);

      // Event listener for Tickbox
      const tickBox = tr.querySelector(`#tick-${student.student_id}`);
      tickBox.addEventListener('click', () => {
        const nextStatus = student.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
        this.setStudentStatus(student.student_id, nextStatus);
      });

      // Event listener for Radio Pills
      const radios = tr.querySelectorAll(`input[name="status-${student.student_id}"]`);
      radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.setStudentStatus(student.student_id, e.target.value);
        });
      });

      // Remarks input change
      const remarkInput = tr.querySelector(`#remark-${student.student_id}`);
      remarkInput.addEventListener('input', (e) => {
        student.remarks = e.target.value;
      });
    });
  },

  setStudentStatus(studentId, newStatus) {
    const student = this.currentRoster.find(s => s.student_id === studentId);
    if (!student) return;

    student.status = newStatus;

    // Update tickbox
    const tickBox = document.getElementById(`tick-${studentId}`);
    if (tickBox) {
      if (newStatus === 'PRESENT') {
        tickBox.classList.add('checked');
      } else {
        tickBox.classList.remove('checked');
      }
    }

    // Update radio labels
    const lblPresent = document.getElementById(`lbl-present-${studentId}`);
    const lblAbsent = document.getElementById(`lbl-absent-${studentId}`);
    const lblLeave = document.getElementById(`lbl-leave-${studentId}`);

    if (lblPresent) lblPresent.className = `status-radio-label ${newStatus === 'PRESENT' ? 'is-present-active' : ''}`;
    if (lblAbsent) lblAbsent.className = `status-radio-label ${newStatus === 'ABSENT' ? 'is-absent-active' : ''}`;
    if (lblLeave) lblLeave.className = `status-radio-label ${newStatus === 'LEAVE' ? 'is-leave-active' : ''}`;

    // Update radio input checked
    const radio = document.querySelector(`input[name="status-${studentId}"][value="${newStatus}"]`);
    if (radio) radio.checked = true;

    this.updateCounters();
  },

  markAllStatus(status) {
    this.currentRoster.forEach(student => {
      this.setStudentStatus(student.student_id, status);
    });
    App.showToast(`All students marked as ${status}!`, 'info');
  },

  invertStatuses() {
    this.currentRoster.forEach(student => {
      const nextStatus = student.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
      this.setStudentStatus(student.student_id, nextStatus);
    });
    App.showToast('Attendance selections inverted.', 'info');
  },

  updateCounters() {
    const present = this.currentRoster.filter(s => s.status === 'PRESENT').length;
    const absent = this.currentRoster.filter(s => s.status === 'ABSENT').length;
    const leave = this.currentRoster.filter(s => s.status === 'LEAVE').length;
    const total = this.currentRoster.length;

    const elP = document.getElementById('counterPresent');
    const elA = document.getElementById('counterAbsent');
    const elL = document.getElementById('counterLeave');
    const elT = document.getElementById('counterTotal');

    if (elP) elP.textContent = present;
    if (elA) elA.textContent = absent;
    if (elL) elL.textContent = leave;
    if (elT) elT.textContent = total;
  },

  async saveAttendance() {
    if (this.currentRoster.length === 0) {
      App.showToast('No students loaded to record attendance.', 'warning');
      return;
    }

    const semester = document.getElementById('attSemesterSelect').value;
    const subject = document.getElementById('attSubjectSelect').value;
    const date = document.getElementById('attDatePicker').value;

    const records = this.currentRoster.map(s => ({
      student_id: s.student_id,
      status: s.status,
      remarks: s.remarks || ''
    }));

    try {
      const payload = {
        date,
        semester,
        subject,
        is_vacation: this.isVacationActive ? 1 : 0,
        vacation_reason: this.isVacationActive ? 'Vacation Exemption' : null,
        records
      };

      const res = await Auth.apiRequest('/api/attendance/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      App.showToast(
        `Attendance saved into Database! (Present: ${res.summary.present}, Absent: ${res.summary.absent}, Leave: ${res.summary.leave})`,
        'success'
      );

      const statusBadge = document.getElementById('savedStatusBadge');
      if (statusBadge) {
        statusBadge.innerHTML = `<strong>Recorded in Database!</strong> Date: ${date} | Present: ${res.summary.present} | Absent: ${res.summary.absent}`;
        statusBadge.style.color = '#34d399';
      }

      // Refresh dashboard stats
      App.loadDashboard();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};
