
"use strict";

const express = require("express");

module.exports = function (db, sameOrigin) {

    const router = express.Router();

    // 1. Tạo bảng lưu kết quả học tập
    db.exec(`
        CREATE TABLE IF NOT EXISTS learning_results (
            user_id INTEGER NOT NULL,

            kind TEXT NOT NULL
                CHECK (kind IN ('gpa', 'projection')),

            input_json TEXT NOT NULL,

            result_json TEXT NOT NULL,

            updated_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            PRIMARY KEY (user_id, kind),

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );
    `);

    // 2. Kiểm tra người dùng đã đăng nhập
    function requireLogin(req, res, next) {
        if (!req.isAuthenticated() || !req.user) {
            return res.status(401).json({
                message: "Vui lòng đăng nhập để lưu hoặc xem kết quả."
            });
        }

        res.set("Cache-Control", "no-store");
        next();
    }

    // 3. Kiểm tra loại kết quả
    function validKind(kind) {
        return ["gpa", "projection"].includes(kind);
    }

    function isObject(value) {
        return value !== null &&
            typeof value === "object" &&
            !Array.isArray(value);
    }

    function inRange(value, min, max) {
        return Number.isFinite(value) &&
            value >= min &&
            value <= max;
    }

    // 4. Kiểm tra cấu trúc dữ liệu trước khi lưu
    function validSnapshot(kind, input, result) {
        if (!isObject(input) || !isObject(result)) {
            return false;
        }

        if (
            !Array.isArray(input.courses) ||
            input.courses.length === 0 ||
            input.courses.length > 50
        ) {
            return false;
        }

        if (!input.courses.every(course =>
            isObject(course) &&
            typeof course.code === "string" &&
            course.code.length > 0 &&
            typeof course.name === "string" &&
            Number.isInteger(course.credits) &&
            inRange(course.credits, 1, 10)
        )) {
            return false;
        }
        // Không cho phép lưu danh sách môn học trùng mã
        const courseCodes = input.courses.map(course =>
            course.code.trim().toUpperCase()
        );

        if (
            courseCodes.some(code => !code) ||
            new Set(courseCodes).size !== courseCodes.length
        ) {
            return false;
        }
        if (kind === "gpa") {
            return input.courses.every(course =>
                Array.isArray(course.scores) &&
                course.scores.length === 4 &&
                course.scores.every(score =>
                    inRange(score, 0, 10)
                )
            ) &&
            inRange(result.average4, 0, 4) &&
            inRange(result.average10, 0, 10) &&
            Array.isArray(result.results) &&
            result.results.length === input.courses.length &&
            result.results.every(isObject);
        }

        return inRange(input.currentGPA, 0, 4) &&
            inRange(input.targetGPA, 0, 4) &&
            Number.isSafeInteger(input.earnedCredits) &&
            input.earnedCredits >= 0 &&
            Number.isSafeInteger(input.semesterCredits) &&
            input.semesterCredits > 0 &&
            result.feasible === true &&
            inRange(result.forecastGPA, 0, 4.00000001) &&
            inRange(result.semesterGPA, 0, 4.00000001) &&
            Array.isArray(result.courses) &&
            result.courses.length === input.courses.length &&
            result.courses.every(isObject);
    }

    // 5. API lưu kết quả
    router.put(
        "/:kind",
        requireLogin,
        sameOrigin,
        function (req, res) {

            const kind = req.params.kind;
            const { input, result } = req.body || {};

            if (
                !validKind(kind) ||
                !validSnapshot(kind, input, result)
            ) {
                return res.status(400).json({
                    message: "Dữ liệu kết quả không hợp lệ."
                });
            }

            const userId = req.user.id;

            db.prepare(`
                INSERT INTO learning_results (
                    user_id,
                    kind,
                    input_json,
                    result_json
                )
                VALUES (?, ?, ?, ?)

                ON CONFLICT(user_id, kind)
                DO UPDATE SET
                    input_json = excluded.input_json,
                    result_json = excluded.result_json,
                    updated_at = CURRENT_TIMESTAMP
            `).run(
                userId,
                kind,
                JSON.stringify(input),
                JSON.stringify(result)
            );

            res.json({
                success: true,
                message: "Đã lưu kết quả học tập."
            });
        }
    );

    // 6. API đọc kết quả đã lưu
    router.get(
        "/:kind",
        requireLogin,
        function (req, res) {

            const kind = req.params.kind;

            if (!validKind(kind)) {
                return res.status(400).json({
                    message: "Loại kết quả không hợp lệ."
                });
            }

            const row = db.prepare(`
                SELECT
                    input_json,
                    result_json,
                    updated_at
                FROM learning_results
                WHERE user_id = ?
                    AND kind = ?
            `).get(req.user.id, kind);

            if (!row) {
                return res.json({
                    record: null
                });
            }

            res.json({
                record: {
                    input: JSON.parse(row.input_json),
                    result: JSON.parse(row.result_json),
                    updatedAt: row.updated_at
                }
            });
        }
    );

// 7. API xóa kết quả học tập đã lưu
router.delete(
    "/:kind",
    requireLogin,
    sameOrigin,
    function (req, res) {

        const kind = req.params.kind;

        if (!validKind(kind)) {
            return res.status(400).json({
                message: "Loại kết quả không hợp lệ."
            });
        }

        db.prepare(`
            DELETE FROM learning_results
            WHERE user_id = ?
                AND kind = ?
        `).run(req.user.id, kind);

        return res.json({
            success: true
        });
    }
);

    return router;
};
