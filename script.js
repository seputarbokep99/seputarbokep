// ---------- Firebase init ----------
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const videosCol = db.collection("videos");

let videos = [];
let activeTag = null;
let searchQuery = "";
let seeded = false;
let currentPage = 1;
const PAGE_SIZE = 10;

function uid(){
  return "v-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
}

function parseTags(str){
  return str.split(",").map(t => t.trim()).filter(Boolean);
}

function isAuthed(){
  return sessionStorage.getItem("sv_authed") === "yes";
}

function updateAuthUI(){
  const loggedIn = isAuthed();
  document.getElementById("btnAdd").hidden = !loggedIn;
  document.getElementById("btnLogin").hidden = loggedIn;
  document.getElementById("btnLogout").hidden = !loggedIn;
  renderGrid(); // tombol edit di tiap card ikut nyala/mati sesuai status login
}

function login(code){
  if(code === ADMIN_PASSCODE){
    sessionStorage.setItem("sv_authed", "yes");
    updateAuthUI();
    return true;
  }
  alert("Kode salah.");
  return false;
}

function logout(){
  sessionStorage.removeItem("sv_authed");
  updateAuthUI();
}

// ---------- Realtime listener dari Firestore ----------
const statusEl = document.getElementById("syncStatus");

videosCol.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
  videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Kalau koleksi masih kosong sama sekali (pertama kali dipakai), isi seed sekali.
  if(videos.length === 0 && !seeded && typeof SEED_VIDEOS !== "undefined"){
    seeded = true;
    SEED_VIDEOS.forEach(v => {
      const { id, ...rest } = v;
      videosCol.add({ ...rest, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    return; // snapshot listener bakal kepanggil lagi otomatis setelah seed masuk
  }

  if(statusEl) statusEl.textContent = "";
  renderTagBar();
  renderGrid();
}, (err) => {
  console.error("Firestore error:", err);
  if(statusEl) statusEl.textContent = "Gagal konek ke database. Cek firebase-config.js & aturan Firestore.";
});

function filterByTag(tag){
  activeTag = (activeTag === tag ? null : tag);
  document.getElementById("searchInput").value = "";
  searchQuery = "";
  currentPage = 1;
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

  const countEl = document.getElementById("videoCount");
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  if(countEl){
    if(filtered.length === videos.length){
      countEl.textContent = `${videos.length} video`;
    } else {
      countEl.textContent = `Menampilkan ${filtered.length} dari ${videos.length} video`;
    }
  }

  const loggedIn = isAuthed();

  pageItems.forEach(v => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img class="card-cover" src="${escapeAttr(v.cover)}" alt="${escapeAttr(v.title)}" loading="lazy"
           onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%2326262d%22/></svg>'">
      ${loggedIn ? `<button class="card-edit" title="Edit / hapus" data-edit="${v.id}">✎</button>` : ""}
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
    const editBtn = card.querySelector("[data-edit]");
    if(editBtn){
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openForm(v.id);
      });
    }
    grid.appendChild(card);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages){
  const nav = document.getElementById("pagination");
  nav.innerHTML = "";
  if(totalPages <= 1) return;

  const makeBtn = (label, page, disabled, active) => {
    const b = document.createElement("button");
    b.className = "page-btn" + (active ? " active" : "");
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = () => { currentPage = page; renderGrid(); window.scrollTo({top:0, behavior:"smooth"}); };
    return b;
  };

  nav.appendChild(makeBtn("‹ Sebelumnya", currentPage - 1, currentPage === 1, false));
  for(let p = 1; p <= totalPages; p++){
    nav.appendChild(makeBtn(String(p), p, false, p === currentPage));
  }
  nav.appendChild(makeBtn("Berikutnya ›", currentPage + 1, currentPage === totalPages, false));
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
  const editFromPlayerBtn = document.getElementById("btnEditFromPlayer");
  editFromPlayerBtn.hidden = !isAuthed();
  editFromPlayerBtn.onclick = () => {
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

document.getElementById("videoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("videoId").value;
  const entry = {
    title: document.getElementById("fieldTitle").value.trim(),
    cover: document.getElementById("fieldCover").value.trim(),
    embed: document.getElementById("fieldEmbed").value.trim(),
    tags: parseTags(document.getElementById("fieldTags").value),
    desc: document.getElementById("fieldDesc").value.trim()
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan…";

  try{
    if(id){
      await videosCol.doc(id).update(entry);
    } else {
      await videosCol.add({ ...entry, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    closeForm();
  }catch(err){
    console.error(err);
    alert("Gagal simpan ke database. Cek koneksi / aturan Firestore kamu.");
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan";
  }
});

document.getElementById("btnDelete").addEventListener("click", async () => {
  const id = document.getElementById("videoId").value;
  if(!id) return;
  if(!confirm("Hapus video ini dari koleksi buat SEMUA orang?")) return;
  try{
    await videosCol.doc(id).delete();
    closeForm();
  }catch(err){
    console.error(err);
    alert("Gagal hapus. Cek koneksi / aturan Firestore kamu.");
  }
});

// ---------- Wiring ----------
document.getElementById("btnAdd").addEventListener("click", () => openForm(null));

document.getElementById("btnLogin").addEventListener("click", () => {
  document.getElementById("fieldPasscode").value = "";
  document.getElementById("loginModal").hidden = false;
});
document.getElementById("btnLogout").addEventListener("click", logout);
document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = document.getElementById("fieldPasscode").value;
  if(login(code)){
    document.getElementById("loginModal").hidden = true;
  }
});

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    closeForm();
    closePlayer();
    document.getElementById("loginModal").hidden = true;
  });
});
document.querySelectorAll(".overlay").forEach(ov => {
  ov.addEventListener("click", (e) => {
    if(e.target === ov){ closeForm(); closePlayer(); ov.hidden = true; }
  });
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape"){ closeForm(); closePlayer(); document.getElementById("loginModal").hidden = true; }
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  currentPage = 1;
  renderGrid();
});

document.getElementById("footerYear").textContent = new Date().getFullYear();
updateAuthUI();
