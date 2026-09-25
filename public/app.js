const CENTER = [-20.4428, -54.6464];
const POLL_MS = 12000;

const state = {
  spawns: [],
  scanner: {},
  favorites: new Set(JSON.parse(localStorage.getItem("pokems_favorites") || "[]")),
  onlyFavorites: localStorage.getItem("pokems_onlyFavorites") === "1",
  onlyFresh: localStorage.getItem("pokems_onlyFresh") === "1",
  maxDistance: Number(localStorage.getItem("pokems_maxDistance") || 25),
  minConfidence: Number(localStorage.getItem("pokems_minConfidence") || 50),
  userPos: null,
  lastLoaded: null,
  seenIds: new Set(),
  spriteCache: new Map(),
};

const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];

const map = L.map("map", { zoomControl: false, attributionControl: true }).setView(CENTER, 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

let markers = [];
let userMarker = null;

function savePrefs() {
  localStorage.setItem("pokems_favorites", JSON.stringify([...state.favorites]));
  localStorage.setItem("pokems_onlyFavorites", state.onlyFavorites ? "1" : "0");
  localStorage.setItem("pokems_onlyFresh", state.onlyFresh ? "1" : "0");
  localStorage.setItem("pokems_maxDistance", String(state.maxDistance));
  localStorage.setItem("pokems_minConfidence", String(state.minConfidence));
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2200);
}

function norm(s) {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slug(s) {
  return norm(s).replace(/♀/g, "-f").replace(/♂/g, "-m").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ago(iso) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso || 0)) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h`;
}

function haversine(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180;
  const la2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function spriteFor(species) {
  const key = slug(species);
  if (!key) return null;
  if (state.spriteCache.has(key)) return state.spriteCache.get(key);
  const promise = fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(key)}`, { cache: "force-cache" })
    .then(r => r.ok ? r.json() : null)
    .then(j => j?.sprites?.other?.["official-artwork"]?.front_default || j?.sprites?.front_default || null)
    .catch(() => null);
  state.spriteCache.set(key, promise);
  return promise;
}

function filteredSpawns() {
  const q = norm($("#searchInput").value);
  return state.spawns.filter((s) => {
    const speciesKey = norm(s.species);
    if (q && !speciesKey.includes(q)) return false;
    if (state.onlyFavorites && !state.favorites.has(speciesKey)) return false;
    if (state.onlyFresh && Date.now() - new Date(s.last_seen || 0) > 10 * 60_000) return false;
    if ((Number(s.confidence || 0) * 100) < state.minConfidence) return false;
    if (state.userPos) {
      const d = haversine(state.userPos, [Number(s.lat), Number(s.lon)]);
      if (d != null && d > state.maxDistance) return false;
    }
    return true;
  });
}

