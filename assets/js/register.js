"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".register-form");

    // Không xử lý nếu trang hiện tại không có form đăng ký
    if (!form) return;

    const fullnameInput = form.querySelector('[name="fullname"]');
    const emailOrPhoneInput = form.querySelector('[name="emailOrPhone"]');
    const passwordInput = form.querySelector('[name="password"]');
    const confirmPasswordInput = form.querySelector('[name="confirmPassword"]');
    const googleButton = form.querySelector(".google-register");

    // Kiểm tra thư viện validation
    if (!window.EDUValidation) {
        console.error("Không tìm thấy EDUValidation!");
        return;
    }

    const validation = window.EDUValidation;

    // Khu vực hiển thị thông báo
    const message = form.querySelector(".register-message");

    // Xóa thông báo chung
    function clearMessage() {
        message.textContent = "";
        message.className = "register-message";
    }

    // Xóa lỗi khi người dùng nhập lại
    const inputs = [
        fullnameInput,
        emailOrPhoneInput,
        passwordInput,
        confirmPasswordInput
    ];

    inputs.forEach(function (input) {
        input.addEventListener("input", function () {
            validation.clearFieldError(input);
            clearMessage();

            // Khi thay đổi mật khẩu, cần kiểm tra lại xác nhận mật khẩu
            if (input === passwordInput) {
                validation.clearFieldError(confirmPasswordInput);
            }
        });
    });

    // Xử lý đăng ký
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        clearMessage();

        let isValid = true;

        // 1. Kiểm tra họ tên
        if (!validation.isRequired(fullnameInput.value)) {
            validation.showFieldError(
                fullnameInput,
                "Vui lòng nhập họ và tên."
            );
            isValid = false;
        } else if (
            !validation.isValidLength(fullnameInput.value, 2, 50)
        ) {
            validation.showFieldError(
                fullnameInput,
                "Họ và tên phải có từ 2 đến 50 ký tự."
            );
            isValid = false;
        }

        // 2. Kiểm tra email hoặc số điện thoại
        const contact = emailOrPhoneInput.value.trim();

        if (!validation.isRequired(contact)) {
            validation.showFieldError(
                emailOrPhoneInput,
                "Vui lòng nhập email hoặc số điện thoại."
            );
            isValid = false;
        } else if (
            !validation.isValidEmail(contact) &&
            !validation.isValidPhone(contact)
        ) {
            validation.showFieldError(
                emailOrPhoneInput,
                "Email hoặc số điện thoại không hợp lệ."
            );
            isValid = false;
        }

        // 3. Kiểm tra mật khẩu
        if (!validation.isRequired(passwordInput.value)) {
            validation.showFieldError(
                passwordInput,
                "Vui lòng nhập mật khẩu."
            );
            isValid = false;
        } else if (
            !validation.isValidLength(passwordInput.value, 8, 64)
        ) {
            validation.showFieldError(
                passwordInput,
                "Mật khẩu phải có từ 8 đến 64 ký tự."
            );
            isValid = false;
        }

        // 4. Kiểm tra xác nhận mật khẩu
        if (!validation.isRequired(confirmPasswordInput.value)) {
            validation.showFieldError(
                confirmPasswordInput,
                "Vui lòng xác nhận mật khẩu."
            );
            isValid = false;
        } else if (
            confirmPasswordInput.value !== passwordInput.value
        ) {
            validation.showFieldError(
                confirmPasswordInput,
                "Mật khẩu xác nhận không trùng khớp."
            );
            isValid = false;
        }

        // Dừng nếu có trường không hợp lệ
        if (!isValid) return;

        // Thông báo khi dữ liệu hợp lệ
        message.textContent =
            "Thông tin hợp lệ! Chức năng tạo tài khoản cần kết nối với hệ thống máy chủ.";

        message.classList.add("is-success");
    });

    // Xử lý nút đăng ký Google
    if (googleButton) {
        googleButton.addEventListener("click", function () {
            clearMessage();

            message.textContent =
                "Chức năng đăng ký bằng Google hiện chưa được kết nối.";

            message.classList.add("is-info");
        });
    }
});