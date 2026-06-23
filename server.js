'use strict';

const path      = require('path');
const express   = require('express');
const http      = require('http');
const { Server} = require('socket.io');
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI        = process.env.MONGO_URI  || 'mongodb://127.0.0.1:27017/travelguru';
const JWT_SECRET       = process.env.JWT_SECRET || 'travelguru_secret_2025';
const ADMIN_ID         = process.env.ADMIN_ID   || 'admin@travelguru.in';
const ADMIN_PASS       = process.env.ADMIN_PASS || 'Admin@TG2025#Secure';
const GOOGLE_MAPS_KEY  = process.env.GOOGLE_MAPS_API_KEY || '';
const PORT             = process.env.PORT       || 8080;

/* ── MongoDB Connection with retry ──────────────────────── */
async function connectDB() {
  const opts = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS:         10000,
    socketTimeoutMS:          45000,
  };

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await mongoose.connect(MONGO_URI, opts);
      console.log('✅  MongoDB connected →', MONGO_URI);
      return;
    } catch (err) {
      console.error(`❌  MongoDB attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt === 5) {
        console.error('\n  ── CANNOT CONNECT TO MONGODB ──────────────────────');
        console.error('  Make sure MongoDB is running. Quick fix:');
        console.error('  1. Install Docker Desktop → https://www.docker.com/products/docker-desktop');
        console.error('  2. Run: docker-compose up -d   (from the travelguru-v5 folder)');
        console.error('  3. Then restart: node server.js');
        console.error('  ───────────────────────────────────────────────────\n');
        process.exit(1);
      }
      const wait = attempt * 2000;
      console.log(`   Retrying in ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

/* ── Schemas ─────────────────────────────────────────────── */
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  homeState: { type: String, default: '' },
  wishlist:  [{ type: Number }],
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const placeSchema = new mongoose.Schema({
  placeId:     { type: Number, required: true, unique: true },
  name:        { type: String, required: true },
  state:       { type: String, required: true, index: true },
  category:    { type: String, required: true, index: true },
  emoji:       { type: String, default: '📍' },
  bg:          { type: String, default: 'linear-gradient(135deg,#667eea,#764ba2)' },
  img:         { type: String, default: '' },
  desc:        { type: String, default: '' },
  history:     { type: String, default: '' },
  bestTime:    { type: String, default: '' },
  difficulty:  { type: String, default: 'Easy' },
  nearestCity: { type: String, default: '' },
  entryFee:    { type: String, default: 'Free' },
  featured:    { type: Boolean, default: false, index: true },
  lat:         Number,
  lng:         Number,
}, { timestamps: true });
const Place = mongoose.model('Place', placeSchema);

const hotelSchema = new mongoose.Schema({
  placeId:       { type: Number, required: true, index: true },
  name:          { type: String, required: true },
  type:          { type: String, default: 'Hotel' },
  stars:         { type: Number, default: 3, min: 1, max: 5 },
  pricePerNight: { type: String, default: '' },
  address:       { type: String, default: '' },
  phone:         { type: String, default: '' },
  website:       { type: String, default: '' },
  img:           { type: String, default: '' },
  amenities:     [String],
  mapLink:       { type: String, default: '' },
}, { timestamps: true });
const Hotel = mongoose.model('Hotel', hotelSchema);

const restaurantSchema = new mongoose.Schema({
  placeId:    { type: Number, required: true, index: true },
  name:       { type: String, required: true },
  cuisine:    { type: String, default: '' },
  priceRange: { type: String, default: '₹₹' },
  rating:     { type: Number, default: 3, min: 1, max: 5 },
  address:    { type: String, default: '' },
  phone:      { type: String, default: '' },
  website:    { type: String, default: '' },
  img:        { type: String, default: '' },
  specialty:  { type: String, default: '' },
  timing:     { type: String, default: '' },
  mapLink:    { type: String, default: '' },
}, { timestamps: true });
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

const budgetSchema = new mongoose.Schema({
  placeId:    { type: Number, required: true, unique: true },
  budgetMin:  { type: Number, default: 0 },
  budgetMid:  { type: Number, default: 0 },
  budgetLux:  { type: Number, default: 0 },
  hotel:      { type: String, default: '' },
  food:       { type: String, default: '' },
  transport:  { type: String, default: '' },
  idealDays:  { type: Number, default: 2 },
  notes:      { type: String, default: '' },
}, { timestamps: true });
const Budget = mongoose.model('Budget', budgetSchema);

const tipSchema = new mongoose.Schema({
  placeId:  { type: Number, required: true, index: true },
  category: { type: String, default: 'General' },
  tip:      { type: String, required: true },
  priority: { type: Number, default: 1 },
}, { timestamps: true });
const Tip = mongoose.model('Tip', tipSchema);

const msgSchema = new mongoose.Schema({
  room:       { type: String, required: true, index: true },
  placeId:    { type: Number, required: true },
  travelDate: { type: String, required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username:   { type: String, required: true },
  text:       { type: String, required: true, maxlength: 500 },
}, { timestamps: true });
const Message = mongoose.model('Message', msgSchema);

const tripSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  placeId:    { type: Number, required: true },
  travelDate: { type: String, required: true },
  notes:      { type: String, default: '' },
}, { timestamps: true });
const Trip = mongoose.model('Trip', tripSchema);

/* ── AUTO-ENRICH HELPERS (real images + nearby hotels/restaurants) ── */
const UA = 'TravelGuru/7.0 (contact: admin@travelguru.in)';
const PLACEHOLDER_IMG = 'No_Image_Available';

function isMissingImg(img) {
  return !img || img.includes(PLACEHOLDER_IMG);
}

// Find a real photo for a place via Wikipedia (prefer) or Wikimedia Commons as fallback.
async function fetchWikiImage(name, state) {
  try {
    const query = `${name} ${state || ''}`.trim();
    // 1) Try English Wikipedia pageimages (gives a reasonably sized thumbnail)
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`;
    const sRes = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    const sData = await sRes.json();
    const title = sData?.query?.search?.[0]?.title;
    if (title) {
      const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=2000`;
      const iRes = await fetch(imgUrl, { headers: { 'User-Agent': UA } });
      const iData = await iRes.json();
      const pages = iData?.query?.pages || {};
      const page = Object.values(pages)[0];
      const thumb = page?.thumbnail?.source;
      if (thumb) return thumb;
    }
    // 2) Fallback: search Wikimedia Commons (file namespace) for an image file
    const commonsImg = await fetchCommonsImage(name, state);
    if (commonsImg) return commonsImg;
    // 3) Optional: Google Custom Search Image (if API key + cx provided)
    const googleImg = await fetchGoogleImage(name, state);
    if (googleImg) return googleImg;
    return null;
  } catch (e) {
    console.error('fetchWikiImage error:', e.message);
    return null;
  }
}

