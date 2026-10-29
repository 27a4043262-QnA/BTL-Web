
document.addEventListener("DOMContentLoaded", function () {
    // ===== 1. LẤY CÁC PHẦN TỬ HTML =====

    const form = document.getElementById("course-review-form");
    const field = document.getElementById("review-content");
    const counter = document.getElementById("review-count");
    const message = document.getElementById("review-error");
    const list = document.getElementById("review-list");
    const toggleReviews = document.getElementById("toggle-reviews");
    const reviewModal = document.getElementById("reviewModal");

    if (!form || !field || !counter || !message || !list) {
        return;
    }

    // ===== 2. LƯU TRỮ ĐÁNH GIÁ =====

    // Mã riêng cho môn học, tránh lẫn với môn khác
    const STORAGE_KEY = "edutrack_reviews_MATH101";

    let reviews = [];
    let showAllReviews = false;

    // Đọc các đánh giá đã lưu
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        if (Array.isArray(saved)) {
            reviews = saved.filter(function (review) {
                return (
                    review &&
                    typeof review.id === "string" &&
                    typeof review.fullName === "string" &&
                    typeof review.content === "string" &&
                    typeof review.date === "string" &&
                    !isNaN(new Date(review.date).getTime())
                );
            });
        }
    } catch (error) {
        reviews = [];
    }

    // Lưu danh sách đánh giá
    function saveReviews() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(reviews)
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    // ===== 3. LẤY THÔNG TIN SINH VIÊN =====

    function getCurrentStudent() {
        const account = document.querySelector(
            ".account-menu .student-name"
        );

        if (!account) {
            return null;
        }

        const menu = account.closest(".account-menu");
        const parent = menu ? menu.closest("li") : null;

        if (
            (menu && menu.hidden) ||
            (parent && parent.hidden)
        ) {
            return null;
        }

        const fullName = account.textContent.trim();

        if (!fullName) {
            return null;
        }

        return {
            fullName: fullName
        };
    }

    // Tạo chữ viết tắt cho avatar
    function getInitials(fullName) {
        return fullName
            .trim()
            .split(/\s+/)
            .slice(-2)
            .map(function (word) {
                return word.charAt(0).toUpperCase();
            })
            .join("");
    }

    // ===== 4. THÔNG BÁO VÀ ĐẾM KÝ TỰ =====

    function showMessage(text, success = false) {
        message.textContent = text;
        message.classList.toggle("success", success);
    }

    function updateCounter() {
        counter.textContent = field.value.length + "/500 ký tự";

        showMessage("");
        field.classList.remove("is-invalid");
    }

    field.addEventListener("input", updateCounter);

    // ===== 5. XEM THÊM / THU GỌN ĐÁNH GIÁ =====

    function updateReviewVisibility() {
        const items = Array.from(list.children);

        items.forEach(function (item, index) {
            const shouldHide = !showAllReviews && index >= 3;

            item.hidden = shouldHide;
            item.style.display = shouldHide ? "none" : "";
        });

        if (toggleReviews) {
            toggleReviews.hidden = false;
            toggleReviews.disabled = items.length <= 3;

            toggleReviews.textContent = items.length <= 3
                ? "Đã hiển thị tất cả đánh giá"
                : showAllReviews
                    ? "Thu gọn "
                    : "Xem thêm ";

            toggleReviews.setAttribute(
                "aria-expanded",
                String(showAllReviews)
            );
        }
    }

    if (toggleReviews) {
        toggleReviews.addEventListener("click", function () {
            showAllReviews = !showAllReviews;
            updateReviewVisibility();
        });
    }

    // ===== 6. TẠO THẺ ĐÁNH GIÁ =====

    function renderReview(review) {
        // Cột Bootstrap
        const col = document.createElement("div");
        col.className = "col-12 col-md-6 col-xl-4";

        // Thẻ đánh giá
        const card = document.createElement("article");

        // Thông tin sinh viên
        const author = document.createElement("div");
        author.className = "review-author";

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.textContent = getInitials(review.fullName);

        const info = document.createElement("div");

        const name = document.createElement("h3");
        name.textContent = review.fullName;

        info.append(name);
        author.append(avatar, info);

        // Nội dung đánh giá
        const text = document.createElement("p");
        text.className = "review-text";
        text.textContent = review.content;

        // Ngày đánh giá
        const date = document.createElement("time");
        const reviewDate = new Date(review.date);

        const year = reviewDate.getFullYear();
        const month = String(
            reviewDate.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
            reviewDate.getDate()
        ).padStart(2, "0");

        date.dateTime = year + "-" + month + "-" + day;
        date.textContent = reviewDate.toLocaleDateString("vi-VN");

        // Nút xóa đánh giá
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "review-remove";
        remove.textContent = "Xóa đánh giá";

        remove.style.cssText =
            "align-self:flex-start;" +
            "border:0;" +
            "background:transparent;" +
            "color:#2563eb;" +
            "padding:0;" +
            "cursor:pointer;" +
            "font-size:13px;";

        // Sự kiện xóa
        remove.addEventListener("click", function () {
            const index = reviews.findIndex(function (item) {
                return item.id === review.id;
            });

            if (index !== -1) {
                reviews.splice(index, 1);
                saveReviews();
            }

            col.remove();
            updateReviewVisibility();
        });

        // Ghép các thành phần
        card.append(author, text, date, remove);
        col.append(card);

        // Đưa đánh giá lên đầu danh sách
        list.prepend(col);
    }

    // ===== 7. XỬ LÝ GỬI ĐÁNH GIÁ =====

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        // Kiểm tra tài khoản
        const student = getCurrentStudent();

        if (!student) {
            alert("Bạn cần đăng nhập để gửi đánh giá.");

            sessionStorage.setItem(
                "edutrackReturnUrl",
                window.location.href
            );

            window.location.href = "login.html";
            return;
        }

        // Lấy nội dung đánh giá
        const content = field.value.trim();

        // Kiểm tra độ dài
        if (content.length < 10 || content.length > 500) {
            showMessage(
                "Vui lòng nhập đánh giá từ 10 đến 500 ký tự."
            );

            field.classList.add("is-invalid");
            field.focus();
            return;
        }

        // Tạo đối tượng đánh giá
        const review = {
            id: Date.now().toString() + "-" +
                Math.random().toString(36).slice(2, 9),
            fullName: student.fullName,
            content: content,
            date: new Date().toISOString()
        };

        // Thêm vào mảng
        reviews.unshift(review);

        // Lưu vào localStorage
        const saved = saveReviews();

        if (!saved) {
            reviews.shift();
            showMessage("Không thể lưu đánh giá. Vui lòng thử lại.");
            return;
        }

        renderReview(review);
        updateReviewVisibility();
        // Hiển thị đánh giá mới
        renderReview(review);

        // Cập nhật nút Xem thêm
        updateReviewVisibility();

        // Xóa nội dung Form
        form.reset();
        updateCounter();

        // Đóng Modal


        if (saved) {
            // Đợi Modal nhập đánh giá đóng hoàn toàn
            $("#reviewModal").one("hidden.bs.modal", function () {
                // Hiển thị thông báo cảm ơn ở giữa màn hình
                $("#reviewSuccessModal").modal("show");

                // Tự động đóng sau 2 giây
                setTimeout(function () {
                    $("#reviewSuccessModal").modal("hide");
                }, 2000);
            });

            // Đóng Modal nhập đánh giá
            $("#reviewModal").modal("hide");

        } else {
            showMessage("Không thể lưu đánh giá trong trình duyệt.");
        }
    });

    // ===== 8. XÓA FORM KHI ĐÓNG MODAL =====

    if (reviewModal && window.jQuery) {
        window.jQuery(reviewModal).on(
            "hidden.bs.modal",
            function () {
                form.reset();
                updateCounter();
            }
        );
    }

    // ===== 9. KHÔI PHỤC ĐÁNH GIÁ ĐÃ LƯU =====

    // Đảo thứ tự để đánh giá mới nhất nằm trên cùng
    reviews.slice().reverse().forEach(function (review) {
        renderReview(review);
    });

    // Hiển thị 3 đánh giá đầu tiên
    updateReviewVisibility();

    // Cập nhật bộ đếm ban đầu
    updateCounter();
});
