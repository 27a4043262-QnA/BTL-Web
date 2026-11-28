
"use strict";

require("dotenv").config();

const path = require("node:path");
const fs = require("node:fs");

const express = require("express");
const session = require("express-session");
const SQLiteStore = require("better-sqlite3-session-store")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");

const { Strategy: GoogleStrategy } =
    require("passport-google-oauth20");

const { rateLimit } = require("express-rate-limit");
const helmet = require("helmet");
const learningRoutes = require("./routes/learning.routes");

// =====================================
// 1. KHỞI TẠO EXPRESS
// =====================================

const app = express();

const root = path.resolve(__dirname, "..");

const courseDetailsPath = path.join(root, "assets", "data", "course-details.json");
const advisingQuestionBankPath = path.join(__dirname, "advising-question-bank.json");
const advisingQuestionBank = JSON.parse(fs.readFileSync(advisingQuestionBankPath, "utf8"));

const dataDir = path.join(__dirname, "data");

fs.mkdirSync(dataDir, { recursive: true });

// =====================================
// 2. KHỞI TẠO DATABASE
// =====================================

const db = new Database(
    path.join(dataDir, "users.sqlite")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        fullname TEXT NOT NULL,

        email TEXT UNIQUE,

        phone TEXT UNIQUE,

        password_hash TEXT,

        google_id TEXT UNIQUE,

        created_at TEXT NOT NULL
            DEFAULT (datetime('now')),

        CHECK (
            email IS NOT NULL
            OR phone IS NOT NULL
        ),

        CHECK (
            password_hash IS NOT NULL
            OR google_id IS NOT NULL
        )
    );
`);

// =====================================
// AUTH VERSION - VÔ HIỆU HÓA PHIÊN CŨ
// =====================================

const userColumns = db.prepare(
    "PRAGMA table_info(users)"
).all();

if (!userColumns.some(col => col.name === "auth_version")) {

    db.exec(`
        ALTER TABLE users
        ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
    `);
}

if (!userColumns.some(col => col.name === "role")) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'`);
}

// =====================================
// TẠO BẢNG TOKEN KHÔI PHỤC MẬT KHẨU
// =====================================

