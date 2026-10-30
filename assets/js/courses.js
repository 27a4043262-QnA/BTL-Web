
"use strict";

// =============================================
// EDUTRACK - JAVASCRIPT DANH MỤC MÔN HỌC
// =============================================

document.addEventListener("DOMContentLoaded", function () {

  // 1. LẤY CÁC PHẦN TỬ HTML
  const courseList = document.querySelector("#course-list");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const searchInput = document.querySelector("#course-search");
  const searchForm = document.querySelector(".search-form");
  const pagination = document.querySelector(".et-course-pagination");
  const paginationList = pagination?.querySelector(".pagination");
  const resultCount = document.querySelector(".course-result-count");

  // Kiểm tra các phần tử cần thiết
  if (!courseList || !searchInput || !searchForm ||
      !pagination || !paginationList || !resultCount) {
    console.error("Thiếu phần tử HTML cần thiết cho courses.js");
    return;
  }

  // 2. CHUYỂN 13 CARD THÀNH MẢNG OBJECT
  const courses = Array.from(
    courseList.querySelectorAll(".course-card")
  ).map(function (card) {
    return {
      name: card.querySelector(".course-title").textContent.trim(),
      category: card.dataset.category,
      element: card.closest(".col-12")
    };
  });

  // 3. BIẾN TRẠNG THÁI
  const coursesPerPage = 9;

  let currentFilter = "all";
  let currentKeyword = "";
  let currentPage = 1;

  // 4. CHUẨN HÓA TỪ KHÓA TIẾNG VIỆT
  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .trim();
  }

  // 5. LỌC DANH SÁCH MÔN HỌC
  function getFilteredCourses() {
    return courses.filter(function (course) {

      const matchCategory =
        currentFilter === "all" ||
        course.category === currentFilter;

      const matchKeyword =
        normalizeText(course.name).includes(currentKeyword);

      return matchCategory && matchKeyword;
    });
  }

  // 6. CẬP NHẬT TRẠNG THÁI NÚT LỌC
  function updateFilterButtons() {
    filterButtons.forEach(function (button) {
      const isActive = button.dataset.filter === currentFilter;

      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  // 7. HIỂN THỊ DANH SÁCH MÔN HỌC
  function displayCourses(filteredCourses) {

    // Ẩn tất cả Card trước
    courses.forEach(function (course) {
      course.element.hidden = true;
    });

    // Tính danh sách của trang hiện tại
    const startIndex = (currentPage - 1) * coursesPerPage;
    const endIndex = startIndex + coursesPerPage;

    const pageCourses = filteredCourses.slice(startIndex, endIndex);

    // Hiển thị những Card thuộc trang hiện tại
    pageCourses.forEach(function (course) {
      course.element.hidden = false;
    });

    // Xóa thông báo rỗng cũ, nếu có
    const oldEmptyMessage = courseList.querySelector(".course-empty");
    if (oldEmptyMessage) {
      oldEmptyMessage.remove();
    }

    // Thêm thông báo nếu không có kết quả
    if (filteredCourses.length === 0) {
      const emptyMessage = document.createElement("p");

      emptyMessage.className = "course-empty";
      emptyMessage.textContent =
        "Không tìm thấy môn học phù hợp. Hãy thử từ khóa khác.";

      courseList.appendChild(emptyMessage);
    }
  }

  // 8. TẠO MỘT NÚT PHÂN TRANG
  function createPageButton(label, pageNumber, disabled, active, ariaLabel) {

    const li = document.createElement("li");
    li.className = "page-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-link";
    button.textContent = label;

    if (ariaLabel) {
      button.setAttribute("aria-label", ariaLabel);
    }

    if (active) {
      li.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    if (disabled) {
      li.classList.add("disabled");
      button.disabled = true;
    }

    // Bấm nút sẽ chuyển trang
    button.addEventListener("click", function () {
      currentPage = pageNumber;
      renderCourses();
    });

    li.appendChild(button);
    paginationList.appendChild(li);
  }

  // 9. CẬP NHẬT PHÂN TRANG
  function displayPagination(totalPages) {

    // Xóa các nút phân trang cũ
    paginationList.replaceChildren();

    // Không cần phân trang nếu chỉ có 1 trang
    if (totalPages <= 1) {
      pagination.hidden = true;
      return;
    }

    pagination.hidden = false;

    // Nút trang trước
    createPageButton(
      "<", currentPage - 1,
      currentPage === 1, false, "Trang trước"
    );

    // Các nút số trang
    for (let page = 1; page <= totalPages; page++) {
      createPageButton(
        String(page), page,
        false, page === currentPage,
        "Trang " + page
      );
    }

    // Nút trang sau
    createPageButton(
      ">", currentPage + 1,
      currentPage === totalPages, false, "Trang sau"
    );
  }

  // 10. HÀM HIỂN THỊ TỔNG HỢP
  function renderCourses() {

    const filteredCourses = getFilteredCourses();

    const totalPages = Math.ceil(
      filteredCourses.length / coursesPerPage
    );

    // Đảm bảo trang hiện tại không vượt số trang
    currentPage = Math.max(
      1, Math.min(currentPage, totalPages || 1)
    );

    displayCourses(filteredCourses);
    displayPagination(totalPages);
    updateFilterButtons();

    // Thông báo số lượng môn tìm được
    if (filteredCourses.length === 0) {
      resultCount.textContent = "Tìm thấy 0 môn học.";
    } else {
      const displayed = Math.min(
        currentPage * coursesPerPage,
        filteredCourses.length
      );

      resultCount.textContent =
        "Tìm thấy " + filteredCourses.length +
        " môn học. Đang hiển thị " +
        ((currentPage - 1) * coursesPerPage + 1) +
        "–" + displayed + ".";
    }
  }

  // 11. SỰ KIỆN CLICK - LỌC MÔN HỌC
  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      currentFilter = button.dataset.filter;
      currentPage = 1;
      renderCourses();
    });
  });

  // 12. SỰ KIỆN INPUT - TÌM KIẾM MÔN HỌC
  searchInput.addEventListener("input", function () {
    currentKeyword = normalizeText(searchInput.value);
    currentPage = 1;
    renderCourses();
  });

  // 13. SỰ KIỆN SUBMIT - KHÔNG TẢI LẠI TRANG
  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();

    currentKeyword = normalizeText(searchInput.value);
    currentPage = 1;
    renderCourses();
  });

  // 14. SỰ KIỆN KEYDOWN - NHẤN ESC ĐỂ XÓA TÌM KIẾM
  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      searchInput.value = "";
      currentKeyword = "";
      currentPage = 1;
      renderCourses();
    }
  });

  // 15. HIỂN THỊ TRANG KHI MỚI MỞ
  renderCourses();

});
