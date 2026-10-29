
"use strict";

/* =====================================================
   EDUTRACK - CHATBOT DÙNG CHUNG TOÀN WEBSITE

   - Robot SVG màu tím/hồng
   - Nút nổi có viền xanh
   - Khung chat đồng màu
   - Trả lời mẫu theo từ khóa
   - Câu hỏi gợi ý
   - Giữ lịch sử khi chuyển trang
   - Có nút xóa cuộc trò chuyện
   - Không sử dụng AI API
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. TRÁNH TẠO TRÙNG CHATBOT
       ===================================================== */

    if (document.getElementById("et-global-chatbot")) {
        return;
    }

    /* =====================================================
       2. SVG ROBOT - DÙNG CHUNG CHO HAI VỊ TRÍ
       ===================================================== */

    function createRobotSvg(suffix) {
        const bodyGradient = `et-robot-body-${suffix}`;
        const faceGradient = `et-robot-face-${suffix}`;

        return `
            <svg
                viewBox="0 0 80 80"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false">

                <defs>
                    <linearGradient
                        id="${bodyGradient}"
                        x1="0%" y1="0%"
                        x2="100%" y2="100%">

                        <stop
                            offset="0%"
                            stop-color="#786ef3"/>

                        <stop
                            offset="52%"
                            stop-color="#ae75e7"/>

                        <stop
                            offset="100%"
                            stop-color="#f184b5"/>
                    </linearGradient>

                    <linearGradient
                        id="${faceGradient}"
                        x1="0%" y1="0%"
                        x2="0%" y2="100%">

                        <stop
                            offset="0%"
                            stop-color="#283e65"/>

                        <stop
                            offset="100%"
                            stop-color="#26284e"/>
                    </linearGradient>
                </defs>

                <!-- Hai anten hồng -->
                <path
                    d="M17 17V38"
                    fill="none"
                    stroke="#fb4e91"
                    stroke-width="3"
                    stroke-linecap="round"/>

                <circle
                    cx="17" cy="15"
                    r="3.5"
                    fill="#fb4e91"/>

                <path
                    d="M63 17V38"
                    fill="none"
                    stroke="#fb4e91"
                    stroke-width="3"
                    stroke-linecap="round"/>

                <circle
                    cx="63" cy="15"
                    r="3.5"
                    fill="#fb4e91"/>

                <!-- Đèn vàng phía trên đầu -->
                <rect
                    x="30" y="20"
                    width="20" height="7"
                    rx="3.5"
                    fill="#ffb93f"/>

                <rect
                    x="34" y="21.5"
                    width="12" height="2"
                    rx="1"
                    fill="#ffe5a6"/>

                <!-- Hai tai hồng -->
                <rect
                    x="13" y="34"
                    width="10" height="20"
                    rx="5"
                    fill="#f36ca6"/>

                <rect
                    x="57" y="34"
                    width="10" height="20"
                    rx="5"
                    fill="#f36ca6"/>

                <rect
                    x="16" y="38"
                    width="3" height="12"
                    rx="1.5"
                    fill="#ffb1d2"/>

                <rect
                    x="61" y="38"
                    width="3" height="12"
                    rx="1.5"
                    fill="#ffb1d2"/>

                <!-- Đầu robot tím hồng -->
                <rect
                    x="20" y="27"
                    width="40" height="35"
                    rx="12"
                    fill="url(#${bodyGradient})"/>

                <!-- Ánh sáng trên đầu -->
                <path
                    d="M28 31C31 29 35 29 38 29"
                    fill="none"
                    stroke="#ffffff"
                    stroke-opacity="0.35"
                    stroke-width="2"
                    stroke-linecap="round"/>

                <!-- Màn hình khuôn mặt -->
                <rect
                    x="25" y="33"
                    width="30" height="22"
                    rx="8"
                    fill="url(#${faceGradient})"/>

                <!-- Hai mắt xanh -->
                <circle
                    cx="34" cy="43"
                    r="3.6"
                    fill="#27ceff"/>

                <circle
                    cx="46" cy="43"
                    r="3.6"
                    fill="#27ceff"/>

                <!-- Đốm sáng trong mắt -->
                <circle
                    cx="33.3" cy="42.2"
                    r="1"
                    fill="#ffffff"/>

                <circle
                    cx="45.3" cy="42.2"
                    r="1"
                    fill="#ffffff"/>

                <!-- Miệng nhỏ -->
                <rect
                    x="37" y="50"
                    width="6" height="2.5"
                    rx="1.25"
                    fill="#ffa6cf"/>

                <!-- Đế tím nhạt -->
                <rect
                    x="29" y="60"
                    width="22" height="10"
                    rx="5"
                    fill="#c6aef6"/>

                <rect
                    x="35" y="63"
                    width="10" height="3.5"
                    rx="1.75"
                    fill="#8b72da"/>
            </svg>
        `;
    }

    /* =====================================================
       3. TẠO TOÀN BỘ HTML CHATBOT
       ===================================================== */

    const chatbot = document.createElement("div");
    chatbot.id = "et-global-chatbot";

    chatbot.innerHTML = `
        <!-- NÚT ROBOT TRÒN NỔI -->
        <button
            type="button"
            class="et-chat-launcher"
            aria-label="Mở trợ lý học tập EduTrack"
            aria-controls="et-chat-panel"
            aria-expanded="false"
            title="Trợ lý EduTrack">

            ${createRobotSvg("launcher")}
        </button>

        <!-- CỬA SỔ CHAT -->
        <section
            id="et-chat-panel"
            class="et-chat-panel"
            aria-label="Trợ lý học tập EduTrack"
            hidden>

            <!-- TIÊU ĐỀ -->
            <div class="et-chat-heading">

                <span
                    class="et-chat-heading-icon"
                    aria-hidden="true">

                    ${createRobotSvg("heading")}
                </span>

                <div class="et-chat-heading-text">
                    <strong>Trợ lý EduTrack</strong>

                    <small>
                        Đồng hành cùng việc học của bạn
                    </small>
                </div>

                <div class="et-chat-heading-actions">

                    <button
                        type="button"
                        class="et-chat-clear"
                        aria-label="Xóa lịch sử cuộc trò chuyện"
                        title="Bắt đầu cuộc trò chuyện mới">
                        Xóa chat
                    </button>

                    <button
                        type="button"
                        class="et-chat-close"
                        aria-label="Đóng chatbot"
                        title="Thu nhỏ chatbot">
                        ×
                    </button>

                </div>
            </div>

            <!-- NỘI DUNG TIN NHẮN -->
            <div
                class="et-chat-messages"
                role="log"
                aria-label="Lịch sử trò chuyện"
                aria-live="polite"
                aria-relevant="additions text">
            </div>

            <!-- CÂU HỎI GỢI Ý -->
            <div
                class="et-chat-suggestions"
                aria-label="Các câu hỏi gợi ý">

                <button
                    type="button"
                    class="et-chat-suggestion"
                    data-question="GPA tính như thế nào?">
                    Cách tính GPA
                </button>

                <button
                    type="button"
                    class="et-chat-suggestion"
                    data-question="Lộ trình học tập">
                    Lộ trình học tập
                </button>

                <button
                    type="button"
                    class="et-chat-suggestion"
                    data-question="Em nên học SQL như thế nào?">
                    Học SQL
                </button>

            </div>

            <!-- FORM NHẬP CÂU HỎI -->
            <form class="et-chat-form">

                <input
                    type="text"
                    class="et-chat-input"
                    name="question"
                    placeholder="Nhập câu hỏi của bạn..."
                    aria-label="Nhập câu hỏi"
                    maxlength="500"
                    autocomplete="off"
                    required>

                <button
                    type="submit"
                    class="et-chat-send"
                    aria-label="Gửi câu hỏi"
                    title="Gửi tin nhắn">

                    <svg
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">

                        <path d="m22 2-7 20-4-9-9-4Z"/>
                        <path d="M22 2 11 13"/>
                    </svg>
                </button>
            </form>

        </section>
    `;

    document.body.appendChild(chatbot);

    /* =====================================================
       4. LẤY CÁC THÀNH PHẦN DOM
       ===================================================== */

    const launcher = chatbot.querySelector(
        ".et-chat-launcher"
    );

    const panel = chatbot.querySelector(
        ".et-chat-panel"
    );

    const closeButton = chatbot.querySelector(
        ".et-chat-close"
    );

    const clearButton = chatbot.querySelector(
        ".et-chat-clear"
    );

    const messages = chatbot.querySelector(
        ".et-chat-messages"
    );

    const form = chatbot.querySelector(
        ".et-chat-form"
    );

    const input = chatbot.querySelector(
        ".et-chat-input"
    );

    /* =====================================================
       5. ĐÓNG / MỞ CHATBOT
       ===================================================== */

    function setChatOpen(isOpen) {
        panel.hidden = !isOpen;

        launcher.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        launcher.setAttribute(
            "aria-label",
            isOpen
                ? "Đóng trợ lý học tập EduTrack"
                : "Mở trợ lý học tập EduTrack"
        );

        if (isOpen) {
            messages.scrollTop = messages.scrollHeight;
            input.focus();
        }
    }

    launcher.addEventListener("click", () => {
        setChatOpen(panel.hidden);
    });

    closeButton.addEventListener("click", () => {
        setChatOpen(false);
        launcher.focus();
    });

    // Nhấn Escape để đóng cửa sổ chat.
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !panel.hidden) {
            setChatOpen(false);
            launcher.focus();
        }
    });

    // Bấm ngoài khung chat để thu nhỏ.
    document.addEventListener("click", event => {
        if (
            !panel.hidden &&
            !chatbot.contains(event.target)
        ) {
            setChatOpen(false);
        }
    });

    /* =====================================================
       6. CHUẨN HÓA NỘI DUNG CÂU HỎI
       ===================================================== */

    function normalizeQuestion(question) {
        return String(question)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .trim();
    }

    /* =====================================================
       7. CHATBOT TRẢ LỜI MẪU
       KHÔNG GỌI AI API
       ===================================================== */

    function getChatResponse(question) {
        const text = normalizeQuestion(question);

        if (text.includes("du phong gpa")) {
            return (
                "Dự phóng GPA giúp bạn ước tính " +
                "điểm trung bình tích lũy dựa trên " +
                "điểm dự kiến ở các môn học tiếp theo."
            );
        }

        if (text.includes("gpa")) {
            return (
                "GPA thường được tính bằng tổng " +
                "điểm học phần nhân với số tín chỉ " +
                "tương ứng, chia cho tổng số tín chỉ " +
                "được tính GPA. Bạn cần tham khảo " +
                "quy định đào tạo của trường."
            );
        }

        if (text.includes("quy che")) {
            return (
                "Bạn nên xem quy chế đào tạo " +
                "hiện hành trên website chính thức " +
                "của trường để biết quy định về " +
                "tín chỉ, điểm số và điều kiện tốt nghiệp."
            );
        }

        if (text.includes("subquery")) {
            return (
                "Subquery là một câu truy vấn SQL " +
                "nằm bên trong câu truy vấn khác. " +
                "Bạn có thể luyện tập với truy vấn " +
                "con trong SELECT, WHERE hoặc FROM."
            );
        }

        if (text.includes("join")) {
            return (
                "JOIN dùng để kết hợp dữ liệu từ " +
                "nhiều bảng trong SQL. INNER JOIN " +
                "lấy các dòng khớp nhau, còn LEFT JOIN " +
                "giữ toàn bộ dòng của bảng bên trái."
            );
        }

        if (text.includes("lam lai")) {
            return (
                "Tính năng làm lại bài test đang " +
                "được phát triển. Hiện EduTrack " +
                "đang sử dụng dữ liệu minh họa."
            );
        }

        if (text.includes("bao lau")) {
            return (
                "Thời gian làm bài phụ thuộc " +
                "vào số câu hỏi và độ khó của bài test. " +
                "Thời lượng chính thức chưa được " +
                "xác định trong bản minh họa."
            );
        }

        if (text.includes("bai test")) {
            return (
                "Trong bản minh họa EduTrack, " +
                "mỗi môn có bài test gồm 20 câu hỏi. " +
                "Chức năng chấm điểm thực tế " +
                "chưa được triển khai."
            );
        }

        if (
            text.includes("chon") &&
            text.includes("mon")
        ) {
            return (
                "Bạn nên ưu tiên những môn " +
                "có điểm thấp, nhiều tín chỉ " +
                "hoặc còn phần kiến thức chưa nắm vững. " +
                "Hãy kết hợp mục tiêu GPA và thời gian học."
            );
        }

        if (
            text.includes("lo trinh") ||
            text.includes("ke hoach")
        ) {
            return (
                "Bạn có thể chia lộ trình học tập " +
                "thành các tuần: củng cố kiến thức, " +
                "luyện bài tập, thực hành nâng cao " +
                "và kiểm tra lại năng lực. " +
                "Hãy đánh dấu các nhiệm vụ đã hoàn thành."
            );
        }

        if (
            text.includes("sql") ||
            text.includes("tai lieu")
        ) {
            return (
                "Để học SQL, bạn nên bắt đầu từ " +
                "SELECT, WHERE, JOIN, GROUP BY, " +
                "HAVING và Subquery. Sau đó hãy " +
                "thực hành trên cơ sở dữ liệu mẫu."
            );
        }

        return (
            "Mình là trợ lý minh họa của EduTrack. " +
            "Hiện mình hỗ trợ một số câu hỏi mẫu " +
            "về GPA, SQL, bài test và lộ trình học tập. " +
            "Bạn có thể chọn câu hỏi gợi ý bên dưới nhé!"
        );
    }

    /* =====================================================
       8. QUẢN LÝ LỊCH SỬ TRÒ CHUYỆN
       ===================================================== */

    const STORAGE_KEY = "edutrack-global-chat-v1";
    const MAX_MESSAGES = 40;

    const greeting =
        "Xin chào! Mình là trợ lý EduTrack. " +
        "Bạn muốn hỏi về GPA, SQL " +
        "hay lộ trình học tập?";

    let chatHistory = [];

    function saveHistory() {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(chatHistory.slice(-MAX_MESSAGES))
            );
        } catch (error) {
            // Vẫn chat được nếu lưu trữ bị hạn chế.
        }
    }

    function appendMessage(content, sender, shouldSave = true) {
        const message = document.createElement("div");

        message.className =
            "et-chat-message " +
            (sender === "user" ? "user" : "bot");

        // Không thực thi HTML từ nội dung người dùng.
        message.textContent = content;

        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;

        if (shouldSave) {
            chatHistory.push({ content, sender });

            chatHistory = chatHistory.slice(
                -MAX_MESSAGES
            );

            saveHistory();
        }
    }

    /* =====================================================
       9. KHÔI PHỤC LỊCH SỬ KHI CHUYỂN TRANG
       ===================================================== */

    function loadHistory() {
        try {
            const saved = sessionStorage.getItem(
                STORAGE_KEY
            );

            if (!saved) {
                return [];
            }

            const parsed = JSON.parse(saved);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .filter(item => {
                    return (
                        item &&
                        typeof item.content === "string" &&
                        (
                            item.sender === "user" ||
                            item.sender === "bot"
                        )
                    );
                })
                .slice(-MAX_MESSAGES);

        } catch (error) {
            return [];
        }
    }

    chatHistory = loadHistory();

    if (chatHistory.length > 0) {
        chatHistory.forEach(item => {
            appendMessage(
                item.content,
                item.sender,
                false
            );
        });
    } else {
        appendMessage(greeting, "bot");
    }

    /* =====================================================
       10. GỬI CÂU HỎI VÀ NHẬN PHẢN HỒI
       ===================================================== */

    function sendQuestion(question) {
        const value = String(question).trim();

        if (!value) {
            input.focus();
            return;
        }

        appendMessage(value, "user");

        const response = getChatResponse(value);

        appendMessage(response, "bot");

        input.value = "";
        input.focus();
    }

    form.addEventListener("submit", event => {
        event.preventDefault();

        sendQuestion(input.value);
    });

    /* =====================================================
       11. CÂU HỎI GỢI Ý
       ===================================================== */

    chatbot.querySelectorAll(
        "[data-question]"
    ).forEach(button => {

        button.addEventListener("click", () => {
            sendQuestion(button.dataset.question);
        });
    });

    /* =====================================================
       12. XÓA LỊCH SỬ TRÒ CHUYỆN
       ===================================================== */

    clearButton.addEventListener("click", () => {

        // Xóa các tin nhắn đang hiển thị.
        messages.replaceChildren();

        // Xóa danh sách trong bộ nhớ JavaScript.
        chatHistory = [];

        // Xóa lịch sử đã lưu.
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            // Vẫn có thể bắt đầu lại cuộc trò chuyện.
        }

        // Hiện lại lời chào ban đầu.
        appendMessage(greeting, "bot");

        input.value = "";
        input.focus();
    });

});
