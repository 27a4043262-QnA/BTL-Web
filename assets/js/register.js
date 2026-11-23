
"use strict";

(function () {

    function initRegister() {

        // =====================================
        // 1. KHỞI TẠO FORM
        // =====================================

        const form = document.querySelector(".register-form");

        if (!form || form.dataset.initialized === "true") {
            return;
        }

        form.dataset.initialized = "true";

        // =====================================
        // 2. LẤY CÁC TRƯỜNG NHẬP
        // =====================================

        const fields = {
            fullname: form.elements.namedItem("fullname"),
            email: form.elements.namedItem("email"),
            phone: form.elements.namedItem("phone"),
            password: form.elements.namedItem("password"),
            confirmPassword:
                form.elements.namedItem("confirmPassword")
        };

        const submitButton =
            form.querySelector(".register-submit");

        const googleButton =
            form.querySelector(".google-register");

        const message =
            form.querySelector(".register-message");

        // =====================================
        // 3. BIỂU THỨC KIỂM TRA
        // =====================================

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const phonePattern =
            /^0\d{9}$/;

        // =====================================
        // 4. HIỂN THỊ THÔNG BÁO CHUNG
        // =====================================

        function setMessage(text, status) {

            if (!message) return;

            message.textContent = text || "";

            message.className =
                "register-message" +
                (status ? " is-" + status : "");
        }

        // =====================================
        // 5. XÓA LỖI
        // =====================================

        function clearError(input) {

            if (!input) return;

            input.classList.remove("is-invalid");
            input.removeAttribute("aria-invalid");

            const group =
                input.closest(".register-form-group");

            const error = group &&
                group.querySelector(".register-field-error");

            if (error) {
                error.remove();
            }
        }

        // =====================================
        // 6. HIỂN THỊ LỖI
        // =====================================

        function showError(input, text) {

            if (!input) return;

            clearError(input);

            input.classList.add("is-invalid");
            input.setAttribute("aria-invalid", "true");

            const error = document.createElement("small");

            error.className = "register-field-error";
            error.textContent = text;

            const group =
                input.closest(".register-form-group");

            if (group) {
                group.appendChild(error);
            }
        }

        // =====================================
        // 7. XÓA LỖI KHI NHẬP LẠI
        // =====================================

        Object.values(fields).forEach(function (input) {

            if (!input) return;

            input.addEventListener("input", function () {

                clearError(input);
                setMessage("");

                if (input === fields.password) {
                    clearError(fields.confirmPassword);
                }
            });
        });

        // =====================================
        // 8. KIỂM TRA TOÀN BỘ FORM
        // =====================================

        function validate() {

            Object.values(fields).forEach(clearError);

            const fullname =
                fields.fullname.value.trim();

            const email =
                fields.email.value.trim().toLowerCase();

            const phone =
                fields.phone.value.trim();

            const password =
                fields.password.value;

            const confirmPassword =
                fields.confirmPassword.value;

            let valid = true;

            // =====================================
            // 8.1. HỌ VÀ TÊN - BẮT BUỘC
            // =====================================

            if (!fullname) {

                showError(
                    fields.fullname,
                    "Vui lòng nhập họ và tên."
                );

                valid = false;

            } else if (
                fullname.length < 2 ||
                fullname.length > 50
            ) {

                showError(
                    fields.fullname,
                    "Họ và tên phải có từ 2 đến 50 ký tự."
                );

                valid = false;
            }

            // =====================================
            // 8.2. EMAIL - BẮT BUỘC
            // =====================================

            if (!email) {

                showError(
                    fields.email,
                    "Vui lòng nhập địa chỉ email."
                );

                valid = false;

            } else if (
                email.length > 254 ||
                !emailPattern.test(email)
            ) {

                showError(
                    fields.email,
                    "Địa chỉ email không hợp lệ."
                );

                valid = false;
            }

            // =====================================
            // 8.3. SỐ ĐIỆN THOẠI - KHÔNG BẮT BUỘC
            // =====================================

            // Để trống thì hợp lệ.
            // Nếu nhập phải đúng 10 chữ số, bắt đầu bằng 0.

            if (phone && !phonePattern.test(phone)) {

                showError(
                    fields.phone,
                    "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0."
                );

                valid = false;
            }

            // =====================================
            // 8.4. MẬT KHẨU - BẮT BUỘC
            // =====================================

            if (!password) {

                showError(
                    fields.password,
                    "Vui lòng nhập mật khẩu."
                );

                valid = false;

            } else if (
                password.length < 8 ||
                password.length > 64
            ) {

                showError(
                    fields.password,
                    "Mật khẩu phải có từ 8 đến 64 ký tự."
                );

                valid = false;
            }

            // =====================================
            // 8.5. XÁC NHẬN MẬT KHẨU
            // =====================================

            if (!confirmPassword) {

                showError(
                    fields.confirmPassword,
                    "Vui lòng xác nhận mật khẩu."
                );

                valid = false;

            } else if (confirmPassword !== password) {

                showError(
                    fields.confirmPassword,
                    "Mật khẩu xác nhận không trùng khớp."
                );

                valid = false;
            }

            // =====================================
            // 8.6. KIỂM TRA KẾT QUẢ
            // =====================================

            if (!valid) {

                const firstInvalid =
                    form.querySelector(".is-invalid");

                if (firstInvalid) {
                    firstInvalid.focus();
                }

                return null;
            }

            // =====================================
            // 8.7. TRẢ VỀ DỮ LIỆU
            // =====================================

            return {

                fullname,

                email,

                phone: phone || null,

                password,

                confirmPassword
            };
        }

        // =====================================
        // 9. GỬI YÊU CẦU ĐĂNG KÝ
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
                    "Đang tạo tài khoản...";

                let succeeded = false;

                try {

                    const response = await fetch(
                        "/api/auth/register",
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

                    // =====================================
                    // 10. BACKEND TRẢ LỖI
                    // =====================================

                    if (!response.ok) {

                        if (
                            result.field &&
                            fields[result.field]
                        ) {

                            showError(
                                fields[result.field],
                                result.message ||
                                "Dữ liệu không hợp lệ."
                            );
                        }

                        setMessage(
                            result.message ||
                            "Không thể đăng ký. Vui lòng thử lại.",
                            "error"
                        );

                        return;
                    }

                    // =====================================
                    // 11. ĐĂNG KÝ THÀNH CÔNG
                    // =====================================

                    succeeded = true;

                    setMessage(
                        "Tạo tài khoản thành công! Đang chuyển đến trang chủ...",
                        "success"
                    );

                    form.reset();

                    window.location.assign("../index.html");

                } catch (error) {

                    console.error("Register error:", error);

                    setMessage(
                        "Không kết nối được máy chủ. Vui lòng kiểm tra Backend.",
                        "error"
                    );

                } finally {

                    if (!succeeded) {

                        submitButton.disabled = false;

                        submitButton.textContent =
                            "Đăng ký tài khoản →";
                    }
                }
            }
        );

        // =====================================
        // 12. ĐĂNG KÝ BẰNG GOOGLE
        // =====================================

        if (googleButton) {

            googleButton.addEventListener(
                "click",
                function () {

                    window.location.assign(
                        "/api/auth/google/register"
                    );
                }
            );
        }

        // =====================================
        // 13. THÔNG BÁO LỖI GOOGLE
        // =====================================

        const params = new URLSearchParams(
            window.location.search
        );

        const errorCode = params.get("error");

        if (errorCode) {

            const messages = {

                google_unavailable:
                    "Đăng ký Google chưa được cấu hình.",

                google_already_registered:
                    "Tài khoản Google này đã được đăng ký. Vui lòng chuyển sang đăng nhập.",

                google_conflict:
                    "Email đã được sử dụng để đăng ký bằng phương thức khác.",

                google_failed:
                    "Đăng ký Google không thành công."
            };

            setMessage(
                messages[errorCode] ||
                "Có lỗi xảy ra khi đăng ký.",
                "error"
            );
        }
    }

    // =====================================
    // 14. HỖ TRỢ SPA
    // =====================================

    window.initEduTrackRegister = initRegister;

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initRegister
        );

    } else {

        initRegister();
    }

})();
