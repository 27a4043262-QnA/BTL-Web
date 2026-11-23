
"use strict";

// ==========================================================
// EDUTRACK - DANH MỤC MÔN HỌC (BÀI 7)
// Sử dụng mã môn học (code) thay cho id số
// ==========================================================

function initializeCoursesPage() {

  // 1. LẤY CÁC PHẦN TỬ HTML
  const courseList = document.querySelector("#course-list");
  const filterButtons = document.querySelectorAll(".filter-btn");

  const searchInput = document.querySelector("#course-search");
  const searchForm = document.querySelector(".search-form");

  const creditsSelect =
    document.querySelector("#course-credits-filter");

  const sortButton =
    document.querySelector("#course-sort");

  const resultCount =
    document.querySelector(".course-result-count");

  const loadStatus =
    document.querySelector("#course-load-status");

  const pagination =
    document.querySelector(".et-course-pagination");

  const paginationList =
    pagination?.querySelector(".pagination");

  // Kiểm tra các phần tử cần thiết
  if (
    !courseList ||
    !filterButtons.length ||
    !searchInput ||
    !searchForm ||
    !creditsSelect ||
    !sortButton ||
    !resultCount ||
    !loadStatus ||
    !pagination ||
    !paginationList
  ) {
    return;
  }

  // Tránh khởi tạo lặp khi chuyển trang SPA
  if (courseList.dataset.etInitialized === "true") {
    return;
  }

  courseList.dataset.etInitialized = "true";

  // ==========================================================
  // 2. DỮ LIỆU VÀ BIẾN TRẠNG THÁI
  // ==========================================================

  const DATA_URL = "../assets/data/courses.json";
  const COURSES_PER_PAGE = 9;

  const CATEGORY_NAMES = {
    "dai-cuong": "Đại cương",
    "co-so-nganh": "Cơ sở ngành",
    "chuyen-nganh": "Chuyên ngành"
  };

  let courses = [];

  let currentCategory = "all";
  let currentCredits = "all";
  let currentKeyword = "";
  let currentSort = "name-asc";
  let currentPage = 1;

  let isReady = false;

  // Mặc định sắp xếp A - Z


  // ==========================================================
  // 3. CHUẨN HÓA TIẾNG VIỆT
  // ==========================================================

  function normalizeText(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Khóa điều khiển khi đang tải JSON
  function setControlsDisabled(disabled) {
    searchInput.disabled = disabled;
    creditsSelect.disabled = disabled;
    sortButton.disabled = disabled;

    filterButtons.forEach(function (button) {
      button.disabled = disabled;
    });
  }

  // ==========================================================
  // 4. THÔNG BÁO TRẠNG THÁI
  // ==========================================================

  function setStatus(message, type = "info", retry = false) {

    loadStatus.replaceChildren();
    loadStatus.className = "course-load-status";
    loadStatus.hidden = !message;

    if (!message) {
      return;
    }

    loadStatus.classList.add("course-status-" + type);

    const content = document.createElement("span");
    content.textContent = message;
    loadStatus.appendChild(content);

    if (retry) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "course-retry-btn";
      button.textContent = "Thử tải lại";

      button.addEventListener("click", loadCourses);
      loadStatus.appendChild(button);
    }
  }

  // ==========================================================
  // 5. KIỂM TRA DỮ LIỆU JSON
  // ==========================================================

  function validateCourses(data) {

    if (!Array.isArray(data)) {
      throw new Error(
        "File JSON phải chứa một mảng môn học."
      );
    }

    const codes = new Set();

    for (const [index, course] of data.entries()) {

      const valid =
        course &&
        typeof course === "object" &&
        typeof course.code === "string" &&
        course.code.trim() !== "" &&
        typeof course.name === "string" &&
        course.name.trim() !== "" &&
        Object.prototype.hasOwnProperty.call(
          CATEGORY_NAMES,
          course.category
        ) &&
        Number.isInteger(course.credits) &&
        course.credits > 0 &&
        typeof course.description === "string" &&
        typeof course.image === "string" &&
        Array.isArray(course.keywords) &&
        course.keywords.every(function (keyword) {
          return typeof keyword === "string";
        });

      if (!valid) {
        throw new Error(
          "Bản ghi môn học thứ " +
          (index + 1) +
          " không hợp lệ."
        );
      }

      // Kiểm tra mã môn không được trùng
      const codeKey =
        course.code.trim().toUpperCase();

      if (codes.has(codeKey)) {
        throw new Error(
          "Mã môn học bị trùng: " + course.code
        );
      }

      codes.add(codeKey);
    }

    return data;
  }

  // ==========================================================
  // 6. TẢI JSON BẰNG FETCH
  // ==========================================================

  async function loadCourses() {

    isReady = false;
    setControlsDisabled(true);

    courseList.replaceChildren();
    pagination.hidden = true;
    resultCount.textContent = "";

    setStatus(
      "Đang tải danh sách môn học...",
      "loading"
    );

    try {

      const response = await fetch(DATA_URL, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          "HTTP " +
          response.status +
          " khi tải " +
          DATA_URL
        );
      }

      courses = validateCourses(
        await response.json()
      );

      isReady = true;
      setControlsDisabled(false);

      if (courses.length === 0) {
        setStatus(
          "Chưa có môn học nào trong dữ liệu JSON.",
          "empty"
        );

        resultCount.textContent =
          "Tìm thấy 0 môn học.";

        return;
      }

      // Tải thành công: Không hiện thanh màu xanh
      setStatus("");

      renderCourses();

    } catch (error) {

      courses = [];
      isReady = false;

      console.error(
        "EduTrack: Lỗi tải dữ liệu môn học:",
        error
      );

      setStatus(
        "Không thể tải dữ liệu môn học. Kiểm tra courses.json và Live Server.",
        "error",
        true
      );
    }
  }

  // ==========================================================
  // 7. LỌC, TÌM KIẾM VÀ SẮP XẾP
  // ==========================================================

  function getVisibleCourses() {

    const selected = courses.filter(function (course) {

      // Lọc theo nhóm môn
      const matchesCategory =
        currentCategory === "all" ||
        course.category === currentCategory;

      // Lọc theo số tín chỉ
      const matchesCredits =
        currentCredits === "all" ||
        course.credits === Number(currentCredits);

      // Giữ cách tìm kiếm theo tên như trước
      const matchesName =
        normalizeText(course.name).includes(currentKeyword);

      return (
        matchesCategory &&
        matchesCredits &&
        matchesName
      );
    });

    // Sắp xếp A - Z
    if (currentSort === "name-asc") {
      selected.sort(function (a, b) {
        return a.name.localeCompare(b.name, "vi");
      });
    }

    // Sắp xếp Z - A
    else if (currentSort === "name-desc") {
      selected.sort(function (a, b) {
        return b.name.localeCompare(a.name, "vi");
      });
    }

    return selected;
  }

  // ==========================================================
  // 8. TẠO CARD TỪ JSON
  // ==========================================================

  function createCourseCard(course) {

    // Cột Bootstrap
    const column = document.createElement("div");

    column.className =
      "col-12 col-md-6 col-xl-4 mb-4";

    // Card
    const card = document.createElement("article");

    card.className = "card course-card h-100";
    card.dataset.category = course.category;

    // Ảnh môn học
    const image = document.createElement("img");

    image.className =
      "card-img-top course-image img-fluid";

    image.src = course.image;
    image.alt = "Minh họa môn " + course.name;
    image.loading = "lazy";

    // Nội dung Card
    const body = document.createElement("div");

    body.className = "card-body course-card-body";

    // Nhóm môn + tín chỉ
    const meta = document.createElement("div");
    meta.className = "course-meta";

    const tag = document.createElement("span");
    tag.className = "course-tag";
    tag.textContent = CATEGORY_NAMES[course.category];

    const credits = document.createElement("span");
    credits.className = "course-credits";
    credits.textContent =
      course.credits + " Tín chỉ";

    meta.append(tag, credits);

    // Tên môn
    const title = document.createElement("h2");
    title.className = "course-title";
    title.textContent = course.name;

    // MÃ MÔN HỌC - MỚI BỔ SUNG
    const code = document.createElement("p");

    code.className = "course-code";
    code.textContent = "Mã môn: " + course.code;

    // Mô tả
    const description = document.createElement("p");

    description.className = "course-description";
    description.textContent = course.description;

    // Liên kết chi tiết BẰNG MÃ MÔN
    const detailLink = document.createElement("a");

    detailLink.className = "course-link";
    detailLink.textContent = "Xem chi tiết →";

    detailLink.href =
      "course-detail.html?code=" +
      encodeURIComponent(course.code);

    detailLink.setAttribute(
      "aria-label",
      "Xem chi tiết môn " + course.name
    );

    body.append(
      meta,
      title,
      code,
      description,
      detailLink
    );

    card.append(image, body);
    column.appendChild(card);

    return column;
  }

  // ==========================================================
  // 9. TẠO NÚT PHÂN TRANG
  // ==========================================================

  function createPageButton(
    label,
    page,
    disabled = false,
    active = false,
    ariaLabel = ""
  ) {

    const item = document.createElement("li");
    item.className = "page-item";

    if (active) {
      item.classList.add("active");
    }

    if (disabled) {
      item.classList.add("disabled");
    }

    const button = document.createElement("button");

    button.type = "button";
    button.className = "page-link";
    button.textContent = label;
    button.disabled = disabled;

    if (ariaLabel) {
      button.setAttribute("aria-label", ariaLabel);
    }

    if (active) {
      button.setAttribute("aria-current", "page");
    }

    button.addEventListener("click", function () {
      currentPage = page;
      renderCourses();
    });

    item.appendChild(button);
    paginationList.appendChild(item);
  }

  // ==========================================================
  // 10. HIỂN THỊ PHÂN TRANG
  // ==========================================================

  function displayPagination(totalPages) {

    paginationList.replaceChildren();
    pagination.hidden = totalPages <= 1;

    if (totalPages <= 1) {
      return;
    }

    // Trang trước
    createPageButton(
      "<",
      currentPage - 1,
      currentPage === 1,
      false,
      "Trang trước"
    );

    // Nút số trang
    for (let page = 1; page <= totalPages; page++) {
      createPageButton(
        String(page),
        page,
        false,
        page === currentPage,
        "Trang " + page
      );
    }

    // Trang sau
    createPageButton(
      ">",
      currentPage + 1,
      currentPage === totalPages,
      false,
      "Trang sau"
    );
  }

  // ==========================================================
  // 11. HIỂN THỊ DANH SÁCH MÔN HỌC
  // ==========================================================

  function renderCourses() {

    if (!isReady) {
      return;
    }

    const visibleCourses = getVisibleCourses();

    const totalPages = Math.ceil(
      visibleCourses.length / COURSES_PER_PAGE
    );

    currentPage = Math.max(
      1,
      Math.min(currentPage, totalPages || 1)
    );

    const from =
      (currentPage - 1) * COURSES_PER_PAGE;

    const onPage = visibleCourses.slice(
      from,
      from + COURSES_PER_PAGE
    );

    courseList.replaceChildren(
      ...onPage.map(createCourseCard)
    );

    if (visibleCourses.length === 0) {

      const emptyMessage =
        document.createElement("p");

      emptyMessage.className = "course-empty";

      emptyMessage.textContent =
        "Không tìm thấy môn học phù hợp. Hãy đổi từ khóa hoặc bộ lọc.";

      courseList.appendChild(emptyMessage);

      resultCount.textContent =
        "Tìm thấy 0 môn học.";

    } else {

      const first = from + 1;

      const last = Math.min(
        from + COURSES_PER_PAGE,
        visibleCourses.length
      );

      resultCount.textContent =
        "Tìm thấy " +
        visibleCourses.length +
        " môn học. Đang hiển thị " +
        first +
        "–" +
        last +
        ".";
    }

    displayPagination(totalPages);

    // Cập nhật nút nhóm môn đang chọn
    filterButtons.forEach(function (button) {

      const isActive =
        button.dataset.filter === currentCategory;

      button.setAttribute(
        "aria-pressed",
        String(isActive)
      );
    });
  }

  // ==========================================================
  // 12. SỰ KIỆN LỌC NHÓM MÔN
  // ==========================================================

  filterButtons.forEach(function (button) {

    button.addEventListener("click", function () {

      currentCategory = button.dataset.filter;
      currentPage = 1;

      renderCourses();
    });
  });

  // ==========================================================
  // 13. SỰ KIỆN TÌM KIẾM
  // ==========================================================

  searchInput.addEventListener("input", function () {

    currentKeyword =
      normalizeText(searchInput.value);

    currentPage = 1;
    renderCourses();
  });

  searchForm.addEventListener("submit", function (event) {

    event.preventDefault();

    currentKeyword =
      normalizeText(searchInput.value);

    currentPage = 1;
    renderCourses();
  });

  // Escape để xóa từ khóa
  searchInput.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

      searchInput.value = "";
      currentKeyword = "";
      currentPage = 1;

      renderCourses();
    }
  });

  // ==========================================================
  // 14. LỌC SỐ TÍN CHỈ
  // ==========================================================

  creditsSelect.addEventListener("change", function () {

    currentCredits = creditsSelect.value;
    currentPage = 1;

    renderCourses();
  });

 
