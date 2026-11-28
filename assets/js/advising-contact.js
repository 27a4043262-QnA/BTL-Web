/* EDUTRACK | TƯ VẤN GPA CHUYÊN SÂU
 * - Đọc dự phóng, bài làm, lộ trình và quyền mentor qua backend.
 * - Server chấm bài và lưu dữ liệu theo phiên đăng nhập.
 * - Khởi tạo lại khi main.js chuyển trang không reload.
 * - Dùng DOM/textContent khi đưa dữ liệu vào giao diện.
 */
(() => {
    "use strict";

    let currentForecast = null;
    let saveQueue = Promise.resolve();
    let quizTimer = null;
    // Ngưỡng ưu tiên là quy tắc hướng dẫn, không phải chuẩn học thuật.
    const topicLimit = () => state.settings.targetGpa >= 3.5 ? 80 : state.settings.targetGpa < 2.5 ? 60 : 70;

    // Câu hỏi lấy từ backend; đáp án đúng không gửi tới trình duyệt trước khi nộp.
    let BANK = [];

    async function api(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: { ...(options.headers || {}), ...(options.body ? { "Content-Type": "application/json" } : {}) }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Không thể đồng bộ dữ liệu với máy chủ.");
        return payload;
    }
    async function loadRoadmapFromServer(forecastId) {
        const payload = await api("/api/advising/roadmaps");
        const records = (payload.roadmaps || []).filter(item => item.forecastId === forecastId);
        const current = records.filter(item => ["active", "accepted", "offered"].includes(item.status))
            .sort((a, b) => b.version - a.version)[0];
        if (!current) return false;
        state.roadmapId = current.id;
        state.roadmap = current.roadmap.weeks || [];
        state.roadmapGoal = current.roadmap.goal || "";
        state.review = {
            status: current.status,
            revision: current.version,
            reviewer: "",
            note: current.mentorNote || "",
            at: current.reviewedAt || current.createdAt || ""
        };
        state.phase = state.selected.length && state.selected.every(key => state.completed[key]) ? "roadmap" : "quiz";
        return true;
    }
    async function decideRoadmap(decision) {
        if (!state.roadmapId || state.review.status !== "offered") return;
        try {
            await api(`/api/advising/roadmaps/${encodeURIComponent(state.roadmapId)}/decision`, {
                method: "POST", body: JSON.stringify({ decision })
            });
            await loadRoadmapFromServer(state.forecastId);
            persist(); renderRoadmap();
            notice(decision === "accept" ? "Đã chấp nhận V2. V1 vẫn được lưu trong lịch sử." : "Đã từ chối V2. Lộ trình trước tiếp tục được áp dụng.");
        } catch (error) { notice(error.message, true); }
    }
    async function retakeTests() {
        if (!window.confirm("Làm lại sẽ xóa kết quả hiện tại khỏi màn hình. Lịch sử bài nộp vẫn được lưu trên máy chủ. Tiếp tục?")) return;
        try {
            await api("/api/advising/tests/reset", {
                method: "POST", body: JSON.stringify({ forecastId: state.forecastId })
            });
            state.answers = {}; state.completed = {}; state.results = {};
            state.questionIndexes = {};
            state.phase = "quiz";
            state.active = state.selected[0];
            persist(); setPhase("quiz");
        } catch (error) { notice(error.message, true); }
    }
    const byKey = key => BANK.find(item => item.key === key);
    const e = (tag, className = "", text = "") => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== "") el.textContent = String(text);
        return el;
    };
    const fmt = value => Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
    const normalize = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

    function createDefaultState() {
        return {
            version: 1, phase: "quiz", selected: [], active: "", forecastId: "", questionIndexes: {}, deadlines: {},
            settings: { targetGpa: 3.2, hoursPerWeek: 8, weeks: 3, learningStyle: "practice" },
            answers: {}, completed: {}, results: {}, roadmap: [], roadmapGoal: "", editing: false,
            review: { status: "draft", revision: 1, reviewer: "", note: "", at: "" },
            courseMeta: {}, chat: []
        };
    }

    let root = null;
    let state = createDefaultState();
    const $ = selector => root.querySelector(selector);
    const $$ = selector => [...root.querySelectorAll(selector)];

    function persist() {
        const serializable = { ...state, editing: false };
        saveQueue = saveQueue.then(() => api("/api/advising/session", {
            method: "PUT", body: JSON.stringify({ state: serializable })
        })).catch(error => {
            if (root) notice(`${error.message} Tiến trình chưa được lưu.`, true);
        });
        return true;
    }
    function notice(message, isError = false) {
        const node = $("[data-feedback]");
        node.textContent = message;
        node.hidden = !message;
        node.classList.toggle("is-error", isError);
    }
    function setPhase(phase) {
        if (phase !== "quiz" && quizTimer) { clearInterval(quizTimer); quizTimer = null; }
        state.phase = phase;
        $$('[data-view]').forEach(section => section.hidden = section.dataset.view !== phase);
        const order = ["quiz", "result", "roadmap"];
        const index = order.indexOf(phase);
        $$('[data-step]').forEach(item => {
            const itemIndex = order.indexOf(item.dataset.step);
            item.classList.toggle("is-active", itemIndex === index);
            item.classList.toggle("is-done", itemIndex < index);
            if (itemIndex === index) item.setAttribute("aria-current", "step");
            else item.removeAttribute("aria-current");
        });
        notice("");
        persist();
        if (phase === "quiz") renderQuiz();
        if (phase === "result") renderResults();
        if (phase === "roadmap") renderRoadmap();
        root.scrollIntoView({ behavior: "auto", block: "start" });
    }

    function projectionSelection() {
        const projection = currentForecast;
        const raw = projection && Array.isArray(projection.courses) ? projection.courses : [];
        state.forecastId = projection?.forecastId || "";
        if (projection && Number.isFinite(Number(projection.targetGPA))) {
            state.settings.targetGpa = clamp(Number(projection.targetGPA), 0, 4);
        }
        const codes = new Set(raw.map(item => String(item?.code || "").trim().toUpperCase()));
        const matched = BANK.filter(bank => codes.has(String(bank.key).toUpperCase())).map(bank => bank.key);
        const unsupported = raw.filter(item => !codes.has(String(item?.code || "").trim().toUpperCase()));
        const meta = {};
        raw.forEach(item => {
            const key = String(item?.code || "").trim().toUpperCase();
            const credits = Number(item?.credits);
            if (key && Number.isFinite(credits) && credits >= 1 && credits <= 10) meta[key] = { credits };
        });
        return { matched, unsupported, meta };
    }

    function renderSetup() {
        const container = $("[data-course-choices]");
        container.replaceChildren();
        BANK.filter(course => state.selected.includes(course.key)).forEach(course => {
            const label = e("label", "et-deep-course-option");
            const input = e("input");
            input.type = "checkbox";
            input.name = "course";
            input.value = course.key;
            input.checked = state.selected.includes(course.key);
            input.disabled = true; // Môn lấy từ dự phóng; không yêu cầu sinh viên chọn lại.
            const content = e("span");
            content.append(e("strong", "", course.name), e("small", "", course.description));
            label.append(input, content);
            container.append(label);
        });
        const form = $("[data-setup-form]");
        Object.entries(state.settings).forEach(([name, value]) => {
            if (form.elements[name]) form.elements[name].value = value;
        });
    }

    function handleSetup(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const selected = [...form.querySelectorAll('[name="course"]:checked')].map(el => el.value);
        const values = {
            targetGpa: Number(form.elements.targetGpa.value),
            hoursPerWeek: Number(form.elements.hoursPerWeek.value),
            weeks: Number(form.elements.weeks.value),
            learningStyle: form.elements.learningStyle.value
        };
        if (selected.length === 0) return notice("Chưa có môn từ dự phóng GPA. Hãy hoàn thành dự phóng trước để bắt đầu tư vấn.", true);
        if (!form.elements.targetGpa.value.trim() || !Number.isFinite(values.targetGpa) || values.targetGpa < 0 || values.targetGpa > 4) return notice("GPA mục tiêu phải nằm trong khoảng 0 đến 4.", true);
        if (!Number.isInteger(values.hoursPerWeek) || values.hoursPerWeek < 2 || values.hoursPerWeek > 40) return notice("Số giờ học mỗi tuần phải là số nguyên từ 2 đến 40.", true);
        if (!Number.isInteger(values.weeks) || values.weeks < 2 || values.weeks > 8) return notice("Số tuần phải là số nguyên từ 2 đến 8.", true);
        if (!["practice", "reading", "mixed"].includes(values.learningStyle)) return notice("Hãy chọn phương pháp học phù hợp.", true);

        const changed = JSON.stringify(selected) !== JSON.stringify(state.selected) || JSON.stringify(values) !== JSON.stringify(state.settings);
        if (changed) {
            state.answers = {}; state.completed = {}; state.results = {}; state.roadmap = [];
            state.review = { status: "draft", revision: 1, reviewer: "", note: "", at: "" };
        }
        state.selected = selected;
        state.settings = values;
        state.active = selected[0];
        setPhase("quiz");
    }

    function renderQuizTabs() {
        const container = $("[data-quiz-tabs]");
        container.replaceChildren();
        state.selected.forEach(key => {
            const course = byKey(key);
            const btn = e("button", "et-deep-tab", `${state.completed[key] ? "✓ " : ""}${course.name}`);
            btn.type = "button";
            btn.dataset.course = key;
            btn.setAttribute("aria-pressed", String(state.active === key));
            container.append(btn);
        });
        $("[data-quiz-progress]").textContent = `${state.selected.filter(key => state.completed[key]).length}/${state.selected.length} môn đã nộp bài`;
        $('[data-action="show-results"]').disabled = !state.selected.every(key => state.completed[key] === true);
    }

    function renderQuiz() {
        if (!state.selected.includes(state.active)) state.active = state.selected[0];
        const course = byKey(state.active);
        if (!course) return;
        renderQuizTabs();
        const list = $("[data-question-list]");
        list.replaceChildren();
        const saved = state.answers[course.key] || {};
        if (!state.questionIndexes || typeof state.questionIndexes !== "object") state.questionIndexes = {};
        const index = clamp(Number(state.questionIndexes[course.key]) || 0, 0, course.questions.length - 1);
        state.questionIndexes[course.key] = index;
        const q = course.questions[index];
            const field = e("fieldset", "et-deep-question");
            const legend = e("legend", "", `Câu ${index + 1}. ${q.text}`);
            const meta = e("div", "et-deep-question-meta");
            meta.append(e("span", "et-deep-chip", q.topic), e("span", "et-deep-chip", `Trọng số: ${q.weight} điểm`), e("span", "et-deep-chip", q.level));
            field.append(legend, meta);
            q.choices.forEach((choice, i) => {
                const label = e("label", "et-deep-answer");
                const input = e("input");
                input.type = "radio";
                input.name = q.id;
                input.value = String(i);
                input.checked = Number(saved[q.id]) === i && Object.prototype.hasOwnProperty.call(saved, q.id);
                label.append(input, e("span", "", choice));
                field.append(label);
            });
            list.append(field);
        $ ("[data-question-step]").textContent = `Câu ${index + 1}/${course.questions.length} · Đã trả lời ${Object.keys(saved).length}/${course.questions.length}`;
        $('[data-action="previous-question"]').disabled = index === 0;
        $('[data-action="next-question"]').disabled = index >= course.questions.length - 1;
        startQuizTimer(course);
    }

    function startQuizTimer(course) {
        if (quizTimer) clearInterval(quizTimer);
        if (!state.deadlines) state.deadlines = {};
        if (!state.deadlines[course.key]) {
            state.deadlines[course.key] = Date.now() + 12 * 60 * 1000;
            persist();
        }
        const label = $ ("[data-quiz-timer]");
        const tick = () => {
            if (!root?.isConnected) { clearInterval(quizTimer); quizTimer = null; return; }
            const left = Math.max(0, Math.ceil((state.deadlines[course.key] - Date.now()) / 1000));
            label.textContent = `Còn ${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
            label.classList.toggle("is-expired", left === 0);
            if (left === 0) {
                clearInterval(quizTimer); quizTimer = null;
                notice(`Đã hết giờ môn ${course.name}; bài được nộp với các câu đã trả lời.`, true);
                submitActiveQuiz(true);
            }
        };
        tick();
        if (Date.now() < state.deadlines[course.key]) quizTimer = setInterval(tick, 1000);
    }

    function handleQuizChange(event) {
        if (!event.target.matches('input[type="radio"]')) return;
        const key = state.active;
        if (!state.answers[key]) state.answers[key] = {};
        state.answers[key][event.target.name] = Number(event.target.value);
        if (state.completed[key]) {
            state.completed[key] = false;
            delete state.results[key];
            state.roadmap = [];
            state.review = { status: "draft", revision: 1, reviewer: "", note: "", at: "" };
        }
        persist();
        renderQuizTabs();
    }

    async function submitQuiz(event) {
        event.preventDefault();
        submitActiveQuiz(false);
    }

    async function submitActiveQuiz(expired) {
        const course = byKey(state.active);
        const answered = state.answers[state.active] || {};
        const missing = course.questions.filter(q => !Number.isInteger(answered[q.id]));
        if (missing.length && !expired && !window.confirm(`Bạn còn ${missing.length} câu chưa trả lời. Nộp bài với câu trống được tính sai?`)) {
            return notice(`Bạn còn ${missing.length} câu chưa trả lời ở môn ${course.name}.`, true);
        }
        const submitButton = $('[data-quiz-form] [type="submit"]');
        submitButton.disabled = true;
        let graded;
        try {
            graded = await api("/api/advising/tests/submit", {
                method: "POST",
                body: JSON.stringify({ forecastId: state.forecastId, courseKey: state.active, answers: answered })
            });
        } catch (error) {
            submitButton.disabled = false;
            return notice(error.message, true);
        }
        submitButton.disabled = false;
        state.results[state.active] = graded.result;
        state.completed[state.active] = true;
        if (quizTimer) { clearInterval(quizTimer); quizTimer = null; }
        persist();
        renderQuizTabs();
        const next = state.selected.find(k => !state.completed[k]);
        if (next) {
            state.active = next;
            renderQuiz();
            notice(`Đã lưu bài ${course.name}. Tiếp tục môn ${byKey(next).name}.`);
        } else notice("Bạn đã hoàn thành tất cả bài test. Chọn ‘Xem kết quả phân tích’ để tiếp tục.");
    }

    function analyze() {
        return state.selected.map(key => state.results[key]).filter(Boolean);
    }

    function renderResults() {
        const list = $("[data-result-list]");
        list.replaceChildren();
        analyze().forEach(result => {
            const article = e("article", "et-deep-result-course");
            const header = e("div", "et-deep-result-heading");
            header.append(e("h3", "", result.course.name), e("strong", "et-deep-score", `${fmt(result.earned / result.possible * 10)}/10`));
            const forecastCourse = currentForecast?.courses?.find(course => String(course.code).toUpperCase() === String(result.course.key).toUpperCase());
            const projected = Number(forecastCourse?.targetScore);
            const checked = result.earned / result.possible * 10;
            const gap = Number.isFinite(projected) ? checked - projected : null;
            const comparison = gap === null ? "" : ` · Dự phóng ${fmt(projected)}/10 · Chênh lệch bài test ${gap > 0 ? "+" : ""}${fmt(gap)}`;
            article.append(header, e("p", "", `Đúng ${result.correctCount}/${result.course.questions.length} câu · Điểm trọng số ${result.earned}/${result.possible} · ${result.percentage}% · ${forecastCourse?.credits || 0} tín chỉ${comparison}`));
            result.topics.forEach(topic => {
                const row = e("div", `et-deep-topic-row ${topic.percentage < topicLimit() ? "is-weak" : ""}`);
                const bar = e("div", "et-deep-bar");
                const fill = e("span"); fill.style.width = `${topic.percentage}%`;
                bar.append(fill);
                row.append(e("strong", "", topic.name), bar, e("strong", "", `${topic.earned}/${topic.possible} (${topic.percentage}%)`));
                article.append(row);
            });
            const weak = result.topics.filter(t => t.percentage < topicLimit());
            article.append(e("p", "", weak.length ? `Ưu tiên (ngưỡng ${topicLimit()}% theo mục tiêu GPA): ${weak.map(t => t.name).join(", ")}.` : `Chưa có chủ đề dưới ngưỡng ${topicLimit()}%; nên tiếp tục luyện vận dụng và tự kiểm tra.`));
            const details = e("details", "et-deep-review-details");
            details.append(e("summary", "", "Xem lại từng câu: đáp án, trọng số và giải thích"));
            result.course.questions.forEach((q, i) => {
                const chosen = result.answers[q.id];
                const good = chosen === q.correct;
                const block = e("div", "et-deep-review-item");
                block.append(
                    e("strong", "", `Câu ${i + 1}: ${q.topic} · ${good ? "+" + q.weight : "0"}/${q.weight} điểm`),
                    e("p", "", q.text),
                    e("p", "", `Bạn chọn: ${q.choices[chosen] ?? "Chưa chọn"}`),
                    e("p", "", `Đáp án đúng: ${q.choices[q.correct]}`),
                    e("p", "", `Giải thích: ${q.explain}`)
                );
                details.append(block);
            });
            article.append(details);
            list.append(article);
        });
    }

    function invalidateReview() {
        state.review = { status: "draft", revision: (Number(state.review.revision) || 1) + 1, reviewer: "", note: "", at: "" };
    }

    async function buildRoadmap() {
        if (!state.selected.length || !state.selected.every(key => state.completed[key])) {
            return notice("Hãy hoàn thành bài kiểm tra cho tất cả môn trước.", true);
        }
        const button = $('[data-action="build-roadmap"]');
        const hoursPerWeek = Number($('[name="roadmapHoursPerWeek"]').value);
        const weeks = Number($('[name="roadmapWeeks"]').value);
        const learningStyle = $('[name="roadmapLearningStyle"]').value;
        if (!Number.isInteger(hoursPerWeek) || hoursPerWeek < 2 || hoursPerWeek > 40) return notice("Số giờ học mỗi tuần phải từ 2 đến 40.", true);
        if (!Number.isInteger(weeks) || weeks < 2 || weeks > 12) return notice("Thời lượng lộ trình phải từ 2 đến 12 tuần.", true);
        if (!["practice", "reading", "mixed"].includes(learningStyle)) return notice("Chọn cách học phù hợp trước khi tạo lộ trình.", true);
        state.settings = { ...state.settings, hoursPerWeek, weeks, learningStyle };
        button.disabled = true;
        try {
            const generated = await api("/api/advising/roadmaps/generate", {
                method: "POST",
                body: JSON.stringify({
                    forecastId: state.forecastId,
                    settings: {
                        hoursPerWeek: state.settings.hoursPerWeek,
                        weeks: state.settings.weeks,
                        learningStyle: state.settings.learningStyle
                    }
                })
            });
            state.roadmapId = generated.roadmapId;
            state.roadmap = generated.roadmap.weeks;
            state.roadmapGoal = generated.roadmap.goal || "";
            state.review = { status: "active", revision: generated.version, reviewer: "", note: "", at: new Date().toISOString() };
            state.editing = false;
            state.chat = [{ role: "bot", text: "Lộ trình V1 được tạo từ kết quả dự phóng và bài kiểm tra, đã lưu trên máy chủ và có thể sử dụng ngay." }];
            setPhase("roadmap");
            notice(generated.generationMethod === "personalized-fallback"
                ? "Gemini chưa trả cấu trúc hợp lệ; hệ thống đã tạo V1 dự phòng từ điểm test và chủ đề yếu. Lộ trình đã được lưu."
                : "Đã tạo và lưu lộ trình V1 trên máy chủ.");
        } catch (error) {
            notice(error.message, true);
        } finally {
            button.disabled = false;
        }
    }

    function taskTotal() { return state.roadmap.reduce((sum, week) => sum + week.tasks.length, 0); }
    function minutesTotal() { return state.roadmap.reduce((sum, week) => sum + week.tasks.reduce((a, task) => a + task.duration, 0), 0); }
    function renderAssistantChat() {
        const log = $("[data-assistant-log]");
        log.replaceChildren();
        (state.chat || []).slice(-12).forEach(item => {
            log.append(e("p", `et-deep-assistant-message ${item.role === "user" ? "is-user" : "is-bot"}`, item.text));
        });
        log.scrollTop = log.scrollHeight;
    }
    function assistantReply(question) {
        const text = normalize(question);
        const topics = analyze().flatMap(r => r.topics.map(t => ({ ...t, course: r.course.name })))
            .sort((a, b) => a.percentage - b.percentage);
        if (/taisa o|taisao|visao|uutien|yeu|kho/.test(text)) {
            const target = topics[0];
            return `Mình ưu tiên ${target.name} của ${target.course} vì bạn đạt ${target.earned}/${target.possible} điểm trọng số (${target.percentage}%). Bạn nên xem lại câu sai rồi thực hành từ cơ bản đến vận dụng.`;
        }
        if (/nang|thoigian|gio|tuan|lich/.test(text)) {
            const max = Math.max(...state.roadmap.map(w => w.tasks.reduce((s,t)=>s+t.duration,0)))/60;
            return `Bạn khai báo ${state.settings.hoursPerWeek} giờ/tuần; tuần nhiều nhất dự kiến ${fmt(max)} giờ. Nếu quá tải, hãy dùng nút 'Chỉnh sửa lộ trình', giảm hoặc chuyển nhiệm vụ rồi gửi mentor duyệt.`;
        }
        if (/gpa|diem/.test(text)) return `GPA mục tiêu của bạn là ${fmt(state.settings.targetGpa)}/4. Điểm bài test này đánh giá kiến thức mẫu; nó KHÔNG dự báo trực tiếp điểm học phần hay GPA thực tế.`;
        if (/sua|thaydoi|dieuchinh|bosung/.test(text)) return "Bạn có thể nhấn 'Chỉnh sửa lộ trình' để đổi tên, thời lượng, thêm hoặc xóa nhiệm vụ. Nếu thay đổi sau khi được duyệt, phải gửi duyệt lại.";
        return "Mình có thể giải thích: vì sao ưu tiên một chủ đề, thời lượng từng tuần, mối liên hệ với GPA và cách chỉnh sửa kế hoạch. Đây là trợ lý mô phỏng theo quy tắc, không phải AI thật.";
    }
    function onAssistantSubmit(event) {
        event.preventDefault();
        const input = event.currentTarget.elements.question;
        const question = input.value.trim();
        if (!question) return notice("Hãy nhập câu hỏi trước khi gửi.", true);
        if (question.length > 250) return notice("Câu hỏi tối đa 250 ký tự.", true);
        if (!Array.isArray(state.chat)) state.chat = [];
        state.chat.push({ role: "user", text: question }, { role: "bot", text: assistantReply(question) });
        state.chat = state.chat.slice(-12);
        input.value = "";
        persist(); renderAssistantChat(); notice("");
    }

    function renderRoadmapStatus() {
        const status = $("[data-review-status]");
        const { review } = state;
        status.className = "et-deep-status";
        const names = {
            draft: "Bản nháp — chưa lưu vào tài khoản.",
            active: "Lộ trình V1 đã lưu trong tài khoản và có thể bắt đầu.",
            offered: "Mentor đã gửi đề xuất V2. Chọn chấp nhận hoặc từ chối; V1 vẫn được giữ.",
            accepted: "Bạn đang áp dụng V2 đã chấp nhận.",
            rejected: "Bạn đã từ chối V2; lộ trình trước tiếp tục được áp dụng."
        };
        status.replaceChildren(e("span", "", `${names[review.status] || names.draft} Phiên bản ${review.revision || 1}. ${review.note ? `Nhận xét mentor: ${review.note}` : ""}`));
        if (["active", "accepted"].includes(review.status)) status.classList.add("is-approved");
        if (review.status === "offered") {
            status.classList.add("is-pending");
            [["accept-v2", "Chấp nhận V2"], ["reject-v2", "Từ chối V2"]].forEach(([action, label]) => {
                const button = e("button", "et-deep-btn et-deep-btn-outline", label);
                button.type = "button"; button.dataset.action = action;
                status.append(document.createTextNode(" "), button);
            });
        }
        $('[data-action="sync-progress"]').disabled = !["active", "accepted"].includes(review.status) || state.editing || !state.roadmapId;
        $('[data-action="edit-roadmap"]').textContent = state.editing ? "Lưu chỉnh sửa" : "Chỉnh sửa lộ trình";
    }
    function renderRoadmap() {
        if (!state.roadmap.length) return;
        renderAssistantChat();
        const container = $("[data-roadmap-list]");
        container.replaceChildren();
        const { hoursPerWeek, weeks, targetGpa } = state.settings;
        const estimated = (minutesTotal() / 60).toFixed(1);
        const summary = $("[data-roadmap-summary]");
        summary.replaceChildren();
        [`${weeks} tuần`, `${taskTotal()} nhiệm vụ`, `${estimated} giờ dự kiến`, `${hoursPerWeek} giờ/tuần có thể học`, `GPA mục tiêu: ${fmt(targetGpa)}/4`, `Ngưỡng ưu tiên: ${topicLimit()}%`]
            .forEach(s => summary.append(e("span", "", s)));
        const overload = state.roadmap.some(w => w.tasks.reduce((sum, t) => sum + t.duration, 0) > hoursPerWeek * 60);
        $("[data-roadmap-explanation]").textContent = overload
            ? "Khối lượng kế hoạch vượt số giờ ở một số tuần. Hãy dùng ‘Chỉnh sửa lộ trình’ để giảm thời lượng hoặc điều chỉnh phân bổ trước khi gửi duyệt."
            : (state.roadmapGoal || "Chủ đề yếu được ưu tiên trước, thời lượng dự kiến không vượt giới hạn đã nhập. Mở từng tuần để xem nhiệm vụ và hướng dẫn ngay tại đây.");
        state.roadmap.forEach((week, wi) => {
            const details = e("details", "et-deep-week");
            if (wi === 0 || state.editing) details.open = true;
            details.append(e("summary", "", `${week.title} · ${week.subtitle} · ${fmt(week.tasks.reduce((s,t)=>s+t.duration,0)/60)} giờ`));
            const body = e("div", "et-deep-week-body");
            body.append(e("p", "et-deep-week-desc", week.checkpoint || "Mốc đánh giá: hoàn thành các nhiệm vụ và tự kiểm tra kiến thức trong tuần."));
            const list = e("ol", "et-deep-tasks");
            week.tasks.forEach((task, ti) => {
                const row = e("li", "et-deep-task");
                row.append(e("span", "et-deep-task-number", ti + 1));
                if (state.editing) {
                    const editor = e("div", "et-deep-edit-row");
                    const input = e("input", "et-deep-edit-input");
                    input.type = "text"; input.maxLength = 180; input.value = task.title;
                    input.dataset.editTitle = task.id; input.setAttribute("aria-label", `Tên nhiệm vụ ${ti + 1}, ${week.title}`);
                    const duration = e("input", "et-deep-edit-input");
                    duration.type = "number"; duration.min = "15"; duration.max = "360"; duration.step = "5"; duration.value = task.duration;
                    duration.dataset.editMinutes = task.id; duration.setAttribute("aria-label", `Số phút nhiệm vụ ${ti + 1}, ${week.title}`);
                    const del = e("button", "", "Xóa nhiệm vụ");
                    del.type = "button"; del.dataset.action = "delete-task"; del.dataset.taskId = task.id;
                    const select = e("select", "et-deep-edit-input");
                    select.dataset.editWeek = task.id;
                    select.setAttribute("aria-label", `Chuyển nhiệm vụ ${ti + 1} sang tuần`);
                    state.roadmap.forEach((destination, target) => {
                        const option = e("option", "", destination.title);
                        option.value = String(target); option.selected = wi === target;
                        select.append(option);
                    });
                    const detail = e("textarea", "et-deep-edit-input et-deep-edit-detail");
                    detail.maxLength = 500;
                    detail.rows = 2;
                    detail.value = task.detail;
                    detail.dataset.editDetail = task.id;
                    detail.setAttribute("aria-label", `Hướng dẫn chi tiết nhiệm vụ ${ti + 1}, ${week.title}`);
                    editor.append(input, duration, select, del, detail);
                    row.append(editor);
                } else {
                    const text = e("div", "et-deep-task-content");
                    text.append(e("strong", "", `${task.day ? task.day + " · " : ""}${task.title}`), e("p", "", task.detail), e("small", "", `${task.duration} phút · ${task.priority}${task.resource ? ` · Tài liệu: ${task.resource}` : ""}`));
                    row.append(text);
                }
                list.append(row);
            });
            body.append(list);
            if (state.editing) {
                const controls = e("div", "et-deep-edit-controls");
                const add = e("button", "et-deep-btn et-deep-btn-outline", "+ Thêm nhiệm vụ");
                add.type = "button"; add.dataset.action = "add-task"; add.dataset.week = String(wi);
                controls.append(add); body.append(controls);
            }
            details.append(body); container.append(details);
        });
        renderRoadmapStatus();
    }

    function collectEdits() {
        if (!state.editing) return true;
        const moves = [];
        for (let wi = 0; wi < state.roadmap.length; wi++) {
            const week = state.roadmap[wi];
            for (const task of week.tasks) {
                const titleInput = [...$$('[data-edit-title]')].find(el => el.dataset.editTitle === task.id);
                const minuteInput = [...$$('[data-edit-minutes]')].find(el => el.dataset.editMinutes === task.id);
                const weekInput = [...$$('[data-edit-week]')].find(el => el.dataset.editWeek === task.id);
                const detailInput = [...$$('[data-edit-detail]')].find(el => el.dataset.editDetail === task.id);
                if (!titleInput || !minuteInput || !weekInput || !detailInput) continue;
                const title = titleInput.value.trim();
                const detail = detailInput.value.trim();
                const duration = Number(minuteInput.value);
                const destination = Number(weekInput.value);
                if (!title || title.length > 180 || !Number.isInteger(duration) || duration < 15 || duration > 360 || !detail || detail.length > 500 || !Number.isInteger(destination) || destination < 0 || destination >= state.roadmap.length) {
                    notice("Kiểm tra tên nhiệm vụ, hướng dẫn chi tiết (bắt buộc), số phút (15–360) và tuần học.", true);
                    (title ? detail ? minuteInput : detailInput : titleInput).focus();
                    return false;
                }
                task.title = title;
                task.detail = detail;
                task.duration = duration;
                if (destination !== wi) moves.push({ task, original: wi, destination });
            }
        }
        moves.forEach(({ task, original, destination }) => {
            state.roadmap[original].tasks = state.roadmap[original].tasks.filter(t => t.id !== task.id);
            state.roadmap[destination].tasks.push(task);
        });
        return true;
    }
    async function saveEdit() {
        if (!collectEdits()) return false;
        if (!state.roadmap.some(w => w.tasks.length)) return notice("Lộ trình cần có ít nhất một nhiệm vụ.", true), false;
        state.editing = false;
        if (state.roadmapId) {
            try {
                const revised = await api(`/api/advising/roadmaps/${encodeURIComponent(state.roadmapId)}/revise`, {
                    method: "POST",
                    body: JSON.stringify({ roadmap: { title: "Lộ trình cá nhân hóa", weeks: state.roadmap } })
                });
                state.roadmapId = revised.roadmapId;
                state.review = { status: "active", revision: revised.version, reviewer: "", note: "", at: new Date().toISOString() };
            } catch (error) {
                state.editing = true;
                renderRoadmap();
                notice(`${error.message} Chỉnh sửa chưa được lưu.`, true);
                return false;
            }
        } else invalidateReview();
        persist(); renderRoadmap();
        notice("Đã lưu chỉnh sửa thành một phiên bản mới trên máy chủ.");
        return true;
    }
    async function syncProgress() {
        if (!(["active", "accepted"].includes(state.review.status)) || state.editing || !state.roadmapId) return notice("Hãy lưu/chọn lộ trình đang áp dụng trước khi đồng bộ.", true);
        let existing;
        try { existing = await api("/api/progress/roadmap"); }
        catch (error) { return notice(error.message, true); }
        if (existing.roadmap && !window.confirm("Trang Tiến độ đang có lộ trình lưu trước đó. Bạn muốn thay thế bằng lộ trình vừa duyệt chứ?")) return;
        const data = {
            weeks: state.roadmap.map(week => ({
                title: week.title,
                subtitle: week.subtitle,
                duration: "7 ngày",
                tasks: week.tasks.map(task => ({ id: task.id, text: task.title, done: false, completedAt: null }))
            }))
        };
        try {
            await api("/api/progress/roadmap", { method: "PUT", body: JSON.stringify({ roadmapId: state.roadmapId, progress: data }) });
        } catch (error) { return notice(error.message, true); }
        notice("Đã đồng bộ lộ trình vào Tiến độ trên máy chủ.");
        const feedback = $("[data-feedback]");
        const link = e("a", "et-deep-btn et-deep-btn-outline", "Xem Tiến độ học tập →");
        link.href = "progress.html";
        link.setAttribute("data-et-no-spa", "");
        feedback.append(document.createTextNode(" "), link);
    }

    function onAction(event) {
        const trigger = event.target.closest("[data-action]");
        if (!trigger || !root.contains(trigger)) return;
        const action = trigger.dataset.action;

        const previousSteps = {
            "go-quiz": "quiz",
            "go-result": "result"
        };

        if (Object.hasOwn(previousSteps, action)) {
            if (state.editing) {
                notice(
                    "Hãy lưu chỉnh sửa lộ trình trước khi chuyển bước.",
                    true
                );
                return;
            }

            setPhase(previousSteps[action]);

            if (action === "go-quiz") {
                notice(
                    "Bạn có thể xem lại đáp án. " +
                    "Nếu thay đổi đáp án đã nộp, " +
                    "lộ trình cũ sẽ bị xóa để tạo lại."
                );
            }

            return;
        }

        if (action === "return-roadmap") {
            if (!state.roadmap.length) {
                notice("Chưa có lộ trình để quay lại.", true);
                return;
            }

            setPhase("roadmap");
            return;
        }

        if (action === "previous-question" || action === "next-question") {
            const course = byKey(state.active);
            if (!state.questionIndexes || typeof state.questionIndexes !== "object") state.questionIndexes = {};
            const currentIndex = Number(state.questionIndexes[course.key]) || 0;
            state.questionIndexes[course.key] = clamp(currentIndex + (action === "next-question" ? 1 : -1), 0, course.questions.length - 1);
            persist(); renderQuiz(); return;
        }
        if (action === "show-results") { if (state.selected.every(key => state.completed[key])) setPhase("result"); }
        if (action === "retake") {
            retakeTests();
        }
        if (action === "build-roadmap") buildRoadmap();
        if (action === "edit-roadmap") {
            if (state.editing) saveEdit();
            else { state.editing = true; renderRoadmap(); notice("Bạn có thể sửa tên và số phút từng nhiệm vụ, thêm hoặc xóa nhiệm vụ. Nhấn ‘Lưu chỉnh sửa’ khi xong."); }
        }
        if (action === "save-draft") {
            if (state.editing) saveEdit();
            else notice(persist() ? "Đã lưu bản nháp vào tài khoản trên máy chủ." : "Không thể lưu bản nháp.", false);
        }
        if (action === "add-task") {
            if (!collectEdits()) return;
            const week = state.roadmap[Number(trigger.dataset.week)];
            if (!week) return;
            week.tasks.push({ id: `ad-custom-${Date.now()}-${Math.floor(Math.random()*10000)}`, title: "Nhiệm vụ bổ sung", duration: 45, detail: "Nội dung do sinh viên bổ sung để mentor xem xét.", priority: "Tự điều chỉnh", done: false });
            renderRoadmap();
        }
        if (action === "delete-task") {
            if (!collectEdits()) return;
            state.roadmap.forEach(w => { w.tasks = w.tasks.filter(t => t.id !== trigger.dataset.taskId); });
            renderRoadmap();
        }
        if (action === "accept-v2") decideRoadmap("accept");
        if (action === "reject-v2") decideRoadmap("reject");
        if (action === "sync-progress") syncProgress();
    }

    async function init() {
        const found = document.querySelector("[data-advising-deep]");
        if (!found || found.dataset.deepInitialized === "1") return;
        root = found;
        root.dataset.deepInitialized = "1";
        let serverState;
        let generatedCount = 0;
        try {
            const [session, forecastResponse, bankResponse] = await Promise.all([
                api("/api/advising/session"),
                api("/api/forecasts/latest"),
                api("/api/advising/question-bank")
            ]);
            serverState = session.state;
            currentForecast = forecastResponse.forecast;
            BANK = Array.isArray(bankResponse.courses) ? bankResponse.courses : [];
            generatedCount = Number(bankResponse.generatedCount) || 0;
        if (!currentForecast || !currentForecast.forecastId) {
            const empty = $("[data-no-forecast]");
            if (empty) empty.hidden = false;
            const quiz = $("[data-view='quiz']");
            if (quiz) quiz.hidden = true;
            return;
        }
        } catch (error) {
            notice(error.message || "Không tải được dữ liệu tư vấn. Hãy tải lại trang sau.", true);
            return;
        }
        const urlParams = new URLSearchParams(location.search);
        let old = urlParams.get("reset") === "1" ? null : serverState;
        // Lần dự phóng mới mở phiên bài làm mới, dữ liệu cũ vẫn nằm trên server.
        if (old && currentForecast && old.forecastId !== currentForecast.forecastId) old = null;
        state = old && old.version === 1 && Array.isArray(old.selected) && old.selected.length && old.selected.every(byKey)
            ? { ...createDefaultState(), ...old, editing: false }
            : createDefaultState();
        if (!Array.isArray(state.roadmap)) state.roadmap = [];
        if (!state.review || !state.review.status) state.review = createDefaultState().review;
        if (!state.answers || typeof state.answers !== "object") state.answers = {};
        if (!state.completed || typeof state.completed !== "object") state.completed = {};
        state.results = {};
        if (!state.settings || typeof state.settings !== "object") state.settings = createDefaultState().settings;
        if (!Array.isArray(state.chat)) state.chat = [];
        state.roadmapId = "";
        state.review = createDefaultState().review;
        state.roadmap = [];

        if (currentForecast?.forecastId) {
            try {
                const canonical = await api(`/api/advising/tests/results?forecastId=${encodeURIComponent(currentForecast.forecastId)}`);
                state.results = canonical.results || {};
                state.completed = Object.fromEntries(Object.keys(state.results).map(key => [key, true]));
                for (const [key, result] of Object.entries(state.results)) state.answers[key] = result.answers || {};
            } catch (error) {
                notice(error.message, true);
            }
            try { await loadRoadmapFromServer(currentForecast.forecastId); }
            catch (error) { notice(error.message, true); }
        }

        // Mọi môn trong dự phóng đều được đưa vào bài test; backend ghép hoặc tạo bộ câu hỏi theo mã môn.
        const fromProjection = projectionSelection();
        state.selected = fromProjection.matched;
        state.courseMeta = fromProjection.meta;
        if (!state.selected.includes(state.active)) state.active = state.selected[0] || "";
        if (state.settings.weeks < 2 || state.settings.weeks > 12) state.settings.weeks = 3;
        if (state.settings.hoursPerWeek < 2 || state.settings.hoursPerWeek > 40) state.settings.hoursPerWeek = 8;
        $('[name="roadmapHoursPerWeek"]').value = state.settings.hoursPerWeek;
        $('[name="roadmapWeeks"]').value = state.settings.weeks;
        $('[name="roadmapLearningStyle"]').value = state.settings.learningStyle;
        if (generatedCount) notice(`${generatedCount} bộ câu hỏi được Gemini tạo theo tên môn trong dự phóng. Đây là bài chẩn đoán tham khảo, không phải đề cương chính thức.`);
        if (!state.selected.length) {
            notice("Dự phóng chưa có môn học để kiểm tra. Hãy quay lại trang Dự phóng GPA.", true);
            return;
        }
        if (state.selected.length && state.selected.every(key => state.completed[key])) {
            state.phase = state.roadmapId ? "roadmap" : "result";
        }
        $("[data-quiz-form]").addEventListener("submit", submitQuiz);
        $("[data-quiz-form]").addEventListener("change", handleQuizChange);
        $("[data-quiz-tabs]").addEventListener("click", event => {
            const tab = event.target.closest("[data-course]");
            if (!tab) return;
            state.active = tab.dataset.course; persist(); renderQuiz(); notice("");
        });
        root.addEventListener("click", onAction);
        $("[data-assistant-form]").addEventListener("submit", onAssistantSubmit);
        const valid = ["quiz", "result", "roadmap"];
        if (!valid.includes(state.phase)) state.phase = "quiz";
        if (state.phase === "roadmap" && !state.roadmap.length) state.phase = "quiz";
        if (["result", "roadmap"].includes(state.phase) && !state.selected.every(key => state.completed[key])) state.phase = "quiz";
        setPhase(state.phase);
        if (generatedCount) notice(`${generatedCount} bộ câu hỏi được Gemini tạo theo tên môn trong dự phóng. Đây là bài chẩn đoán tham khảo, không phải đề cương chính thức.`);
    }

    document.addEventListener("edutrack:page-loaded", init);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
