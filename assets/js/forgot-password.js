"use strict";

(function () {

    function initForgotPassword() {

        const form = document.querySelector(
            ".forgot-password-form"
        );

        if (!form || form.dataset.initialized === "true") {
            return;
        }

        form.dataset.initialized = "true";

        const emailInput = form.elements.namedItem("email");
        const errorElement = form.querySelector(
            "#recovery-email-error"
        );
        const submitButton = form.querySelector(
            ".recovery-submit"
        );
        const message = form.querySelector(
            ".recovery-message"
        );

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        function setMessage(text, status = "") {
            message.textContent = text;
            message.className =
                "recovery-message" +
                (status ? " is-" + status : "");
        }

        function clearError() {
            emailInput.classList.remove("is-invalid");
            emailInput.removeAttribute("aria-invalid");
            errorElement.textContent = "";
        }

        emailInput.addEventListener("input", function () {
            clearError();
            setMessage("");
        });

        form.addEventListener("submit", async function (event) {

            event.preventDefault();

            if (submitButton.disabled) return;

            clearError();
            setMessage("");

            const email =
                emailInput.value.trim().toLowerCase();

            if (
                !email ||
                email.length > 254 ||
                !emailPattern.test(email)
            ) {
                emailInput.classList.add("is-invalid");
                emailInput.setAttribute("aria-invalid", "true");

                errorElement.textContent =
                    "Vui lòng nhập địa chỉ email hợp lệ.";

                emailInput.focus();
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "Đang xử lý...";

            try {

                const response = await fetch(
                    "/api/auth/forgot-password",
                    {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ email })
                    }
                );

                const result = await response.json()
                    .catch(() => ({}));

                if (!response.ok) {
                    setMessage(
                        result.message ||
                        "Không thể xử lý yêu cầu.",
                        "error"
                    );
                    return;
                }

                setMessage(
                    result.message ||
                    "Nếu email phù hợp với tài khoản, bạn sẽ nhận được liên kết đặt lại.",
                    "success"
                );

                form.reset();

            } catch (error) {

                console.error("Forgot password:", error);

                setMessage(
                    "Không kết nối được Backend.",
                    "error"
                );

            } finally {

                submitButton.disabled = false;
                submitButton.textContent =
                    "Gửi liên kết đặt lại mật khẩu";
            }
        });
    }

    window.initEduTrackForgotPassword = initForgotPassword;

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initForgotPassword
        );
    } else {
        initForgotPassword();
    }

})();
