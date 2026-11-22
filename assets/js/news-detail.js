"use strict";
(function () {

    // 1. LẤY ĐƯỜNG DẪN GỐC
    function getRootURL() {
        return window.EduTrackRouter?.rootURL ||
            new URL("../", window.location.href).href;
    }

    // 2. ĐỊNH DẠNG NGÀY
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

    // 3. TẠO PHẦN TỬ HTML
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

    // 4. KHỞI TẠO TRANG CHI TIẾT
    async function initNewsDetail() {

        const articleElement = document.querySelector(
            "#et-detail-article"
        );

        const status = document.querySelector(
            "#et-detail-status"
        );

        const relatedSection = document.querySelector(
            "#et-related-section"
        );

        const relatedList = document.querySelector(
            "#et-related-list"
        );

        if (
            !articleElement ||
            !status ||
            !relatedSection ||
            !relatedList
        ) {
            return;
        }

        // Tránh chạy hai lần trên cùng nội dung
        if (
            articleElement.dataset.initialized === "true"
        ) {
            return;
        }

        articleElement.dataset.initialized = "true";

        const rootURL = getRootURL();

        // Lấy ID từ URL
        const params = new URLSearchParams(
            window.location.search
        );

        const id = Number(params.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
            status.textContent = "Đường dẫn bài viết không hợp lệ.";
            return;
        }

        // Hàm tạo đường dẫn ảnh
        function getImageURL(path) {

            return new URL(
                path,
                new URL("pages/news-detail.html", rootURL)
            ).href;

        }

        // 5. HIỂN THỊ NỘI DUNG BÀI VIẾT
        function renderContent(blocks) {

            const container = document.querySelector(
                "#et-detail-body"
            );

            container.replaceChildren();

            if (!Array.isArray(blocks)) return;

            blocks.forEach(function (block) {

                if (!block || !block.type) return;

                let element;

                switch (block.type) {

                    case "heading":

                        element = createElement(
                            "h2",
                            "",
                            block.text || ""
                        );

                        break;

                    case "paragraph":

                        element = createElement(
                            "p",
                            "",
                            block.text || ""
                        );

                        break;

                    case "note":

                        element = createElement(
                            "div",
                            "et-detail-note",
                            block.text || ""
                        );

                        break;

                    case "list":

                        element = createElement("ul");

                        if (Array.isArray(block.items)) {

                            block.items.forEach(function (item) {

                                const li = createElement(
                                    "li",
                                    "",
                                    item
                                );

                                element.append(li);

                            });

                        }

                        break;

                    case "image":

                        if (
                            typeof block.src !== "string" ||
                            !block.src.startsWith("../assets/images/news/")
                        ) {
                            break;
                        }

                        element = createElement(
                            "img",
                            "et-detail-body-image img-fluid"
                        );

                        element.src = getImageURL(block.src);
                        element.alt = block.alt || "";
                        element.loading = "lazy";

                        break;

                    default:
                        break;
                }

                if (element) {
                    container.append(element);
                }

            });
        }

        // 6. HIỂN THỊ TIN TỨC LIÊN QUAN
        function renderRelated(article, news) {

            relatedList.replaceChildren();

            // Lấy tối đa 3 bài viết khác bài hiện tại
            const relatedArticles = news
                .filter(item => item.id !== article.id)
                .slice(0, 3);

            if (relatedArticles.length === 0) {
                relatedSection.hidden = true;
                return;
            }

            relatedArticles.forEach(function (item) {

                const col = createElement(
                    "div",
                    "col-12 col-md-6 col-lg-4"
                );

                const link = createElement(
                    "a",
                    "et-related-card"
                );

                link.href = new URL(
                    "pages/news-detail.html?id=" +
                        encodeURIComponent(item.id),
                    rootURL
                ).href;

                // Ảnh
                const image = createElement(
                    "img",
                    "et-related-card-image"
                );

                image.src = getImageURL(item.image);
                image.alt = item.title;
                image.loading = "lazy";

                // Thông tin
                const body = createElement(
                    "div",
                    "et-related-card-body"
                );

                const title = createElement(
                    "h3",
                    "et-related-card-title",
                    item.title
                );

                const time = createElement(
                    "time",
                    "et-related-card-date",
                    formatDate(item.date)
                );

                time.dateTime = item.date;

                body.append(title, time);
                link.append(image, body);
                col.append(link);

                relatedList.append(col);

            });

            relatedSection.hidden = false;
        }

        // 7. TẢI JSON VÀ HIỂN THỊ BÀI VIẾT
        try {

            const jsonURL = new URL(
                "assets/data/news.json",
                rootURL
            );

            const response = await fetch(jsonURL);

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const news = await response.json();

            if (!Array.isArray(news)) {
                throw new Error("Dữ liệu JSON không hợp lệ");
            }

            // Kiểm tra xem trang hiện tại đã bị thay chưa
            if (
                document.querySelector("#et-detail-article") !==
                articleElement
            ) {
                return;
            }

            // Tìm bài viết theo ID
            const article = news.find(item =>
                item.id === id
            );

            if (!article) {
                status.textContent = "Không tìm thấy bài viết.";
                return;
            }

            // Tiêu đề trình duyệt
            document.title = article.title + " - EduTrack";

            // Tiêu đề bài viết
            document.querySelector(
                "#et-detail-title"
            ).textContent = article.title;

            // Ngày đăng
            const date = document.querySelector(
                "#et-detail-date"
            );

            date.textContent = formatDate(article.date);
            date.dateTime = article.date;

            // Ảnh đại diện
            const image = document.querySelector(
                "#et-detail-image"
            );

            image.src = getImageURL(article.image);
            image.alt = article.title;

            // Nội dung riêng
            renderContent(article.content);

            // Hiển thị bài viết
            status.hidden = true;
            articleElement.hidden = false;

            // Hiển thị tin liên quan
            renderRelated(article, news);

        } catch (error) {

            console.error("Lỗi tải chi tiết tin tức:", error);

            if (
                document.querySelector("#et-detail-article") !==
                articleElement
            ) {
                return;
            }

            status.textContent =
                "Không thể tải bài viết. Vui lòng thử lại.";

        }

    }

    // 8. KHỞI TẠO KHI MỞ TRỰC TIẾP
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initNewsDetail
        );
    } else {
        initNewsDetail();
    }

    // 9. KHỞI TẠO KHI SPA CHUYỂN TRANG
    document.addEventListener(
        "edutrack:page-loaded",
        initNewsDetail
    );

})();