// Search Wikimedia Commons for an image file matching the place name and return its direct image URL.
async function fetchCommonsImage(name, state) {
  try {
    const query = `${name} ${state || ''}`.trim();
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=1`;
    const sRes = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    const sData = await sRes.json();
    const title = sData?.query?.search?.[0]?.title; // e.g. "File:Something.jpg"
    if (!title) return null;
    const imgInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
    const iRes = await fetch(imgInfoUrl, { headers: { 'User-Agent': UA } });
    const iData = await iRes.json();
    const pages = iData?.query?.pages || {};
    const page = Object.values(pages)[0];
    const url = page?.imageinfo?.[0]?.url;
    return url || null;
  } catch (e) {
    console.error('fetchCommonsImage error:', e.message);
    return null;
  }
}

// Optional: Google Custom Search (Image) fallback when API key and CX are provided in env.
async function fetchGoogleImage(name, state) {
  try {
    const key = process.env.GOOGLE_API_KEY;
    const cx  = process.env.GOOGLE_CX;
    if (!key || !cx) return null;
    const query = `${name} ${state || ''}`.trim();
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&searchType=image&num=1`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    const link = data?.items?.[0]?.link;
    return link || null;
  } catch (e) {
    console.error('fetchGoogleImage error:', e.message);
    return null;
  }
}

// Geocode a place name (Nominatim/OSM) when lat/lng are missing
async function geocodePlace(name, state) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name + ', ' + (state || '') + ', India')}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    if (data?.[0]) return { lat: +data[0].lat, lng: +data[0].lon };
    return null;
  } catch (e) {
    console.error('geocodePlace error:', e.message);
    return null;
  }
}

