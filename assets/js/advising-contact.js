
"use strict";

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. QUẢN LÝ 3 TRẠNG THÁI TRANG TƯ VẤN
       ===================================================== */

    const validStates = ["1", "2", "3"];

    const urlParams = new URLSearchParams(
        window.location.search
    );

    const requestedState = urlParams.get("state");

    // Mặc định hiển thị trạng thái 3.
    // Có thể kiểm tra bằng ?state=1, ?state=2, ?state=3.
    const currentState = validStates.includes(requestedState)
        ? requestedState
        : "3";

    document.querySelectorAll(".advising-state").forEach(state => {
        state.hidden = state.dataset.state !== currentState;
    });



    /* =====================================================
       3. CAROUSEL MÔN HỌC

       Desktop: hiển thị 3 card
       Tablet:  hiển thị 2 card
       Mobile:  hiển thị 1 card

       Hai nút mũi tên chuyển vòng lặp.
       ===================================================== */

    function initCarousel(carousel) {

        const viewport = carousel.querySelector(
            ".subject-results-viewport"
        );

        const track = carousel.querySelector(
            ".subject-results-track"
        );

        const prevButton = carousel.querySelector(
            "[data-carousel-prev]"
        );

        const nextButton = carousel.querySelector(
            "[data-carousel-next]"
        );

        const status = carousel.parentElement.querySelector(
            "[data-carousel-status]"
        );

        // Carousel cần đủ các thành phần để hoạt động.
        if (
            !viewport ||
            !track ||
            !prevButton ||
            !nextButton
        ) {
            return;
        }

        const cards = Array.from(track.children);

        if (cards.length === 0) {
            prevButton.disabled = true;
            nextButton.disabled = true;
            return;
        }

        let currentIndex = 0;
        let maxIndex = 0;
        let slideWidth = 0;
        let visibleCount = 1;


        /* ---------------------------------------------
           3.1. CẬP NHẬT VỊ TRÍ CAROUSEL
           --------------------------------------------- */

        function updateCarousel() {

            const offset = currentIndex * slideWidth;

            track.style.transform =
                `translate3d(${-offset}px, 0, 0)`;

            // Chỉ khóa nút khi tất cả môn đều đang hiển thị.
            const canSlide = maxIndex > 0;

            prevButton.disabled = !canSlide;
            nextButton.disabled = !canSlide;

            if (status) {

                const firstVisible = currentIndex + 1;

                const lastVisible = Math.min(
                    cards.length,
                    currentIndex + visibleCount
                );

                status.textContent =
                    `Đang hiển thị môn ${firstVisible} ` +
                    `đến môn ${lastVisible} ` +
                    `trong tổng số ${cards.length} môn.`;
            }
        }


        /* ---------------------------------------------
           3.2. TÍNH SỐ CARD THEO MÀN HÌNH
           --------------------------------------------- */

        function calculateCarousel() {

            const firstCard = cards[0];

            const cardWidth =
                firstCard.getBoundingClientRect().width;

            const viewportWidth = viewport.clientWidth;

            // Bỏ qua nếu carousel đang bị ẩn.
            if (cardWidth <= 0 || viewportWidth <= 0) {
                return;
            }

            const computedStyle =
                window.getComputedStyle(track);

            const gap =
                parseFloat(computedStyle.columnGap) || 0;

            slideWidth = cardWidth + gap;

            // Tính số card đang nhìn thấy.
            visibleCount = Math.max(
                1,
                Math.min(
                    cards.length,
                    Math.round(
                        (viewportWidth + gap) / slideWidth
                    )
                )
            );

            // Vị trí cuối cùng được phép trượt tới.
            maxIndex = Math.max(
                0,
                cards.length - visibleCount
            );

            // Giữ vị trí hợp lệ khi thay đổi màn hình.
            currentIndex = Math.min(
                currentIndex,
                maxIndex
            );

            updateCarousel();
        }


        /* ---------------------------------------------
           3.3. CHUYỂN CARD THEO VÒNG LẶP
           --------------------------------------------- */

        function moveCarousel(direction) {

            if (maxIndex === 0) {
                return;
            }

            const totalPositions = maxIndex + 1;

            currentIndex =
                (
                    currentIndex +
                    direction +
                    totalPositions
                ) % totalPositions;

            updateCarousel();
        }


        /* ---------------------------------------------
           3.4. NÚT MŨI TÊN TRÁI
           --------------------------------------------- */

        prevButton.addEventListener("click", () => {

            // Chuyển về vị trí trước.
            // Nếu đang ở đầu sẽ quay về cuối.
            moveCarousel(-1);

        });


        /* ---------------------------------------------
           3.5. NÚT MŨI TÊN PHẢI

           ĐÃ SỬA: CHỈ ĐĂNG KÝ MỘT SỰ KIỆN CLICK.
           --------------------------------------------- */

        nextButton.addEventListener("click", () => {

            // Chuyển sang vị trí tiếp theo.
            // Nếu đang ở cuối sẽ quay về đầu.
            moveCarousel(1);

        });


        /* ---------------------------------------------
           3.6. HỖ TRỢ VUỐT TRÊN ĐIỆN THOẠI
           --------------------------------------------- */

        let touchStartX = null;

        viewport.addEventListener(
            "touchstart",
            event => {

                touchStartX =
                    event.changedTouches[0].screenX;

            },
            { passive: true }
        );

        viewport.addEventListener(
            "touchend",
            event => {

                if (touchStartX === null) {
                    return;
                }

                const touchEndX =
                    event.changedTouches[0].screenX;

                const distance =
                    touchStartX - touchEndX;

                // Chỉ chuyển khi vuốt đủ xa.
                if (Math.abs(distance) > 45) {

                    if (distance > 0) {
                        // Vuốt sang trái: môn tiếp theo.
                        moveCarousel(1);
                    } else {
                        // Vuốt sang phải: môn trước.
                        moveCarousel(-1);
                    }
                }

                touchStartX = null;

            },
            { passive: true }
        );


        /* ---------------------------------------------
           3.7. RESPONSIVE CAROUSEL
           --------------------------------------------- */

        if ("ResizeObserver" in window) {

            const resizeObserver = new ResizeObserver(() => {
                calculateCarousel();
            });

            resizeObserver.observe(viewport);

        } else {

            window.addEventListener(
                "resize",
                calculateCarousel
            );

        }

        // Khởi tạo lần đầu.
        calculateCarousel();
    }


    // Khởi tạo carousel cho các trạng thái.
    document
        .querySelectorAll("[data-carousel]")
        .forEach(initCarousel);


    /* =====================================================
       4. TABS CHI TIẾT TỪNG MÔN
       ===================================================== */

    const tabList = document.querySelector(
        ".subject-tabs-menu"
    );

    if (tabList) {

        const tabs = Array.from(
            tabList.querySelectorAll('[role="tab"]')
        );

        function activateTab(
            selectedTab,
            focusTab = false
        ) {

            tabs.forEach(tab => {

                const isActive = tab === selectedTab;

                tab.classList.toggle(
                    "active",
                    isActive
                );

                tab.setAttribute(
                    "aria-selected",
                    String(isActive)
                );

                tab.tabIndex = isActive ? 0 : -1;

                const panelId =
                    tab.getAttribute("aria-controls");

                const panel =
                    document.getElementById(panelId);

                if (panel) {
                    panel.hidden = !isActive;
                }
            });

            if (focusTab) {
                selectedTab.focus();
            }
        }

        tabs.forEach((tab, index) => {

            tab.addEventListener("click", () => {
                activateTab(tab);
            });

            tab.addEventListener("keydown", event => {

                let nextIndex = index;

                if (event.key === "ArrowRight") {

                    nextIndex =
                        (index + 1) % tabs.length;

                } else if (event.key === "ArrowLeft") {

                    nextIndex =
                        (index - 1 + tabs.length) %
                        tabs.length;

                } else if (event.key === "Home") {

                    nextIndex = 0;

                } else if (event.key === "End") {

                    nextIndex = tabs.length - 1;

                } else {
                    return;
                }

                event.preventDefault();

                activateTab(
                    tabs[nextIndex],
                    true
                );
            });
        });
    }


    /* =====================================================
       5. MODAL BOOTSTRAP 4
       Điều khiển bằng JavaScript thuần.
       ===================================================== */

    let activeModal = null;
    let activeBackdrop = null;
    let previouslyFocusedElement = null;

    const focusableSelector = [
        "button:not(:disabled)",
        "a[href]",
        "input:not(:disabled)",
        "select:not(:disabled)",
        "textarea:not(:disabled)",
        '[tabindex]:not([tabindex="-1"])'
    ].join(", ");


    /* ---------------------------------------------
       5.1. MỞ MODAL
       --------------------------------------------- */

    function openModal(modalId) {

        const modal =
            document.getElementById(modalId);

        if (!modal) {
            return;
        }

        if (activeModal) {
            closeModal(false);
        }

        previouslyFocusedElement =
            document.activeElement;

        activeModal = modal;

        modal.style.display = "block";

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        activeBackdrop =
            document.createElement("div");

        activeBackdrop.className =
            "modal-backdrop fade show";

        document.body.appendChild(
            activeBackdrop
        );

        document.body.classList.add(
            "modal-open"
        );

        window.requestAnimationFrame(() => {

            modal.classList.add("show");

            const closeButton = modal.querySelector(
                "[data-close-modal]"
            );

            if (closeButton) {
                closeButton.focus();
            } else {
                modal.focus();
            }
        });
    }


    /* ---------------------------------------------
       5.2. ĐÓNG MODAL
       --------------------------------------------- */

    function closeModal(restoreFocus = true) {

        if (!activeModal) {
            return;
        }

        activeModal.classList.remove(
            "show"
        );

        activeModal.style.display = "none";

        activeModal.setAttribute(
            "aria-hidden",
            "true"
        );

        if (activeBackdrop) {

            activeBackdrop.remove();

            activeBackdrop = null;
        }

        document.body.classList.remove(
            "modal-open"
        );

        activeModal = null;

        if (
            restoreFocus &&
            previouslyFocusedElement &&
            previouslyFocusedElement.isConnected
        ) {
            previouslyFocusedElement.focus();
        }
    }


    /* ---------------------------------------------
       5.3. NÚT MỞ MODAL GỢI Ý
       --------------------------------------------- */

    document.querySelectorAll(
        "[data-open-modal]"
    ).forEach(button => {

        button.addEventListener("click", () => {

            openModal(
                button.dataset.openModal
            );

        });
    });


    /* ---------------------------------------------
       5.4. MODAL THÔNG BÁO
       --------------------------------------------- */

    document.querySelectorAll(
        "[data-notice]"
    ).forEach(button => {

        button.addEventListener("click", () => {

            const noticeMessage =
                document.getElementById(
                    "notice-message"
                );

            if (noticeMessage) {

                noticeMessage.textContent =
                    button.dataset.notice;

            }

            openModal("notice-modal");
        });
    });


    /* ---------------------------------------------
       5.5. NÚT ĐÓNG MODAL
       --------------------------------------------- */

    document.querySelectorAll(
        "[data-close-modal]"
    ).forEach(button => {

        button.addEventListener("click", () => {
            closeModal();
        });

    });


    /* ---------------------------------------------
       5.6. BẤM NỀN ĐỂ ĐÓNG MODAL
       --------------------------------------------- */

    document.querySelectorAll(
        ".modal"
    ).forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                closeModal();
            }

        });
    });


    /* ---------------------------------------------
       5.7. ESCAPE VÀ QUẢN LÝ FOCUS
       --------------------------------------------- */

    document.addEventListener("keydown", event => {

        if (!activeModal) {
            return;
        }

        if (event.key === "Escape") {

            event.preventDefault();

            closeModal();

            return;
        }

        if (event.key !== "Tab") {
            return;
        }

        const focusableElements = Array.from(
            activeModal.querySelectorAll(
                focusableSelector
            )
        ).filter(element => {
            return element.getClientRects().length > 0;
        });

        if (focusableElements.length === 0) {

            event.preventDefault();

            activeModal.focus();

            return;
        }

        const first = focusableElements[0];

        const last =
            focusableElements[
                focusableElements.length - 1
            ];

        if (
            event.shiftKey &&
            document.activeElement === first
        ) {

            event.preventDefault();
            last.focus();

        } else if (
            !event.shiftKey &&
            document.activeElement === last
        ) {

            event.preventDefault();
            first.focus();

        } else if (
            !activeModal.contains(
                document.activeElement
            )
        ) {

            event.preventDefault();
            first.focus();
        }
    });


   

    /* =====================================================
       7. CHECKLIST LỘ TRÌNH - LOCAL STORAGE
       ===================================================== */

    const storageKey =
        "edutrack-advising-checklist";


    /* ---------------------------------------------
       7.1. ĐỌC DỮ LIỆU ĐÃ LƯU
       --------------------------------------------- */

    function loadSavedTasks() {

        try {

            const saved =
                localStorage.getItem(storageKey);

            if (!saved) {
                return {};
            }

            const parsed = JSON.parse(saved);

            return (
                parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
            )
                ? parsed
                : {};

        } catch (error) {

            return {};
        }
    }


    /* ---------------------------------------------
       7.2. LƯU CHECKLIST
       --------------------------------------------- */

    function saveTasks(tasks) {

        try {

            localStorage.setItem(
                storageKey,
                JSON.stringify(tasks)
            );

        } catch (error) {

            // Trang vẫn hoạt động nếu trình duyệt
            // không cho phép sử dụng localStorage.
        }
    }


    /* ---------------------------------------------
       7.3. KHỞI TẠO CÁC CHECKBOX
       --------------------------------------------- */

    const savedTasks = loadSavedTasks();

    document.querySelectorAll(
        "[data-task]"
    ).forEach(checkbox => {

        if (savedTasks[checkbox.id] === true) {
            checkbox.checked = true;
        }

        checkbox.addEventListener("change", () => {

            savedTasks[checkbox.id] =
                checkbox.checked;

            saveTasks(savedTasks);
        });
    });

});
