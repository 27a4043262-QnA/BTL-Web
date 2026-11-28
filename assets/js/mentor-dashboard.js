(() => {
  "use strict";

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin", cache: "no-store", ...options,
      headers: { ...(options.headers || {}), ...(options.body ? { "Content-Type": "application/json" } : {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Máy chủ trả về HTTP ${response.status}.`);
    return body;
  }
  const el = (tag, className = "", value = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== "") node.textContent = String(value);
    return node;
  };
  const formatGpa = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : "—";
  };

  function init() {
    const root = document.querySelector("[data-mentor-dashboard]");
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = "1";
    const list = root.querySelector("[data-student-list]");
    const detail = root.querySelector("[data-student-detail]");
    const feedback = root.querySelector("[data-feedback]");
    const analysis = root.querySelector("[data-analysis]");
    const v1 = root.querySelector("[data-v1]");
    const form = root.querySelector("[data-proposal-form]");
    const suggest = root.querySelector("[data-suggest-v2]");
    let selected = null;

    function message(text, error = false) {
      feedback.textContent = text;
      feedback.classList.toggle("is-error", error);
    }

    function renderAnalysis(payload) {
      analysis.replaceChildren();
      const forecast = payload.forecast;
      if (forecast) {
        const stats = el("div", "et-mentor-stats");
        [["GPA hiện tại", `${formatGpa(forecast.currentGPA)}/4`], ["Mục tiêu", `${formatGpa(forecast.targetGPA)}/4`], ["Dự phóng", `${formatGpa(forecast.forecastGPA)}/4`]]
          .forEach(([label, value]) => { const card = el("div", "et-mentor-stat"); card.append(el("span", "", label), el("strong", "", value)); stats.append(card); });
        analysis.append(stats);
      }
      const results = Object.values(payload.analysis || {});
      if (!results.length) analysis.append(el("p", "et-mentor-muted", "Chưa có bài kiểm tra đã nộp."));
      results.forEach(result => {
        const course = el("article", "et-mentor-course");
        const score = Math.round(result.earned / result.possible * 100);
        const head = el("div", "et-mentor-course-head");
        head.append(el("h3", "", result.course.name), el("strong", "et-mentor-score", `${score}%`));
        const credits = Number(result.course.credits);
        const creditText = Number.isFinite(credits) && credits > 0 ? ` · ${credits} tín chỉ` : "";
        course.append(head, el("p", "et-mentor-muted", `${result.correctCount}/${result.course.questions.length} câu đúng${creditText}`));
        result.topics.forEach(topic => {
          const row = el("div", "et-mentor-topic");
          const label = el("div", "et-mentor-topic-label");
          label.append(el("span", "", topic.name), el("strong", "", `${topic.percentage}%`));
          const bar = el("div", "et-mentor-bar"); const fill = el("span"); fill.style.width = `${topic.percentage}%`; bar.append(fill);
          row.append(label, bar, el("small", "", `${topic.earned}/${topic.possible} điểm trọng số`));
          course.append(row);
        });
        analysis.append(course);
      });
    }

    function renderV1(roadmap) {
      v1.replaceChildren();
      (roadmap?.weeks || []).forEach(week => {
        const section = el("details", "et-mentor-week");
        const summary = el("summary", "", `${week.title} · ${week.subtitle || ""}`);
        const body = el("div", "et-mentor-week-body");
        body.append(el("p", "", week.checkpoint || "Mốc đánh giá cuối tuần."));
        (week.tasks || []).forEach(task => {
          const item = el("article", "et-mentor-task");
          item.append(el("strong", "", `${task.day ? `${task.day} · ` : ""}${task.title} · ${task.duration} phút`));
          item.append(el("p", "", task.detail || ""));
          if (task.resource) item.append(el("small", "", `Tài liệu: ${task.resource}`));
          body.append(item);
        });
        section.append(summary, body); v1.append(section);
      });
    }

    async function openStudent(student) {
      selected = student;
      try {
        const payload = await api(`/api/mentor/students/${encodeURIComponent(student.studentId)}/analysis`);
        root.querySelector("[data-student-name]").textContent = student.studentName;
        renderAnalysis(payload);
        const versions = payload.roadmaps || [];
        const source = versions.find(item => item.id === student.roadmapId) || versions.at(-1);
        renderV1(source?.roadmap);
        form.elements.roadmap.value = JSON.stringify(source?.roadmap || { title: "Lộ trình V2", goal: "", weeks: [] }, null, 2);
        form.elements.note.value = "";
        const disabled = Boolean(student.pendingProposal);
        form.querySelectorAll("textarea, button").forEach(control => { control.disabled = disabled; });
        detail.hidden = false;
        message(disabled ? "V2 đang chờ sinh viên phản hồi." : "Đã tải dữ liệu kiểm tra và lộ trình V1.");
        detail.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) { message(error.message, true); }
    }

    async function loadQueue() {
      try {
        const payload = await api("/api/mentor/queue");
        list.replaceChildren();
        if (!payload.students?.length) list.append(el("p", "et-mentor-muted", "Chưa có sinh viên được phân công hoặc chưa có lộ trình V1."));
        payload.students?.forEach(student => {
          const button = el("button", "et-mentor-student");
          button.type = "button";
          button.append(el("strong", "", student.studentName), el("span", "", `V${student.version} · ${student.pendingProposal ? "V2 chờ phản hồi" : "Đang dùng V1"}`));
          button.addEventListener("click", () => openStudent(student));
          list.append(button);
        });
        if (payload.students?.length) message("Danh sách đã đồng bộ từ máy chủ.");
      } catch (error) { list.replaceChildren(); message(error.message, true); }
    }

    suggest.addEventListener("click", async () => {
      if (!selected) return message("Chọn sinh viên trước.", true);
      const note = form.elements.note.value.trim();
      if (note.length < 5) return message("Ghi ít nhất một nhận xét trước khi nhờ Gemini gợi ý V2.", true);
      suggest.disabled = true; suggest.textContent = "Đang tạo đề xuất…";
      try {
        const payload = await api(`/api/mentor/roadmaps/${encodeURIComponent(selected.roadmapId)}/suggest-v2`, {
          method: "POST", body: JSON.stringify({ note })
        });
        form.elements.roadmap.value = JSON.stringify(payload.roadmap, null, 2);
        message("Gemini đã điền bản nháp V2. Mentor hãy rà soát và chỉnh sửa trước khi gửi.");
      } catch (error) { message(error.message, true); }
      finally { suggest.disabled = false; suggest.textContent = "✦ Gợi ý V2 bằng Gemini"; }
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!selected) return message("Chọn sinh viên trước.", true);
      let roadmap;
      try { roadmap = JSON.parse(form.elements.roadmap.value); }
      catch (_) { return message("JSON V2 chưa hợp lệ. Hãy dùng nút Gemini hoặc kiểm tra dấu ngoặc.", true); }
      try {
        await api(`/api/mentor/roadmaps/${encodeURIComponent(selected.roadmapId)}/proposal`, {
          method: "POST", body: JSON.stringify({ roadmap, note: form.elements.note.value.trim() })
        });
        message("Đã gửi V2. Sinh viên sẽ thấy đề xuất và tự quyết định áp dụng hay giữ V1.");
        detail.hidden = true; selected = null; await loadQueue();
      } catch (error) { message(error.message, true); }
    });
    loadQueue();
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("edutrack:page-loaded", init);
})();
