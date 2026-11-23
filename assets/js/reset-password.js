"use strict";

(function () {

    function initResetPassword() {

        const form = document.querySelector(
            ".reset-password-form"
        );

        if (!form || form.dataset.initialized === "true") {
            return;
        }

        form.dataset.initialized = "true";

        const passwordInput =
            form.elements.namedItem("password");

        const confirmInput =
            form.elements.namedItem("confirmPassword");

        const passwordError =
            form.querySelector("#new-password-error");

        const confirmError =
            form.querySelector("#confirm-new-password-error");

        const submitButton =
            form.querySelector(".recovery-submit");

        const message =
            form.querySelector(".recovery-message");

        // Lấy token từ liên kết email
        const params = new URLSearchParams(
            window.location.search
        );

        const token = params.get("token");

        // Bỏ token khỏi thanh địa chỉ
        window.history.replaceState(
            null,
            "",
            window.location.pathname
        );

        function setMessage(text, status = "") {
            message.textContent = text;
            message.className =
                "recovery-message" +
                (status ? " is-" + status : "");
        }

        function clearError(input, error) {
            input.classList.remove("is-invalid");
            input.removeAttribute("aria-invalid");
            error.textContent = "";
        }

        function showError(input, error, text) {
            input.classList.add("is-invalid");
            input.setAttribute("aria-invalid", "true");
            error.textContent = text;
        }

        if (!token || !/^[a-f0-9]{64}$/.test(token)) {

            setMessage(
                "Liên kết không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu mới.",
                "error"
            );

            submitButton.disabled = true;
            return;
        }

        passwordInput.addEventListener("input", () => {
            clearError(passwordInput, passwordError);
            clearError(confirmInput, confirmError);
            setMessage("");
        });

        confirmInput.addEventListener("input", () => {
            clearError(confirmInput, confirmError);
            setMessage("");
        });

        form.addEventListener("submit", async function (event) {

            event.preventDefault();

            if (submitButton.disabled) return;

            clearError(passwordInput, passwordError);
            clearError(confirmInput, confirmError);
            setMessage("");

            const password = passwordInput.value;
            const confirmPassword = confirmInput.value;

            let valid = true;

            if (
                password.length < 8 ||
                password.length > 64
            ) {
                showError(
                    passwordInput,
                    passwordError,
                    "Mật khẩu phải từ 8 đến 64 ký tự."
                );
                valid = false;
            }

            if (
                !confirmPassword ||
                confirmPassword !== password
            ) {
                showError(
                    confirmInput,
                    confirmError,
                    "Mật khẩu xác nhận không trùng khớp."
                );
                valid = false;
            }

            if (!valid) return;

            submitButton.disabled = true;
            submitButton.textContent = "Đang đặt lại...";

            let succeeded = false;

            try {

                const response = await fetch(
                    "/api/auth/reset-password",
                    {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            token,
                            password,
                            confirmPassword
                        })
                    }
                );

                const result = await response.json()
                    .catch(() => ({}));

                if (!response.ok) {
                    setMessage(
                        result.message ||
                        "Không thể đặt lại mật khẩu.",
                        "error"
                    );
                    return;
                }

                succeeded = true;
                form.reset();

                setMessage(
                    "Đổi mật khẩu thành công! Hãy quay lại đăng nhập.",
                    "success"
                );

                submitButton.textContent =
                    "Đã đặt lại mật khẩu";

            } catch (error) {

                console.error("Reset password:", error);

                setMessage(
                    "Không kết nối được Backend.",
                    "error"
                );

            } finally {

                if (!succeeded) {
                    submitButton.disabled = false;
                    submitButton.textContent =
                        "Đặt lại mật khẩu";
                }
            }
        });
    }

    window.initEduTrackResetPassword = initResetPassword;

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initResetPassword
        );
    } else {
        initResetPassword();
    }

})();
