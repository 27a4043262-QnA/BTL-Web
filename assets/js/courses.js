
"use strict";

// ==========================================================
// EDUTRACK - BÀI 7: JSON, FETCH, TÌM KIẾM, LỌC, SẮP XẾP
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {

  // 1. LẤY CÁC PHẦN TỬ HTML
  const courseList = document.querySelector("#course-list");
  const filterButtons = document.querySelectorAll(".filter-btn");

  const searchInput = document.querySelector("#course-search");
  const searchForm = document.querySelector(".search-form");

  const creditsSelect =
    document.querySelector("#course-credits-filter");

  const sortSelect = document.querySelector("#course-sort");

  const resultCount =
    document.querySelector(".course-result-count");

  const loadStatus =
    document.querySelector("#course-load-status");

  const pagination =
    document.querySelector(".et-course-pagination");

  const paginationList =
    pagination?.querySelector(".pagination");

  // Kiểm tra các phần tử HTML cần thiết
  if (
    !courseList ||
    !filterButtons.length ||
    !searchInput ||
    !searchForm ||
    !creditsSelect ||
    !sortSelect ||
    !resultCount ||
    !loadStatus ||
    !pagination ||
    !paginationList
  ) {
    console.error(
      "EduTrack: Thiếu thành phần HTML của trang Danh mục môn học."
    );
    return;
  }

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

  // Đồng bộ sắp xếp mặc định với HTML
  sortSelect.value = currentSort;

  // ==========================================================
  // 3. CHUẨN HÓA CHỮ TIẾNG VIỆT
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

  // Vô hiệu hóa điều khiển khi đang tải JSON
  function setControlsDisabled(disabled) {

    searchInput.disabled = disabled;
    creditsSelect.disabled = disabled;
    sortSelect.disabled = disabled;

    filterButtons.forEach(function (button) {
      button.disabled = disabled;
    });
  }

  // ==========================================================
  // 4. THÔNG BÁO TRẠNG THÁI TẢI DỮ LIỆU
  // ==========================================================

  function setStatus(message, type = "info", retry = false) {

    loadStatus.replaceChildren();
    loadStatus.className = "course-load-status";

    if (!message) {
      loadStatus.hidden = true;
      return;
    }

    loadStatus.hidden = false;
    loadStatus.classList.add("course-status-" + type);

    const text = document.createElement("span");
    text.textContent = message;
    loadStatus.appendChild(text);

    // Tạo nút thử lại khi tải dữ liệu thất bại
    if (retry) {

      const retryButton = document.createElement("button");

      retryButton.type = "button";
      retryButton.className = "course-retry-btn";
      retryButton.textContent = "Thử tải lại";

      retryButton.addEventListener("click", loadCourses);

      loadStatus.appendChild(retryButton);
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

    const ids = new Set();

    for (const [index, course] of data.entries()) {

      const valid =
        course &&
        typeof course === "object" &&
        Number.isSafeInteger(course.id) &&
        course.id > 0 &&
        typeof course.name === "string" &&
        course.name.trim() !== "" &&
        Object.hasOwn(CATEGORY_NAMES, course.category) &&
        Number.isInteger(course.credits) &&
        course.credits > 0 &&
        typeof course.description === "string" &&
        typeof course.image === "string" &&
        Array.isArray(course.keywords) &&
        course.keywords.every(function (word) {
          return typeof word === "string";
        });

      if (!valid) {
        throw new Error(
          "Bản ghi môn học thứ " +
          (index + 1) +
          " không hợp lệ."
        );
      }

      if (ids.has(course.id)) {
        throw new Error(
          "ID môn học bị trùng: " + course.id
        );
      }

      ids.add(course.id);
    }

    return data;
  }

  // ==========================================================
  // 6. TẢI DỮ LIỆU JSON BẰNG FETCH (AJAX)
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

      const data = validateCourses(
        await response.json()
      );

      courses = data;
      isReady = true;

      setControlsDisabled(false);

      // Trường hợp JSON không có bản ghi
      if (courses.length === 0) {

        setStatus(
          "Chưa có môn học nào trong dữ liệu JSON.",
          "empty"
        );

        resultCount.textContent =
          "Tìm thấy 0 môn học.";

        return;
      }

      // Tải thành công: Ẩn thông báo màu xanh
      setStatus("");

      // Hiển thị danh sách môn học
      renderCourses();

    } catch (error) {

      courses = [];
      isReady = false;

      console.error(
        "EduTrack: Lỗi tải danh sách môn học:",
        error
      );

      setStatus(
        "Không thể tải dữ liệu môn học. Hãy kiểm tra file JSON và chạy bằng Live Server.",
        "error",
        true
      );
    }
  }

  // ==========================================================
  // 7. LỌC + TÌM KIẾM THEO TÊN + SẮP XẾP
  // ==========================================================

  function getVisibleCourses() {

    const selected = courses.filter(function (course) {

      // Bộ lọc thứ nhất: nhóm môn học
      const matchesCategory =
        currentCategory === "all" ||
        course.category === currentCategory;

      // Bộ lọc thứ hai: số tín chỉ
      const matchesCredits =
        currentCredits === "all" ||
        course.credits === Number(currentCredits);

      // Tìm kiếm CHỈ THEO TÊN MÔN như ban đầu
      const matchesName =
        normalizeText(course.name).includes(currentKeyword);

      // Kết hợp các điều kiện lọc
      return matchesCategory &&
             matchesCredits &&
             matchesName;
    });

    // Sắp xếp theo tên A - Z
    if (currentSort === "name-asc") {

      selected.sort(function (a, b) {
        return a.name.localeCompare(b.name, "vi");
      });

    }

    // Sắp xếp theo tên Z - A
    else if (currentSort === "name-desc") {

      selected.sort(function (a, b) {
        return b.name.localeCompare(a.name, "vi");
      });

    }

    return selected;
  }

  // ==========================================================
  // 8. TẠO CARD TỪ DỮ LIỆU JSON
  // ==========================================================

  function createCourseCard(course) {

    // Cột Bootstrap
    const column = document.createElement("div");

    column.className =
      "col-12 col-md-6 col-xl-4 mb-4";

    // Khung Card
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

    // Nhóm môn và tín chỉ
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

    // Tên môn học
    const title = document.createElement("h2");

    title.className = "course-title";
    title.textContent = course.name;

    // Mô tả môn học
    const description = document.createElement("p");

    description.className = "course-description";
    description.textContent = course.description;

    // Liên kết xem chi tiết theo ID
    const detailLink = document.createElement("a");

    detailLink.className = "course-link";
    detailLink.textContent = "Xem chi tiết →";

    detailLink.href =
      "course-detail.html?id=" +
      encodeURIComponent(String(course.id));

    detailLink.setAttribute(
      "aria-label",
      "Xem chi tiết môn " + course.name
    );

    // Ghép Card
    body.append(
      meta,
      title,
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

    // Nút trang trước
    createPageButton(
      "<",
      currentPage - 1,
      currentPage === 1,
      false,
      "Trang trước"
    );

    // Các nút số trang
    for (let page = 1; page <= totalPages; page++) {

      createPageButton(
        String(page),
        page,
        false,
        page === currentPage,
        "Trang " + page
      );

    }

    // Nút trang sau
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

    // Giữ số trang hợp lệ
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

    // Render các Card từ JSON
    courseList.replaceChildren(
      ...onPage.map(createCourseCard)
    );

    // Không tìm thấy kết quả
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

    // Cập nhật trạng thái nút lọc
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
  // 12. SỰ KIỆN LỌC THEO NHÓM MÔN
  // ==========================================================

  filterButtons.forEach(function (button) {

    button.addEventListener("click", function () {

      currentCategory = button.dataset.filter;
      currentPage = 1;

      renderCourses();

    });
  });

  // ==========================================================
  // 13. SỰ KIỆN TÌM KIẾM THEO TÊN MÔN
  // ==========================================================

  searchInput.addEventListener("input", function () {

    currentKeyword =
      normalizeText(searchInput.value);

    currentPage = 1;

    renderCourses();
  });

  // Ngăn Enter tải lại trang
  searchForm.addEventListener("submit", function (event) {

    event.preventDefault();

    currentKeyword =
      normalizeText(searchInput.value);

    currentPage = 1;

    renderCourses();
  });

  // Nhấn Escape để xóa từ khóa tìm kiếm
  searchInput.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

      searchInput.value = "";
      currentKeyword = "";
      currentPage = 1;

      renderCourses();
    }
  });

  // ==========================================================
  // 14. SỰ KIỆN LỌC THEO SỐ TÍN CHỈ
  // ==========================================================

  creditsSelect.addEventListener("change", function () {

    currentCredits = creditsSelect.value;
    currentPage = 1;

    renderCourses();
  });

  // ==========================================================
  // 15. SỰ KIỆN SẮP XẾP A-Z / Z-A
  // ==========================================================

  sortSelect.addEventListener("change", function () {

    currentSort = sortSelect.value;
    currentPage = 1;

    renderCourses();
  });

  // ==========================================================
  // 16. TẢI DỮ LIỆU LẦN ĐẦU
  // ==========================================================

  loadCourses();

});
