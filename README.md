# 🎓 BCA Department Student Attendance & Academic Management Web Application

A full-stack web application developed for a **Bachelor of Computer Applications (BCA) Department** to manage student attendance, handle vacation and holiday exemptions, analyze attendance percentages, enforce the 75% university eligibility requirement, and persist all records in a local SQLite database.

---

## 🌟 Key Features

### 1. 🔐 Admin & Faculty Authentication Portal
- **Persistent Database Storage**: Teacher accounts stored securely with `bcryptjs` password hashing and `jsonwebtoken` session tokens.
- **Role-Based Profiles**: Support for HOD / Admin and Assistant Professors / Faculty.
- **Register New Faculty**: Easily add new department lecturers and faculty members.
- **Pre-Seeded Demo Credentials**:
  - **👑 HOD / Admin**: `hod.bca@college.edu` / `Admin@123`
  - **👨‍🏫 Faculty Member**: `teacher@bca.edu` / `Teacher@123`

### 2. 📋 Interactive Attendance Taking Section
- **Dynamic Semester & Subject Selection**:
  - BCA 1st Sem to BCA 6th Sem curricula pre-configured (Programming in C, DBMS, Data Structures, Java, Python, Web Technologies, AI/ML, etc.).
- **Tickbox & Status Switcher Interface**:
  - Fast single-click tickbox in front of each student to toggle **Present** (Green checkmark) vs **Absent** (Red cross).
  - 3-Way Status Switcher pills: **[✓ Present]**, **[✕ Absent]**, and **[◷ Leave]**.
- **Batch Marking Shortcuts**:
  - **Mark All Present**
  - **Mark All Absent**
  - **Invert Attendance Selection**
- **Live Counter Strip**: Real-time counter of selected Present, Absent, Leave, and Total students.
- **Optional Remarks**: Record reasons for leaves (e.g. medical certificates, sports events).
- **Date-Based Database Storage**: Saves attendance per date, class/semester, and subject. If attendance was already logged for that session, it loads past data and allows instant editing.

### 3. 🏖️ Vacation & Official Holiday Exemption
- **Exempt / Escape Student Attendance**:
  - Users can declare any calendar date as a Vacation or Official Holiday (e.g., Diwali break, Tech Fest, Sports Day).
  - **Attendance Exemption**: On declared vacation days, an alert banner appears and the day is officially escaped/exempted from total working lectures so students are not penalized.
  - Vacations management table to view, add, or delete holidays.

### 4. 📈 Total Attendance, Present, Absent, Leave & Defaulters Analytics
- **Per-Student Attendance Calculations**:
  - Formula: `Attendance % = (Present Classes / Total Working Classes) * 100%`
  - Total classes, Present count, Absent count, and Leave count.
- **University 75% Rule Compliance**:
  - Color-coded badges:
    - **Safe** (≥ 75%) — Green
    - **Warning** (65% – 74%) — Amber
    - **Critical Shortage** (< 65%) — Rose / Red
  - **⚠️ Defaulters List Tab**: 1-click filter listing all students failing the 75% attendance threshold.
- **Export & Print**:
  - **📥 Export to CSV**: 1-click download of the complete department attendance spreadsheet.
  - **🖨️ Print Report**: Printer-friendly format for academic records.

### 5. 👥 Student Directory & Profiles
- Add, Edit, and Delete student records with Roll Number, Name, Semester, Section, Email, Phone, and Gender.
- Instant search filter by student name, roll number, or email.
- **Student Attendance Timeline Modal**: Click on any student to view their complete historical attendance log and breakdown.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, Modern CSS3 (Glassmorphism, CSS Custom Properties, Responsive Grid & Flexbox), Vanilla JavaScript (ES6+ Modules).
- **Backend**: Node.js, Express.js.
- **Database**: SQLite3 (`bca_attendance.db`) with automatic table creation and realistic sample data seeding.
- **Security**: JWT (`jsonwebtoken`) and `bcryptjs` password hashing.

---

## 🚀 Running the Application Locally

1. Open your terminal in the project directory:
   ```bash
   cd "/Users/vijaykumar/Desktop/college attendece"
   ```

2. Start the application:
   ```bash
   node server.js
   ```
   *(Or `npm start`)*

3. Open your browser and visit:
   ```
   http://localhost:3000
   ```

4. Click the quick demo button **👑 HOD / Admin** on the login screen and click **Secure Login →** to enter the portal.
