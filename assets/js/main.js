
document.addEventListener("DOMContentLoaded", function () {
    const toggle = document.querySelector(".et-nav-toggle");
    const menu = document.querySelector("#et-primary-nav");

    if (!toggle || !menu) return;

    // Mở và đóng menu
    toggle.addEventListener("click", function () {
        const isOpen = menu.classList.toggle("is-open");

        toggle.setAttribute("aria-expanded", isOpen);

        toggle.setAttribute(
            "aria-label",
            isOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"
        );
    });

    // Đóng menu khi chọn một mục
    menu.querySelectorAll("li:not(.button) a").forEach(function (link) {
        link.addEventListener("click", function () {
            menu.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Mở menu điều hướng");
        });
    });

    // Đóng menu bằng phím Escape
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            menu.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Mở menu điều hướng");
            toggle.focus();
        }
    });
});
