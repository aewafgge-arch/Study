const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roll: { type: String, default: '' },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
  notifications: [{ listingId: mongoose.Schema.Types.ObjectId, addedAt: Date }],
}, { timestamps: true });

const ListingSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['sell','donate','swap'] },
  title: { type: String, required: true },
  dept: { type: String, default: '' },
  price: { type: Number, default: 0 },
  priceLabel: { type: String, default: 'Free' },
  emoji: { type: String, default: '📦' },
  bg: { type: String, default: 'card-img-teal' },
  av: { type: String, default: 'av-teal' },
  seller: { type: String, default: '' },           // initials
  name: { type: String, default: '' },             // full name
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, default: 5.0 },
  condition: { type: String, default: 'Good' },
  isNew: { type: Boolean, default: true },
  phone: { type: String, default: '' },
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  convId: { type: String, required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
}, { timestamps: true });

const PaymentSchema = new mongoose.Schema({
  txnId: { type: String, required: true, unique: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  title: String,
  amount: Number,
  priceLabel: String,
  seller: String,
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  buyer: String,
  method: String,
  status: { type: String, default: 'success' },
}, { timestamps: true });

const AgreementSchema = new mongoose.Schema({
  agreementId: { type: String, required: true, unique: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  title: String,
  priceLabel: String,
  seller: String,
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  buyer: String,
  status: { type: String, default: 'pending' },
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', UserSchema),
  Listing: mongoose.model('Listing', ListingSchema),
  Message: mongoose.model('Message', MessageSchema),
  Payment: mongoose.model('Payment', PaymentSchema),
  Agreement: mongoose.model('Agreement', AgreementSchema),
};
