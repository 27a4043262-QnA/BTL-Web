
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

// =====================================
// 1. KHỞI TẠO EXPRESS
// =====================================

const app = express();

const root = path.resolve(__dirname, "..");

const courseDetailsPath = path.join(root, "assets", "data", "course-details.json");

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
        limit: "16kb"
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

        phone: user.phone
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
// API LƯU KẾT QUẢ HỌC TẬP
// =====================================

const learningRoutes = require("./routes/learning.routes");

app.use(
    "/api/learning",
    learningRoutes(db, sameOrigin)
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

const server = app.listen(port, function () {

    console.log("====================================");
    console.log("EduTrack Server đã khởi động!");
    console.log("PID:", process.pid);
    console.log(`Trang chủ: http://localhost:${port}/index.html`);
    console.log(`Đăng ký: http://localhost:${port}/pages/register.html`);
    console.log(`Đăng nhập: http://localhost:${port}/pages/login.html`);
    console.log("====================================");

});

server.on("error", function (error) {

    if (error.code === "EADDRINUSE") {

        console.error(`Cổng ${port} đang được sử dụng.`);
        console.error("Hãy tắt server cũ trước khi khởi động lại.");

    } else {

        console.error("Lỗi khởi động server:", error);

    }

    process.exit(1);

});