
/* ==========================================
   EDUTRACK - INDEX.JS
   JavaScript riêng cho trang chủ
========================================== */

document.addEventListener("DOMContentLoaded", function () {

    etInitHomeAuth();
    etInitGpaDashboard();
    etInitHomeNews();

});

/* ==========================================
   1. TRẠNG THÁI ĐĂNG NHẬP
========================================== */

function etInitHomeAuth() {

    const gpaIntro = document.querySelector(".gpa.et-section");
    const gpaDashboard = document.querySelector(".gpa-dashboard");
    const ctaSection = document.querySelector(".cta");

    if (!gpaIntro || !gpaDashboard) return;

    function updateHomeUI() {

        // Dùng chung hệ thống đăng nhập với main.js
        const auth = window.EduTrackAuth;

        const isLoggedIn =
            typeof auth?.isLoggedIn === "function" &&
            auth.isLoggedIn() === true;

        // Chưa đăng nhập: giới thiệu GPA
        // Đã đăng nhập: hiển thị Dashboard
        gpaIntro.hidden = isLoggedIn;
        gpaDashboard.hidden = !isLoggedIn;

        // Phần mời đăng ký chỉ hiển thị cho khách
        if (ctaSection) {
            ctaSection.hidden = isLoggedIn;
        }

        // Đánh dấu dữ liệu mẫu, không nhận là GPA thật
        if (isLoggedIn) {
            let note = gpaDashboard.querySelector(".et-demo-note");

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

    // Khởi tạo giao diện
    updateHomeUI();

    // Cho phép module đăng nhập thông báo thay đổi
    window.addEventListener("et:auth-changed", updateHomeUI);
}

/* ==========================================
   2. KHỞI TẠO GPA DASHBOARD
========================================== */

function etInitGpaDashboard() {

    const dashboard = document.querySelector(".gpa-dashboard");
    if (!dashboard) return;

    const gpaValueElement = dashboard.querySelector(".gpa-value");
    const gpaChart = dashboard.querySelector(".gpa-chart");

    if (!gpaValueElement || !gpaChart) return;

    // GPA mẫu đang hiển thị trong HTML
    const currentGpa = Number(
        gpaValueElement.textContent.trim()
    );

    const maxGpa = 4.0;

    if (Number.isFinite(currentGpa)) {
        // Giới hạn GPA từ 0 đến 4
        const validGpa = Math.max(
            0,
            Math.min(currentGpa, maxGpa)
        );

        // Quy đổi GPA thành phần trăm vòng tròn
        const percent = (validGpa / maxGpa) * 100;

        gpaChart.style.setProperty(
            "--percent",
            percent + "%"
        );

        // Mô tả hỗ trợ truy cập
        gpaChart.setAttribute(
            "role",
            "img"
        );

        gpaChart.setAttribute(
            "aria-label",
            `GPA minh họa: ${validGpa.toFixed(2)} trên ${maxGpa.toFixed(1)}`
        );
    }

    // Tính số liệu từ bảng môn học minh họa
    etUpdateCourseStatistics(dashboard);
}

/* ==========================================
   3. THỐNG KÊ MÔN HỌC
========================================== */

function etUpdateCourseStatistics(dashboard) {

    const rows = Array.from(
        dashboard.querySelectorAll(".course-table tbody tr")
    );

    const summaryValues = dashboard.querySelectorAll(
        ".gpa-summary strong"
    );

    if (rows.length === 0 || summaryValues.length < 4) {
        return;
    }

    let totalCredits = 0;
    let passedCourses = 0;
    let failedCourses = 0;
    let validRows = 0;

    rows.forEach(function (row) {

        const cells = row.querySelectorAll("td");

        // Các cột: STT, Mã, Tên, Tín chỉ,
        // Điểm tổng kết, Xếp loại, Điểm dự phóng
        if (cells.length < 7) return;

        const credits = Number(
            cells[3].textContent.trim()
        );

        const grade = cells[5].textContent
            .trim()
            .toUpperCase();

        if (!Number.isFinite(credits) || credits < 0) {
            return;
        }

        validRows++;

        totalCredits += credits;

        // Quy tắc minh họa: F là không đạt.
        // Các xếp loại A/B/C/D có dấu +/- là đạt.
        if (grade === "F") {
            failedCourses++;
        } else if (/^[ABCD][+-]?$/.test(grade)) {
            passedCourses++;
        }
    });

    // Cập nhật 4 chỉ số trên Dashboard
    summaryValues[0].textContent = totalCredits;
    summaryValues[1].textContent = validRows;
    summaryValues[2].textContent = passedCourses;
    summaryValues[3].textContent = failedCourses;
}
