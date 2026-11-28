/* ===========================================================
   EDUTRACK - TƯ VẤN CHAT QUA BACKEND GEMINI
   - Có 4 chủ đề và tư vấn theo kịch bản.
   - Có validation, Enter/Shift+Enter, lịch sử lưu theo tài khoản ở backend.
   - Chạy được khi mở HTML trực tiếp hoặc khi main.js đổi trang.
   - Công cụ/chức năng liên quan chỉ xuất hiện khi có ngữ cảnh phù hợp.
   - Không đọc/ghi dữ liệu GPA, môn học, tiến độ của nhóm khác.
=========================================================== */
(() => {
    "use strict";

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
        gpa: { href: "gpa-projection.html", label: "Mở công cụ GPA →" },
        progress: { href: "progress.html", label: "Xem trang Tiến độ →" }
    };

    function normalize(text) {
        return text.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d");
    }

    async function initAdvising() {
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

        let history = [];

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
        }

        async function sendQuestion(value, topic = "") {
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
            input.value = "";
            updateCounter();
            resizeInput();
            const sendButton = form.querySelector('[type="submit"]');
            sendButton.disabled = true;
            input.disabled = true;
            try {
                const response = await fetch("/api/advising/chat", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        question,
                        history: history.slice(0, -1)
                            .filter(item => item.role === "user" || item.role === "assistant")
                            .slice(-12)
                    })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.message || "Không gửi được câu hỏi.");
                if (typeof payload.reply !== "string" || !payload.reply.trim()) {
                    throw new Error("Trợ lý chưa trả lời được. Vui lòng thử lại.");
                }
                appendMessage("assistant", payload.reply.trim());
            } catch (error) {
                displayError(error.message || "Không kết nối được trợ lý. Vui lòng thử lại.");
            } finally {
                input.disabled = false;
                sendButton.disabled = false;
                input.focus();
            }
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
                appendMessage("assistant", "Đây là kế hoạch mẫu tham khảo; để tạo lộ trình cá nhân hóa, hãy hoàn thành dự phóng GPA và bài kiểm tra ở trang Tư vấn lộ trình.");
                input.focus();
                return;
            }

            if (button.dataset.action === "new-chat") {
                fetch("/api/advising/chat/history", { method: "DELETE", credentials: "same-origin" })
                    .then(response => { if (!response.ok) throw new Error("Không xóa được lịch sử chat trên máy chủ."); })
                    .catch(error => displayError(error.message));
                history = [];
                input.value = "";
                resizeInput();
                displayError("");
                updateCounter();
                refreshConversation();
                input.focus();
            }
        });

        try {
            const response = await fetch("/api/advising/chat/history", { credentials: "same-origin" });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || "Vui lòng đăng nhập để mở lịch sử tư vấn.");
            history = Array.isArray(payload.messages) ? payload.messages.slice(-MAX_HISTORY) : [];
        } catch (error) {
            displayError(error.message);
        }
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
