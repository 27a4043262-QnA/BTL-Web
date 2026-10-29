
"use strict";

document.addEventListener("DOMContentLoaded", function () {

    // ===== 1. LẤY CÁC PHẦN TỬ HTML =====

    const form = document.getElementById("question-form");
    const nameInput = document.getElementById("question-name");
    const contentInput = document.getElementById("question-content");
    const questionModal = document.getElementById("questionModal");

    if (!form || !nameInput || !contentInput) {
        return;
    }

    // Ngăn khởi tạo sự kiện nhiều lần
    if (form.dataset.questionInitialized === "true") {
        return;
    }

    form.dataset.questionInitialized = "true";

    // Kiểm tra thư viện validation đã được tải chưa
    if (!window.EDUValidation) {
        console.error("Chưa tải file validation.js");
        return;
    }

    const validation = window.EDUValidation;

    // ===== 2. CẤU HÌNH =====

    // Khóa lưu câu hỏi của môn Toán dành cho kinh tế
    const STORAGE_KEY = "edutrack_questions_MATH101";

    let questions = [];
    let isSubmitting = false;

    // ===== 3. ĐỌC CÁC CÂU HỎI ĐÃ LƯU =====

    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        questions = Array.isArray(saved) ? saved : [];
    } catch (error) {
        questions = [];
    }

    // ===== 4. LƯU CÂU HỎI =====

    function saveQuestions() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(questions)
            );

            return true;
        } catch (error) {
            return false;
        }
    }

    // ===== 5. KIỂM TRA DỮ LIỆU FORM =====

    function validateQuestionForm() {
        const fullName = nameInput.value.trim();
        const content = contentInput.value.trim();

        // Xóa lỗi cũ trước khi kiểm tra
        validation.clearFieldError(nameInput);
        validation.clearFieldError(contentInput);

        // Kiểm tra họ tên bắt buộc
        if (!validation.isRequired(fullName)) {
            validation.showFieldError(
                nameInput,
                "Vui lòng nhập họ và tên."
            );

            nameInput.focus();
            return false;
        }

        // Kiểm tra độ dài họ tên
        if (!validation.isValidLength(fullName, 1, 100)) {
            validation.showFieldError(
                nameInput,
                "Họ và tên không được vượt quá 100 ký tự."
            );

            nameInput.focus();
            return false;
        }

        // Kiểm tra nội dung câu hỏi bắt buộc
        if (!validation.isRequired(content)) {
            validation.showFieldError(
                contentInput,
                "Vui lòng nhập nội dung câu hỏi."
            );

            contentInput.focus();
            return false;
        }

        // Kiểm tra độ dài câu hỏi
        if (!validation.isValidLength(content, 10, 500)) {
            validation.showFieldError(
                contentInput,
                "Nội dung câu hỏi phải từ 10 đến 500 ký tự."
            );

            contentInput.focus();
            return false;
        }

        return true;
    }

    // ===== 6. XỬ LÝ GỬI CÂU HỎI =====

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        // Ngăn xử lý gửi đồng thời
        if (isSubmitting) {
            return;
        }

        // Kiểm tra dữ liệu trước khi gửi
        if (!validateQuestionForm()) {
            return;
        }

        isSubmitting = true;

        const fullName = nameInput.value.trim();
        const content = contentInput.value.trim();

        // Tạo đối tượng câu hỏi
        const question = {
            id: Date.now().toString() + "-" +
                Math.random().toString(36).slice(2, 9),
            fullName: fullName,
            content: content,
            date: new Date().toISOString(),
            status: "pending"
        };

        // Thêm câu hỏi vào danh sách
        questions.unshift(question);

        // Lưu vào localStorage
        if (!saveQuestions()) {
            questions.shift();
            isSubmitting = false;

            alert("Không thể lưu câu hỏi. Vui lòng thử lại.");
            return;
        }

        // Xóa lỗi cũ
        validation.clearFieldError(nameInput);
        validation.clearFieldError(contentInput);

        // Đóng modal và hiển thị thông báo thành công
        if (window.jQuery && questionModal) {

            $("#questionModal").one(
                "hidden.bs.modal",
                function () {

                    $("#questionSuccessModal").modal("show");

                    // Tự đóng thông báo sau 2 giây
                    setTimeout(function () {
                        $("#questionSuccessModal").modal("hide");
                    }, 2000);
                }
            );

            $("#questionModal").modal("hide");

        } else {
            // Trường hợp không có Bootstrap Modal
            form.reset();
        }

        isSubmitting = false;
    });

    // ===== 7. XÓA FORM KHI ĐÓNG MODAL =====

    if (window.jQuery && questionModal) {

        $("#questionModal").on(
            "hidden.bs.modal",
            function () {

                form.reset();

                validation.clearFieldError(nameInput);
                validation.clearFieldError(contentInput);
            }
        );
    }

    // ===== 8. XÓA LỖI KHI NGƯỜI DÙNG NHẬP LẠI =====

    nameInput.addEventListener("input", function () {
        validation.clearFieldError(nameInput);
    });

    contentInput.addEventListener("input", function () {
        validation.clearFieldError(contentInput);
    });

});
