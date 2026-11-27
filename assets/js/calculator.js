
"use strict";
const GPA_COURSES_URL = "/assets/data/courses.json";

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

    
    // Gợi ý môn học từ JSON
    async function setupCourseSuggestions() {
        const dropdown = document.createElement("div");
        dropdown.className = "gpa-course-dropdown";
        dropdown.id = "gpa-course-dropdown";
        dropdown.setAttribute("role", "listbox");

        // Đặt ngoài bảng để không bị vùng cuộn cắt mất
        document.body.appendChild(dropdown);

        const controller = new AbortController();
        const signal = controller.signal;

        const courseMap = new Map();

        let courses = [];
        let activeInput = null;
        let visibleCourses = [];
        let activeIndex = -1;

        // Cho phép tìm kiếm không dấu
        function normalize(value) {
            return String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/Đ/g, "D")
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase();
        }

        function displayName(course) {
            return `${course.name} (${course.code})`;
        }

        // Liên kết các ô tên môn với autocomplete
        function prepareInput(input) {
            if (!input) return;

            input.removeAttribute("list");
            input.autocomplete = "off";
            input.setAttribute("role", "combobox");
            input.setAttribute("aria-autocomplete", "list");
            input.setAttribute(
                "aria-controls",
                dropdown.id
            );
            input.setAttribute("aria-expanded", "false");
        }

        courseBody.querySelectorAll("tr").forEach(row => {
            prepareInput(
                row.querySelector('input[type="text"]')
            );
        });

        function closeDropdown() {
            if (activeInput) {
                activeInput.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }

            dropdown.classList.remove("is-open");
            dropdown.replaceChildren();

            activeInput = null;
            visibleCourses = [];
            activeIndex = -1;
        }

        // Đặt danh sách ngay dưới ô đang nhập
        function positionDropdown(input) {
            const rect = input.getBoundingClientRect();

            const width = Math.min(
                Math.max(rect.width, 300),
                380,
                window.innerWidth - 16
            );

            const left = Math.max(
                8,
                Math.min(
                    rect.left,
                    window.innerWidth - width - 8
                )
            );

            dropdown.style.width = `${width}px`;
            dropdown.style.left = `${left}px`;

            // Nếu thiếu chỗ bên dưới thì mở lên trên
            const dropdownHeight = Math.min(
                dropdown.scrollHeight,
                260
            );

            const spaceBelow =
                window.innerHeight - rect.bottom;

            const spaceAbove = rect.top;

            const openAbove =
                spaceBelow < dropdownHeight + 8 &&
                spaceAbove > spaceBelow;

            dropdown.style.top = openAbove
                ? `${Math.max(8, rect.top - dropdownHeight - 6)}px`
                : `${Math.min(
                    window.innerHeight - 8,
                    rect.bottom + 6
                )}px`;
        }

        function updateActiveOption() {
            const options = dropdown.querySelectorAll(
                ".gpa-course-option"
            );

            options.forEach((option, index) => {
                option.classList.toggle(
                    "is-active",
                    index === activeIndex
                );

                option.setAttribute(
                    "aria-selected",
                    String(index === activeIndex)
                );
            });
        }

        // Chọn môn: điền tên, mã và tín chỉ
        function selectCourse(course) {
            if (!activeInput) return;

            const nameInput = activeInput;
            const row = nameInput.closest("tr");

            if (!row) return;

            const inputs = row.querySelectorAll("input");
            const creditsInput = inputs[1];

            if (!creditsInput) return;

            nameInput.value = displayName(course);
            nameInput.dataset.courseCode = course.code;

            creditsInput.value = String(course.credits);

            V.clearFieldError(nameInput);
            V.clearFieldError(creditsInput);

            closeDropdown();
            nameInput.focus();
        }

        // Tạo giao diện từng môn gợi ý
        function renderSuggestions(input) {
            const keyword = normalize(input.value);

            closeDropdown();

            if (!keyword || courses.length === 0) {
                return;
            }

            visibleCourses = courses
                .filter(course => {
                    const searchText = normalize(
                        `${course.name} ${course.code}`
                    );

                    return searchText.includes(keyword);
                })
                .slice(0, 8);

            if (visibleCourses.length === 0) {
                return;
            }

            activeInput = input;

            visibleCourses.forEach((course, index) => {
                const button = document.createElement(
                    "button"
                );

                button.type = "button";
                button.className = "gpa-course-option";
                button.setAttribute("role", "option");
                button.setAttribute(
                    "aria-selected",
                    "false"
                );
                button.dataset.index = String(index);

                const info = document.createElement("span");
                info.className =
                    "gpa-course-option-info";

                const name = document.createElement("span");
                name.className =
                    "gpa-course-option-name";
                name.textContent = course.name;

                const code = document.createElement("span");
                code.className =
                    "gpa-course-option-code";
                code.textContent = course.code;

                const credits = document.createElement(
                    "span"
                );
                credits.className =
                    "gpa-course-option-credits";
                credits.textContent =
                    `${course.credits} TC`;

                info.append(name, code);
                button.append(info, credits);

                dropdown.appendChild(button);
            });

            dropdown.classList.add("is-open");
            input.setAttribute("aria-expanded", "true");
            positionDropdown(input);
        }

        // Khi nhập tên, xóa thông tin môn cũ
        function handleInput(event) {
            if (!(event.target instanceof HTMLInputElement)) {
                return;
            }

            const input = event.target;
            const row = input.closest("tr");

            if (!row || !courseBody.contains(row)) {
                return;
            }

            const nameInput = row.querySelector(
                'input[type="text"]'
            );

            if (input !== nameInput) return;

            const creditsInput = row.querySelectorAll(
                "input"
            )[1];

            const selected = courseMap.get(
                normalize(input.value)
            );

            if (selected) {
                input.dataset.courseCode = selected.code;
                creditsInput.value =
                    String(selected.credits);
            } else {
                delete input.dataset.courseCode;
                creditsInput.value = "";
            }

            renderSuggestions(input);
        }

        // Nhập tên môn
        courseBody.addEventListener(
            "input",
            handleInput,
            { signal }
        );

        // Gõ phím lên/xuống, Enter hoặc Escape
        courseBody.addEventListener(
            "keydown",
            event => {
                if (
                    !(event.target instanceof HTMLInputElement)
                ) return;

                if (event.target !== activeInput) return;

                if (!visibleCourses.length) return;

                if (event.key === "ArrowDown") {
                    event.preventDefault();

                    activeIndex =
                        (activeIndex + 1) %
                        visibleCourses.length;

                    updateActiveOption();
                } else if (event.key === "ArrowUp") {
                    event.preventDefault();

                    activeIndex =
                        activeIndex <= 0
                            ? visibleCourses.length - 1
                            : activeIndex - 1;

                    updateActiveOption();
                } else if (event.key === "Enter") {
                    if (activeIndex < 0) return;

                    event.preventDefault();

                    selectCourse(
                        visibleCourses[activeIndex]
                    );
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    closeDropdown();
                }
            },
            { signal }
        );

        // Nhấn chuột hoặc chạm vào môn được gợi ý
        dropdown.addEventListener(
            "pointerdown",
            event => {
                if (!(event.target instanceof Element)) {
                    return;
                }

                const option = event.target.closest(
                    ".gpa-course-option"
                );

                if (!option) return;

                event.preventDefault();

                const index = Number(option.dataset.index);
                const course = visibleCourses[index];

                if (course) selectCourse(course);
            },
            { signal }
        );

        // Nhấn bên ngoài thì đóng danh sách
        document.addEventListener(
            "pointerdown",
            event => {
                if (
                    event.target instanceof Node &&
                    (
                        dropdown.contains(event.target) ||
                        courseBody.contains(event.target)
                    )
                ) {
                    return;
                }

                closeDropdown();
            },
            { signal }
        );

        // Đóng khi cuộn bảng hoặc thay đổi kích thước
        document.addEventListener(
            "scroll",
            event => {
                if (
                    event.target instanceof Node &&
                    dropdown.contains(event.target)
                ) {
                    return;
                }

                closeDropdown();
            },
            { capture: true, signal }
        );

        window.addEventListener(
            "resize",
            closeDropdown,
            { signal }
        );

        // Dọn sự kiện cũ khi SPA thay giao diện
        document.addEventListener(
            "edutrack:page-loaded",
            () => {
                if (!calculator.isConnected) {
                    closeDropdown();
                    controller.abort();
                    dropdown.remove();
                }
            },
            { signal }
        );

        // Tải danh sách môn học từ JSON
        try {
            const response = await fetch(GPA_COURSES_URL);

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error(
                    "JSON phải chứa một mảng môn học."
                );
            }

            // Trang cũ có thể đã bị SPA thay thế
            if (!calculator.isConnected) {
                closeDropdown();
                controller.abort();
                dropdown.remove();
                return;
            }
            courses = data
                .filter(course =>
                    course &&
                    typeof course.name === "string" &&
                    typeof course.code === "string" &&
                    V.isValidCredits(course.credits)
                )
                .map(course => ({
                    name: course.name.trim(),
                    code: course.code.trim(),
                    credits: Number(course.credits)
                }))
                .filter(course =>
                    course.name && course.code
                );

            courses.forEach(course => {
                courseMap.set(
                    normalize(displayName(course)),
                    course
                );
            });

            console.info(
                `Đã tải ${courses.length} môn học GPA.`
            );
        } catch (error) {
            console.error(
                "Lỗi tải danh mục môn học:",
                error
            );
        }
    }

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

            // HTML hiện tại: tên môn, tín chỉ và 4 đầu điểm
            if (inputs.length < 6) {
            valid = false;
            return;
            }

            const [nameInput, creditsInput, ...scoreInputs] = inputs;

            inputs.forEach(V.clearFieldError);

            const name = nameInput.value.trim();
            const code = nameInput.dataset.courseCode || "";
            const credits = Number(creditsInput.value);
            const scores = scoreInputs
                .slice(0, 4)
                .map(input => Number(input.value));
                if (!V.isRequired(name)) {
    V.showFieldError(
        nameInput,
        "Vui lòng chọn môn học."
    );
    valid = false;
}
if (!V.isRequired(code)) {
    if (V.isRequired(name)) {
        V.showFieldError(
            nameInput,
            "Vui lòng chọn môn học từ danh sách gợi ý."
        );
    }

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
            delete input.dataset.courseCode;
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

    // Animation cuộn mượt đến một phần tử
    let scrollAnimationId = null;

    function animateScrollTo(element) {
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        // Hủy animation cũ nếu người dùng tính lại
        if (scrollAnimationId !== null) {
            cancelAnimationFrame(scrollAnimationId);
            scrollAnimationId = null;
        }

        // Xác định vùng đang cuộn: window hoặc #main-content
        const main = document.querySelector("#main-content");
        const mainCanScroll = main &&
            main.scrollHeight > main.clientHeight &&
            ["auto", "scroll"].includes(
                getComputedStyle(main).overflowY
            );

        const container = mainCanScroll ? main : window;

        const startY = mainCanScroll
            ? main.scrollTop
            : window.scrollY;

        const destinationY = mainCanScroll
            ? element.getBoundingClientRect().top -
              main.getBoundingClientRect().top +
              main.scrollTop - 90
            : element.getBoundingClientRect().top +
              window.scrollY - 90;

        const maxY = mainCanScroll
            ? main.scrollHeight - main.clientHeight
            : document.documentElement.scrollHeight -
              window.innerHeight;

        const targetY = Math.max(
            0,
            Math.min(destinationY, maxY)
        );

        function setScroll(y) {
            if (container === window) {
                window.scrollTo({ top: y, behavior: "instant" });
            } else {
                main.scrollTop = y;
            }
        }

        if (reducedMotion) {
            setScroll(targetY);
            return;
        }

        const duration = 1500;
        const distance = targetY - startY;
        let startTime = null;

        function frame(timestamp) {
            if (startTime === null) {
                startTime = timestamp;
            }

            const progress = Math.min(
                (timestamp - startTime) / duration,
                1
            );

            // Ease-in-out: tăng tốc rồi giảm tốc
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            setScroll(startY + distance * eased);

            if (progress < 1) {
                scrollAnimationId =
                    requestAnimationFrame(frame);
            } else {
                scrollAnimationId = null;
            }
        }

        scrollAnimationId = requestAnimationFrame(frame);
    }
// Khởi tạo gợi ý môn học trước chức năng lưu GPA
setupCourseSuggestions();


// ==========================================
// KHÔI PHỤC DỮ LIỆU GPA ĐÃ LƯU
// ==========================================

function restoreGPA(record) {

    const { input, result } = record;

    // 1. Khôi phục thông tin học kỳ
    calculator.querySelector("#academic-year").value =
        input.academicYear;

    calculator.querySelector("#semester").value =
        input.semester;

    calculator.querySelector("#student-year").value =
        input.studentYear;

    // 2. Xóa các dòng môn học hiện tại
    courseBody.replaceChildren();

    // 3. Khôi phục từng môn học đã lưu
    input.courses.forEach(course => {

        const row = savedGpaRowTemplate.cloneNode(true);

        const inputs = row.querySelectorAll("input");

        // Tên môn học và mã môn
        inputs[0].value = course.name;
        inputs[0].dataset.courseCode = course.code;

        // Số tín chỉ
        inputs[1].value = course.credits;

        // Khôi phục 4 đầu điểm
        course.scores.forEach((score, index) => {
            inputs[index + 2].value = score;
        });

        // Xóa thông báo lỗi nếu có
        inputs.forEach(input => {
            V.clearFieldError(input);
        });

        courseBody.appendChild(row);
    });

    // 4. Cập nhật số thứ tự
    updateRowNumbers();

    // 5. Khôi phục kết quả tổng quan
    renderSummary(result);

    // 6. Khôi phục bảng điểm chi tiết
    renderDetails(result.results);

    // 7. Cập nhật biểu tượng
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Lưu cấu trúc hàng môn học ban đầu
const savedGpaRowTemplate =
    courseBody.querySelector("tr").cloneNode(true);

// Khởi tạo chức năng lưu và khôi phục
let gpaStorage = null;

try {

    gpaStorage = window.EDULearningStorage.mount(
        "gpa",
        calculateButton,
        restoreGPA
    );

} catch (error) {

    console.error("Lỗi khởi tạo lưu GPA:", error);
}

calculateButton.addEventListener("click", function () {
    const courses = readCourses();

    // Dữ liệu không hợp lệ thì không cuộn
    if (courses === null) return;

    const result = calculateGPA(courses);

    renderSummary(result);
    renderDetails(result.results);
// Lưu kết quả GPA vào SQLite
gpaStorage?.save(
    {
        academicYear: calculator.querySelector(
            "#academic-year"
        ).value,

        semester: calculator.querySelector(
            "#semester"
        ).value,

        studentYear: calculator.querySelector(
            "#student-year"
        ).value,

        courses: courses
    },
    result
);
    // Tự động cuộn xuống Bảng điểm chi tiết
    const detailSection = calculator.querySelector(
        ".calc-step--detail"
    );

if (detailSection) {
    animateScrollTo(detailSection);
}
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
            delete input.dataset.courseCode;
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
resetButton.addEventListener("click", async function () {

    if (calculateButton.disabled) return;

    if (gpaStorage) {

        const success = await gpaStorage.clear();

        if (!success) return;
    }

    // Giữ nguyên toàn bộ code làm mới cũ phía dưới    // Giữ lại một dòng môn học để người dùng nhập tiếp
    const firstRow = courseBody.querySelector("tr");

    if (!firstRow) return;

    const emptyRow = firstRow.cloneNode(true);

    // Xóa dữ liệu và thông báo lỗi
    emptyRow.querySelectorAll("input").forEach(input => {
        input.value = "";
        delete input.dataset.courseCode;
        V.clearFieldError(input);
    });

    // Xóa các dòng khác, chỉ giữ một dòng trống
    courseBody.replaceChildren(emptyRow);
    updateRowNumbers();

    // Xóa kết quả GPA cũ
    summary.querySelectorAll(".result-gpa-card .result-card-value strong")
        .forEach(element => element.textContent = "-");

    summary.querySelectorAll(".result-stat-card > strong")
        .forEach(element => element.textContent = "0");

detailBody.replaceChildren();
});

// Tự động tải kết quả GPA khi mở trang
gpaStorage?.load();

}

// Khởi tạo khi tải trực tiếp trang Tính GPA
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCalculator);
} else {
    initializeCalculator();
}

// Khởi tạo lại khi điều hướng qua sidebar EDUTRACK
document.addEventListener("edutrack:page-loaded", initializeCalculator);