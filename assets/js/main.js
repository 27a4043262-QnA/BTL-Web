
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



/* ==========================================
   EDUTRACK - MAIN.JS
   Header + Sidebar dùng chung
========================================== */

// File main.js nằm trong assets/js/
const etScriptURL = document.currentScript.src;
const etRootURL = new URL("../../", etScriptURL);

// Tên các trang
const etPages = {
    "index.html": "Trang chủ",
    "courses.html": "Môn học",
    "course-detail.html": "Chi tiết môn học",
    "gpa-calculator.html": "Tính GPA",
    "gpa-projection.html": "Dự phóng GPA",
    "advising-contact.html": "Tư vấn",
    "about.html": "Giới thiệu",
    "profile.html": "Thông tin cá nhân",
    "progress.html": "Tiến độ học tập",
    "csbm.html": "Chính sách bảo mật",
    "DieuKhoanSuDung.html": "Điều khoản sử dụng",
    "bqtl.html": "Bản quyền tài liệu",
    "login.html": "Đăng nhập"
};

const etCategories = {
    "dai-cuong": "Đại cương",
    "co-so-nganh": "Cơ sở ngành",
    "chuyen-nganh": "Chuyên ngành"
};

// Bắt đầu sau khi DOM được tải
document.addEventListener("DOMContentLoaded", function () {
    etLoadNavigation();
});

/* ==========================================
   1. TẢI FILE NAVIGATION.HTML
========================================== */

async function etLoadNavigation() {
    const root = document.querySelector(".et-navigation-root");

    if (!root) return;

    try {
        const url = new URL(
            "pages/navigation.html",
            etRootURL
        );

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Không tải được navigation: " +
                response.status
            );
        }

        root.innerHTML = await response.text();

        // Chuẩn hóa toàn bộ liên kết
        etFixLinks(root);

        // Lịch sử trang
        etUpdateHistory(root);

        // Active trang hiện tại
        etSetActivePage(root);

        // Khởi tạo sidebar
        etInitSidebar(root);

        // Cập nhật trạng thái tài khoản
        etUpdateAccount(root);

        // Kích hoạt layout
        document.body.classList.add("et-has-navigation");

    } catch (error) {
        console.error("EduTrack Navigation:", error);
    }
}

/* ==========================================
   2. CHUẨN HÓA ĐƯỜNG DẪN
========================================== */

function etFixLinks(root) {
    const links = root.querySelectorAll("[data-et-href]");

    links.forEach(function (link) {
        const url = new URL(
            link.dataset.etHref,
            etRootURL
        );

        const category = link.dataset.etCategory;

        if (category) {
            url.searchParams.set("category", category);
        }

        link.href = url.href;
    });
}

/* ==========================================
   3. TRANG HIỆN TẠI
========================================== */

function etGetCurrentPage() {
    const url = new URL(window.location.href);

    const fileName =
        url.pathname.split("/").pop() || "index.html";

    let title =
        etPages[fileName] || document.title || "EduTrack";

    const category = url.searchParams.get("category");

    if (
        fileName === "courses.html" &&
        Object.prototype.hasOwnProperty.call(
            etCategories,
            category
        )
    ) {
        title = etCategories[category];
    }

    return {
        fileName,
        title,
        category
    };
}

/* ==========================================
   4. LỊCH SỬ ĐIỀU HƯỚNG TRÊN HEADER
========================================== */

function etUpdateHistory(root) {
    const historyNav = root.querySelector(
        ".et-topbar-history"
    );

    if (!historyNav) return;

    const currentPage = etGetCurrentPage();

    const currentURL =
        window.location.pathname +
        window.location.search;

    let history = [];

    try {
        const saved = JSON.parse(
            sessionStorage.getItem("etNavigationHistory") || "[]"
        );

        if (Array.isArray(saved)) {
            history = saved.filter(function (item) {
                return item &&
                    typeof item.path === "string" &&
                    typeof item.title === "string" &&
                    item.path.startsWith("/") &&
                    !item.path.startsWith("//");
            });
        }
    } catch (error) {
        history = [];
    }

    // Trang đầu tiên trong lịch sử
    if (history.length === 0) {
        const home = new URL("index.html", etRootURL);

        history.push({
            title: "Trang chủ",
            path: home.pathname
        });
    }

    // Không thêm trùng nếu tải lại trang
    const lastPage = history[history.length - 1];

    if (lastPage.path !== currentURL) {
        history.push({
            title: currentPage.title,
            path: currentURL
        });
    } else {
        lastPage.title = currentPage.title;
    }

    // Hiển thị 5 trang gần nhất
    history = history.slice(-5);

    try {
        sessionStorage.setItem(
            "etNavigationHistory",
            JSON.stringify(history)
        );
    } catch (error) {
        // Trình duyệt có thể chặn sessionStorage
    }

    historyNav.replaceChildren();

    history.forEach(function (item, index) {

        if (index > 0) {
            const separator = document.createElement("span");

            separator.className = "et-history-separator";
            separator.textContent = "›";

            historyNav.appendChild(separator);
        }

        const isCurrent = index === history.length - 1;

        if (isCurrent) {
            const span = document.createElement("span");

            span.className = "et-history-current";
            span.textContent = item.title;
            span.setAttribute("aria-current", "page");

            historyNav.appendChild(span);

        } else {
            const link = document.createElement("a");

            link.href = item.path;
            link.textContent = item.title;

            historyNav.appendChild(link);
        }
    });

    // Cuộn tới mục mới nhất
    historyNav.scrollLeft = historyNav.scrollWidth;
}

/* ==========================================
   5. ĐÁNH DẤU TRANG ĐANG XEM
========================================== */

