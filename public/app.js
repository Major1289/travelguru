/* ============================================================
   TRAVEL GURU v7 — app.js
   ============================================================ */
'use strict';

let allPlaces = [], allStates = [], allCategories = [];
let wishlist = [], trips = [];
let currentUser = null, authToken = null;
let exploreOffset = 0, BATCH = 24;
let filteredPlaces = [];
let allHotels = [], filteredHotels = [], hotelOffset = 0;
let allRestaurants = [], filteredRestaurants = [], restOffset = 0;
let socket = null;
let chatRoom = null, chatPlaceId = null;

/* ── INIT ──────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  await loadMeta();
  buildCatPills();
  buildStatesShowcase();
  loadFeatured();
  buildExploreFilters();
  loadExplore();
  loadStatesPage();
  scrollNavEffect();
  initSocket();
});

/* ── AUTH ──────────────────────────────────────────────── */
function checkAuth() {
  authToken = localStorage.getItem('tg_token');
  const u = localStorage.getItem('tg_user');
  if (authToken && u) {
    currentUser = JSON.parse(u);
    renderUserArea();
    loadWishlist();
    loadTrips();
  } else {
    renderUserArea();
  }
}

function renderUserArea() {
  const el = document.getElementById('userArea');
  if (currentUser) {
    el.innerHTML = `
      <div class="user-pill" onclick="showUserMenu()">
        👤 <span>${currentUser.name.split(' ')[0]}</span> ▾
      </div>`;
  } else {
    el.innerHTML = `<button class="btn-nav" onclick="showAuth()">Login / Register</button>`;
  }
}

function showAuth() { document.getElementById('authModal').classList.add('open'); }
function closeAuthModal(e) {
  if (e.target === document.getElementById('authModal'))
    document.getElementById('authModal').classList.remove('open');
}
function switchAuth(tab) {
  document.getElementById('auth-login').style.display = tab==='login' ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab==='register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginErr');
  if (!email || !password) { showFormErr(errEl,'Enter email and password'); return; }
  try {
    const res = await fetch('/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { showFormErr(errEl, data.error || 'Login failed'); return; }
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('tg_token', authToken);
    localStorage.setItem('tg_user', JSON.stringify(currentUser));
    document.getElementById('authModal').classList.remove('open');
    renderUserArea(); loadWishlist(); loadTrips();
    showToast('Welcome back, '+currentUser.name+'! 🎉', 'success');
  } catch { showFormErr(errEl, 'Network error'); }
}

async function doRegister() {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPass').value;
  const homeState = document.getElementById('regState').value;
  const errEl = document.getElementById('regErr');
  if (!name||!email||!password) { showFormErr(errEl,'All fields required'); return; }
  if (password.length < 6) { showFormErr(errEl,'Password min 6 characters'); return; }
  try {
    const res = await fetch('/api/auth/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, email, password, homeState })
    });
    const data = await res.json();
    if (!res.ok) { showFormErr(errEl, data.error || 'Registration failed'); return; }
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('tg_token', authToken);
    localStorage.setItem('tg_user', JSON.stringify(currentUser));
    document.getElementById('authModal').classList.remove('open');
    renderUserArea(); loadWishlist(); loadTrips();
    showToast('Welcome to Travel Guru, '+name+'! 🇮🇳', 'success');
  } catch { showFormErr(errEl, 'Network error'); }
}

function showUserMenu() {
  const existing = document.getElementById('userMenuDrop');
  if (existing) { existing.remove(); return; }
  const div = document.createElement('div');
  div.id = 'userMenuDrop';
  div.style.cssText = `position:fixed;top:68px;right:20px;background:white;border-radius:14px;
    box-shadow:0 8px 32px rgba(0,0,0,.2);z-index:2000;min-width:180px;overflow:hidden;`;
  div.innerHTML = `
    <div style="padding:14px 18px;border-bottom:1px solid #eee;font-size:.85rem;color:#888">
      ${currentUser.email}
    </div>
    <div onclick="showPage('wishlist');closeMenu()" style="padding:12px 18px;cursor:pointer;font-size:.9rem">❤️ Wishlist</div>
    <div onclick="showPage('trips');closeMenu()" style="padding:12px 18px;cursor:pointer;font-size:.9rem">🗓️ My Trips</div>
    <div onclick="doLogout()" style="padding:12px 18px;cursor:pointer;font-size:.9rem;color:#e53e3e">🚪 Logout</div>`;
  document.body.appendChild(div);
  setTimeout(() => document.addEventListener('click', closeMenu, {once:true}), 100);
}
function closeMenu() { document.getElementById('userMenuDrop')?.remove(); }
function doLogout() {
  authToken = null; currentUser = null;
  localStorage.removeItem('tg_token'); localStorage.removeItem('tg_user');
  renderUserArea(); wishlist = []; trips = [];
  showToast('Logged out. Safe travels! 👋');
  closeMenu();
}