db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        token_hash TEXT NOT NULL UNIQUE,

        expires_at INTEGER NOT NULL,

        created_at INTEGER NOT NULL,

        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_user
    ON password_reset_tokens(user_id);

    CREATE TABLE IF NOT EXISTS student_forecasts (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        forecast_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_forecasts_user_created
    ON student_forecasts(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS advising_sessions (
        user_id INTEGER PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS advising_test_results (
        user_id INTEGER NOT NULL,
        forecast_id TEXT NOT NULL,
        course_key TEXT NOT NULL,
        answers_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(user_id, forecast_id, course_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (forecast_id) REFERENCES student_forecasts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS advising_test_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        forecast_id TEXT NOT NULL,
        course_key TEXT NOT NULL,
        answers_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (forecast_id) REFERENCES student_forecasts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS advising_generated_question_banks (
        course_code TEXT PRIMARY KEY,
        course_name TEXT NOT NULL,
        bank_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advising_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_advising_chat_user_id
    ON advising_chat_messages(user_id, id DESC);

    CREATE TABLE IF NOT EXISTS student_progress (
        user_id INTEGER PRIMARY KEY,
        roadmap_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mentor_assignments (
        student_id INTEGER PRIMARY KEY,
        mentor_id INTEGER NOT NULL,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS advising_roadmaps (
        id TEXT PRIMARY KEY,
        student_id INTEGER NOT NULL,
        forecast_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        parent_id TEXT,
        status TEXT NOT NULL CHECK(status IN ('active', 'offered', 'accepted', 'rejected', 'archived')),
        roadmap_json TEXT NOT NULL,
        mentor_id INTEGER,
        mentor_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        reviewed_at TEXT,
        UNIQUE(student_id, forecast_id, version),
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (forecast_id) REFERENCES student_forecasts(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES advising_roadmaps(id) ON DELETE SET NULL,
        FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_roadmaps_student_created
    ON advising_roadmaps(student_id, created_at DESC);
`);

// =====================================
// 3. CẤU HÌNH SERVER
// =====================================

const port = Number(process.env.PORT || 3000);

const production =
    process.env.NODE_ENV === "production";

const secret = process.env.SESSION_SECRET;

if (
    !secret ||
    secret.length < 32 ||
    secret.includes("replace-this")
) {
    throw new Error(
        "Cần cấu hình SESSION_SECRET ít nhất 32 ký tự trong .env"
    );
}

if (production) {
    // Chỉ sử dụng sau reverse proxy HTTPS đáng tin cậy
    app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(
    express.json({
        limit: "128kb"
    })
);

// =====================================
// 4. CẤU HÌNH LƯU SESSION VỚI BETTER-SQLITE3
// =====================================

const sessionDb = new Database(
    path.join(dataDir, "sessions-better.sqlite")
);

sessionDb.pragma("journal_mode = WAL");

const sessionStore = new SQLiteStore({

    client: sessionDb,

    expired: {
        clear: true,
        intervalMs: 15 * 60 * 1000
    }
});

// =====================================
// CẤU HÌNH EXPRESS SESSION
// =====================================

app.use(
    session({

        name: "edutrack.sid",

        secret: secret,

        resave: false,

        saveUninitialized: false,

        store: sessionStore,

        cookie: {

            httpOnly: true,

            sameSite: "lax",

            secure: production,

            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })
);

// =====================================
// 5. KHỞI TẠO PASSPORT
// =====================================

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {

    try {

        const account = db.prepare(`
            SELECT id, auth_version
            FROM users
            WHERE id = ?
        `).get(user.id);

        if (!account) {
            return done(new Error("User not found"));
        }

        done(null, {
            id: account.id,
            version: account.auth_version
        });

    } catch (error) {
        done(error);
    }
});

passport.deserializeUser(function (payload, done) {

    try {

        if (
            !payload ||
            typeof payload !== "object" ||
            !Number.isInteger(payload.id) ||
            !Number.isInteger(payload.version)
        ) {
            return done(null, false);
        }

        const user = db.prepare(`
            SELECT
                id,
                fullname,
                email,
                phone,
                role,
                auth_version
            FROM users
            WHERE id = ?
        `).get(payload.id);

        if (!user) {
            return done(null, false);
        }

        if (user.auth_version !== payload.version) {
            return done(null, false);
        }

        done(null, user);

    } catch (error) {
        done(error);
    }
});

// =====================================
// 6. CẤU HÌNH GOOGLE OAUTH
// =====================================

const googleConfigured = Boolean(

    process.env.GOOGLE_CLIENT_ID &&

    process.env.GOOGLE_CLIENT_SECRET &&

    process.env.GOOGLE_CALLBACK_URL
);

if (googleConfigured) {

    passport.use(
        new GoogleStrategy(

            {
                clientID:
                    process.env.GOOGLE_CLIENT_ID,

                clientSecret:
                    process.env.GOOGLE_CLIENT_SECRET,

                callbackURL:
                    process.env.GOOGLE_CALLBACK_URL,

                // Cho phép kiểm tra session trong callback
                passReqToCallback: true
            },

            function (
                req,
                accessToken,
                refreshToken,
                profile,
                done
            ) {

                try {

                    // =====================================
                    // 1. KIỂM TRA MỤC ĐÍCH XÁC THỰC
                    // =====================================

                    const mode =
                        req.session.googleAuthMode;

                    if (
                        mode !== "register" &&
                        mode !== "login"
                    ) {

                        return done(
                            null,
                            false,
                            { message: "google_failed" }
                        );
                    }

                    // =====================================
                    // 2. KIỂM TRA EMAIL GOOGLE
                    // =====================================

                    const verifiedEmail =
                        (profile.emails || []).find(
                            function (item) {

                                return (
                                    item.verified === true &&
                                    typeof item.value === "string"
                                );
                            }
                        );

                    if (!verifiedEmail) {

                        return done(
                            null,
                            false,
                            { message: "google_failed" }
                        );
                    }

                    const email =
                        verifiedEmail.value
                            .trim()
                            .toLowerCase();

                    const googleId = profile.id;

                    // =====================================
                    // 3. TÌM TÀI KHOẢN GOOGLE
                    // =====================================

                    const existingGoogleUser =
                        db.prepare(`
                            SELECT *
                            FROM users
                            WHERE google_id = ?
                        `).get(googleId);

                    // =====================================
                    // 4. LUỒNG ĐĂNG NHẬP GOOGLE
                    // =====================================

                    if (mode === "login") {

                        // Chưa đăng ký Google
                        if (!existingGoogleUser) {

                            // Kiểm tra email đã đăng ký
                            // bằng phương thức khác chưa
                            const emailOwner =
                                db.prepare(`
                                    SELECT id
                                    FROM users
                                    WHERE email = ?
                                `).get(email);

                            if (emailOwner) {

                                return done(
                                    null,
                                    false,
                                    { message: "google_conflict" }
                                );
                            }

                            return done(
                                null,
                                false,
                                { message: "google_not_registered" }
                            );
                        }

                        // Đã đăng ký Google
                        return done(
                            null,
                            { id: existingGoogleUser.id }
                        );
                    }

                    // =====================================
                    // 5. LUỒNG ĐĂNG KÝ GOOGLE
                    // =====================================

                    if (mode === "register") {

                        // Google ID đã tồn tại
                        if (existingGoogleUser) {

                            return done(
                                null,
                                false,
                                { message: "google_already_registered" }
                            );
                        }

                        // Kiểm tra email đã tồn tại
                        const emailOwner =
                            db.prepare(`
                                SELECT id
                                FROM users
                                WHERE email = ?
                            `).get(email);

                        if (emailOwner) {

                            return done(
                                null,
                                false,
                                { message: "google_conflict" }
                            );
                        }

                        // =====================================
                        // 6. TẠO TÀI KHOẢN GOOGLE MỚI
                        // =====================================

                        const fullname = (
                            profile.displayName ||
                            email.split("@")[0]
                        ).trim().slice(0, 50);

                        const result =
                            db.prepare(`
                                INSERT INTO users (
                                    fullname,
                                    email,
                                    google_id
                                )
                                VALUES (?, ?, ?)
                            `).run(
                                fullname,
                                email,
                                googleId
                            );

                        // Tạo tài khoản thành công
                        return done(
                            null,
                            {
                                id: Number(
                                    result.lastInsertRowid
                                )
                            }
                        );
                    }

                } catch (error) {

                    // Xử lý khi hai yêu cầu cùng tạo
                    // một tài khoản trong SQLite
                    if (
                        error.code ===
                        "SQLITE_CONSTRAINT_UNIQUE"
                    ) {

                        return done(
                            null,
                            false,
                            { message: "google_conflict" }
                        );
                    }

                    console.error(
                        "Google Strategy error:",
                        error
                    );

                    return done(error);
                }
            }
        )
    );
}

// =====================================
// 7. KIỂM TRA NGUỒN YÊU CẦU
// =====================================

function sameOrigin(req, res, next) {

    const origin = req.get("origin");

    if (!origin) {

        return res.status(403).json({
            message: "Thiếu Origin của yêu cầu."
        });
    }

    try {

        const expected =
            `${req.protocol}://${req.get("host")}`;

        if (new URL(origin).origin === expected) {

            return next();
        }

    } catch (error) {

        // Origin không hợp lệ
    }

    return res.status(403).json({
        message: "Yêu cầu không cùng nguồn."
    });
}

// Keep the existing GPA/projection save, restore, and reset APIs available.
app.use("/api/learning", learningRoutes(db, sameOrigin));

// =====================================
// 8. GIỚI HẠN SỐ YÊU CẦU
// =====================================

const limiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    limit: 15,

    standardHeaders: "draft-7",

    legacyHeaders: false,

    message: {
        message:
            "Quá nhiều yêu cầu. Vui lòng thử lại sau."
    }
});

// =====================================
// 9. HÀM KIỂM TRA DỮ LIỆU
// =====================================

const phonePattern = /^0\d{9}$/;

const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validName(value) {

    return (
        typeof value === "string" &&
        value.trim().length >= 2 &&
        value.trim().length <= 50
    );
}

// Không trả mật khẩu cho trình duyệt
function publicUser(user) {

    return {

        id: user.id,

        fullname: user.fullname,

        email: user.email,

        phone: user.phone,
        role: user.role
    };
}

// =====================================
// 10. API ĐĂNG KÝ
// POST /api/auth/register
// =====================================

app.post(
    "/api/auth/register",
    sameOrigin,
    limiter,
    async function (req, res) {

        try {

            // =====================================
            // 1. NHẬN DỮ LIỆU
            // =====================================

            const {
                fullname,
                email,
                phone,
                password,
                confirmPassword
            } = req.body || {};

            // =====================================
            // 2. KIỂM TRA HỌ VÀ TÊN
            // =====================================

            if (
                typeof fullname !== "string" ||
                fullname.trim().length < 2 ||
                fullname.trim().length > 50
            ) {

                return res.status(400).json({

                    field: "fullname",

                    message:
                        "Họ và tên phải có từ 2 đến 50 ký tự."
                });
            }

            const normalizedName = fullname.trim();

            // =====================================
            // 3. KIỂM TRA EMAIL - BẮT BUỘC
            // =====================================

            if (
                typeof email !== "string" ||
                email.trim().length === 0
            ) {

                return res.status(400).json({

                    field: "email",

                    message:
                        "Vui lòng nhập địa chỉ email."
                });
            }

            const normalizedEmail =
                email.trim().toLowerCase();

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                normalizedEmail.length > 254 ||
                !emailPattern.test(normalizedEmail)
            ) {

                return res.status(400).json({

                    field: "email",

                    message:
                        "Địa chỉ email không hợp lệ."
                });
            }

            // =====================================
            // 4. KIỂM TRA SỐ ĐIỆN THOẠI
            // =====================================

            // Số điện thoại không bắt buộc.
            // Nếu để trống, lưu NULL.

            if (
                phone != null &&
                typeof phone !== "string"
            ) {

                return res.status(400).json({

                    field: "phone",

                    message:
                        "Số điện thoại không hợp lệ."
                });
            }

            const normalizedPhone =
                typeof phone === "string"
                    ? phone.trim()
                    : "";

            const phonePattern = /^0\d{9}$/;

            if (
                normalizedPhone &&
                !phonePattern.test(normalizedPhone)
            ) {

                return res.status(400).json({

                    field: "phone",

                    message:
                        "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0."
                });
            }

            const phoneValue =
                normalizedPhone || null;

            // =====================================
            // 5. KIỂM TRA MẬT KHẨU
            // =====================================

            if (
                typeof password !== "string" ||
                password.length < 8 ||
                password.length > 64
            ) {

                return res.status(400).json({

                    field: "password",

                    message:
                        "Mật khẩu phải có từ 8 đến 64 ký tự."
                });
            }

            // =====================================
            // 6. KIỂM TRA XÁC NHẬN MẬT KHẨU
            // =====================================

            if (
                typeof confirmPassword !== "string" ||
                confirmPassword !== password
            ) {

                return res.status(400).json({

                    field: "confirmPassword",

                    message:
                        "Mật khẩu xác nhận không trùng khớp."
                });
            }

            // =====================================
            // 7. KIỂM TRA EMAIL ĐÃ ĐĂNG KÝ
            // =====================================

            const existingEmail = db.prepare(`
                SELECT id
                FROM users
                WHERE email = ?
            `).get(normalizedEmail);

            if (existingEmail) {

                return res.status(409).json({

                    field: "email",

                    message:
                        "Email này đã được đăng ký."
                });
            }

            // =====================================
            // 8. KIỂM TRA SỐ ĐIỆN THOẠI TRÙNG
            // =====================================

            if (phoneValue !== null) {

                const existingPhone = db.prepare(`
                    SELECT id
                    FROM users
                    WHERE phone = ?
                `).get(phoneValue);

                if (existingPhone) {

                    return res.status(409).json({

                        field: "phone",

                        message:
                            "Số điện thoại này đã được đăng ký."
                    });
                }
            }

            // =====================================
            // 9. BĂM MẬT KHẨU
            // =====================================

            const passwordHash = await bcrypt.hash(
                password,
                12
            );

            // =====================================
            // 10. LƯU TÀI KHOẢN VÀO SQLITE
            // =====================================

            const insertUser = db.prepare(`
                INSERT INTO users (
                    fullname,
                    email,
                    phone,
                    password_hash
                )
                VALUES (?, ?, ?, ?)
            `);

            let insertResult;

            try {

                insertResult = insertUser.run(
                    normalizedName,
                    normalizedEmail,
                    phoneValue,
                    passwordHash
                );

            } catch (insertError) {

                if (
                    insertError.code ===
                    "SQLITE_CONSTRAINT_UNIQUE"
                ) {

                    // Xác định trường bị trùng
                    const emailCollision = db.prepare(`
                        SELECT id
                        FROM users
                        WHERE email = ?
                    `).get(normalizedEmail);

                    if (emailCollision) {

                        return res.status(409).json({

                            field: "email",

                            message:
                                "Email này đã được đăng ký."
                        });
                    }

                    return res.status(409).json({

                        field: "phone",

                        message:
                            "Số điện thoại này đã được đăng ký."
                    });
                }

                throw insertError;
            }

            const userId =
                Number(insertResult.lastInsertRowid);

            // =====================================
            // 11. TẠO SESSION MỚI
            // =====================================

            req.session.regenerate(function (error) {

                if (error) {

                    console.error(
                        "Register session error:",
                        error
                    );

                    return res.status(500).json({

                        message:
                            "Tài khoản đã được tạo nhưng không thể khởi tạo phiên đăng nhập. Vui lòng đăng nhập lại."
                    });
                }

                // =====================================
                // 12. ĐĂNG NHẬP SAU KHI ĐĂNG KÝ
                // =====================================

                req.login(
                    { id: userId },
                    function (loginError) {

                        if (loginError) {

                            console.error(
                                "Register login error:",
                                loginError
                            );

                            return res.status(500).json({

                                message:
                                    "Tài khoản đã được tạo nhưng không thể tự động đăng nhập. Vui lòng đăng nhập lại."
                            });
                        }

                        // =====================================
                        // 13. LƯU PHIÊN
                        // =====================================

                        req.session.save(function (saveError) {

                            if (saveError) {

                                console.error(
                                    "Register save session error:",
                                    saveError
                                );

                                return res.status(500).json({

                                    message:
                                        "Tài khoản đã được tạo nhưng không thể lưu phiên đăng nhập."
                                });
                            }

                            // =====================================
                            // 14. TRẢ VỀ THÔNG TIN TÀI KHOẢN
                            // =====================================

                            const user = db.prepare(`
                                SELECT
                                    id,
                                    fullname,
                                    email,
                                    phone
                                FROM users
                                WHERE id = ?
                            `).get(userId);

                            return res.status(201).json({

                                message:
                                    "Đăng ký tài khoản thành công.",

                                user: publicUser(user)
                            });
                        });
                    }
                );
            });

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            return res.status(500).json({

                message:
                    "Máy chủ gặp lỗi. Vui lòng thử lại."
            });
        }
    }
);

// =====================================
// 11. API ĐĂNG NHẬP
// POST /api/auth/login
// =====================================

app.post(
    "/api/auth/login",
    sameOrigin,
    limiter,
    async function (req, res) {

        try {

            const {
                emailOrPhone,
                password
            } = req.body || {};

            if (
                typeof emailOrPhone !== "string" ||
                typeof password !== "string"
            ) {

                return res.status(400).json({
                    message:
                        "Thiếu tài khoản hoặc mật khẩu."
                });
            }

            const contact =
                emailOrPhone.trim().toLowerCase();

            const user = db.prepare(`
                SELECT *
                FROM users
                WHERE email = ? OR phone = ?
            `).get(contact, contact);

            const valid = Boolean(
                user &&
                user.password_hash &&
                await bcrypt.compare(
                    password,
                    user.password_hash
                )
            );

            if (!valid) {

                return res.status(401).json({
                    message:
                        "Tài khoản hoặc mật khẩu không đúng."
                });
            }

            req.session.regenerate(function (error) {

                if (error) {

                    return res.status(500).json({
                        message:
                            "Không thể tạo phiên đăng nhập."
                    });
                }

                req.login(user, function (loginError) {

                    if (loginError) {

                        return res.status(500).json({
                            message: "Không thể đăng nhập."
                        });
                    }
                
                    req.session.save(function (saveError) {

                        if (saveError) {

                            return res.status(500).json({
                                message:
                                    "Không thể lưu phiên đăng nhập."
                            });
                        }

                        return res.json({

                            message: "Đăng nhập thành công.",

                            user: publicUser(user)
                        });
                    });
                });
            });

        } catch (error) {

            console.error("Login error:", error);

            return res.status(500).json({
                message: "Lỗi máy chủ."
            });
        }
    }
);


// =====================================
// API CHI TIẾT MÔN HỌC
// GET /api/courses/:courseId/detail
// =====================================

app.get("/api/courses/:courseId/detail", function (req, res) {
    const courseId = req.params.courseId;

    // Kiểm tra mã môn học
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(courseId)) {
        return res.status(400).json({
            message: "Mã môn học không hợp lệ."
        });
    }

    // Đọc dữ liệu môn học từ file JSON
    fs.readFile(courseDetailsPath, "utf8", function (error, content) {
        if (error) {
            console.error("Không đọc được dữ liệu môn học:", error);

            return res.status(500).json({
                message: "Không thể tải dữ liệu môn học."
            });
        }

        let courses;

        try {
            courses = JSON.parse(content);
        } catch (parseError) {
            console.error("Dữ liệu môn học không hợp lệ:", parseError);

            return res.status(500).json({
                message: "Dữ liệu môn học không hợp lệ."
            });
        }

        // Kiểm tra dữ liệu phải là một mảng
        if (!Array.isArray(courses)) {
            return res.status(500).json({
                message: "Cấu trúc dữ liệu môn học không hợp lệ."
            });
        }

        // Tìm môn học theo ID
        const course = courses.find(function (item) {
            return item && item.id === courseId;
        });

        if (!course) {
            return res.status(404).json({
                message: "Không tìm thấy môn học."
            });
        }

        // Lấy danh sách môn học liên quan
        const relatedIds = Array.isArray(course.related)
            ? course.related
            : [];

        const relatedCourses = relatedIds
            .map(function (id) {
                return courses.find(function (item) {
                    return item && item.id === id;
                });
            })
            .filter(Boolean);

        res.set("Cache-Control", "no-store");

        return res.json({
            course: course,
            relatedCourses: relatedCourses
        });
    });
});


// =====================================
// 12. API LẤY NGƯỜI DÙNG HIỆN TẠI
// GET /api/auth/me
// =====================================

app.get("/api/auth/me", function (req, res) {

    res.json({

        user: req.user
            ? publicUser(req.user)
            : null
    });
});

function requireAdvisingUser(req, res, next) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: "Vui lòng đăng nhập để lưu dữ liệu tư vấn." });
    }
    next();
}

