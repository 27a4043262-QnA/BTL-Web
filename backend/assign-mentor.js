"use strict";

const path = require("node:path");
const Database = require("better-sqlite3");

const [mentorEmail, studentEmail] = process.argv.slice(2);
if (!mentorEmail || !studentEmail) {
    console.error("Dùng: node backend/assign-mentor.js <email-mentor> <email-sinh-vien>");
    process.exit(1);
}

const db = new Database(path.join(__dirname, "data", "users.sqlite"));
try {
    const mentor = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(mentorEmail.trim());
    const student = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(studentEmail.trim());
    if (!mentor || !student) throw new Error("Không tìm thấy một trong hai tài khoản. Tạo tài khoản trước rồi chạy lại.");
    if (mentor.id === student.id) throw new Error("Không thể gán tài khoản mentor làm chính sinh viên đó.");
    const assign = db.transaction(() => {
        db.prepare("UPDATE users SET role = 'mentor' WHERE id = ?").run(mentor.id);
        db.prepare(`INSERT INTO mentor_assignments (student_id, mentor_id) VALUES (?, ?)
            ON CONFLICT(student_id) DO UPDATE SET mentor_id = excluded.mentor_id`).run(student.id, mentor.id);
    });
    assign();
    console.log(`Đã cấp quyền mentor cho ${mentorEmail} và phân công sinh viên ${studentEmail}.`);
} finally {
    db.close();
}