window.toggleFavorite = (species) => {
  const key = norm(species);
  if (!key) return;
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
    toast(`${species} removido dos favoritos`);
  } else {
    state.favorites.add(key);
    toast(`${species} favoritado ★`);
  }
  savePrefs();
  renderFavorites();
  renderMarkers();
};

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function renderMarkers() {
  for (const m of markers) m.remove();
  markers = [];
  const list = filteredSpawns();

  $("#spawnCount").textContent = list.length;
  $("#favoriteCount").textContent = state.favorites.size;
  $("#emptyState").classList.toggle("hidden", list.length !== 0);

  for (const s of list) {
    const favorite = state.favorites.has(norm(s.species));
    const sprite = await spriteFor(s.species);
    const icon = L.divIcon({
      className: "",
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      html: `<div class="pokemon-marker ${favorite ? "favorite" : ""}">
        <div class="bubble">${sprite ? `<img src="${sprite}" alt="">` : `<span class="fallback">${escapeHtml(String(s.species).slice(0,2).toUpperCase())}</span>`}</div>
        ${favorite ? '<span class="star">★</span>' : ""}
      </div>`,
    });

    const m = L.marker([s.lat, s.lon], { icon }).addTo(map);
    const distance = state.userPos ? haversine(state.userPos, [s.lat, s.lon]) : null;
    const conf = Math.round(Number(s.confidence || 0) * 100);
    const maps = `https://www.google.com/maps?q=${encodeURIComponent(s.lat + "," + s.lon)}`;
    const speciesArg = encodeURIComponent(String(s.species)).replace(/'/g, "%27");
    m.bindPopup(`
      <div class="popup-head">
        ${sprite ? `<img class="popup-sprite" src="${sprite}" alt="">` : ""}
        <div><b>${escapeHtml(s.species)}</b><br><small>${favorite ? "★ favorito" : "Pokémon detectado"}</small></div>
      </div>
      <div class="popup-meta">
        visto há <b>${ago(s.last_seen)}</b> · confiança <b>${conf}%</b>
        ${distance != null ? ` · <b>${distance.toFixed(distance < 10 ? 1 : 0)} km</b>` : ""}
      </div>
      <div class="popup-actions">
        <button onclick="toggleFavorite(decodeURIComponent('${speciesArg}'))">${favorite ? "★ Remover" : "☆ Favoritar"}</button>
        <a href="${maps}" target="_blank" rel="noopener">Abrir rota ↗</a>
      </div>
    `);
    markers.push(m);
  }
}

function renderFavorites() {
  const box = $("#favoriteList");
  box.innerHTML = "";
  if (!state.favorites.size) {
    box.innerHTML = '<p style="color:#64808c;font-size:13px">Nenhum favorito ainda. Adicione Gible, Beldum, Larvitar…</p>';
    return;
  }
  for (const key of [...state.favorites].sort()) {
    const tag = document.createElement("div");
    tag.className = "favorite-tag";
    tag.innerHTML = `<span>★ ${escapeHtml(key)}</span><button aria-label="remover">×</button>`;
    tag.querySelector("button").onclick = () => window.toggleFavorite(key);
    box.appendChild(tag);
  }
}

function scannerFresh() {
  const t = new Date(state.scanner?.updated_at || 0).getTime();
  return Number.isFinite(t) && Date.now() - t < 90_000;
}

function renderScanner() {
  const online = scannerFresh();
  $(".live-dot").classList.toggle("online", online);
  $(".scanner-orb").classList.toggle("online", online);
  $("#scannerLabel").textContent = online ? "Scanner ao vivo" : "Scanner offline";
  $("#scannerDetail").textContent = online
    ? `ponto ${state.scanner.index ?? "—"} de ${state.scanner.total ?? "—"}`
    : "aguardando sinal";
  $("#scannerSheetLabel").textContent = online ? "Varredura ativa" : "Scanner offline";
  $("#scannerSheetDetail").textContent = online
    ? `Modo ${state.scanner.mode || "scanning"}, atualizado há ${ago(state.scanner.updated_at)}.`
    : "Nenhum sinal recente do scanner.";
  $("#metricPoint").textContent = state.scanner.index && state.scanner.total ? `${state.scanner.index}/${state.scanner.total}` : "—";
  $("#metricCycle").textContent = state.scanner.cycle ?? "—";
  $("#metricLatLon").textContent = Number.isFinite(Number(state.scanner.lat))
    ? `${Number(state.scanner.lat).toFixed(3)}, ${Number(state.scanner.lon).toFixed(3)}`
    : "—";
}

function notifyFavorites(newSpawns) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  for (const s of newSpawns) {
    if (!state.favorites.has(norm(s.species))) continue;
    new Notification(`★ ${s.species} detectado`, {
      body: `Novo sinal no PokeMS · confiança ${Math.round(Number(s.confidence || 0)*100)}%`,
      tag: `pokems-${s.id}`,
    });
  }
}

async function load() {
  try {
    const [spawnsResp, statusResp] = await Promise.all([
      fetch("/api/spawns", { cache: "no-store" }),
      fetch("/api/status", { cache: "no-store" }),
    ]);
    if (!spawnsResp.ok) throw new Error("API indisponível");

    const spawns = await spawnsResp.json();
    const status = statusResp.ok ? await statusResp.json() : {};

    const newOnes = (Array.isArray(spawns) ? spawns : []).filter((s) => !state.seenIds.has(s.id));
    state.spawns = Array.isArray(spawns) ? spawns : [];
    state.scanner = status || {};
    if (state.lastLoaded) notifyFavorites(newOnes);
    state.spawns.forEach(s => state.seenIds.add(s.id));
    state.lastLoaded = new Date();

    const newest = [...state.spawns].sort((a,b) => new Date(b.last_seen) - new Date(a.last_seen))[0];
    $("#lastSignal").textContent = newest ? `último sinal: ${ago(newest.last_seen)} atrás` : "último sinal: —";
    $("#updatedAgo").textContent = "agora";
    renderScanner();
    renderMarkers();
  } catch (err) {
    $("#scannerLabel").textContent = "Backend indisponível";
    $("#scannerDetail").textContent = "verifique o deploy";
    console.error(err);
  }
}

