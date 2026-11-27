"use strict";
const PROJECTION_COURSES_URL = new URL(
    "../data/courses.json",
    document.currentScript.src
).href;
const PROJECTION_DETAILS_URL = new URL(
    "../data/course-details.json",
    document.currentScript.src
).href;
function initializeProjection() {
    const projection = document.querySelector("#projection-wrapper");
    const V = window.EDUValidation;

    if (!projection || !V) return;

    if (projection.dataset.projectionInitialized === "true") return;

    const courseBody = projection.querySelector(".projection-course-list");
    const addButton = projection.querySelector(".projection-add-course");
    const calculateButton = projection.querySelector(
        ".projection-calculate-button"
    );
    const resetButton = projection.querySelector(
    ".projection-reset-button"
);
    const actions = projection.querySelector(
        ".projection-section:nth-child(3) .projection-actions"
    );

    if (!courseBody || !courseBody.querySelector("tr") ||
        !addButton || !calculateButton || !actions) {
        return;
    }

    projection.dataset.projectionInitialized = "true";

    // 1. Lấy các thành phần trên giao diện
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

   // Dữ liệu chi tiết môn học lấy từ JSON
let detailCourses = [];

// Tìm môn tiên quyết của một học phần bằng mã môn
function getPrerequisiteCourses(courseCode) {
    const selectedCourse = detailCourses.find(
        course => course.id === courseCode
    );

    if (!selectedCourse) return [];

    const prerequisite = selectedCourse.prerequisite;

    if (
        typeof prerequisite !== "string" ||
        !prerequisite.trim() ||
        normalizeCourseName(prerequisite) === "khong"
    ) {
        return [];
    }

    // Hỗ trợ nhiều môn nếu dữ liệu ngăn cách bằng , hoặc ;
    const names = prerequisite
        .split(/[,;]/)
        .map(name => name.trim())
        .filter(Boolean);

    return names.map(name => {
        const matchedCourse = detailCourses.find(course =>
            normalizeCourseName(course.name) ===
                normalizeCourseName(name) ||
            course.id.toLowerCase() === name.toLowerCase()
        );

        if (!matchedCourse) {
            // Giữ nguyên tên từ JSON, không tự đoán tín chỉ
            return {
                name,
                credits: "—",
                code: null
            };
        }

        return {
            name: matchedCourse.name,
            credits: matchedCourse.credits,
            code: matchedCourse.id
        };
    });
}
   
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
// Tập hợp mã các môn đang dự định học kỳ tới
const plannedCourseCodes = new Set();

courseBody.querySelectorAll(
    'input[type="text"]'
).forEach(input => {
    if (input.dataset.courseCode) {
        plannedCourseCodes.add(input.dataset.courseCode);
    }
});
        courseBody.querySelectorAll("tr").forEach(row => {
            const nameInput = row.querySelector(
                'input[type="text"]'
            );

const creditsInput = row.querySelector('input[type="number"]');

if (
    !nameInput ||
    !creditsInput ||
    !nameInput.dataset.courseCode ||
    !V.isValidCredits(creditsInput.value)
) {
    return;
}

const courseCode = nameInput.dataset.courseCode;

const matches = getPrerequisiteCourses(courseCode);

matches.forEach(course => {
    const isPlanned = course.code &&
        plannedCourseCodes.has(course.code);

    requiredCourses.set(
        normalizeCourseName(course.name),
        {
            ...course,
            isPlanned: Boolean(isPlanned)
        }
    );
});
});

        // Xóa các hàng cũ
        prerequisiteBody.replaceChildren();

        // Tạo hàng mới cho từng môn tiên quyết
        requiredCourses.forEach(course => {
            const row = document.createElement("tr");
if (course.isPlanned) {
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.style.color = "var(--danger-color)";

    cell.textContent =
        `⚠ ${course.name} đang nằm trong danh sách ` +
        "môn học kỳ tới nhưng cũng là môn tiên quyết. " +
        "Vui lòng kiểm tra và điều chỉnh kế hoạch học.";

    row.appendChild(cell);
    prerequisiteBody.appendChild(row);
    return;
}
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

            field.append(input);
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
                "Không có môn tiên quyết được khai báo cho các môn đã chọn.";

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
// Tự tính tổng tín chỉ từ danh sách môn đã chọn
function updateSemesterCredits() {
    let total = 0;

    courseBody.querySelectorAll(
        ".projection-credit-input"
    ).forEach(input => {
        const credits = Number(input.value);

        if (V.isValidCredits(input.value)) {
            total += credits;
        }
    });

    semesterInput.value = total > 0
        ? String(total)
        : "";
}

    // Autocomplete môn học cho trang Dự phóng GPA
    async function setupProjectionAutocomplete() {
        const dropdown = document.createElement("div");
        dropdown.className = "gpa-course-dropdown";
        dropdown.id = "projection-course-dropdown";
        dropdown.setAttribute("role", "listbox");
        document.body.appendChild(dropdown);

        const controller = new AbortController();
        const signal = controller.signal;

        let courses = [];
        let activeInput = null;
        let visibleCourses = [];
        let activeIndex = -1;

        function normalizeSearch(value) {
            return String(value ?? "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/Đ/g, "D")
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase();
        }

        function courseLabel(course) {
            return `${course.name} (${course.code})`;
        }

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

            const height = Math.min(
                dropdown.scrollHeight,
                260
            );

            const spaceBelow =
                window.innerHeight - rect.bottom;

            const openAbove =
                spaceBelow < height + 8 &&
                rect.top > spaceBelow;

            dropdown.style.top = openAbove
                ? `${Math.max(8, rect.top - height - 6)}px`
                : `${rect.bottom + 6}px`;
        }

        function updateActiveOption() {
            dropdown.querySelectorAll(
                ".gpa-course-option"
            ).forEach((option, index) => {
                const selected = index === activeIndex;

                option.classList.toggle(
                    "is-active",
                    selected
                );

                option.setAttribute(
                    "aria-selected",
                    String(selected)
                );

                if (selected) {
                    option.scrollIntoView({
                        block: "nearest"
                    });
                }
            });
        }

        function selectCourse(course) {
            if (!activeInput) return;

            const nameInput = activeInput;
            const row = nameInput.closest("tr");

            if (!row) return;

            const creditsInput = row.querySelector(
                ".projection-credit-input"
            );

            if (!creditsInput) return;

            nameInput.value = courseLabel(course);
            nameInput.dataset.courseCode = course.code;
            creditsInput.value = String(course.credits);

            V.clearFieldError(nameInput);
            V.clearFieldError(creditsInput);

            closeDropdown();

            // Cập nhật ngay sau khi tự điền tín chỉ
            updateSemesterCredits();
            updatePrerequisites();
            clearNotice();

            nameInput.focus();
        }

        function renderSuggestions(input) {
            const keyword = normalizeSearch(input.value);

            closeDropdown();

            if (!keyword || !courses.length) return;

            visibleCourses = courses.filter(course => {
                const searchable = normalizeSearch(
                    `${course.name} ${course.code}`
                );

                return searchable.includes(keyword);
            }).slice(0, 8);

            if (!visibleCourses.length) return;

            activeInput = input;

            visibleCourses.forEach((course, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "gpa-course-option";
                button.setAttribute("role", "option");
                button.setAttribute("aria-selected", "false");
                button.dataset.index = String(index);

                const info = document.createElement("span");
                info.className = "gpa-course-option-info";

                const name = document.createElement("span");
                name.className = "gpa-course-option-name";
                name.textContent = course.name;

                const code = document.createElement("span");
                code.className = "gpa-course-option-code";
                code.textContent = course.code;

                const credits = document.createElement("span");
                credits.className =
                    "gpa-course-option-credits";
                credits.textContent = `${course.credits} TC`;

                info.append(name, code);
                button.append(info, credits);
                dropdown.appendChild(button);
            });

            dropdown.classList.add("is-open");
            input.setAttribute("aria-expanded", "true");
            positionDropdown(input);
        }

        // Xử lý cho cả dòng ban đầu và dòng thêm mới
        courseBody.addEventListener(
            "input",
            event => {
                const input = event.target;

                if (!(input instanceof HTMLInputElement)) {
                    return;
                }

                if (input.type !== "text") return;

                const row = input.closest("tr");
                if (!row || !courseBody.contains(row)) return;

                const creditsInput = row.querySelector(
                    ".projection-credit-input"
                );

                // Khi sửa tên, thông tin môn đã chọn không còn hợp lệ
                delete input.dataset.courseCode;

                if (creditsInput) {
                    creditsInput.value = "";
                }

                updateSemesterCredits();
                updatePrerequisites();
                renderSuggestions(input);
            },
            { signal }
        );

        // Hiện lại gợi ý khi người dùng quay về ô nhập
        courseBody.addEventListener(
            "focusin",
            event => {
                const input = event.target;

                if (!(input instanceof HTMLInputElement)) {
                    return;
                }

                if (input.type !== "text") return;

                if (input.dataset.courseCode) return;

                renderSuggestions(input);
            },
            { signal }
        );

        courseBody.addEventListener(
            "keydown",
            event => {
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

                    activeIndex = activeIndex <= 0
                        ? visibleCourses.length - 1
                        : activeIndex - 1;

                    updateActiveOption();
                } else if (event.key === "Enter") {
                    if (activeIndex < 0) {
                        activeIndex = 0;
                    }

                    event.preventDefault();
                    selectCourse(visibleCourses[activeIndex]);
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    closeDropdown();
                }
            },
            { signal }
        );

        // Chọn gợi ý bằng chuột hoặc cảm ứng
        dropdown.addEventListener(
            "pointerdown",
            event => {
                if (!(event.target instanceof Element)) {
                    return;
                }

                const button = event.target.closest(
                    ".gpa-course-option"
                );

                if (!button) return;

                event.preventDefault();

                const index = Number(button.dataset.index);
                const course = visibleCourses[index];

                if (course) selectCourse(course);
            },
            { signal }
        );

        // Đóng khi nhấn bên ngoài
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

        // Đóng khi cuộn để danh sách không lệch vị trí
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

        // Dọn dropdown khi SPA chuyển sang trang khác
        document.addEventListener(
            "edutrack:page-loaded",
            () => {
                if (!projection.isConnected) {
                    closeDropdown();
                    controller.abort();
                    dropdown.remove();
                }
            },
            { signal }
        );

        // Tải môn học từ JSON
        try {
           const [response, detailResponse] = await Promise.all([
    fetch(PROJECTION_COURSES_URL),
    fetch(PROJECTION_DETAILS_URL)
]);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
if (!detailResponse.ok) {
    throw new Error(
        `Không tải được course-details.json: HTTP ${detailResponse.status}`
    );
}
            const data = await response.json();
const details = await detailResponse.json();

if (!Array.isArray(details)) {
    throw new Error(
        "course-details.json phải chứa một mảng học phần."
    );
}

detailCourses = details
    .filter(course =>
        course &&
        typeof course.id === "string" &&
        typeof course.name === "string" &&
        V.isValidCredits(course.credits)
    )
    .map(course => ({
        id: course.id.trim(),
        name: course.name.trim(),
        credits: Number(course.credits),
        prerequisite: course.prerequisite
    }));
            if (!Array.isArray(data)) {
                throw new Error(
                    "courses.json phải chứa một mảng môn học."
                );
            }

            if (!projection.isConnected) {
                controller.abort();
                dropdown.remove();
                return;
            }

            const uniqueCourses = new Map();

            data.forEach(course => {
                if (
                    !course ||
                    typeof course.name !== "string" ||
                    typeof course.code !== "string" ||
                    !V.isValidCredits(course.credits)
                ) {
                    return;
                }

                const name = course.name.trim();
                const code = course.code.trim();

                if (!name || !code) return;

                uniqueCourses.set(code, {
                    name,
                    code,
                    credits: Number(course.credits)
                });
            });

            courses = [...uniqueCourses.values()];
// Làm mới bảng tiên quyết theo dữ liệu JSON
updatePrerequisites();
            courseBody.querySelectorAll(
                'input[type="text"]'
            ).forEach(prepareInput);

            console.info(
                `Đã tải ${courses.length} môn cho trang Dự phóng.`
            );
        } catch (error) {
            console.error(
                "Không tải được danh sách môn dự phóng:",
                error
            );

            showNotice(
                "Không tải được danh sách môn học. " +
                "Vui lòng kiểm tra courses.json."
            );
        }
    }

    // 4. Thêm một môn học mới
    addButton.addEventListener("click", function () {
        const row = template.cloneNode(true);

        row.querySelectorAll("input").forEach(input => {
    input.value = "";
    delete input.dataset.courseCode;
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
        updateSemesterCredits();
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
    delete input.dataset.courseCode;
    V.clearFieldError(input);
});
        }

        updateCourseRows();
        updateSemesterCredits();
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
    if (!event.target.matches("input")) return;

    // Cập nhật tổng tín chỉ kỳ tới
    updateSemesterCredits();

    // Cập nhật các môn tiên quyết
    updatePrerequisites();
});

courseBody.addEventListener("change", function (event) {
    if (!event.target.matches("input")) return;

    updateSemesterCredits();
    updatePrerequisites();
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
    "Vui lòng chọn ít nhất một môn học hợp lệ.",
    "Tổng tín chỉ kỳ tới không hợp lệ."
)) valid = false;

        // Kiểm tra danh sách môn học kỳ tới
        courseBody.querySelectorAll("tr").forEach(row => {
            const nameInput = row.querySelector('input[type="text"]');
            const creditInput = row.querySelector('input[type="number"]');

const name = nameInput.value.trim();
const code = nameInput.dataset.courseCode || "";

V.clearFieldError(nameInput);

if (!V.isRequired(name)) {
    V.showFieldError(
        nameInput,
        "Vui lòng chọn môn học."
    );
    valid = false;
} else if (!V.isRequired(code)) {
    V.showFieldError(
        nameInput,
        "Vui lòng chọn môn từ danh sách gợi ý."
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
    name,
    code,
    credits: Number(creditInput.value)
});
        });

        // Kiểm tra điểm các môn tiên quyết
        const plannedCodes = new Set(
    courses.map(course => course.code)
);

const hasPrerequisiteConflict = courses.some(course =>
    getPrerequisiteCourses(course.code).some(
        prerequisite =>
            prerequisite.code &&
            plannedCodes.has(prerequisite.code)
    )
);

if (hasPrerequisiteConflict) {
    showNotice(
        "Có môn tiên quyết đang nằm trong danh sách môn " +
        "học kỳ tới. Vui lòng kiểm tra điều kiện học phần " +
        "và điều chỉnh kế hoạch trước khi tính dự phóng."
    );
    return null;
}
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
        "Tổng tín chỉ chưa được cập nhật. " +
        "Vui lòng kiểm tra danh sách môn học."
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
    return String(name ?? "")
        .replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
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
const related = getPrerequisiteCourses(course.code);

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
    function renderSummary(data, result) {
        requiredResult.textContent =
            result.requiredGPA.toFixed(2);

        resultMessage.textContent =
            "Đã tìm được phương án điểm đề xuất để hướng tới " +
            `GPA ${data.targetGPA.toFixed(2)}.`;

        resultMessage.classList.add("is-success");
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
    const value = Math.min(4, Math.max(0, gpa));
    return 230 - value * 50;
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
        resultMessage.classList.remove("is-success");
        setSummaryValue(summaryTarget, "—", "4.00");
        setSummaryValue(summaryForecast, "—", "4.00");
        setSummaryValue(summaryAverage, "—", "10");

        resultBody.replaceChildren();
chart.setAttribute("hidden", "");
    }

    // Animation cuộn từ từ đến kết quả dự phóng
    let projectionScrollId = null;

    function scrollToProjectionResults() {
        const target = projection.querySelector(
            "#projection-results"
        );

        if (!target) return;

        if (projectionScrollId !== null) {
            cancelAnimationFrame(projectionScrollId);
            projectionScrollId = null;
        }

        // Tìm vùng cuộn thực sự
        let parent = target.parentElement;

        while (parent) {
            const style = getComputedStyle(parent);

            if (
                /(auto|scroll)/.test(style.overflowY) &&
                parent.scrollHeight > parent.clientHeight
            ) {
                break;
            }

            parent = parent.parentElement;
        }

        const useWindow =
            !parent ||
            parent === document.body ||
            parent === document.documentElement;

        const start = useWindow
            ? window.scrollY
            : parent.scrollTop;

        const containerTop = useWindow
            ? 0
            : parent.getBoundingClientRect().top;

        const desired = start +
            target.getBoundingClientRect().top -
            containerTop - 90;

        const maxScroll = useWindow
            ? Math.max(
                0,
                document.documentElement.scrollHeight -
                window.innerHeight
            )
            : Math.max(
                0,
                parent.scrollHeight - parent.clientHeight
            );

        const end = Math.max(
            0,
            Math.min(desired, maxScroll)
        );

        function setScroll(value) {
            if (useWindow) {
                window.scrollTo({
                    top: value,
                    behavior: "instant"
                });
            } else {
                parent.scrollTop = value;
            }
        }

        if (
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        ) {
            setScroll(end);
            return;
        }

        const duration = 1400;
        const distance = end - start;
        let startTime = null;

        function animate(timestamp) {
            if (startTime === null) {
                startTime = timestamp;
            }

            const progress = Math.min(
                (timestamp - startTime) / duration,
                1
            );

            const eased =
                (1 - Math.cos(Math.PI * progress)) / 2;

            setScroll(start + distance * eased);

            if (progress < 1) {
                projectionScrollId =
                    requestAnimationFrame(animate);
            } else {
                projectionScrollId = null;
            }
        }

        projectionScrollId =
            requestAnimationFrame(animate);
    }

// ==========================================
// KHÔI PHỤC DỮ LIỆU DỰ PHÓNG GPA
// ==========================================

function restoreProjection(record) {

    const { input, result } = record;

    // 1. Khôi phục thông tin GPA
    currentInput.value = input.currentGPA;

    earnedInput.value = input.earnedCredits;

    targetInput.value = input.targetGPA;

    // 2. Xóa danh sách môn học hiện tại
    courseBody.replaceChildren();

    // 3. Khôi phục các môn học kỳ tới
    input.courses.forEach(course => {

        const row = template.cloneNode(true);

        const nameInput = row.querySelector(
            'input[type="text"]'
        );

        const creditInput = row.querySelector(
            'input[type="number"]'
        );

        nameInput.value = course.name;

        nameInput.dataset.courseCode = course.code;

        creditInput.value = course.credits;

        courseBody.appendChild(row);
    });

    // 4. Cập nhật danh sách và tổng tín chỉ
    updateCourseRows();

    updateSemesterCredits();

    // 5. Tạo lại bảng môn tiên quyết
    updatePrerequisites();

    // 6. Khôi phục điểm môn tiên quyết
    const savedScores = new Map(
        (input.prerequisiteScores || []).map(item => [
            normalizeCourseName(item.name),
            item.score
        ])
    );

    projection.querySelectorAll(
        "#prerequisite-course-list tr"
    ).forEach(row => {

        const scoreInput = row.querySelector(
            'input[type="number"]'
        );

        if (!scoreInput) return;

        const name = normalizeCourseName(
            row.cells[0].textContent
        );

        if (savedScores.has(name)) {
            scoreInput.value = savedScores.get(name);
        }
    });

    // 7. Khôi phục kết quả tổng quan
    renderSummary(input, result);

    // 8. Khôi phục bảng điểm đề xuất
    renderCourses(input, result);

    // 9. Hiện lại biểu đồ
    chart.removeAttribute("hidden");

    renderChart(input, result);

    // 10. Cập nhật biểu tượng
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Khởi tạo chức năng lưu dự phóng
let projectionStorage = null;

try {

    projectionStorage = window.EDULearningStorage.mount(
        "projection",
        calculateButton,
        restoreProjection
    );

} catch (error) {

    console.error(
        "Lỗi khởi tạo lưu dự phóng:",
        error
    );
}

// ==========================================
// NÚT LÀM MỚI DỰ PHÓNG GPA
// ==========================================


resetButton?.addEventListener("click", async function () {

    // Không làm mới khi đang tải hoặc lưu dữ liệu
    if (calculateButton.disabled) return;

    // Xóa dữ liệu dự phóng đã lưu trong SQLite
    if (projectionStorage) {

        const success = await projectionStorage.clear();

        // Nếu xóa thất bại thì giữ nguyên dữ liệu
        if (!success) return;
    }

    // 1. Tạo lại một dòng môn học trống
    const emptyRow = template.cloneNode(true);

    emptyRow.querySelectorAll("input").forEach(input => {
        input.value = "";
        delete input.dataset.courseCode;
        V.clearFieldError(input);
    });

    // Khôi phục biểu tượng xóa môn học
    const deleteButton = emptyRow.querySelector(
        ".projection-icon-button"
    );

    deleteButton.innerHTML =
        '<i data-lucide="trash-2" aria-hidden="true"></i>';

    // 2. Xóa danh sách môn học cũ
    courseBody.replaceChildren(emptyRow);

    // 3. Xóa thông tin GPA và tín chỉ
    [
        currentInput,
        earnedInput,
        targetInput,
        semesterInput
    ].forEach(input => {
        input.value = "";
        V.clearFieldError(input);
    });

    // 4. Cập nhật lại danh sách môn học
    updateCourseRows();

    // 5. Cập nhật tổng số tín chỉ
    updateSemesterCredits();

    // 6. Xóa danh sách môn tiên quyết
    updatePrerequisites();

    // 7. Xóa toàn bộ kết quả và ẩn biểu đồ
    clearResults();

    // 8. Xóa thông báo cũ
    clearNotice();

    // 9. Dừng hiệu ứng cuộn nếu đang chạy
    if (projectionScrollId !== null) {
        cancelAnimationFrame(projectionScrollId);
        projectionScrollId = null;
    }

    // 10. Cập nhật biểu tượng
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

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

// Hiện biểu đồ trước khi cập nhật dữ liệu
chart.removeAttribute("hidden");

// Vẽ biểu đồ từ kết quả dự phóng
renderChart(data, result);


// Lấy điểm các môn tiên quyết
const prerequisiteScores = Array.from(
    projection.querySelectorAll(
        "#prerequisite-course-list tr"
    )
)
.filter(row =>
    row.querySelector('input[type="number"]')
)
.map(row => ({
    name: row.cells[0].textContent.trim(),

    score: Number(
        row.querySelector('input[type="number"]').value
    )
}));

// Tự động lưu toàn bộ dữ liệu
projectionStorage?.save(
    {
        ...data,
        prerequisiteScores
    },
    result
);

// Cuộn mượt xuống mục Kết quả tổng quan
scrollToProjectionResults();

        showNotice(
            "Đã tính được điểm mục tiêu đề xuất cho từng môn. " +
            `Nếu đạt các mức điểm này, GPA tích lũy có thể là ` +
            `${result.forecastGPA.toFixed(2)}/4. ` +
            "Đây là phương án tham khảo, không phải " +
            "điểm số chắc chắn sẽ đạt."
        );
    });

updateCourseRows();
updateSemesterCredits();
updatePrerequisites();
clearResults();

// Tải danh sách môn học và môn tiên quyết
const catalogReady = setupProjectionAutocomplete();

// Khôi phục dữ liệu sau khi tải danh sách môn
projectionStorage?.load(catalogReady);

}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeProjection,
        { once: true }
    );
} else {
    initializeProjection();
}

document.addEventListener(
    "edutrack:page-loaded",
    initializeProjection
);