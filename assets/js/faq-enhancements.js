
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    // 1. Lấy các phần tử HTML
    const faq = document.getElementById("faq");
    const button = document.getElementById("toggle-faq");

    if (!faq || !button) return;

    // 2. Cấu hình
    const STORAGE_KEY = "edutrack_questions_MATH101";
    const VISIBLE_COUNT = 3;

    let showAll = false;

    // 3. Hiển thị câu hỏi đã được quản trị viên trả lời
    function renderAnsweredQuestions() {
        let questions = [];

        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
            );

            questions = Array.isArray(saved) ? saved : [];
        } catch (error) {
            questions = [];
        }

        // Xóa các câu hỏi động đã hiển thị trước đó
        faq.querySelectorAll(".faq-item[data-admin-answer]")
            .forEach(function (item) {
                item.remove();
            });

        // Chỉ hiển thị câu hỏi đã có câu trả lời
        questions
            .filter(function (question) {
                return question &&
                    question.status === "answered" &&
                    typeof question.content === "string" &&
                    typeof question.answer === "string" &&
                    question.content.trim() !== "" &&
                    question.answer.trim() !== "";
            })
            .forEach(function (question) {
                // Tạo thẻ FAQ
                const item = document.createElement("details");
                item.className = "faq-item";
                item.setAttribute("data-admin-answer", "true");

                // Nội dung câu hỏi
                const summary = document.createElement("summary");
                summary.textContent = question.content;

                // Câu trả lời của quản trị viên
                const answer = document.createElement("p");
                answer.textContent = question.answer;

                // Ghép câu hỏi và câu trả lời
                item.append(summary, answer);

                // Thêm vào trước nút Xem thêm
                const moreRow = button.closest(".faq-more-row");

                if (moreRow) {
                    faq.insertBefore(item, moreRow);
                } else {
                    faq.appendChild(item);
                }
            });
    }

    // 4. Xử lý Xem thêm / Thu gọn FAQ
    function updateFAQ() {
        const items = Array.from(
            faq.querySelectorAll(":scope > .faq-item")
        );

        items.forEach(function (item, index) {
            item.hidden = !showAll && index >= VISIBLE_COUNT;
        });

        // Chỉ hiện nút khi có trên 3 câu hỏi
        button.hidden = items.length <= VISIBLE_COUNT;

        button.textContent = showAll
            ? "Thu gọn"
            : "Xem thêm";

        button.setAttribute(
            "aria-expanded",
            String(showAll)
        );
    }

    // 5. Bắt sự kiện nhấn nút Xem thêm
    button.addEventListener("click", function () {
        showAll = !showAll;
        updateFAQ();
    });

    // 6. Cho phép các file JS khác cập nhật FAQ
    window.updateCourseFAQ = function () {
        renderAnsweredQuestions();
        updateFAQ();
    };

    // 7. Khởi tạo khi tải trang
    renderAnsweredQuestions();
    updateFAQ();
});
