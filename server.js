require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, runAsync, allAsync, getAsync, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bca-department-super-secret-key-2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    req.user = user;
    next();
  });
}

// ======================== AUTH ROUTES ========================

// Teacher / Admin Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const teacher = await getAsync('SELECT * FROM teachers WHERE email = ?', [email.trim().toLowerCase()]);
    if (!teacher) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = bcrypt.compareSync(password, teacher.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        designation: teacher.designation,
        employee_id: teacher.employee_id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        designation: teacher.designation,
        employee_id: teacher.employee_id,
        department: teacher.department
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Register New Teacher / Faculty
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, employee_id, designation, department, role } = req.body;
    if (!name || !email || !password || !employee_id) {
      return res.status(400).json({ error: 'Name, email, password, and employee ID are required' });
    }

    const existing = await getAsync('SELECT id FROM teachers WHERE email = ? OR employee_id = ?', [
      email.trim().toLowerCase(),
      employee_id.trim()
    ]);
    if (existing) {
      return res.status(400).json({ error: 'Teacher with this email or employee ID already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await runAsync(
      `INSERT INTO teachers (name, email, password_hash, employee_id, designation, department, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        hash,
        employee_id.trim(),
        designation || 'Assistant Professor',
        department || 'BCA',
        role || 'teacher'
      ]
    );

    res.status(201).json({
      message: 'Teacher registered successfully. You can now log in.',
      teacherId: result.lastID
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register teacher' });
  }
});

// Current user details
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const teacher = await getAsync(
      'SELECT id, name, email, employee_id, designation, department, role, created_at FROM teachers WHERE id = ?',
      [req.user.id]
    );
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json({ user: teacher });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ======================== DASHBOARD & STATS ========================

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const totalStudents = (await getAsync('SELECT COUNT(*) as count FROM students')).count;
    const totalTeachers = (await getAsync('SELECT COUNT(*) as count FROM teachers')).count;
    const totalSessions = (await getAsync('SELECT COUNT(*) as count FROM attendance_sessions WHERE is_vacation = 0')).count;
    const totalHolidays = (await getAsync('SELECT COUNT(*) as count FROM holidays')).count;

    // Overall aggregate attendance rate
    const recordTotals = await getAsync(`
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as total_present,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as total_absent,
        SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) as total_leave
      FROM attendance_records ar
      JOIN attendance_sessions asess ON ar.session_id = asess.id
      WHERE asess.is_vacation = 0
    `);

    const totalRecords = recordTotals.total_records || 0;
    const totalPresent = recordTotals.total_present || 0;
    const totalAbsent = recordTotals.total_absent || 0;
    const totalLeave = recordTotals.total_leave || 0;
    const overallPercentage = totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : '100.0';

    // Count defaulters (<75%)
    const studentStats = await allAsync(`
      SELECT 
        s.id,
        COUNT(ar.id) as sessions_attended,
        SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count
      FROM students s
      LEFT JOIN attendance_records ar ON s.id = ar.student_id
      LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id AND asess.is_vacation = 0
      GROUP BY s.id
    `);

    let defaultersCount = 0;
    studentStats.forEach(st => {
      if (st.sessions_attended > 0) {
        const pct = (st.present_count / st.sessions_attended) * 100;
        if (pct < 75) defaultersCount++;
      }
    });

    // Recent 5 attendance sessions
    const recentSessions = await allAsync(`
      SELECT 
        asess.id,
        asess.date,
        asess.semester,
        asess.subject,
        asess.teacher_name,
        asess.is_vacation,
        asess.vacation_reason,
        COUNT(ar.id) as student_count,
        SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ar.status = 'LEAVE' THEN 1 ELSE 0 END) as leave_count
      FROM attendance_sessions asess
      LEFT JOIN attendance_records ar ON asess.id = ar.session_id
      GROUP BY asess.id
      ORDER BY asess.date DESC, asess.id DESC
      LIMIT 6
    `);

    // Semester student breakdown
    const semesterDistribution = await allAsync(`
      SELECT semester, COUNT(*) as count 
      FROM students 
      GROUP BY semester 
      ORDER BY semester ASC
    `);

    res.json({
      totalStudents,
      totalTeachers,
      totalSessions,
      totalHolidays,
      totalPresent,
      totalAbsent,
      totalLeave,
      overallPercentage,
      defaultersCount,
      recentSessions,
      semesterDistribution
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// ======================== CURRICULUM & SUBJECTS ========================

app.get('/api/semesters', authenticateToken, async (req, res) => {
  try {
    const semesters = [
      'BCA 1st Sem',
      'BCA 2nd Sem',
      'BCA 3rd Sem',
      'BCA 4th Sem',
      'BCA 5th Sem',
      'BCA 6th Sem'
    ];
    res.json(semesters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch semesters' });
  }
});

app.get('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const { semester } = req.query;
    let sql = 'SELECT * FROM subjects';
    const params = [];
    if (semester) {
      sql += ' WHERE semester = ?';
      params.push(semester);
    }
    sql += ' ORDER BY code ASC';
    const subjects = await allAsync(sql, params);
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// ======================== STUDENT MANAGEMENT ========================

app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    const { semester, query } = req.query;
    let sql = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (semester && semester !== 'ALL') {
      sql += ' AND semester = ?';
      params.push(semester);
    }

    if (query && query.trim() !== '') {
      sql += ' AND (name LIKE ? OR roll_no LIKE ? OR email LIKE ?)';
      const q = `%${query.trim()}%`;
      params.push(q, q, q);
    }

    sql += ' ORDER BY semester ASC, roll_no ASC';
    const students = await allAsync(sql, params);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.post('/api/students', authenticateToken, async (req, res) => {
  try {
    const { roll_no, name, semester, section, email, phone, gender } = req.body;
    if (!roll_no || !name || !semester) {
      return res.status(400).json({ error: 'Roll number, Name, and Semester are required' });
    }

    const existing = await getAsync('SELECT id FROM students WHERE roll_no = ?', [roll_no.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'A student with this Roll Number already exists' });
    }

    const result = await runAsync(
      `INSERT INTO students (roll_no, name, semester, section, email, phone, gender)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        roll_no.trim().toUpperCase(),
        name.trim(),
        semester,
        section || 'A',
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        gender || 'Other'
      ]
    );

    res.status(201).json({
      message: 'Student added successfully',
      studentId: result.lastID
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ error: 'Failed to add student' });
  }
});