function requireMentor(req, res, next) {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ message: "Vui lòng đăng nhập." });
    if (req.user.role !== "mentor") return res.status(403).json({ message: "Tài khoản này chưa được cấp quyền mentor." });
    next();
}

function sanitizeRoadmap(input) {
    if (!input || !Array.isArray(input.weeks) || input.weeks.length < 1 || input.weeks.length > 12) return null;
    const weeks = [];
    for (const week of input.weeks) {
        if (!week || !Array.isArray(week.tasks) || week.tasks.length < 1 || week.tasks.length > 40) return null;
        const tasks = [];
        for (const task of week.tasks) {
            const title = String(task?.title || task?.text || "").trim().slice(0, 180);
            const detail = String(task?.detail || "").trim().slice(0, 500);
            const duration = Number(task?.duration || 45);
            if (!title || !Number.isInteger(duration) || duration < 15 || duration > 360) return null;
            tasks.push({
                id: String(task.id || crypto.randomUUID()).slice(0, 80), title, detail,
                duration, priority: String(task.priority || "Học tập").slice(0, 40),
                day: String(task.day || "").slice(0, 40),
                resource: String(task.resource || "").slice(0, 240),
                done: false, completedAt: null
            });
        }
        weeks.push({
            title: String(week.title || "Tuần học").slice(0, 80),
            subtitle: String(week.subtitle || "").slice(0, 160),
            checkpoint: String(week.checkpoint || "").slice(0, 240), tasks
        });
    }
    return {
        title: String(input.title || "Lộ trình cá nhân hóa").slice(0, 160),
        goal: String(input.goal || "").slice(0, 500), weeks
    };
}

function buildFallbackRoadmap(data) {
    const ranked = [...(data.courses || [])].sort((a, b) => {
        const riskA = (100 - Number(a.testScore || 0)) + Math.max(0, Number(a.predictedScore || 0) - Number(a.testScore || 0)) * 0.5;
        const riskB = (100 - Number(b.testScore || 0)) + Math.max(0, Number(b.predictedScore || 0) - Number(b.testScore || 0)) * 0.5;
        return riskB - riskA;
    });
    const weeklyMinutes = Number(data.hoursPerWeek) * 60;
    const focusCourses = ranked.slice(0, 3);
    if (!focusCourses.length || weeklyMinutes < 30) return null;
    const weights = focusCourses.length === 1 ? [1] : focusCourses.length === 2 ? [0.6, 0.4] : [0.45, 0.35, 0.2];
    const allocations = weights.map(weight => Math.floor(weeklyMinutes * weight));
    allocations[0] += weeklyMinutes - allocations.reduce((sum, minutes) => sum + minutes, 0);
    const style = data.learningStyle;
    const weeks = Array.from({ length: data.weeks }, (_, weekIndex) => {
        const tasks = [];
        focusCourses.forEach((course, courseIndex) => {
            const topics = [...(course.topics || [])].sort((a, b) => Number(a.score) - Number(b.score));
            const weakTopics = topics.filter(topic => Number(topic.score) < 70);
            const topic = weakTopics.length
                ? weakTopics[weekIndex % weakTopics.length].name
                : (topics[weekIndex % Math.max(topics.length, 1)]?.name || "kiến thức trọng tâm");
            let remaining = allocations[courseIndex];
            let part = 1;
            while (remaining >= 15) {
                const duration = Math.min(240, remaining);
                const activity = style === "reading"
                    ? "Đọc lại ghi chú/slide, tự tóm tắt rồi kiểm tra bằng câu hỏi ngắn"
                    : style === "practice"
                        ? "Làm bài tập hoặc tình huống thực hành, ghi lại lỗi và tự sửa"
                        : "Ôn lý thuyết ngắn, sau đó làm bài tập/tình huống và tự kiểm tra";
                tasks.push({
                    id: `fallback-w${weekIndex + 1}-c${courseIndex + 1}-p${part}`,
                    day: `Buổi ${tasks.length + 1}`,
                    title: `${course.name}: ${topic}${part > 1 ? ` (phần ${part})` : ""}`,
                    detail: `${activity}. Mục tiêu: cải thiện chủ đề đang đạt ${Math.round(Number(weakTopics[weekIndex % Math.max(weakTopics.length, 1)]?.score ?? course.testScore))}% trong bài chẩn đoán.`,
                    duration,
                    priority: courseIndex === 0 ? "Ưu tiên cao" : courseIndex === 1 ? "Ưu tiên" : "Duy trì",
                    resource: "Slide/giáo trình môn học và bộ bài tập do giảng viên cung cấp"
                });
                remaining -= duration;
                part += 1;
            }
        });
        return {
            title: `Tuần ${weekIndex + 1}: củng cố môn cần ưu tiên`,
            subtitle: `Phân bổ ${data.hoursPerWeek} giờ theo kết quả kiểm tra và cách học đã chọn.`,
            checkpoint: "Tự làm lại một nhóm câu hỏi của các chủ đề đã ôn và ghi nhận điểm tiến bộ.",
            tasks
        };
    });
    return sanitizeRoadmap({
        title: "Lộ trình học tập cá nhân hóa",
        goal: `Ưu tiên các môn/chủ đề có điểm chẩn đoán thấp, hướng tới GPA mục tiêu ${Number(data.targetGPA).toFixed(2)}/4.`,
        weeks
    });
}

const normalizeAdvisingCourse = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");

