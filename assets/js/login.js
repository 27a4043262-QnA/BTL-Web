"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".login-form");

    // Không thực hiện nếu trang hiện tại không có form đăng nhập
    if (!form) return;

    const emailInput = form.querySelector('[name="email"]');
    const passwordInput = form.querySelector('[name="password"]');
    const googleButton = document.querySelector(".google-login");

    // Kiểm tra thư viện validation đã được tải chưa
    if (!window.EDUValidation) {
        console.error("Không tìm thấy EDUValidation!");
        return;
    }

    const validation = window.EDUValidation;

    // Khu vực hiển thị thông báo
    let message = form.querySelector(".login-message");

    if (!message) {
        message = document.createElement("p");
        message.className = "login-message";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");
        form.appendChild(message);
    }

    // Xóa thông báo chung
    function clearMessage() {
        message.textContent = "";
        message.className = "login-message";
    }

    // Xóa lỗi khi người dùng nhập lại
    [emailInput, passwordInput].forEach(function (input) {
        if (!input) return;

        input.addEventListener("input", function () {
            validation.clearFieldError(input);
            clearMessage();
        });
    });

    // Xử lý khi nhấn nút Đăng nhập
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        clearMessage();

        let isValid = true;

        // Kiểm tra email
        if (!validation.isRequired(emailInput.value)) {
            validation.showFieldError(
                emailInput,
                "Vui lòng nhập email."
            );
            isValid = false;
        } else if (!validation.isValidEmail(emailInput.value)) {
            validation.showFieldError(
                emailInput,
                "Email không đúng định dạng."
            );
            isValid = false;
        }

        // Kiểm tra mật khẩu
        if (!validation.isRequired(passwordInput.value)) {
            validation.showFieldError(
                passwordInput,
                "Vui lòng nhập mật khẩu."
            );
            isValid = false;
        }

        // Dừng nếu dữ liệu chưa hợp lệ
        if (!isValid) return;

        // Thông báo khi dữ liệu đã hợp lệ
        message.textContent =
            "Thông tin hợp lệ. Chức năng đăng nhập cần kết nối với hệ thống máy chủ.";

        message.classList.add("is-success");
    });

    // Xử lý nút đăng nhập Google
    if (googleButton) {
        googleButton.addEventListener("click", function () {
            clearMessage();

            message.textContent =
                "Chức năng đăng nhập Google hiện chưa được kết nối.";

            message.classList.add("is-info");
        });
    }
});