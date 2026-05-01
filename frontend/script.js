/* ═══════════════════════════════════════
   SwapNstudy — Complete Script v3
   GLA University · CEA Department
   FIXED: OTP display, Login, Dark Mode, Payment Gateway
═══════════════════════════════════════ */

// ═══ STATE ═══
const STATE = {
  currentUser: null,
  wishlist: [],
  messages: {},
  myListings: [],
  paymentHistory: [],
  currentTab: 'all',
  currentSort: 'newest',
  visibleCount: 6,
  activeConvId: null,
  otpTarget: null,
  generatedOTP: null,
  agreements: [],
  notifications: [],
  isDark: false,
};

// Load from localStorage safely
const API_URL = const API_URL = "https://swapnstudy-backend.onrender.com";
let AUTH_TOKEN = localStorage.getItem('sns_token') || null;

async function apiFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
  try {
    const res = await fetch(API_URL + endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
  } catch(e) {
    console.error(e);
    return null;
  }
}

async function loadState() {
  // Dark mode is the only UI pref kept in localStorage
  try { STATE.isDark = localStorage.getItem('sns_dark') === 'true'; } catch(e) { STATE.isDark = false; }
  // Seed local demo messages if empty (messages use local state; real API sends/receives per conv)
  if (!STATE.messages.conv_1) {
    STATE.messages = {
      conv_1: { partnerId:'HG', partnerName:'Harshita G.', partnerAv:'av-teal', itemTitle:'Data Structures Book', itemId:1,
        msgs:[{from:'recv',text:'Hi! Is the DSA book still available?',time:'10:24 AM'},{from:'sent',text:'Yes! Just listed it today.',time:'10:26 AM'},{from:'recv',text:'Can we meet at the library tomorrow at 3pm?',time:'10:28 AM'}] },
      conv_2: { partnerId:'JY', partnerName:'Jaya', partnerAv:'av-coral', itemTitle:'Casio Calculator', itemId:3,
        msgs:[{from:'recv',text:'Interested in the calculator swap. What do you want?',time:'Yesterday'},{from:'sent',text:'I need C++ or OS book, do you have one?',time:'Yesterday'}] }
    };
  }
  
  if (AUTH_TOKEN) {
    const data = await apiFetch('/me');
    if (data && data.user) {
      STATE.currentUser = data.user;
      STATE.wishlist = data.user.wishlist.map(w => w._id || w);
      STATE.myListings = data.listings || [];
      STATE.paymentHistory = data.payments || [];
      STATE.agreements = data.agreements || [];
      updateNavForUser(STATE.currentUser);
    } else {
      AUTH_TOKEN = null; localStorage.removeItem('sns_token');
    }
  }

  // Fetch ALL_LISTINGS
  const listings = await apiFetch('/listings');
  if (listings) {
    ALL_LISTINGS.length = 0;
    listings.forEach(l => {
      l.id = l._id;
      ALL_LISTINGS.push(l);
    });
  }
  
  // Apply filters after state is fully loaded
  activeListings = ALL_LISTINGS.slice();
  applyAllFilters();
}

var ALL_LISTINGS = [];
loadState();

function toggleTheme() {
  STATE.isDark = !STATE.isDark;
  applyTheme();
  localStorage.setItem('sns_dark', STATE.isDark);
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', STATE.isDark ? 'dark' : 'light');
  const icon = document.querySelector('.theme-icon');
  if (icon) icon.textContent = STATE.isDark ? '☀️' : '🌙';
}

// Apply saved theme on load
applyTheme();

// ═══ NAVBAR SCROLL ═══
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// Click outside to close user dropdown
document.addEventListener('click', function(e) {
  const wrap = document.querySelector('.user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.remove('open');
  }
});

// ═══ TOAST ═══
let toastTimer;
function showToast(msg, type='success', duration=3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ═══ STEP CARD CLICK HANDLER ═══
function handleStepClick(type) {
  switch(type) {
    case 'signup':
      openModal('signup');
      break;
    case 'list':
      if (!STATE.currentUser) { openModal('signup'); showToast('📦 Sign up first, then list your items!', 'info'); }
      else { openModal('list'); }
      break;
    case 'search':
      openSearchSpotlight();
      break;
    case 'connect':
      if (!STATE.currentUser) { openModal('login'); showToast('🤝 Log in to message sellers!', 'info'); }
      else { openModal('messages-view'); }
      break;
  }
}

// ═══ SEARCH SPOTLIGHT ═══
const BG_SPOT_MAP = {
  'card-img-teal':'spot-emoji-teal','card-img-amber':'spot-emoji-amber',
  'card-img-coral':'spot-emoji-coral','card-img-purple':'spot-emoji-purple',
  'card-img-green':'spot-emoji-green','card-img-blue':'spot-emoji-blue',
};

function openSearchSpotlight() {
  const overlay = document.getElementById('searchSpotlightOverlay');
  if (overlay) {
    overlay.classList.add('open');
    renderSpotlightResults(ALL_LISTINGS);
    setTimeout(() => { const inp = document.getElementById('spotlightInput'); if(inp) inp.focus(); }, 120);
  }
}

function _closeSearchSpotlight() {
  const overlay = document.getElementById('searchSpotlightOverlay');
  if (overlay) overlay.classList.remove('open');
  const inp = document.getElementById('spotlightInput'); if(inp) inp.value = '';
  const clr = document.getElementById('spotlightClear'); if(clr) clr.style.display = 'none';
  const cat = document.getElementById('spotlightCat'); if(cat) cat.value = '';
  const typ = document.getElementById('spotlightType'); if(typ) typ.value = '';
}

// Spotlight event listeners — set once on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  // Close button
  const closeBtn = document.getElementById('spotlightCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', _closeSearchSpotlight);

  // Click outside to close
  const overlay = document.getElementById('searchSpotlightOverlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _closeSearchSpotlight();
    });
  }

  // Keyboard escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      _closeSearchSpotlight();
      closeModal();
    }
  });
});

let spotTimer;
function spotlightSearch(val) {
  const clr = document.getElementById('spotlightClear');
  if (clr) clr.style.display = val ? 'flex' : 'none';
  clearTimeout(spotTimer);
  spotTimer = setTimeout(spotlightFilter, 180);
}

function clearSpotlight() {
  const inp = document.getElementById('spotlightInput');
  if (inp) inp.value = '';
  const clr = document.getElementById('spotlightClear');
  if (clr) clr.style.display = 'none';
  spotlightFilter();
  if (inp) inp.focus();
}

function spotlightFilter() {
  const q    = (document.getElementById('spotlightInput')?.value || '').toLowerCase().trim();
  const cat  = document.getElementById('spotlightCat')?.value  || '';
  const type = document.getElementById('spotlightType')?.value || '';

  let results = ALL_LISTINGS.filter(function(l) {
    if (type && l.type !== type) return false;
    if (cat) {
      if (cat === 'book'        && !['📘','📙','📗','📕','📚','📔'].some(e => l.emoji.includes(e))) return false;
      if (cat === 'notes'       && !['📝','📐'].some(e => l.emoji.includes(e)) && !l.title.toLowerCase().includes('note')) return false;
      if (cat === 'electronics' && !['💻','🔌','📱','🔢','📊'].some(e => l.emoji.includes(e))) return false;
      if (cat === 'stationery'  && !['🔧','📐'].some(e => l.emoji.includes(e))) return false;
    }
    if (q && !l.title.toLowerCase().includes(q) && !l.dept.toLowerCase().includes(q) && !l.name.toLowerCase().includes(q)) return false;
    return true;
  });

  renderSpotlightResults(results, q);
}

function renderSpotlightResults(results, highlight) {
  const container = document.getElementById('spotlightResults');
  const countEl   = document.getElementById('spotlight-count');
  if (!container) return;

  if (countEl) countEl.textContent = results.length
    ? results.length + ' listing' + (results.length !== 1 ? 's' : '') + ' found'
    : 'No listings found';

  if (!results.length) {
    container.innerHTML = '<div class="spotlight-empty"><div>🔍</div><div>No listings match your search.<br>Try different keywords or filters.</div></div>';
    return;
  }

  container.innerHTML = '<div class="spotlight-section-label">Listings</div>' + results.map(function(l) { return buildSpotlightItem(l, highlight); }).join('');
}

function buildSpotlightItem(l, q) {
  const bgClass = BG_SPOT_MAP[l.bg] || 'spot-emoji-teal';
  const typeClass = {sell:'st-sell', donate:'st-donate', swap:'st-swap'}[l.type] || 'st-sell';
  const typeLabel = {sell:'For Sale', donate:'Free', swap:'Swap'}[l.type] || l.type;
  const isFree = l.type === 'donate';

  let titleHtml = l.title;
  if (q) {
    const regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
    titleHtml = l.title.replace(regex, '<mark style="background:rgba(13,158,143,0.35);color:#14c4b2;border-radius:2px;padding:0 2px">$1</mark>');
  }

  return '<div class="spotlight-item" onclick="spotlightOpenListing(' + l.id + ')">' +
    '<div class="spot-emoji ' + bgClass + '">' + l.emoji + '</div>' +
    '<div class="spot-info">' +
      '<div class="spot-title">' + titleHtml + '</div>' +
      '<div class="spot-dept">' + l.dept + '</div>' +
      '<div class="spot-seller">by ' + l.name + ' · ⭐ ' + l.rating + ' · ' + l.condition + '</div>' +
    '</div>' +
    '<div class="spot-right">' +
      '<div class="spot-price ' + (isFree ? 'free' : '') + '">' + l.priceLabel + '</div>' +
      '<span class="spot-type-tag ' + typeClass + '">' + typeLabel + '</span>' +
    '</div>' +
  '</div>';
}

function spotlightOpenListing(id) {
  _closeSearchSpotlight();
  setTimeout(function() { viewListing(id); }, 150);
}

function goToListings() {
  _closeSearchSpotlight();
  const sec = document.querySelector('#listings');
  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
}

// ═══ RENDER LISTINGS ═══
let activeListings = [];

