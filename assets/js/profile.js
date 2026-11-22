
"use strict";

/* ==========================================
   EDUTRACK - PROFILE.JS
   Frontend + Backend API
========================================== */

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
            required: true
        },
        {
            key: "address",
            label: "Địa chỉ",
            type: "text"
        }
    ];

    let googleLoadPromise = null;

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
                typeof json?.detail === "string"
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

    // 7. TẢI GOOGLE SIGN-IN SDK
    function loadGoogleSDK() {

        if (window.google?.accounts?.id) {
            return Promise.resolve();
        }

        if (!googleLoadPromise) {

            googleLoadPromise = new Promise(
                (resolve, reject) => {

                    let script = document.querySelector(
                        "script[data-et-google-sdk]"
                    );

                    if (!script) {

                        script = document.createElement(
                            "script"
                        );

                        script.src =
                            "https://accounts.google.com/gsi/client";

                        script.async = true;

                        script.dataset.etGoogleSdk = "1";

                        document.head.appendChild(script);
                    }

                    if (window.google?.accounts?.id) {
                        resolve();
                        return;
                    }

                    script.addEventListener(
                        "load",
                        resolve,
                        { once: true }
                    );

                    script.addEventListener(
                        "error",
                        () => reject(
                            new Error(
                                "Không tải được thư viện đăng nhập Google"
                            )
                        ),
                        { once: true }
                    );

                }
            ).catch(err => {

                googleLoadPromise = null;

                throw err;
            });
        }

        return googleLoadPromise;
    }

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
            "#et-google-signin"
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

        // Kiểm tra trang vẫn còn tồn tại sau SPA
        const alive = () =>
            document.querySelector("#et-profile-fields") === list;

        function setMessage(text, error = false) {

            message.hidden = !text;
            message.textContent = text;

            message.classList.toggle(
                "is-error",
                error
            );
        }

        // ======================================
        // 9. HIỂN THỊ THÔNG TIN
        // ======================================

        function render() {

            displayName.textContent = profile.fullName;

            displayMajor.textContent =
                "Ngành " + profile.major;

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

                // Nút bút chỉnh sửa
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

                view.append(
                    label,
                    value,
                    btn
                );

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
        // 12. ĐĂNG NHẬP GOOGLE
        // ======================================

        async function showLogin() {

            if (!alive()) return;

            loading.hidden = true;
            layout.hidden = true;
            authBox.hidden = false;

            try {

                const config = await request(
                    "/api/auth/config"
                );

                if (!config.googleClientId) {
                    throw new Error(
                        "Chưa cấu hình GOOGLE_CLIENT_ID trong .env"
                    );
                }

                await loadGoogleSDK();

                if (!alive()) return;

                loginContainer.replaceChildren();

                window.google.accounts.id.initialize({

                    client_id: config.googleClientId,

                    callback: async result => {

                        authMessage.textContent =
                            "Đang xác thực tài khoản Google...";

                        try {

                            await request(
                                "/api/auth/google",
                                {
                                    method: "POST",

                                    headers: {
                                        "Content-Type": "application/json"
                                    },

                                    body: JSON.stringify({
                                        credential: result.credential
                                    })
                                }
                            );

                            if (alive()) {
                                await load();
                            }

                        } catch (err) {

                            if (alive()) {
                                authMessage.textContent =
                                    err.message;
                            }
                        }
                    }
                });

                window.google.accounts.id.renderButton(
                    loginContainer,
                    {
                        theme: "outline",
                        size: "large",
                        text: "signin_with"
                    }
                );

                authMessage.textContent = "";

            } catch (err) {

                if (alive()) {
                    authMessage.textContent =
                        err.message;
                }
            }
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