app.put('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { roll_no, name, semester, section, email, phone, gender } = req.body;

    const existing = await getAsync('SELECT id FROM students WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check duplicate roll number for other students
    const duplicate = await getAsync('SELECT id FROM students WHERE roll_no = ? AND id != ?', [roll_no.trim(), id]);
    if (duplicate) {
      return res.status(400).json({ error: 'Another student already has this Roll Number' });
    }

    await runAsync(
      `UPDATE students 
       SET roll_no = ?, name = ?, semester = ?, section = ?, email = ?, phone = ?, gender = ?
       WHERE id = ?`,
      [
        roll_no.trim().toUpperCase(),
        name.trim(),
        semester,
        section || 'A',
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        gender || 'Other',
        id
      ]
    );

    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student' });
  }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await runAsync('DELETE FROM students WHERE id = ?', [id]);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Single Student Attendance History
app.get('/api/students/:id/attendance', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const student = await getAsync('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const records = await allAsync(
      `SELECT 
        ar.id as record_id,
        ar.status,
        ar.remarks,
        asess.date,
        asess.subject,
        asess.teacher_name
       FROM attendance_records ar
       JOIN attendance_sessions asess ON ar.session_id = asess.id
       WHERE ar.student_id = ? AND asess.is_vacation = 0
       ORDER BY asess.date DESC`,
      [id]
    );

    const totalSessions = records.length;
    const presentCount = records.filter(r => r.status === 'PRESENT').length;
    const absentCount = records.filter(r => r.status === 'ABSENT').length;
    const leaveCount = records.filter(r => r.status === 'LEAVE').length;
    const percentage = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(1) : '100.0';

    res.json({
      student,
      summary: {
        totalSessions,
        presentCount,
        absentCount,
        leaveCount,
        percentage
      },
      records
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student attendance history' });
  }
});

// ======================== VACATIONS & HOLIDAYS ========================

app.get('/api/holidays', authenticateToken, async (req, res) => {
  try {
    const holidays = await allAsync('SELECT * FROM holidays ORDER BY date ASC');
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

app.post('/api/holidays', authenticateToken, async (req, res) => {
  try {
    const { date, title, description } = req.body;
    if (!date || !title) {
      return res.status(400).json({ error: 'Date and Title are required' });
    }

    const existing = await getAsync('SELECT id FROM holidays WHERE date = ?', [date]);
    if (existing) {
      await runAsync(
        'UPDATE holidays SET title = ?, description = ?, created_by = ? WHERE date = ?',
        [title.trim(), description || '', req.user.name, date]
      );
      return res.json({ message: 'Vacation date updated successfully' });
    }

    const result = await runAsync(
      'INSERT INTO holidays (date, title, description, created_by) VALUES (?, ?, ?, ?)',
      [date, title.trim(), description || '', req.user.name]
    );

    // Also mark any existing session on that date as vacation
    await runAsync(
      'UPDATE attendance_sessions SET is_vacation = 1, vacation_reason = ? WHERE date = ?',
      [title.trim(), date]
    );

    res.status(201).json({
      message: 'Vacation declared successfully! Attendance for this day is officially exempted.',
      holidayId: result.lastID
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to declare vacation' });
  }
});

app.delete('/api/holidays/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const holiday = await getAsync('SELECT date FROM holidays WHERE id = ?', [id]);
    if (holiday) {
      await runAsync('UPDATE attendance_sessions SET is_vacation = 0 WHERE date = ?', [holiday.date]);
      await runAsync('DELETE FROM holidays WHERE id = ?', [id]);
    }
    res.json({ message: 'Vacation removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vacation' });
  }
});

app.get('/api/holidays/check/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const holiday = await getAsync('SELECT * FROM holidays WHERE date = ?', [date]);
    res.json({ isVacation: !!holiday, holiday: holiday || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check vacation' });
  }
});

// ======================== ATTENDANCE TAKING & SESSIONS ========================

// Get attendance roster for taking attendance
app.get('/api/attendance/session', authenticateToken, async (req, res) => {
  try {
    const { date, semester, subject } = req.query;
    if (!date || !semester || !subject) {
      return res.status(400).json({ error: 'Date, Semester, and Subject are required' });
    }

    // Check if this date is a vacation/holiday
    const holiday = await getAsync('SELECT * FROM holidays WHERE date = ?', [date]);

    // Check if a session already exists for this date, semester, subject
    let session = await getAsync(
      'SELECT * FROM attendance_sessions WHERE date = ? AND semester = ? AND subject = ?',
      [date, semester, subject]
    );

    // Get all students enrolled in this semester
    const students = await allAsync(
      'SELECT id, roll_no, name, semester, section, email FROM students WHERE semester = ? ORDER BY roll_no ASC',
      [semester]
    );

    let records = [];
    if (session) {
      records = await allAsync(
        'SELECT student_id, status, remarks FROM attendance_records WHERE session_id = ?',
        [session.id]
      );
    }

    // Map student list with either existing status or default PRESENT
    const recordMap = new Map();
    records.forEach(r => recordMap.set(r.student_id, { status: r.status, remarks: r.remarks }));

    const roster = students.map(st => {
      const existingRecord = recordMap.get(st.id);
      return {
        student_id: st.id,
        roll_no: st.roll_no,
        name: st.name,
        section: st.section,
        email: st.email,
        status: existingRecord ? existingRecord.status : 'PRESENT', // default to PRESENT
        remarks: existingRecord ? existingRecord.remarks || '' : ''
      };
    });

    res.json({
      date,
      semester,
      subject,
      isVacation: !!holiday || (session && session.is_vacation === 1),
      vacationReason: holiday ? holiday.title : (session ? session.vacation_reason : ''),
      isAlreadySaved: !!session,
      sessionId: session ? session.id : null,
      teacherName: session ? session.teacher_name : req.user.name,
      students: roster
    });
  } catch (error) {
    console.error('Session roster error:', error);
    res.status(500).json({ error: 'Failed to load attendance session' });
  }
});

// Save or Update Attendance Session
app.post('/api/attendance/save', authenticateToken, async (req, res) => {
  try {
    const { date, semester, subject, is_vacation, vacation_reason, records } = req.body;
    if (!date || !semester || !subject) {
      return res.status(400).json({ error: 'Date, Semester, and Subject are required' });
    }

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Attendance records must be an array' });
    }

    // Begin session save / upsert
    let session = await getAsync(
      'SELECT id FROM attendance_sessions WHERE date = ? AND semester = ? AND subject = ?',
      [date, semester, subject]
    );

    let sessionId;
    if (session) {
      sessionId = session.id;
      await runAsync(
        `UPDATE attendance_sessions 
         SET teacher_name = ?, is_vacation = ?, vacation_reason = ? 
         WHERE id = ?`,
        [req.user.name, is_vacation ? 1 : 0, vacation_reason || null, sessionId]
      );
    } else {
      const result = await runAsync(
        `INSERT INTO attendance_sessions (date, semester, subject, teacher_name, is_vacation, vacation_reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [date, semester, subject, req.user.name, is_vacation ? 1 : 0, vacation_reason || null]
      );
      sessionId = result.lastID;
    }

    // Save/Update records
    // Delete old records for this session to ensure clean sync
    await runAsync('DELETE FROM attendance_records WHERE session_id = ?', [sessionId]);

    for (const item of records) {
      await runAsync(
        `INSERT INTO attendance_records (session_id, student_id, status, remarks)
         VALUES (?, ?, ?, ?)`,
        [sessionId, item.student_id, item.status || 'PRESENT', item.remarks || '']
      );
    }

    // Summary count
    const presentCount = records.filter(r => r.status === 'PRESENT').length;
    const absentCount = records.filter(r => r.status === 'ABSENT').length;
    const leaveCount = records.filter(r => r.status === 'LEAVE').length;

    res.json({
      message: 'Attendance saved successfully into the database!',
      sessionId,
      summary: {
        total: records.length,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount
      }
    });
  } catch (error) {
    console.error('Save attendance error:', error);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

// Delete an attendance session
app.delete('/api/attendance/session/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await runAsync('DELETE FROM attendance_sessions WHERE id = ?', [id]);
    res.json({ message: 'Attendance session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ======================== ATTENDANCE SUMMARY & REPORTS ========================

// Comprehensive report per student with Total, Present, Absent, Leave & %
app.get('/api/attendance/summary', authenticateToken, async (req, res) => {
  try {
    const { semester, startDate, endDate, subject } = req.query;

    let sessionCondition = 'WHERE asess.is_vacation = 0';
    const params = [];

    if (semester && semester !== 'ALL') {
      sessionCondition += ' AND asess.semester = ?';
      params.push(semester);
    }

    if (subject && subject !== 'ALL') {
      sessionCondition += ' AND asess.subject = ?';
      params.push(subject);
    }

    if (startDate) {
      sessionCondition += ' AND asess.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sessionCondition += ' AND asess.date <= ?';
      params.push(endDate);
    }

    // Student filter condition
    let studentCondition = 'WHERE 1=1';
    const studentParams = [];
    if (semester && semester !== 'ALL') {
      studentCondition += ' AND s.semester = ?';
      studentParams.push(semester);
    }

    // Total sessions in this scope
    const totalSessionsRow = await getAsync(
      `SELECT COUNT(DISTINCT asess.id) as total FROM attendance_sessions asess ${sessionCondition}`,
      params
    );
    const totalWorkingSessions = totalSessionsRow.total || 0;

    // Student summary query
    const students = await allAsync(
      `SELECT s.id, s.roll_no, s.name, s.semester, s.section, s.email, s.phone 
       FROM students s ${studentCondition}
       ORDER BY s.semester ASC, s.roll_no ASC`,
      studentParams
    );

    // Records in this scope
    const records = await allAsync(
      `SELECT 
        ar.student_id,
        asess.id as session_id,
        asess.date,
        asess.subject,
        ar.status
       FROM attendance_records ar
       JOIN attendance_sessions asess ON ar.session_id = asess.id
       ${sessionCondition}`,
      params
    );

    // Group records by student
    const studentRecordMap = {};
    for (const r of records) {
      if (!studentRecordMap[r.student_id]) {
        studentRecordMap[r.student_id] = [];
      }
      studentRecordMap[r.student_id].push(r);
    }

    const report = students.map(st => {
      const stRecords = studentRecordMap[st.id] || [];
      const totalMarked = stRecords.length;
      const present = stRecords.filter(r => r.status === 'PRESENT').length;
      const absent = stRecords.filter(r => r.status === 'ABSENT').length;
      const leave = stRecords.filter(r => r.status === 'LEAVE').length;

      // Calculate attendance percentage based on marked sessions or working sessions
      const denominator = totalMarked > 0 ? totalMarked : (totalWorkingSessions > 0 ? totalWorkingSessions : 1);
      const percentage = totalMarked > 0 ? ((present / denominator) * 100).toFixed(1) : (totalWorkingSessions === 0 ? '100.0' : '0.0');

      return {
        id: st.id,
        roll_no: st.roll_no,
        name: st.name,
        semester: st.semester,
        section: st.section,
        email: st.email,
        phone: st.phone,
        totalSessions: totalMarked,
        present,
        absent,
        leave,
        percentage: parseFloat(percentage),
        statusAlert: parseFloat(percentage) >= 75 ? 'GOOD' : (parseFloat(percentage) >= 65 ? 'WARNING' : 'CRITICAL')
      };
    });

    // Department aggregates
    let overallPresent = 0;
    let overallAbsent = 0;
    let overallLeave = 0;
    report.forEach(r => {
      overallPresent += r.present;
      overallAbsent += r.absent;
      overallLeave += r.leave;
    });

    res.json({
      scope: {
        semester: semester || 'ALL',
        subject: subject || 'ALL',
        startDate: startDate || null,
        endDate: endDate || null,
        totalWorkingSessions
      },
      aggregates: {
        totalStudents: report.length,
        overallPresent,
        overallAbsent,
        overallLeave,
        defaultersCount: report.filter(r => r.percentage < 75 && r.totalSessions > 0).length
      },
      students: report
    });
  } catch (error) {
    console.error('Summary report error:', error);
    res.status(500).json({ error: 'Failed to generate attendance summary' });
  }
});

// Defaulters List (<75%)
app.get('/api/attendance/defaulters', authenticateToken, async (req, res) => {
  try {
    const { semester } = req.query;
    let studentCondition = 'WHERE 1=1';
    const params = [];
    if (semester && semester !== 'ALL') {
      studentCondition += ' AND s.semester = ?';
      params.push(semester);
    }

    const students = await allAsync(
      `SELECT s.id, s.roll_no, s.name, s.semester, s.section, s.phone, s.email
       FROM students s ${studentCondition}
       ORDER BY s.semester ASC, s.roll_no ASC`,
      params
    );

    const defaulters = [];
    for (const st of students) {
      const records = await allAsync(
        `SELECT ar.status 
         FROM attendance_records ar
         JOIN attendance_sessions asess ON ar.session_id = asess.id
         WHERE ar.student_id = ? AND asess.is_vacation = 0`,
        [st.id]
      );

      const total = records.length;
      if (total > 0) {
        const present = records.filter(r => r.status === 'PRESENT').length;
        const absent = records.filter(r => r.status === 'ABSENT').length;
        const leave = records.filter(r => r.status === 'LEAVE').length;
        const pct = (present / total) * 100;
        if (pct < 75) {
          defaulters.push({
            ...st,
            total,
            present,
            absent,
            leave,
            percentage: pct.toFixed(1),
            shortageLectures: Math.ceil((0.75 * total - present) / 0.25) || 1
          });
        }
      }
    }

    res.json({ defaulters });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch defaulters list' });
  }
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize DB and start server
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`🚀 BCA Attendance Portal server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startServer();
