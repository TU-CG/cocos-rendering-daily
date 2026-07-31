const state = { index: null, tag: "all" };

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
})[character]);

const tagById = (id) => state.index.tags.find((tag) => tag.id === id);

const tagLinks = (ids) => ids.map((id) => {
  const tag = tagById(id);
  return `<span class="topic-label" style="--category-color:${tag.color}">${escapeHtml(tag.label)}</span>`;
}).join("");

const renderFilters = () => {
  const filters = document.querySelector("#category-filters");
  const tags = [{ id: "all", label: "全部主题", color: "#18212b" }, ...state.index.tags];
  filters.innerHTML = tags.map((tag) => `
    <button class="category-filter" type="button" role="tab" aria-selected="${state.tag === tag.id}"
      style="--category-color:${tag.color}" data-tag="${tag.id}">
      <span class="category-dot" aria-hidden="true"></span>${escapeHtml(tag.label)}
    </button>`).join("");
  filters.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    state.tag = button.dataset.tag;
    renderFilters();
    renderReports();
  }));
};

const renderReports = () => {
  const reports = state.tag === "all"
    ? state.index.reports
    : state.index.reports.filter((report) => report.tags.includes(state.tag));
  document.querySelector("#report-count").textContent = `共 ${reports.length} 篇`;
  const list = document.querySelector("#report-list");
  if (!reports.length) {
    list.innerHTML = '<p class="empty-state">这个主题的文章正在整理中。</p>';
    return;
  }
  list.innerHTML = reports.map((report) => {
    const primaryTag = tagById(report.tags[0]);
    return `<a class="report-card" href="?date=${encodeURIComponent(report.date)}#article" style="--category-color:${primaryTag.color}">
      <time class="report-date" datetime="${report.date}">${report.date}</time>
      <div><div class="topic-labels">${tagLinks(report.tags)}</div><h3>${escapeHtml(report.title)}</h3><p>${escapeHtml(report.summary)}</p></div>
      <i data-lucide="arrow-up-right" aria-hidden="true"></i>
    </a>`;
  }).join("");
  window.lucide?.createIcons();
};

const section = (title, body) => `<section class="article-section"><h2>${escapeHtml(title)}</h2>${body}</section>`;

const renderArticle = async (date) => {
  const report = state.index.reports.find((item) => item.date === date);
  if (!report) return;
  const response = await fetch(`data/${report.file}`);
  if (!response.ok) throw new Error("无法读取文章内容");
  const article = await response.json();
  document.querySelector("#article").hidden = false;
  document.querySelector("#article-content").innerHTML = `
    <div class="article-meta"><div class="topic-labels">${tagLinks(article.tags)}</div><time datetime="${article.date}">${article.date}</time></div>
    <h1 class="article-title">${escapeHtml(article.title)}</h1>
    <p class="article-summary">${escapeHtml(article.summary)}</p>
    ${section("先建立直觉", `<p>${escapeHtml(article.intuition)}</p>`)}
    ${section("在 Cocos 中怎么理解", `<p>${escapeHtml(article.cocos)}</p>`)}
    ${section("动手试一试", `<p>${escapeHtml(article.exercise)}</p>`)}
    ${section("常见误解", `<ul>${article.misconceptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`)}
    ${section("继续阅读", `<ul class="source-list">${article.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a></li>`).join("")}</ul>`)}
  `;
  window.lucide?.createIcons();
};

const start = async () => {
  const response = await fetch("data/reports.json");
  if (!response.ok) throw new Error("无法读取文章目录");
  state.index = await response.json();
  renderFilters();
  renderReports();
  const date = new URLSearchParams(window.location.search).get("date");
  if (date) await renderArticle(date);
};

start().catch(() => {
  document.querySelector("#report-list").innerHTML = '<p class="empty-state">文章目录暂时无法加载，请稍后刷新重试。</p>';
});
