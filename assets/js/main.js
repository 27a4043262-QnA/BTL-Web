/* === Header / Sidebar === */
(() => {
    "use strict";

    // Đường dẫn gốc website
    const ROOT = new URL("../../", document.currentScript.src);

    const PAGES = {
        "index.html": ["Trang chủ", "home"],
        "courses.html": ["Môn học", "courses"],
        "course-detail.html": ["Chi tiết môn học", "courses"],
        "gpa-calculator.html": ["Tính GPA", "gpa"],
        "gpa-projection.html": ["Dự phóng GPA", "projection"],
        "advising.html": ["Tư vấn", "advising"],
        "advising-contact.html": ["Tư vấn lộ trình", "advising"],
        "about.html": ["Giới thiệu", "about"],
        "profile.html": ["Thông tin cá nhân", "profile"],
        "progress.html": ["Tiến độ học tập", "progress"],
        "progress-detail.html": ["Chi tiết nhiệm vụ", "progress"],
        "progress-subject.html": ["Tiến độ theo môn", "progress"],
        "progress-material.html": ["Tài liệu học tập", "progress"],
        "csbm.html": ["Chính sách bảo mật", "privacy"],
        "DieuKhoanSuDung.html": ["Điều khoản sử dụng", "terms"],
        "bqtl.html": ["Bản quyền tài liệu", "copyright"],
        "login.html": ["Đăng nhập", ""],
        "register.html": ["Đăng ký", ""],
        "news.html": ["Tin tức & Sự kiện", "news"],
        "news-detail.html": ["Chi tiết tin tức", "news"]
    };

    const CATEGORIES = {
        "dai-cuong": "Đại cương",
        "co-so-nganh": "Cơ sở ngành",
        "chuyen-nganh": "Chuyên ngành"
    };

    const SHARED_CSS = new Set([
        "bootstrap.min.css",
        "main.css",
        "chatbot.css"
    ]);

    let navRoot;
    let mainContent;
    let controller;
    let requestId = 0;

    const loadedScripts = new Map();

    const getURL = path => new URL(path, ROOT).href;

    /* ==========================================
       1. TRANG HIỆN TẠI
    ========================================== */

    function getCurrentPage() {
        const url = new URL(location.href);

        const file =
            url.pathname.split("/").pop() || "index.html";

        const category = url.searchParams.get("category");

        const config = PAGES[file] || ["EduTrack", ""];

        const title =
            file === "courses.html" && CATEGORIES[category]
                ? CATEGORIES[category]
                : config[0];

        return {
            file,
            category,
            title,
            key: config[1]
        };
    }

    /* ==========================================
       2. CHUẨN HÓA ĐƯỜNG DẪN
    ========================================== */

    function fixNavigationLinks() {
        navRoot.querySelectorAll(
            "[data-et-href]"
        ).forEach(link => {
            const url = new URL(
                link.dataset.etHref,
                ROOT
            );

            if (link.dataset.etCategory) {
                url.searchParams.set(
                    "category",
                    link.dataset.etCategory
                );
            }

            link.href = url.href;
        });

        navRoot.querySelectorAll(
            "[data-et-src]"
        ).forEach(img => {
            img.src = getURL(img.dataset.etSrc);
        });
    }

    function fixContentPaths(container, pageURL) {
        container.querySelectorAll("*").forEach(el => {
            ["href", "src", "poster", "action"].forEach(attr => {
                const value = el.getAttribute(attr);

                if (
                    !value ||
                    value.startsWith("#") ||
                    /^(data:|javascript:|mailto:|tel:)/i.test(value)
                ) {
                    return;
                }

                try {
                    el.setAttribute(
                        attr,
                        new URL(value, pageURL).href
                    );
                } catch (error) {
                    console.warn("Đường dẫn lỗi:", value);
                }
            });

            // Ảnh responsive
            const srcset = el.getAttribute("srcset");

            if (srcset && !srcset.includes("data:")) {
                const fixed = srcset.split(",").map(item => {
                    const parts = item.trim().split(/\s+/);

                    if (!parts[0]) return "";

                    try {
                        parts[0] = new URL(
                            parts[0],
                            pageURL
                        ).href;
                    } catch (error) {
                        console.warn(
                            "Đường dẫn srcset lỗi:",
                            parts[0]
                        );
                    }

                    return parts.join(" ");
                });

                el.setAttribute("srcset", fixed.join(", "));
            }
        });
    }

    /* ==========================================
       3. TẢI HEADER + SIDEBAR MỘT LẦN
    ========================================== */

    async function loadNavigation() {
        const response = await fetch(
            getURL("pages/navigation.html")
        );

        if (!response.ok) {
            throw new Error(
                "Không tải được navigation.html"
            );
        }

        navRoot.innerHTML = await response.text();

        fixNavigationLinks();
        initSidebar();
        initAccount();

        document.body.classList.add(
            "et-has-navigation"
        );
    }

    /* ==========================================
       4. QUẢN LÝ CSS RIÊNG TỪNG TRANG
    ========================================== */

    function isPageCSS(url) {
        const parsed = new URL(url);
        const name = parsed.pathname.split("/").pop();

        return (
            parsed.origin === ROOT.origin &&
            !SHARED_CSS.has(name)
        );
    }

    function registerInitialAssets() {
        document.querySelectorAll(
            'link[rel~="stylesheet"][href]'
        ).forEach(link => {
            const absoluteURL = link.href;

            // Cố định đường dẫn trước khi pushState
            link.setAttribute("href", absoluteURL);

            if (isPageCSS(absoluteURL)) {
                link.dataset.etPageCss = "true";
            }
        });

        document.querySelectorAll(
            "script[src]"
        ).forEach(script => {
            loadedScripts.set(
                script.src,
                Promise.resolve()
            );
        });
    }

    async function updatePageCSS(doc, pageURL, id) {
        const desired = new Set(
            [...doc.querySelectorAll(
                'link[rel~="stylesheet"][href]'
            )]
                .map(link => new URL(
                    link.getAttribute("href"),
                    pageURL
                ).href)
                .filter(isPageCSS)
        );

        const loading = [];

        for (const href of desired) {
            const exists = [
                ...document.querySelectorAll(
                    'link[rel~="stylesheet"][href]'
                )
            ].some(link => link.href === href);

            if (exists) continue;

            const link = document.createElement("link");

            link.rel = "stylesheet";
            link.href = href;
            link.dataset.etPageCss = "true";

            loading.push(new Promise(resolve => {
                link.onload = resolve;

                link.onerror = () => {
                    console.warn("Không tải được CSS:", href);
                    resolve();
                };
            }));

            document.head.appendChild(link);
        }

        await Promise.all(loading);

        if (id !== requestId) return;

        document.querySelectorAll(
            '[data-et-page-css="true"]'
        ).forEach(link => {
            if (!desired.has(link.href)) {
                link.remove();
            }
        });
    }

    
    /* ==========================================
       5. TẢI JAVASCRIPT RIÊNG TỪNG TRANG
    ========================================== */

    async function loadPageScripts(doc, pageURL, id) {
        const scripts = [
            ...doc.querySelectorAll("script[src]")
        ];

        for (const item of scripts) {
            if (id !== requestId) return;

            const src = new URL(
                item.getAttribute("src"),
                pageURL
            ).href;

            if (loadedScripts.has(src)) {
                await loadedScripts.get(src);
                continue;
            }

            const promise = new Promise(resolve => {
                const script = document.createElement(
                    "script"
                );

                script.src = src;
                script.async = false;

                if (item.type) {
                    script.type = item.type;
                }

                script.onload = resolve;

                script.onerror = () => {
                    console.error(
                        "Không tải được JavaScript:",
                        src
                    );
                    resolve();
                };

                document.body.appendChild(script);
            });

            loadedScripts.set(src, promise);
            await promise;
        }
    }

    /* ==========================================
       6. CHUYỂN TRANG - CHỈ THAY CONTENT
    ========================================== */

    async function navigate(url, addHistory = true) {
        const target = new URL(url, location.href);

        // Hủy yêu cầu tải trang trước nếu có
        if (controller) {
            controller.abort();
        }

        controller = new AbortController();

        const id = ++requestId;

        mainContent.setAttribute("aria-busy", "true");

        try {
            const response = await fetch(target.href, {
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(
                    `Không tải được trang: ${response.status}`
                );
            }

            const html = await response.text();

            if (id !== requestId) return;

            const doc = new DOMParser().parseFromString(
                html,
                "text/html"
            );

            const newMain =
                doc.querySelector("#main-content") ||
                doc.querySelector("main");

            if (!newMain) {
                throw new Error(
                    "Trang HTML không có thẻ <main>"
                );
            }

            const content = newMain.cloneNode(true);

            // Script trong nội dung được xử lý riêng
            content.querySelectorAll("script").forEach(
                script => script.remove()
            );

            fixContentPaths(content, target.href);

            await updatePageCSS(doc, target.href, id);

            if (id !== requestId) return;

            // CHỈ THAY NỘI DUNG BÊN PHẢI
            mainContent.innerHTML = content.innerHTML;
            mainContent.className = newMain.className;

            // =============================================
            // ĐỒNG BỘ LOẠI TRANG CHO PROGRESS.JS
            // =============================================

            // Giúp progress.js nhận diện đúng:
            // dashboard, detail, subject, material
            if (newMain.hasAttribute("data-progress-page")) {
                mainContent.setAttribute(
                    "data-progress-page",
                    newMain.getAttribute("data-progress-page")
                );
            } else {
                mainContent.removeAttribute("data-progress-page");
            }

            // Cập nhật URL không reload website
            if (addHistory) {
                history.pushState(
                    { edutrack: true },
                    "",
                    target.href
                );
            }

            document.title = doc.title || "EduTrack";

            updateActiveMenu();
            updateBreadcrumb();

            await loadPageScripts(doc, target.href, id);

            if (id !== requestId) return;
if (window.lucide) {
    window.lucide.createIcons();
}
            // Thông báo cho JS riêng của từng trang
            document.dispatchEvent(
                new CustomEvent("edutrack:page-loaded", {
                    detail: {
                        ...getCurrentPage(),
                        url: target.href
                    }
                })
            );

            syncCourseFilter();

            mainContent.scrollTop = 0;

            window.scrollTo(0, 0);

        } catch (error) {
            if (
                error.name === "AbortError" ||
                id !== requestId
            ) {
                return;
            }

            console.error("Lỗi điều hướng:", error);

            const oldMessage = mainContent.querySelector(
                ".et-router-error"
            );

            oldMessage?.remove();

            const message = document.createElement("p");

            message.className = "et-router-error";
            message.setAttribute("role", "alert");
            message.textContent =
                "Không thể tải nội dung. Vui lòng thử lại.";

            mainContent.prepend(message);

        } finally {
            if (id === requestId) {
                mainContent.removeAttribute("aria-busy");
            }
        }
    }

    /* ==========================================
       7. BẮT SỰ KIỆN CLICK LINK
    ========================================== */

    function handleLinkClick(event) {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.metaKey
        ) {
            return;
        }

        if (!(event.target instanceof Element)) return;

        const link = event.target.closest("a[href]");

        if (!link) return;

        if (
            link.hasAttribute("download") ||
            link.hasAttribute("data-et-no-spa") ||
            (link.target && link.target !== "_self")
        ) {
            return;
        }

        const href = link.getAttribute("href");

        if (!href || href.startsWith("#")) return;

        const url = new URL(link.href, location.href);
        if (
            link.dataset.etCategory &&
            getCurrentPage().file === "courses.html"
            ) {
            event.preventDefault();

            // Đang ở đúng danh mục thì không xử lý lại
            if (url.href === location.href) {
                return;
            }

            history.pushState(
                { edutrack: true },
                "",
                url.href
            );

            syncCourseFilter();
            updateActiveMenu();
            updateBreadcrumb();

            return;
        }

        // Không xử lý link ngoài website
        if (url.origin !== ROOT.origin) return;

        // Chỉ xử lý file HTML thuộc dự án
        if (!url.pathname.startsWith(ROOT.pathname)) return;
        if (!/\.html?$/i.test(url.pathname)) return;

        const current = new URL(location.href);
        const destination = new URL(url.href);

        // Cùng trang, cùng URL: không làm gì
        if (current.href === destination.href) {
            event.preventDefault();
            return;
        }

        // Cùng trang, chỉ khác hash: cho phép chuyển đến mục neo
        if (
            current.origin === destination.origin &&
            current.pathname === destination.pathname &&
            current.search === destination.search
        ) {
            return;
        }

        // Chuyển sang trang khác mà không tải lại Header + Sidebar
        event.preventDefault();
        navigate(url.href);
    }

    /* ==========================================
       8. ĐÁNH DẤU MENU ĐANG CHỌN
    ========================================== */

    function updateActiveMenu() {
        const page = getCurrentPage();

        navRoot.querySelectorAll(
            ".et-active"
        ).forEach(el => {
            el.classList.remove("et-active");
        });

        navRoot.querySelectorAll(
            '.et-sidebar [aria-current="page"]'
        ).forEach(el => {
            el.removeAttribute("aria-current");
        });

        navRoot.querySelectorAll(
            "[data-et-page]"
        ).forEach(link => {
            if (link.dataset.etPage === page.key) {
                link.classList.add("et-active");
                link.setAttribute(
                    "aria-current",
                    "page"
                );
            }
        });

        // Active mục Môn học
        if (
            page.file === "courses.html" ||
            page.file === "course-detail.html"
        ) {
            navRoot.querySelector(
                ".et-courses-link"
            )?.classList.add("et-active");
        }

        // Active danh mục Môn học
        if (
            page.file === "courses.html" &&
            page.category
        ) {
            navRoot.querySelectorAll(
                "[data-et-category]"
            ).forEach(link => {
                if (
                    link.dataset.etCategory === page.category
                ) {
                    link.classList.add("et-active");
                    link.setAttribute(
                        "aria-current",
                        "page"
                    );
                }
            });
        }
    }

    /* ==========================================
       9. BREADCRUMB TRÊN HEADER
    ========================================== */

    
/* ==========================================
   9. BREADCRUMB TRÊN HEADER
   Dùng chung cho toàn bộ website
========================================== */

function updateBreadcrumb() {

    const container = navRoot.querySelector(
        ".et-topbar-history"
    );

    if (!container) return;

    const page = getCurrentPage();

    const params = new URLSearchParams(
        location.search
    );

    const items = [
        {
            title: "Trang chủ",
            href: getURL("index.html")
        }
    ];

    /* ======================================
       1. CÁC TRANG TIẾN ĐỘ HỌC TẬP
    ====================================== */

    const progressPages = [
        "progress.html",
        "progress-detail.html",
        "progress-subject.html",
        "progress-material.html"
    ];

    if (progressPages.includes(page.file)) {

        const dashboardURL = new URL(
            "pages/progress.html",
            ROOT
        );

        // Giữ chế độ demo khi quay lại Dashboard
        if (params.get("view") === "demo") {
            dashboardURL.searchParams.set(
                "view",
                "demo"
            );
        }

        // Trang Dashboard
        if (page.file === "progress.html") {

            items.push({
                title: "Tiến độ học tập",
                href: location.href
            });

        } else {

            // Cấp cha: Tiến độ học tập
            items.push({
                title: "Tiến độ học tập",
                href: dashboardURL.href
            });

            let currentTitle = page.title;

            // Trang chi tiết nhiệm vụ hoặc giai đoạn
            if (page.file === "progress-detail.html") {

                currentTitle =
                    params.has("week") &&
                    !params.has("task")
                        ? "Chi tiết giai đoạn"
                        : "Chi tiết nhiệm vụ";
            }

            // Trang tài liệu hoặc bài tập
            else if (page.file === "progress-material.html") {

                const isExercise =
                    params.get("type") === "exercise";

                currentTitle = isExercise
                    ? "Bài tập thực hành"
                    : "Tài liệu học tập";

                // Giữ đường dẫn quay lại nhiệm vụ
                if (
                    params.has("week") &&
                    params.has("task")
                ) {

                    const detailURL = new URL(
                        "pages/progress-detail.html",
                        ROOT
                    );

                    ["view", "week", "task"].forEach(key => {

                        if (params.has(key)) {
                            detailURL.searchParams.set(
                                key,
                                params.get(key)
                            );
                        }

                    });

                    items.push({
                        title: "Chi tiết nhiệm vụ",
                        href: detailURL.href
                    });
                }
            }

            // Cấp cuối: trang hiện tại
            items.push({
                title: currentTitle,
                href: location.href
            });
        }
    }

    /* ======================================
       2. CÁC TRANG MÔN HỌC
    ====================================== */

    else if (page.file === "courses.html") {

        items.push({
            title: "Môn học",
            href: getURL("pages/courses.html")
        });

        if (
            page.category &&
            CATEGORIES[page.category]
        ) {
            items.push({
                title: CATEGORIES[page.category],
                href: location.href
            });
        }

    }

    else if (page.file === "course-detail.html") {

        items.push({
            title: "Môn học",
            href: getURL("pages/courses.html")
        });

        items.push({
            title: page.title,
            href: location.href
        });

    }

    else if (page.file === "advising-contact.html") {
    items.push({
        title: "Dự phóng GPA",
        href: getURL("pages/gpa-projection.html")
    });

    items.push({
        title: "Tư vấn lộ trình",
        href: location.href
    });
}

    /* ======================================
       3. CÁC TRANG CÒN LẠI
    ====================================== */

    else if (page.file !== "index.html") {

        items.push({
            title: page.title,
            href: location.href
        });

    }

    /* ======================================
       4. RENDER BREADCRUMB
    ====================================== */

    container.replaceChildren();

    items.forEach((item, index) => {

        if (index > 0) {

            const separator = document.createElement(
                "span"
            );

            separator.className =
                "et-history-separator";

            separator.textContent = "›";

            container.appendChild(separator);
        }

        const last = index === items.length - 1;

        const element = document.createElement(
            last ? "span" : "a"
        );

        element.textContent = item.title;

        if (last) {

            element.className =
                "et-history-current";

            element.setAttribute(
                "aria-current",
                "page"
            );

        } else {

            element.href = item.href;
        }

        container.appendChild(element);

    });

    container.scrollLeft = container.scrollWidth;
}


    /* ==========================================
       10. SIDEBAR - HAMBURGER + SUBMENU
    ========================================== */

    function initSidebar() {
        const sidebar = navRoot.querySelector(
            ".et-sidebar"
        );

        const toggle = navRoot.querySelector(
            ".et-menu-toggle"
        );

        const overlay = navRoot.querySelector(
            ".et-sidebar-overlay"
        );

        const submenuButtons = navRoot.querySelectorAll(
            ".et-sidebar .et-submenu-toggle"
        );

        if (!sidebar || !toggle) return;

        let expanded = false;

        try {
            expanded =
                window.innerWidth > 767 &&
                sessionStorage.getItem(
                    "etSidebarExpanded"
                ) === "true";
        } catch (error) {
            expanded = false;
        }

        function setExpanded(value) {
            expanded = value;

            sidebar.classList.toggle(
                "et-expanded",
                expanded
            );

            document.body.classList.toggle(
                "et-nav-expanded",
                expanded
            );

            toggle.setAttribute(
                "aria-expanded",
                String(expanded)
            );

            toggle.setAttribute(
                "aria-label",
                expanded ? "Thu gọn menu" : "Mở rộng menu"
            );

            overlay?.classList.toggle(
                "et-show",
                expanded && window.innerWidth <= 767
            );

            if (window.innerWidth > 767) {
                try {
                    sessionStorage.setItem(
                        "etSidebarExpanded",
                        String(expanded)
                    );
                } catch (error) {
                    console.warn(
                        "Không lưu được trạng thái Sidebar"
                    );
                }
            }

            if (!expanded) {
                submenuButtons.forEach(button => {
                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );
                });

                navRoot.querySelectorAll(
                    ".et-sidebar-submenu"
                ).forEach(menu => {
                    menu.classList.remove("et-show");
                });
            }
        }

        // Hamburger
        toggle.addEventListener("click", () => {
            setExpanded(!expanded);
        });

        // Menu con
        submenuButtons.forEach(button => {
            button.addEventListener("click", () => {
                const name = button.dataset.etSubmenu;

                const submenu = [
                    ...navRoot.querySelectorAll(
                        "[data-et-submenu-content]"
                    )
                ].find(el =>
                    el.dataset.etSubmenuContent === name
                );

                if (!submenu) return;

                if (!expanded) {
                    setExpanded(true);
                }

                const open =
                    !submenu.classList.contains("et-show");

                submenu.classList.toggle(
                    "et-show",
                    open
                );

                button.setAttribute(
                    "aria-expanded",
                    String(open)
                );
            });
        });

        // Overlay mobile
        overlay?.addEventListener("click", () => {
            setExpanded(false);
        });

        // Phím Escape
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && expanded) {
                setExpanded(false);
                toggle.focus();
            }
        });

        // Responsive
        window.addEventListener("resize", () => {
            overlay?.classList.toggle(
                "et-show",
                expanded && window.innerWidth <= 767
            );
        });

        // Mobile: chọn danh mục thì đóng menu
        navRoot.querySelectorAll(
            ".et-sidebar a"
        ).forEach(link => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 767) {
                    setExpanded(false);
                }
            });
        });

        setExpanded(expanded);
    }


    /* ==========================================
    11. QUẢN LÝ TRẠNG THÁI ĐĂNG NHẬP EDUTRACK
    ========================================== */

    function createEduTrackAuth() {

        let currentUser = null;
        let initialized = false;

        // Phát thông báo khi trạng thái đăng nhập thay đổi
        function notifyAuthChanged() {

            window.dispatchEvent(
                new CustomEvent("et:auth-changed", {
                    detail: {
                        user: currentUser,
                        isLoggedIn: Boolean(currentUser)
                    }
                })
            );
        }

        // =====================================
        // KIỂM TRA PHIÊN ĐĂNG NHẬP
        // GET /api/auth/me
        // =====================================

        async function refresh() {

            try {

                const response = await fetch(
                    getURL("api/auth/me"),
                    {
                        method: "GET",

                        credentials: "same-origin",

                        headers: {
                            "Accept": "application/json"
                        },

                        cache: "no-store"
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        "Không thể kiểm tra phiên đăng nhập."
                    );
                }

                const result = await response.json();

                currentUser =
                    result.user &&
                    typeof result.user === "object"
                        ? result.user
                        : null;

            } catch (error) {

                console.error(
                    "Lỗi kiểm tra trạng thái đăng nhập:",
                    error
                );

                currentUser = null;

            } finally {

                initialized = true;

                notifyAuthChanged();
            }

            return currentUser;
        }

        // =====================================
        // KIỂM TRA ĐÃ ĐĂNG NHẬP CHƯA
        // =====================================

        function isLoggedIn() {
            return Boolean(currentUser);
        }

        // =====================================
        // LẤY THÔNG TIN TÀI KHOẢN
        // =====================================

        function getUser() {
            return currentUser;
        }

        // =====================================
        // KIỂM TRA ĐÃ TẢI TRẠNG THÁI CHƯA
        // =====================================

        function isReady() {
            return initialized;
        }

        // =====================================
        // ĐĂNG XUẤT
        // POST /api/auth/logout
        // =====================================

        async function logout() {

            const response = await fetch(
                getURL("api/auth/logout"),
                {
                    method: "POST",

                    credentials: "same-origin",

                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },

                    body: JSON.stringify({})
                }
            );

            const result = await response.json()
                .catch(() => ({}));

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    "Đăng xuất không thành công."
                );
            }

            currentUser = null;
            initialized = true;

            notifyAuthChanged();

            return result;
        }

        return {
            refresh,
            isLoggedIn,
            getUser,
            isReady,
            logout
        };
    }

    // =====================================
    // KHỞI TẠO AUTH
    // =====================================

    async function initializeAuth() {

        if (
            !window.EduTrackAuth ||
            typeof window.EduTrackAuth.refresh !== "function"
        ) {

            window.EduTrackAuth = createEduTrackAuth();
        }

        // Phải kiểm tra tài khoản trước khi tạo Header
        await window.EduTrackAuth.refresh();
    }

    /* ==========================================
    11. TÀI KHOẢN TRÊN HEADER
    ========================================== */

    // Cập nhật giao diện theo trạng thái đăng nhập
    function updateAccount() {

        const guest = navRoot.querySelector(
            ".et-topbar-account .et-account-guest"
        );

        const user = navRoot.querySelector(
            ".et-topbar-account .et-account-user"
        );

        const logout = navRoot.querySelector(
            ".et-topbar-account .et-logout-btn"
        );

        const toggle = navRoot.querySelector(
            ".et-topbar-account-toggle"
        );

        const auth = window.EduTrackAuth;

        const loggedIn =
            typeof auth?.isLoggedIn === "function" &&
            auth.isLoggedIn();

        const currentUser =
            typeof auth?.getUser === "function"
                ? auth.getUser()
                : null;

        // =====================================
        // HIỂN THỊ / ẨN THÀNH PHẦN TÀI KHOẢN
        // =====================================

        function setVisible(element, visible) {

            if (!element) return;

            element.hidden = !visible;

            element.style.display =
                visible ? "" : "none";
        }

        setVisible(guest, !loggedIn);

        setVisible(user, loggedIn);

        setVisible(
            logout,
            loggedIn &&
            typeof auth?.logout === "function"
        );

        // =====================================
        // LẤY TÊN NGƯỜI DÙNG
        // =====================================

        if (!loggedIn || !currentUser) return;

        const fullName =
            (currentUser.fullname || "").trim();

        // =====================================
        // TẠO CHỮ CÁI ĐẦU
        // Nguyễn Văn An => NVA
        // =====================================

        let initials = "";

        if (fullName) {

            initials = fullName
                .split(/\s+/)
                .filter(Boolean)
                .map(word => Array.from(word)[0])
                .join("")
                .slice(0, 3)
                .toLocaleUpperCase("vi-VN");

        } else if (currentUser.email) {

            initials = Array.from(
                currentUser.email
            )[0].toLocaleUpperCase("vi-VN");

        } else {

            initials = "U";
        }

        // =====================================
        // CẬP NHẬT CHỮ CÁI TRÊN HEADER
        // =====================================

        navRoot.querySelectorAll(
            "[data-et-user-initials]"
        ).forEach(element => {

            element.textContent = initials;
        });

        // Nếu có nơi hiển thị họ tên đầy đủ
        navRoot.querySelectorAll(
            "[data-et-user-name]"
        ).forEach(element => {

            element.textContent =
                fullName || currentUser.email || "Tài khoản";
        });

        // Hỗ trợ truy cập bằng bàn phím và trình đọc màn hình
        if (toggle) {

            toggle.setAttribute(
                "aria-label",
                "Tài khoản " +
                (fullName || currentUser.email || "")
            );
        }
    }

    // Khởi tạo menu tài khoản
    function initAccount() {

        const account = navRoot.querySelector(
            ".et-topbar-account"
        );

        const toggle = navRoot.querySelector(
            ".et-topbar-account-toggle"
        );

        const menu = navRoot.querySelector(
            ".et-topbar-account-menu"
        );

        const logout = navRoot.querySelector(
            ".et-topbar-account .et-logout-btn"
        );

        if (!account || !toggle || !menu) {
            return;
        }

        // ======================================
        // 1. ĐÓNG MENU
        // ======================================

        function closeAccountMenu() {

            menu.hidden = true;

            toggle.setAttribute(
                "aria-expanded",
                "false"
            );

        }

        // ======================================
        // 2. MỞ / ĐÓNG MENU
        // ======================================

        toggle.addEventListener("click", function () {

            const willOpen = menu.hidden;

            menu.hidden = !willOpen;

            toggle.setAttribute(
                "aria-expanded",
                String(willOpen)
            );

            if (willOpen) {
                updateAccount();
            }

        });

        // ======================================
        // 3. CLICK NGOÀI MENU THÌ ĐÓNG
        // ======================================

        document.addEventListener("click", function (event) {

            if (!account.contains(event.target)) {
                closeAccountMenu();
            }

        });

        // ======================================
        // 4. NHẤN ESC ĐỂ ĐÓNG
        // ======================================

        document.addEventListener("keydown", function (event) {

            if (
                event.key === "Escape" &&
                !menu.hidden
            ) {

                closeAccountMenu();
                toggle.focus();

            }

        });

        // ======================================
        // 5. CHỌN MỤC TRONG MENU
        // ======================================

        menu.querySelectorAll("a").forEach(function (link) {

            link.addEventListener("click", function () {
                closeAccountMenu();
            });

        });

        // ======================================
        // 6. ĐĂNG XUẤT
        // ======================================

        logout?.addEventListener("click", async function () {

            const auth = window.EduTrackAuth;

            if (typeof auth?.logout !== "function") {
                return;
            }

            try {

                logout.disabled = true;

                await auth.logout();

                closeAccountMenu();

                // Chuyển đến trang đăng nhập
                location.href = getURL(
                    "pages/login.html"
                );

            } catch (error) {

                console.error(
                    "Đăng xuất thất bại:",
                    error
                );

                logout.disabled = false;

            }

        });

        // ======================================
        // 7. ĐỒNG BỘ KHI TRẠNG THÁI AUTH THAY ĐỔI
        // ======================================

        window.addEventListener(
            "et:auth-changed",
            function () {

                updateAccount();
                closeAccountMenu();

            }
        );

        // ======================================
        // 8. HIỂN THỊ BAN ĐẦU
        // ======================================

        closeAccountMenu();
        updateAccount();

    }


    /* ==========================================
       12. BỘ LỌC MÔN HỌC
    ========================================== */

    function syncCourseFilter() {
    const page = getCurrentPage();

    if (page.file !== "courses.html") return;

    const category = page.category || "all";

    // Chuyển tab đang chọn
    mainContent.querySelectorAll(
        ".filter-btn[data-filter]"
    ).forEach(button => {
        const active = button.dataset.filter === category;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    // Lọc môn học theo danh mục
    mainContent.querySelectorAll(
        "[data-course-category]"
    ).forEach(card => {
        const categories = (
            card.dataset.courseCategory || ""
        ).split(/[\s,]+/);

        card.hidden = category !== "all" &&
            !categories.includes(category);
    });
}

/* ==========================================
   TẢI FONT AWESOME DÙNG CHUNG
========================================== */

function loadFontAwesome() {
    const cssURL =
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css";

    // Kiểm tra xem Font Awesome đã được tải chưa
    const existing = document.querySelector(
        'link[data-et-fontawesome]'
    );

    if (existing) return;

    const link = document.createElement("link");

    link.rel = "stylesheet";
    link.href = cssURL;
    link.dataset.etFontawesome = "true";

    document.head.appendChild(link);
}

    /* ==========================================
       13. KHỞI TẠO WEBSITE
    ========================================== */

    async function init() {

        // Tải Font Awesome dùng chung
        loadFontAwesome();

        // Tự động tạo vùng chứa Header + Sidebar
        navRoot = document.querySelector(".et-navigation-root");

        if (!navRoot) {
            navRoot = document.createElement("div");
            navRoot.className = "et-navigation-root";
            document.body.prepend(navRoot);
        }

        // Lấy vùng nội dung chính
        mainContent = document.querySelector("#main-content");

        if (!navRoot || !mainContent) {
            console.error(
                "Thiếu .et-navigation-root hoặc #main-content"
            );
            return;
        }

        // Chuẩn hóa tài nguyên ban đầu
        fixContentPaths(mainContent, location.href);

        registerInitialAssets();

        try {
            // KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP

            await initializeAuth();

            // =====================================
            // HEADER + SIDEBAR CHỈ TẢI MỘT LẦN
            // =====================================

            await loadNavigation();

            updateActiveMenu();
            updateBreadcrumb();

            // Bắt click các link nội bộ
            document.addEventListener(
                "click",
                handleLinkClick
            );
            
            document.addEventListener("click", event => {
                if (!(event.target instanceof Element)) return;

                const button = event.target.closest(
                    "#main-content .filter-btn[data-filter]"
                );

                if (!button) return;

                event.preventDefault();

                const category = button.dataset.filter;

                const url = new URL(location.href);

                if (category === "all") {
                    url.searchParams.delete("category");
                } else {
                    url.searchParams.set("category", category);
                }

                if (url.href !== location.href) {
                    history.pushState(
                        { edutrack: true },
                        "",
                        url.href
                    );
                }

                syncCourseFilter();
                updateActiveMenu();
                updateBreadcrumb();
            });

            // Nút Back / Forward
            window.addEventListener(
                "popstate",
                () => navigate(location.href, false)
            );

            // API điều hướng cho các JS khác
            window.EduTrackRouter = {
                navigate,
                rootURL: ROOT.href
            };

            // Sự kiện cho trang đầu tiên
            document.dispatchEvent(
                new CustomEvent("edutrack:page-loaded", {
                    detail: {
                        ...getCurrentPage(),
                        url: location.href
                    }
                })
            );

            syncCourseFilter();

        } catch (error) {
            console.error(
                "Lỗi khởi tạo EduTrack:",
                error
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }
})();