/* ── DATA LOADING ──────────────────────────────────────── */
async function loadMeta() {
  try {
    const [sRes, cRes] = await Promise.all([
      fetch('/api/states'), fetch('/api/categories')
    ]);
    allStates = await sRes.json();
    allCategories = await cRes.json();
    // Populate filters
    const stateSelect = document.getElementById('filterState');
    const regStateSelect = document.getElementById('regState');
    allStates.forEach(s => {
      if (stateSelect) stateSelect.innerHTML += `<option value="${s}">${s}</option>`;
      if (regStateSelect) regStateSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });
    const catSelect = document.getElementById('filterCat');
    allCategories.forEach(c => {
      if (catSelect) catSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
  } catch(e) { console.error('Meta load failed', e); }
}

async function loadAllPlaces() {
  if (allPlaces.length) return allPlaces;
  try {
    const res = await fetch('/api/places');
    allPlaces = await res.json();
    document.getElementById('totalCount').textContent = allPlaces.length + '+';
    // Update stat
    document.getElementById('statPlaces').textContent = allPlaces.length + '+';
  } catch(e) { console.error(e); }
  return allPlaces;
}

async function loadFeatured() {
  try {
    const res = await fetch('/api/places?featured=true');
    const places = await res.json();
    await loadAllPlaces();
    renderGrid('featuredGrid', places.length ? places : allPlaces.slice(0,12));
  } catch { document.getElementById('featuredGrid').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Could not load places. Make sure the server is running.</p></div>'; }
}

function buildCatPills() {
  // Will be populated after meta loads
  setTimeout(() => {
    const wrap = document.getElementById('catPills');
    if (!wrap) return;
    wrap.innerHTML = '<span class="cat-pill active" onclick="filterFeatured(\'\',this)">All</span>';
    allCategories.forEach(c => {
      wrap.innerHTML += `<span class="cat-pill" onclick="filterFeatured('${c}',this)">${c}</span>`;
    });
  }, 500);
}

async function filterFeatured(cat, el) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  await loadAllPlaces();
  const filtered = cat ? allPlaces.filter(p => p.category === cat) : allPlaces.filter(p => p.featured);
  renderGrid('featuredGrid', filtered.slice(0, 12));
}

function buildStatesShowcase() {
  setTimeout(async () => {
    await loadAllPlaces();
    const wrap = document.getElementById('statesShowcase');
    if (!wrap) return;
    const stateMap = {};
    allPlaces.forEach(p => {
      if (!stateMap[p.state]) stateMap[p.state] = 0;
      stateMap[p.state]++;
    });
    wrap.innerHTML = Object.entries(stateMap).sort((a,b)=>b[1]-a[1]).map(([s,c]) =>
      `<div class="state-chip" onclick="filterByState('${s}')">
        <div class="state-chip-name">${s}</div>
        <div class="state-chip-count">${c} places</div>
      </div>`
    ).join('');
  }, 600);
}

async function filterByState(state) {
  showPage('explore');
  document.getElementById('filterState').value = state;
  populateCityFilter(state);
  filterPlaces();
}

function onStateFilterChange() {
  const state = document.getElementById('filterState')?.value || '';
  populateCityFilter(state);
  filterPlaces();
}

function populateCityFilter(state) {
  const citySelect = document.getElementById('filterCity');
  if (!citySelect) return;
  citySelect.innerHTML = '<option value="">All Cities</option>';
  if (!state) return;
  const cities = [...new Set(
    allPlaces
      .filter(p => p.state === state && p.city && p.city !== 'Various')
      .map(p => p.city)
  )].sort();
  cities.forEach(c => {
    citySelect.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

/* ── EXPLORE ──────────────────────────────────────────── */
function buildExploreFilters() {}

async function loadExplore() {
  await loadAllPlaces();
  filteredPlaces = [...allPlaces];
  renderExplore();
}

function filterPlaces() {
  const search = document.getElementById('exploreSearch')?.value.toLowerCase() || '';
  const state = document.getElementById('filterState')?.value || '';
  const city = document.getElementById('filterCity')?.value || '';
  const cat = document.getElementById('filterCat')?.value || '';
  filteredPlaces = allPlaces.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search) ||
      p.state.toLowerCase().includes(search) || p.desc?.toLowerCase().includes(search);
    const matchState = !state || p.state === state;
    const matchCity = !city || p.city === city;
    const matchCat = !cat || p.category === cat;
    return matchSearch && matchState && matchCity && matchCat;
  });
  exploreOffset = 0;
  renderExplore();
}

function clearFilters() {
  document.getElementById('exploreSearch').value = '';
  document.getElementById('filterState').value = '';
  document.getElementById('filterCity').innerHTML = '<option value="">All Cities</option>';
  document.getElementById('filterCat').value = '';
  filterPlaces();
}

function renderExplore() {
  const grid = document.getElementById('exploreGrid');
  const info = document.getElementById('resultsInfo');
  info.textContent = `Showing ${Math.min(filteredPlaces.length, BATCH)} of ${filteredPlaces.length} destinations`;
  const batch = filteredPlaces.slice(0, BATCH);
  exploreOffset = batch.length;
  grid.innerHTML = batch.length ? batch.map(p => placeCardHTML(p)).join('') :
    '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No places found</h3><p>Try different filters</p></div>';
  const moreWrap = document.getElementById('loadMoreWrap');
  moreWrap.style.display = filteredPlaces.length > BATCH ? 'block' : 'none';
}

function loadMore() {
  const grid = document.getElementById('exploreGrid');
  const next = filteredPlaces.slice(exploreOffset, exploreOffset + BATCH);
  next.forEach(p => { grid.innerHTML += placeCardHTML(p); });
  exploreOffset += next.length;
  document.getElementById('resultsInfo').textContent =
    `Showing ${exploreOffset} of ${filteredPlaces.length} destinations`;
  if (exploreOffset >= filteredPlaces.length)
    document.getElementById('loadMoreWrap').style.display = 'none';
}

/* ── STATES PAGE ──────────────────────────────────────── */
async function loadStatesPage() {
  await loadAllPlaces();
  const stateMap = {};
  allPlaces.forEach(p => {
    if (!stateMap[p.state]) stateMap[p.state] = [];
    stateMap[p.state].push(p);
  });
  const list = document.getElementById('statesList');
  list.innerHTML = Object.entries(stateMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([state, places]) =>
    `<div class="state-block" onclick="filterByState('${state}')">
      <h3>${state}</h3>
      <p>${places.length} destinations</p>
      <div class="state-places-preview">
        ${places.slice(0,4).map(p=>`<span class="state-place-tag">${p.name.split(' ').slice(0,2).join(' ')}</span>`).join('')}
      </div>
    </div>`
  ).join('');
}

/* ── RENDER GRID ──────────────────────────────────────── */
function renderGrid(targetId, places) {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  if (!places || !places.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🗺️</div><h3>No places found</h3></div>';
    return;
  }
  grid.innerHTML = places.map(p => placeCardHTML(p)).join('');
}

function hasRealImg(p) { return !!(p.img && !p.img.includes('No_Image_Available')); }

function safeUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function mapsSearchUrl(query, lat, lng) {
  if (!query || !lat || !lng) return '';
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lng},13z`;
}

function placeCardHTML(p) {
  const isWishlisted = wishlist.includes(p.placeId);
  return `<div class="place-card" onclick="openPlace(${p.placeId})">
    <div class="card-img-wrap">
      ${hasRealImg(p)
        ? `<img class="card-img" src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="img-placeholder" style="display:${hasRealImg(p)?'none':'flex'}">${p.emoji||'📍'}</div>
      <div class="card-badge">${p.category||'Destination'}</div>
      ${p.featured ? '<div class="card-featured">⭐ Featured</div>' : ''}
    </div>
    <div class="card-body">
      <div class="card-state">${p.state}</div>
      <div class="card-name">${p.name}</div>
      <div class="card-desc">${p.desc||'A beautiful destination in India.'}</div>
      <div class="card-meta">
        ${p.bestTime ? `<span>🗓️ ${p.bestTime}</span>` : ''}
        ${p.difficulty ? `<span>🥾 ${p.difficulty}</span>` : ''}
        ${p.nearestCity ? `<span>🏙️ ${p.nearestCity}</span>` : ''}
      </div>
    </div>
    <div class="card-footer">
      <span class="card-fee">${p.entryFee||'Free'}</span>
      <div class="card-actions">
        <button class="btn-icon ${isWishlisted?'liked':''}" onclick="toggleWishlist(event,${p.placeId})"
          title="${isWishlisted?'Remove from':'Add to'} wishlist">${isWishlisted?'❤️':'🤍'}</button>
        <button class="btn-icon" onclick="openPlace(${p.placeId});event.stopPropagation()" title="View details">→</button>
      </div>
    </div>
  </div>`;
}

/* ── PLACE DETAIL MODAL ──────────────────────────────── */
async function openPlace(placeId) {
  const modal = document.getElementById('placeModal');
  const content = document.getElementById('modalContent');
  modal.classList.add('open');
  content.innerHTML = `<div style="padding:40px;text-align:center;color:#888">Loading…</div>`;
  try {
    const [pRes, hotelRes, restRes, budRes, tipRes] = await Promise.all([
      fetch(`/api/places/${placeId}`),
      fetch(`/api/hotels?placeId=${placeId}`),
      fetch(`/api/restaurants?placeId=${placeId}`),
      fetch(`/api/budgets?placeId=${placeId}`),
      fetch(`/api/tips?placeId=${placeId}`),
    ]);
    const place = await pRes.json();
    const hotels = await hotelRes.json();
    const rests = await restRes.json();
    const budgets = await budRes.json();
    const tips = await tipRes.json();
    const budget = budgets[0] || null;
    const isWishlisted = wishlist.includes(placeId);

    content.innerHTML = `
      ${hasRealImg(place)
        ? `<img class="modal-hero-img" src="${place.img}" alt="${place.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="modal-hero-placeholder" style="${hasRealImg(place)?'display:none':'display:flex'}; background:${place.bg||'linear-gradient(135deg,#667eea,#764ba2)'}">
        <span style="font-size:5rem">${place.emoji||'📍'}</span>
      </div>
      <div class="modal-body">
        <span class="modal-state-badge">${place.state}</span>
        <h2 class="modal-title">${place.name}</h2>
        <div class="modal-quick-info">
          ${place.bestTime?`<div class="mqi">🗓️ <strong>Best Time:</strong> ${place.bestTime}</div>`:''}
          ${place.difficulty?`<div class="mqi">🥾 <strong>Difficulty:</strong> ${place.difficulty}</div>`:''}
          ${place.entryFee?`<div class="mqi">🎟️ <strong>Entry:</strong> ${place.entryFee}</div>`:''}
          ${place.nearestCity?`<div class="mqi">🏙️ <strong>Nearest City:</strong> ${place.nearestCity}</div>`:''}
        </div>
        <p class="modal-desc">${place.desc||''}</p>

        <div class="modal-tabs">
          <button class="modal-tab active" onclick="switchTab(this,'tab-overview')">📋 Overview</button>
          ${budget?`<button class="modal-tab" onclick="switchTab(this,'tab-budget')">💰 Budget</button>`:''}
          <button class="modal-tab" onclick="switchTab(this,'tab-history')">📜 History</button>
          <button class="modal-tab" onclick="switchTab(this,'tab-transport')">🚌 Transport</button>
          <button class="modal-tab" onclick="switchTab(this,'tab-hotels')">🏨 Hotels</button>
          <button class="modal-tab" onclick="switchTab(this,'tab-restaurants')">🍽️ Food</button>
          ${tips.length?`<button class="modal-tab" onclick="switchTab(this,'tab-tips')">💡 Tips</button>`:''}
          <button class="modal-tab" onclick="switchTab(this,'tab-reviews');loadReviews(${placeId})">⭐ Reviews</button>
          <button class="modal-tab" onclick="switchTab(this,'tab-chat');initChat(${placeId})">💬 Chat</button>
        </div>

        <div id="tab-overview" class="modal-tab-content active">
          <p style="color:var(--txt-mid);font-size:.9rem;line-height:1.7">${place.desc||''}</p>
          <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
            ${place.lat && place.lng ? `<a href="https://maps.google.com/?q=${place.lat},${place.lng}" target="_blank" rel="noopener">
              <button class="btn-map">🗺️ View on Google Maps</button></a>` : ''}
          </div>
        </div>

        <div id="tab-history" class="modal-tab-content">
          ${place.history ? `<div style="color:var(--txt-mid);font-size:.92rem;line-height:1.8;white-space:pre-line">${place.history}</div>`
            : `<div class="empty-state" style="padding:30px 20px;text-align:center;"><div class="empty-icon">📜</div><h3>History not available</h3><p>Ask an admin to add the historical background for this place.</p></div>`}
        </div>

        <div id="tab-transport" class="modal-tab-content">
          <div class="info-cards-grid">
            <div class="info-card">
              <h4>� Mendicator</h4>
              <p style="color:var(--txt-mid);font-size:.92rem;line-height:1.6">Open Mindictor for route planning, local transport guidance, and station search.</p>
              <a href="https://mindictor.com" target="_blank" rel="noopener"><button class="btn-primary" style="margin-top:12px;width:100%;font-size:.85rem;padding:10px">📲 Open Mendicator</button></a>
            </div>
            <div class="info-card">
              <h4>📱 Chalo App</h4>
              <p style="color:var(--txt-mid);font-size:.92rem;line-height:1.6">Open Chalo for local bus and train routes, live schedules, tickets, and station locations.</p>
              <a href="https://www.chalo.com" target="_blank" rel="noopener"><button class="btn-primary" style="margin-top:12px;width:100%;font-size:.85rem;padding:10px">📲 Open Chalo</button></a>
            </div>
            <div class="info-card">
              <h4>🎫 IRCTC</h4>
              <p style="color:var(--txt-mid);font-size:.92rem;line-height:1.6">Book both one-way and return train tickets via IRCTC for express travel.</p>
              <a href="https://www.irctc.co.in/nget/train-search" target="_blank" rel="noopener"><button class="btn-primary" style="margin-top:12px;width:100%;font-size:.85rem;padding:10px">📲 Open IRCTC</button></a>
              <a href="https://www.irctc.co.in/nget/train-search" target="_blank" rel="noopener"><button class="btn-outline" style="margin-top:8px;width:100%;font-size:.85rem;padding:10px">🔁 Return Train Ticket</button></a>
            </div>
          </div>
        </div>

        ${budget ? `
        <div id="tab-budget" class="modal-tab-content">
          <table class="budget-table">
            <thead><tr><th>Budget Type</th><th>Cost/Day</th></tr></thead>
            <tbody>
              <tr><td>🏕️ Budget</td><td>₹${budget.budgetMin?.toLocaleString('en-IN')||'N/A'}/day</td></tr>
              <tr><td>🏨 Mid-range</td><td>₹${budget.budgetMid?.toLocaleString('en-IN')||'N/A'}/day</td></tr>
              <tr><td>✨ Luxury</td><td>₹${budget.budgetLux?.toLocaleString('en-IN')||'N/A'}/day</td></tr>
            </tbody>
          </table>
          <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            ${budget.hotel?`<div class="info-card"><h4>🏨 Hotels</h4><p>${budget.hotel}</p></div>`:''}
            ${budget.food?`<div class="info-card"><h4>🍽️ Food</h4><p>${budget.food}</p></div>`:''}
            ${budget.transport?`<div class="info-card"><h4>🚗 Transport</h4><p>${budget.transport}</p></div>`:''}
          </div>
          ${budget.notes?`<div style="margin-top:14px;padding:14px;background:#fff8f0;border-radius:10px;font-size:.85rem;color:var(--txt-mid)">💡 ${budget.notes}</div>`:''}
          ${budget.idealDays?`<p style="margin-top:12px;font-size:.85rem;color:var(--txt-mid)">⏱️ Ideal trip duration: <strong>${budget.idealDays} days</strong></p>`:''}
        </div>` : ''}

        <div id="tab-hotels" class="modal-tab-content">
          ${hotels.length ? `
          <div class="info-cards-grid">
            ${hotels.map(h=>{
              const hotelUrl = safeUrl(h.website);
              return `
              <div class="info-card">
                <div class="stars">${'★'.repeat(h.stars||3)}${'☆'.repeat(5-(h.stars||3))}</div>
                <h4>${h.name}</h4>
                <p><strong>Type:</strong> ${h.type||'Hotel'}</p>
                <p><strong>Price:</strong> ${h.pricePerNight||'Contact'}</p>
                ${h.address?`<p>📍 ${h.address}</p>`:''}
                ${h.phone?`<p>📞 ${h.phone}</p>`:''}
                ${h.amenities?.length?`<p>✅ ${h.amenities.slice(0,3).join(', ')}</p>`:''}
                ${hotelUrl?`<a href="${hotelUrl}" target="_blank" rel="noopener"><button class="btn-primary" style="margin-top:8px;width:100%;font-size:.8rem;padding:9px">🛎️ Book Now</button></a>`:''}
                ${h.mapLink?`<a href="${h.mapLink}" target="_blank" rel="noopener"><button class="btn-map" style="margin-top:8px;width:100%;font-size:.8rem;padding:7px">� View Location</button></a>`:''}
              </div>`;
            }).join('')}
          </div>` : `
          <div class="empty-state" style="padding:40px 20px;text-align:center;">
            <div class="empty-icon">🏨</div>
            <h3>No hotels found yet</h3>
            <p>We don't have hotel listings for this destination yet.</p>
            <p>Try checking back later or open the location in Maps to find local stays.</p>
          </div>`}
        </div>

        <div id="tab-restaurants" class="modal-tab-content">
          ${rests.length ? `
          <div class="info-cards-grid">
            ${rests.map(r=>{
              const restUrl = safeUrl(r.website);
              return `
              <div class="info-card">
                <h4>${r.name}</h4>
                <p><strong>Cuisine:</strong> ${r.cuisine||'Indian'}</p>
                <p><strong>Price:</strong> ${r.priceRange||'₹₹'}</p>
                ${r.rating?`<p class="stars">${'★'.repeat(Math.round(r.rating))} ${r.rating}/5</p>`:''}
                ${r.specialty?`<p>🍽️ ${r.specialty}</p>`:''}
                ${r.timing?`<p>⏰ ${r.timing}</p>`:''}
                ${r.address?`<p>📍 ${r.address}</p>`:''}
                ${restUrl?`<a href="${restUrl}" target="_blank" rel="noopener"><button class="btn-primary" style="margin-top:8px;width:100%;font-size:.8rem;padding:9px">🌐 Visit Website</button></a>`:''}
                ${r.mapLink?`<a href="${r.mapLink}" target="_blank" rel="noopener"><button class="btn-map" style="margin-top:8px;width:100%;font-size:.8rem;padding:7px">📍 View Location</button></a>`:''}
              </div>`;
            }).join('')}
          </div>` : `
          <div class="empty-state" style="padding:40px 20px;text-align:center;">
            <div class="empty-icon">🍽️</div>
            <h3>No restaurants found yet</h3>
            <p>We don't have restaurant listings for this destination yet.</p>
            <p>Try checking back later or search the area in Maps for dining options.</p>
          </div>`}
        </div>

        ${tips.length ? `
        <div id="tab-tips" class="modal-tab-content">
          <div class="tips-list">
            ${tips.map(t=>`
              <div class="tip-item">
                <span class="tip-cat">${t.category||'Tip'}</span>
                <span class="tip-txt">${t.tip}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}

        <div id="tab-reviews" class="modal-tab-content">
          <div id="reviewsContainer" style="max-height:400px;overflow-y:auto">
            <div style="text-align:center;color:#aaa;padding:20px">Loading reviews...</div>
          </div>
          ${currentUser?`
          <div style="margin-top:20px;border-top:1px solid #ddd;padding-top:20px">
            <h4 style="margin:0 0 12px;color:var(--txt-dark)">Leave a Review</h4>
            <div style="display:flex;gap:8px;margin-bottom:12px">
              <label>Rating:</label>
              <select id="reviewRating" style="flex:1;padding:8px;border:1px solid #ccc;border-radius:4px">
                <option>Select...</option>
                <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                <option value="4">⭐⭐⭐⭐ Good</option>
                <option value="3">⭐⭐⭐ Average</option>
                <option value="2">⭐⭐ Poor</option>
                <option value="1">⭐ Bad</option>
              </select>
            </div>
            <textarea id="reviewComment" placeholder="Share your experience..." style="width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;resize:vertical;height:80px"></textarea>
            <button class="btn-primary" style="margin-top:12px;width:100%" onclick="submitReview(${placeId})">Submit Review</button>
          </div>
          `:``}
        </div>

        <div id="tab-chat" class="modal-tab-content">
          <div class="chat-box">
            <div class="chat-date-pick">
              <label style="font-size:.85rem;font-weight:600">Your travel date:</label>
              <input type="date" id="chatDate" min="${new Date().toISOString().split('T')[0]}"/>
              <button class="btn-primary" style="padding:8px 16px;font-size:.85rem" onclick="joinChatRoom(${placeId})">Join Chat</button>
            </div>
            <div class="chat-msgs" id="chatMsgs">
              <div style="text-align:center;color:#aaa;padding:40px;font-size:.85rem">
                Select a travel date and join the chat to connect with fellow travelers!
              </div>
            </div>
            <div class="chat-input-row">
              <input id="chatInput" type="text" placeholder="Type a message..." maxlength="500"
                onkeydown="if(event.key==='Enter')sendChat(${placeId})"/>
              <button class="btn-primary" style="padding:10px 18px;font-size:.85rem" onclick="sendChat(${placeId})">Send</button>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-primary" onclick="toggleWishlist(event,${placeId})" id="wishlistBtn-${placeId}">
            ${isWishlisted ? '❤️ Remove from Wishlist' : '🤍 Add to Wishlist'}
          </button>
          <button class="btn-outline" onclick="addTrip(${placeId}, '${place.name}')">🗓️ Plan Trip</button>
          ${place.lat && place.lng ? `<a href="https://maps.google.com/?q=${place.lat},${place.lng}" target="_blank" rel="noopener">
            <button class="btn-map">🗺️ Open in Maps</button></a>` : ''}
        </div>
      </div>`;
  } catch(e) {
    content.innerHTML = `<div style="padding:40px;text-align:center;color:#e53e3e">Failed to load place details: ${e.message}</div>`;
  }
}

function switchTab(el, tabId) {
  el.closest('.modal-body').querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  el.closest('.modal-body').querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

function closeModal(e) {
  if (e.target === document.getElementById('placeModal')) closeModalBtn();
}
function closeModalBtn() {
  document.getElementById('placeModal').classList.remove('open');
  if (socket && chatRoom) socket.emit('leave_room', chatRoom);
  chatRoom = null; chatPlaceId = null;
}

/* ── WISHLIST ──────────────────────────────────────────── */
async function loadWishlist() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/wishlist', { headers: { Authorization:'Bearer '+authToken } });
    const places = await res.json();
    wishlist = places.map(p => p.placeId);
    renderWishlist(places);
  } catch {}
}

function renderWishlist(places) {
  const el = document.getElementById('wishlistContent');
  if (!el) return;
  if (!places || !places.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💔</div>
      <h3>Your wishlist is empty</h3>
      <p>Explore destinations and add your favourites!</p>
      <button class="btn-primary" style="margin-top:16px" onclick="showPage('explore')">Explore Destinations</button>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="places-grid">${places.map(p => placeCardHTML(p)).join('')}</div>`;
}

async function toggleWishlist(e, placeId) {
  e.stopPropagation();
  if (!authToken) { showAuth(); return; }
  const inList = wishlist.includes(placeId);
  try {
    await fetch(`/api/wishlist/${placeId}`, {
      method: inList ? 'DELETE' : 'POST',
      headers: { Authorization: 'Bearer '+authToken }
    });
    if (inList) { wishlist = wishlist.filter(id => id !== placeId); }
    else { wishlist.push(placeId); }
    // Update button in modal if open
    const btn = document.getElementById(`wishlistBtn-${placeId}`);
    if (btn) btn.textContent = wishlist.includes(placeId) ? '❤️ Remove from Wishlist' : '🤍 Add to Wishlist';
    loadWishlist();
    showToast(inList ? 'Removed from wishlist' : 'Added to wishlist! ❤️', inList ? '' : 'success');
    // Refresh explore grid
    document.querySelectorAll('.place-card').forEach(card => {
      const btn = card.querySelector('.btn-icon');
      if (btn && card.onclick?.toString().includes(`openPlace(${placeId})`)) {
        btn.className = `btn-icon ${wishlist.includes(placeId)?'liked':''}`;
        btn.textContent = wishlist.includes(placeId) ? '❤️' : '🤍';
      }
    });
  } catch { showToast('Action failed', 'error'); }
}

/* ── TRIPS ──────────────────────────────────────────────── */
async function loadTrips() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/trips', { headers: { Authorization:'Bearer '+authToken } });
    trips = await res.json();
    renderTrips();
  } catch {}
}

function renderTrips() {
  const el = document.getElementById('tripsContent');
  if (!el) return;
  if (!trips.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div>
      <h3>No trips planned yet</h3>
      <p>Open any destination and click "Plan Trip" to add it here.</p>
    </div>`;
    return;
  }
  const sorted = [...trips].sort((a,b) => new Date(a.travelDate) - new Date(b.travelDate));
  el.innerHTML = sorted.map(t => {
    const place = allPlaces.find(p => p.placeId === t.placeId);
    return `<div class="trip-card">
      <div class="trip-emoji">${place?.emoji||'📍'}</div>
      <div class="trip-info">
        <h4>${place?.name||'Unknown Place'}</h4>
        <p>${place?.state||''} • ${formatDate(t.travelDate)}</p>
        ${t.notes?`<p style="margin-top:4px;font-size:.8rem;color:var(--txt-lt)">${t.notes}</p>`:''}
      </div>
      <div>
        <button class="btn-icon" onclick="openPlace(${t.placeId})">→</button>
      </div>
    </div>`;
  }).join('');
}

async function addTrip(placeId, placeName) {
  if (!authToken) { showAuth(); return; }
  const date = prompt(`Plan trip to ${placeName}\nEnter travel date (YYYY-MM-DD):`);
  if (!date) return;
  const notes = prompt('Any notes? (optional)') || '';
  try {
    const res = await fetch('/api/trips', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
      body: JSON.stringify({ placeId, travelDate: date, notes })
    });
    if (res.ok) { loadTrips(); showToast('Trip added! 🗓️', 'success'); }
    else showToast('Failed to add trip', 'error');
  } catch { showToast('Network error', 'error'); }
}

/* ── CHAT ──────────────────────────────────────────────── */
function initSocket() {
  if (typeof io === 'undefined') {
    const s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = () => { socket = io(); setupSocketEvents(); };
    document.head.appendChild(s);
    return;
  }
  socket = io();
  setupSocketEvents();
}

function setupSocketEvents() {
  if (!socket) return;
  socket.on('chat_history', msgs => {
    const box = document.getElementById('chatMsgs');
    if (!box) return;
    box.innerHTML = msgs.map(m => chatBubbleHTML(m)).join('');
    box.scrollTop = box.scrollHeight;
  });
  socket.on('receive_message', msg => {
    const box = document.getElementById('chatMsgs');
    if (!box) return;
    box.innerHTML += chatBubbleHTML(msg);
    box.scrollTop = box.scrollHeight;
  });
  socket.on('system_msg', msg => {
    const box = document.getElementById('chatMsgs');
    if (box) box.innerHTML += `<div style="text-align:center;font-size:.75rem;color:#aaa;padding:4px">${msg}</div>`;
  });
  socket.on('room_users', count => {
    const el = document.getElementById('chatRoomInfo');
    if (el) el.textContent = `${count} traveler${count>1?'s':''} in this room`;
  });
}

function initChat(placeId) { chatPlaceId = placeId; }

function joinChatRoom(placeId) {
  const date = document.getElementById('chatDate')?.value;
  if (!date) { showToast('Please select a travel date', 'error'); return; }
  if (!socket) { showToast('Chat connecting…', ''); return; }
  const username = currentUser?.name || 'Traveler_'+Math.floor(Math.random()*999);
  const room = `${placeId}_${date}`;
  if (chatRoom) socket.emit('leave_room', chatRoom);
  chatRoom = room;
  socket.emit('join_room', { room, username, userId: currentUser?.id, placeId, travelDate: date });
  document.getElementById('chatMsgs').innerHTML = '';
  // Show room info
  const datePick = document.querySelector('.chat-date-pick');
  let infoEl = document.getElementById('chatRoomInfo');
  if (!infoEl) {
    infoEl = document.createElement('span');
    infoEl.id = 'chatRoomInfo';
    infoEl.style.cssText = 'font-size:.78rem;color:var(--saffron);font-weight:600;margin-left:auto';
    datePick.appendChild(infoEl);
  }
  infoEl.textContent = 'Joining…';
}

function sendChat(placeId) {
  const inp = document.getElementById('chatInput');
  const text = inp?.value?.trim();
  const date = document.getElementById('chatDate')?.value;
  if (!text || !socket) return;
  if (!chatRoom) { showToast('Join the room first!', 'error'); return; }
  socket.emit('send_message', {
    room: chatRoom, placeId,
    username: currentUser?.name || 'Traveler',
    text, userId: currentUser?.id, travelDate: date
  });
  inp.value = '';
}

function chatBubbleHTML(m) {
  const isOwn = currentUser && (m.username === currentUser.name);
  return `<div class="chat-msg ${isOwn?'own':''}">
    <div class="chat-bubble">${escHtml(m.text)}</div>
    <div class="chat-meta">${m.username} • ${m.time||formatTime(m.createdAt)}</div>
  </div>`;
}

/* ── HERO SEARCH ──────────────────────────────────────── */
let heroSearchTimer;
function heroSearchFn() {
  clearTimeout(heroSearchTimer);
  heroSearchTimer = setTimeout(async () => {
    const q = document.getElementById('heroSearch').value.trim().toLowerCase();
    const sug = document.getElementById('heroSuggestions');
    if (!q || q.length < 2) { sug.innerHTML = ''; return; }
    await loadAllPlaces();
    const results = allPlaces.filter(p =>
      p.name.toLowerCase().includes(q) || p.state.toLowerCase().includes(q)
    ).slice(0, 6);
    sug.innerHTML = results.map(p =>
      `<div class="hero-sug-item" onclick="openPlace(${p.placeId});document.getElementById('heroSuggestions').innerHTML=''">
        <span style="font-size:1.3rem">${p.emoji||'📍'}</span>
        <div>
          <strong>${p.name}</strong>
          <div style="font-size:.75rem;color:#aaa">${p.state} • ${p.category}</div>
        </div>
      </div>`
    ).join('');
  }, 250);
}

function doHeroSearch() {
  const q = document.getElementById('heroSearch').value.trim();
  if (!q) return;
  showPage('explore');
  document.getElementById('exploreSearch').value = q;
  filterPlaces();
}

/* ── NAVIGATION ──────────────────────────────────────── */
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  document.querySelectorAll('.nav-a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  window.scrollTo(0, 0);
  document.getElementById('navLinks').classList.remove('open');
  if (page === 'wishlist' && authToken) loadWishlist();
  if (page === 'trips' && authToken) loadTrips();
  if (page === 'wishlist' && !authToken) {
    document.getElementById('wishlistContent').innerHTML =
      `<div class="empty-state"><div class="empty-icon">🔐</div>
      <h3>Login to see your wishlist</h3>
      <button class="btn-primary" style="margin-top:16px" onclick="showAuth()">Login</button></div>`;
  }
  if (page === 'trips' && !authToken) {
    document.getElementById('tripsContent').innerHTML =
      `<div class="empty-state"><div class="empty-icon">🔐</div>
      <h3>Login to manage trips</h3>
      <button class="btn-primary" style="margin-top:16px" onclick="showAuth()">Login</button></div>`;
  }
  if (page === 'hotels') loadAllHotels();
  if (page === 'restaurants') loadAllRestaurants();
}

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

function scrollNavEffect() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 50);
  });
}

function scrollToFeatured() {
  document.getElementById('featuredSection')?.scrollIntoView({ behavior:'smooth' });
}

/* ── UTILS ──────────────────────────────────────────────── */
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' '+type : '') + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

function showFormErr(el, msg) {
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}

/* ── HOTELS BROWSING ─────────────────────────────────────── */
async function loadAllHotels() {
  try {
    const res = await fetch('/api/all-hotels?limit=500');
    const data = await res.json();
    allHotels = data.hotels || [];
    filteredHotels = [...allHotels];
    populateHotelFilters();
    renderHotels();
  } catch (e) { console.error('Load hotels failed:', e); }
}

function populateHotelFilters() {
  const stateSelect = document.getElementById('hotelState');
  const states = [...new Set(allHotels.map(h => h.state).filter(s => s))].sort();
  states.forEach(s => {
    if (!stateSelect.querySelector(`option[value="${s}"]`)) {
      stateSelect.innerHTML += `<option value="${s}">${s}</option>`;
    }
  });
}

function onHotelStateChange() {
  const state = document.getElementById('hotelState').value;
  const citySelect = document.getElementById('hotelCity');
  citySelect.innerHTML = '<option value="">All Cities</option>';
  if (state) {
    const cities = [...new Set(allHotels.filter(h => h.state === state).map(h => h.city).filter(c => c))].sort();
    cities.forEach(c => {
      citySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }
  filterHotels();
}

function filterHotels() {
  const search = (document.getElementById('hotelSearch')?.value || '').toLowerCase();
  const state = document.getElementById('hotelState')?.value || '';
  const city = document.getElementById('hotelCity')?.value || '';
  const stars = document.getElementById('hotelStars')?.value || '';

  filteredHotels = allHotels.filter(h => {
    const matchSearch = !search || h.name.toLowerCase().includes(search) || (h.specialty || '').toLowerCase().includes(search);
    const matchState = !state || h.state === state;
    const matchCity = !city || h.city === city;
    const matchStars = !stars || h.stars === +stars;
    return matchSearch && matchState && matchCity && matchStars;
  });
  hotelOffset = 0;
  renderHotels();
}

function clearHotelFilters() {
  document.getElementById('hotelSearch').value = '';
  document.getElementById('hotelState').value = '';
  document.getElementById('hotelCity').innerHTML = '<option value="">All Cities</option>';
  document.getElementById('hotelStars').value = '';
  filterHotels();
}

function renderHotels() {
  const grid = document.getElementById('hotelsGrid');
  const info = document.getElementById('hotelsInfo');
  info.textContent = `Showing ${Math.min(filteredHotels.length, BATCH)} of ${filteredHotels.length} hotels`;
  const batch = filteredHotels.slice(0, BATCH);
  hotelOffset = batch.length;
  grid.innerHTML = batch.length ? batch.map(h => hotelCardHTML(h)).join('') :
    '<div class="empty-state"><div class="empty-icon">🏨</div><h3>No hotels found</h3><p>Try different filters</p></div>';
  document.getElementById('hotelsLoadMoreWrap').style.display = filteredHotels.length > BATCH ? 'block' : 'none';
}

function loadMoreHotels() {
  const grid = document.getElementById('hotelsGrid');
  const next = filteredHotels.slice(hotelOffset, hotelOffset + BATCH);
  next.forEach(h => { grid.innerHTML += hotelCardHTML(h); });
  hotelOffset += next.length;
  document.getElementById('hotelsInfo').textContent = `Showing ${hotelOffset} of ${filteredHotels.length} hotels`;
  if (hotelOffset >= filteredHotels.length) document.getElementById('hotelsLoadMoreWrap').style.display = 'none';
}

function hotelCardHTML(h) {
  const website = safeUrl(h.website);
  return `<div class="place-card">
    <div class="card-img-wrap">
      <img class="card-img" src="https://via.placeholder.com/300x200?text=${encodeURIComponent(h.name)}" alt="${h.name}" loading="lazy" style="object-fit:cover"/>
      <div class="card-badge">${h.type || 'Hotel'}</div>
    </div>
    <div class="card-body">
      <div class="card-state">${h.state || 'India'}</div>
      <div class="card-name">${h.name}</div>
      <div class="card-desc">📍 ${h.city || 'Various'} • ${h.address || ''}</div>
      <div class="card-meta">
        <span>⭐ ${h.stars || 0} stars</span>
        <span>💰 ${h.pricePerNight || 'Contact'}</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-fee">${h.pricePerNight || 'Call'}</span>
      <div class="card-actions">
        ${website ? `<a href="${website}" target="_blank" rel="noopener"><button class="btn-icon" title="Visit website">🌐</button></a>` : ''}
        ${h.mapLink ? `<a href="${h.mapLink}" target="_blank" rel="noopener"><button class="btn-icon" title="View location">📍</button></a>` : ''}
      </div>
    </div>
  </div>`;
}

/* ── RESTAURANTS BROWSING ────────────────────────────────── */
async function loadAllRestaurants() {
  try {
    const res = await fetch('/api/all-restaurants?limit=500');
    const data = await res.json();
    allRestaurants = data.restaurants || [];
    filteredRestaurants = [...allRestaurants];
    populateRestFilters();
    renderRestaurants();
  } catch (e) { console.error('Load restaurants failed:', e); }
}

function populateRestFilters() {
  const stateSelect = document.getElementById('restState');
  const states = [...new Set(allRestaurants.map(r => r.state).filter(s => s))].sort();
  states.forEach(s => {
    if (!stateSelect.querySelector(`option[value="${s}"]`)) {
      stateSelect.innerHTML += `<option value="${s}">${s}</option>`;
    }
  });
}

function onRestStateChange() {
  const state = document.getElementById('restState').value;
  const citySelect = document.getElementById('restCity');
  citySelect.innerHTML = '<option value="">All Cities</option>';
  if (state) {
    const cities = [...new Set(allRestaurants.filter(r => r.state === state).map(r => r.city).filter(c => c))].sort();
    cities.forEach(c => {
      citySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }
  filterRestaurants();
}

function filterRestaurants() {
  const search = (document.getElementById('restSearch')?.value || '').toLowerCase();
  const state = document.getElementById('restState')?.value || '';
  const city = document.getElementById('restCity')?.value || '';
  const cuisine = document.getElementById('restCuisine')?.value || '';

  filteredRestaurants = allRestaurants.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search) || (r.cuisine || '').toLowerCase().includes(search);
    const matchState = !state || r.state === state;
    const matchCity = !city || r.city === city;
    const matchCuisine = !cuisine || (r.cuisine || '').toLowerCase().includes(cuisine.toLowerCase());
    return matchSearch && matchState && matchCity && matchCuisine;
  });
  restOffset = 0;
  renderRestaurants();
}

function clearRestFilters() {
  document.getElementById('restSearch').value = '';
  document.getElementById('restState').value = '';
  document.getElementById('restCity').innerHTML = '<option value="">All Cities</option>';
  document.getElementById('restCuisine').value = '';
  filterRestaurants();
}

function renderRestaurants() {
  const grid = document.getElementById('restsGrid');
  const info = document.getElementById('restsInfo');
  info.textContent = `Showing ${Math.min(filteredRestaurants.length, BATCH)} of ${filteredRestaurants.length} restaurants`;
  const batch = filteredRestaurants.slice(0, BATCH);
  restOffset = batch.length;
  grid.innerHTML = batch.length ? batch.map(r => restaurantCardHTML(r)).join('') :
    '<div class="empty-state"><div class="empty-icon">🍽️</div><h3>No restaurants found</h3><p>Try different filters</p></div>';
  document.getElementById('restsLoadMoreWrap').style.display = filteredRestaurants.length > BATCH ? 'block' : 'none';
}

function loadMoreRestaurants() {
  const grid = document.getElementById('restsGrid');
  const next = filteredRestaurants.slice(restOffset, restOffset + BATCH);
  next.forEach(r => { grid.innerHTML += restaurantCardHTML(r); });
  restOffset += next.length;
  document.getElementById('restsInfo').textContent = `Showing ${restOffset} of ${filteredRestaurants.length} restaurants`;
  if (restOffset >= filteredRestaurants.length) document.getElementById('restsLoadMoreWrap').style.display = 'none';
}

function restaurantCardHTML(r) {
  const website = safeUrl(r.website);
  return `<div class="place-card">
    <div class="card-img-wrap">
      <img class="card-img" src="https://via.placeholder.com/300x200?text=${encodeURIComponent(r.name)}" alt="${r.name}" loading="lazy" style="object-fit:cover"/>
      <div class="card-badge">${r.cuisine || 'Restaurant'}</div>
    </div>
    <div class="card-body">
      <div class="card-state">${r.state || 'India'}</div>
      <div class="card-name">${r.name}</div>
      <div class="card-desc">📍 ${r.city || 'Various'} • ${r.address || ''}</div>
      <div class="card-meta">
        <span>${'★'.repeat(Math.round(r.rating || 0))}${'☆'.repeat(5-Math.round(r.rating || 0))} ${r.rating || 'N/A'}/5</span>
        <span>💰 ${r.priceRange || '₹₹'}</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-fee">${r.priceRange || 'Contact'}</span>
      <div class="card-actions">
        ${website ? `<a href="${website}" target="_blank" rel="noopener"><button class="btn-icon" title="Visit website">🌐</button></a>` : ''}
        ${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener"><button class="btn-icon" title="View location">📍</button></a>` : ''}
      </div>
    </div>
  </div>`;
}

/* ── QUICK NAVIGATOR (visible UI) ───────────────────────── */
async function showQuickNavigator() {
  await loadMeta(); await loadAllPlaces();
  const modal = document.getElementById('quickNavModal');
  const stateSel = document.getElementById('quick-state');
  const placeInp = document.getElementById('quick-place');
  const sugg = document.getElementById('quick-suggestions');
  stateSel.innerHTML = '<option value="">Select state</option>' + allStates.map(s=>`<option value="${s}">${s}</option>`).join('');
  placeInp.value = '';
  sugg.innerHTML = '';
  stateSel.onchange = onQuickStateChange;
  placeInp.oninput = onQuickPlaceInput;
  modal.style.display = 'flex';
  setTimeout(()=>modal.classList.add('open'),10);
  placeInp.focus();
}

function hideQuickNavigator() {
  const modal = document.getElementById('quickNavModal');
  if (!modal) return; modal.classList.remove('open');
  setTimeout(()=>modal.style.display='none',180);
}

function onQuickStateChange(e) {
  const state = e.target.value;
  const sugg = document.getElementById('quick-suggestions');
  sugg.innerHTML = '';
  if (!state) return;
  const list = allPlaces.filter(p => (p.state||'').toLowerCase() === state.toLowerCase())
    .slice(0,200).sort((a,b)=>a.name.localeCompare(b.name));
  if (!list.length) { sugg.innerHTML = '<div class="empty-state">No places for this state</div>'; return; }
  sugg.innerHTML = list.slice(0,20).map(p=>`<div class="quick-sug-item" data-id="${p.placeId}" onclick="selectQuickSuggestion(this)" style="padding:8px;border-bottom:1px solid #f4f4f4;cursor:pointer">${p.name} <small style="color:#999">• ${p.category||''}</small></div>`).join('');
}

function onQuickPlaceInput(e) {
  const q = (e.target.value||'').trim().toLowerCase();
  const state = document.getElementById('quick-state').value;
  const sugg = document.getElementById('quick-suggestions');
  if (!q) { if (state) onQuickStateChange({ target: { value: state } }); else sugg.innerHTML=''; return; }
  const candidates = allPlaces.filter(p => {
    if (state && p.state.toLowerCase() !== state.toLowerCase()) return false;
    return (p.name||'').toLowerCase().includes(q) || (p.city||'').toLowerCase().includes(q);
  }).slice(0,40);
  if (!candidates.length) { sugg.innerHTML = '<div class="empty-state">No matches</div>'; return; }
  sugg.innerHTML = candidates.map(p=>`<div class="quick-sug-item" data-id="${p.placeId}" onclick="selectQuickSuggestion(this)" style="padding:8px;border-bottom:1px solid #f4f4f4;cursor:pointer">${p.name} <small style="color:#999">• ${p.state}</small></div>`).join('');
}

function selectQuickSuggestion(el) {
  const id = +el.dataset.id;
  if (!id) return;
  openPlace(id);
  hideQuickNavigator();
}

function quickNavOpenSelected() {
  const sugg = document.getElementById('quick-suggestions');
  const first = sugg.querySelector('.quick-sug-item');
  if (first) { selectQuickSuggestion(first); return; }
  const state = document.getElementById('quick-state').value;
  const q = (document.getElementById('quick-place').value||'').trim().toLowerCase();
  if (!state || !q) { showToast('Select state and enter place name', 'error'); return; }
  const match = allPlaces.find(p => p.state.toLowerCase()===state.toLowerCase() && p.name.toLowerCase().includes(q));
  if (!match) { showToast('No matching place found', 'error'); return; }
  openPlace(match.placeId); hideQuickNavigator();
}

/* ── PACKING LIST GENERATOR ────────────────────────────── */
const packingLists = {
  beach: ['Sunscreen (SPF 50+)', 'Swimsuit(s)', 'Flip flops/sandals', 'Light cotton clothes', 'Hat/cap', 'Sunglasses', 'Waterproof bag', 'Towel', 'Lightweight scarf', 'After-sun lotion'],
  mountain: ['Warm jacket', 'Thermal innerwear', 'Hiking boots', 'Woolen socks', 'Cap/beanie', 'Gloves', 'Water bottle', 'Backpack (40-50L)', 'Rain jacket', 'First aid kit'],
  city: ['Comfortable walking shoes', 'Smart casual outfits', 'Power bank', 'Light daypack', 'Medications', 'Phone charger', 'Camera', 'Umbrella', 'Wallet & documents', 'Toiletries bag'],
  desert: ['Light, loose clothing', 'High SPF sunscreen', 'Hat/scarf for sun', 'Sunglasses', 'Water bottle (large)', 'Lip balm', 'Moisturizer', 'Closed-toe shoes', 'Lightweight jacket for evening', 'Torch/flashlight'],
};

function showPackingList() {
  document.getElementById('packingModal').style.display = 'flex';
  document.getElementById('packingChecklist').innerHTML = '';
}

function generatePackingList(type) {
  const list = packingLists[type] || packingLists.city;
  const html = `<div><h4 style="margin:0 0 12px;color:var(--txt-dark)">${type.toUpperCase()} Packing List</h4>` +
    list.map((item, i) => `<div style="display:flex;align-items:center;margin:8px 0;cursor:pointer" onclick="this.style.opacity='0.5'">
      <input type="checkbox" id="pack-${i}" style="margin-right:10px;cursor:pointer"/>
      <label for="pack-${i}" style="margin:0;cursor:pointer">${item}</label>
    </div>`).join('') + '</div>';
  document.getElementById('packingChecklist').innerHTML = html;
}

/* ── CURRENCY CONVERTER ───────────────────────────────── */
const exchangeRates = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 };

function showCurrencyConverter() {
  document.getElementById('currencyModal').style.display = 'flex';
  document.getElementById('currencyAmount').value = '1';
  document.getElementById('currencyFrom').value = 'INR';
  document.getElementById('currencyTo').value = 'USD';
  convertCurrency();
}

function convertCurrency() {
  const amount = +document.getElementById('currencyAmount').value || 1;
  const from = document.getElementById('currencyFrom').value;
  const to = document.getElementById('currencyTo').value;
  const rateFrom = exchangeRates[from] || 1;
  const rateTo = exchangeRates[to] || 1;
  const result = (amount / rateFrom) * rateTo;
  document.getElementById('currencyResult').value = result.toFixed(2);
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  document.getElementById('exchangeRateInfo').textContent = `1 ${from} = ${(rateTo / rateFrom).toFixed(4)} ${to}`;
}

/* ── REVIEWS & RATINGS ────────────────────────────────── */
async function loadReviews(placeId) {
  try {
    const response = await fetch(`/api/reviews?placeId=${placeId}`);
    const data = await response.json();
    let html = `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="font-size:2rem;font-weight:bold;color:var(--primary)">${data.avgRating}</div>
        <div>
          <div>${'⭐'.repeat(Math.round(data.avgRating))} (${data.totalReviews} reviews)</div>
          <small style="color:#999">Based on traveler ratings</small>
        </div>
      </div>
    </div>`;
    if (data.reviews.length === 0) {
      html += '<div style="text-align:center;color:#999;padding:20px">No reviews yet. Be the first to review!</div>';
    } else {
      html += data.reviews.map(r => `
        <div style="border-bottom:1px solid #f0f0f0;padding:12px 0;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <strong>${r.username}</strong>
            <span style="color:#f59e0b">${'⭐'.repeat(r.rating)}</span>
          </div>
          <small style="color:#999">${new Date(r.createdAt).toLocaleDateString()}</small>
          ${r.comment ? `<p style="margin:8px 0 0 0;color:var(--txt-mid);font-size:.9rem">${r.comment}</p>` : ''}
        </div>
      `).join('');
    }
    document.getElementById('reviewsContainer').innerHTML = html;
  } catch (e) { console.error('Failed to load reviews', e); }
}

async function submitReview(placeId) {
  const rating = +document.getElementById('reviewRating').value;
  const comment = document.getElementById('reviewComment').value.trim();
  if (!rating) { showToast('Please select a rating', 'error'); return; }
  if (!currentUser) { showToast('Please log in to leave a review', 'error'); return; }
  try {
    const response = await fetch('/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ placeId, rating, comment })
    });
    if (!response.ok) throw new Error(await response.text());
    showToast('Review submitted successfully!', 'success');
    document.getElementById('reviewRating').value = '';
    document.getElementById('reviewComment').value = '';
    loadReviews(placeId);
  } catch (e) { showToast('Error submitting review: ' + e.message, 'error'); }
}

// Backwards-compatible wrapper used by feature cards
function askStateAndPlace() { showQuickNavigator(); }