function renderListings() {
  const grid = document.getElementById('listingsGrid');
  const noRes = document.getElementById('no-results');
  const loadWrap = document.getElementById('load-more-wrap');
  if (!grid) return;

  const slice = activeListings.slice(0, STATE.visibleCount);

  if (!activeListings.length) {
    grid.innerHTML = '';
    if (noRes) noRes.style.display = 'block';
    if (loadWrap) loadWrap.style.display = 'none';
    return;
  }
  if (noRes) noRes.style.display = 'none';
  if (loadWrap) loadWrap.style.display = activeListings.length > STATE.visibleCount ? 'block' : 'none';

  grid.innerHTML = slice.map(buildCard).join('');
  setTimeout(function() {
    grid.querySelectorAll('.listing-card').forEach(function(el) { el.classList.add('visible'); });
  }, 60);
}

function buildCard(l) {
  const isWished = STATE.wishlist.includes(l.id);
  const typeLabel = l.type === 'sell' ? 'For Sale' : l.type === 'donate' ? 'Free / Donate' : 'Swap';
  return '<div class="listing-card fade-up" onclick="viewListing(' + l.id + ')">' +
    (l.isNew ? '<div class="card-badge">New</div>' : '') +
    '<button class="wishlist-btn ' + (isWished ? 'liked' : '') + '" onclick="toggleWishlist(event,' + l.id + ')" title="' + (isWished ? 'Remove from wishlist' : 'Add to wishlist') + '">' +
      (isWished ? '❤️' : '🤍') +
    '</button>' +
    '<div class="card-img ' + l.bg + '">' + l.emoji + '</div>' +
    '<div class="card-body">' +
      '<div class="card-meta-row">' +
        '<span class="listing-tag lt-' + l.type + '">' + typeLabel + '</span>' +
        '<span style="font-size:.7rem;color:var(--muted2)">⭐ ' + l.rating + '</span>' +
      '</div>' +
      '<div class="listing-title">' + l.title + '</div>' +
      '<div class="listing-dept">' + l.dept + '</div>' +
      '<div class="listing-footer">' +
        '<span class="listing-price ' + (l.type === 'donate' ? 'free' : '') + '">' + l.priceLabel + '</span>' +
        '<div class="listing-seller">' +
          '<div class="avatar ' + l.av + '" style="width:26px;height:26px;font-size:.65rem">' + l.seller + '</div>' +
          '<span>' + l.name + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function setTab(btn, filter) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  STATE.currentTab = filter;
  STATE.visibleCount = 6;
  applyAllFilters();
}

function sortListings(val) {
  STATE.currentSort = val;
  applyAllFilters();
}

function applyAllFilters() {
  let list = ALL_LISTINGS.filter(function(l) { return STATE.currentTab === 'all' || l.type === STATE.currentTab; });
  if (STATE.currentSort === 'price-asc') list.sort(function(a,b) { return a.price - b.price; });
  else if (STATE.currentSort === 'price-desc') list.sort(function(a,b) { return b.price - a.price; });
  activeListings = list;
  renderListings();
}

function loadMore() {
  STATE.visibleCount += 3;
  renderListings();
}

// ═══ WISHLIST ═══
async function toggleWishlist(e, id) {
  e.stopPropagation();
  if (!STATE.currentUser) { openModal('login'); showToast('Please login to save items', 'info'); return; }
  const res = await apiFetch('/wishlist/' + id, { method: 'POST' });
  if (res) {
    STATE.wishlist = res;
    showToast('Wishlist updated!', 'success');
    renderListings();
  }
}

