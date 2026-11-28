
"use strict";

(function () {

    // Gửi yêu cầu đến backend localhost
    async function request(kind, method = "GET", body) {

        const options = {
            method,
            credentials: "same-origin",
            cache: "no-store"
        };

        if (body !== undefined) {
            options.headers = {
                "Content-Type": "application/json"
            };

            options.body = JSON.stringify(body);
        }

        const response = await fetch(
            `/api/learning/${kind}`,
            options
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !data) {
            const error = new Error(
                data?.message ||
                `Lỗi kết nối máy chủ (HTTP ${response.status})`
            );

            error.status = response.status;

            throw error;
        }

        return data;
    }

    function mount(kind, calculateButton, restore) {

        // Xác định khu vực nhập liệu
        const wrapper = calculateButton.closest(
            ".gpa-calculator, #projection-wrapper"
        );

        // Tạo vùng thông báo
        const status = document.createElement("p");

        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");

        status.style.marginTop = "12px";
        status.style.display = "none";
        calculateButton.parentElement.insertAdjacentElement(
            "afterend",
            status
        );

        function showStatus(message, color) {
    status.textContent = message;
    status.style.color = color;
    status.style.display = message ? "block" : "none";
}

        // Tự động lưu sau khi tính toán
        async function save(input, result) {

            calculateButton.disabled = true;

            try {

                await request(kind, "PUT", {
                    input,
                    result
                });

                showStatus("", "");
            } catch (error) {

                showStatus(
                    "Chưa lưu được: " + error.message,
                    "#dc2626"
                );

                console.error("Lỗi lưu dữ liệu:", error);

            } finally {

                calculateButton.disabled = false;
            }
        }

        // Tự động đọc và khôi phục dữ liệu khi mở trang
        async function load(ready = Promise.resolve()) {

            // Tạm khóa các ô trong khi tải dữ liệu
            const controls = Array.from(
                wrapper.querySelectorAll(
                    "input, select, button, textarea"
                )
            ).filter(element => !element.disabled);

            controls.forEach(element => {
                element.disabled = true;
            });

            try {

                const [data] = await Promise.all([
                    request(kind),
                    ready
                ]);

                // Không cập nhật nếu đã chuyển sang trang khác
                if (!wrapper.isConnected) return;

                if (!data.record) {
                    showStatus("", "");
                    return;
                }

                // Khôi phục trực tiếp lên giao diện
                await restore(data.record);

                showStatus("", "");
            } catch (error) {

                if (error.status === 401) {

                    showStatus(
                        "Đăng nhập để tự động lưu kết quả.",
                        "#64748b"
                    );

                } else {

                    showStatus(
                        "Không thể tải dữ liệu: " + error.message,
                        "#dc2626"
                    );

                    console.error("Lỗi tải dữ liệu:", error);
                }

            } finally {

                controls.forEach(element => {
                    element.disabled = false;
                });
            }
        }

        
// Xóa kết quả học tập đã lưu
async function clear() {

    calculateButton.disabled = true;

    try {

        await request(kind, "DELETE");

        showStatus("", "");

        return true;

    } catch (error) {

        // Nếu chưa đăng nhập, chỉ làm mới giao diện
        if (error.status === 401) {

            showStatus(
                "Chưa đăng nhập, chỉ làm mới giao diện.",
                "#64748b"
            );

            return true;
        }

        showStatus(
            "Không thể xóa dữ liệu: " + error.message,
            "#dc2626"
        );

        console.error("Lỗi xóa dữ liệu:", error);

        return false;

    } finally {

        calculateButton.disabled = false;
    }
}

return {
    save,
    load,
    clear
};

    }

    window.EDULearningStorage = { mount };

})();
