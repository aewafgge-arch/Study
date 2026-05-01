const fs = require('fs');

try {
// 1. Fix backend/server.js
const serverJsPath = 'backend/server.js';
let serverCode = fs.readFileSync(serverJsPath, 'utf8');

serverCode = serverCode.replace(/\/\/ --- MODELS ---[\s\S]*?\/\/ --- MIDDLEWARE ---/, `const { User, Listing, Payment, Agreement, Message } = require('./models');

// --- MIDDLEWARE ---`);

serverCode = serverCode.replace(/app\.get\('\/api\/listings'.*?}\);/s, `app.get('/api/listings', async (req, res) => { res.json(await Listing.find().sort({createdAt:-1})); });`);

serverCode = serverCode.replace(/app\.get\('\/api\/me'.*?}\);/s, `app.get('/api/me', auth, async (req, res) => {
  const user = await User.findById(req.userId).populate('wishlist');
  const listings = await Listing.find({ sellerId: req.userId });
  const payments = await Payment.find({ buyerId: req.userId });
  const agreements = await Agreement.find({ buyerId: req.userId });
  res.json({ user, listings, payments, agreements });
});`);

if (!serverCode.includes('/api/seed')) {
  serverCode += `
app.post('/api/messages', auth, async (req, res) => {
  const msg = new Message({ convId: req.body.convId, from: req.userId, to: req.body.to, text: req.body.text, listingId: req.body.listingId });
  await msg.save();
  res.json(msg);
});
app.get('/api/messages/:convId', auth, async (req, res) => {
  res.json(await Message.find({ convId: req.params.convId }).sort({createdAt:1}));
});
app.post('/api/seed', async (req, res) => {
  const c = await Listing.countDocuments();
  if (c > 0) return res.json({msg: 'Already seeded'});
  const ALL_LISTINGS = [
    { type:'sell', title:'Data Structures & Algorithms', dept:'BCA 3rd Sem · Karumanchi', price:180, priceLabel:'₹180', emoji:'📘', bg:'card-img-teal', av:'av-teal', seller:'HG', name:'Harshita G.', rating:4.8, condition:'Good', isNew:true, phone:'9876543210' },
    { type:'donate', title:'Physics Lab Manual', dept:'B.Tech 1st Yr · Complete', price:0, priceLabel:'Free', emoji:'📗', bg:'card-img-green', av:'av-amber', seller:'HR', name:'Hina R.', rating:4.9, condition:'Like New', isNew:false, phone:'9876543211' },
    { type:'swap', title:'Casio fx-991 Calculator', dept:'Engineering · Barely used', price:0, priceLabel:'Swap', emoji:'🔢', bg:'card-img-amber', av:'av-coral', seller:'JY', name:'Jaya', rating:4.7, condition:'Good', isNew:true, phone:'9876543212' },
    { type:'sell', title:'C++ Programming Guide', dept:'BCA 2nd Sem · Balaguruswamy', price:120, priceLabel:'₹120', emoji:'💻', bg:'card-img-blue', av:'av-teal', seller:'AK', name:'Ankit K.', rating:4.5, condition:'Fair', isNew:false, phone:'9876543213' },
    { type:'donate', title:'English Semester Notes', dept:'All branches · Handwritten', price:0, priceLabel:'Free', emoji:'📝', bg:'card-img-coral', av:'av-amber', seller:'PR', name:'Priya R.', rating:4.6, condition:'Like New', isNew:false, phone:'9876543214' },
    { type:'swap', title:'Drawing Board + Set Square', dept:'B.Tech · Engineering Drawing', price:0, priceLabel:'Swap', emoji:'📐', bg:'card-img-purple', av:'av-coral', seller:'MS', name:'Mohit S.', rating:4.3, condition:'Good', isNew:false, phone:'9876543215' }
  ];
  await Listing.insertMany(ALL_LISTINGS);
  res.json({msg: 'Seeded'});
});
`;
}
fs.writeFileSync(serverJsPath, serverCode);

// 2. Fix script.js
const scriptJsPath = 'script.js';
let scriptCode = fs.readFileSync(scriptJsPath, 'utf8');

