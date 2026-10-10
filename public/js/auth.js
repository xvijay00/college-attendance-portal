// Authentication and Session Management
const Auth = {
  TOKEN_KEY: 'bca_attendance_token',
  USER_KEY: 'bca_attendance_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    const raw = localStorage.getItem(this.USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async apiRequest(url, options = {}) {
    const defaultHeaders = this.getAuthHeaders();
    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    const response = await fetch(url, config);
    if (response.status === 401 || response.status === 403) {
      this.clearSession();
      this.showLoginOverlay();
      throw new Error('Session expired or unauthorized. Please log in.');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  },

  showLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'flex';
  },

  hideLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  updateNavbarUser() {
    const user = this.getUser();
    if (user) {
      const nameEl = document.getElementById('navUserName');
      const roleEl = document.getElementById('navUserRole');
      const avatarEl = document.getElementById('navUserAvatar');
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = `${user.designation || 'Faculty'} (${user.role === 'admin' ? 'Admin' : 'Teacher'})`;
      if (avatarEl) avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'T';
    }
  },

  init() {
    // Check if logged in
    if (!this.isAuthenticated()) {
      this.showLoginOverlay();
    } else {
      this.hideLoginOverlay();
      this.updateNavbarUser();
    }

    // Auth tab toggles
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabRegister = document.getElementById('tabAuthRegister');
    const formLogin = document.getElementById('loginForm');
    const formRegister = document.getElementById('registerForm');

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.style.background = 'var(--accent-gradient)';
        tabLogin.style.color = '#fff';
        tabRegister.style.background = 'transparent';
        tabRegister.style.color = 'var(--text-muted)';
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.style.background = 'var(--accent-gradient)';
        tabRegister.style.color = '#fff';
        tabLogin.style.background = 'transparent';
        tabLogin.style.color = 'var(--text-muted)';
        formRegister.style.display = 'block';
        formLogin.style.display = 'none';
      });
    }

    // Demo Fill Buttons
    const btnFillAdmin = document.getElementById('btnFillAdmin');
    const btnFillFaculty = document.getElementById('btnFillFaculty');
    const inputEmail = document.getElementById('loginEmail');
    const inputPass = document.getElementById('loginPassword');

    if (btnFillAdmin) {
      btnFillAdmin.addEventListener('click', () => {
        if (inputEmail) inputEmail.value = 'hod.bca@college.edu';
        if (inputPass) inputPass.value = 'Admin@123';
        if (tabLogin) tabLogin.click();
      });
    }

    if (btnFillFaculty) {
      btnFillFaculty.addEventListener('click', () => {
        if (inputEmail) inputEmail.value = 'teacher@bca.edu';
        if (inputPass) inputPass.value = 'Teacher@123';
        if (tabLogin) tabLogin.click();
      });
    }

    // Submit Login
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Login failed');

          this.setSession(data.token, data.user);
          this.hideLoginOverlay();
          this.updateNavbarUser();
          App.showToast(`Welcome back, ${data.user.name}!`, 'success');
          App.loadDashboard();
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // Submit Register
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const employee_id = document.getElementById('regEmpId').value;
        const designation = document.getElementById('regDesignation').value;
        const password = document.getElementById('regPassword').value;

        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, employee_id, designation, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Registration failed');

          App.showToast('Registration successful! Please login with your credentials.', 'success');
          if (tabLogin) tabLogin.click();
          if (inputEmail) inputEmail.value = email;
          if (inputPass) inputPass.value = password;
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out of the BCA Portal?')) {
          this.clearSession();
          this.showLoginOverlay();
          App.showToast('You have been logged out securely.', 'info');
        }
      });
    }
  }
};
