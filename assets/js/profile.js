"use strict";

(function () {

    // 1. CÁC TRƯỜNG HỒ SƠ
    const FIELDS = [
        {
            key: "fullName",
            label: "Họ và tên",
            type: "text",
            required: true
        },
        {
            key: "birthDate",
            label: "Ngày sinh",
            type: "date"
        },
        {
            key: "gender",
            label: "Giới tính",
            type: "radio"
        },
        {
            key: "phone",
            label: "Số điện thoại",
            type: "tel"
        },
        {
            key: "email",
            label: "Email",
            type: "email",
            required: true,
            editable: false
        },
        {
            key: "address",
            label: "Địa chỉ",
            type: "text"
        }
    ];

    // 2. TẠO PHẦN TỬ HTML
    const el = (tag, className = "", content) => {

        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (content !== undefined) {
            node.textContent = content;
        }

        return node;
    };

    // 3. ĐƯỜNG DẪN API
    const apiUrl = (path) => {

        const root =
            window.EduTrackRouter?.rootURL ||
            new URL(
                "../../",
                document.querySelector(
                    'script[src*="profile.js"]'
                )?.src || location.href
            );

        return new URL(
            path.replace(/^\//, ""),
            root
        ).href;
    };

    // 4. GỌI BACKEND
    async function request(path, options = {}) {

        const response = await fetch(
            apiUrl(path),
            {
                credentials: "same-origin",
                cache: "no-store",
                ...options
            }
        );

        let json = null;

        try {
            json = await response.json();
        } catch (error) {
            // Phản hồi không phải JSON
        }

        if (!response.ok) {

            const err = new Error(
                typeof json?.message === "string"
                    ? json.message
                    : typeof json?.detail === "string"
                        ? json.detail
                        : "Yêu cầu không thành công."
            );

            err.status = response.status;

            throw err;
        }

        return json;
    }

    // 5. KIỂM TRA DỮ LIỆU
    function validate(field, value) {

        const text = String(value || "").trim();

        if (field.required && !text) {
            return `${field.label} không được để trống.`;
        }

        if (
            field.key === "fullName" &&
            text.length > 100
        ) {
            return "Tên quá dài.";
        }

        if (
            field.key === "email" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
        ) {
            return "Email không đúng định dạng.";
        }

        if (field.key === "phone" && text) {

            const phone = text.replace(
                /[\s.-]/g,
                ""
            );

            if (!/^0\d{9}$/.test(phone)) {
                return "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.";
            }
        }

        if (
            field.key === "address" &&
            text.length > 255
        ) {
            return "Địa chỉ quá dài.";
        }

        if (field.key === "birthDate" && text) {

            const parts =
                /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

            if (!parts) {
                return "Ngày sinh không hợp lệ.";
            }

            const d = new Date(
                Number(parts[1]),
                Number(parts[2]) - 1,
                Number(parts[3])
            );

            if (
                d.getFullYear() !== Number(parts[1]) ||
                d.getMonth() !== Number(parts[2]) - 1 ||
                d.getDate() !== Number(parts[3]) ||
                d > new Date()
            ) {
                return "Ngày sinh không hợp lệ.";
            }
        }

        return "";
    }

    // 6. ĐỊNH DẠNG NGÀY
    const formatDate = value => {

        if (
            value &&
            /^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
            return (
                value.slice(8, 10) + "/" +
                value.slice(5, 7) + "/" +
                value.slice(0, 4)
            );
        }

        return value || "Chưa cập nhật";
    };

    // ==========================================
    // 8. KHỞI TẠO PROFILE
    // ==========================================

    function initProfile() {

        const list = document.querySelector(
            "#et-profile-fields"
        );

        if (!list || list.dataset.initialized) {
            return;
        }

        list.dataset.initialized = "true";

        const authBox = document.querySelector(
            "#et-profile-auth"
        );

        const authMessage = document.querySelector(
            "#et-profile-auth-message"
        );

        const loginContainer = document.querySelector(
            "#et-profile-login-link"
        );

        const loading = document.querySelector(
            "#et-profile-loading"
        );

        const layout = document.querySelector(
            "#et-profile-layout"
        );

        const message = document.querySelector(
            "#et-profile-message"
        );

        const displayName = document.querySelector(
            "#et-profile-display-name"
        );

        const displayMajor = document.querySelector(
            "#et-profile-major"
        );

        let profile = null;
        let csrfToken = "";

        // =====================================
        // CÁC PHẦN TỬ QUẢN LÝ MẬT KHẨU
        // =====================================

        const localPassword = document.querySelector(
            "#et-profile-local-password"
        );

        const googlePassword = document.querySelector(
            "#et-profile-google-password"
        );

        const passwordEditor = document.querySelector(
            "#et-profile-password-editor"
        );

        const passwordForm = document.querySelector(
            "#et-profile-password-form"
        );

        const changePasswordButton = document.querySelector(
            "#et-profile-change-password"
        );

        const cancelPasswordButton = document.querySelector(
            "#et-profile-cancel-password"
        );

        const passwordMessage = document.querySelector(
            "#et-profile-password-message"
        );

        // Kiểm tra trang vẫn còn tồn tại sau SPA
        const alive = () =>
            document.querySelector("#et-profile-fields") === list;

        function setMessage(text, error = false) {

            if (!message) return;

            message.textContent = text || "";

            message.hidden = !text;

            message.classList.toggle(
                "is-error",
                error
            );

            message.classList.toggle(
                "is-success",
                Boolean(text) && !error
            );
        }

        // =====================================
        // HIỂN THỊ KHU VỰC MẬT KHẨU
        // =====================================

        function configurePasswordUI() {

            const isGoogleAccount =
                profile.authMethod === "google";

            // Tài khoản email/mật khẩu
            localPassword.hidden = isGoogleAccount;

            // Tài khoản Google
            googlePassword.hidden = !isGoogleAccount;

            // Mỗi lần tải hồ sơ, đóng khung đổi mật khẩu
            passwordEditor.hidden = true;

            if (passwordForm) {
                passwordForm.reset();
            }

            if (passwordMessage) {
                passwordMessage.hidden = true;
                passwordMessage.textContent = "";
            }
        }


        // =====================================
        // MỞ / ĐÓNG KHUNG ĐỔI MẬT KHẨU
        // =====================================

        function openPasswordEditor() {

            passwordForm.reset();

            // Đưa các ô nhập về trạng thái ẩn mật khẩu
            passwordEditor.querySelectorAll(
                'input[type="text"]'
            ).forEach(input => {
                input.type = "password";
            });

            passwordEditor.querySelectorAll(
                ".et-profile-password-toggle"
            ).forEach(button => {

                button.setAttribute(
                    "aria-pressed",
                    "false"
                );

                button.setAttribute(
                    "aria-label",
                    "Hiển thị mật khẩu"
                );

                button.innerHTML =
                    '<i class="fas fa-eye" aria-hidden="true"></i>';
            });

            passwordMessage.hidden = true;

            passwordEditor.hidden = false;

            // Khởi động lại animation nếu mở lại form
            passwordEditor.classList.remove("is-open");

            void passwordEditor.offsetWidth;

            passwordEditor.classList.add("is-open");

            document.querySelector(
                "#et-current-password"
            )?.focus();
        }

        function closePasswordEditor() {

            passwordEditor.hidden = true;

            passwordForm.reset();

            passwordMessage.hidden = true;
        }

        changePasswordButton?.addEventListener(
            "click",
            openPasswordEditor
        );

        cancelPasswordButton?.addEventListener(
            "click",
            closePasswordEditor
        );

        // =====================================
        // HIỆN / ẨN MẬT KHẨU ĐANG NHẬP
        // =====================================

        passwordEditor.querySelectorAll(
            ".et-profile-password-toggle"
        ).forEach(button => {

            button.addEventListener("click", function () {

                const input = document.getElementById(
                    button.dataset.passwordTarget
                );

                if (!input) return;

                const show = input.type === "password";

                input.type = show ? "text" : "password";

                button.setAttribute(
                    "aria-pressed",
                    String(show)
                );

                button.setAttribute(
                    "aria-label",
                    show
                        ? "Ẩn mật khẩu"
                        : "Hiển thị mật khẩu"
                );

                const icon = button.querySelector("i");

                if (icon) {

                    icon.classList.toggle("fa-eye", !show);

                    icon.classList.toggle("fa-eye-slash", show);
                }
            });
        });


        // =====================================
        // XỬ LÝ THÔNG BÁO FORM MẬT KHẨU
        // =====================================

        function setPasswordError(fieldId, messageText) {

            const error = document.querySelector(fieldId);

            if (error) {
                error.textContent = messageText || "";
            }
        }

        function showPasswordMessage(text, isError = false) {

            if (!passwordMessage) return;

            passwordMessage.textContent = text || "";

            passwordMessage.hidden = !text;

            passwordMessage.classList.toggle(
                "is-error",
                isError
            );

            passwordMessage.classList.toggle(
                "is-success",
                Boolean(text) && !isError
            );
        }

        function clearPasswordErrors() {

            [
                "#et-current-password-error",
                "#et-new-password-error",
                "#et-confirm-password-error"
            ].forEach(selector => {
                setPasswordError(selector, "");
            });

            passwordEditor.querySelectorAll("input").forEach(input => {
                input.classList.remove("is-invalid");
                input.removeAttribute("aria-invalid");
            });
        }

        // =====================================
        // LƯU MẬT KHẨU MỚI
        // =====================================

        passwordForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                clearPasswordErrors();
                showPasswordMessage("");

                const currentPassword =
                    passwordForm.elements.namedItem(
                        "currentPassword"
                    ).value;

                const newPassword =
                    passwordForm.elements.namedItem(
                        "newPassword"
                    ).value;

                const confirmPassword =
                    passwordForm.elements.namedItem(
                        "confirmPassword"
                    ).value;

                const currentInput = document.querySelector(
                    "#et-current-password"
                );

                const newInput = document.querySelector(
                    "#et-new-password"
                );

                const confirmInput = document.querySelector(
                    "#et-confirm-password"
                );

                let valid = true;

                // Mật khẩu hiện tại
                if (!currentPassword) {

                    setPasswordError(
                        "#et-current-password-error",
                        "Vui lòng nhập mật khẩu hiện tại."
                    );

                    currentInput.classList.add("is-invalid");

                    valid = false;
                }

                // Mật khẩu mới
                if (
                    newPassword.length < 8 ||
                    newPassword.length > 64
                ) {

                    setPasswordError(
                        "#et-new-password-error",
                        "Mật khẩu mới phải từ 8 đến 64 ký tự."
                    );

                    newInput.classList.add("is-invalid");

                    valid = false;
                }

                // Không cho sử dụng lại mật khẩu hiện tại
                if (
                    currentPassword &&
                    newPassword === currentPassword
                ) {

                    setPasswordError(
                        "#et-new-password-error",
                        "Mật khẩu mới phải khác mật khẩu hiện tại."
                    );

                    newInput.classList.add("is-invalid");

                    valid = false;
                }

                // Xác nhận mật khẩu
                if (
                    !confirmPassword ||
                    confirmPassword !== newPassword
                ) {

                    setPasswordError(
                        "#et-confirm-password-error",
                        "Mật khẩu xác nhận không trùng khớp."
                    );

                    confirmInput.classList.add("is-invalid");

                    valid = false;
                }

                if (!valid) return;

                const saveButton = passwordForm.querySelector(
                    'button[type="submit"]'
                );

                saveButton.disabled = true;

                saveButton.textContent = "Đang cập nhật...";

                try {

                    const result = await request(
                        "/api/profile/password",
                        {
                            method: "PUT",

                            headers: {
                                "Content-Type": "application/json",
                                "X-CSRF-Token": csrfToken
                            },

                            body: JSON.stringify({
                                currentPassword,
                                newPassword,
                                confirmPassword
                            })
                        }
                    );
                    if (result.mustLoginAgain) {

                        showPasswordMessage(
                            result.message ||
                            "Bạn cần đăng nhập lại.",
                            false
                        );

                        setTimeout(function () {

                            window.location.href =
                                apiUrl("pages/login.html");

                        }, 1500);

                        return;
                    }
                    // API có thể cấp CSRF token mới sau khi
                    // tạo lại phiên đăng nhập
                    if (result.csrfToken) {
                        csrfToken = result.csrfToken;
                    }

                    passwordForm.reset();

                    closePasswordEditor();

                    showPasswordMessage(
                        result.message ||
                        "Thay đổi mật khẩu thành công.",
                        false
                    );

                } catch (error) {

                    console.error(
                        "Change password error:",
                        error
                    );

                    if (
                        error.message ===
                        "Mật khẩu hiện tại không chính xác."
                    ) {

                        setPasswordError(
                            "#et-current-password-error",
                            error.message
                        );

                        currentInput.classList.add("is-invalid");

                    } else {

                        showPasswordMessage(
                            error.message ||
                            "Không thể thay đổi mật khẩu.",
                            true
                        );
                    }

                } finally {

                    saveButton.disabled = false;

                    saveButton.textContent = "Lưu mật khẩu";
                }
            }
        );

        // ======================================
        // 9. HIỂN THỊ THÔNG TIN
        // ======================================

        function render() {

            displayName.textContent = profile.fullName;

            displayMajor.textContent =
                "Ngành " +
                (
                    profile.major ||
                    "Hệ thống thông tin quản lý"
                );

            list.replaceChildren();

            for (const field of FIELDS) {

                const row = el(
                    "div",
                    "et-profile-field"
                );

                const view = el(
                    "div",
                    "et-profile-field-view"
                );

                const label = el(
                    "span",
                    "et-profile-field-label",
                    field.label
                );

                if (field.required) {

                    label.append(
                        el(
                            "span",
                            "et-profile-required",
                            " *"
                        )
                    );
                }

                const raw = profile[field.key] || "";

                const value = el(
                    "span",
                    "et-profile-field-value",
                    field.type === "date"
                        ? formatDate(raw)
                        : raw || "Chưa cập nhật"
                );

                if (!raw) {
                    value.classList.add("is-empty");
                }
           
                // ==================================
                // NÚT CHỈNH SỬA / TRƯỜNG CHỈ ĐỌC
                // ==================================

                view.append(label, value);

                if (field.editable === false) {

                    // Email cần xác minh trước khi thay đổi
                    const readOnly = el(
                        "span",
                        "et-profile-readonly"
                    );

                    const lockIcon = el(
                        "i",
                        "fas fa-lock"
                    );

                    lockIcon.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                    readOnly.title =
                        "Email cần được xác minh trước khi thay đổi.";

                    readOnly.append(lockIcon);

                    view.append(readOnly);

                } else {

                    const btn = el(
                        "button",
                        "et-profile-edit-btn"
                    );

                    btn.type = "button";

                    btn.title = `Chỉnh sửa ${field.label}`;

                    btn.setAttribute(
                        "aria-label",
                        btn.title
                    );

                    const pencil = el(
                        "i",
                        "fas fa-pen"
                    );

                    pencil.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                    btn.append(pencil);

                    btn.addEventListener(
                        "click",
                        () => openEditor(field)
                    );

                    view.append(btn);
                }

                row.append(view);
                list.append(row);
            }
        }

        // ======================================
        // 10. CHỈNH SỬA TỪNG DÒNG
        // ======================================

        function openEditor(field) {

            render();
            setMessage("");

            const index = FIELDS.findIndex(
                f => f.key === field.key
            );

            const row = list.children[index];

            const form = el(
                "form",
                "et-profile-field-editor"
            );

            form.noValidate = true;

            const label = el(
                "label",
                "et-profile-editor-label",
                field.label +
                    (field.required ? " *" : "")
            );

            const current = profile[field.key] || "";

            let input;

            // Giới tính
            if (field.type === "radio") {

                input = el(
                    "div",
                    "et-profile-radio-group"
                );

                input.setAttribute(
                    "role",
                    "radiogroup"
                );

                input.setAttribute(
                    "aria-label",
                    "Giới tính"
                );

                for (const gender of ["Nam", "Nữ"]) {

                    const option = el(
                        "label",
                        "et-profile-radio-option"
                    );

                    const radio = el("input");

                    radio.type = "radio";
                    radio.name = "profileGender";
                    radio.value = gender;

                    radio.checked =
                        current === gender;

                    option.append(
                        radio,
                        el("span", "", gender)
                    );

                    input.append(option);
                }

            } else {

                input = el(
                    "input",
                    "et-profile-input"
                );

                input.type = field.type;
                input.value = current;
                input.id = "et-edit-" + field.key;

                if (field.key === "birthDate") {

                    const d = new Date();

                    input.max =
                        `${d.getFullYear()}-` +
                        `${String(d.getMonth() + 1).padStart(2, "0")}-` +
                        `${String(d.getDate()).padStart(2, "0")}`;
                }

                if (field.key === "phone") {
                    input.maxLength = 20;
                }

                if (field.key === "address") {
                    input.maxLength = 255;
                }

                if (field.key === "fullName") {
                    input.maxLength = 100;
                }

                if (field.key === "email") {
                    input.maxLength = 254;
                }

                label.htmlFor = input.id;
            }

            const error = el(
                "p",
                "et-profile-error"
            );

            error.setAttribute("role", "alert");

            const actions = el(
                "div",
                "et-profile-editor-actions"
            );

            const save = el(
                "button",
                "et-profile-save-btn",
                "Lưu"
            );

            save.type = "submit";

            const cancel = el(
                "button",
                "et-profile-cancel-btn",
                "Hủy"
            );

            cancel.type = "button";

            cancel.addEventListener(
                "click",
                render
            );

            actions.append(save, cancel);

            form.append(
                label,
                input,
                error,
                actions
            );

            row.replaceChildren(form);

            // ==================================
            // 11. LƯU THÔNG TIN LÊN BACKEND
            // ==================================

            form.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    const value =
                        field.type === "radio"
                            ? input.querySelector(
                                "input:checked"
                            )?.value || ""
                            : input.value.trim();

                    const reason = validate(
                        field,
                        value
                    );

                    if (reason) {
                        error.textContent = reason;
                        return;
                    }

                    const next = {
                        ...profile,
                        [field.key]: value
                    };

                    // Chỉ gửi trường được phép cập nhật
                    const payload = Object.fromEntries(
                        FIELDS.map(f => [
                            f.key,
                            next[f.key] ||
                                (
                                    f.key === "fullName" ||
                                    f.key === "email"
                                        ? ""
                                        : null
                                )
                        ])
                    );

                    save.disabled = true;
                    error.textContent = "";

                    try {

                        const result = await request(
                            "/api/profile",
                            {
                                method: "PUT",

                                headers: {
                                    "Content-Type": "application/json",
                                    "X-CSRF-Token": csrfToken
                                },

                                body: JSON.stringify(payload)
                            }
                        );

                        if (!alive()) return;

                        profile = result.profile;

                        render();

                        setMessage(
                            "Đã lưu thay đổi thành công."
                        );

                    } catch (err) {

                        if (!alive()) return;

                        error.textContent =
                            err.message ||
                            "Không thể lưu. Vui lòng thử lại.";

                        save.disabled = false;
                    }

                }
            );

            // Focus vào ô đang chỉnh sửa
            const focusTarget =
                input.matches("input")
                    ? input
                    : input.querySelector("input:checked") ||
                      input.querySelector("input");

            focusTarget?.focus();
        }
     
        // ======================================
        // 12. HIỂN THỊ KHI CHƯA ĐĂNG NHẬP
        // ======================================

        async function showLogin() {

            if (!alive()) return;

            loading.hidden = true;
            layout.hidden = true;
            authBox.hidden = false;

            loginContainer.replaceChildren();

            authMessage.textContent =
                "Bạn cần đăng nhập vào EduTrack để xem và quản lý hồ sơ cá nhân.";

            const loginLink = el(
                "a",
                "et-profile-password-btn",
                "Đăng nhập EduTrack"
            );

            loginLink.href = apiUrl("/pages/login.html");

            loginContainer.append(loginLink);
        }

        // ======================================
        // 13. ĐỌC HỒ SƠ TỪ BACKEND
        // ======================================

        async function load() {

            try {

                const data = await request(
                    "/api/profile"
                );

                if (!alive()) return;

                profile = data.profile;

                csrfToken = data.csrfToken;

                // Ngành học mặc định
                profile.major =
                    profile.major || "Hệ thống thông tin quản lý";

                // Cập nhật khu vực mật khẩu theo loại tài khoản
                configurePasswordUI();

                loading.hidden = true;
                authBox.hidden = true;
                layout.hidden = false;

                setMessage("");
                render();

            } catch (err) {

                if (!alive()) return;

                if (err.status === 401) {

                    await showLogin();

                } else {

                    loading.textContent =
                        "Không tải được hồ sơ: " +
                        err.message;

                    loading.hidden = false;
                    authBox.hidden = true;
                    layout.hidden = true;
                }
            }
        }

        // Tải dữ liệu khi mở trang
        load();
    }

    // ==========================================
    // 14. KHỞI TẠO KHI MỞ TRỰC TIẾP
    // ==========================================

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initProfile,
            { once: true }
        );

    } else {

        initProfile();
    }

    // ==========================================
    // 15. KHỞI TẠO KHI SPA CHUYỂN TRANG
    // ==========================================

    document.addEventListener(
        "edutrack:page-loaded",
        initProfile
    );

})();