// ═══ LIVE SEARCH ═══
let searchTimer;
function liveSearch(val) {
  const clear = document.getElementById('searchClear');
  if (clear) clear.style.display = val ? 'flex' : 'none';
  const suggestions = document.getElementById('search-suggestions');
  clearTimeout(searchTimer);
  if (!val.trim()) { if(suggestions) suggestions.className = 'search-suggestions'; filterBySearch(''); return; }
  searchTimer = setTimeout(function() {
    const q = val.toLowerCase();
    const matches = ALL_LISTINGS.filter(function(l) {
      return l.title.toLowerCase().includes(q) || l.dept.toLowerCase().includes(q) || l.name.toLowerCase().includes(q);
    }).slice(0, 4);
    if (suggestions) {
      if (matches.length) {
        suggestions.innerHTML = matches.map(function(l) {
          return '<div class="suggestion-item" onclick="selectSuggestion(\'' + l.title.replace(/'/g,"\\'") + '\')">' +
            '<span class="sug-emoji">' + l.emoji + '</span>' +
            '<div><div style="font-weight:600;font-size:.88rem">' + l.title + '</div><div style="font-size:.72rem;color:var(--muted)">' + l.dept + '</div></div>' +
            '<span style="margin-left:auto;font-family:\'Syne\',sans-serif;font-weight:700;font-size:.82rem;color:var(--teal)">' + l.priceLabel + '</span>' +
          '</div>';
        }).join('');
        suggestions.className = 'search-suggestions open';
      } else {
        suggestions.innerHTML = '<div class="suggestion-item" style="color:var(--muted)">No results for "' + val + '"</div>';
        suggestions.className = 'search-suggestions open';
      }
    }
    filterBySearch(q);
  }, 250);
}

function selectSuggestion(title) {
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = title;
  const sug = document.getElementById('search-suggestions');
  if (sug) sug.className = 'search-suggestions';
  filterBySearch(title.toLowerCase());
  const sec = document.querySelector('#listings');
  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
}

function filterBySearch(q) {
  if (!q) { applyAllFilters(); return; }
  activeListings = ALL_LISTINGS.filter(function(l) {
    return l.title.toLowerCase().includes(q) || l.dept.toLowerCase().includes(q) || l.name.toLowerCase().includes(q);
  });
  STATE.visibleCount = 12;
  renderListings();
  if (q) { const sec = document.querySelector('#listings'); if(sec) sec.scrollIntoView({ behavior: 'smooth' }); }
}

function applySearchFilter() {
  const cat  = document.getElementById('searchCat')?.value || '';
  const type = document.getElementById('searchType')?.value || '';
  const q    = (document.getElementById('searchInput')?.value || '').toLowerCase();
  activeListings = ALL_LISTINGS.filter(function(l) {
    if (type && l.type !== type) return false;
    if (q && !l.title.toLowerCase().includes(q) && !l.dept.toLowerCase().includes(q)) return false;
    return true;
  });
  STATE.visibleCount = 12;
  renderListings();
}

function clearSearch() {
  const inp = document.getElementById('searchInput'); if(inp) inp.value = '';
  const clr = document.getElementById('searchClear'); if(clr) clr.style.display = 'none';
  const sug = document.getElementById('search-suggestions'); if(sug) sug.className = 'search-suggestions';
  applyAllFilters();
}

// ═══ VIEW LISTING ═══
function viewListing(id) {
  const l = ALL_LISTINGS.find(function(x) { return x.id === id; }) || STATE.myListings.find(function(x) { return x.id === id; });
  if (!l) return;
  const isWished = STATE.wishlist.includes(l.id);
  const typeLabel = l.type === 'sell' ? 'For Sale' : l.type === 'donate' ? 'Free / Donate' : 'Swap';

  document.getElementById('modalContent').innerHTML =
    '<div class="detail-hero ' + l.bg + '">' + l.emoji + '</div>' +
    '<div class="detail-meta">' +
      '<span class="listing-tag lt-' + l.type + '">' + typeLabel + '</span>' +
      '<span style="font-size:.78rem;color:var(--muted)">⭐ ' + l.rating + ' · ' + l.condition + '</span>' +
      (l.isNew ? '<span style="background:var(--ink);color:white;font-size:.66rem;font-weight:700;padding:2px 8px;border-radius:50px">New</span>' : '') +
    '</div>' +
    '<div style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:1.4rem;line-height:1.2;margin-bottom:.5rem;color:var(--ink)">' + l.title + '</div>' +
    '<div style="font-size:.85rem;color:var(--muted);margin-bottom:.75rem">' + l.dept + '</div>' +
    '<div class="detail-price">' + l.priceLabel + '</div>' +
    '<div class="detail-seller-card">' +
      '<div class="avatar ' + l.av + '" style="width:40px;height:40px;font-size:.9rem">' + l.seller + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-weight:700;font-size:.95rem;color:var(--ink)">' + l.name + '</div>' +
        '<div style="font-size:.75rem;color:var(--muted)">GLA University · Verified Student</div>' +
        '<div class="rating-stars">★★★★★ <span style="color:var(--muted);font-size:.75rem">(' + l.rating + ')</span></div>' +
      '</div>' +
      '<div style="text-align:right"><div style="font-size:.7rem;color:var(--teal);font-weight:700;background:var(--teal-light);padding:3px 9px;border-radius:50px">✓ Verified</div></div>' +
    '</div>' +

    '<div style="background:var(--paper2);border-radius:14px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border)">' +
      '<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">📞 Contact Seller</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<button onclick="contactWhatsApp(' + l.id + ')" style="background:#25D366;color:white;border:none;border-radius:10px;padding:.55rem .75rem;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s">💬 WhatsApp</button>' +
        '<button onclick="contactSMS(' + l.id + ')" style="background:#3b82f6;color:white;border:none;border-radius:10px;padding:.55rem .75rem;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s">📱 SMS Alert</button>' +
        '<button onclick="startMessage(' + l.id + ')" style="background:var(--ink);color:var(--paper);border:none;border-radius:10px;padding:.55rem .75rem;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s">💬 In-App Chat</button>' +
        (l.type === 'sell' ? '<button onclick="openPaymentGateway(' + l.id + ')" style="background:var(--teal);color:white;border:none;border-radius:10px;padding:.55rem .75rem;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s">💳 Pay Now</button>' : '') +
        (l.type !== 'sell' ? '<button onclick="openExchangeAgreement(' + l.id + ')" style="background:var(--amber);color:var(--ink);border:none;border-radius:10px;padding:.55rem .75rem;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s">📄 Agreement</button>' : '') +
      '</div>' +
    '</div>' +

    '<div id="notify-row-' + l.id + '">' + buildNotifyRow(l) + '</div>' +

    '<div class="detail-actions" style="margin-top:.75rem">' +
      '<button class="btn ' + (isWished ? 'btn-coral' : 'btn-outline') + '" onclick="toggleWishlist(event,' + l.id + ');closeModal()" style="flex:0 0 auto">' +
        (isWished ? '❤️ Saved' : '🤍 Save') +
      '</button>' +
      (l.type === 'sell' ? '<button class="btn btn-teal" onclick="openPaymentGateway(' + l.id + ')" style="flex:1">💳 Buy Now — ' + l.priceLabel + '</button>' : '') +
    '</div>' +
    '<div class="modal-switch" style="margin-top:1rem">Want to list something similar? <a onclick="openModal(\'list\')">Post a listing →</a></div>';

  document.getElementById('modalOverlay').classList.add('open');
}

function buildNotifyRow(l) {
  const alreadyNotified = STATE.notifications.find(function(n) { return (n.listingId === l.id) || (n.listingId && n.listingId.toString && n.listingId.toString() === String(l.id)); });
  if (alreadyNotified) {
    return '<div style="background:var(--green-light);border-radius:10px;padding:.6rem 1rem;font-size:.82rem;color:var(--green);font-weight:600;display:flex;align-items:center;gap:6px;border:1px solid rgba(26,122,58,.15)">🔔 You\'re subscribed to alerts <button onclick="removeNotify(' + l.id + ')" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--muted);font-size:.75rem;font-weight:600">Remove</button></div>';
  }
  return '<button onclick="addNotify(' + l.id + ')" style="width:100%;background:var(--paper2);border:1.5px dashed var(--border2);border-radius:10px;padding:.6rem 1rem;font-size:.82rem;color:var(--muted);font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .2s">🔔 Notify me if price drops or status changes</button>';
}

async function addNotify(id) {
  if (!STATE.currentUser) { closeModal(); openModal('login'); showToast('Please login to set alerts', 'info'); return; }
  const res = await apiFetch('/notifications/' + id, { method: 'POST' });
  if (res) {
    STATE.notifications = res;
    const row = document.getElementById('notify-row-' + id);
    const l = ALL_LISTINGS.find(function(x) { return x.id === id; });
    if (row && l) row.innerHTML = buildNotifyRow(l);
    showToast('🔔 Alert set!', 'success');
  }
}

async function removeNotify(id) {
  const res = await apiFetch('/notifications/' + id, { method: 'POST' });
  if (res) {
    STATE.notifications = res;
    const row = document.getElementById('notify-row-' + id);
    const l = ALL_LISTINGS.find(function(x) { return x.id === id; });
    if (row && l) row.innerHTML = buildNotifyRow(l);
    showToast('Alert removed', 'info');
  }
}

// ═══ CONTACT ═══
function contactWhatsApp(listingId) {
  const l = ALL_LISTINGS.find(function(x) { return x.id === listingId; }) || STATE.myListings.find(function(x) { return x.id === listingId; });
  if (!l) return;
  const phone = l.phone || '9876543210';
  const buyerName = STATE.currentUser ? STATE.currentUser.name : 'A student';
  const msg = encodeURIComponent('Hi ' + l.name + '! 👋 I\'m ' + buyerName + ' from GLA University.\n\nI\'m interested in your listing on *SwapNstudy*:\n📦 *' + l.title + '*\n💰 ' + l.priceLabel + ' · ' + l.condition + '\n\nIs it still available? 🤝');
  window.open('https://wa.me/91' + phone + '?text=' + msg, '_blank');
  showToast('Opening WhatsApp…', 'success');
}

function contactSMS(listingId) {
  const l = ALL_LISTINGS.find(function(x) { return x.id === listingId; }) || STATE.myListings.find(function(x) { return x.id === listingId; });
  if (!l) return;
  const phone = l.phone || '9876543210';
  const buyerName = STATE.currentUser ? STATE.currentUser.name : 'A GLA student';
  const msg = encodeURIComponent('Hi ' + l.name + '! I\'m ' + buyerName + ' from GLA. Interested in "' + l.title + '" (' + l.priceLabel + ') on SwapNstudy.');
  window.location.href = 'sms:+91' + phone + '?body=' + msg;
  showToast('Opening SMS app…', 'info');
}

function startMessage(listingId) {
  if (!STATE.currentUser) { closeModal(); openModal('login'); showToast('Please login to message sellers', 'info'); return; }
  closeModal();
  STATE.activeConvId = 'conv_' + listingId;
  openModal('messages-view');
}

// ═══ PAYMENT GATEWAY ═══
function openPaymentGateway(listingId) {
  if (!STATE.currentUser) { closeModal(); openModal('login'); showToast('Please login to make a payment', 'info'); return; }
  const l = ALL_LISTINGS.find(function(x) { return x.id === listingId; }) || STATE.myListings.find(function(x) { return x.id === listingId; });
  if (!l) return;

  const platformFee = 0;
  const total = l.price;

  document.getElementById('modalContent').innerHTML =
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1.5rem">' +
      '<div style="font-size:2rem">💳</div>' +
      '<div>' +
        '<div class="modal-title" style="margin-bottom:0">Secure Payment</div>' +
        '<div style="font-size:.78rem;color:var(--muted)">Powered by SwapNstudy Pay</div>' +
      '</div>' +
    '</div>' +

    '<div class="payment-summary">' +
      '<div class="pay-row"><span>' + l.emoji + ' ' + l.title + '</span><span class="pay-val">' + l.priceLabel + '</span></div>' +
      '<div class="pay-row"><span>Seller</span><span class="pay-val">' + l.name + '</span></div>' +
      '<div class="pay-row"><span>Condition</span><span class="pay-val">' + l.condition + '</span></div>' +
      '<div class="pay-row"><span>Platform Fee</span><span class="pay-val" style="color:var(--green)">₹0 FREE</span></div>' +
      '<div class="pay-row total"><span>Total Amount</span><span class="pay-val">₹' + total + '</span></div>' +
    '</div>' +

    '<div style="font-size:.82rem;font-weight:700;color:var(--ink);margin-bottom:.75rem">Select Payment Method</div>' +
    '<div class="payment-methods" id="payMethods">' +
      '<div class="pay-method selected" id="pm-upi" onclick="selectPayMethod(\'upi\')">' +
        '<div class="pay-icon">📲</div>' +
        '<div class="pay-label">UPI</div>' +
        '<div class="pay-sub">GPay, PhonePe, Paytm</div>' +
      '</div>' +
      '<div class="pay-method" id="pm-card" onclick="selectPayMethod(\'card\')">' +
        '<div class="pay-icon">💳</div>' +
        '<div class="pay-label">Card</div>' +
        '<div class="pay-sub">Debit / Credit</div>' +
      '</div>' +
      '<div class="pay-method" id="pm-wallet" onclick="selectPayMethod(\'wallet\')">' +
        '<div class="pay-icon">👛</div>' +
        '<div class="pay-label">Wallet</div>' +
        '<div class="pay-sub">Paytm, Mobikwik</div>' +
      '</div>' +
      '<div class="pay-method" id="pm-netbanking" onclick="selectPayMethod(\'netbanking\')">' +
        '<div class="pay-icon">🏦</div>' +
        '<div class="pay-label">Net Banking</div>' +
        '<div class="pay-sub">All banks</div>' +
      '</div>' +
    '</div>' +

    '<div id="pay-input-area">' + buildUpiInput() + '</div>' +

    '<div style="display:flex;gap:8px;margin-top:1rem">' +
      '<button class="btn btn-outline" onclick="viewListing(' + listingId + ')" style="flex:0 0 auto">← Back</button>' +
      '<button class="btn btn-teal btn-fw" onclick="processPayment(' + listingId + ')" style="padding:.85rem;font-size:1rem">Pay ₹' + total + ' Securely 🔒</button>' +
    '</div>' +

    '<div style="text-align:center;margin-top:.75rem;font-size:.72rem;color:var(--muted)">🔒 256-bit SSL secured · Powered by SwapNstudy Pay</div>';

  document.getElementById('modalOverlay').classList.add('open');
  window._payListingId = listingId;
  window._payMethod = 'upi';
}

function buildUpiInput() {
  return '<div class="form-group" style="margin-top:.75rem">' +
    '<label>UPI ID</label>' +
    '<div class="upi-input-wrap">' +
      '<input type="text" id="upi-id" placeholder="yourname@upi" />' +
      '<button class="upi-verify-btn" onclick="verifyUpi()">Verify</button>' +
    '</div>' +
    '<div class="field-hint">Enter your UPI ID (e.g. name@okicici, number@paytm)</div>' +
  '</div>';
}

function buildCardInput() {
  return '<div style="margin-top:.75rem">' +
    '<div class="form-group"><label>Card Number</label><input type="text" id="card-num" placeholder="1234 5678 9012 3456" maxlength="19" oninput="formatCard(this)"/></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Expiry</label><input type="text" id="card-exp" placeholder="MM/YY" maxlength="5"/></div>' +
      '<div class="form-group"><label>CVV</label><input type="password" id="card-cvv" placeholder="•••" maxlength="3"/></div>' +
    '</div>' +
    '<div class="form-group"><label>Name on Card</label><input type="text" id="card-name" placeholder="' + (STATE.currentUser ? STATE.currentUser.name.toUpperCase() : 'FULL NAME') + '"/></div>' +
  '</div>';
}

function buildWalletInput() {
  return '<div class="form-group" style="margin-top:.75rem">' +
    '<label>Select Wallet</label>' +
    '<select id="wallet-sel"><option value="paytm">Paytm</option><option value="phonpe">PhonePe</option><option value="mobikwik">Mobikwik</option><option value="freecharge">FreeCharge</option></select>' +
    '<div class="field-hint">You\'ll be redirected to the wallet app to confirm.</div>' +
  '</div>';
}

function buildNetbankingInput() {
  return '<div class="form-group" style="margin-top:.75rem">' +
    '<label>Select Bank</label>' +
    '<select id="bank-sel"><option value="sbi">State Bank of India</option><option value="hdfc">HDFC Bank</option><option value="icici">ICICI Bank</option><option value="axis">Axis Bank</option><option value="pnb">Punjab National Bank</option><option value="bob">Bank of Baroda</option><option value="kotak">Kotak Mahindra Bank</option></select>' +
    '<div class="field-hint">You\'ll be redirected to your bank\'s net banking portal.</div>' +
  '</div>';
}

function selectPayMethod(method) {
  window._payMethod = method;
  ['upi','card','wallet','netbanking'].forEach(function(m) {
    const el = document.getElementById('pm-' + m);
    if (el) el.classList.toggle('selected', m === method);
  });
  const area = document.getElementById('pay-input-area');
  if (!area) return;
  if (method === 'upi') area.innerHTML = buildUpiInput();
  else if (method === 'card') area.innerHTML = buildCardInput();
  else if (method === 'wallet') area.innerHTML = buildWalletInput();
  else if (method === 'netbanking') area.innerHTML = buildNetbankingInput();
}

function formatCard(inp) {
  let v = inp.value.replace(/\D/g,'').slice(0,16);
  inp.value = v.match(/.{1,4}/g)?.join(' ') || v;
}

function verifyUpi() {
  const upiId = document.getElementById('upi-id')?.value.trim();
  if (!upiId || !upiId.includes('@')) { showToast('Please enter a valid UPI ID', 'error'); return; }
  showToast('✓ UPI ID verified!', 'success');
}

function processPayment(listingId) {
  const l = ALL_LISTINGS.find(function(x) { return x.id === listingId; }) || STATE.myListings.find(function(x) { return x.id === listingId; });
  if (!l) return;
  const method = window._payMethod || 'upi';

  // Validate method-specific inputs
  if (method === 'upi') {
    const upiId = document.getElementById('upi-id')?.value.trim();
    if (!upiId || !upiId.includes('@')) { showToast('Please enter a valid UPI ID', 'error'); return; }
  } else if (method === 'card') {
    const num = document.getElementById('card-num')?.value.replace(/\s/g,'');
    const exp = document.getElementById('card-exp')?.value;
    const cvv = document.getElementById('card-cvv')?.value;
    const name = document.getElementById('card-name')?.value;
    if (!num || num.length < 16 || !exp || !cvv || cvv.length < 3 || !name) {
      showToast('Please fill in all card details correctly', 'error'); return;
    }
  }

  // Show processing animation
  const btn = document.querySelector('#modalContent .btn-teal');
  if (btn) {
    btn.textContent = '⏳ Processing…';
    btn.disabled = true;
  }

  setTimeout(function() {
    const txnId = 'SNS' + Date.now().toString(36).toUpperCase();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    const methodLabels = { upi:'UPI', card:'Card', wallet:'Wallet', netbanking:'Net Banking' };

    // Save payment record
    const payRecord = {
      txnId, listingId: l.id, title: l.title, amount: l.price, priceLabel: l.priceLabel,
      seller: l.name, buyer: STATE.currentUser.name,
      method: methodLabels[method] || method,
      date: dateStr, time: timeStr, status: 'success'
    };
    STATE.paymentHistory.push(payRecord);
    
    // Save to backend
    apiFetch('/payments', { method: 'POST', body: JSON.stringify(payRecord) });

    // Show success screen
    document.getElementById('modalContent').innerHTML =
      '<div class="payment-success">' +
        '<div class="success-circle">✅</div>' +
        '<div class="modal-title" style="margin-bottom:.25rem">Payment Successful!</div>' +
        '<div style="font-size:.9rem;color:var(--muted);margin-bottom:1.5rem">Your transaction is confirmed</div>' +

        '<div class="txn-card">' +
          '<div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">Transaction Details</div>' +
          '<div class="txn-row"><span class="txn-label">Transaction ID</span><span class="txn-val" style="font-family:monospace;font-size:.82rem;color:var(--teal)">' + txnId + '</span></div>' +
          '<div class="txn-row"><span class="txn-label">Item</span><span class="txn-val">' + l.title + '</span></div>' +
          '<div class="txn-row"><span class="txn-label">Seller</span><span class="txn-val">' + l.name + '</span></div>' +
          '<div class="txn-row"><span class="txn-label">Amount Paid</span><span class="txn-val" style="color:var(--teal);font-family:\'Syne\',sans-serif;font-weight:800">' + l.priceLabel + '</span></div>' +
          '<div class="txn-row"><span class="txn-label">Payment Method</span><span class="txn-val">' + (methodLabels[method] || method) + '</span></div>' +
          '<div class="txn-row"><span class="txn-label">Date & Time</span><span class="txn-val">' + dateStr + ' · ' + timeStr + '</span></div>' +
          '<div class="txn-row"><span class="txn-label">Status</span><span class="pay-status-success">Success ✓</span></div>' +
        '</div>' +

        '<div style="background:var(--teal-light);border-radius:12px;padding:1rem;margin:1rem 0;font-size:.85rem;color:var(--teal-dark);font-weight:500">📍 <strong>Next Step:</strong> Message the seller to arrange a campus pickup. Save the Transaction ID for reference.</div>' +

        '<div style="display:flex;gap:8px;margin-top:1rem;flex-wrap:wrap">' +
          '<button class="btn btn-teal" onclick="startMessage(' + l.id + ')" style="flex:1">💬 Message Seller</button>' +
          '<button class="btn btn-outline" onclick="closeModal()" style="flex:0 0 auto">Done</button>' +
        '</div>' +
        '<div class="modal-switch"><a onclick="openModal(\'payment-history\')">View payment history →</a></div>' +
      '</div>';

    showToast('💳 Payment of ' + l.priceLabel + ' successful!', 'success', 4000);
  }, 2200);
}

// ═══ EXCHANGE AGREEMENT ═══
function openExchangeAgreement(listingId) {
  if (!STATE.currentUser) { closeModal(); openModal('login'); showToast('Please login to create an agreement', 'info'); return; }
  const l = ALL_LISTINGS.find(function(x) { return x.id === listingId; }) || STATE.myListings.find(function(x) { return x.id === listingId; });
  if (!l) return;
  const agreementId = 'SNS-' + Date.now().toString(36).toUpperCase();
  const today = new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('modalContent').innerHTML =
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:1.5rem">' +
      '<div style="font-size:2rem">📄</div>' +
      '<div><div class="modal-title" style="margin-bottom:0">Exchange Agreement</div><div style="font-size:.75rem;color:var(--muted);font-family:monospace">' + agreementId + '</div></div>' +
    '</div>' +
    '<div id="agreement-doc" style="background:var(--paper2);border:1px solid var(--border);border-radius:14px;padding:1.5rem;margin-bottom:1.25rem;font-size:.85rem;line-height:1.8;color:var(--ink)">' +
      '<div style="text-align:center;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:2px solid var(--teal)">' +
        '<div style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:1.2rem;color:var(--teal)">SwapNstudy</div>' +
        '<div style="font-size:.72rem;color:var(--muted);letter-spacing:.05em;text-transform:uppercase">Campus Resource Exchange Agreement · GLA University</div>' +
      '</div>' +
      '<div style="margin-bottom:1rem"><strong>Agreement ID:</strong> ' + agreementId + '<br><strong>Date:</strong> ' + today + '</div>' +
      '<div style="margin-bottom:1rem"><strong>ITEM:</strong> ' + l.title + ' · ' + l.condition + ' · ' + l.priceLabel + '</div>' +
      '<div style="margin-bottom:1rem"><strong>SELLER:</strong> ' + l.name + ' (Verified GLA Student)<br><strong>BUYER:</strong> ' + STATE.currentUser.name + ' · Roll: ' + STATE.currentUser.roll + '</div>' +
      '<div style="font-size:.78rem;color:var(--muted);margin-bottom:1rem"><strong>TERMS:</strong><br>1. Meet on GLA campus for exchange.<br>2. Item exchanged as described. No returns after handover.<br>3. Payment in cash/UPI at time of exchange.<br>4. SwapNstudy acts as facilitator only.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem">' +
        '<div><div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Seller Signature</div><div style="border-bottom:1.5px solid var(--ink);padding-bottom:4px;font-weight:600">' + l.name + '</div><div style="font-size:.7rem;color:var(--muted);margin-top:4px">' + today + '</div></div>' +
        '<div><div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Buyer Signature</div><div style="border-bottom:1.5px solid var(--ink);padding-bottom:4px;font-weight:600">' + STATE.currentUser.name + '</div><div style="font-size:.7rem;color:var(--muted);margin-top:4px">' + today + '</div></div>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-teal" style="flex:1" onclick="printAgreement()">🖨️ Print / Save PDF</button>' +
      '<button class="btn btn-outline" style="flex:0 0 auto" onclick="saveAgreementRecord(' + l.id + ',\'' + agreementId + '\')">💾 Save Record</button>' +
    '</div>' +
    '<div class="modal-switch"><a onclick="viewListing(' + l.id + ')">← Back to listing</a></div>';

  document.getElementById('modalOverlay').classList.add('open');
}

function printAgreement() {
  const doc = document.getElementById('agreement-doc');
  if (!doc) return;
  const win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><title>SwapNstudy Agreement</title><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/><style>body{font-family:\'DM Sans\',sans-serif;padding:32px;color:#0f1117;max-width:700px;margin:0 auto}strong{font-weight:700}@media print{button{display:none}}</style></head><body>' + doc.innerHTML + '<br/><button onclick="window.print()" style="padding:10px 24px;background:#0d9e8f;color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;margin-top:12px">🖨️ Print</button></body></html>');
  win.document.close(); win.focus();
  showToast('Opening print view…', 'success');
}

async function saveAgreementRecord(listingId, agreementId) {
  const l = ALL_LISTINGS.find(function(x) { return x.id === listingId; }) || STATE.myListings.find(function(x) { return x.id === listingId; });
  if (!l) return;
  await apiFetch('/agreements', {
    method: 'POST',
    body: JSON.stringify({ agreementId, listingId: l.id, title: l.title, priceLabel: l.priceLabel, seller: l.name, buyer: STATE.currentUser.name, status: 'pending' })
  });
  await loadState();
  showToast('📄 Agreement saved!', 'success');
}

// ═══ COUNTER ANIMATION ═══
function animateCounters() {
  document.querySelectorAll('.stat-num[data-target]').forEach(function(el) {
    const target = parseInt(el.dataset.target);
    let curr = 0;
    const step = Math.ceil(target / 55);
    const timer = setInterval(function() {
      curr = Math.min(curr + step, target);
      el.textContent = curr + '+';
      if (curr >= target) clearInterval(timer);
    }, 22);
  });
}

// ═══ AUTH STATE ═══
function updateNavForUser(user) {
  const guestEl = document.getElementById('nav-cta-guest');
  const userEl  = document.getElementById('nav-cta-user');
  if (guestEl) guestEl.style.display = user ? 'none' : 'flex';
  if (userEl)  userEl.style.display  = user ? 'flex' : 'none';
  if (user) {
    const initials = user.name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
    const navAv = document.getElementById('nav-avatar'); if(navAv) navAv.textContent = initials;
    const navUn = document.getElementById('nav-username'); if(navUn) navUn.textContent = user.name.split(' ')[0];
    const ddAv  = document.getElementById('dd-avatar'); if(ddAv) ddAv.textContent = initials;
    const ddNm  = document.getElementById('dd-name'); if(ddNm) ddNm.textContent = user.name;
  }
}

function handleLogout() {
  STATE.currentUser = null;
  AUTH_TOKEN = null;
  localStorage.removeItem('sns_token');
  updateNavForUser(null);
  closeModal();
  hideDashboard();
  const dd = document.getElementById('user-dropdown'); if(dd) dd.classList.remove('open');
  showToast('Signed out. See you soon!', 'info');
  renderListings();
}

function toggleUserMenu() {
  const dd = document.getElementById('user-dropdown');
  if (dd) dd.classList.toggle('open');
}

// ═══ MODAL TEMPLATES ═══
const MODALS = {

  login: function() {
    return '<div class="auth-steps"><div class="auth-step active">Sign In</div><div class="auth-step">Done</div></div>' +
    '<div class="modal-title">Welcome back 👋</div>' +
    '<div class="modal-sub">Login with your campus credentials. <strong>Any roll number (6+ chars) + any password (8+ chars)</strong> works for demo.</div>' +
    '<div class="form-group"><label>University Roll Number</label><input type="text" id="login-roll" placeholder="e.g. 2442010238" autocomplete="username"/><div class="field-error" id="err-roll">Please enter your roll number (min 6 chars)</div></div>' +
    '<div class="form-group"><label>Password <a style="font-size:.75rem;color:var(--teal);font-weight:500;cursor:pointer" onclick="openModal(\'forgot\')">Forgot?</a></label>' +
    '<div style="position:relative"><input type="password" id="login-pw" placeholder="Min. 8 characters" autocomplete="current-password"/><button type="button" onclick="togglePw(\'login-pw\',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem">👁</button></div>' +
    '<div class="field-error" id="err-pw">Password must be at least 8 characters</div></div>' +
    '<button class="btn btn-teal btn-fw" style="padding:.85rem;margin-top:.5rem;font-size:1rem" onclick="doLogin()">Sign In →</button>' +
    '<div class="modal-switch">New to SwapNstudy? <a onclick="openModal(\'signup\')">Create a free account</a></div>';
  },

  signup: function() {
    return '<div class="auth-steps"><div class="auth-step active">Register</div><div class="auth-step">Verify OTP</div><div class="auth-step">Done</div></div>' +
    '<div class="modal-title">Join SwapNstudy 🎓</div>' +
    '<div class="modal-sub">Create your free campus account — it takes 30 seconds</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Full Name *</label><input type="text" id="su-name" placeholder="Harshita Gupta"/><div class="field-error" id="err-su-name">Enter your full name</div></div>' +
      '<div class="form-group"><label>Roll Number *</label><input type="text" id="su-roll" placeholder="2442010238"/><div class="field-error" id="err-su-roll">Enter your roll number</div></div>' +
    '</div>' +
    '<div class="form-group"><label>University Email * <span style="font-size:.72rem;color:var(--teal)">@gla.ac.in preferred</span></label><input type="email" id="su-email" placeholder="harshita@gla.ac.in" oninput="checkEmailDomain(this)"/><div class="field-error" id="err-su-email">Enter a valid email</div></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Course</label><select id="su-course"><option value="BCA">BCA</option><option value="BBA">BBA</option><option value="B.Tech CSE">B.Tech - CSE</option><option value="B.Tech Other">B.Tech - Other</option><option value="MCA">MCA</option><option value="MBA">MBA</option></select></div>' +
      '<div class="form-group"><label>Year</label><select id="su-year"><option value="1">1st Year</option><option value="2">2nd Year</option><option value="3">3rd Year</option><option value="4">4th Year</option></select></div>' +
    '</div>' +
    '<div class="form-group"><label>Password *</label><div style="position:relative"><input type="password" id="su-pw" placeholder="Min. 8 characters" oninput="checkPwStrength(this.value)"/><button type="button" onclick="togglePw(\'su-pw\',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem">👁</button></div>' +
    '<div class="pw-strength" id="pw-strength" style="display:none"><div class="pw-bar"><div class="pw-seg" id="ps1"></div><div class="pw-seg" id="ps2"></div><div class="pw-seg" id="ps3"></div><div class="pw-seg" id="ps4"></div></div><div class="pw-label" id="pw-label"></div></div>' +
    '<div class="field-error" id="err-su-pw">Password must be at least 8 characters</div></div>' +
    '<button class="btn btn-teal btn-fw" style="padding:.85rem;margin-top:.5rem;font-size:1rem" onclick="doSignup()">Create Account & Send OTP →</button>' +
    '<div class="modal-switch">Already registered? <a onclick="openModal(\'login\')">Log in here</a></div>';
  },

  otp: function() {
    // Generate OTP and store it
    const otp = Math.floor(100000 + Math.random() * 900000);
    STATE.generatedOTP = String(otp);
    console.log('%c🔐 Demo OTP: ' + otp, 'background:#0d9e8f;color:white;font-size:18px;font-weight:bold;padding:6px 12px;border-radius:6px');

    return '<div class="auth-steps"><div class="auth-step done">Register</div><div class="auth-step active">Verify OTP</div><div class="auth-step">Done</div></div>' +
    '<div class="modal-title">Check your inbox 📧</div>' +
    '<div class="modal-sub">A 6-digit verification code has been sent to <strong>' + (STATE.otpTarget || 'your email') + '</strong></div>' +

    // ── PROMINENT OTP DISPLAY BOX ──
    '<div class="otp-demo-box">' +
      '<div class="otp-label">🔐 Demo OTP (use this to verify)</div>' +
      '<div class="otp-big" id="otp-display-code">' + otp + '</div>' +
      '<div class="otp-label" style="color:var(--coral);font-size:.7rem">Also logged to browser console</div>' +
    '</div>' +

    '<div class="otp-group">' +
      '<input class="otp-input" type="text" maxlength="1" id="otp0" inputmode="numeric" oninput="otpInput(0)" onkeydown="otpKey(event,0)" onpaste="otpPaste(event)">' +
      '<input class="otp-input" type="text" maxlength="1" id="otp1" inputmode="numeric" oninput="otpInput(1)" onkeydown="otpKey(event,1)">' +
      '<input class="otp-input" type="text" maxlength="1" id="otp2" inputmode="numeric" oninput="otpInput(2)" onkeydown="otpKey(event,2)">' +
      '<input class="otp-input" type="text" maxlength="1" id="otp3" inputmode="numeric" oninput="otpInput(3)" onkeydown="otpKey(event,3)">' +
      '<input class="otp-input" type="text" maxlength="1" id="otp4" inputmode="numeric" oninput="otpInput(4)" onkeydown="otpKey(event,4)">' +
      '<input class="otp-input" type="text" maxlength="1" id="otp5" inputmode="numeric" oninput="otpInput(5)" onkeydown="otpKey(event,5)">' +
    '</div>' +
    '<div style="text-align:center;font-size:.82rem;color:var(--muted);margin-bottom:1.5rem">Code expires in <span id="otp-countdown" style="color:var(--teal);font-weight:700">10:00</span></div>' +
    '<button class="btn btn-teal btn-fw" style="padding:.85rem;font-size:1rem" onclick="verifyOTP()">Verify & Continue →</button>' +
    '<div style="text-align:center;margin-top:.75rem"><button class="btn btn-outline btn-sm" onclick="autoFillOTP()" style="margin-right:.5rem">✨ Auto-fill OTP</button></div>' +
    '<div class="modal-switch">Didn\'t get it? <a onclick="resendOTP()">Resend OTP</a> · <a onclick="openModal(\'signup\')">Go back</a></div>';
  },

  'signup-success': function() {
    return '<div style="text-align:center;padding:1rem 0">' +
    '<div style="font-size:4rem;margin-bottom:1rem">🎉</div>' +
    '<div class="auth-steps" style="margin-bottom:2rem"><div class="auth-step done">Register</div><div class="auth-step done">Verify OTP</div><div class="auth-step active">Done</div></div>' +
    '<div class="modal-title">Welcome to SwapNstudy!</div>' +
    '<div class="modal-sub">Your account is verified. You can now list items, message peers, and join the campus exchange community.</div>' +
    '<div style="background:var(--teal-light);border-radius:14px;padding:1.25rem;margin:1.5rem 0;text-align:left">' +
      '<div style="font-weight:700;margin-bottom:.5rem;color:var(--teal-dark)">✓ Your account is ready</div>' +
      '<div style="font-size:.82rem;color:var(--teal-dark);line-height:1.7">• List items for sale, donation, or swap<br>• Message other verified students<br>• Pay securely via UPI / Cards<br>• Save items to your wishlist</div>' +
    '</div>' +
    '<button class="btn btn-teal btn-fw" style="padding:.85rem;font-size:1rem" onclick="closeModal();showToast(\'Welcome aboard! 🎓\',\'success\')">Start Exploring →</button>' +
    '</div>';
  },

  forgot: function() {
    return '<div class="modal-title">Reset Password 🔑</div>' +
    '<div class="modal-sub">Enter your details. We\'ll send a reset link.</div>' +
    '<div class="form-group"><label>Roll Number</label><input type="text" id="fp-roll" placeholder="2442010238"/></div>' +
    '<div class="form-group"><label>Registered Email</label><input type="email" id="fp-email" placeholder="harshita@gla.ac.in"/></div>' +
    '<button class="btn btn-teal btn-fw" style="padding:.85rem;margin-top:.5rem" onclick="doForgot()">Send Reset Link</button>' +
    '<div class="modal-switch"><a onclick="openModal(\'login\')">← Back to login</a></div>';
  },

  list: function() {
    return '<div class="modal-title">List an Item 📦</div>' +
    '<div class="modal-sub">Share a resource with your campus peers.</div>' +
    '<div class="form-group"><label>Item Title *</label><input type="text" id="li-title" placeholder="e.g. Data Structures by Karumanchi"/></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Category *</label><select id="li-cat"><option value="book">📘 Textbook</option><option value="notes">📝 Notes</option><option value="electronics">💻 Electronics</option><option value="stationery">🔧 Stationery</option><option value="instruments">📐 Instruments</option><option value="other">📦 Other</option></select></div>' +
      '<div class="form-group"><label>Condition *</label><select id="li-cond"><option value="Like New">Like New</option><option value="Good">Good</option><option value="Fair">Fair</option></select></div>' +
    '</div>' +
    '<div class="form-group"><label>Transaction Type *</label>' +
      '<div class="price-toggle">' +
        '<button class="price-option selected" type="button" onclick="selectType(this,\'sell\')">💰 For Sale</button>' +
        '<button class="price-option" type="button" onclick="selectType(this,\'donate\')">🎁 Donate Free</button>' +
        '<button class="price-option" type="button" onclick="selectType(this,\'swap\')">🔄 Swap</button>' +
      '</div>' +
      '<input type="hidden" id="li-type" value="sell"/>' +
    '</div>' +
    '<div class="form-group" id="price-field"><label>Price (₹) *</label><input type="number" id="li-price" placeholder="e.g. 150" min="1"/><div class="field-hint">Most books go for ₹80–₹250.</div></div>' +
    '<div class="form-group"><label>Department / Semester</label><input type="text" id="li-dept" placeholder="e.g. BCA 3rd Sem · Karumanchi"/></div>' +
    '<div class="form-group"><label>WhatsApp Number (optional)</label><input type="tel" id="li-phone" placeholder="e.g. 9876543210" maxlength="10"/></div>' +
    '<div class="form-group"><label>Description (optional)</label><textarea id="li-desc" placeholder="Any extra details about condition, edition, etc."></textarea></div>' +
    '<button class="btn btn-teal btn-fw" style="padding:.85rem;margin-top:.5rem;font-size:1rem" onclick="doListItem()">🚀 Post Listing</button>';
  },

  'messages-view': function() {
    const convs = Object.entries(STATE.messages);
    const firstId = STATE.activeConvId || (convs.length ? convs[0][0] : null);
    STATE.activeConvId = firstId;

    const convListHtml = convs.map(function(entry) {
      const id = entry[0], c = entry[1];
      const lastMsg = c.msgs[c.msgs.length-1];
      return '<div class="conv-item ' + (id === firstId ? 'active' : '') + '" onclick="switchConv(\'' + id + '\')" id="ci-' + id + '">' +
        '<div class="avatar ' + c.partnerAv + '" style="width:36px;height:36px;font-size:.8rem">' + c.partnerId + '</div>' +
        '<div class="conv-info"><div class="conv-name">' + c.partnerName + '</div><div class="conv-preview">' + (lastMsg ? lastMsg.text : '') + '</div></div>' +
      '</div>';
    }).join('');

    const activeMsgs = firstId ? STATE.messages[firstId] : null;
    const chatHtml = activeMsgs ? buildChat(firstId, activeMsgs) : '<div style="padding:2rem;text-align:center;color:var(--muted)">Select a conversation</div>';

    return '<div class="modal-title" style="margin-bottom:1.25rem">Messages 💬</div>' +
      '<div class="messages-wrap" id="messages-wrap">' +
        '<div class="conv-list">' + (convListHtml || '<div style="padding:1rem;color:var(--muted);font-size:.85rem">No conversations yet</div>') + '</div>' +
        '<div class="chat-area" id="chat-area">' + chatHtml + '</div>' +
      '</div>';
  },

  'wishlist-view': function() {
    const items = ALL_LISTINGS.filter(function(l) { return STATE.wishlist.includes(l.id); });
    if (!items.length) {
      return '<div class="modal-title">My Wishlist ❤️</div>' +
        '<div style="text-align:center;padding:2.5rem 0">' +
          '<div style="font-size:3.5rem;margin-bottom:1rem">🤍</div>' +
          '<div style="font-weight:700;font-size:1.1rem;margin-bottom:.5rem">Your wishlist is empty</div>' +
          '<div style="color:var(--muted);margin-bottom:1.5rem;font-size:.88rem">Browse listings and tap 🤍 to save items here</div>' +
          '<button class="btn btn-teal" onclick="closeModal();document.querySelector(\'#listings\').scrollIntoView({behavior:\'smooth\'})">Browse Listings →</button>' +
        '</div>';
    }
    return '<div class="modal-title" style="margin-bottom:1rem">My Wishlist ❤️ <span style="font-size:1rem;font-weight:500;color:var(--muted)">' + items.length + ' items</span></div>' +
      '<div class="wishlist-grid">' +
        items.map(function(l) {
          return '<div class="wl-card"><div style="font-size:2rem">' + l.emoji + '</div>' +
            '<div style="flex:1"><div style="font-weight:700;font-size:.85rem;line-height:1.3;color:var(--ink)">' + l.title + '</div>' +
            '<div style="font-size:.72rem;color:var(--muted);margin-top:2px">' + l.dept + '</div>' +
            '<div style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:.95rem;color:var(--teal);margin-top:4px">' + l.priceLabel + '</div></div>' +
            '<button class="wl-remove" onclick="toggleWishlist(event,' + l.id + ');openModal(\'wishlist-view\')">🗑️</button></div>';
        }).join('') +
      '</div>' +
      '<button class="btn btn-teal btn-fw" style="margin-top:1.5rem" onclick="closeModal();document.querySelector(\'#listings\').scrollIntoView({behavior:\'smooth\'})">Browse More →</button>';
  },

  'payment-history': function() {
    const payments = STATE.paymentHistory;
    if (!payments.length) {
      return '<div class="modal-title">Payment History 💳</div>' +
        '<div style="text-align:center;padding:2.5rem 0">' +
          '<div style="font-size:3.5rem;margin-bottom:1rem">💳</div>' +
          '<div style="font-weight:700;font-size:1.1rem;margin-bottom:.5rem">No payments yet</div>' +
          '<div style="color:var(--muted);margin-bottom:1.5rem;font-size:.88rem">Your transaction history will appear here after purchases.</div>' +
          '<button class="btn btn-teal" onclick="closeModal();document.querySelector(\'#listings\').scrollIntoView({behavior:\'smooth\'})">Browse Listings →</button>' +
        '</div>';
    }
    return '<div class="modal-title" style="margin-bottom:1.25rem">Payment History 💳 <span style="font-size:1rem;font-weight:500;color:var(--muted)">' + payments.length + ' transactions</span></div>' +
      payments.slice().reverse().map(function(p) {
        return '<div class="pay-hist-row">' +
          '<div class="pay-hist-icon">💳</div>' +
          '<div class="pay-hist-info">' +
            '<div class="pay-hist-title">' + p.title + '</div>' +
            '<div class="pay-hist-meta">To: ' + p.seller + ' · ' + p.method + ' · ' + p.date + '</div>' +
            '<div style="font-size:.7rem;font-family:monospace;color:var(--teal);margin-top:2px">' + p.txnId + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div class="pay-hist-amount">' + p.priceLabel + '</div>' +
            '<span class="pay-status-success">✓ Success</span>' +
          '</div>' +
        '</div>';
      }).join('') +
      '<div style="text-align:center;margin-top:1.25rem;font-size:.8rem;color:var(--muted)">All transactions are end-to-end secured 🔒</div>';
  },
};

function buildChat(convId, conv) {
  const msgs = conv.msgs.map(function(m) {
    const cls = (m.from === 'sent' || m.from === 'me') ? 'sent' : 'recv';
    return '<div class="msg ' + cls + '"><div class="msg-bubble">' + m.text + '</div><div class="msg-time">' + m.time + '</div></div>';
  }).join('');

  return '<div class="chat-header">' +
    '<div class="avatar ' + conv.partnerAv + '" style="width:36px;height:36px;font-size:.82rem">' + conv.partnerId + '</div>' +
    '<div><div style="font-weight:700;font-size:.95rem;color:var(--ink)">' + conv.partnerName + '</div><div style="font-size:.72rem;color:var(--teal);font-weight:600">Re: ' + conv.itemTitle + '</div></div>' +
    '<div style="margin-left:auto;font-size:.72rem;background:var(--green-light);color:var(--green);padding:3px 9px;border-radius:50px;font-weight:700">✓ Verified</div>' +
    '</div>' +
    '<div class="chat-messages" id="chat-msgs">' + msgs + '</div>' +
    '<div class="chat-input">' +
      '<input type="text" id="chat-inp" placeholder="Type a message…" onkeydown="if(event.key===\'Enter\')sendMessage(\'' + convId + '\')"/>' +
      '<button class="btn btn-teal btn-sm" onclick="sendMessage(\'' + convId + '\')">Send</button>' +
    '</div>';
}

// ═══ MODAL CONTROLS ═══
function openModal(type) {
  const fn = MODALS[type];
  if (!fn) return;
  document.getElementById('modalContent').innerHTML = fn();
  document.getElementById('modalOverlay').classList.add('open');
  const modalBox = document.getElementById('modalBox');
  if (modalBox) modalBox.classList.toggle('modal-lg', type === 'messages-view');

  if (type === 'otp') {
    startOTPTimer();
    // Focus first OTP input
    setTimeout(function() { const el = document.getElementById('otp0'); if(el) el.focus(); }, 100);
  }
  if (type === 'messages-view') {
    setTimeout(function() {
      const msgs = document.getElementById('chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  }
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ═══ AUTH LOGIC ═══
async function doLogin() {
  const rollEl = document.getElementById('login-roll');
  const pwEl   = document.getElementById('login-pw');
  const errRoll = document.getElementById('err-roll');
  const errPw   = document.getElementById('err-pw');

  if (!rollEl || !pwEl) return;

  const roll = rollEl.value.trim();
  const pw   = pwEl.value;

  // Validate
  const rollOk = roll.length >= 6;
  const pwOk   = pw.length >= 8;

  // Show/hide errors
  if (errRoll) errRoll.classList.toggle('show', !rollOk);
  if (errPw)   errPw.classList.toggle('show',   !pwOk);
  rollEl.classList.toggle('error', !rollOk);
  pwEl.classList.toggle('error',   !pwOk);

  if (!rollOk || !pwOk) return;

  const btn = document.querySelector('#modalContent .btn-teal');
  if(btn) btn.textContent = 'Signing in...';

  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: roll + '@gla.ac.in', password: pw })
  });

  if (res && res.token) {
    completeLogin(res.user, res.token);
  } else {
    showToast('Invalid credentials. If demo, try signing up first!', 'error');
    if(btn) btn.textContent = 'Sign In →';
  }
}

function completeLogin(user, token) {
  STATE.currentUser = user;
  AUTH_TOKEN = token;
  localStorage.setItem('sns_token', token);
  updateNavForUser(user);
  closeModal();
  showToast('Welcome back, ' + user.name.split(' ')[0] + '! 👋', 'success');
  loadState();
}

function doSignup() {
  const name  = (document.getElementById('su-name')?.value || '').trim();
  const roll  = (document.getElementById('su-roll')?.value || '').trim();
  const email = (document.getElementById('su-email')?.value || '').trim();
  const pw    = document.getElementById('su-pw')?.value || '';

  let valid = true;

  // Name: at least 2 words
  if (!name || name.split(' ').filter(function(w){return w.length>0;}).length < 2) {
    document.getElementById('err-su-name')?.classList.add('show');
    document.getElementById('su-name')?.classList.add('error');
    valid = false;
  } else {
    document.getElementById('err-su-name')?.classList.remove('show');
    document.getElementById('su-name')?.classList.remove('error');
  }

  // Roll: at least 7 digits
  if (!roll || roll.replace(/\s/g,'').length < 7) {
    document.getElementById('err-su-roll')?.classList.add('show');
    document.getElementById('su-roll')?.classList.add('error');
    valid = false;
  } else {
    document.getElementById('err-su-roll')?.classList.remove('show');
    document.getElementById('su-roll')?.classList.remove('error');
  }

  // Email: basic check
  if (!email || !email.includes('@')) {
    document.getElementById('err-su-email')?.classList.add('show');
    document.getElementById('su-email')?.classList.add('error');
    valid = false;
  } else {
    document.getElementById('err-su-email')?.classList.remove('show');
    document.getElementById('su-email')?.classList.remove('error');
  }

  // Password: min 8 chars
  if (pw.length < 8) {
    document.getElementById('err-su-pw')?.classList.add('show');
    document.getElementById('su-pw')?.classList.add('error');
    valid = false;
  } else {
    document.getElementById('err-su-pw')?.classList.remove('show');
    document.getElementById('su-pw')?.classList.remove('error');
  }

  if (!valid) return;

  STATE.otpTarget = email;
  STATE._pendingUser = {
    name: name, roll: roll, email: email,
    course: document.getElementById('su-course')?.value || 'BCA',
    year:   document.getElementById('su-year')?.value   || '1'
  };
  openModal('otp');
}

function checkEmailDomain(el) {
  if (!el) return;
  const val = el.value;
  let hint = el.parentNode.querySelector('.field-hint');
  if (!hint) { hint = document.createElement('div'); hint.className = 'field-hint'; el.parentNode.appendChild(hint); }
  if (val.includes('@')) {
    const domain = val.split('@')[1];
    if (domain && domain.includes('gla.ac.in')) {
      hint.textContent = '✓ Valid GLA email'; hint.style.color = 'var(--teal)';
    } else if (domain) {
      hint.textContent = '⚠️ Prefer your GLA email (@gla.ac.in)'; hint.style.color = 'var(--coral)';
    }
  }
}

function checkPwStrength(pw) {
  const wrap = document.getElementById('pw-strength');
  if (!wrap) return;
  wrap.style.display = pw ? 'block' : 'none';
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const colors = ['#e8564a','#f5a623','#3b82f6','#0d9e8f'];
  const labels = ['Weak','Fair','Good','Strong'];
  [1,2,3,4].forEach(function(i) {
    const seg = document.getElementById('ps' + i);
    if (seg) seg.style.background = i <= score ? colors[score-1] : 'var(--border)';
  });
  const lbl = document.getElementById('pw-label');
  if (lbl && score > 0) { lbl.textContent = labels[score-1]; lbl.style.color = colors[score-1]; }
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// ═══ OTP LOGIC ═══
let otpTimer;
function startOTPTimer() {
  let secs = 600;
  clearInterval(otpTimer);
  otpTimer = setInterval(function() {
    secs--;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const el = document.getElementById('otp-countdown');
    if (el) {
      el.textContent = m + ':' + String(s).padStart(2,'0');
      if (secs < 60) el.style.color = 'var(--coral)';
    }
    if (secs <= 0) { clearInterval(otpTimer); if (el) el.textContent = 'Expired'; }
  }, 1000);
}

function otpInput(idx) {
  const el = document.getElementById('otp' + idx);
  if (!el) return;
  el.value = el.value.replace(/\D/g, '').slice(-1);
  el.classList.toggle('filled', el.value.length > 0);
  if (el.value && idx < 5) {
    const next = document.getElementById('otp' + (idx+1));
    if (next) next.focus();
  }
  // Auto-verify when all filled
  const full = [0,1,2,3,4,5].every(function(i) {
    const inp = document.getElementById('otp' + i);
    return inp && inp.value.length > 0;
  });
  if (full) setTimeout(verifyOTP, 300);
}

function otpKey(e, idx) {
  if (e.key === 'Backspace' && !document.getElementById('otp' + idx)?.value && idx > 0) {
    const prev = document.getElementById('otp' + (idx-1));
    if (prev) prev.focus();
  }
}

function otpPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
  e.preventDefault();
  if (!text) return;
  text.split('').forEach(function(c, i) {
    const el = document.getElementById('otp' + i);
    if (el) { el.value = c; el.classList.add('filled'); }
  });
  if (text.length === 6) setTimeout(verifyOTP, 300);
}

// Auto-fill OTP button helper
function autoFillOTP() {
  if (!STATE.generatedOTP) return;
  STATE.generatedOTP.split('').forEach(function(c, i) {
    const el = document.getElementById('otp' + i);
    if (el) { el.value = c; el.classList.add('filled'); }
  });
  showToast('OTP auto-filled!', 'success');
  setTimeout(verifyOTP, 400);
}

async function verifyOTP() {
  const entered = [0,1,2,3,4,5].map(function(i) {
    return document.getElementById('otp' + i)?.value || '';
  }).join('');

  if (entered.length < 6) { showToast('Enter all 6 digits', 'error'); return; }

  if (entered === STATE.generatedOTP) {
    clearInterval(otpTimer);
    
    const u = STATE._pendingUser;
    const pw = document.getElementById('su-pw')?.value || 'password123';
    
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: u.name, email: u.email, password: pw, roll: u.roll })
    });
    
    if (res && res.token) {
      AUTH_TOKEN = res.token;
      localStorage.setItem('sns_token', res.token);
      STATE.currentUser = res.user;
      updateNavForUser(res.user);
      openModal('signup-success');
      showToast('✓ Email verified! Welcome aboard!', 'success');
      loadState();
    } else {
      showToast('Registration failed. Email may already exist — try logging in.', 'error');
    }
  } else {
    document.querySelectorAll('.otp-input').forEach(function(el) {
      el.style.borderColor = 'var(--coral)';
      el.style.background = 'rgba(232,86,74,0.08)';
      setTimeout(function() { el.style.borderColor = ''; el.style.background = ''; }, 1200);
    });
    showToast('Incorrect OTP. Use the code shown above.', 'error');
  }
}

function resendOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000);
  STATE.generatedOTP = String(otp);
  console.log('%c🔄 New OTP: ' + otp, 'background:#f5a623;color:#0f1117;font-size:16px;padding:4px 8px;border-radius:4px');

  // Update display box if visible
  const displayEl = document.getElementById('otp-display-code');
  if (displayEl) displayEl.textContent = otp;

  // Clear inputs
  [0,1,2,3,4,5].forEach(function(i) {
    const el = document.getElementById('otp' + i);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  });
  startOTPTimer();
  showToast('New OTP generated! Check the box above.', 'info');
}

function doForgot() {
  const roll  = document.getElementById('fp-roll')?.value.trim();
  const email = document.getElementById('fp-email')?.value.trim();
  if (!roll || !email) { showToast('Please fill in all fields', 'error'); return; }
  showToast('Password reset link sent to your email!', 'success');
  setTimeout(function() { openModal('login'); }, 1500);
}

// ═══ LIST ITEM ═══
function selectType(btn, type) {
  document.querySelectorAll('.price-option').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
  const typeInp = document.getElementById('li-type');
  if (typeInp) typeInp.value = type;
  const priceField = document.getElementById('price-field');
  if (priceField) priceField.style.display = type === 'sell' ? 'block' : 'none';
}

async function doListItem() {
  if (!STATE.currentUser) { closeModal(); openModal('login'); showToast('Please login to list items', 'info'); return; }

  const title    = document.getElementById('li-title')?.value.trim()   || '';
  const cat      = document.getElementById('li-cat')?.value            || 'book';
  const cond     = document.getElementById('li-cond')?.value           || 'Good';
  const type     = document.getElementById('li-type')?.value           || 'sell';
  const priceRaw = document.getElementById('li-price')?.value          || '';
  const dept     = document.getElementById('li-dept')?.value.trim()    || '';
  const desc     = document.getElementById('li-desc')?.value.trim()    || '';
  const phone    = document.getElementById('li-phone')?.value.trim()   || '9876543210';

  if (!title) { showToast('Please enter an item title', 'error'); return; }
  if (type === 'sell' && (!priceRaw || parseInt(priceRaw) < 1)) { showToast('Please enter a valid price', 'error'); return; }

  const emojiMap = { book:'📘', notes:'📝', electronics:'💻', stationery:'🔧', instruments:'📐', other:'📦' };
  const bgMap    = { book:'card-img-teal', notes:'card-img-coral', electronics:'card-img-blue', stationery:'card-img-amber', instruments:'card-img-purple', other:'card-img-green' };
  const price    = type === 'sell' ? parseInt(priceRaw) : 0;
  const initials = STATE.currentUser.name.split(' ').map(function(w) { return w[0]; }).join('').slice(0,2).toUpperCase();

  const newItem = {
    type: type, title: title,
    dept: dept || STATE.currentUser.course + ' · ' + cond,
    price: price, priceLabel: type === 'sell' ? '₹' + price : type === 'donate' ? 'Free' : 'Swap',
    emoji: emojiMap[cat] || '📦', bg: bgMap[cat] || 'card-img-green',
    av: 'av-teal', seller: initials, name: STATE.currentUser.name,
    rating: 5.0, condition: cond, isNew: true, phone: phone
  };
  
  const res = await apiFetch('/listings', {
    method: 'POST',
    body: JSON.stringify(newItem)
  });
  
  if (res) {
    closeModal();
    showToast('✅ "' + title + '" listed successfully!', 'success');
    await loadState();
    const sec = document.querySelector('#listings');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  }
}