async function makeQuestionBank(course) {
    const code = String(course.code || "").trim().toUpperCase();
    const normalizedName = normalizeAdvisingCourse(course.name);
    const curated = advisingQuestionBank.find(item =>
        (item.courseId && String(item.courseId).toUpperCase() === code) ||
        [item.name, ...(item.aliases || [])].map(normalizeAdvisingCourse).includes(normalizedName)
    );
    if (curated) {
        const bank = { ...curated, key: code, courseId: code, name: course.name };
        db.prepare(`INSERT INTO advising_generated_question_banks (course_code, course_name, bank_json)
            VALUES (?, ?, ?) ON CONFLICT(course_code) DO NOTHING`)
            .run(code, course.name, JSON.stringify(bank));
        return bank;
    }
    const cached = db.prepare("SELECT bank_json FROM advising_generated_question_banks WHERE course_code = ?").get(code);
    if (cached) {
        const bank = JSON.parse(cached.bank_json);
        bank.name = course.name;
        return bank;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY để tạo câu hỏi cho môn chưa có ngân hàng mẫu.");
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: "Bạn là người soạn bài kiểm tra đầu vào cho sinh viên đại học. Soạn câu hỏi trắc nghiệm tiếng Việt đúng kiến thức nền tảng của môn học được nêu. Trả lời chỉ bằng JSON hợp lệ có dạng {questions:[{id:string,topic:string,weight:number,level:string,text:string,choices:[string,string,string,string],correct:number,explain:string}]}. Tạo đúng 6 câu, chia đều ít nhất 3 chủ đề; correct là chỉ số từ 0 đến 3. Tránh câu mẹo, câu mơ hồ và nội dung phụ thuộc giáo trình riêng. Không tạo câu hỏi nếu không chắc kiến thức; khi đó tạo câu hỏi nhập môn khái quát nhất của môn." }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify({ courseCode: code, courseName: course.name, instruction: "Bài kiểm tra chẩn đoán, không phải đề thi chính thức." }) }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 3500 }
        }),
        signal: AbortSignal.timeout(60000)
    });
    if (!upstream.ok) throw new Error(`Gemini không tạo được câu hỏi cho ${course.name} (HTTP ${upstream.status}).`);
    const payload = await upstream.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    if (!raw) throw new Error(`Gemini chưa tạo câu hỏi cho ${course.name}.`);
    const generated = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    const questions = generated.questions;
    const valid = Array.isArray(questions) && questions.length === 6 && questions.every((q, i) =>
        q && typeof q.topic === "string" && q.topic.trim().length <= 100 &&
        typeof q.text === "string" && q.text.trim().length <= 500 &&
        Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every(c => typeof c === "string" && c.trim().length <= 240) &&
        Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3 &&
        Number.isInteger(q.weight) && q.weight >= 1 && q.weight <= 3 &&
        typeof q.explain === "string" && q.explain.trim().length <= 500
    );
    if (!valid) throw new Error(`Bộ câu hỏi tạo cho ${course.name} chưa đạt cấu trúc hợp lệ.`);
    const bank = {
        key: code, courseId: code, name: course.name, aliases: [], description: "Bộ câu hỏi chẩn đoán được tạo riêng cho môn trong dự phóng.",
        generated: true,
        questions: questions.map((q, i) => ({ ...q, id: `${code.toLowerCase()}-${i + 1}`, level: String(q.level || "Vận dụng").slice(0, 30) }))
    };
    db.prepare(`INSERT INTO advising_generated_question_banks (course_code, course_name, bank_json)
        VALUES (?, ?, ?) ON CONFLICT(course_code) DO UPDATE SET course_name = excluded.course_name, bank_json = excluded.bank_json, created_at = datetime('now')`)
        .run(code, course.name, JSON.stringify(bank));
    return bank;
}

app.get("/api/advising/question-bank", requireAdvisingUser, async function (req, res) {
    try {
        const forecastRow = db.prepare("SELECT id, forecast_json FROM student_forecasts WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(req.user.id);
        if (!forecastRow) return res.json({ forecastId: null, forecast: null, courses: [], generatedCount: 0 });
        const forecast = JSON.parse(forecastRow.forecast_json);
        if (!Array.isArray(forecast.courses) || !forecast.courses.length) return res.status(409).json({ message: "Dự phóng GPA chưa có môn học để kiểm tra." });
        if (forecast.courses.length > 12) return res.status(409).json({ message: "Trang tư vấn hỗ trợ tối đa 12 môn trong một lần dự phóng." });
        const courses = [];
        for (const course of forecast.courses) courses.push(await makeQuestionBank(course));
        res.set("Cache-Control", "no-store");
        // Never expose the answer key or explanations before the server grades a submission.
        const publicCourses = courses.map(course => ({
            key: course.key,
            courseId: course.courseId,
            name: course.name,
            aliases: course.aliases,
            description: course.description,
            generated: course.generated,
            questions: course.questions.map(({ id, topic, weight, level, text, choices }) => ({ id, topic, weight, level, text, choices }))
        }));
        return res.json({ forecastId: forecastRow.id, forecast, courses: publicCourses, generatedCount: courses.filter(item => item.generated).length });
    } catch (error) {
        console.error("Advising question generation failed:", error.message || error.name || "Error");
        return res.status(502).json({ message: error.message || "Không thể tải ngân hàng câu hỏi. Hãy thử lại." });
    }
});

app.post("/api/advising/tests/submit", sameOrigin, requireAdvisingUser, function (req, res) {
    const { forecastId, courseKey, answers } = req.body || {};
    const forecastRow = db.prepare("SELECT forecast_json FROM student_forecasts WHERE id = ? AND user_id = ?")
        .get(String(forecastId || ""), req.user.id);
    if (!forecastRow) return res.status(404).json({ message: "Không tìm thấy dự phóng của tài khoản này." });
    const bankRow = db.prepare("SELECT bank_json FROM advising_generated_question_banks WHERE course_code = ?").get(String(courseKey || "").toUpperCase());
    const course = bankRow ? JSON.parse(bankRow.bank_json) : null;
    if (!course) return res.status(404).json({ message: "Không tìm thấy bộ câu hỏi của môn này. Hãy tải lại trang tư vấn." });
    const forecast = JSON.parse(forecastRow.forecast_json);
    const forecastCourse = (forecast.courses || []).find(item => String(item.code || "").toUpperCase() === String(courseKey || "").toUpperCase());
    if (!forecastCourse) {
        return res.status(403).json({ message: "Môn này không thuộc dự phóng đã chọn." });
    }
    if (!answers || typeof answers !== "object" || Array.isArray(answers)
        || course.questions.some(question => answers[question.id] !== undefined &&
            (!Number.isInteger(answers[question.id]) || answers[question.id] < 0 || answers[question.id] >= question.choices.length))) {
        return res.status(400).json({ message: "Câu trả lời không hợp lệ." });
    }

    const topics = new Map();
    let earned = 0, possible = 0, correctCount = 0;
    for (const question of course.questions) {
        if (!topics.has(question.topic)) topics.set(question.topic, { name: question.topic, earned: 0, possible: 0, correct: 0, count: 0 });
        const topic = topics.get(question.topic);
        topic.possible += question.weight;
        topic.count += 1;
        possible += question.weight;
        if (answers[question.id] === question.correct) {
            topic.earned += question.weight;
            topic.correct += 1;
            earned += question.weight;
            correctCount += 1;
        }
    }
    const topicsResult = [...topics.values()].map(topic => ({
        ...topic, percentage: Math.round(topic.earned / topic.possible * 100)
    }));
    const result = {
        course, answers, earned, possible, correctCount,
        percentage: Math.round(earned / possible * 100), topics: topicsResult
    };
    const saveAttempt = db.prepare(`INSERT INTO advising_test_attempts (user_id, forecast_id, course_key, answers_json, result_json)
        VALUES (?, ?, ?, ?, ?)`);
    const saveLatest = db.prepare(`INSERT INTO advising_test_results (user_id, forecast_id, course_key, answers_json, result_json, submitted_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, forecast_id, course_key) DO UPDATE SET
            answers_json = excluded.answers_json, result_json = excluded.result_json, submitted_at = datetime('now')`);
    const save = db.transaction(() => {
        saveAttempt.run(req.user.id, forecastId, courseKey, JSON.stringify(answers), JSON.stringify(result));
        saveLatest.run(req.user.id, forecastId, courseKey, JSON.stringify(answers), JSON.stringify(result));
    });
    save();
    res.set("Cache-Control", "no-store");
    return res.json({ result });
});

app.get("/api/advising/tests/results", requireAdvisingUser, function (req, res) {
    const forecastId = String(req.query.forecastId || "");
    const ownsForecast = db.prepare("SELECT 1 FROM student_forecasts WHERE id = ? AND user_id = ?")
        .get(forecastId, req.user.id);
    if (!ownsForecast) return res.status(404).json({ message: "Không tìm thấy dự phóng." });
    const rows = db.prepare(`SELECT course_key, result_json FROM advising_test_results
        WHERE user_id = ? AND forecast_id = ?`).all(req.user.id, forecastId);
    const results = Object.fromEntries(rows.map(row => [row.course_key, JSON.parse(row.result_json)]));
    res.set("Cache-Control", "no-store");
    return res.json({ results });
});

app.post("/api/advising/tests/reset", sameOrigin, requireAdvisingUser, function (req, res) {
    const forecastId = String(req.body?.forecastId || "");
    const ownsForecast = db.prepare("SELECT 1 FROM student_forecasts WHERE id = ? AND user_id = ?")
        .get(forecastId, req.user.id);
    if (!ownsForecast) return res.status(404).json({ message: "Không tìm thấy dự phóng." });
    // Kết quả hiện tại được xóa để bắt đầu lần làm mới; bảng attempts vẫn giữ lịch sử.
    db.prepare("DELETE FROM advising_test_results WHERE user_id = ? AND forecast_id = ?")
        .run(req.user.id, forecastId);
    return res.json({ reset: true });
});

app.post("/api/advising/roadmaps/generate", sameOrigin, limiter, requireAdvisingUser, async function (req, res) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "Backend chưa được cấu hình GEMINI_API_KEY." });
    const forecastId = String(req.body?.forecastId || "");
    const forecastRow = db.prepare("SELECT forecast_json FROM student_forecasts WHERE id = ? AND user_id = ?")
        .get(forecastId, req.user.id);
    if (!forecastRow) return res.status(404).json({ message: "Không tìm thấy dự phóng." });
    const forecast = JSON.parse(forecastRow.forecast_json);
    const settings = req.body?.settings || {};
    const hoursPerWeek = Number(settings.hoursPerWeek);
    const weeks = Number(settings.weeks);
    const learningStyle = String(settings.learningStyle || "");
    if (!Number.isInteger(hoursPerWeek) || hoursPerWeek < 2 || hoursPerWeek > 40
        || !Number.isInteger(weeks) || weeks < 2 || weeks > 12
        || !["practice", "reading", "mixed"].includes(learningStyle)) {
        return res.status(400).json({ message: "Thời gian và phong cách học không hợp lệ." });
    }
    const supported = (forecast.courses || []).map(course => ({
        key: String(course.code || "").toUpperCase(),
        name: course.name
    }));
    const rows = db.prepare("SELECT course_key, result_json FROM advising_test_results WHERE user_id = ? AND forecast_id = ?")
        .all(req.user.id, forecastId);
    const resultMap = new Map(rows.map(row => [row.course_key, JSON.parse(row.result_json)]));
    if (supported.some(course => !resultMap.has(course.key))) {
        return res.status(409).json({ message: "Hãy hoàn thành bài kiểm tra cho tất cả môn trong dự phóng trước." });
    }
    const analysis = supported.map((course, index) => {
        const result = resultMap.get(course.key);
        return {
            courseId: course.key,
            courseName: course.name,
            credits: forecast.courses[index].credits,
            predictedScore: Math.round(Number(forecast.courses[index].targetScore) * 10),
            testScore: Math.round(result.earned / result.possible * 100),
            scoreGap: Math.round(result.earned / result.possible * 100) - Math.round(Number(forecast.courses[index].targetScore) * 10),
            topics: result.topics.map(topic => ({ name: topic.name, score: topic.percentage, priority: topic.percentage < 70 ? "high" : "normal" }))
        };
    });
    const promptData = {
        currentGPA: forecast.currentGPA, targetGPA: forecast.targetGPA, forecastGPA: forecast.forecastGPA,
        hoursPerWeek, weeks, learningStyle, courses: analysis
    };
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    try {
        let roadmap = null;
        let generationMethod = "gemini";
        try {
            const upstream = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: "Bạn là cố vấn học tập. Dựa đúng vào JSON đầu vào để tạo kế hoạch học tập cá nhân hóa bằng tiếng Việt. Không tự nhận là mentor đã duyệt. Không bịa URL; nếu không biết tài liệu cụ thể, nêu loại tài liệu cần tìm. Trả đúng số tuần. Mỗi tuần phải có tasks là mảng không rỗng, mỗi duration là số nguyên phút từ 15 đến 240. Tổng thời lượng không vượt hoursPerWeek * 60. Chỉ trả JSON hợp lệ theo cấu trúc: {title:string,goal:string,weeks:[{title:string,subtitle:string,checkpoint:string,tasks:[{day:string,title:string,detail:string,duration:number,priority:string,resource:string}]}]}." }] },
                    contents: [{ role: "user", parts: [{ text: JSON.stringify(promptData) }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 5000 }
                }),
                signal: AbortSignal.timeout(45000)
            });
            if (!upstream.ok) {
                console.error("Gemini roadmap API returned HTTP", upstream.status);
            } else {
                const payload = await upstream.json();
                const generated = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
                if (generated) {
                    const cleaned = generated.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
                    roadmap = sanitizeRoadmap(JSON.parse(cleaned));
                }
            }
        } catch (generationError) {
            console.error("Gemini roadmap generation failed; using personalized fallback:", generationError.name || "Error");
        }
        if (!roadmap || roadmap.weeks.length !== weeks
            || roadmap.weeks.some(week => week.tasks.reduce((sum, task) => sum + task.duration, 0) > hoursPerWeek * 60)) {
            roadmap = buildFallbackRoadmap(promptData);
            generationMethod = "personalized-fallback";
        }
        if (!roadmap || roadmap.weeks.length !== weeks) {
            return res.status(500).json({ message: "Không thể tạo lộ trình từ dữ liệu hiện có. Hãy kiểm tra số giờ và số tuần." });
        }
        const existing = db.prepare("SELECT id FROM advising_roadmaps WHERE student_id = ? AND forecast_id = ? ORDER BY version DESC LIMIT 1")
            .get(req.user.id, forecastId);
        const pending = db.prepare("SELECT 1 FROM advising_roadmaps WHERE student_id = ? AND forecast_id = ? AND status = 'offered'")
            .get(req.user.id, forecastId);
        if (pending) return res.status(409).json({ message: "Đang có đề xuất V2 chờ bạn phản hồi. Hãy chọn chấp nhận hoặc từ chối trước." });
        const version = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM advising_roadmaps WHERE student_id = ? AND forecast_id = ?")
            .get(req.user.id, forecastId).version;
        const id = crypto.randomUUID();
        const saveRoadmap = db.transaction(() => {
            if (existing) db.prepare("UPDATE advising_roadmaps SET status = 'archived' WHERE id = ?").run(existing.id);
            db.prepare(`INSERT INTO advising_roadmaps (id, student_id, forecast_id, version, parent_id, status, roadmap_json)
                VALUES (?, ?, ?, ?, ?, 'active', ?)`)
                .run(id, req.user.id, forecastId, version, existing?.id || null, JSON.stringify(roadmap));
        });
        saveRoadmap();
        res.set("Cache-Control", "no-store");
        return res.status(201).json({ roadmapId: id, version, status: "active", roadmap, generationMethod });
    } catch (error) {
        console.error("Roadmap generation failed:", error.name || "Error");
        return res.status(502).json({ message: "Không thể tạo lộ trình hợp lệ. Vui lòng thử lại." });
    }
});

