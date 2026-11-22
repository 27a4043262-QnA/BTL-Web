
"use strict";

function initializeCalculator() {
    const V = window.EDUValidation;
    const calculator = document.querySelector(".gpa-calculator");

    if (!calculator || !V) return;

    // Không gắn sự kiện hai lần lên cùng một giao diện
    if (calculator.dataset.gpaInitialized === "true") return;

    const requiredElements = [
        calculator.querySelector(".calc-step--courses .calc-table tbody"),
        calculator.querySelector(".btn-add-row"),
        calculator.querySelector(".calc-actions .et-btn-primary"),
        calculator.querySelector(".calc-actions .et-btn-outline"),
        calculator.querySelector(".result-summary"),
        calculator.querySelector(".result-table tbody")
    ];

    if (requiredElements.some(element => !element)) return;

    calculator.dataset.gpaInitialized = "true";

    const courseBody = calculator.querySelector(
        ".calc-step--courses .calc-table tbody"
    );

    const addButton = calculator.querySelector(".btn-add-row");
    const calculateButton = calculator.querySelector(
        ".calc-actions .et-btn-primary"
    );
    const resetButton = calculator.querySelector(
        ".calc-actions .et-btn-outline"
    );

    const summary = calculator.querySelector(".result-summary");
    const detailBody = calculator.querySelector(
        ".result-table tbody"
    );

    // Tính điểm hệ 10 của một môn
    function calculateCourseScore(scores) {
        return (
            scores[0] * 0.10 +
            scores[1] * 0.15 +
            scores[2] * 0.15 +
            scores[3] * 0.60
        );
    }

    // Bảng quy đổi mô phỏng, cần đối chiếu quy chế trường
    function convertGrade(score) {
        const scale = [
            { min: 9.5, letter: "A+", gpa: 4.0 },
            { min: 8.5, letter: "A",  gpa: 4.0 },
            { min: 8.0, letter: "B+", gpa: 3.5 },
            { min: 7.0, letter: "B",  gpa: 3.0 },
            { min: 6.5, letter: "C+", gpa: 2.5 },
            { min: 5.5, letter: "C",  gpa: 2.0 },
            { min: 5.0, letter: "D+", gpa: 1.5 },
            { min: 4.0, letter: "D",  gpa: 1.0 },
            { min: 0,   letter: "F",  gpa: 0.0 }
        ];

        return scale.find(item => score >= item.min);
    }

    // Đọc dữ liệu từ bảng HTML
    function readCourses() {
        const rows = [...courseBody.querySelectorAll("tr")];
        const courses = [];
        let valid = true;

        rows.forEach(row => {
            const inputs = [...row.querySelectorAll("input")];

            // HTML hiện tại: tên, mã, tín chỉ, 4 đầu điểm
            if (inputs.length < 7) return;

            const [nameInput, codeInput, creditsInput,
                ...scoreInputs] = inputs;

            inputs.forEach(V.clearFieldError);

            const name = nameInput.value.trim();
            const code = codeInput.value.trim();
            const credits = Number(creditsInput.value);
            const scores = scoreInputs
                .slice(0, 4)
                .map(input => Number(input.value));

            if (!V.isRequired(name)) {
                V.showFieldError(nameInput, "Vui lòng nhập tên môn.");
                valid = false;
            }

if (!V.isRequired(creditsInput.value)) {
    V.showFieldError(
        creditsInput,
        "Vui lòng nhập số tín chỉ."
    );
    valid = false;
} else if (!V.isValidCredits(creditsInput.value)) {
    V.showFieldError(
        creditsInput,
        "Tín chỉ phải là số nguyên dương."
    );
    valid = false;
}

scoreInputs.slice(0, 4).forEach(input => {
    if (!V.isRequired(input.value)) {
        V.showFieldError(
            input,
            "Vui lòng nhập điểm."
        );
        valid = false;
    } else if (!V.isValidScore(input.value)) {
        V.showFieldError(
            input,
            "Điểm phải nằm trong khoảng 0 đến 10."
        );
        valid = false;
    }
});

if (!V.isRequired(code)) {
    V.showFieldError(
        codeInput,
        "Vui lòng nhập mã môn."
    );
    valid = false;
}
        courses.push({
            name,
            code,
            credits,
            scores
        });
    });

    return valid ? courses : null;
}

    // Tính GPA từ danh sách môn học
    function calculateGPA(courses) {
        let totalCredits = 0;
        let totalScore10 = 0;
        let totalScore4 = 0;
        let passed = 0;

        const results = courses.map(course => {
            const score = calculateCourseScore(course.scores);
            const grade = convertGrade(score);

            totalCredits += course.credits;
            totalScore10 += score * course.credits;
            totalScore4 += grade.gpa * course.credits;

            if (grade.gpa > 0) passed++;

            return {
                ...course,
                score,
                letter: grade.letter,
                gpa: grade.gpa,
                passed: grade.gpa > 0
            };
        });

        return {
            results,
            totalCredits,
            average10: totalCredits
                ? totalScore10 / totalCredits : 0,
            average4: totalCredits
                ? totalScore4 / totalCredits : 0,
            passed,
            failed: courses.length - passed
        };
    }

    // Cập nhật các thẻ kết quả GPA
    function renderSummary(data) {
        const cards = [...summary.children];

        cards[0].querySelector("strong").textContent =
            data.average10.toFixed(2);

        cards[1].querySelector("strong").textContent =
            data.average4.toFixed(2);

        cards[2].querySelector("strong").textContent =
            data.totalCredits;

        cards[3].querySelector("strong").textContent =
            data.results.length;

        cards[4].querySelector("strong").textContent =
            data.passed;

        cards[5].querySelector("strong").textContent =
            data.failed;
    }

    // Cập nhật bảng điểm chi tiết
    function renderDetails(results) {
        detailBody.replaceChildren();

        results.forEach((course, index) => {
            const row = document.createElement("tr");

            const values = [
                index + 1,
                course.name,
                course.code || "-",
                course.credits,
                course.score.toFixed(2),
                course.letter,
                course.gpa.toFixed(1),
                course.passed ? "Đạt" : "Chưa đạt"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            detailBody.appendChild(row);
        });
    }

    // Tạo một dòng môn học mới
    function addCourse() {
        const template = courseBody.querySelector("tr");

        if (!template) return;

        const newRow = template.cloneNode(true);
        const inputs = [...newRow.querySelectorAll("input")];

        inputs.forEach(input => {
            input.value = "";
            V.clearFieldError(input);
        });

        courseBody.appendChild(newRow);
        updateRowNumbers();
    }

    // Cập nhật STT và nhãn của nút xóa
    function updateRowNumbers() {
        const rows = [...courseBody.querySelectorAll("tr")];

        rows.forEach((row, index) => {
            row.cells[1].textContent = index + 1;

            const deleteButton = row.querySelector(
                ".btn-icon-delete"
            );

            if (deleteButton) {
                deleteButton.setAttribute(
                    "aria-label",
                    `Xóa môn học thứ ${index + 1}`
                );
            }
        });
    }

    // Tính điểm khi nhấn nút
    calculateButton.addEventListener("click", function () {
        const courses = readCourses();

        if (courses === null) return;

        const result = calculateGPA(courses);

        renderSummary(result);
        renderDetails(result.results);
    });

    // Thêm môn học
    addButton.addEventListener("click", addCourse);


/* Xóa môn học: luôn giữ ít nhất một dòng */
courseBody.addEventListener("click", function (event) {
    const button = event.target.closest(".btn-icon-delete");

    if (!button || !courseBody.contains(button)) return;

    const row = button.closest("tr");

    if (courseBody.rows.length > 1) {
        row.remove();
    } else {
        row.querySelectorAll("input").forEach(input => {
            input.value = "";
            V.clearFieldError(input);
        });
    }

    updateRowNumbers();
});

/* Xóa thông báo lỗi khi người dùng nhập lại */
courseBody.addEventListener("input", function (event) {
    const input = event.target.closest("input");

    if (!input || !courseBody.contains(input)) return;

    V.clearFieldError(input);
});

    // Làm mới bảng nhập liệu
resetButton.addEventListener("click", function () {
    // Giữ lại một dòng môn học để người dùng nhập tiếp
    const firstRow = courseBody.querySelector("tr");

    if (!firstRow) return;

    const emptyRow = firstRow.cloneNode(true);

    // Xóa dữ liệu và thông báo lỗi
    emptyRow.querySelectorAll("input").forEach(input => {
        input.value = "";
        V.clearFieldError(input);
    });

    // Xóa các dòng khác, chỉ giữ một dòng trống
    courseBody.replaceChildren(emptyRow);
    updateRowNumbers();

    // Xóa kết quả GPA cũ
    summary.querySelectorAll(".result-gpa-card .result-card-value strong")
        .forEach(element => element.textContent = "—");

    summary.querySelectorAll(".result-stat-card > strong")
        .forEach(element => element.textContent = "0");

    detailBody.replaceChildren();
});
}

// Khởi tạo khi tải trực tiếp trang Tính GPA
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCalculator);
} else {
    initializeCalculator();
}

// Khởi tạo lại khi điều hướng qua sidebar EDUTRACK
document.addEventListener("edutrack:page-loaded", initializeCalculator);