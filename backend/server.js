require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Listing, Payment, Agreement, Message } = require('./models');

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/swapnstudy')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// ── Middleware ──
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.userId = jwt.verify(token, JWT_SECRET).userId; next(); }
  catch (e) { res.status(401).json({ error: 'Invalid token' }); }
};

// ── Auth ──
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, roll } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const user = new User({ name, email, password: await bcrypt.hash(password, 8), roll });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ user, token });
  } catch (e) { res.status(400).json({ error: 'Registration failed.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ user, token });
  } catch (e) { res.status(400).json({ error: 'Login failed' }); }
});

// ── Me ──
app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('wishlist');
    const listings = await Listing.find({ sellerId: req.userId }).sort({ createdAt: -1 });
    const payments = await Payment.find({ buyerId: req.userId }).sort({ createdAt: -1 });
    const agreements = await Agreement.find({ buyerId: req.userId }).sort({ createdAt: -1 });
    res.json({ user, listings, payments, agreements });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ── Listings ──
app.get('/api/listings', async (req, res) => {
  try { res.json(await Listing.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/listings/:id', async (req, res) => {
  try { res.json(await Listing.findById(req.params.id)); }
  catch (e) { res.status(404).json({ error: 'Not found' }); }
});

app.post('/api/listings', auth, async (req, res) => {
  try {
    const listing = new Listing({ ...req.body, sellerId: req.userId });
    await listing.save();
    res.json(listing);
  } catch (e) { res.status(400).json({ error: 'Could not create listing' }); }
});

app.delete('/api/listings/:id', auth, async (req, res) => {
  try {
    await Listing.findOneAndDelete({ _id: req.params.id, sellerId: req.userId });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: 'Could not delete' }); }
});

// ── Wishlist ──
app.post('/api/wishlist/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const idx = user.wishlist.indexOf(req.params.id);
    if (idx > -1) user.wishlist.splice(idx, 1);
    else user.wishlist.push(req.params.id);
    await user.save();
    res.json(user.wishlist);
  } catch (e) { res.status(400).json({ error: 'Wishlist error' }); }
});

// ── Notifications ──
app.post('/api/notifications/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const idx = user.notifications.findIndex(
      n => n.listingId && n.listingId.toString() === req.params.id
    );
    if (idx > -1) user.notifications.splice(idx, 1);
    else user.notifications.push({ listingId: req.params.id, addedAt: new Date() });
    await user.save();
    res.json(user.notifications);
  } catch (e) { res.status(400).json({ error: 'Notification error' }); }
});