// ==========================================================
// 15. NÚT CHUYỂN ĐỔI SẮP XẾP A-Z / Z-A
// ==========================================================

sortButton.addEventListener("click", function () {

    // Chuyển đổi giữa A-Z và Z-A
    if (currentSort === "name-asc") {
        currentSort = "name-desc";
    } else {
        currentSort = "name-asc";
    }

    // Cập nhật chữ và biểu tượng trên nút
    const sortText =
        sortButton.querySelector(".course-sort-text");

    const sortIcon =
        sortButton.querySelector(".course-sort-icon");

    if (currentSort === "name-asc") {

        sortText.textContent = "A–Z";
        sortIcon.textContent = "↓";

        sortButton.title = "Chuyển sang Z–A";
        sortButton.setAttribute(
            "aria-label",
            "Đang sắp xếp A đến Z. Nhấn để chuyển sang Z đến A"
        );

    } else {

        sortText.textContent = "Z–A";
        sortIcon.textContent = "↑";

        sortButton.title = "Chuyển sang A–Z";
        sortButton.setAttribute(
            "aria-label",
            "Đang sắp xếp Z đến A. Nhấn để chuyển sang A đến Z"
        );
    }

    // Quay về trang đầu và hiển thị lại danh sách
    currentPage = 1;
    renderCourses();

});


  // TẢI DỮ LIỆU BAN ĐẦU
  loadCourses();
}

// Khởi tạo khi mở trang trực tiếp
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeCoursesPage,
    { once: true }
  );
} else {
  initializeCoursesPage();
}

// Khởi tạo khi chuyển trang bằng SPA EduTrack
document.addEventListener(
  "edutrack:page-loaded",
  initializeCoursesPage
);