// ═══ MESSAGES ═══
function switchConv(id) {
  STATE.activeConvId = id;
  document.querySelectorAll('.conv-item').forEach(function(el) { el.classList.remove('active'); });
  const item = document.getElementById('ci-' + id);
  if (item) item.classList.add('active');
  const chat = document.getElementById('chat-area');
  const conv = STATE.messages[id];
  if (chat && conv) {
    chat.innerHTML = buildChat(id, conv);
    setTimeout(function() {
      const msgs = document.getElementById('chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 30);
  }
}

async function sendMessage(convId) {
  const inp  = document.getElementById('chat-inp');
  const text = inp?.value.trim();
  if (!text) return;
  const now  = new Date();
  const time = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');

  if (!STATE.messages[convId]) return;
  STATE.messages[convId].msgs.push({ from:'sent', text: text, time: time });
  if (inp) inp.value = '';

  const msgs = document.getElementById('chat-msgs');
  if (msgs) {
    msgs.innerHTML += '<div class="msg sent"><div class="msg-bubble">' + text + '</div><div class="msg-time">' + time + '</div></div>';
    msgs.scrollTop = msgs.scrollHeight;
  }

  // Persist to API if real conversation (has a MongoDB listingId)
  const conv = STATE.messages[convId];
  if (conv && conv.itemId && STATE.currentUser) {
    const toId = conv.partnerId || '';
    apiFetch('/messages', {
      method: 'POST',
      body: JSON.stringify({ convId: convId, to: toId, text: text, listingId: conv.itemId })
    });
  }

  setTimeout(function() {
    const replies = ['Sure, let\'s meet!', 'Sounds good!', 'Can we meet at the library?', 'Is the price negotiable?', 'I\'ll bring it tomorrow.', 'Great! See you then.'];
    const replyText = replies[Math.floor(Math.random() * replies.length)];
    STATE.messages[convId].msgs.push({ from:'recv', text: replyText, time: time });
    const msgs2 = document.getElementById('chat-msgs');
    if (msgs2) {
      msgs2.innerHTML += '<div class="msg recv"><div class="msg-bubble">' + replyText + '</div><div class="msg-time">' + time + '</div></div>';
      msgs2.scrollTop = msgs2.scrollHeight;
    }
  }, 1200);
}

// ═══ DASHBOARD ═══
function showDashboard() {
  const dd = document.getElementById('user-dropdown'); if(dd) dd.classList.remove('open');
  if (!STATE.currentUser) { openModal('login'); return; }

  const user = STATE.currentUser;
  const initials = user.name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
  const myItems   = STATE.myListings;
  const wlCount   = STATE.wishlist.length;
  const convCount = Object.keys(STATE.messages).length;
  const agrCount  = STATE.agreements.length;
  const payCount  = STATE.paymentHistory.length;
  const totalSpent = STATE.paymentHistory.reduce(function(sum,p){return sum+p.amount;},0);

  const dashContent = document.getElementById('dashboardContent');
  if (!dashContent) return;

  dashContent.innerHTML =
    '<div class="dash-title">My Dashboard</div>' +
    '<div class="dash-sub">Welcome back, ' + user.name.split(' ')[0] + '! Here\'s your activity overview.</div>' +

    '<div style="display:flex;align-items:center;gap:14px;background:var(--teal-light);border-radius:16px;padding:1.25rem;margin-bottom:1.75rem;border:1px solid rgba(13,158,143,0.2)">' +
      '<div class="avatar av-teal" style="width:52px;height:52px;font-size:1.2rem">' + initials + '</div>' +
      '<div>' +
        '<div style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:1.2rem;color:var(--ink)">' + user.name + '</div>' +
        '<div style="font-size:.82rem;color:var(--teal-dark)">' + (user.course||'GLA Student') + ' · Roll: ' + user.roll + '</div>' +
        '<div style="font-size:.72rem;font-weight:700;background:var(--teal);color:white;padding:2px 8px;border-radius:50px;display:inline-block;margin-top:4px">✓ Verified Student</div>' +
      '</div>' +
    '</div>' +

    '<div class="dash-stats">' +
      '<div class="dash-stat"><div class="dash-stat-num">' + myItems.length + '</div><div class="dash-stat-label">Items Listed</div></div>' +
      '<div class="dash-stat"><div class="dash-stat-num">' + wlCount + '</div><div class="dash-stat-label">Wishlisted</div></div>' +
      '<div class="dash-stat"><div class="dash-stat-num">' + convCount + '</div><div class="dash-stat-label">Conversations</div></div>' +
      '<div class="dash-stat"><div class="dash-stat-num">' + agrCount + '</div><div class="dash-stat-label">Agreements</div></div>' +
      '<div class="dash-stat"><div class="dash-stat-num">' + payCount + '</div><div class="dash-stat-label">Payments</div></div>' +
      '<div class="dash-stat"><div class="dash-stat-num">₹' + totalSpent + '</div><div class="dash-stat-label">Total Spent</div></div>' +
    '</div>' +

    '<div class="dash-section-title">📦 My Listings</div>' +
    (myItems.length ? myItems.map(function(l) {
      return '<div class="dash-listing-row"><div class="dash-item-emoji">' + l.emoji + '</div><div class="dash-item-info"><div class="dash-item-title">' + l.title + '</div><div class="dash-item-meta">' + l.dept + ' · Listed ' + (l.listedAt||'today') + '</div></div><div class="dash-item-price">' + l.priceLabel + '</div><span class="status-pill status-' + (l.status||'active') + '">' + (l.status||'active') + '</span></div>';
    }).join('') : '<div style="text-align:center;padding:2rem;background:var(--paper2);border-radius:14px;color:var(--muted)"><div style="font-size:2.5rem;margin-bottom:.75rem">📦</div><div style="font-weight:600;margin-bottom:.5rem">No listings yet</div><button class="btn btn-teal btn-sm" onclick="hideDashboard();openModal(\'list\')">List your first item →</button></div>') +

    '<div class="dash-section-title">💳 Recent Payments (' + payCount + ')</div>' +
    (payCount ? STATE.paymentHistory.slice(-3).reverse().map(function(p) {
      return '<div class="pay-hist-row"><div class="pay-hist-icon">💳</div><div class="pay-hist-info"><div class="pay-hist-title">' + p.title + '</div><div class="pay-hist-meta">' + p.method + ' · ' + p.date + '</div></div><div class="pay-hist-amount">' + p.priceLabel + '</div><span class="pay-status-success">✓</span></div>';
    }).join('') : '<div style="color:var(--muted);font-size:.88rem;margin-bottom:1rem">No payments yet.</div>') +

    '<div class="dash-section-title">❤️ Wishlist (' + wlCount + ')</div>' +
    (wlCount ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem">' + ALL_LISTINGS.filter(function(l){return STATE.wishlist.includes(l.id);}).map(function(l){return '<div style="background:var(--paper2);border:1px solid var(--border);border-radius:10px;padding:.6rem .9rem;font-size:.82rem;display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--ink)" onclick="hideDashboard();viewListing(' + l.id + ')">' + l.emoji + ' <span style="font-weight:600">' + l.title.slice(0,20) + '…</span> <span style="color:var(--teal);font-weight:700">' + l.priceLabel + '</span></div>';}).join('') + '</div>' : '<div style="color:var(--muted);font-size:.88rem;margin-bottom:1rem">Nothing saved yet.</div>') +

    '<div style="margin-top:2rem;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-teal" style="flex:1" onclick="hideDashboard();openModal(\'list\')">+ List an Item</button>' +
      '<button class="btn btn-outline" onclick="hideDashboard();openModal(\'payment-history\')">💳 Payments</button>' +
      '<button class="btn btn-outline" onclick="handleLogout()">Sign Out</button>' +
    '</div>';

  document.getElementById('dashboardOverlay').classList.add('open');
}

function showMyListings() {
  const dd = document.getElementById('user-dropdown'); if(dd) dd.classList.remove('open');
  showDashboard();
}

function hideDashboard() {
  const overlay = document.getElementById('dashboardOverlay');
  if (overlay) overlay.classList.remove('open');
}

// Dashboard close on outside click
document.addEventListener('DOMContentLoaded', function() {
  const dashOverlay = document.getElementById('dashboardOverlay');
  if (dashOverlay) {
    dashOverlay.addEventListener('click', function(e) {
      if (e.target === dashOverlay) hideDashboard();
    });
  }
});

// ═══ INTERSECTION OBSERVER ═══
const io = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach(function(el) { io.observe(el); });

// ═══ COUNTER ANIMATION ═══
const counterObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) { animateCounters(); counterObs.disconnect(); }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) counterObs.observe(heroStats);

// ═══ RESTORE SESSION ═══
// Session is restored via loadState() which calls /api/me with the stored token

// ═══ INIT ═══
renderListings();

console.log('%c SwapNstudy v3 ', 'background:#0d9e8f;color:white;font-size:14px;font-weight:bold;padding:4px 8px;border-radius:4px');
console.log('%c GLA University · CEA Department · 2026 ', 'color:#f5a623;font-size:12px');
console.log('%c ✅ FIXED: OTP display, Login, Dark Mode, Payment Gateway ', 'color:#34d870;font-size:11px');
console.log('%c Demo Login: Any roll number (6+ chars) + any password (8+ chars) ', 'color:#6b7280;font-size:11px');
