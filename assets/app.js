const state = {
  index: null,
  tag: "all",
  query: "",
  page: 1,
  pageSize: 5,
  listCollapsed: false,
  activeReport: null,
  lastViewedDate: null,
  articleRequest: 0
};

const icons = {
  all: "全",
  performance: "帧",
  materials: "材",
  "camera-ui": "镜",
  "render-pipeline": "线",
  textures: "纹",
  batching: "批",
  lighting: "光",
  "post-processing": "后"
};

const displayLabels = {
  "render-pipeline": "渲染流程",
  "camera-ui": "相机 UI",
  textures: "纹理",
  materials: "材质",
  batching: "批处理",
  lighting: "光照",
  "post-processing": "后处理",
  performance: "性能分析"
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
})[character]);

const storageGet = (key) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};

const storageSet = (key, value) => {
  try { window.localStorage.setItem(key, value); } catch { /* local storage may be unavailable */ }
};

const tagById = (id) => state.index.tags.find((tag) => tag.id === id);

const tagColor = (id) => {
  const color = tagById(id)?.color;
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#0d7f8a";
};

const tagLabel = (id) => displayLabels[id] || tagById(id)?.label || id;

const tagMarkup = (id) => `<span class="topic-label" style="--tag-color:${tagColor(id)}">${escapeHtml(tagLabel(id))}</span>`;

const tagListMarkup = (ids) => ids.map(tagMarkup).join("");

const filteredReports = () => {
  const byTag = state.tag === "all"
    ? state.index.reports
    : state.index.reports.filter((report) => report.tags.includes(state.tag));
  const query = state.query.trim().toLowerCase();
  if (!query) return byTag;
  return byTag.filter((report) => {
    const searchable = [
      report.title,
      report.summary,
      ...report.tags.map(tagLabel)
    ].join(" ").toLowerCase();
    return searchable.includes(query);
  });
};

const setUrlForArticle = (date) => {
  const query = date ? `?date=${encodeURIComponent(date)}#article` : window.location.pathname;
  window.history.replaceState(null, "", query);
};

const renderFilters = () => {
  const filters = document.querySelector("#category-filters");
  const tags = [{ id: "all", label: "全部", color: "#2d7f8b" }, ...state.index.tags];
  filters.innerHTML = tags.map((tag) => `
    <button class="rail-tab ${state.tag === tag.id ? "active" : ""}" type="button"
      aria-selected="${state.tag === tag.id}" data-tag="${escapeHtml(tag.id)}"
      style="--category-color:${tag.id === "all" ? "#2d7f8b" : tagColor(tag.id)}">
      <span class="rail-tab-icon" aria-hidden="true">${escapeHtml(icons[tag.id] || tag.label.slice(0, 1))}</span>
      <span class="rail-tab-label">${escapeHtml(displayLabels[tag.id] || tag.label)}</span>
    </button>`).join("");

  filters.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    state.tag = button.dataset.tag;
    state.page = 1;
    state.listCollapsed = false;
    setUrlForArticle(null);
    render();
  }));
};

const updatePagination = (totalPages) => {
  const pageInput = document.querySelector("#page-input");
  document.querySelector("#total-pages").textContent = totalPages;
  pageInput.value = state.page;
  pageInput.max = totalPages;
  pageInput.disabled = totalPages === 1;
  document.querySelector("#prev-page").disabled = state.page === 1;
  document.querySelector("#next-page").disabled = state.page === totalPages;
};

