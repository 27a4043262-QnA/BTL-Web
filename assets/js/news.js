
"use strict";

// =============================================
// EDUTRACK - DANH SÁCH TIN TỨC
// =============================================

(function () {

    const PAGE_SIZE = 6;

    // Lấy đường dẫn gốc website
    function getRootURL() {
        return window.EduTrackRouter?.rootURL ||
            new URL("../", window.location.href).href;
    }

    // Định dạng ngày tháng
    function formatDate(value) {
        const date = new Date(value + "T00:00:00");

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date);
    }

    // Tạo phần tử HTML
    function createElement(tag, className = "", text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    // Khởi tạo trang tin tức
    async function initNews() {

        const newsList = document.querySelector("#et-news-list");
        const pagination = document.querySelector("#et-news-pages");

        if (!newsList || !pagination) return;

        // Tránh khởi tạo hai lần trên cùng một trang
        if (newsList.dataset.initialized === "true") return;

        newsList.dataset.initialized = "true";

        const rootURL = getRootURL();

        let articles = [];
        let currentPage = 1;

        // Tạo một thẻ tin tức
        function createNewsCard(article) {

            const col = createElement(
                "div",
                "col-12 col-md-6 col-lg-4"
            );

            const card = createElement(
                "a",
                "et-news-card"
            );

            card.href = new URL(
                "pages/news-detail.html?id=" +
                    encodeURIComponent(article.id),
                rootURL
            ).href;

            // Hình ảnh
            const image = createElement(
                "img",
                "et-news-card-image"
            );

            image.src = new URL(
                article.image,
                new URL("pages/news.html", rootURL)
            ).href;

            image.alt = article.title;
            image.loading = "lazy";

            // Nội dung
            const body = createElement(
                "div",
                "et-news-card-body"
            );

            const title = createElement(
                "h2",
                "et-news-card-title",
                article.title
            );

            const description = createElement(
                "p",
                "et-news-card-description",
                article.summary || ""
            );

            const date = createElement(
                "div",
                "et-news-card-date"
            );

            const icon = createElement(
                "i",
                "far fa-calendar-alt"
            );

            icon.setAttribute("aria-hidden", "true");

            const time = createElement(
                "time",
                "",
                formatDate(article.date)
            );

            time.dateTime = article.date;

            date.append(icon, time);
            body.append(title, description, date);
            card.append(image, body);
            col.append(card);

            return col;
        }

        // Tạo một nút phân trang
        function createPageButton(
            label,
            targetPage,
            disabled = false,
            active = false
        ) {

            const item = createElement("li", "page-item");

            if (disabled) {
                item.classList.add("disabled");
            }

            if (active) {
                item.classList.add("active");
            }

            const button = createElement(
                "button",
                "page-link",
                label
            );

            button.type = "button";
            button.disabled = disabled;

            if (label === "«") {
                button.setAttribute("aria-label", "Trang trước");
            } else if (label === "»") {
                button.setAttribute("aria-label", "Trang sau");
            } else {
                button.setAttribute("aria-label", "Trang " + label);
            }

            if (active) {
                button.setAttribute("aria-current", "page");
            }

            button.addEventListener("click", function () {

                if (disabled || active) return;

                currentPage = targetPage;

                renderNews();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            });

            item.append(button);

            return item;
        }

        // Hiển thị danh sách và phân trang
        function renderNews() {

            newsList.replaceChildren();
            pagination.replaceChildren();

            if (articles.length === 0) {

                const message = createElement(
                    "p",
                    "et-news-message",
                    "Hiện chưa có bài viết nào."
                );

                const col = createElement("div", "col-12");

                col.append(message);
                newsList.append(col);

                return;
            }

            const totalPages = Math.ceil(
                articles.length / PAGE_SIZE
            );

            currentPage = Math.min(
                Math.max(currentPage, 1),
                totalPages
            );

            const start = (currentPage - 1) * PAGE_SIZE;

            const currentArticles = articles.slice(
                start,
                start + PAGE_SIZE
            );

            // Hiển thị bài viết
            currentArticles.forEach(article => {
                newsList.append(createNewsCard(article));
            });

            // Không phân trang nếu chỉ có một trang
            if (totalPages <= 1) return;

            // Nút trước
            pagination.append(
                createPageButton(
                    "«",
                    currentPage - 1,
                    currentPage === 1
                )
            );

            // Nút số trang
            for (let page = 1; page <= totalPages; page++) {

                pagination.append(
                    createPageButton(
                        String(page),
                        page,
                        false,
                        page === currentPage
                    )
                );

            }

            // Nút sau
            pagination.append(
                createPageButton(
                    "»",
                    currentPage + 1,
                    currentPage === totalPages
                )
            );
        }

        // Tải JSON
        try {

            const jsonURL = new URL(
                "assets/data/news.json",
                rootURL
            );

            const response = await fetch(jsonURL);

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error("Dữ liệu JSON không hợp lệ");
            }

            // Không render nếu người dùng đã chuyển trang
            if (
                document.querySelector("#et-news-list") !== newsList
            ) {
                return;
            }

            articles = data
                .filter(item =>
                    item &&
                    Number.isInteger(item.id) &&
                    typeof item.title === "string" &&
                    typeof item.date === "string" &&
                    typeof item.image === "string"
                )
                .sort((a, b) =>
                    b.date.localeCompare(a.date)
                );

            renderNews();

        } catch (error) {

            console.error("Lỗi tải tin tức:", error);

            if (
                document.querySelector("#et-news-list") !== newsList
            ) {
                return;
            }

            const message = createElement(
                "p",
                "et-news-message",
                "Không thể tải danh sách tin tức."
            );

            const col = createElement("div", "col-12");

            col.append(message);
            newsList.replaceChildren(col);
        }

    }

    // Mở trực tiếp hoặc reload trang
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initNews
        );
    } else {
        initNews();
    }

    // Chuyển trang bằng SPA
    document.addEventListener(
        "edutrack:page-loaded",
        initNews
    );

})();
