/* ===========================================================
   EDUTRACK - TƯ VẤN CHAT (BẢN DEMO KHÔNG CẦN DỮ LIỆU THẬT)
   - Có 4 chủ đề và tư vấn theo kịch bản.
   - Có validation, Enter/Shift+Enter, lịch sử localStorage.
   - Chạy được khi mở HTML trực tiếp hoặc khi main.js đổi trang.
   - Công cụ/chức năng liên quan chỉ xuất hiện khi có ngữ cảnh phù hợp.
   - Không đọc/ghi dữ liệu GPA, môn học, tiến độ của nhóm khác.
=========================================================== */
(() => {
    "use strict";

    const STORAGE_KEY = "edutrack-advising-chat-demo-v1";
    const MAX_LENGTH = 500;
    const MAX_HISTORY = 50;

    const TOPICS = {
        subject: "Mình đang gặp khó khăn với một môn học, bạn có thể tư vấn không?",
        plan: "Mình muốn lập kế hoạch học tập, bạn giúp mình nhé.",
        gpa: "Mình muốn cải thiện GPA thì nên bắt đầu từ đâu?",
        method: "Bạn gợi ý cho mình một phương pháp học hiệu quả được không?",
        exam: "Mình sắp thi, nên chuẩn bị và ôn tập như thế nào?"
    };

    // Chỉ cho phép các đường dẫn được xác định sẵn, không lấy URL từ người dùng.
    const LINKS = {
        courses: { href: "courses.html", label: "Xem trang Môn học →" },
        gpa: { href: "gpa-calculator.html", label: "Mở công cụ GPA →" },
        progress: { href: "progress.html", label: "Xem trang Tiến độ →" }
    };

    const DEMO_PLAN =
        "Đây là LỘ TRÌNH MẪU 3 TUẦN (chưa cá nhân hóa):\n\n" +
        "• Tuần 1: Xác định 3 chủ đề chưa vững, ôn lý thuyết 30 phút/ngày.\n" +
        "• Tuần 2: Luyện bài tập 45 phút/ngày, ghi lại lỗi sai thường gặp.\n" +
        "• Tuần 3: Làm đề thử, chữa lỗi sai và hệ thống lại kiến thức.\n\n" +
        "Để lập kế hoạch phù hợp hơn, bạn hãy cho biết môn học, ngày thi và thời gian rảnh mỗi ngày.";

    function normalize(text) {
        return text.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d");
    }

    function getReply(question, topic = "") {
        const text = normalize(question);

        if (topic === "gpa" || /\bgpa\b|diem trung binh|du phong/.test(text)) {
            return {
                text: "Để cải thiện GPA, bạn nên:\n" +
                    "1. Xác định GPA hiện tại và GPA mục tiêu.\n" +
                    "2. Ưu tiên các môn có nhiều tín chỉ và còn khả năng cải thiện điểm.\n" +
                    "3. Lên lịch ôn tập theo thời gian trước kỳ thi.\n\n" +
                    "EduTrack có công cụ tính/dự phóng GPA. Khi phần dữ liệu của nhóm hoàn thiện, trang Tư vấn có thể dùng kết quả đó để đưa gợi ý cụ thể hơn.",
                link: "gpa"
            };
        }

        if (topic === "subject" || /mon hoc|co so du lieu|lap trinh|khong hieu|hoc yeu/.test(text)) {
            return {
                text: "Mình có thể giúp bạn tìm hướng học. Trước tiên hãy trả lời 3 câu:\n" +
                    "1. Bạn đang học môn nào?\n" +
                    "2. Chủ đề hoặc dạng bài nào khiến bạn thấy khó nhất?\n" +
                    "3. Bạn còn bao lâu trước bài kiểm tra?\n\n" +
                    "Gợi ý ban đầu: chia môn học thành các chủ đề nhỏ, học lại phần nền tảng rồi luyện bài từ dễ đến khó.",
                link: "courses"
            };
        }

        if (topic === "plan" || /ke hoach|lo trinh|lich hoc|thoi gian/.test(text)) {
            return {
                text: "Để lên lịch học hợp lý, bạn hãy cho mình biết: môn cần ôn, số ngày còn lại và số giờ rảnh mỗi ngày.\n\n" +
                    "Bạn có thể bấm “Xem lộ trình 3 tuần mẫu” ngay dưới tin nhắn này để tham khảo. Lộ trình mẫu chưa được đồng bộ sang Tiến độ.",
                link: "progress",
                action: "sample-plan"
            };
        }

        if (topic === "exam" || /thi|kiem tra|on tap|de cuong/.test(text)) {
            return {
                text: "Nếu sắp thi, bạn có thể thử cách ôn tập sau:\n" +
                    "1. Tổng hợp đề cương và đánh dấu phần chưa chắc.\n" +
                    "2. Ôn lý thuyết bằng câu hỏi tự kiểm tra.\n" +
                    "3. Làm đề có giới hạn thời gian và chữa lỗi sai.\n" +
                    "4. Dành buổi cuối để ôn ngắn, tránh học dồn.\n\n" +
                    "Bạn có thể cho mình biết môn thi và còn bao nhiêu ngày không?"
            };
        }

        if (topic === "method" || /phuong phap|tap trung|ghi nho|hay quen|pomodoro/.test(text)) {
            return {
                text: "Bạn có thể thử 3 phương pháp:\n" +
                    "• Pomodoro: học tập trung 25 phút, nghỉ 5 phút.\n" +
                    "• Active Recall: tự trả lời câu hỏi thay vì chỉ đọc lại.\n" +
                    "• Spaced Repetition: ôn lại kiến thức theo các khoảng thời gian.\n\n" +
                    "Bạn thường gặp khó khăn vì thiếu tập trung, khó hiểu bài hay nhanh quên?"
            };
        }

        return {
            text: "Mình đã nhận được câu hỏi của bạn. Hiện đây là bản Tư vấn mô phỏng nên mình chưa thể trả lời linh hoạt như AI thực sự.\n\n" +
                "Bạn có thể chọn một chủ đề như môn học, GPA, phương pháp học hoặc kế hoạch ôn tập. Nếu nói rõ môn học và mục tiêu, mình sẽ gợi ý theo kịch bản tương ứng."
        };
    }

    function loadHistory() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            if (!Array.isArray(stored)) return [];

            return stored.slice(-MAX_HISTORY).filter(item =>
                item &&
                (item.role === "user" || item.role === "assistant") &&
                typeof item.text === "string" &&
                item.text.length <= 3000
            ).map(item => ({
                role: item.role,
                text: item.text,
                link: Object.prototype.hasOwnProperty.call(LINKS, item.link)
                    ? item.link : null,
                action: item.action === "sample-plan" ? "sample-plan" : null
            }));
        } catch (error) {
            console.warn("Không thể đọc lịch sử Tư vấn:", error);
            return [];
        }
    }

    function saveHistory(history) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
        } catch (error) {
            console.warn("Không thể lưu lịch sử Tư vấn:", error);
        }
    }

    function initAdvising() {
        // Chọn phần nội dung riêng, vì main.js có thể thay HTML mà không tải lại trang.
        const root = document.querySelector("[data-advising-root]");
        if (!root || root.dataset.initialized === "true") return;
        root.dataset.initialized = "true";

        const welcome = root.querySelector("[data-chat-welcome]");
        const log = root.querySelector("[data-chat-messages]");
        const form = root.querySelector("[data-chat-form]");
        const input = root.querySelector(".et-advising-textarea");
        const counter = root.querySelector("[data-char-count]");
        const errorBox = root.querySelector("[data-chat-error]");
        if (!welcome || !log || !form || !input || !counter || !errorBox) return;

        let history = loadHistory();

        function displayError(message) {
            errorBox.textContent = message;
            errorBox.hidden = !message;
            input.setAttribute("aria-invalid", String(Boolean(message)));
        }

        function updateCounter() {
            counter.textContent = `${input.value.length}/${MAX_LENGTH}`;
        }
        
        function resizeInput() {
            input.style.height = "auto";
            // Giới hạn chiều cao theo CSS
            const maxHeight =
                parseFloat(getComputedStyle(input).maxHeight) || 160;
            const newHeight = Math.min(
                input.scrollHeight,
                maxHeight
            );
            // Tự điều chỉnh chiều cao
            input.style.height = `${newHeight}px`;
            // Chỉ cho cuộn khi quá chiều cao tối đa
            input.style.overflowY =
                input.scrollHeight > maxHeight
                    ? "auto"
                    : "hidden";
        }

        function renderMessage(message) {
            const wrapper = document.createElement("article");
            wrapper.className = `et-advising-message et-advising-message-${message.role}`;

            const avatar = document.createElement("span");
            avatar.className = "et-advising-avatar";
            avatar.setAttribute("aria-hidden", "true");
            avatar.textContent = message.role === "user" ? "B" : "ET";

            const bubble = document.createElement("div");
            bubble.className = "et-advising-bubble";

            const text = document.createElement("p");
            text.className = "et-advising-bubble-text";
            text.textContent = message.text; // Không dùng innerHTML cho văn bản nhập vào.
            bubble.appendChild(text);

            if (message.role === "assistant" && (message.link || message.action)) {
                const actions = document.createElement("div");
                actions.className = "et-advising-bubble-actions";

                // Chỉ dùng các liên kết được định nghĩa sẵn, không ghép URL từ nội dung chat.
                if (message.link && LINKS[message.link]) {
                    const link = document.createElement("a");
                    link.className = "et-advising-bubble-link";
                    link.href = LINKS[message.link].href;
                    link.textContent = LINKS[message.link].label;
                    actions.appendChild(link);
                }

                if (message.action === "sample-plan") {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "et-advising-bubble-button";
                    button.dataset.action = "sample-plan";
                    button.textContent = "Xem lộ trình 3 tuần mẫu →";
                    actions.appendChild(button);
                }

                bubble.appendChild(actions);
            }

            wrapper.append(avatar, bubble);
            log.appendChild(wrapper);
        }

        function refreshConversation() {
            const hasHistory = history.length > 0;
            welcome.hidden = hasHistory;
            log.hidden = !hasHistory;
            log.replaceChildren();
            history.forEach(renderMessage);
            if (hasHistory) log.scrollTop = log.scrollHeight;
        }

        function appendMessage(role, text, link = null, action = null) {
            const message = { role, text, link, action };
            history.push(message);
            history = history.slice(-MAX_HISTORY);
            if (welcome.hidden === false) {
                welcome.hidden = true;
                log.hidden = false;
            }
            renderMessage(message);
            log.scrollTop = log.scrollHeight;
            saveHistory(history);
        }

        function sendQuestion(value, topic = "") {
            const question = value.trim();

            if (!question) {
                displayError("Bạn hãy nhập câu hỏi trước khi gửi.");
                input.focus();
                return;
            }
            if (question.length > MAX_LENGTH) {
                displayError(`Câu hỏi không được vượt quá ${MAX_LENGTH} ký tự.`);
                return;
            }

            displayError("");
            appendMessage("user", question);
            const answer = getReply(question, topic);
            appendMessage("assistant", answer.text, answer.link || null, answer.action || null);
            input.value = "";
            updateCounter();
            resizeInput();
            input.focus();
        }

        form.addEventListener("submit", event => {
            event.preventDefault();
            sendQuestion(input.value);
        });

        input.addEventListener("input", () => {
            resizeInput();
            updateCounter();

            if (input.value.trim()) {
                displayError("");
            }
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                form.requestSubmit();
            }
        });

        root.addEventListener("click", event => {
            if (!(event.target instanceof Element)) return;
            const button = event.target.closest("button[data-topic], button[data-action]");
            if (!button || !root.contains(button)) return;

            if (button.dataset.topic && TOPICS[button.dataset.topic]) {
                sendQuestion(TOPICS[button.dataset.topic], button.dataset.topic);
                return;
            }

            if (button.dataset.action === "sample-plan") {
                appendMessage("user", "Cho mình xem lộ trình ôn tập mẫu trong 3 tuần.");
                appendMessage("assistant", DEMO_PLAN);
                input.focus();
                return;
            }

            if (button.dataset.action === "new-chat") {
                history = [];
                try { localStorage.removeItem(STORAGE_KEY); } catch (error) {
                    console.warn("Không xóa được lịch sử Tư vấn:", error);
                }
                input.value = "";
                resizeInput();
                displayError("");
                updateCounter();
                refreshConversation();
                input.focus();
            }
        });

        refreshConversation();
        updateCounter();
        resizeInput();
        displayError("");
    }

    // Lần đầu mở trực tiếp trang HTML.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAdvising);
    } else {
        initAdvising();
    }

    // Khi chuyển trang bằng router hiện tại của EduTrack.
    document.addEventListener("edutrack:page-loaded", initAdvising);
})();