const renderReports = () => {
  const reports = filteredReports();
  const totalPages = Math.max(1, Math.ceil(reports.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const pageStart = (state.page - 1) * state.pageSize;
  const pageReports = reports.slice(pageStart, pageStart + state.pageSize);
  document.querySelector("#report-count").textContent = `${reports.length} 篇`;
  updatePagination(totalPages);

  const list = document.querySelector("#report-list");
  if (!pageReports.length) {
    list.innerHTML = '<p class="empty-state">没有找到匹配的文章。</p>';
    return;
  }

  list.innerHTML = pageReports.map((report) => `
    <article class="report-card ${state.activeReport?.date === report.date ? "selected" : ""} ${state.lastViewedDate === report.date ? "last-viewed" : ""}"
      data-date="${escapeHtml(report.date)}" tabindex="0" role="button" aria-label="阅读 ${escapeHtml(report.title)}">
      <div class="card-top">
        <div class="card-date-wrap">
          ${state.lastViewedDate === report.date ? '<span class="last-viewed-mark">上次阅读</span>' : ""}
          <time class="report-date" datetime="${escapeHtml(report.date)}">${escapeHtml(report.date)}</time>
        </div>
      </div>
      <h3>${escapeHtml(report.title)}</h3>
      <p>${escapeHtml(report.summary)}</p>
      <div class="topic-labels">${tagListMarkup(report.tags)}</div>
    </article>`).join("");

  list.querySelectorAll(".report-card").forEach((card) => {
    const open = () => {
      const report = pageReports.find((item) => item.date === card.dataset.date);
      if (report) openArticle(report);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
};

const richText = (value) => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\n/g, "<br>");

const renderBlocks = (value) => String(value || "").split(/\n\s*\n/).filter(Boolean).map((block) => {
  const lines = block.split("\n").filter((line) => line.trim());
  if (lines.length > 1 && lines.every((line) => /^\d+\.\s/.test(line.trim()))) {
    return `<ol>${lines.map((line) => `<li>${richText(line.replace(/^\d+\.\s/, ""))}</li>`).join("")}</ol>`;
  }
  if (lines.length > 1 && lines.every((line) => /^-\s/.test(line.trim()))) {
    return `<ul>${lines.map((line) => `<li>${richText(line.replace(/^-\s/, ""))}</li>`).join("")}</ul>`;
  }
  return `<p>${richText(block)}</p>`;
}).join("");

const articleSection = (title, body) => `<section class="article-section"><h2>${escapeHtml(title)}</h2>${renderBlocks(body)}</section>`;

const sourceSection = (sources) => `<section class="article-section"><h2>继续阅读</h2><ul class="source-list">${(sources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a></li>`).join("")}</ul></section>`;

const renderArticleError = () => {
  document.querySelector("#article-content").innerHTML = '<p class="empty-state">文章内容暂时无法加载，请稍后重试。</p>';
};

const loadArticle = async (report) => {
  const request = ++state.articleRequest;
  const articleContent = document.querySelector("#article-content");
  articleContent.innerHTML = '<p class="empty-state">正在打开文章……</p>';
  try {
    const response = await fetch(`data/${encodeURIComponent(report.file)}`);
    if (!response.ok) throw new Error("无法读取文章内容");
    const article = await response.json();
    if (request !== state.articleRequest) return;
    articleContent.innerHTML = `
      <div class="article-meta">${tagListMarkup(article.tags)}<time datetime="${escapeHtml(article.date)}">${escapeHtml(article.date)}</time></div>
      <h1 class="article-title">${escapeHtml(article.title)}</h1>
      <p class="article-summary">${richText(article.summary)}</p>
      ${articleSection("先建立直觉", article.intuition)}
      ${articleSection("在 Cocos 中怎么理解", article.cocos)}
      ${articleSection("动手试一试", article.exercise)}
      ${articleSection("常见误解", (article.misconceptions || []).map((item) => `- ${item}`).join("\n"))}
      ${sourceSection(article.sources)}
    `;
    articleContent.querySelectorAll("a").forEach((link) => link.target = "_blank");
  } catch {
    if (request === state.articleRequest) renderArticleError();
  }
};

const syncView = () => {
  const listPanel = document.querySelector("#list-panel");
  const article = document.querySelector("#article-content");
  listPanel.classList.toggle("collapsed", state.listCollapsed);
  article.hidden = !state.listCollapsed;
  document.querySelector("#collapsed-title").textContent = state.activeReport?.title || "";
  const toggle = document.querySelector("#list-toggle");
  toggle.textContent = state.listCollapsed ? "展开列表 ⌄" : "继续阅读 ↑";
  toggle.setAttribute("aria-label", state.listCollapsed ? "展开文章列表" : "折叠列表并继续阅读");
  toggle.title = state.listCollapsed ? "展开文章列表" : "折叠列表并继续阅读";
};

const openArticle = (report) => {
  state.activeReport = report;
  state.lastViewedDate = report.date;
  storageSet("cocos-render-last-viewed", report.date);
  state.listCollapsed = true;
  setUrlForArticle(report.date);
  renderReports();
  syncView();
  loadArticle(report);
};

const render = () => {
  const reports = filteredReports();
  if (reports.length && !reports.some((report) => report.date === state.activeReport?.date) && state.tag !== "all") {
    state.activeReport = reports[0];
  }
  renderFilters();
  renderReports();
  syncView();
};

const jumpToPage = () => {
  const totalPages = Math.max(1, Math.ceil(filteredReports().length / state.pageSize));
  const requested = Number.parseInt(document.querySelector("#page-input").value, 10);
  if (Number.isFinite(requested)) state.page = Math.max(1, Math.min(requested, totalPages));
  renderReports();
};

const bindControls = () => {
  document.querySelector("#search-input").addEventListener("input", (event) => {
    state.query = event.target.value;
    state.page = 1;
    state.listCollapsed = false;
    setUrlForArticle(null);
    render();
  });
  document.querySelector("#list-toggle").addEventListener("click", () => {
    if (state.listCollapsed) {
      state.listCollapsed = false;
      setUrlForArticle(null);
      render();
      return;
    }
    const report = state.activeReport || filteredReports()[0] || state.index.reports[0];
    if (report) openArticle(report);
  });
  document.querySelector("#prev-page").addEventListener("click", () => { state.page -= 1; renderReports(); });
  document.querySelector("#next-page").addEventListener("click", () => { state.page += 1; renderReports(); });
  document.querySelector("#page-input").addEventListener("change", jumpToPage);
  document.querySelector("#page-input").addEventListener("keydown", (event) => { if (event.key === "Enter") jumpToPage(); });
};

const start = async () => {
  const response = await fetch("data/reports.json");
  if (!response.ok) throw new Error("无法读取文章目录");
  state.index = await response.json();
  state.lastViewedDate = storageGet("cocos-render-last-viewed");
  state.activeReport = state.index.reports.find((report) => report.date === state.lastViewedDate) || state.index.reports[0];
  bindControls();
  const date = new URLSearchParams(window.location.search).get("date");
  const directReport = state.index.reports.find((report) => report.date === date);
  if (directReport) {
    render();
    openArticle(directReport);
  } else {
    render();
  }
};

start().catch(() => {
  document.querySelector("#report-list").innerHTML = '<p class="empty-state">文章目录暂时无法加载，请稍后刷新重试。</p>';
});