// ── Payments ──
app.get('/api/payments', auth, async (req, res) => {
  try { res.json(await Payment.find({ buyerId: req.userId }).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/payments', auth, async (req, res) => {
  try {
    const payment = new Payment({ ...req.body, buyerId: req.userId });
    await payment.save();
    res.json(payment);
  } catch (e) { res.status(400).json({ error: 'Payment save failed' }); }
});

// ── Agreements ──
app.get('/api/agreements', auth, async (req, res) => {
  try { res.json(await Agreement.find({ buyerId: req.userId }).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/agreements', auth, async (req, res) => {
  try {
    const agreement = new Agreement({ ...req.body, buyerId: req.userId });
    await agreement.save();
    res.json(agreement);
  } catch (e) { res.status(400).json({ error: 'Agreement save failed' }); }
});

// ── Messages ──
app.get('/api/messages/:convId', auth, async (req, res) => {
  try { res.json(await Message.find({ convId: req.params.convId }).sort({ createdAt: 1 })); }
  catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/messages', auth, async (req, res) => {
  try {
    const msg = new Message({ ...req.body, from: req.userId });
    await msg.save();
    res.json(msg);
  } catch (e) { res.status(400).json({ error: 'Message send failed' }); }
});

// ── Seed ──
app.post('/api/seed', async (req, res) => {
  if (await Listing.countDocuments() > 0) return res.json({ message: 'Already seeded' });
  await Listing.insertMany([
    { type:'sell', title:'Data Structures & Algorithms', dept:'BCA 3rd Sem · Karumanchi', price:180, priceLabel:'₹180', emoji:'📘', bg:'card-img-teal', av:'av-teal', seller:'HG', name:'Harshita G.', rating:4.8, condition:'Good', isNew:true, phone:'9876543210' },
    { type:'donate', title:'Physics Lab Manual', dept:'B.Tech 1st Yr · Complete', price:0, priceLabel:'Free', emoji:'📗', bg:'card-img-green', av:'av-amber', seller:'HR', name:'Hina R.', rating:4.9, condition:'Like New', isNew:false, phone:'9876543211' },
    { type:'swap', title:'Casio fx-991 Calculator', dept:'Engineering · Barely used', price:0, priceLabel:'Swap', emoji:'🔢', bg:'card-img-amber', av:'av-coral', seller:'JY', name:'Jaya', rating:4.7, condition:'Good', isNew:true, phone:'9876543212' },
    { type:'sell', title:'C++ Programming Guide', dept:'BCA 2nd Sem · Balaguruswamy', price:120, priceLabel:'₹120', emoji:'💻', bg:'card-img-blue', av:'av-teal', seller:'AK', name:'Ankit K.', rating:4.5, condition:'Fair', isNew:false, phone:'9876543213' },
    { type:'donate', title:'English Semester Notes', dept:'All branches · Handwritten', price:0, priceLabel:'Free', emoji:'📝', bg:'card-img-coral', av:'av-amber', seller:'PR', name:'Priya R.', rating:4.6, condition:'Like New', isNew:false, phone:'9876543214' },
    { type:'swap', title:'Drawing Board + Set Square', dept:'B.Tech · Engineering Drawing', price:0, priceLabel:'Swap', emoji:'📐', bg:'card-img-purple', av:'av-coral', seller:'MS', name:'Mohit S.', rating:4.3, condition:'Good', isNew:false, phone:'9876543215' },
    { type:'sell', title:'Operating System Concepts', dept:'BCA 4th Sem · Galvin 10th Ed.', price:200, priceLabel:'₹200', emoji:'📙', bg:'card-img-teal', av:'av-teal', seller:'RK', name:'Rahul K.', rating:4.7, condition:'Good', isNew:true, phone:'9876543216' },
    { type:'donate', title:'DBMS Complete Notes', dept:'5th Sem · All units covered', price:0, priceLabel:'Free', emoji:'📔', bg:'card-img-green', av:'av-purple', seller:'SK', name:'Sonal K.', rating:4.9, condition:'Like New', isNew:false, phone:'9876543217' },
    { type:'sell', title:'Raspberry Pi 4 Starter Kit', dept:'Electronics · IoT & Embedded', price:850, priceLabel:'₹850', emoji:'🔌', bg:'card-img-amber', av:'av-teal', seller:'VJ', name:'Vikas J.', rating:4.4, condition:'Good', isNew:true, phone:'9876543218' },
    { type:'swap', title:'Engineering Chemistry Book', dept:'B.Tech 1st Yr · Jain & Jain', price:0, priceLabel:'Swap', emoji:'🧪', bg:'card-img-coral', av:'av-coral', seller:'NA', name:'Neha A.', rating:4.6, condition:'Fair', isNew:false, phone:'9876543219' },
    { type:'sell', title:'MATLAB Student Edition', dept:'EEE/ECE · Licensed key included', price:150, priceLabel:'₹150', emoji:'📊', bg:'card-img-blue', av:'av-amber', seller:'DS', name:'Dev S.', rating:4.8, condition:'Like New', isNew:true, phone:'9876543220' },
    { type:'donate', title:'Mathematics Handwritten Notes', dept:'1st Year · All theorems included', price:0, priceLabel:'Free', emoji:'📐', bg:'card-img-purple', av:'av-green', seller:'KT', name:'Kavya T.', rating:4.5, condition:'Good', isNew:false, phone:'9876543221' }
  ]);
  res.json({ message: 'Seeded successfully' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
