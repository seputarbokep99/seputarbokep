const STORAGE_KEY = "streamvault_videos_v1";

let videos = loadVideos();
let activeTag = null;
let searchQuery = "";

function loadVideos(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.warn("Gagal baca localStorage:", e); }
  // belum ada data tersimpan -> pakai seed
  return typeof SEED_VIDEOS !== "undefined" ? [...SEED_VIDEOS] : [];
}

function saveVideos(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}

function uid(){
  return "v-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
}

function parseTags(str){
  return str.split(",").map(t => t.trim()).filter(Boolean);
}

function filterByTag(tag){
  activeTag = (activeTag === tag ? null : tag);
  document.getElementById("searchInput").value = "";
  searchQuery = "";
  renderTagBar();
  renderGrid();
  closePlayer();
}

// ---------- Render tag bar ----------
function renderTagBar(){
  const bar = document.getElementById("tagBar");
  const allTags = [...new Set(videos.flatMap(v => v.tags || []))].sort();
  bar.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.className = "tag-chip" + (activeTag === null ? " active" : "");
  allChip.textContent = "Semua";
  allChip.onclick = () => { activeTag = null; renderTagBar(); renderGrid(); };
  bar.appendChild(allChip);

  allTags.forEach(tag => {
    const chip = document.createElement("button");
    chip.className = "tag-chip" + (activeTag === tag ? " active" : "");
    chip.textContent = tag;
    chip.onclick = () => filterByTag(tag);
    bar.appendChild(chip);
  });
}

// ---------- Render grid ----------
function renderGrid(){
  const grid = document.getElementById("grid");
  const empty = document.getElementById("emptyState");
  const q = searchQuery.toLowerCase();

  const filtered = videos.filter(v => {
    const matchesTag = !activeTag || (v.tags || []).includes(activeTag);
    const matchesSearch = !q ||
      v.title.toLowerCase().includes(q) ||
      (v.tags || []).some(t => t.toLowerCase().includes(q));
    return matchesTag && matchesSearch;
  });

  grid.innerHTML = "";
  empty.hidden = filtered.length > 0;

  filtered.forEach(v => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img class="card-cover" src="${escapeAttr(v.cover)}" alt="${escapeAttr(v.title)}" loading="lazy"
           onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%2326262d%22/></svg>'">
      <button class="card-edit" title="Edit / hapus" data-edit="${v.id}">✎</button>
      <div class="card-body">
        <p class="card-title">${escapeHtml(v.title)}</p>
        <div class="card-tags">
          ${(v.tags||[]).slice(0,3).map(t => `<span class="mini-tag" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
    `;
    card.addEventListener("click", (e) => {
      const tagEl = e.target.closest("[data-tag]");
      if(tagEl){
        e.stopPropagation();
        filterByTag(tagEl.dataset.tag);
        return;
      }
      if(e.target.closest("[data-edit]")) return;
      openPlayer(v.id);
    });
    card.querySelector("[data-edit]").addEventListener("click", (e) => {
      e.stopPropagation();
      openForm(v.id);
    });
    grid.appendChild(card);
  });
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function escapeAttr(str){ return escapeHtml(str); }

// ---------- Player modal ----------
function openPlayer(id){
  const v = videos.find(x => x.id === id);
  if(!v) return;
  document.getElementById("playerIframe").src = v.embed;
  document.getElementById("playerTitle").textContent = v.title;
  document.getElementById("playerDesc").textContent = v.desc || "";
  const playerTagsEl = document.getElementById("playerTags");
  playerTagsEl.innerHTML =
    (v.tags||[]).map(t => `<span class="mini-tag" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</span>`).join("");
  playerTagsEl.querySelectorAll("[data-tag]").forEach(el => {
    el.addEventListener("click", () => filterByTag(el.dataset.tag));
  });
  document.getElementById("btnEditFromPlayer").onclick = () => {
    closePlayer();
    openForm(v.id);
  };
  document.getElementById("playerModal").hidden = false;
}
function closePlayer(){
  document.getElementById("playerModal").hidden = true;
  document.getElementById("playerIframe").src = ""; // stop playback
}

// ---------- Form modal (tambah / edit) ----------
function openForm(id){
  const isEdit = !!id;
  document.getElementById("formTitle").textContent = isEdit ? "Edit Video" : "Tambah Video";
  document.getElementById("videoId").value = id || "";
  document.getElementById("btnDelete").hidden = !isEdit;

  if(isEdit){
    const v = videos.find(x => x.id === id);
    document.getElementById("fieldTitle").value = v.title;
    document.getElementById("fieldCover").value = v.cover;
    document.getElementById("fieldEmbed").value = v.embed;
    document.getElementById("fieldTags").value = (v.tags||[]).join(", ");
    document.getElementById("fieldDesc").value = v.desc || "";
  } else {
    document.getElementById("videoForm").reset();
  }
  document.getElementById("formModal").hidden = false;
}
function closeForm(){
  document.getElementById("formModal").hidden = true;
}

document.getElementById("videoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("videoId").value;
  const entry = {
    id: id || uid(),
    title: document.getElementById("fieldTitle").value.trim(),
    cover: document.getElementById("fieldCover").value.trim(),
    embed: document.getElementById("fieldEmbed").value.trim(),
    tags: parseTags(document.getElementById("fieldTags").value),
    desc: document.getElementById("fieldDesc").value.trim()
  };

  if(id){
    videos = videos.map(v => v.id === id ? entry : v);
  } else {
    videos.unshift(entry);
  }
  saveVideos();
  closeForm();
  renderTagBar();
  renderGrid();
});

document.getElementById("btnDelete").addEventListener("click", () => {
  const id = document.getElementById("videoId").value;
  if(!id) return;
  if(!confirm("Hapus video ini dari koleksi?")) return;
  videos = videos.filter(v => v.id !== id);
  saveVideos();
  closeForm();
  renderTagBar();
  renderGrid();
});

// ---------- Wiring ----------
document.getElementById("btnAdd").addEventListener("click", () => openForm(null));
document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    closeForm();
    closePlayer();
  });
});
document.querySelectorAll(".overlay").forEach(ov => {
  ov.addEventListener("click", (e) => {
    if(e.target === ov){ closeForm(); closePlayer(); }
  });
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape"){ closeForm(); closePlayer(); }
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderGrid();
});

// ---------- Export / Import ----------
document.getElementById("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(videos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "streamvault-koleksi.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = JSON.parse(reader.result);
      if(!Array.isArray(imported)) throw new Error("Format bukan array");
      videos = imported;
      saveVideos();
      renderTagBar();
      renderGrid();
      alert("Koleksi berhasil di-import (" + imported.length + " video).");
    }catch(err){
      alert("Gagal import: file JSON tidak valid.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// ---------- Init ----------
renderTagBar();
renderGrid();