app.post("/api/advising/roadmaps", sameOrigin, requireAdvisingUser, function (req, res) {
    const forecastId = String(req.body?.forecastId || "");
    const ownsForecast = db.prepare("SELECT 1 FROM student_forecasts WHERE id = ? AND user_id = ?")
        .get(forecastId, req.user.id);
    if (!ownsForecast) return res.status(404).json({ message: "Không tìm thấy dự phóng." });
    const roadmap = sanitizeRoadmap(req.body?.roadmap);
    if (!roadmap) return res.status(400).json({ message: "Nội dung lộ trình không hợp lệ." });
    const existing = db.prepare("SELECT id FROM advising_roadmaps WHERE student_id = ? AND forecast_id = ? ORDER BY version DESC LIMIT 1")
        .get(req.user.id, forecastId);
    if (existing) return res.status(409).json({ message: "Lộ trình cho dự phóng này đã được tạo." });
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO advising_roadmaps (id, student_id, forecast_id, version, status, roadmap_json)
        VALUES (?, ?, ?, 1, 'active', ?)`)
        .run(id, req.user.id, forecastId, JSON.stringify(roadmap));
    res.set("Cache-Control", "no-store");
    return res.status(201).json({ roadmapId: id, version: 1, status: "active", roadmap });
});

app.post("/api/advising/roadmaps/:id/revise", sameOrigin, requireAdvisingUser, function (req, res) {
    const parent = db.prepare(`SELECT * FROM advising_roadmaps WHERE id = ? AND student_id = ?
        AND status IN ('active', 'accepted')`).get(req.params.id, req.user.id);
    if (!parent) return res.status(404).json({ message: "Không tìm thấy lộ trình đang áp dụng." });
    const roadmap = sanitizeRoadmap(req.body?.roadmap);
    if (!roadmap) return res.status(400).json({ message: "Nội dung lộ trình không hợp lệ." });
    const version = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM advising_roadmaps WHERE student_id = ? AND forecast_id = ?")
        .get(req.user.id, parent.forecast_id).version;
    const id = crypto.randomUUID();
    const tx = db.transaction(() => {
        db.prepare("UPDATE advising_roadmaps SET status = 'archived' WHERE id = ?").run(parent.id);
        db.prepare(`INSERT INTO advising_roadmaps
            (id, student_id, forecast_id, version, parent_id, status, roadmap_json)
            VALUES (?, ?, ?, ?, ?, 'active', ?)`)
            .run(id, req.user.id, parent.forecast_id, version, parent.id, JSON.stringify(roadmap));
    });
    tx();
    return res.status(201).json({ roadmapId: id, version, status: "active", roadmap });
});

app.get("/api/advising/roadmaps", requireAdvisingUser, function (req, res) {
    const rows = db.prepare(`SELECT id, forecast_id AS forecastId, version, parent_id AS parentId,
        status, roadmap_json, mentor_note AS mentorNote, created_at AS createdAt, reviewed_at AS reviewedAt
        FROM advising_roadmaps WHERE student_id = ? ORDER BY version`).all(req.user.id);
    res.set("Cache-Control", "no-store");
    return res.json({ roadmaps: rows.map(row => ({ ...row, roadmap: JSON.parse(row.roadmap_json) })) });
});

app.post("/api/advising/roadmaps/:id/decision", sameOrigin, requireAdvisingUser, function (req, res) {
    const decision = req.body?.decision;
    if (!["accept", "reject"].includes(decision)) return res.status(400).json({ message: "Lựa chọn không hợp lệ." });
    const proposal = db.prepare("SELECT * FROM advising_roadmaps WHERE id = ? AND student_id = ? AND status = 'offered'")
        .get(req.params.id, req.user.id);
    if (!proposal) return res.status(404).json({ message: "Không tìm thấy đề xuất V2 đang chờ." });
    const tx = db.transaction(() => {
        db.prepare("UPDATE advising_roadmaps SET status = ? WHERE id = ?")
            .run(decision === "accept" ? "accepted" : "rejected", proposal.id);
        if (decision === "accept" && proposal.parent_id) {
            db.prepare("UPDATE advising_roadmaps SET status = 'archived' WHERE id = ? AND student_id = ?")
                .run(proposal.parent_id, req.user.id);
        }
    });
    tx();
    return res.json({ decision, roadmapId: proposal.id });
});

app.get("/api/mentor/queue", requireMentor, function (req, res) {
    const rows = db.prepare(`SELECT u.id AS studentId, u.fullname AS studentName,
        r.id AS roadmapId, r.forecast_id AS forecastId, r.version, r.status,
        EXISTS(SELECT 1 FROM advising_roadmaps pending WHERE pending.student_id = u.id
            AND pending.forecast_id = r.forecast_id AND pending.status = 'offered') AS pendingProposal,
        r.roadmap_json AS roadmap, r.created_at AS createdAt
        FROM mentor_assignments a JOIN users u ON u.id = a.student_id
        JOIN advising_roadmaps r ON r.student_id = u.id
        WHERE a.mentor_id = ? AND r.status IN ('active', 'accepted') AND r.id = (
            SELECT id FROM advising_roadmaps r2 WHERE r2.student_id = u.id
                AND r2.status IN ('active', 'accepted')
            ORDER BY r2.version DESC LIMIT 1
        ) ORDER BY r.created_at DESC`).all(req.user.id);
    res.set("Cache-Control", "no-store");
    return res.json({ students: rows.map(row => ({ ...row, roadmap: JSON.parse(row.roadmap) })) });
});

app.get("/api/mentor/students/:studentId/analysis", requireMentor, function (req, res) {
    const studentId = Number(req.params.studentId);
    const assigned = db.prepare("SELECT 1 FROM mentor_assignments WHERE student_id = ? AND mentor_id = ?")
        .get(studentId, req.user.id);
    if (!assigned) return res.status(404).json({ message: "Sinh viên này chưa được phân công cho bạn." });
    const roadmapForecast = db.prepare(`SELECT forecast_id AS id FROM advising_roadmaps
        WHERE student_id = ? AND status IN ('active', 'accepted', 'offered')
        ORDER BY version DESC LIMIT 1`).get(studentId);
    const forecast = roadmapForecast ? db.prepare(`SELECT id, forecast_json, created_at FROM student_forecasts
        WHERE id = ? AND user_id = ?`).get(roadmapForecast.id, studentId) : null;
    const results = forecast ? db.prepare(`SELECT course_key, result_json FROM advising_test_results
        WHERE user_id = ? AND forecast_id = ?`).all(studentId, forecast.id) : [];
    const roadmaps = db.prepare(`SELECT id, version, status, roadmap_json, mentor_note, created_at
        FROM advising_roadmaps WHERE student_id = ? ORDER BY version`).all(studentId);
    return res.json({
        forecast: forecast ? JSON.parse(forecast.forecast_json) : null,
        analysis: Object.fromEntries(results.map(row => [row.course_key, JSON.parse(row.result_json)])),
        roadmaps: roadmaps.map(row => ({ ...row, roadmap: JSON.parse(row.roadmap_json) }))
    });
});

app.post("/api/mentor/roadmaps/:id/suggest-v2", sameOrigin, limiter, requireMentor, async function (req, res) {
    const parent = db.prepare(`SELECT r.* FROM advising_roadmaps r
        JOIN mentor_assignments a ON a.student_id = r.student_id
        WHERE r.id = ? AND a.mentor_id = ? AND r.status IN ('active', 'accepted')`)
        .get(req.params.id, req.user.id);
    if (!parent) return res.status(404).json({ message: "Không tìm thấy lộ trình được phân công." });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "Backend chưa được cấu hình Gemini." });
    const note = String(req.body?.note || "").trim().slice(0, 2000);
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    try {
        const upstream = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: "Bạn là trợ lý cho mentor. Đề xuất phiên bản V2 dựa trên V1 và ghi chú mentor. Giữ nguyên các dữ kiện kiểm tra, không bịa điểm số hoặc tài liệu URL. Chia đúng số tuần V1, tôn trọng giờ/tuần ghi trong kế hoạch. Chỉ trả JSON hợp lệ có dạng {title,goal,weeks:[{title,subtitle,checkpoint,tasks:[{day,title,detail,duration,priority,resource}]}]}." }] },
                contents: [{ role: "user", parts: [{ text: JSON.stringify({ v1: JSON.parse(parent.roadmap_json), mentorNote: note }) }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 5000 }
            }),
            signal: AbortSignal.timeout(60000)
        });
        if (!upstream.ok) return res.status(502).json({ message: `Gemini chưa tạo được đề xuất V2 (HTTP ${upstream.status}).` });
        const payload = await upstream.json();
        const raw = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
        if (!raw) return res.status(502).json({ message: "Gemini chưa trả về V2." });
        const roadmap = sanitizeRoadmap(JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
        if (!roadmap || roadmap.weeks.length !== JSON.parse(parent.roadmap_json).weeks.length) return res.status(502).json({ message: "V2 chưa đúng cấu trúc hoặc số tuần của V1." });
        return res.json({ roadmap });
    } catch (error) {
        console.error("Mentor V2 suggestion failed:", error.name || "Error");
        return res.status(502).json({ message: "Không thể tạo đề xuất V2. Hãy thử lại." });
    }
});

app.post("/api/mentor/roadmaps/:id/proposal", sameOrigin, requireMentor, function (req, res) {
    const parent = db.prepare(`SELECT r.* FROM advising_roadmaps r
        JOIN mentor_assignments a ON a.student_id = r.student_id
        WHERE r.id = ? AND a.mentor_id = ? AND r.status IN ('active', 'accepted')`)
        .get(req.params.id, req.user.id);
    if (!parent) return res.status(404).json({ message: "Không tìm thấy lộ trình đang áp dụng được phân công." });
    const pending = db.prepare("SELECT 1 FROM advising_roadmaps WHERE student_id = ? AND forecast_id = ? AND status = 'offered'")
        .get(parent.student_id, parent.forecast_id);
    if (pending) return res.status(409).json({ message: "Đã có đề xuất đang chờ sinh viên phản hồi." });
    const roadmap = sanitizeRoadmap(req.body?.roadmap);
    const note = String(req.body?.note || "").trim().slice(0, 2000);
    if (!roadmap || note.length < 5) return res.status(400).json({ message: "Cần lộ trình hợp lệ và nhận xét mentor tối thiểu 5 ký tự." });
    const version = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM advising_roadmaps WHERE student_id = ? AND forecast_id = ?")
        .get(parent.student_id, parent.forecast_id).version;
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO advising_roadmaps
        (id, student_id, forecast_id, version, parent_id, status, roadmap_json, mentor_id, mentor_note)
        VALUES (?, ?, ?, ?, ?, 'offered', ?, ?, ?)`)
        .run(id, parent.student_id, parent.forecast_id, version, parent.id, JSON.stringify(roadmap), req.user.id, note);
    return res.status(201).json({ roadmapId: id, version, status: "offered" });
});