// Find real nearby hotels & restaurants via OpenStreetMap Overpass API
async function fetchNearbyOSM(lat, lng, radiusM = 8000) {
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"="hotel"](around:${radiusM},${lat},${lng});
      node["tourism"="guest_house"](around:${radiusM},${lat},${lng});
      node["amenity"="restaurant"](around:${radiusM},${lat},${lng});
    );
    out body 30;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': UA },
      body: query,
    });
    const data = await res.json();
    const elements = data?.elements || [];
    const hotels = [];
    const restaurants = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const addrParts = [tags['addr:street'], tags['addr:city'] || tags['addr:suburb']].filter(Boolean);
      const address = addrParts.join(', ') || 'Address not listed';
      if (!tags.name) continue;
      if (tags.tourism === 'hotel' || tags.tourism === 'guest_house') {
        hotels.push({
          name: tags.name,
          type: tags.tourism === 'hotel' ? 'Hotel' : 'Guest House',
          stars: tags.stars ? +tags.stars : 3,
          pricePerNight: '',
          address,
          phone: tags.phone || tags['contact:phone'] || '',
          website: tags.website || tags['contact:website'] || '',
          amenities: [],
          mapLink: `https://www.openstreetmap.org/?mlat=${el.lat}&mlon=${el.lon}#map=18/${el.lat}/${el.lon}`,
        });
      } else if (tags.amenity === 'restaurant') {
        restaurants.push({
          name: tags.name,
          cuisine: tags.cuisine ? String(tags.cuisine).replace(/_/g, ' ') : 'Multi-cuisine',
          priceRange: '₹₹',
          rating: 4,
          address,
          phone: tags.phone || tags['contact:phone'] || '',
          website: tags.website || tags['contact:website'] || '',
          specialty: '',
          timing: tags.opening_hours || '',
          mapLink: `https://www.openstreetmap.org/?mlat=${el.lat}&mlon=${el.lon}#map=18/${el.lat}/${el.lon}`,
        });
      }
    }
    return { hotels: hotels.slice(0, 8), restaurants: restaurants.slice(0, 8) };
  } catch (e) {
    console.error('fetchNearbyOSM error:', e.message);
    return { hotels: [], restaurants: [] };
  }
}

async function fetchNearbyGooglePlaces(lat, lng, radiusM = 8000) {
  if (!GOOGLE_MAPS_KEY) return { hotels: [], restaurants: [] };
  const base = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const results = { hotels: [], restaurants: [] };
  const fetchType = async (type, maxPages = 3) => {
    let pageToken = '';
    let items = [];
    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL(base);
      url.searchParams.set('key', GOOGLE_MAPS_KEY);
      url.searchParams.set('location', `${lat},${lng}`);
      url.searchParams.set('radius', String(radiusM));
      url.searchParams.set('type', type);
      if (pageToken) url.searchParams.set('pagetoken', pageToken);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') break;
      items = items.concat(data.results || []);
      pageToken = data.next_page_token || '';
      if (!pageToken) break;
      await new Promise(r => setTimeout(r, 2200));
    }
    return items;
  };

  try {
    const [hotelPlaces, restaurantPlaces] = await Promise.all([
      fetchType('lodging'),
      fetchType('restaurant'),
    ]);

    results.hotels = hotelPlaces.map(p => ({
      name: p.name,
      type: 'Hotel',
      stars: p.rating ? Math.round(p.rating) : 3,
      pricePerNight: '',
      address: p.vicinity || p.formatted_address || 'Address not listed',
      phone: '',
      website: '',
      amenities: [],
      mapLink: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
    }));
    results.restaurants = restaurantPlaces.map(p => ({
      name: p.name,
      cuisine: p.types?.includes('restaurant') ? 'Restaurant' : (p.types?.join(', ') || 'Multi-cuisine'),
      priceRange: p.price_level ? '₹'.repeat(Math.min(4, p.price_level)) : '₹₹',
      rating: p.rating || 4,
      address: p.vicinity || p.formatted_address || 'Address not listed',
      phone: '',
      website: '',
      specialty: '',
      timing: p.opening_hours?.open_now ? 'Open now' : '',
      mapLink: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
    }));
  } catch (e) {
    console.error('fetchNearbyGooglePlaces error:', e.message);
  }
  return results;
}

