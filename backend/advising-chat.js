"use strict";

const express = require("express");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Bạn gửi quá nhiều câu hỏi. Hãy thử lại sau ít phút." }
});

function sameOrigin(req, res, next) {
    const origin = req.get("origin");
    if (!origin) return res.status(403).json({ message: "Thiếu Origin của yêu cầu." });
    try {
        if (new URL(origin).origin === `${req.protocol}://${req.get("host")}`) return next();
    } catch (_) { /* origin không hợp lệ */ }
    return res.status(403).json({ message: "Yêu cầu không cùng nguồn." });
}

router.post("/chat", sameOrigin, limiter, async function (req, res) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: "Hãy đăng nhập để sử dụng Tư vấn." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "Chưa cấu hình GEMINI_API_KEY trong .env." });

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question || question.length > 500) {
        return res.status(400).json({ message: "Câu hỏi bắt buộc và tối đa 500 ký tự." });
    }

    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
        .slice(-8)
        .filter(item => item && ["user", "assistant"].includes(item.role)
            && typeof item.text === "string" && item.text.trim() && item.text.length <= 1500)
        .map(item => ({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.text.trim() }]
        }));
    history.push({ role: "user", parts: [{ text: question }] });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
                    parts: [{ text: "Bạn là trợ lý tư vấn học tập của EduTrack. Trả lời bằng tiếng Việt, rõ ràng và thực tế. Không khẳng định biết GPA, hồ sơ hoặc quy định riêng của trường nếu người dùng chưa cung cấp. Khi thiếu thông tin, hãy hỏi lại hoặc nêu rõ giả định. Đưa gợi ý học tập thành các bước dễ làm." }]
                },
                contents: history,
                generationConfig: { temperature: 0.6, maxOutputTokens: 700 }
            }),
            signal: AbortSignal.timeout(90000)
        });

        if (!upstream.ok) {
            console.error("Gemini advising API returned HTTP", upstream.status);
            return res.status(502).json({ message: "Gemini chưa phản hồi được. Hãy thử lại." });
        }
        const payload = await upstream.json();
        const reply = payload?.candidates?.[0]?.content?.parts
            ?.map(part => typeof part.text === "string" ? part.text : "")
            .join("").trim();
        if (!reply) return res.status(502).json({ message: "Gemini chưa tạo được câu trả lời." });

        res.set("Cache-Control", "no-store");
        return res.json({ reply });
    } catch (error) {
        console.error("Gemini advising request failed:", error.name || "Error");
        return res.status(502).json({ message: "Không kết nối được Gemini. Hãy thử lại sau." });
    }
});

module.exports = router;