function locate() {
  if (!navigator.geolocation) return toast("GPS não disponível neste navegador");
  toast("Buscando sua localização…");
  navigator.geolocation.getCurrentPosition((pos) => {
    state.userPos = [pos.coords.latitude, pos.coords.longitude];
    if (userMarker) userMarker.remove();
    userMarker = L.marker(state.userPos, {
      icon: L.divIcon({ className: "", iconSize:[18,18], iconAnchor:[9,9], html:'<div class="user-dot"></div>' })
    }).addTo(map);
    map.setView(state.userPos, 15);
    renderMarkers();
    toast("Localização atualizada");
  }, () => toast("Não consegui acessar sua localização"), { enableHighAccuracy:true, timeout:10000 });
}

function openSheet(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
}
function closeSheet(el) {
  el.classList.remove("open");
  el.setAttribute("aria-hidden", "true");
}

$("#filterBtn").onclick = () => openSheet("filterSheet");
$("#favoriteTabBtn").onclick = () => openSheet("favoritesSheet");
$("#liveBtn").onclick = () => openSheet("scannerSheet");
$$(".nav-btn").forEach(btn => btn.onclick = () => {
  $$(".nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  if (btn.dataset.tab === "favorites") openSheet("favoritesSheet");
  if (btn.dataset.tab === "scanner") openSheet("scannerSheet");
});
$$(".close-sheet").forEach(btn => btn.onclick = () => closeSheet(document.getElementById(btn.dataset.close)));
$$(".sheet").forEach(sheet => sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(sheet); }));

$("#locateBtn").onclick = locate;
$("#refreshBtn").onclick = () => { load(); toast("Atualizando radar…"); };
$("#zoomInBtn").onclick = () => map.zoomIn();
$("#zoomOutBtn").onclick = () => map.zoomOut();
$("#searchInput").addEventListener("input", renderMarkers);

$("#onlyFavorites").checked = state.onlyFavorites;
$("#onlyFresh").checked = state.onlyFresh;
$("#distanceRange").value = state.maxDistance;
$("#confidenceRange").value = state.minConfidence;
$("#distanceOut").textContent = `${state.maxDistance} km`;
$("#confidenceOut").textContent = `${state.minConfidence}%`;

$("#onlyFavorites").onchange = (e) => { state.onlyFavorites = e.target.checked; savePrefs(); renderMarkers(); };
$("#onlyFresh").onchange = (e) => { state.onlyFresh = e.target.checked; savePrefs(); renderMarkers(); };
$("#distanceRange").oninput = (e) => { state.maxDistance=Number(e.target.value); $("#distanceOut").textContent=`${state.maxDistance} km`; savePrefs(); renderMarkers(); };
$("#confidenceRange").oninput = (e) => { state.minConfidence=Number(e.target.value); $("#confidenceOut").textContent=`${state.minConfidence}%`; savePrefs(); renderMarkers(); };

function addFavoriteFromInput() {
  const input = $("#favoriteInput");
  const value = input.value.trim();
  if (!value) return;
  const key = norm(value);
  if (!state.favorites.has(key)) {
    state.favorites.add(key);
    savePrefs();
    renderFavorites();
    renderMarkers();
    toast(`${value} adicionado à caça ★`);
  }
  input.value = "";
}
$("#addFavoriteBtn").onclick = addFavoriteFromInput;
$("#favoriteInput").addEventListener("keydown", e => { if (e.key === "Enter") addFavoriteFromInput(); });

$("#notificationBtn").onclick = async () => {
  if (!("Notification" in window)) return toast("Seu navegador não suporta notificações");
  const p = await Notification.requestPermission();
  toast(p === "granted" ? "Alertas de favoritos ativados ★" : "Permissão de notificação não concedida");
};

setInterval(() => {
  if (state.lastLoaded) $("#updatedAgo").textContent = ago(state.lastLoaded.toISOString());
  renderScanner();
}, 1000);

renderFavorites();
renderScanner();
load();
setInterval(load, POLL_MS);