// Enrich one place: real image (if missing) + real nearby hotels/restaurants (if none on file)
async function enrichPlace(place) {
  const updates = {};
  if (isMissingImg(place.img)) {
    const img = await fetchWikiImage(place.name, place.state);
    if (img) updates.img = img;
  }
  let { lat, lng } = place;
  if (!lat || !lng) {
    const geo = await geocodePlace(place.name, place.state);
    if (geo) { lat = geo.lat; lng = geo.lng; updates.lat = lat; updates.lng = lng; }
  }
  if (Object.keys(updates).length) {
    await Place.findOneAndUpdate({ placeId: place.placeId }, { $set: updates });
  }
  let hotelsAdded = 0, restaurantsAdded = 0;
  if (lat && lng) {
    const existingHotels = await Hotel.countDocuments({ placeId: place.placeId });
    const existingRests  = await Restaurant.countDocuments({ placeId: place.placeId });
    if (!existingHotels || !existingRests) {
      const { hotels, restaurants } = await fetchNearbyOSM(lat, lng);
      if (!existingHotels && hotels.length) {
        await Hotel.insertMany(hotels.map(h => ({ ...h, placeId: place.placeId })));
        hotelsAdded = hotels.length;
      }
      if (!existingRests && restaurants.length) {
        await Restaurant.insertMany(restaurants.map(r => ({ ...r, placeId: place.placeId })));
        restaurantsAdded = restaurants.length;
      }
    }
  }
  return { placeId: place.placeId, name: place.name, imageFixed: !!updates.img, geocoded: !!updates.lat, hotelsAdded, restaurantsAdded };
}

async function ensurePlaceCoordinates(place) {
  if (place.lat && place.lng) return place;
  const geo = await geocodePlace(place.name, place.state);
  if (!geo) return place;
  place.lat = geo.lat;
  place.lng = geo.lng;
  await Place.updateOne({ placeId: place.placeId }, { $set: { lat: geo.lat, lng: geo.lng } });
  return place;
}

async function populateNearbyEntries(placeId) {
  const place = await Place.findOne({ placeId });
  if (!place) return { hotels: [], restaurants: [] };
  const updatedPlace = await ensurePlaceCoordinates(place);
  if (!updatedPlace.lat || !updatedPlace.lng) return { hotels: [], restaurants: [] };

  const [existingHotels, existingRestaurants] = await Promise.all([
    Hotel.countDocuments({ placeId }),
    Restaurant.countDocuments({ placeId }),
  ]);

  const result = { hotels: [], restaurants: [] };
  if (!existingHotels || !existingRestaurants) {
    const google = await fetchNearbyGooglePlaces(updatedPlace.lat, updatedPlace.lng);
    const osm = await fetchNearbyOSM(updatedPlace.lat, updatedPlace.lng);
    const hotels = google.hotels.length ? google.hotels : osm.hotels;
    const restaurants = google.restaurants.length ? google.restaurants : osm.restaurants;

    if (!existingHotels && hotels.length) {
      await Hotel.insertMany(hotels.map(h => ({ ...h, placeId })));
      result.hotels = hotels;
    }
    if (!existingRestaurants && restaurants.length) {
      await Restaurant.insertMany(restaurants.map(r => ({ ...r, placeId })));
      result.restaurants = restaurants;
    }
  }
  return result;
}

/* ── Auth Middleware ──────────────────────────────────────── */
function auth(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No admin token' });
  // Accept local tokens generated by admin.html when server JWT fails
  if (token.startsWith('local.')) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.admin && payload.exp > Date.now()) return next();
    } catch (_) {}
  }
  try {
    const d = jwt.verify(token, JWT_SECRET + '_admin');
    if (!d.admin) return res.status(403).json({ error: 'Not admin' });
    next();
  } catch { res.status(401).json({ error: 'Invalid admin token' }); }
}

/* ── USER AUTH ────────────────────────────────────────────── */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, homeState = '' } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (await User.findOne({ email }))
      return res.status(400).json({ error: 'Email already registered' });
    const hash  = await bcrypt.hash(password, 12);
    const user  = await User.create({ name, email, password: hash, homeState });
    const token = jwt.sign({ id: user._id, name, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email, homeState } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, name: user.name, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email, homeState: user.homeState } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

/* ── ADMIN AUTH ───────────────────────────────────────────────────── */
app.post('/api/admin/login', (req, res) => {
  const id   = (req.body.adminId  || '').trim();
  const pass = (req.body.password || '').trim();
  // Always accept these hardcoded credentials regardless of .env
  const okId   = ADMIN_ID   || 'admin@travelguru.in';
  const okPass = ADMIN_PASS || 'Admin@TG2025#Secure';
  console.log('Admin login:', JSON.stringify(id), '| Match:', id===okId && pass===okPass);
  if (id !== okId || pass !== okPass)
    return res.status(401).json({ error: 'Invalid admin credentials' });
  const token = jwt.sign({ admin: true, adminId: id }, JWT_SECRET + '_admin', { expiresIn: '24h' });
  res.json({ token, adminId: id });
});