function etSetActivePage(root) {
    const page = etGetCurrentPage();

    const pageKeys = {
        "index.html": "home",
        "gpa-calculator.html": "gpa",
        "gpa-projection.html": "projection",
        "advising-contact.html": "advising",
        "about.html": "about",
        "profile.html": "profile",
        "progress.html": "progress",
        "csbm.html": "privacy",
        "DieuKhoanSuDung.html": "terms",
        "bqtl.html": "copyright"
    };

    const key = pageKeys[page.fileName];

    // Đánh dấu các link chính
    root.querySelectorAll("[data-et-page]").forEach(
        function (link) {
            if (link.dataset.etPage === key) {
                link.classList.add("et-active");
                link.setAttribute("aria-current", "page");
            }
        }
    );

    // Môn học: đánh dấu nút cha
    if (
        page.fileName === "courses.html" ||
        page.fileName === "course-detail.html"
    ) {
        const coursesButton = root.querySelector(
            '[data-et-submenu="courses"]'
        );

        if (coursesButton) {
            coursesButton.classList.add("et-active");
        }
    }

    // Đánh dấu danh mục cụ thể
    if (page.fileName === "courses.html" && page.category) {
        root.querySelectorAll("[data-et-category]").forEach(
            function (link) {
                if (link.dataset.etCategory === page.category) {
                    link.classList.add("et-active");
                    link.setAttribute("aria-current", "page");
                }
            }
        );
    }
}

/* ==========================================
   6. SIDEBAR MỞ RỘNG / THU GỌN
========================================== */

function etInitSidebar(root) {
    const sidebar = root.querySelector(".et-sidebar");

    const menuButton = root.querySelector(
        ".et-menu-toggle"
    );

    const overlay = root.querySelector(
        ".et-sidebar-overlay"
    );

    const submenuButtons = root.querySelectorAll(
        ".et-submenu-toggle"
    );

    if (!sidebar || !menuButton) return;

    // Sidebar mặc định thu gọn
    let expanded = false;

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

        menuButton.setAttribute(
            "aria-expanded",
            String(expanded)
        );

        menuButton.setAttribute(
            "aria-label",
            expanded ? "Thu gọn menu" : "Mở rộng menu"
        );

        if (overlay) {
            overlay.classList.toggle(
                "et-show",
                expanded && window.innerWidth <= 767
            );
        }

        // Khi thu gọn, ẩn các submenu
        if (!expanded) {
            submenuButtons.forEach(function (button) {
                button.setAttribute("aria-expanded", "false");
            });

            root.querySelectorAll(
                ".et-sidebar-submenu"
            ).forEach(function (submenu) {
                submenu.classList.remove("et-show");
            });
        }
    }

    // Nhấn hamburger
    menuButton.addEventListener("click", function () {
        setExpanded(!expanded);
    });

    /* ======================================
       7. MENU CON MÔN HỌC / TÀI KHOẢN
    ====================================== */

    submenuButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const name = button.dataset.etSubmenu;

            const submenu = Array.from(
                root.querySelectorAll(
                    "[data-et-submenu-content]"
                )
            ).find(function (item) {
                return item.dataset.etSubmenuContent === name;
            });

            if (!submenu) return;

            // Tự mở rộng Sidebar nếu đang thu gọn
            if (!expanded) {
                setExpanded(true);
            }

            const willOpen =
                !submenu.classList.contains("et-show");

            submenu.classList.toggle(
                "et-show",
                willOpen
            );

            button.setAttribute(
                "aria-expanded",
                String(willOpen)
            );
        });
    });

    /* ======================================
       8. ĐÓNG SIDEBAR TRÊN MOBILE
    ====================================== */

    if (overlay) {
        overlay.addEventListener("click", function () {
            setExpanded(false);
        });
    }

    // Nhấn Escape
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && expanded) {
            setExpanded(false);
            menuButton.focus();
        }
    });

    // Đổi kích thước màn hình
    window.addEventListener("resize", function () {
        if (overlay) {
            overlay.classList.toggle(
                "et-show",
                expanded && window.innerWidth <= 767
            );
        }
    });

    // Trên mobile, click link sẽ đóng Sidebar
    root.querySelectorAll(".et-sidebar a").forEach(
        function (link) {
            link.addEventListener("click", function () {
                if (window.innerWidth <= 767) {
                    setExpanded(false);
                }
            });
        }
    );
}

/* ==========================================
   9. TRẠNG THÁI TÀI KHOẢN
========================================== */

function etUpdateAccount(root) {
    const guestMenu = root.querySelector(
        ".et-account-guest"
    );

    const userMenu = root.querySelector(
        ".et-account-user"
    );

    const logoutButton = root.querySelector(
        ".et-logout-btn"
    );

    if (!guestMenu || !userMenu) return;

    // API xác thực dự kiến của EduTrack.
    // Nhóm sẽ kết nối với chức năng đăng nhập thật.
    const auth = window.EduTrackAuth;

    const isLoggedIn =
        typeof auth?.isLoggedIn === "function" &&
        auth.isLoggedIn() === true;

    guestMenu.hidden = isLoggedIn;
    userMenu.hidden = !isLoggedIn;

    if (!logoutButton) return;

    // Chỉ hiện nút đăng xuất khi có chức năng logout
    const canLogout =
        typeof auth?.logout === "function";

    logoutButton.hidden = !canLogout;

    if (canLogout) {
        logoutButton.addEventListener(
            "click",
            async function () {
                try {
                    await auth.logout();

                    window.location.href = new URL(
                        "pages/login.html",
                        etRootURL
                    ).href;

                } catch (error) {
                    console.error(
                        "Không thể đăng xuất:",
                        error
                    );
                }
            }
        );
    }
}
