document.addEventListener("DOMContentLoaded", function () {
    const toggle = document.querySelector(".et-nav-toggle");
    const menu = document.querySelector("#et-primary-nav");

    if (!toggle || !menu) return;

    // Mở và đóng menu
    toggle.addEventListener("click", function () {
        const isOpen = menu.classList.toggle("is-open");

        toggle.setAttribute("aria-expanded", isOpen);

        toggle.setAttribute(
            "aria-label",
            isOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"
        );
    });

    // Đóng menu khi chọn một mục
    menu.querySelectorAll("li:not(.button) a").forEach(function (link) {
        link.addEventListener("click", function () {
            menu.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Mở menu điều hướng");
        });
    });

    // Đóng menu bằng phím Escape
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            menu.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Mở menu điều hướng");
            toggle.focus();
        }
    });
});



/* === Header / Sidebar === */

/* ==================================================
   EDUTRACK - MAIN.JS
   Header + Sidebar cố định, chỉ thay đổi nội dung
================================================== */

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
        "advising-contact.html": ["Tư vấn", "advising"],
        "about.html": ["Giới thiệu", "about"],
        "profile.html": ["Thông tin cá nhân", "profile"],
        "progress.html": ["Tiến độ học tập", "progress"],
        "csbm.html": ["Chính sách bảo mật", "privacy"],
        "DieuKhoanSuDung.html": ["Điều khoản sử dụng", "terms"],
        "bqtl.html": ["Bản quyền tài liệu", "copyright"],
        "login.html": ["Đăng nhập", ""],
        "register.html": ["Đăng ký", ""]
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

    function updateBreadcrumb() {
        const container = navRoot.querySelector(
            ".et-topbar-history"
        );

        if (!container) return;

        const page = getCurrentPage();

        const items = [
            {
                title: "Trang chủ",
                href: getURL("index.html")
            }
        ];

        if (page.file === "courses.html") {
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
        } else if (page.file === "course-detail.html") {
            items.push({
                title: "Môn học",
                href: getURL("pages/courses.html")
            });

            items.push({
                title: page.title,
                href: location.href
            });
        } else if (page.file !== "index.html") {
            items.push({
                title: page.title,
                href: location.href
            });
        }

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
                element.className = "et-history-current";
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
            ".et-submenu-toggle"
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
       11. TÀI KHOẢN
    ========================================== */

    function updateAccount() {
        const guest = navRoot.querySelector(
            ".et-account-guest"
        );

        const user = navRoot.querySelector(
            ".et-account-user"
        );

        const logout = navRoot.querySelector(
            ".et-logout-btn"
        );

        const auth = window.EduTrackAuth;

        const loggedIn =
            typeof auth?.isLoggedIn === "function" &&
            auth.isLoggedIn() === true;

        if (guest) guest.hidden = loggedIn;
        if (user) user.hidden = !loggedIn;

        if (logout) {
            logout.hidden =
                typeof auth?.logout !== "function";
        }
    }

    function initAccount() {
        updateAccount();

        const logout = navRoot.querySelector(
            ".et-logout-btn"
        );

        logout?.addEventListener("click", async () => {
            const auth = window.EduTrackAuth;

            if (typeof auth?.logout !== "function") return;

            try {
                await auth.logout();

                // Trang đăng nhập được mở lại sau logout
                location.href = getURL("pages/login.html");
            } catch (error) {
                console.error("Đăng xuất thất bại:", error);
            }
        });
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
            // HEADER + SIDEBAR CHỈ TẢI MỘT LẦN
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