// Dự phóng và phiên tư vấn gắn với req.user.id; user_id từ trình duyệt không được nhận.
app.get("/api/forecasts/latest", requireAdvisingUser, function (req, res) {
    const row = db.prepare(`
        SELECT id, forecast_json, created_at
        FROM student_forecasts WHERE user_id = ?
        ORDER BY created_at DESC, rowid DESC LIMIT 1
    `).get(req.user.id);
    if (!row) return res.json({ forecast: null });
    return res.json({ forecast: { forecastId: row.id, ...JSON.parse(row.forecast_json), savedAt: row.created_at } });
});

app.post("/api/forecasts", sameOrigin, limiter, requireAdvisingUser, function (req, res) {
    const input = req.body || {};
    const numeric = [input.currentGPA, input.targetGPA, input.forecastGPA, input.semesterCredits];
    if (numeric.some(value => !Number.isFinite(Number(value)))
        || Number(input.currentGPA) < 0 || Number(input.currentGPA) > 4
        || Number(input.targetGPA) < 0 || Number(input.targetGPA) > 4
        || Number(input.forecastGPA) < 0 || Number(input.forecastGPA) > 4
        || !Number.isInteger(Number(input.semesterCredits)) || Number(input.semesterCredits) < 1 || Number(input.semesterCredits) > 100
        || !Array.isArray(input.courses) || input.courses.length < 1 || input.courses.length > 30) {
        return res.status(400).json({ message: "Dữ liệu dự phóng không hợp lệ." });
    }
    const courses = input.courses.map(course => ({
        code: String(course?.code || "").trim().slice(0, 24),
        name: String(course?.name || "").trim().slice(0, 160),
        credits: Number(course?.credits),
        referenceScore: Number(course?.referenceScore),
        targetScore: Number(course?.targetScore),
        targetGPA: Number(course?.targetGPA),
        targetLetter: String(course?.targetLetter || "").slice(0, 4)
    }));
    if (courses.some(course => !course.code || !course.name
        || !Number.isInteger(course.credits) || course.credits < 1 || course.credits > 10
        || !Number.isFinite(course.targetScore) || course.targetScore < 0 || course.targetScore > 10
        || !Number.isFinite(course.targetGPA) || course.targetGPA < 0 || course.targetGPA > 4
        || !Number.isFinite(course.referenceScore) || course.referenceScore < 0 || course.referenceScore > 10)
        || new Set(courses.map(course => course.code)).size !== courses.length
        || courses.reduce((sum, course) => sum + course.credits, 0) !== Number(input.semesterCredits)) {
        return res.status(400).json({ message: "Danh sách môn dự phóng không hợp lệ." });
    }
    const forecastId = crypto.randomUUID();
    const forecast = {
        currentGPA: Number(input.currentGPA), targetGPA: Number(input.targetGPA),
        forecastGPA: Number(input.forecastGPA), semesterCredits: Number(input.semesterCredits), courses
    };
    db.prepare("INSERT INTO student_forecasts (id, user_id, forecast_json) VALUES (?, ?, ?)")
        .run(forecastId, req.user.id, JSON.stringify(forecast));
    res.set("Cache-Control", "no-store");
    return res.status(201).json({ forecastId, forecast });
});

app.delete("/api/forecasts", sameOrigin, requireAdvisingUser, function (req, res) {
    db.prepare("DELETE FROM student_forecasts WHERE user_id = ?").run(req.user.id);
    return res.json({ success: true });
});

app.get("/api/advising/session", requireAdvisingUser, function (req, res) {
    const row = db.prepare("SELECT state_json, updated_at FROM advising_sessions WHERE user_id = ?")
        .get(req.user.id);
    res.set("Cache-Control", "no-store");
    return res.json({ state: row ? JSON.parse(row.state_json) : null, updatedAt: row?.updated_at || null });
});

