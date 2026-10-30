
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const V = window.EDUValidation;
    const calculator = document.querySelector(".gpa-calculator");

    if (!calculator || !V) return;

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
// Kiểm tra các ô khác ngoài mã môn
const hasOtherData = [
    nameInput,
    creditsInput,
    ...scoreInputs
].some(input => input.value.trim() !== "");

// Chỉ báo lỗi mã môn khi toàn bộ ô khác đều trống
if (!code && !hasOtherData) {
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

    // Xóa môn học bằng event delegation
    courseBody.addEventListener("click", function (event) {
        const button = event.target.closest(".btn-icon-delete");

        if (!button || !courseBody.contains(button)) return;

        button.closest("tr").remove();
        updateRowNumbers();
    });

    // Xóa lỗi khi người dùng sửa dữ liệu
    courseBody.addEventListener("input", function (event) {
        if (event.target.matches("input")) {
            V.clearFieldError(event.target);
        }
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
});

/* =====================================================
   DỰ PHÓNG GPA - EDUTRACK
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
    const projection = document.querySelector("#projection-wrapper");
    const V = window.EDUValidation;

    if (!projection || !V) return;

    // 1. Lấy các thành phần trên giao diện
    const courseBody = projection.querySelector(".projection-course-list");
    const addButton = projection.querySelector(".projection-add-course");
    const calculateButton = projection.querySelector(
        ".projection-calculate-button"
    );
    const actions = projection.querySelector(
        ".projection-section:nth-child(3) .projection-actions"
    );

    const currentInput = projection.querySelector("#current-gpa");
    const earnedInput = projection.querySelector("#earned-credits");
    const targetInput = projection.querySelector("#target-gpa");
    const semesterInput = projection.querySelector("#semester-credits");

    const requiredResult = projection.querySelector(
        ".required-semester-gpa"
    );
    const resultMessage = projection.querySelector(
        ".projection-result-message"
    );
    const resultBody = projection.querySelector(
        ".projected-course-results"
    );

    const summaryTarget = projection.querySelector(
        ".summary-target-gpa"
    );
    const summaryForecast = projection.querySelector(
        ".summary-forecast-gpa"
    );
    const summaryAverage = projection.querySelector(
        ".summary-average-10"
    );

    const chart = projection.querySelector(".projection-chart-svg");

    // Lưu cấu trúc một hàng để tạo hàng mới
    const template = courseBody.querySelector("tr").cloneNode(true);

    // Dữ liệu môn tiên quyết minh họa cho EDUTRACK
    const prerequisites = {
        "lập trình hướng đối tượng": [
            { name: "Lập trình C", credits: 4 }
        ],

        "cấu trúc dữ liệu và giải thuật": [
            { name: "Lập trình C", credits: 4 }
        ],

        "cơ sở dữ liệu nâng cao": [
            { name: "Cơ sở dữ liệu", credits: 3 }
        ],

        "lập trình web": [
            { name: "Lập trình C", credits: 4 }
        ],

        "lập trình web nâng cao": [
            { name: "Lập trình web", credits: 3 }
        ],

        "phát triển ứng dụng web": [
            { name: "Lập trình web", credits: 3 },
            { name: "Cơ sở dữ liệu", credits: 3 }
        ],

        "phân tích và thiết kế hệ thống": [
            { name: "Cơ sở dữ liệu", credits: 3 }
        ],

        "phát triển ứng dụng di động": [
            { name: "Lập trình hướng đối tượng", credits: 3 }
        ],

        "trí tuệ nhân tạo": [
            { name: "Cấu trúc dữ liệu và giải thuật", credits: 3 },
            { name: "Xác suất thống kê", credits: 3 }
        ],

        "khai phá và học máy": [
            { name: "Xác suất thống kê", credits: 3 }
        ],

        "an toàn thông tin": [
            { name: "Mạng máy tính", credits: 3 }
        ],

        "hệ quản trị cơ sở dữ liệu": [
            { name: "Cơ sở dữ liệu", credits: 3 }
        ],
        "xác suất thống kê": [
            { name: "Toán kinh tế 1", credits: 3 }
        ],
    };

    // Tạo lại bảng môn tiên quyết từ danh sách môn kỳ tới
    function updatePrerequisites() {
        const prerequisiteBody = projection.querySelector(
            "#prerequisite-course-list"
        );

        // Lưu điểm đã nhập trước khi cập nhật bảng
        const savedScores = new Map();

        prerequisiteBody.querySelectorAll("tr").forEach(row => {
            const input = row.querySelector("input");

            if (input) {
                const name = row.cells[0].textContent.trim();
                savedScores.set(name, input.value);
            }
        });

        // Tìm tất cả môn tiên quyết, không cho trùng lặp
        const requiredCourses = new Map();

        courseBody.querySelectorAll("tr").forEach(row => {
            const nameInput = row.querySelector(
                'input[type="text"]'
            );

const creditsInput = row.querySelector('input[type="number"]');

if (!nameInput || !creditsInput ||
    !V.isValidCredits(creditsInput.value)) return;

            const courseName = nameInput.value
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase();

            const matches = prerequisites[courseName] || [];

            matches.forEach(course => {
                requiredCourses.set(course.name, course);
            });
        });

        // Xóa các hàng cũ
        prerequisiteBody.replaceChildren();

        // Tạo hàng mới cho từng môn tiên quyết
        requiredCourses.forEach(course => {
            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = course.name;

            const creditsCell = document.createElement("td");
            creditsCell.textContent = course.credits;

            const scoreCell = document.createElement("td");

            const field = document.createElement("div");
            field.className = "projection-score-field";

            const input = document.createElement("input");
            input.type = "number";
            input.className = "projection-input";
            input.name = "prerequisite_score";
            input.min = "0";
            input.max = "10";
            input.step = "0.1";
            input.required = true;
            input.placeholder = "Nhập điểm";

            input.setAttribute(
                "aria-label",
                `Điểm môn ${course.name}`
            );

            // Khôi phục điểm của môn vẫn còn trong danh sách
            input.value = savedScores.get(course.name) ?? "";

            const unit = document.createElement("span");
            unit.textContent = "/10";

            field.append(input, unit);
            scoreCell.appendChild(field);

            row.append(nameCell, creditsCell, scoreCell);
            prerequisiteBody.appendChild(row);
        });

        // Thông báo nếu không tìm thấy môn tiên quyết nào
        if (requiredCourses.size === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 3;
            cell.textContent =
                "Chưa có môn tiên quyết trong dữ liệu mẫu.";

            row.appendChild(cell);
            prerequisiteBody.appendChild(row);
        }
    }

    // 2. Tạo vùng thông báo bằng DOM
    const notice = document.createElement("p");
    notice.className = "projection-feedback";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.hidden = true;
    actions.insertAdjacentElement("afterend", notice);

    function showNotice(message) {
        notice.textContent = message;
        notice.hidden = false;
    }

    function clearNotice() {
        notice.textContent = "";
        notice.hidden = true;
    }

    // 3. Cập nhật tên và nhãn của các ô môn học
    function updateCourseRows() {
        const rows = courseBody.querySelectorAll("tr");

        rows.forEach((row, index) => {
            const nameInput = row.querySelector('input[type="text"]');
            const creditInput = row.querySelector('input[type="number"]');

            nameInput.name = `semester_courses[${index}][name]`;
            creditInput.name = `semester_courses[${index}][credits]`;

            nameInput.setAttribute(
                "aria-label",
                `Tên môn học thứ ${index + 1}`
            );

            creditInput.setAttribute(
                "aria-label",
                `Tín chỉ môn học thứ ${index + 1}`
            );
        });
    }

    // 4. Thêm một môn học mới

    addButton.addEventListener("click", function () {
        const row = template.cloneNode(true);

        row.querySelectorAll("input").forEach(input => {
            input.value = "";
            V.clearFieldError(input);
        });

        // Giữ nguyên cấu trúc thùng rác trong HTML
        const deleteButton = row.querySelector(
            ".projection-icon-button"
        );

        deleteButton.innerHTML =
            '<i data-lucide="trash-2" aria-hidden="true"></i>';

        courseBody.appendChild(row);

        updateCourseRows();
        updatePrerequisites();

        // Hiển thị icon cho hàng mới
        if (window.lucide) {
            lucide.createIcons();
        }

        clearNotice();
    });


    // 5. Xóa môn học

    courseBody.addEventListener("click", function (event) {
        const button = event.target.closest(
            ".projection-icon-button"
        );

        if (!button || !courseBody.contains(button)) return;

        if (courseBody.rows.length > 1) {
            button.closest("tr").remove();
        } else {
            courseBody.querySelectorAll("input").forEach(input => {
                input.value = "";
                V.clearFieldError(input);
            });
        }

        updateCourseRows();
        updatePrerequisites();
        clearNotice();
    });


    // 6. Khi người dùng sửa dữ liệu, xóa lỗi cũ
    function handleInput(event) {
        if (event.target.matches("input, select")) {
            V.clearFieldError(event.target);
            clearNotice();
        }
    }

    projection.addEventListener("input", handleInput);
    projection.addEventListener("change", handleInput);

courseBody.addEventListener("input", function (event) {
    if (event.target.matches("input")) {
        updatePrerequisites();
    }
});

    // 7. Kiểm tra một trường bắt buộc
    function checkField(input, validator, emptyText, invalidText) {
        V.clearFieldError(input);

        if (!V.isRequired(input.value)) {
            V.showFieldError(input, emptyText);
            return false;
        }

        if (!validator(input.value)) {
            V.showFieldError(input, invalidText);
            return false;
        }

        return true;
    }

    // 8. Đọc và kiểm tra toàn bộ dữ liệu dự phóng
    function readData() {
        let valid = true;
        const courses = [];

        if (!checkField(
            currentInput,
            V.isValidGPA,
            "Vui lòng nhập GPA hiện tại.",
            "GPA phải từ 0 đến 4."
        )) valid = false;

        if (!checkField(
            earnedInput,
            value => Number.isInteger(Number(value))
                && Number(value) >= 0,
            "Vui lòng nhập số tín chỉ tích lũy.",
            "Tín chỉ tích lũy phải là số nguyên không âm."
        )) valid = false;

        if (!checkField(
            targetInput,
            V.isValidGPA,
            "Vui lòng chọn GPA mục tiêu.",
            "GPA mục tiêu phải từ 0 đến 4."
        )) valid = false;

        if (!checkField(
            semesterInput,
            value => Number.isInteger(Number(value))
                && Number(value) > 0,
            "Vui lòng nhập tín chỉ kỳ tới.",
            "Tín chỉ kỳ tới phải là số nguyên dương."
        )) valid = false;

        // Kiểm tra danh sách môn học kỳ tới
        courseBody.querySelectorAll("tr").forEach(row => {
            const nameInput = row.querySelector('input[type="text"]');
            const creditInput = row.querySelector('input[type="number"]');

            const name = nameInput.value.trim();

            V.clearFieldError(nameInput);

            if (!V.isRequired(name)) {
                V.showFieldError(
                    nameInput,
                    "Vui lòng nhập tên môn học."
                );
                valid = false;
            }

            if (!checkField(
                creditInput,
                V.isValidCredits,
                "Vui lòng nhập số tín chỉ.",
                "Tín chỉ mỗi môn phải từ 1 đến 10."
            )) valid = false;

            courses.push({
                name: name,
                credits: Number(creditInput.value)
            });
        });

        // Kiểm tra điểm các môn tiên quyết
projection.querySelectorAll(
    "#prerequisite-course-list input"
).forEach(input => {
    if (!checkField(
        input,
        V.isValidScore,
        "Vui lòng nhập điểm môn tiên quyết.",
        "Điểm phải từ 0 đến 10."
    )) valid = false;
});

        if (!valid) return null;

        // Kiểm tra tổng tín chỉ
        const totalCredits = courses.reduce(
            (total, course) => total + course.credits,
            0
        );

        if (totalCredits !== Number(semesterInput.value)) {
            V.showFieldError(
                semesterInput,
                `Tổng tín chỉ các môn là ${totalCredits}. ` +
                "Hãy nhập số tín chỉ kỳ tới cho khớp."
            );
            return null;
        }

        return {
            currentGPA: Number(currentInput.value),
            earnedCredits: Number(earnedInput.value),
            targetGPA: Number(targetInput.value),
            semesterCredits: Number(semesterInput.value),
            courses
        };
    }

    // 9. Bảng quy đổi giả định của công cụ mô phỏng
    const gradeScale = [
        { min: 0.0, letter: "F",  gpa: 0.0, score10: 0.0 },
        { min: 1.0, letter: "D",  gpa: 1.0, score10: 4.0 },
        { min: 1.5, letter: "D+", gpa: 1.5, score10: 5.0 },
        { min: 2.0, letter: "C",  gpa: 2.0, score10: 5.5 },
        { min: 2.5, letter: "C+", gpa: 2.5, score10: 6.5 },
        { min: 3.0, letter: "B",  gpa: 3.0, score10: 7.0 },
        { min: 3.5, letter: "B+", gpa: 3.5, score10: 8.0 },
        { min: 4.0, letter: "A",  gpa: 4.0, score10: 8.5 }
    ];

    // Quy đổi điểm hệ 10 sang GPA hệ 4
    function convertForecastGrade(score) {
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

    // Chuẩn hóa tên môn để tìm môn tiên quyết
    function normalizeCourseName(name) {
        return name.trim().replace(/\s+/g, " ").toLowerCase();
    }

    // Lấy điểm nền tảng của từng môn từ môn tiên quyết
    function getCourseReferences(courses) {
        const scoreMap = new Map();

        projection.querySelectorAll(
            "#prerequisite-course-list tr"
        ).forEach(row => {
            const input = row.querySelector('input[type="number"]');

            if (!input) return;

            const courseName = normalizeCourseName(
                row.cells[0].textContent
            );

            scoreMap.set(courseName, Number(input.value));
        });

        return courses.map(course => {
            const key = normalizeCourseName(course.name);
            const related = prerequisites[key] || [];

            // Mức giả định khi môn không có dữ liệu tiên quyết
            let referenceScore = 7.0;

            if (related.length > 0) {
                const scores = related.map(item =>
                    scoreMap.get(normalizeCourseName(item.name))
                );

                if (scores.some(score =>
                    !Number.isFinite(score) ||
                    score < 0 ||
                    score > 10
                )) {
                    throw new Error(
                        "Thiếu điểm môn tiên quyết của " + course.name
                    );
                }

                referenceScore = scores.reduce(
                    (sum, score) => sum + score,
                    0
                ) / scores.length;
            }

            return {
                name: course.name,
                credits: course.credits,
                referenceScore,
                hasPrerequisites: related.length > 0
            };
        });
    }

    // Đề xuất một phương án điểm để đạt GPA kỳ tới cần thiết
    function recommendScores(courses, requiredGPA) {
        // Các mốc điểm thấp nhất để đạt mỗi mức GPA
        const levels = [
            { score: 0.0, gpa: 0.0, letter: "F" },
            { score: 4.0, gpa: 1.0, letter: "D" },
            { score: 5.0, gpa: 1.5, letter: "D+" },
            { score: 5.5, gpa: 2.0, letter: "C" },
            { score: 6.5, gpa: 2.5, letter: "C+" },
            { score: 7.0, gpa: 3.0, letter: "B" },
            { score: 8.0, gpa: 3.5, letter: "B+" },
            { score: 8.5, gpa: 4.0, letter: "A" }
        ];

        const totalCredits = courses.reduce(
            (sum, course) => sum + course.credits,
            0
        );

        // Nhân GPA với 2 để làm việc bằng số nguyên
        const neededPoints = Math.ceil(
            Math.max(0, requiredGPA) * totalCredits * 2 - 1e-9
        );

        let states = new Map();

        states.set(0, {
            cost: 0,
            courses: []
        });

        courses.forEach(course => {
            const referenceGrade = convertForecastGrade(
                course.referenceScore
            );

            // Có thể giữ mức điểm nền tảng
            const choices = [{
                score: course.referenceScore,
                gpa: referenceGrade.gpa,
                letter: referenceGrade.letter
            }];

            // Hoặc nâng lên các mốc GPA cao hơn
            levels.forEach(level => {
                if (level.gpa > referenceGrade.gpa) {
                    choices.push(level);
                }
            });

            const nextStates = new Map();

            states.forEach((state, points) => {
                choices.forEach(choice => {
                    const newPoints = points +
                        Math.round(choice.gpa * 2 * course.credits);

                    // Ưu tiên tổng mức tăng điểm hệ 10 ít nhất
                    const cost = state.cost +
                        Math.max(
                            0,
                            choice.score - course.referenceScore
                        ) * course.credits;

                    const existing = nextStates.get(newPoints);

                    if (!existing || cost < existing.cost) {
                        nextStates.set(newPoints, {
                            cost,
                            courses: [
                                ...state.courses,
                                {
                                    ...course,
                                    targetScore: choice.score,
                                    targetGPA: choice.gpa,
                                    targetLetter: choice.letter
                                }
                            ]
                        });
                    }
                });
            });

            states = nextStates;
        });

        let best = null;
        let bestPoints = Infinity;

        states.forEach((state, points) => {
            if (points < neededPoints) return;

            if (
                best === null ||
                state.cost < best.cost - 1e-9 ||
                (
                    Math.abs(state.cost - best.cost) < 1e-9 &&
                    points < bestPoints
                )
            ) {
                best = state;
                bestPoints = points;
            }
        });

        return best ? best.courses : null;
    }

  
    // 10. Tính GPA và điểm mục tiêu đề xuất
    function calculateProjection(data) {
        const totalCredits =
            data.earnedCredits + data.semesterCredits;

        // GPA học kỳ tới cần đạt
        const requiredGPA = (
            data.targetGPA * totalCredits -
            data.currentGPA * data.earnedCredits
        ) / data.semesterCredits;

        // Không thể đạt GPA học kỳ trên 4.0
        if (requiredGPA > 4 + 1e-9) {
            return {
                feasible: false,
                requiredGPA
            };
        }

        // Xác định năng lực tham khảo từ môn tiên quyết
        const references = getCourseReferences(data.courses);

        // Tìm phương án điểm đề xuất
        const courses = recommendScores(
            references,
            Math.max(0, requiredGPA)
        );

        if (!courses) {
            return {
                feasible: false,
                requiredGPA
            };
        }

        const courseCredits = courses.reduce(
            (sum, course) => sum + course.credits,
            0
        );

        // GPA riêng của học kỳ tới theo điểm đề xuất
        const semesterGPA = courses.reduce(
            (sum, course) =>
                sum + course.targetGPA * course.credits,
            0
        ) / courseCredits;

        // GPA tích lũy dự kiến nếu đạt điểm đề xuất
        const forecastGPA = (
            data.currentGPA * data.earnedCredits +
            semesterGPA * data.semesterCredits
        ) / totalCredits;

        // Điểm trung bình hệ 10 của phương án đề xuất
        const averageScore10 = courses.reduce(
            (sum, course) =>
                sum + course.targetScore * course.credits,
            0
        ) / courseCredits;

        return {
            feasible: true,
            requiredGPA: Math.max(0, requiredGPA),
            courses,
            semesterGPA,
            forecastGPA,
            averageScore10
        };
    }


    // 11. Hiển thị số và đơn vị trong phần tóm tắt
    function setSummaryValue(element, number, unit) {
        const small = document.createElement("small");
        small.textContent = `/ ${unit}`;

        element.replaceChildren(
            document.createTextNode(number + " "),
            small
        );
    }

    // 12. Cập nhật kết quả tổng quan
   
    // 12. Cập nhật kết quả tổng quan
    function renderSummary(data, result) {
        requiredResult.textContent =
            result.requiredGPA.toFixed(2);

        resultMessage.textContent =
            "Đã tìm được phương án điểm đề xuất để hướng tới " +
            `GPA ${data.targetGPA.toFixed(2)}.`;

        setSummaryValue(
            summaryTarget,
            data.targetGPA.toFixed(2),
            "4.00"
        );

        setSummaryValue(
    summaryForecast,
    result.semesterGPA.toFixed(2),
    "4.00"
        );

        setSummaryValue(
            summaryAverage,
            result.averageScore10.toFixed(2),
            "10"
        );
    }

    // 13. Hiển thị điểm đề xuất riêng cho từng môn
    function renderCourses(data, result) {
        resultBody.replaceChildren();

        result.courses.forEach(course => {
            const row = document.createElement("tr");

            const values = [
                course.name,
                course.credits,
                course.targetScore.toFixed(2),
                course.targetGPA.toFixed(1),
                course.targetLetter
            ];

            values.forEach((value, index) => {
                const td = document.createElement("td");

                if (index === 4) {
                    const badge = document.createElement("span");
                    badge.className = "projection-grade";
                    badge.textContent = value;
                    td.appendChild(badge);
                } else {
                    td.textContent = value;
                }

                row.appendChild(td);
            });

            resultBody.appendChild(row);
        });
    }


    // 14. Cập nhật biểu đồ GPA tích lũy bằng SVG
    function renderChart(data, result) {
        // Biểu đồ đang có trục 2.0 đến 4.0
        function positionY(gpa) {
            const value = Math.min(4, Math.max(2, gpa));
            return 430 - value * 100;
        }

        const currentY = positionY(data.currentGPA);
        const forecastY = positionY(result.forecastGPA);
        const targetY = positionY(data.targetGPA);

        chart.querySelector(".chart-area").setAttribute(
            "points",
            `90,${currentY} 310,${forecastY} ` +
            `540,${targetY} 540,230 90,230`
        );

        chart.querySelector(".chart-line").setAttribute(
            "points",
            `90,${currentY} 310,${forecastY}`
        );

        const targetLine = chart.querySelector(".chart-target");
        targetLine.setAttribute("y1", targetY);
        targetLine.setAttribute("y2", targetY);

        chart.querySelector(".chart-dot--current")
            .setAttribute("cy", currentY);

        chart.querySelector(".chart-dot--forecast")
            .setAttribute("cy", forecastY);

        const labels = chart.querySelectorAll(".chart-label");
        const numbers = [
            data.currentGPA,
            result.forecastGPA,
            data.targetGPA
        ];
        const positions = [currentY, forecastY, targetY];

        labels.forEach((label, index) => {
            label.textContent = numbers[index].toFixed(2);
            label.setAttribute(
                "y",
                Math.max(14, positions[index] - 16)
            );
        });

        chart.setAttribute(
            "aria-label",
            `GPA hiện tại ${data.currentGPA.toFixed(2)}, ` +
            `GPA tích lũy dự kiến ${result.forecastGPA.toFixed(2)}, ` +
            `GPA mục tiêu ${data.targetGPA.toFixed(2)}.`
        );
    }

    // 15. Xóa dữ liệu kết quả cũ khi không thể tính
    function clearResults() {
        requiredResult.textContent = "—";
        resultMessage.textContent =
            "Chưa có kết quả dự phóng hợp lệ.";

        setSummaryValue(summaryTarget, "—", "4.00");
        setSummaryValue(summaryForecast, "—", "4.00");
        setSummaryValue(summaryAverage, "—", "10");

        resultBody.replaceChildren();
        chart.hidden = true;
    }

    // 16. Nút Tính toán dự phóng
    calculateButton.addEventListener("click", function () {
        clearNotice();

        const data = readData();

        if (!data) {
            clearResults();
            showNotice(
                "Vui lòng kiểm tra các ô nhập được đánh dấu."
            );
            return;
        }

        let result;

        try {
            result = calculateProjection(data);
        } catch (error) {
            clearResults();
            showNotice(error.message);
            return;
        }

        if (!result.feasible) {
            clearResults();

            requiredResult.textContent =
                result.requiredGPA.toFixed(2);

            resultMessage.textContent =
                "Mục tiêu chưa khả thi trong một học kỳ.";

            showNotice(
                `Bạn cần GPA kỳ tới là ` +
                `${result.requiredGPA.toFixed(2)}/4, ` +
                "vượt mức tối đa 4.00. " +
                "Hãy điều chỉnh GPA mục tiêu hoặc kế hoạch tín chỉ."
            );
            return;
        }

        renderSummary(data, result);
        renderCourses(data, result);
        renderChart(data, result);

        chart.hidden = false;

        showNotice(
            "Đã tính được điểm mục tiêu đề xuất cho từng môn. " +
            `Nếu đạt các mức điểm này, GPA tích lũy có thể là ` +
            `${result.forecastGPA.toFixed(2)}/4. ` +
            "Đây là phương án tham khảo, không phải " +
            "điểm số chắc chắn sẽ đạt."
        );
    });

    updateCourseRows();
    updatePrerequisites();
});
