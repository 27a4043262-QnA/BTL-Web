
"use strict";

// Kiểm tra một giá trị bắt buộc
function isRequired(value) {
    return String(value ?? "").trim().length > 0;
}

// Kiểm tra giá trị có phải số hợp lệ
function isValidNumber(value, min, max) {
    if (!isRequired(value)) return false;

    const number = Number(value);

    return Number.isFinite(number)
        && number >= min
        && number <= max;
}

// Kiểm tra số tín chỉ: số nguyên dương
function isValidCredits(value) {
    return isValidNumber(value, 1, 10)
        && Number.isInteger(Number(value));
}

// Kiểm tra điểm hệ 10
function isValidScore(value) {
    return isValidNumber(value, 0, 10);
}

// Kiểm tra GPA hệ 4
function isValidGPA(value) {
    return isValidNumber(value, 0, 4);
}

// Kiểm tra email
function isValidEmail(value) {
    if (!isRequired(value)) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(value).trim()
    );
}

// Kiểm tra số điện thoại Việt Nam
function isValidPhone(value) {
    const phone = String(value ?? "")
        .replace(/[\s.-]/g, "");

    return /^(0|\+84)[35789]\d{8}$/.test(phone);
}

// Hiển thị thông báo lỗi bên cạnh trường nhập
function showFieldError(input, message) {
    clearFieldError(input);

    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");

    const error = document.createElement("small");
    error.className = "gpa-field-error";
    error.textContent = message;

    input.insertAdjacentElement("afterend", error);
}

// Xóa thông báo lỗi của một trường
function clearFieldError(input) {
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");

    const error = input.nextElementSibling;

    if (error && error.classList.contains("gpa-field-error")) {
        error.remove();
    }
}
function isValidLength(value, min, max) {
    const text = String(value ?? "").trim();

    return text.length >= min && text.length <= max;
}
// Gom các hàm thành một đối tượng có thể sử dụng lại
window.EDUValidation = {
    isRequired,
    isValidNumber,
    isValidCredits,
    isValidScore,
    isValidGPA,
    isValidEmail,
    isValidPhone,
    isValidLength,
    showFieldError,
    clearFieldError
};