app.put("/api/advising/session", sameOrigin, requireAdvisingUser, function (req, res) {
    const state = req.body?.state;
    if (!state || typeof state !== "object" || Array.isArray(state)) {
        return res.status(400).json({ message: "Phiên tư vấn không hợp lệ." });
    }
    const serialized = JSON.stringify(state);
    if (serialized.length > 120000) return res.status(413).json({ message: "Dữ liệu phiên tư vấn quá lớn." });
    db.prepare(`INSERT INTO advising_sessions (user_id, state_json, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = datetime('now')`)
        .run(req.user.id, serialized);
    res.set("Cache-Control", "no-store");
    return res.json({ saved: true });
});

app.get("/api/progress/roadmap", requireAdvisingUser, function (req, res) {
    const row = db.prepare("SELECT roadmap_json, updated_at FROM student_progress WHERE user_id = ?")
        .get(req.user.id);
    res.set("Cache-Control", "no-store");
    return res.json({ roadmap: row ? JSON.parse(row.roadmap_json) : null, updatedAt: row?.updated_at || null });
});

app.put("/api/progress/roadmap", sameOrigin, requireAdvisingUser, function (req, res) {
    const roadmapId = String(req.body?.roadmapId || "");
    const source = db.prepare(`SELECT roadmap_json FROM advising_roadmaps
        WHERE id = ? AND student_id = ? AND status IN ('active', 'accepted')`).get(roadmapId, req.user.id);
    if (!source) return res.status(403).json({ message: "Chỉ lộ trình V1 hoặc V2 đang áp dụng mới được đồng bộ tiến độ." });
    const canonical = JSON.parse(source.roadmap_json);
    const progressInput = req.body?.progress;
    if (!progressInput || !Array.isArray(progressInput.weeks)) {
        return res.status(400).json({ message: "Dữ liệu tiến độ không hợp lệ." });
    }
    const progressById = new Map(progressInput.weeks.flatMap(week =>
        (Array.isArray(week.tasks) ? week.tasks : []).map(task => [String(task.id), task])
    ));
    const roadmap = {
        version: 1,
        roadmapId,
        title: canonical.title,
        weeks: canonical.weeks.map(week => ({
            title: week.title, subtitle: week.subtitle, duration: "7 ngày",
            tasks: week.tasks.map(task => {
                const progress = progressById.get(task.id);
                const done = Boolean(progress?.done);
                return { id: task.id, text: task.title, done, completedAt: done ? (progress.completedAt || new Date().toISOString()) : null };
            })
        }))
    };
    db.prepare(`INSERT INTO student_progress (user_id, roadmap_json, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET roadmap_json = excluded.roadmap_json, updated_at = datetime('now')`)
        .run(req.user.id, JSON.stringify(roadmap));
    return res.json({ saved: true });
});

app.get("/api/advising/chat/history", requireAdvisingUser, function (req, res) {
    const rows = db.prepare(`SELECT role, message AS text FROM (
        SELECT id, role, message FROM advising_chat_messages WHERE user_id = ?
        ORDER BY id DESC LIMIT 50
    ) ORDER BY id ASC`).all(req.user.id);
    res.set("Cache-Control", "no-store");
    return res.json({ messages: rows });
});

app.delete("/api/advising/chat/history", sameOrigin, requireAdvisingUser, function (req, res) {
    db.prepare("DELETE FROM advising_chat_messages WHERE user_id = ?").run(req.user.id);
    return res.json({ cleared: true });
});

// =====================================
// API TRỢ LÝ TƯ VẤN GEMINI
// POST /api/advising/chat
// API key chỉ được đọc ở backend, không gửi xuống trình duyệt.
// =====================================
app.post("/api/advising/chat", sameOrigin, limiter, async function (req, res) {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ message: "Vui lòng đăng nhập để sử dụng tư vấn AI." });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ message: "Backend chưa được cấu hình GEMINI_API_KEY." });
    }

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question || question.length > 500) {
        return res.status(400).json({ message: "Câu hỏi bắt buộc và tối đa 500 ký tự." });
    }

    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
    const contents = history
        .filter(item => item && ["user", "assistant"].includes(item.role)
            && typeof item.text === "string" && item.text.trim().length > 0
            && item.text.length <= 3000)
        .map(item => ({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.text.trim() }]
        }));
    contents.push({ role: "user", parts: [{ text: question }] });

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    try {
        const upstream = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: "Bạn là trợ lý tư vấn học tập EduTrack. Trả lời bằng tiếng Việt, rõ ràng, thực tế và có cấu trúc. Không khẳng định biết dữ liệu GPA hay hồ sơ của sinh viên nếu dữ liệu đó chưa được cung cấp. Không bịa chính sách hoặc tài liệu của trường; hãy nói rõ khi chưa đủ thông tin. Đưa gợi ý học tập an toàn, có thể thực hiện." }]
                },
                contents,
                generationConfig: { temperature: 0.6, maxOutputTokens: 700 }
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!upstream.ok) {
            console.error("Gemini advising API returned HTTP", upstream.status);
            return res.status(502).json({ message: "Trợ lý AI tạm thời không phản hồi. Vui lòng thử lại." });
        }

        const payload = await upstream.json();
        const reply = payload?.candidates?.[0]?.content?.parts
            ?.map(part => typeof part.text === "string" ? part.text : "")
            .join("").trim();
        if (!reply) {
            return res.status(502).json({ message: "AI chưa tạo được câu trả lời. Vui lòng thử lại." });
        }
        const saveChat = db.prepare("INSERT INTO advising_chat_messages (user_id, role, message) VALUES (?, ?, ?)");
        const saveTurn = db.transaction(() => {
            saveChat.run(req.user.id, "user", question);
            saveChat.run(req.user.id, "assistant", reply.slice(0, 6000));
            db.prepare(`DELETE FROM advising_chat_messages WHERE user_id = ? AND id NOT IN (
                SELECT id FROM advising_chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 50
            )`).run(req.user.id, req.user.id);
        });
        saveTurn();
        res.set("Cache-Control", "no-store");
        return res.json({ reply });
    } catch (error) {
        console.error("Gemini advising request failed:", error.name || "Error");
        return res.status(502).json({ message: "Không kết nối được trợ lý AI. Vui lòng thử lại sau." });
    }
});

// =====================================
// 13. API ĐĂNG XUẤT
// POST /api/auth/logout
// =====================================

app.post(
    "/api/auth/logout",
    sameOrigin,
    function (req, res) {

        req.logout(function (error) {

            if (error) {

                return res.status(500).json({
                    message: "Không thể đăng xuất."
                });
            }

            req.session.destroy(function (destroyError) {

                if (destroyError) {

                    return res.status(500).json({
                        message:
                            "Không thể kết thúc phiên."
                    });
                }

                res.clearCookie("edutrack.sid", {
                    path: "/"
                });

                return res.json({
                    message: "Đã đăng xuất."
                });
            });
        });
    }
);

// =====================================
// FORGOT PASSWORD - CONFIGURATION
// =====================================

const resetTokenLifetime = 15 * 60 * 1000;
const resetCooldown = 10 * 60 * 1000;

const resetSuccessMessage =
    "Nếu email phù hợp với tài khoản EduTrack, bạn sẽ nhận được liên kết đặt lại mật khẩu.";

const smtpPort = Number(
    process.env.SMTP_PORT || 587
);

const smtpConfigured = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM &&
    process.env.APP_BASE_URL
);

const transporter = smtpConfigured
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpPort === 465,
        requireTLS: smtpPort !== 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    })
    : null;

function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

const passwordResetLimiter = rateLimit({

    windowMs: 60 * 60 * 1000,

    limit: 10,

    standardHeaders: "draft-7",

    legacyHeaders: false,

    message: {
        message:
            "Quá nhiều yêu cầu. Vui lòng thử lại sau."
    }
});

// =====================================
// API 1: YÊU CẦU QUÊN MẬT KHẨU
// =====================================

app.post(
    "/api/auth/forgot-password",
    sameOrigin,
    passwordResetLimiter,
    async function (req, res) {

        const email = typeof req.body?.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            email.length > 254 ||
            !emailPattern.test(email)
        ) {

            return res.status(400).json({
                message:
                    "Địa chỉ email không hợp lệ."
            });
        }

        if (!smtpConfigured) {

            return res.status(503).json({
                message:
                    "Dịch vụ gửi email chưa được cấu hình."
            });
        }

        try {

            const user = db.prepare(`
                SELECT id, email
                FROM users
                WHERE email = ?
                AND password_hash IS NOT NULL
            `).get(email);

            // Không cho biết email có tài khoản hay không
            if (!user) {

                return res.json({
                    message: resetSuccessMessage
                });
            }

            const now = Date.now();

            // Hạn chế gửi nhiều email cho cùng tài khoản
            const latest = db.prepare(`
                SELECT created_at
                FROM password_reset_tokens
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            `).get(user.id);

            if (
                latest &&
                now - latest.created_at < resetCooldown
            ) {

                return res.json({
                    message: resetSuccessMessage
                });
            }

            const token = crypto
                .randomBytes(32)
                .toString("hex");

            const tokenHash = hashToken(token);

            const baseUrl = new URL(
                process.env.APP_BASE_URL
            );

            if (
                baseUrl.protocol !== "https:" &&
                !(
                    baseUrl.protocol === "http:" &&
                    baseUrl.hostname === "localhost"
                )
            ) {
                throw new Error(
                    "Cần HTTPS nếu website không chạy trên localhost"
                );
            }

            const resetUrl = new URL(
                "/pages/reset-password.html",
                baseUrl
            );

            resetUrl.searchParams.set("token", token);

            // Xóa token cũ của tài khoản
            db.prepare(`
                DELETE FROM password_reset_tokens
                WHERE user_id = ?
            `).run(user.id);

            db.prepare(`
                INSERT INTO password_reset_tokens (
                    user_id,
                    token_hash,
                    expires_at,
                    created_at
                )
                VALUES (?, ?, ?, ?)
            `).run(
                user.id,
                tokenHash,
                now + resetTokenLifetime,
                now
            );

            try {

                await transporter.sendMail({

                    from: process.env.SMTP_FROM,

                    to: user.email,

                    subject:
                        "EduTrack - Đặt lại mật khẩu",

                    text:
                        "Bạn đã yêu cầu đặt lại mật khẩu EduTrack.\n\n" +
                        "Truy cập liên kết sau:\n" +
                        resetUrl.toString() +
                        "\n\nLiên kết có hiệu lực 15 phút và chỉ dùng một lần.\n" +
                        "Nếu không yêu cầu, bạn có thể bỏ qua email này."
                });

            } catch (mailError) {

                db.prepare(`
                    DELETE FROM password_reset_tokens
                    WHERE token_hash = ?
                `).run(tokenHash);

                console.error(
                    "Send reset email failed:",
                    mailError
                );
            }

        } catch (error) {

            console.error("Forgot password error:", error);
        }

        return res.json({
            message: resetSuccessMessage
        });
    }
);

