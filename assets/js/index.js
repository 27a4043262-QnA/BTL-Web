"use strict";

(function () {

    let authEventRegistered = false;

    // Đánh dấu lần tải tin tức hiện tại
    let homeNewsRequest = 0;

    /* ==========================================
       1. KHỞI TẠO TRANG CHỦ
    ========================================== */

    function etInitHome() {

        // Chỉ chạy khi đang ở trang chủ
        const homeNews = document.querySelector(
            "#main-content #et-home-news-list"
        );

        if (!homeNews) return;

        etInitHomeAuth();
        etInitGpaDashboard();
        etInitHomeNews();

    }

    /* ==========================================
       2. TRẠNG THÁI ĐĂNG NHẬP
    ========================================== */

    function etInitHomeAuth() {

        // Đăng ký sự kiện một lần
        if (!authEventRegistered) {

            window.addEventListener(
                "et:auth-changed",
                etUpdateHomeUI
            );

            authEventRegistered = true;
        }

        etUpdateHomeUI();
    }

    function etUpdateHomeUI() {

        const gpaIntro = document.querySelector(
            "#main-content .gpa.et-section"
        );

        const gpaDashboard = document.querySelector(
            "#main-content .gpa-dashboard"
        );

        const ctaSection = document.querySelector(
            "#main-content .cta"
        );

        if (!gpaIntro || !gpaDashboard) return;

        // Lấy trạng thái đăng nhập
        const auth = window.EduTrackAuth;

        const isLoggedIn =
            typeof auth?.isLoggedIn === "function" &&
            auth.isLoggedIn() === true;

        // Khách: hiển thị giới thiệu GPA
        // Đã đăng nhập: hiển thị Dashboard
        gpaIntro.hidden = isLoggedIn;
        gpaDashboard.hidden = !isLoggedIn;

        // CTA chỉ hiện khi chưa đăng nhập
        if (ctaSection) {
            ctaSection.hidden = isLoggedIn;
        }

        // Thông báo dữ liệu GPA minh họa
        if (isLoggedIn) {

            let note = gpaDashboard.querySelector(
                ".et-demo-note"
            );

            if (!note) {

                note = document.createElement("p");

                note.className = "et-demo-note";

                note.textContent =
                    "Dữ liệu minh họa. GPA cá nhân sẽ được hiển thị khi kết nối dữ liệu học tập.";

                const container =
                    gpaDashboard.querySelector(".et-container");

                const grid =
                    gpaDashboard.querySelector(".gpa-dashboard-grid");

                if (container && grid) {
                    container.insertBefore(note, grid);
                }
            }
        }
    }

    /* ==========================================
       3. KHỞI TẠO GPA DASHBOARD
    ========================================== */

    function etInitGpaDashboard() {

        const dashboard = document.querySelector(
            "#main-content .gpa-dashboard"
        );

        if (!dashboard) return;

        const gpaValueElement = dashboard.querySelector(
            ".gpa-value"
        );

        const gpaChart = dashboard.querySelector(
            ".gpa-chart"
        );

        if (!gpaValueElement || !gpaChart) return;

        // GPA mẫu đang hiển thị trong HTML
        const currentGpa = Number(
            gpaValueElement.textContent.trim()
        );

        const maxGpa = 4.0;

        if (Number.isFinite(currentGpa)) {

            // Giới hạn GPA trong khoảng 0 - 4
            const validGpa = Math.max(
                0,
                Math.min(currentGpa, maxGpa)
            );

            const percent = (validGpa / maxGpa) * 100;

            // Cập nhật biểu đồ tròn GPA
            gpaChart.style.setProperty(
                "--percent",
                percent + "%"
            );

            // Hỗ trợ trình đọc màn hình
            gpaChart.setAttribute("role", "img");

            gpaChart.setAttribute(
                "aria-label",
                `GPA minh họa: ${validGpa.toFixed(2)} trên ${maxGpa.toFixed(1)}`
            );

        }

        // Cập nhật thống kê môn học
        etUpdateCourseStatistics(dashboard);
    }

    /* ==========================================
       4. THỐNG KÊ MÔN HỌC
    ========================================== */

    function etUpdateCourseStatistics(dashboard) {

        const rows = Array.from(
            dashboard.querySelectorAll(
                ".course-table tbody tr"
            )
        );

        const summaryValues = dashboard.querySelectorAll(
            ".gpa-summary strong"
        );

        if (
            rows.length === 0 ||
            summaryValues.length < 4
        ) {
            return;
        }

        let totalCredits = 0;
        let passedCourses = 0;
        let failedCourses = 0;
        let validRows = 0;

        rows.forEach(function (row) {

            const cells = row.querySelectorAll("td");

            // STT, Mã, Tên, Tín chỉ,
            // Điểm tổng kết, Xếp loại, Điểm dự phóng
            if (cells.length < 7) return;

            const credits = Number(
                cells[3].textContent.trim()
            );

            const grade = cells[5].textContent
                .trim()
                .toUpperCase();

            if (
                !Number.isFinite(credits) ||
                credits < 0
            ) {
                return;
            }

            validRows++;

            totalCredits += credits;

            // F: không đạt
            // A/B/C/D và các dấu +/-: đạt
            if (grade === "F") {

                failedCourses++;

            } else if (/^[ABCD][+-]?$/.test(grade)) {

                passedCourses++;

            }

        });

        // Cập nhật bốn chỉ số Dashboard
        summaryValues[0].textContent = totalCredits;
        summaryValues[1].textContent = validRows;
        summaryValues[2].textContent = passedCourses;
        summaryValues[3].textContent = failedCourses;
    }

    /* ==========================================
       5. ĐƯỜNG DẪN GỐC WEBSITE
    ========================================== */

    function etGetRootURL() {

        // Ưu tiên đường dẫn gốc do main.js cung cấp
        if (window.EduTrackRouter?.rootURL) {

            return window.EduTrackRouter.rootURL;

        }

        // Khi mở trực tiếp index.html
        const script = document.querySelector(
            'script[src$="index.js"]'
        );

        if (script) {

            return new URL("../../", script.src).href;

        }

        return new URL("./", window.location.href).href;
    }

    /* ==========================================
       6. TẠO THẺ TIN TỨC
    ========================================== */

    function etCreateHomeNewsCard(article, rootURL) {

        // Thẻ article
        const card = document.createElement("article");

        card.className = "news-card et-card";

        // Hình ảnh
        const image = document.createElement("img");

        // Đường dẫn ảnh trong JSON được khai báo
        // tương đối với pages/news.html
        const newsPageURL = new URL(
            "pages/news.html",
            rootURL
        );

        image.src = new URL(
            article.image,
            newsPageURL
        ).href;

        image.alt = article.title;
        image.width = 400;
        image.height = 170;
        image.loading = "lazy";

        // Tiêu đề
        const title = document.createElement("h3");

        title.textContent = article.title;

        // Mô tả
        const description = document.createElement("p");

        description.textContent = article.summary;

        // Liên kết đọc thêm
        const link = document.createElement("a");

        link.className = "read-more";
        link.textContent = "Đọc thêm →";

        link.href = new URL(
            "pages/news-detail.html?id=" +
                encodeURIComponent(article.id),
            rootURL
        ).href;

        link.setAttribute(
            "aria-label",
            "Đọc thêm: " + article.title
        );

        // Ghép thẻ
        card.append(
            image,
            title,
            description,
            link
        );

        return card;
    }

    /* ==========================================
       7. TẢI TIN TỨC TỪ JSON
    ========================================== */

    async function etInitHomeNews() {

        const newsList = document.querySelector(
            "#et-home-news-list"
        );

        const newsStatus = document.querySelector(
            "#et-home-news-status"
        );

        if (!newsList || !newsStatus) return;

        // Không khởi tạo lặp trên cùng nội dung
        if (
            newsList.dataset.initialized === "true"
        ) {
            return;
        }

        newsList.dataset.initialized = "true";

        const requestNumber = ++homeNewsRequest;

        const rootURL = etGetRootURL();

        // Trạng thái loading
        newsStatus.hidden = false;

        newsStatus.textContent =
            "Đang tải tin tức nổi bật...";

        newsList.replaceChildren();

        try {

            // Đường dẫn tới JSON có sẵn
            const jsonURL = new URL(
                "assets/data/news.json",
                rootURL
            );

            // Tải dữ liệu bằng fetch (AJAX)
            const response = await fetch(jsonURL);

            if (!response.ok) {

                throw new Error(
                    "HTTP " + response.status
                );

            }

            const data = await response.json();

            // Kiểm tra định dạng JSON
            if (!Array.isArray(data)) {

                throw new Error(
                    "Dữ liệu JSON phải là một mảng"
                );

            }

            // Kiểm tra còn ở đúng trang chủ không
            if (
                requestNumber !== homeNewsRequest ||
                document.querySelector(
                    "#et-home-news-list"
                ) !== newsList
            ) {
                return;
            }

            // Lọc các bản ghi hợp lệ
            const validArticles = data.filter(function (item) {

                return (
                    item &&
                    Number.isInteger(item.id) &&
                    typeof item.title === "string" &&
                    typeof item.summary === "string" &&
                    typeof item.date === "string" &&
                    typeof item.image === "string"
                );

            });

            // Sắp xếp mới nhất trước
            validArticles.sort(function (a, b) {

                return b.date.localeCompare(a.date);

            });

            // Lấy tối đa 3 bài
            const featuredArticles = validArticles.slice(
                0,
                3
            );

            // Trạng thái không có dữ liệu
            if (featuredArticles.length === 0) {

                newsStatus.textContent =
                    "Hiện chưa có tin tức nổi bật.";

                return;
            }

            // Tạo danh sách bằng DOM
            const fragment = document.createDocumentFragment();

            featuredArticles.forEach(function (article) {

                const card = etCreateHomeNewsCard(
                    article,
                    rootURL
                );

                fragment.appendChild(card);

            });

            // Cập nhật giao diện
            newsList.replaceChildren(fragment);

            // Ẩn trạng thái loading
            newsStatus.hidden = true;

        } catch (error) {

            console.error(
                "Lỗi tải tin tức trang chủ:",
                error
            );

            // Không cập nhật nếu đã chuyển trang
            if (
                requestNumber !== homeNewsRequest ||
                document.querySelector(
                    "#et-home-news-list"
                ) !== newsList
            ) {
                return;
            }

            newsStatus.hidden = false;

            newsStatus.textContent =
                "Không thể tải tin tức. Vui lòng thử lại.";

        }

    }

    /* ==========================================
       8. KHỞI TẠO TRANG
    ========================================== */

    // Mở trang chủ trực tiếp hoặc reload
    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            etInitHome,
            { once: true }
        );

    } else {

        etInitHome();

    }

    // Khi main.js chuyển trang bằng SPA
    document.addEventListener(
        "edutrack:page-loaded",
        etInitHome
    );

})();
