// Path to your static JSON (keep this next to news.html)
const NEWS_PATH = "News.json";

// Optional: remember user's state for future features
const getPreferredState = () => localStorage.getItem("preferredState") || "";

// Local view counter
const VIEWS_KEY = "peltra_news_views"; // { "<title>|<date>": count }
const views = JSON.parse(localStorage.getItem(VIEWS_KEY) || "{}");
const bumpView = (key) => {
  views[key] = (views[key] || 0) + 1;
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
};

const els = {
  container: document.getElementById("newsContainer"),
  empty: document.getElementById("newsEmpty"),
  error: document.getElementById("newsError"),
  chips: document.getElementById("tagChips"),
  sort: document.getElementById("sortSelect"),
  search: document.getElementById("searchBox"),
  breakingBar: document.getElementById("breakingBar"),
  breakingLink: document.getElementById("breakingLink"),
};

let allNews = [];
let activeTag = "All";

function parseDate(s) {
  const d = new Date(s);
  return isNaN(d) ? new Date() : d;
}
function keyFor(item) { return `${item.title}|${item.date}`; }

function normalizeItem(it) {
  return {
    title: it.title,
    date: it.date,
    dateObj: parseDate(it.date),
    summary: it.summary || "",
    link: it.link || "#",
    tag: it.tag || "Market",
    region: it.region || "",
    material: it.material || "",
    impact: it.impact || "",
    source: it.source || "",
  };
}

function uniqueTags(list) {
  const set = new Set(["All"]);
  list.forEach(n => n.tag && set.add(n.tag));
  return Array.from(set);
}

function renderChips(tags) {
  els.chips.innerHTML = tags.map(t =>
    `<button class="chip ${t === activeTag ? "active" : ""}" data-tag="${t}">${t}</button>`
  ).join("");
  els.chips.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => { activeTag = btn.dataset.tag; render(); });
  });
}

function currentFilters() {
  const q = (els.search.value || "").toLowerCase().trim();
  return (n) => {
    const hitTag = (activeTag === "All") || (n.tag === activeTag);
    const hitText = !q || n.title.toLowerCase().includes(q)
                     || n.summary.toLowerCase().includes(q)
                     || n.tag.toLowerCase().includes(q);
    return hitTag && hitText;
  };
}

function sorters(mode) {
  switch (mode) {
    case "dateAsc": return (a,b) => a.dateObj - b.dateObj;
    case "mostViewed": return (a,b) => (views[keyFor(b)]||0) - (views[keyFor(a)]||0);
    case "dateDesc":
    default: return (a,b) => b.dateObj - a.dateObj;
  }
}

function linkQuery(item){
  const params = new URLSearchParams();
  if (item.region) params.set("region", item.region);
  if (item.material) params.set("material", item.material);
  const str = params.toString();
  return str ? `?${str}` : "";
}

function render() {
  const list = allNews.filter(currentFilters()).sort(sorters(els.sort.value));
  els.container.innerHTML = "";
  els.empty.classList.toggle("hidden", list.length !== 0);

  list.forEach(item => {
    const viewKey = keyFor(item);
    const viewCount = views[viewKey] || 0;

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="meta">
        <span class="tag ${item.tag}">${item.tag}</span>
        ${item.region ? `<span>${item.region}</span> · ` : ""}
        <span>${item.date}</span>
        ${viewCount ? ` · <span title="views">${viewCount} views</span>` : ""}
      </div>
      <h3>${item.title}</h3>
      <p class="summary">${item.summary}</p>
      ${item.impact ? `<div class="impact"><strong>Peltra Impact:</strong> ${item.impact}</div>` : ""}
      <div class="actions">
        <a class="btn primary" href="${item.link}" target="_blank" rel="noopener">Read more →</a>
        ${item.material || item.region ? `<a class="btn ghost" href="market.html${linkQuery(item)}">View price trend</a>` : ""}
      </div>
    `;
    card.querySelector(".btn.primary").addEventListener("click", () => bumpView(viewKey));
    els.container.appendChild(card);
  });
}

async function loadNews() {
  try {
    const res = await fetch(NEWS_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch ${NEWS_PATH} ${res.status}`);
    const raw = await res.json();
    allNews = raw.map(normalizeItem);

    // Breaking bar = newest item
    const latest = [...allNews].sort((a,b) => b.dateObj - a.dateObj)[0];
    if (latest) {
      els.breakingLink.textContent = latest.title;
      els.breakingLink.href = latest.link || "#";
      els.breakingBar.classList.remove("hidden");
    }

    renderChips(uniqueTags(allNews));
    render();
  } catch (e) {
    console.error(e);
    els.error.classList.remove("hidden");
  }
}

function wireControls() {
  ["input","change"].forEach(ev => els.search.addEventListener(ev, render));
  els.sort.addEventListener("change", render);
}

document.addEventListener("DOMContentLoaded", () => {
  wireControls();
  loadNews();
});