
document.addEventListener("DOMContentLoaded", function () {
    // 1. Lấy các phần tử HTML
    const form = document.getElementById("question-form");
    const nameInput = document.getElementById("question-name");
    const contentInput = document.getElementById("question-content");

    if (!form || !nameInput || !contentInput) {
        return;
    }

    // 2. Khóa lưu câu hỏi của môn Toán cao cấp A1
    const STORAGE_KEY = "edutrack_questions_MATH101";

    // 3. Đọc các câu hỏi đã lưu
    let questions = [];

    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        questions = Array.isArray(saved) ? saved : [];
    } catch (error) {
        questions = [];
    }

    // 4. Lưu câu hỏi
    function saveQuestions() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(questions)
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    // 5. Xử lý khi gửi câu hỏi
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const fullName = nameInput.value.trim();
        const content = contentInput.value.trim();

        // Kiểm tra thông tin
        if (!fullName) {
            nameInput.setCustomValidity("Vui lòng nhập họ và tên.");
            nameInput.reportValidity();
            return;
        }

        if (!content) {
            contentInput.setCustomValidity("Vui lòng nhập câu hỏi.");
            contentInput.reportValidity();
            return;
        }

        // Tạo đối tượng câu hỏi
        const question = {
            id: Date.now().toString() + "-" +
                Math.random().toString(36).slice(2, 9),
            fullName: fullName,
            content: content,
            date: new Date().toISOString(),
            status: "pending"
        };

        // Lưu câu hỏi
        questions.unshift(question);

        if (!saveQuestions()) {
            questions.shift();
            alert("Không thể lưu câu hỏi. Vui lòng thử lại.");
            return;
        }

        // Đóng Modal nhập câu hỏi
        $("#questionModal").one("hidden.bs.modal", function () {
            // Hiển thị Modal cảm ơn
            $("#questionSuccessModal").modal("show");

            // Tự đóng sau 2 giây
            setTimeout(function () {
                $("#questionSuccessModal").modal("hide");
            }, 2000);
        });

        $("#questionModal").modal("hide");
    });

    // 6. Xóa Form khi đóng Modal
    $("#questionModal").on("hidden.bs.modal", function () {
        form.reset();

        nameInput.setCustomValidity("");
        contentInput.setCustomValidity("");
    });

    // 7. Xóa thông báo lỗi khi nhập lại
    nameInput.addEventListener("input", function () {
        nameInput.setCustomValidity("");
    });

    contentInput.addEventListener("input", function () {
        contentInput.setCustomValidity("");
    });
});