const loadStateReplacement = `
const API_URL = 'http://localhost:5000/api';
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
  try { STATE.isDark = localStorage.getItem('sns_dark') === 'true'; } catch(e) { STATE.isDark = false; }
  try { STATE.notifications = JSON.parse(localStorage.getItem('sns_notifications') || '[]'); } catch(e) { STATE.notifications = []; }
  
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
  
  // Seed DB if empty
  await apiFetch('/seed', { method: 'POST' });
  
  // Fetch ALL_LISTINGS
  const listings = await apiFetch('/listings');
  if (listings) {
    ALL_LISTINGS.length = 0;
    listings.forEach(l => {
      l.id = l._id;
      ALL_LISTINGS.push(l);
    });
  }
  
  renderListings();
}
`;

if (!scriptCode.includes('apiFetch')) {
  scriptCode = scriptCode.replace(/function loadState\(\) \{[\s\S]*?loadState\(\);/s, loadStateReplacement + '\nloadState();');
  scriptCode = scriptCode.replace(/const ALL_LISTINGS = \[[\s\S]*?\];/s, 'const ALL_LISTINGS = [];');
  
  scriptCode = scriptCode.replace(/function handleLogout\(\) \{[\s\S]*?renderListings\(\);\n\}/s, `function handleLogout() {
  STATE.currentUser = null;
  AUTH_TOKEN = null;
  localStorage.removeItem('sns_token');
  updateNavForUser(null);
  closeModal();
  hideDashboard();
  const dd = document.getElementById('user-dropdown'); if(dd) dd.classList.remove('open');
  showToast('Signed out. See you soon!', 'info');
  renderListings();
}`);

  scriptCode = scriptCode.replace(/function completeLogin\(user\) \{[\s\S]*?renderListings\(\);\n\}/s, `function completeLogin(user, token) {
  STATE.currentUser = user;
  AUTH_TOKEN = token;
  localStorage.setItem('sns_token', token);
  updateNavForUser(user);
  closeModal();
  showToast('Welcome back, ' + user.name.split(' ')[0] + '! 👋', 'success');
  loadState(); // reload data
}`);

  scriptCode = scriptCode.replace(/function doLogin\(\) \{[\s\S]*?completeLogin\(demoUser\);\n\}/s, `async function doLogin() {
  const rollEl = document.getElementById('login-roll');
  const pwEl   = document.getElementById('login-pw');
  const errRoll = document.getElementById('err-roll');
  const errPw   = document.getElementById('err-pw');
  if (!rollEl || !pwEl) return;
  const roll = rollEl.value.trim();
  const pw   = pwEl.value;
  const rollOk = roll.length >= 6;
  const pwOk   = pw.length >= 8;
  if (errRoll) errRoll.classList.toggle('show', !rollOk);
  if (errPw)   errPw.classList.toggle('show',   !pwOk);
  rollEl.classList.toggle('error', !rollOk);
  pwEl.classList.toggle('error',   !pwOk);
  if (!rollOk || !pwOk) return;
  
  // Use backend auth
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
}`);

  scriptCode = scriptCode.replace(/function verifyOTP\(\) \{[\s\S]*?renderListings\(\);\n  \} else \{/s, `async function verifyOTP() {
  const entered = [0,1,2,3,4,5].map(i => document.getElementById('otp' + i)?.value || '').join('');
  if (entered.length < 6) { showToast('Enter all 6 digits', 'error'); return; }
  if (entered === STATE.generatedOTP) {
    clearInterval(otpTimer);
    
    // Register user on backend
    const u = STATE._pendingUser;
    const pw = document.getElementById('su-pw')?.value || 'password123';
    
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: u.name, email: u.email, password: pw, roll: u.roll })
    });
    
    if (res && res.token) {
      STATE.currentUser = res.user;
      AUTH_TOKEN = res.token;
      localStorage.setItem('sns_token', res.token);
      updateNavForUser(res.user);
      openModal('signup-success');
      showToast('✓ Email verified! Welcome aboard!', 'success');
      loadState();
    } else {
      showToast('Registration failed on server.', 'error');
    }
  } else {`);

  scriptCode = scriptCode.replace(/function toggleWishlist\(e, id\) \{[\s\S]*?renderListings\(\);\n\}/s, `async function toggleWishlist(e, id) {
  e.stopPropagation();
  if (!STATE.currentUser) { openModal('login'); showToast('Please login to save items', 'info'); return; }
  const res = await apiFetch('/wishlist/' + id, { method: 'POST' });
  if (res) {
    STATE.wishlist = res;
    showToast('Wishlist updated!', 'success');
    renderListings();
  }
}`);

  scriptCode = scriptCode.replace(/function doListItem\(\) \{[\s\S]*?sec\.scrollIntoView\(\{ behavior: 'smooth' \}\);\n\}/s, `async function doListItem() {
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
  const initials = STATE.currentUser.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

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
    showToast('✅ \"' + title + '\" listed successfully!', 'success');
    await loadState();
    const sec = document.querySelector('#listings');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  }
}`);

  scriptCode = scriptCode.replace(/setTimeout\(function\(\) \{\n    const txnId[\s\S]*?2200\);/s, `setTimeout(async function() {
    const txnId = 'SNS' + Date.now().toString(36).toUpperCase();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
    const methodLabels = { upi:'UPI', card:'Card', wallet:'Wallet', netbanking:'Net Banking' };

    const payRecord = {
      txnId, listingId: l.id, title: l.title, amount: l.price, priceLabel: l.priceLabel,
      seller: l.name, buyer: STATE.currentUser.name,
      method: methodLabels[method] || method,
      status: 'success'
    };
    
    await apiFetch('/payments', {
      method: 'POST',
      body: JSON.stringify(payRecord)
    });
    
    await loadState();

    document.getElementById('modalContent').innerHTML =
      '<div class=\"payment-success\">' +
        '<div class=\"success-circle\">✅</div>' +
        '<div class=\"modal-title\" style=\"margin-bottom:.25rem\">Payment Successful!</div>' +
        '<div style=\"font-size:.9rem;color:var(--muted);margin-bottom:1.5rem\">Your transaction is confirmed</div>' +
        '<div class=\"txn-card\">' +
          '<div style=\"font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem\">Transaction Details</div>' +
          '<div class=\"txn-row\"><span class=\"txn-label\">Transaction ID</span><span class=\"txn-val\" style=\"font-family:monospace;font-size:.82rem;color:var(--teal)\">' + txnId + '</span></div>' +
          '<div class=\"txn-row\"><span class=\"txn-label\">Item</span><span class=\"txn-val\">' + l.title + '</span></div>' +
          '<div class=\"txn-row\"><span class=\"txn-label\">Amount Paid</span><span class=\"txn-val\" style=\"color:var(--teal);font-family:\\'Syne\\',sans-serif;font-weight:800\">' + l.priceLabel + '</span></div>' +
        '</div>' +
        '<div style=\"display:flex;gap:8px;margin-top:1rem;flex-wrap:wrap\">' +
          '<button class=\"btn btn-outline\" onclick=\"closeModal()\" style=\"flex:0 0 auto\">Done</button>' +
        '</div>' +
      '</div>';
      
    showToast('💳 Payment successful!', 'success');
  }, 1000);`);

  scriptCode = scriptCode.replace(/function saveAgreementRecord\(listingId, agreementId\) \{[\s\S]*?showToast\('📄 Agreement saved!', 'success'\);\n\}/s, `async function saveAgreementRecord(listingId, agreementId) {
  const l = ALL_LISTINGS.find(x => x.id === listingId) || STATE.myListings.find(x => x.id === listingId);
  if (!l) return;
  await apiFetch('/agreements', {
    method: 'POST',
    body: JSON.stringify({ agreementId, listingId: l.id, title: l.title, priceLabel: l.priceLabel, seller: l.name, buyer: STATE.currentUser.name, status: 'pending' })
  });
  await loadState();
  showToast('📄 Agreement saved!', 'success');
}`);

  fs.writeFileSync(scriptJsPath, scriptCode);
}
} catch(e) { console.error(e) }
