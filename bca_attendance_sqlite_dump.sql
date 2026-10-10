PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      designation TEXT DEFAULT 'Assistant Professor',
      department TEXT DEFAULT 'BCA',
      role TEXT DEFAULT 'teacher',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO teachers VALUES(1,'Dr. Rajesh Sharma','hod.bca@college.edu','$2b$10$RkIyj.Tsx7PF7YmakivMeuzt1KlvjT/NRtDvAQ47.ouitHm6enWNi','EMP-BCA-001','HOD & Professor','BCA','admin','2026-10-09 17:21:01');
INSERT INTO teachers VALUES(2,'Prof. Sunita Rao','teacher@bca.edu','$2b$10$.562YMEdOptkCHNp3FbVfe50bgUegRS1tCvjg.CM565.p6VOfZu4C','EMP-BCA-002','Assistant Professor','BCA','teacher','2026-10-09 17:21:01');
INSERT INTO teachers VALUES(3,'vijay','xvijaykumar000@gmail.com','$2b$10$yJ3Yyzr74qZ4MRtuliMiuuLOixIrCyeKUylOMTGmwuxnfTXWk6Oyu','006','Lecturer','BCA','teacher','2026-10-09 17:31:14');
CREATE TABLE students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      semester TEXT NOT NULL,
      section TEXT DEFAULT 'A',
      email TEXT,
      phone TEXT,
      gender TEXT DEFAULT 'Other',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO students VALUES(18,'202618','vijay','BCA 1st Sem','A','xvijaykumar000@gmail.com','8580484741','Male','2026-10-09 17:33:23');
CREATE TABLE subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      credits INTEGER DEFAULT 4
    );
INSERT INTO subjects VALUES(1,'BCA 1st Sem','BCA-101','Programming in C',4);
INSERT INTO subjects VALUES(2,'BCA 1st Sem','BCA-102','Computer Fundamentals & Office Tools',4);
INSERT INTO subjects VALUES(3,'BCA 1st Sem','BCA-103','Mathematical Foundation for Comp. Sci',4);
INSERT INTO subjects VALUES(4,'BCA 1st Sem','BCA-104','Communication Skills & Ethics',4);
INSERT INTO subjects VALUES(5,'BCA 2nd Sem','BCA-201','Data Structures using C',4);
INSERT INTO subjects VALUES(6,'BCA 2nd Sem','BCA-202','Database Management Systems (DBMS)',4);
INSERT INTO subjects VALUES(7,'BCA 2nd Sem','BCA-203','Object Oriented Programming with C++',4);
INSERT INTO subjects VALUES(8,'BCA 2nd Sem','BCA-204','Discrete Mathematics',4);
INSERT INTO subjects VALUES(9,'BCA 3rd Sem','BCA-301','Java Programming & Application Dev',4);
INSERT INTO subjects VALUES(10,'BCA 3rd Sem','BCA-302','Computer Architecture & Org.',4);
INSERT INTO subjects VALUES(11,'BCA 3rd Sem','BCA-303','Operating System Concepts',4);
INSERT INTO subjects VALUES(12,'BCA 3rd Sem','BCA-304','Web Technologies & HTML/CSS/JS',4);
INSERT INTO subjects VALUES(13,'BCA 4th Sem','BCA-401','Python Programming & Data Analytics',4);
INSERT INTO subjects VALUES(14,'BCA 4th Sem','BCA-402','Computer Networks & Security',4);
INSERT INTO subjects VALUES(15,'BCA 4th Sem','BCA-403','Software Engineering & Agile',4);
INSERT INTO subjects VALUES(16,'BCA 4th Sem','BCA-404','E-Commerce & Cyber Law',4);
INSERT INTO subjects VALUES(17,'BCA 5th Sem','BCA-501','Full Stack Web Development (MERN)',4);
INSERT INTO subjects VALUES(18,'BCA 5th Sem','BCA-502','Cloud Computing & DevOps',4);
INSERT INTO subjects VALUES(19,'BCA 5th Sem','BCA-503','Mobile App Development (Android/Flutter)',4);
INSERT INTO subjects VALUES(20,'BCA 5th Sem','BCA-504','Data Mining & Warehousing',4);
INSERT INTO subjects VALUES(21,'BCA 6th Sem','BCA-601','Artificial Intelligence & Machine Learning',4);
INSERT INTO subjects VALUES(22,'BCA 6th Sem','BCA-602','Information Security & Cryptography',4);
INSERT INTO subjects VALUES(23,'BCA 6th Sem','BCA-603','Major Capstone Project',4);
CREATE TABLE holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO holidays VALUES(1,'2026-10-02','Gandhi Jayanti','National Holiday - College Closed','Admin','2026-10-09 17:21:01');
INSERT INTO holidays VALUES(2,'2026-10-20','Diwali Festival Break','Autumn Holiday & Cultural Festival','Admin','2026-10-09 17:21:01');
INSERT INTO holidays VALUES(3,'2026-10-21','Govardhan Puja','State Holiday','Admin','2026-10-09 17:21:01');
INSERT INTO holidays VALUES(4,'2026-11-14','Annual BCA Tech Symposium','No Academic Lectures - Tech Fest Day','Admin','2026-10-09 17:21:01');
CREATE TABLE attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      semester TEXT NOT NULL,
      subject TEXT NOT NULL,
      teacher_name TEXT,
      is_vacation INTEGER DEFAULT 0,
      vacation_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, semester, subject)
    );
INSERT INTO attendance_sessions VALUES(1,'2026-10-05','BCA 3rd Sem','Java Programming & Application Dev','Dr. Rajesh Sharma',0,NULL,'2026-10-09 17:21:01');
INSERT INTO attendance_sessions VALUES(2,'2026-10-06','BCA 3rd Sem','Java Programming & Application Dev','Dr. Rajesh Sharma',0,NULL,'2026-10-09 17:21:01');
INSERT INTO attendance_sessions VALUES(3,'2026-10-07','BCA 3rd Sem','Java Programming & Application Dev','Dr. Rajesh Sharma',0,NULL,'2026-10-09 17:21:01');
INSERT INTO attendance_sessions VALUES(4,'2026-10-08','BCA 3rd Sem','Java Programming & Application Dev','Dr. Rajesh Sharma',0,NULL,'2026-10-09 17:21:01');
INSERT INTO attendance_sessions VALUES(5,'2026-10-09','BCA 3rd Sem','Java Programming & Application Dev','Dr. Rajesh Sharma',0,NULL,'2026-10-09 17:21:38');
INSERT INTO attendance_sessions VALUES(6,'2026-10-09','BCA 1st Sem','Programming in C (BCA-101)','vijay',0,NULL,'2026-10-09 17:35:36');
CREATE TABLE attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'LEAVE')),
      remarks TEXT,
      FOREIGN KEY(session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );
INSERT INTO attendance_records VALUES(46,6,18,'PRESENT','');
PRAGMA writable_schema=ON;
CREATE TABLE IF NOT EXISTS sqlite_sequence(name,seq);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('teachers',3);
INSERT INTO sqlite_sequence VALUES('subjects',23);
INSERT INTO sqlite_sequence VALUES('students',18);
INSERT INTO sqlite_sequence VALUES('holidays',4);
INSERT INTO sqlite_sequence VALUES('attendance_sessions',6);
INSERT INTO sqlite_sequence VALUES('attendance_records',46);
PRAGMA writable_schema=OFF;
COMMIT;