// =====================================
// API 2: ĐẶT LẠI MẬT KHẨU
// =====================================

app.post(
    "/api/auth/reset-password",
    sameOrigin,
    passwordResetLimiter,
    async function (req, res) {

        try {

            const {
                token,
                password,
                confirmPassword
            } = req.body || {};

            if (
                typeof token !== "string" ||
                !/^[a-f0-9]{64}$/.test(token)
            ) {

                return res.status(400).json({
                    message:
                        "Liên kết đặt lại mật khẩu không hợp lệ."
                });
            }

            if (
                typeof password !== "string" ||
                password.length < 8 ||
                password.length > 64
            ) {

                return res.status(400).json({
                    message:
                        "Mật khẩu phải từ 8 đến 64 ký tự."
                });
            }

            if (password !== confirmPassword) {

                return res.status(400).json({
                    message:
                        "Mật khẩu xác nhận không trùng khớp."
                });
            }

            const tokenHash = hashToken(token);

            // Băm mật khẩu trước khi cập nhật
            const newHash = await bcrypt.hash(
                password,
                12
            );

            // Transaction để token chỉ được sử dụng một lần
            const transaction = db.transaction(function () {

                const record = db.prepare(`
                    SELECT user_id, expires_at
                    FROM password_reset_tokens
                    WHERE token_hash = ?
                `).get(tokenHash);

                if (
                    !record ||
                    record.expires_at <= Date.now()
                ) {
                    return false;
                }

                const updated = db.prepare(`
                    UPDATE users
                    SET password_hash = ?,
                        auth_version = auth_version + 1
                    WHERE id = ?
                    AND password_hash IS NOT NULL
                `).run(
                    newHash,
                    record.user_id
                );

                if (updated.changes !== 1) {
                    return false;
                }

                // Token đã sử dụng sẽ bị xóa
                db.prepare(`
                    DELETE FROM password_reset_tokens
                    WHERE user_id = ?
                `).run(record.user_id);

                return true;
            });

            const success = transaction();

            if (!success) {

                return res.status(400).json({
                    message:
                        "Liên kết đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới."
                });
            }

            return res.json({
                message:
                    "Đặt lại mật khẩu thành công."
            });

        } catch (error) {

            console.error("Reset password error:", error);

            return res.status(500).json({
                message:
                    "Không thể đặt lại mật khẩu. Vui lòng thử lại."
            });
        }
    }
);

// =====================================
// 14. GOOGLE OAUTH - REGISTER / LOGIN
// =====================================

// Tạo địa chỉ trả lỗi theo đúng trang
function googleErrorPage(mode, code) {

    const page = mode === "register"
        ? "/pages/register.html"
        : "/pages/login.html";

    return page + "?error=" +
        encodeURIComponent(code);
}

// Xóa trạng thái OAuth sau khi có lỗi
function finishGoogleWithError(req, res, mode, code) {

    if (req.session) {

        delete req.session.googleAuthMode;

        return req.session.save(function () {

            return res.redirect(
                googleErrorPage(mode, code)
            );
        });
    }

    return res.redirect(
        googleErrorPage(mode, code)
    );
}

// =====================================
// BẮT ĐẦU QUÁ TRÌNH GOOGLE OAUTH
// =====================================

function startGoogleAuth(mode) {

    return function (req, res, next) {

        // Kiểm tra Google OAuth đã được cấu hình
        if (!googleConfigured) {

            return res.redirect(
                googleErrorPage(
                    mode,
                    "google_unavailable"
                )
            );
        }

        // Ghi lại mục đích xác thực
        req.session.googleAuthMode = mode;

        // Lưu session trước khi chuyển đến Google
        req.session.save(function (error) {

            if (error) {

                console.error(
                    "Google session error:",
                    error
                );

                return res.redirect(
                    googleErrorPage(
                        mode,
                        "google_failed"
                    )
                );
            }

            // Chuyển người dùng sang Google
            passport.authenticate(
                "google",
                {
                    scope: ["profile", "email"],

                    // Bảo vệ quá trình OAuth
                    state: true
                }
            )(req, res, next);
        });
    };
}

// =====================================
// ĐĂNG KÝ GOOGLE
// =====================================

app.get(
    "/api/auth/google/register",
    limiter,
    startGoogleAuth("register")
);

// =====================================
// ĐĂNG NHẬP GOOGLE
// =====================================

app.get(
    "/api/auth/google/login",
    limiter,
    startGoogleAuth("login")
);

// Đường dẫn cũ không còn được sử dụng
app.get("/api/auth/google", function (req, res) {

    return res.redirect("/pages/login.html");
});

// =====================================
// 15. GOOGLE OAUTH CALLBACK
// =====================================

app.get(
    "/api/auth/google/callback",
    function (req, res, next) {

        // Xác định trang bắt đầu xác thực
        const mode =
            req.session?.googleAuthMode;

        if (
            mode !== "register" &&
            mode !== "login"
        ) {

            return res.redirect(
                googleErrorPage(
                    "login",
                    "google_failed"
                )
            );
        }

        // Kiểm tra Google đã được cấu hình
        if (!googleConfigured) {

            return finishGoogleWithError(
                req,
                res,
                mode,
                "google_unavailable"
            );
        }

        // Thực hiện xác thực Google
        passport.authenticate(
            "google",

            function (error, user, info) {

                // =====================================
                // 1. LỖI XÁC THỰC
                // =====================================

                if (error) {

                    console.error(
                        "Google callback error:",
                        error
                    );

                    return finishGoogleWithError(
                        req,
                        res,
                        mode,
                        "google_failed"
                    );
                }

                // =====================================
                // 2. GOOGLE TỪ CHỐI ĐĂNG NHẬP
                // =====================================

                if (!user) {

                    const allowedErrors = [
                        "google_failed",
                        "google_conflict",
                        "google_not_registered",
                        "google_already_registered"
                    ];

                    const code =
                        allowedErrors.includes(info?.message)
                            ? info.message
                            : "google_failed";

                    return finishGoogleWithError(
                        req,
                        res,
                        mode,
                        code
                    );
                }

                // =====================================
                // 3. XÁC THỰC THÀNH CÔNG
                // =====================================

                // Tạo session mới để tránh session fixation
                req.session.regenerate(function (sessionError) {

                    if (sessionError) {

                        console.error(
                            "Regenerate session error:",
                            sessionError
                        );

                        return res.redirect(
                            googleErrorPage(
                                mode,
                                "google_failed"
                            )
                        );
                    }

                    // =====================================
                    // 4. TẠO PHIÊN ĐĂNG NHẬP
                    // =====================================

                    req.login(
                        user,
                        function (loginError) {

                            if (loginError) {

                                console.error(
                                    "Google login error:",
                                    loginError
                                );

                                return res.redirect(
                                    googleErrorPage(
                                        mode,
                                        "google_failed"
                                    )
                                );
                            }

                            // =====================================
                            // 5. LƯU SESSION
                            // =====================================

                            req.session.save(function (saveError) {

                                if (saveError) {

                                    console.error(
                                        "Save session error:",
                                        saveError
                                    );

                                    return res.redirect(
                                        googleErrorPage(
                                            mode,
                                            "google_failed"
                                        )
                                    );
                                }

                                // =====================================
                                // 6. CHUYỂN VỀ TRANG CHỦ
                                // =====================================

                                return res.redirect(
                                    "/index.html"
                                );
                            });
                        }
                    );
                });
            }
        )(req, res, next);
    }
);

// =====================================
// 16. PHỤC VỤ FRONTEND
// =====================================

app.get("/", function (req, res) {

    res.redirect("/pages/register.html");
});

app.use(
    "/assets",
    express.static(
        path.join(root, "assets"),
        { dotfiles: "deny" }
    )
);

app.use(
    "/pages",
    express.static(
        path.join(root, "pages"),
        { dotfiles: "deny" }
    )
);

app.get("/index.html", function (req, res) {

    const home = path.join(root, "index.html");

    if (!fs.existsSync(home)) {

        return res.redirect("/pages/register.html");
    }

    res.sendFile(home);
});

// =====================================
// 17. XỬ LÝ LỖI SERVER
// =====================================

app.use(function (error, req, res, next) {

    if (
        error instanceof SyntaxError &&
        "body" in error
    ) {

        return res.status(400).json({
            message: "JSON không hợp lệ."
        });
    }

    console.error(error);

    return res.status(500).json({
        message: "Lỗi máy chủ."
    });
});

// =====================================
// 18. KHỞI ĐỘNG SERVER
// =====================================

app.listen(port, function () {

    console.log(
        `EduTrack running at http://localhost:${port}/pages/register.html`
    );
    console.log(`Mentor: http://localhost:${port}/pages/mentor-dashboard.html`);
});
