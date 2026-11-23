
"use strict";

(function () {

    function initLogin() {

        // =====================================
        // 1. LẤY FORM ĐĂNG NHẬP
        // =====================================

        const form = document.querySelector(".login-form");

        if (!form || form.dataset.initialized === "true") {
            return;
        }

        form.dataset.initialized = "true";

        // =====================================
        // 2. LẤY CÁC PHẦN TỬ
        // =====================================

        const emailInput =
            form.elements.namedItem("emailOrPhone");

        const passwordInput =
            form.elements.namedItem("password");


        const submitButton =
            form.querySelector(".login-submit");

        const googleButton =
            form.querySelector(".google-login");

        const message =
            form.querySelector(".login-message");

        const emailError =
            form.querySelector("#email-error");

        const passwordError =
            form.querySelector("#password-error");

        // =====================================
        // 3. BIỂU THỨC KIỂM TRA
        // =====================================

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const phonePattern =
            /^0\d{9}$/;

        // =====================================
        // 4. HIỂN THỊ THÔNG BÁO
        // =====================================

        function setMessage(text, status) {

            if (!message) return;

            message.textContent = text || "";

            message.className =
                "login-message" +
                (status ? " is-" + status : "");
        }

        // =====================================
        // 5. XÓA LỖI
        // =====================================

        function clearError(input, errorElement) {

            if (!input) return;

            input.classList.remove("is-invalid");

            input.removeAttribute("aria-invalid");

            if (errorElement) {
                errorElement.textContent = "";
            }
        }

        // =====================================
        // 6. HIỂN THỊ LỖI
        // =====================================

        function showError(input, errorElement, text) {

            if (!input) return;

            input.classList.add("is-invalid");

            input.setAttribute("aria-invalid", "true");

            if (errorElement) {
                errorElement.textContent = text;
            }
        }

        // =====================================
        // 7. XÓA LỖI KHI NHẬP LẠI
        // =====================================

        emailInput.addEventListener("input", function () {

            clearError(emailInput, emailError);

            setMessage("");
        });

        passwordInput.addEventListener("input", function () {

            clearError(passwordInput, passwordError);

            setMessage("");
        });

        // =====================================
        // 8. KIỂM TRA FORM
        // =====================================

        function validate() {

            clearError(emailInput, emailError);
            clearError(passwordInput, passwordError);

            const emailOrPhone =
                emailInput.value.trim().toLowerCase();

            const password =
                passwordInput.value;

            let valid = true;

            // Kiểm tra email hoặc SĐT
            if (!emailOrPhone) {

                showError(
                    emailInput,
                    emailError,
                    "Vui lòng nhập email hoặc số điện thoại."
                );

                valid = false;

            } else if (
                emailOrPhone.length > 254 ||
                (
                    !emailPattern.test(emailOrPhone) &&
                    !phonePattern.test(emailOrPhone)
                )
            ) {

                showError(
                    emailInput,
                    emailError,
                    "Email hoặc số điện thoại không hợp lệ."
                );

                valid = false;
            }

            // Kiểm tra mật khẩu
            if (!password) {

                showError(
                    passwordInput,
                    passwordError,
                    "Vui lòng nhập mật khẩu."
                );

                valid = false;
            }

            if (!valid) {

                const invalid =
                    form.querySelector(".is-invalid");

                if (invalid) {
                    invalid.focus();
                }

                return null;
            }

            return {
                emailOrPhone,
                password
            };
        }

        // =====================================
        // 9. XỬ LÝ ĐĂNG NHẬP
        // =====================================

        form.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                if (submitButton.disabled) return;

                setMessage("");

                const payload = validate();

                if (!payload) return;

                submitButton.disabled = true;

                submitButton.textContent =
                    "Đang đăng nhập...";

                let succeeded = false;

                try {

                    // Gửi thông tin đến Backend
                    const response = await fetch(
                        "/api/auth/login",
                        {
                            method: "POST",

                            credentials: "same-origin",

                            headers: {
                                "Content-Type": "application/json"
                            },

                            body: JSON.stringify(payload)
                        }
                    );

                    const result = await response.json()
                        .catch(function () {
                            return {};
                        });

                    // Đăng nhập thất bại
                    if (!response.ok) {

                        setMessage(
                            result.message ||
                            "Không thể đăng nhập. Vui lòng thử lại.",
                            "error"
                        );

                        return;
                    }

                    // Đăng nhập thành công
                    succeeded = true;

                    setMessage(
                        "Đăng nhập thành công! Đang chuyển đến trang chủ...",
                        "success"
                    );

                    // Xóa mật khẩu khỏi form
                    passwordInput.value = "";

                    // Chuyển về trang chủ
                    window.location.assign("../index.html");

                } catch (error) {

                    console.error("Login error:", error);

                    setMessage(
                        "Không kết nối được máy chủ. Vui lòng thử lại.",
                        "error"
                    );

                } finally {

                    if (!succeeded) {

                        submitButton.disabled = false;

                        submitButton.textContent =
                            "Đăng nhập →";
                    }
                }
            }
        );

        // =====================================
        // 10. ĐĂNG NHẬP GOOGLE
        // =====================================

        if (googleButton) {

            googleButton.addEventListener(
                "click",
                function () {

                    window.location.assign("/api/auth/google/login");
                }
            );
        }

        // =====================================
        // 12. THÔNG BÁO LỖI GOOGLE
        // =====================================

        const params =
            new URLSearchParams(window.location.search);

        const errorCode = params.get("error");

        if (errorCode) {
          
            const messages = {

                google_unavailable:
                    "Đăng nhập Google chưa được cấu hình.",

                google_not_registered:
                    "Tài khoản Google này chưa được đăng ký trên EduTrack. Vui lòng đăng ký trước.",

                google_conflict:
                    "Email này đã được đăng ký bằng phương thức khác. Vui lòng sử dụng phương thức đăng nhập ban đầu.",

                google_failed:
                    "Đăng nhập Google không thành công. Vui lòng thử lại."
            };

            setMessage(
                messages[errorCode] ||
                "Có lỗi xảy ra khi đăng nhập.",
                "error"
            );
        }
    }

    // =====================================
    // 13. HỖ TRỢ SPA CỦA EDUTRACK
    // =====================================

    window.initEduTrackLogin = initLogin;

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initLogin
        );

    } else {

        initLogin();
    }

})();