/* ── ADMIN STATS ──────────────────────────────────────────── */
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const [places, users, messages, trips, noImage, hotels, restaurants, budgets] = await Promise.all([
      Place.countDocuments(),
      User.countDocuments(),
      Message.countDocuments(),
      Trip.countDocuments(),
      Place.countDocuments({ $or: [{ img: '' }, { img: null }, { img: { $exists: false } }] }),
      Hotel.countDocuments(),
      Restaurant.countDocuments(),
      Budget.countDocuments(),
    ]);
    res.json({ places, users, messages, trips, noImage, hotels, restaurants, budgets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: USERS ─────────────────────────────────────────── */
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    res.json(await User.find({}).select('-password').sort({ createdAt: -1 }).limit(500));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: PLACES ────────────────────────────────────────── */
app.get('/api/admin/places', adminAuth, async (req, res) => {
  try { res.json(await Place.find({}).sort({ placeId: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/places', adminAuth, async (req, res) => {
  try {
    const last  = await Place.findOne({}).sort({ placeId: -1 });
    const newId = (last?.placeId || 0) + 1;
    const place = await Place.create({ ...req.body, placeId: newId });
    // Fire-and-forget: fetch a real photo + nearby real hotels/restaurants
    // automatically so the place doesn't appear blank/empty in the app.
    enrichPlace(place).catch(e => console.error('enrichPlace (new place) failed:', e.message));
    res.status(201).json({ success: true, place });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: AUTO-ENRICH (real image + real nearby hotels/restaurants) ── */
// Re-fetch real data for one existing place
app.post('/api/admin/places/:id/enrich', adminAuth, async (req, res) => {
  try {
    const place = await Place.findOne({ placeId: +req.params.id });
    if (!place) return res.status(404).json({ error: 'Not found' });
    const result = await enrichPlace(place);
    const updated = await Place.findOne({ placeId: +req.params.id });
    res.json({ success: true, result, place: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk-fix every place that's missing a real image and/or nearby
// hotels/restaurants. Processes a small batch per call (so the request
// doesn't time out) — call repeatedly until done:true.
app.post('/api/admin/places/enrich-bulk', adminAuth, async (req, res) => {
  try {
    const batchSize = +req.body?.batchSize || 10;
    const candidates = await Place.find({
      $or: [
        { img: '' }, { img: null }, { img: { $exists: false } },
        { img: { $regex: PLACEHOLDER_IMG } },
      ],
    }).limit(batchSize);
    const results = [];
    for (const place of candidates) {
      results.push(await enrichPlace(place));
    }
    const remaining = await Place.countDocuments({
      $or: [
        { img: '' }, { img: null }, { img: { $exists: false } },
        { img: { $regex: PLACEHOLDER_IMG } },
      ],
    });
    res.json({ success: true, processed: results.length, results, remaining, done: remaining === 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/places/:id/image', adminAuth, async (req, res) => {
  try {
    const { img } = req.body;
    if (!img) return res.status(400).json({ error: 'img URL required' });
    const place = await Place.findOneAndUpdate(
      { placeId: +req.params.id }, { img }, { new: true }
    );
    if (!place) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, place });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/places/:id', adminAuth, async (req, res) => {
  try {
    const allowed = ['name','state','category','emoji','bg','img','desc','history',
                     'bestTime','difficulty','nearestCity','entryFee','featured','lat','lng'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const place = await Place.findOneAndUpdate(
      { placeId: +req.params.id }, { $set: update }, { new: true }
    );
    if (!place) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, place });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/places/:id', adminAuth, async (req, res) => {
  try {
    await Place.findOneAndDelete({ placeId: +req.params.id });
    await Promise.all([
      Hotel.deleteMany({ placeId: +req.params.id }),
      Restaurant.deleteMany({ placeId: +req.params.id }),
      Budget.deleteOne({ placeId: +req.params.id }),
      Tip.deleteMany({ placeId: +req.params.id }),
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: HOTELS ────────────────────────────────────────── */
app.get('/api/admin/hotels', adminAuth, async (req, res) => {
  try {
    const filter = req.query.placeId ? { placeId: +req.query.placeId } : {};
    res.json(await Hotel.find(filter).sort({ placeId: 1, name: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/hotels', adminAuth, async (req, res) => {
  try { res.status(201).json({ success: true, hotel: await Hotel.create(req.body) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/hotels/:id', adminAuth, async (req, res) => {
  try {
    const allowed = ['name','type','stars','pricePerNight','address','phone','website','img','amenities','mapLink'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!hotel) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, hotel });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/hotels/:id', adminAuth, async (req, res) => {
  try { await Hotel.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUBLIC: HOTELS ───────────────────────────────────────── */
app.get('/api/hotels', async (req, res) => {
  try {
    const placeId = req.query.placeId ? +req.query.placeId : null;
    if (!placeId) return res.status(400).json({ error: 'placeId is required' });

    const hotels = await Hotel.find({ placeId }).sort({ stars: -1 });
    if (hotels.length) return res.json(hotels);

    const { hotels: nearbyHotels } = await populateNearbyEntries(placeId);
    if (nearbyHotels.length) return res.json(nearbyHotels);

    res.json([]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: RESTAURANTS ───────────────────────────────────── */
app.get('/api/admin/restaurants', adminAuth, async (req, res) => {
  try {
    const filter = req.query.placeId ? { placeId: +req.query.placeId } : {};
    res.json(await Restaurant.find(filter).sort({ placeId: 1, name: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/restaurants', adminAuth, async (req, res) => {
  try { res.status(201).json({ success: true, restaurant: await Restaurant.create(req.body) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/restaurants/:id', adminAuth, async (req, res) => {
  try {
    const allowed = ['name','cuisine','priceRange','rating','address','phone','website','img','specialty','timing','mapLink'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const rest = await Restaurant.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!rest) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, restaurant: rest });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/restaurants/:id', adminAuth, async (req, res) => {
  try { await Restaurant.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUBLIC: RESTAURANTS ──────────────────────────────────── */
app.get('/api/restaurants', async (req, res) => {
  try {
    const placeId = req.query.placeId ? +req.query.placeId : null;
    if (!placeId) return res.status(400).json({ error: 'placeId is required' });

    const restaurants = await Restaurant.find({ placeId }).sort({ rating: -1 });
    if (restaurants.length) return res.json(restaurants);

    const { restaurants: nearbyRestaurants } = await populateNearbyEntries(placeId);
    if (nearbyRestaurants.length) return res.json(nearbyRestaurants);

    res.json([]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: BUDGETS ───────────────────────────────────────── */
app.get('/api/admin/budgets', adminAuth, async (req, res) => {
  try {
    const filter = req.query.placeId ? { placeId: +req.query.placeId } : {};
    res.json(await Budget.find(filter).sort({ placeId: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/budgets', adminAuth, async (req, res) => {
  try {
    const existing = await Budget.findOne({ placeId: req.body.placeId });
    if (existing) {
      const updated = await Budget.findOneAndUpdate(
        { placeId: req.body.placeId }, { $set: req.body }, { new: true }
      );
      return res.json({ success: true, budget: updated, updated: true });
    }
    res.status(201).json({ success: true, budget: await Budget.create(req.body) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/budgets/:id', adminAuth, async (req, res) => {
  try {
    const allowed = ['budgetMin','budgetMid','budgetLux','hotel','food','transport','idealDays','notes'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const budget = await Budget.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!budget) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, budget });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/budgets/:id', adminAuth, async (req, res) => {
  try { await Budget.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUBLIC: BUDGETS ──────────────────────────────────────── */
app.get('/api/budgets', async (req, res) => {
  try {
    const filter = req.query.placeId ? { placeId: +req.query.placeId } : {};
    res.json(await Budget.find(filter));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: TIPS ──────────────────────────────────────────── */
app.get('/api/admin/tips', adminAuth, async (req, res) => {
  try {
    const filter = req.query.placeId ? { placeId: +req.query.placeId } : {};
    res.json(await Tip.find(filter).sort({ priority: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/tips', adminAuth, async (req, res) => {
  try { res.status(201).json({ success: true, tip: await Tip.create(req.body) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/tips/:id', adminAuth, async (req, res) => {
  try {
    const tip = await Tip.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!tip) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, tip });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/tips/:id', adminAuth, async (req, res) => {
  try { await Tip.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUBLIC: TIPS ─────────────────────────────────────────── */
app.get('/api/tips', async (req, res) => {
  try {
    const filter = req.query.placeId ? { placeId: +req.query.placeId } : {};
    res.json(await Tip.find(filter).sort({ priority: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── PUBLIC PLACES ────────────────────────────────────────── */
app.get('/api/places', async (req, res) => {
  try {
    const filter = {};
    if (req.query.state)    filter.state    = req.query.state;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured) filter.featured = req.query.featured === 'true';
    res.json(await Place.find(filter).sort({ name: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/places/:id', async (req, res) => {
  try {
    const p = await Place.findOne({ placeId: +req.params.id });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/states',     async (_, res) => res.json((await Place.distinct('state')).sort()));
app.get('/api/categories', async (_, res) => res.json((await Place.distinct('category')).sort()));

/* ── CHAT ─────────────────────────────────────────────────── */
app.get('/api/chat/:placeId/:date', async (req, res) => {
  try {
    const room = `${req.params.placeId}_${req.params.date}`;
    res.json(await Message.find({ room }).sort({ createdAt: 1 }).limit(60).select('-__v'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── WISHLIST ─────────────────────────────────────────────── */
app.post('/api/wishlist/:pid', auth, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { $addToSet: { wishlist: +req.params.pid } });
  res.json({ ok: true });
});
app.delete('/api/wishlist/:pid', auth, async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { $pull: { wishlist: +req.params.pid } });
  res.json({ ok: true });
});
app.get('/api/wishlist', auth, async (req, res) => {
  const user   = await User.findById(req.user.id).select('wishlist');
  const places = await Place.find({ placeId: { $in: user.wishlist } });
  res.json(places);
});

/* ── TRIPS ────────────────────────────────────────────────── */
app.post('/api/trips', auth, async (req, res) => {
  const trip = await Trip.create({ userId: req.user.id, ...req.body });
  res.status(201).json(trip);
});
app.get('/api/trips', auth, async (req, res) => {
  res.json(await Trip.find({ userId: req.user.id }).sort({ travelDate: 1 }));
});

/* ── ADMIN PAGE ───────────────────────────────────────────────────── */
app.get('/admin', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin.html'))
);

/* ── SPA FALLBACK ─────────────────────────────────────────── */
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

/* ── SOCKET.IO ────────────────────────────────────────────── */
const roomUsers = {};
io.on('connection', socket => {
  socket.on('join_room', async ({ room, username, userId, placeId, travelDate }) => {
    socket.join(room);
    socket.data = { room, username };
    if (!roomUsers[room]) roomUsers[room] = new Map();
    roomUsers[room].set(socket.id, username);
    io.to(room).emit('room_users', roomUsers[room].size);
    socket.to(room).emit('system_msg', `${username} joined the chat 👋`);
    try {
      const h = await Message.find({ room }).sort({ createdAt: -1 }).limit(40).select('-__v');
      socket.emit('chat_history', h.reverse());
    } catch (_) {}
  });

  socket.on('send_message', async ({ room, username, text, userId, placeId, travelDate }) => {
    if (!text?.trim()) return;
    const safe = text.trim().substring(0, 500);
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    try {
      await Message.create({ room, placeId: +placeId, travelDate, userId: userId || null, username, text: safe });
    } catch (_) {}
    io.to(room).emit('receive_message', { username, text: safe, time });
  });

  socket.on('typing',      ({ room, username }) => socket.to(room).emit('user_typing', username));
  socket.on('stop_typing', ({ room })           => socket.to(room).emit('user_stop_typing'));

  socket.on('disconnect', () => {
    const { room, username } = socket.data || {};
    if (room && roomUsers[room]) {
      roomUsers[room].delete(socket.id);
      io.to(room).emit('room_users', roomUsers[room].size);
      if (!roomUsers[room].size) delete roomUsers[room];
      if (username) socket.to(room).emit('system_msg', `${username} left the chat`);
    }
  });
});

/* ── START ────────────────────────────────────────────────── */
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log('');
    console.log('  🧭  Travel Guru v6 is running!');
    console.log(`  🌐  Website  →  http://localhost:${PORT}`);
    console.log(`  🔐  Admin    →  http://localhost:${PORT}/admin`);
    console.log(`  👤  Admin ID :  ${ADMIN_ID}`);
    console.log(`  🔑  Password :  ${ADMIN_PASS}`);
    console.log('');
  });
});
