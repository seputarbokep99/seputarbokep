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

// ========== PERBAIKAN UTAMA: LOGIN/LOGOUT ==========
function updateAuthUI(){
  const loggedIn = isAuthed();
  console.log("🔄 Update UI - Login status:", loggedIn);
  
  const btnAdd = document.getElementById("btnAdd");
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  
  // Pastikan semua tombol ada
  if (!btnAdd || !btnLogin || !btnLogout) {
    console.error("❌ Tombol tidak ditemukan di DOM!");
    return;
  }
  
  // Set visibility dengan benar
  btnAdd.hidden = !loggedIn;
  btnLogin.hidden = loggedIn;
  btnLogout.hidden = !loggedIn;
  
  console.log("  ✅ btnAdd hidden:", btnAdd.hidden);
  console.log("  ✅ btnLogin hidden:", btnLogin.hidden);
  console.log("  ✅ btnLogout hidden:", btnLogout.hidden);
  
  // Update tombol edit di card
  renderGrid();
}

function login(code){
  console.log("🔐 Mencoba login dengan kode:", code);
  
  if(code === ADMIN_PASSCODE){
    sessionStorage.setItem("sv_authed", "yes");
    console.log("✅ Login berhasil!");
    updateAuthUI();
    
    // Tutup modal login
    const loginModal = document.getElementById("loginModal");
    if (loginModal) loginModal.hidden = true;
    
    // Reset form login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.reset();
    
    alert("✅ Login berhasil! Anda sekarang bisa menambah/edit video.");
    return true;
  }
  
  alert("❌ Kode admin salah! Silakan coba lagi.");
  return false;
}

function logout(){
  console.log("🚪 Logout...");
  sessionStorage.removeItem("sv_authed");
  updateAuthUI();
  
  // Tutup semua modal yang terbuka
  document.getElementById("loginModal").hidden = true;
  closeForm();
  closePlayer();
  
  console.log("✅ Logout berhasil!");
  alert("✅ Anda telah logout.");
}

// ---------- Realtime listener dari Firestore ----------
const statusEl = document.getElementById("syncStatus");

videosCol.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
  videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Seed data jika kosong
  if(videos.length === 0 && !seeded && typeof SEED_VIDEOS !== "undefined"){
    seeded = true;
    SEED_VIDEOS.forEach(v => {
      const { id, ...rest } = v;
      videosCol.add({ ...rest, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    return;
  }

  if(statusEl) statusEl.textContent = "";
  renderTagBar();
  renderGrid();
}, (err) => {
  console.error("❌ Firestore error:", err);
  if(statusEl) statusEl.textContent = "⚠️ Gagal konek ke database. Cek firebase-config.js & aturan Firestore.";
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
  document.getElementById("playerIframe").src = "";
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

// ========== EVENT LISTENERS - PERBAIKAN ==========
document.addEventListener("DOMContentLoaded", function() {
  console.log("🚀 DOM loaded, setting up event listeners...");
  
  // Tombol tambah video
  const btnAdd = document.getElementById("btnAdd");
  if (btnAdd) {
    btnAdd.addEventListener("click", () => openForm(null));
    console.log("  ✅ btnAdd listener attached");
  }
  
  // Tombol login
  const btnLogin = document.getElementById("btnLogin");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      console.log("🔑 Login button clicked");
      document.getElementById("fieldPasscode").value = "";
      document.getElementById("loginModal").hidden = false;
    });
    console.log("  ✅ btnLogin listener attached");
  }
  
  // Tombol logout
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
    console.log("  ✅ btnLogout listener attached");
  }

  // Search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      currentPage = 1;
      renderGrid();
    });
    console.log("  ✅ searchInput listener attached");
  }

  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const code = document.getElementById("fieldPasscode").value;
      login(code);
    });
    console.log("  ✅ loginForm listener attached");
  }

  // Close buttons
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      closeForm();
      closePlayer();
      document.getElementById("loginModal").hidden = true;
    });
  });
  console.log("  ✅ close buttons listeners attached");

  // Overlay click to close
  document.querySelectorAll(".overlay").forEach(ov => {
    ov.addEventListener("click", (e) => {
      if(e.target === ov){ 
        closeForm(); 
        closePlayer(); 
        ov.hidden = true; 
      }
    });
  });
  console.log("  ✅ overlay listeners attached");

  // Escape key
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape"){ 
      closeForm(); 
      closePlayer(); 
      document.getElementById("loginModal").hidden = true; 
    }
  });
  console.log("  ✅ escape key listener attached");

  // Footer year
  document.getElementById("footerYear").textContent = new Date().getFullYear();
  
  // Initial UI update
  console.log("🔄 Initial UI update...");
  updateAuthUI();
  
  console.log("✅ All setup complete!");
});
