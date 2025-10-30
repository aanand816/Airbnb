// ITE5315 Assignment 2
// Name: Aanand 
// Student ID: N01712678
// Date: 2025-10-27

const express = require('express');
const path = require('path');
const app = express();
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const exphbs = require('express-handlebars');

const port = process.env.port || 3000;

// Handlebars setup with helpers
app.engine('.hbs', exphbs.engine({
  extname: '.hbs',
  helpers: {
    inc: v => v + 1,
    dec: v => v - 1,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    eq: (a, b) => a === b,
    showName: name => name && name.trim() !== '' ? name : 'NA',
    showPrice: value => (value !== null && value !== undefined && value !== '') ? value : 'N/A'
  }
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware: parse forms, serve static files
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Load data
const rawData = fs.readFileSync(path.join(__dirname, 'data', 'airbnb_with_photos.json'), 'utf8');
const listings = JSON.parse(rawData);
const cleanListings = listings.map(item => ({
  id: item.id,
  name: item.NAME || '',
  hostname: item['host name'] || '',
  country: item.country || '',
  price: item.price ? parseFloat(item.price.replace('$', '').replace(',', '').trim()) : null,
  image: item.thumbnail || ''
}));

console.log(`Loaded ${listings.length} listings`);

// ROUTES

app.get('/', (req, res) => {
  res.render('index', { title: "Express" });
});

app.get('/viewData', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 100;
  const searchId = (req.query.searchId || "").trim();
  const searchName = (req.query.searchName || "").trim().toLowerCase();
  const minPrice = parseFloat(req.query.minPrice) || null;
  const maxPrice = parseFloat(req.query.maxPrice) || null;

  let filtered = cleanListings.filter(l => {
    if (searchId && l.id !== searchId) return false;
  if (searchName && !l.name.toLowerCase().includes(searchName)) return false;
  // Exclude invalid price if either filter is set
  if ((minPrice !== null || maxPrice !== null) && (l.price === null || isNaN(l.price))) return false;
  // If only minPrice, show > minPrice
  if (minPrice !== null && maxPrice === null && l.price <= minPrice) return false;
  // If only maxPrice, show < maxPrice
  if (maxPrice !== null && minPrice === null && l.price >= maxPrice) return false;
  // If both provided, show between
  if (minPrice !== null && maxPrice !== null && (l.price <= minPrice || l.price >= maxPrice)) return false;
  // For /viewDataclean
  // if (!l.name || l.name.trim() === "") return false; // Include, if required for clean

  return true;
  });


  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const pagedListings = filtered.slice(start, start + pageSize);

  res.render('viewData', {
    title: `All Airbnb Listings (Page ${page} of ${totalPages})`,
    listings: pagedListings,
    page,
    totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
    query: req.query
  });
});

app.get('/viewDataclean', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 100;
  const searchId = (req.query.searchId || "").trim();
  const searchName = (req.query.searchName || "").trim().toLowerCase();
  const minPrice = parseFloat(req.query.minPrice) || null;
  const maxPrice = parseFloat(req.query.maxPrice) || null;

  // Filter first for non-empty name, then apply all other filters
  let filtered = cleanListings.filter(l => {
    if (searchId && l.id !== searchId) return false;
  if (searchName && !l.name.toLowerCase().includes(searchName)) return false;
  // Exclude invalid price if either filter is set
  if ((minPrice !== null || maxPrice !== null) && (l.price === null || isNaN(l.price))) return false;
  // If only minPrice, show > minPrice
  if (minPrice !== null && maxPrice === null && l.price <= minPrice) return false;
  // If only maxPrice, show < maxPrice
  if (maxPrice !== null && minPrice === null && l.price >= maxPrice) return false;
  // If both provided, show between
  if (minPrice !== null && maxPrice !== null && (l.price <= minPrice || l.price >= maxPrice)) return false;
  // For /viewDataclean
  return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const pagedListings = filtered.slice(start, start + pageSize);

  res.render('viewDataclean', {
    title: `Cleaned Airbnb Listings (Page ${page} of ${totalPages})`,
    listings: pagedListings,
    page,
    totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
    query: req.query // For sticky filter fields, just like /viewData
  });
});
// Search by Property ID (form and detail view - GET/POST supports both)
app.get('/searchid', (req, res) => {
  let id = req.query.id ? req.query.id.trim() : '';
  let found = listings.find(item => item.id && item.id.toString() === id);
  let details = found ? Object.entries(found) : [];
  res.render('searchid', {
    title: "Search by Property ID",
    result: found,
    details,
    errors: []
  });
});

app.post('/searchid', (req, res) => {
  const id = req.body.PropertyID ? req.body.PropertyID.trim() : '';
  const found = listings.find(item => item.id && item.id.toString() === id);
  let details = found ? Object.entries(found) : [];
  res.render('searchid', {
    title: "Search by Property ID",
    result: found,
    details,
    errors: []
  });
});

// Search by Name with pagination, view button
app.get('/searchname', (req, res) => {
  const searchQuery = req.query.name ? req.query.name.trim().toLowerCase() : "";
  const page = parseInt(req.query.page) || 1;
  const pageSize = 10;

  let results = [];
  if (searchQuery) {
    results = listings.filter(x =>
      x.NAME && x.NAME.toLowerCase().includes(searchQuery)
    );
  }
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const pagedResults = results.slice((page - 1) * pageSize, page * pageSize);

  res.render('searchname', {
    title: 'Search Airbnb Property',
    results: pagedResults,
    query: req.query.name || "",
    page,
    totalPages
  });
});

// POST - redirect to GET for paging/search
app.post('/searchname', (req, res) => {
  const name = req.body.name || '';
  res.redirect(`/searchname?name=${encodeURIComponent(name)}&page=1`);
});



// Property detail view
app.get('/property/:id', (req, res) => {
  const propertyId = req.params.id;
  const found = listings.find(item => item.id && item.id.toString() === propertyId);
  let details = found ? Object.entries(found) : [];
  res.render('propertydetail', {
    title: "Property Details",
    result: found,
    details
  });
});

// Show the price range form (GET)
app.get('/viewDataprice', (req, res) => {
  const min = req.query.min ? parseFloat(req.query.min) : '';
  const max = req.query.max ? parseFloat(req.query.max) : '';
  const page = parseInt(req.query.page) || 1;
  const pageSize = 20;
  let results = [];
  let errors = [];

  // No filter entered: show nothing
  if (min === '' && max === '') {
    results = [];
  } else {
    results = cleanListings.filter(l => {
      if (l.price === null || isNaN(l.price)) return false;
      if (min !== '' && max === '' && l.price <= min) return false; // only min: show > min
      if (max !== '' && min === '' && l.price >= max) return false; // only max: show < max
      if (min !== '' && max !== '' && (l.price <= min || l.price >= max)) return false; // both: show between
      return true;
    });
    // Min > Max error
    if (min !== '' && max !== '' && min > max) {
      errors.push({ msg: 'Minimum price must be less than or equal to maximum price.' });
      results = [];
    }
  }

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const start = (page - 1) * pageSize;
  const pagedResults = results.slice(start, start + pageSize);

  res.render('viewDataprice', {
    title: 'Search by Price Range',
    results: pagedResults,
    errors,
    min: min === '' ? '' : min,
    max: max === '' ? '' : max,
    page,
    totalPages
  });
});


// POST: redirect to GET for queries and paging
app.post('/viewDataprice',
  body('min').notEmpty().isNumeric().toInt().withMessage('Minimum price must be a number.'),
  body('max').notEmpty().isNumeric().toInt().withMessage('Maximum price must be a number.'),
  (req, res) => {
    const errors = validationResult(req);
    let min = req.body.min ? parseInt(req.body.min) : '';
    let max = req.body.max ? parseInt(req.body.max) : '';

    if (!errors.isEmpty()) {
      return res.render('viewDataprice', {
        title: 'Search by Price Range',
        results: null,
        errors: errors.array(),
        min: req.body.min,
        max: req.body.max,
        page: 1,
        totalPages: 1
      });
    }
    // Both valid: redirect to GET for paging
    res.redirect(`/viewDataprice?min=${min}&max=${max}&page=1`);
  }
);


// Catch-all 404 handler
app.use(function (req, res) {
  res.status(404).render('error', { title: "Error", message: "Wrong Route" });
});


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
