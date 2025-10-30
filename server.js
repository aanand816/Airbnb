// ITE5315 Assignment 2
// Name: Aanand
// Student ID: N01712678
// Date: 2025-10-27

const express = require('express');
const path = require('path');
const app = express();
const { body, validationResult } = require('express-validator');
const exphbs = require('express-handlebars');
const { MongoClient } = require('mongodb');

const port = process.env.port || 3000;

// CHANGE THIS TO YOUR COSMOS DB MONGODB URI!
const MONGO_URI = 'mongodb://aanandcosmos:e44q0DjcLyQJbIXNJnqJh112daQzrPK0lNsVCYIejkA0Fqn4Rvk0lQ0EJtF7uUpbrGV65BC8YrMIACDbUMWf3Q==@aanandcosmos.mongo.cosmos.azure.com:10255/airbnb?ssl=true&replicaSet=globaldb&retrywrites=false';
const DB_NAME = 'airbnb';
const COLLECTION = 'listings';

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
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let client;
let db;
let collection;

// Connect to MongoDB once at startup
(async () => {
  client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
  await client.connect();
  db = client.db(DB_NAME);
  collection = db.collection(COLLECTION);
  console.log('Connected to Cosmos DB Mongo');
})();

// ROUTES

app.get('/', (req, res) => {
  res.render('index', { title: "Express" });
});

app.get('/viewData', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 100;
  const searchId = (req.query.searchId || "").trim();
  const searchName = (req.query.searchName || "").trim().toLowerCase();
  const minPrice = parseFloat(req.query.minPrice);
  const maxPrice = parseFloat(req.query.maxPrice);

  // Build Mongo query for id and name only
  const mongoQuery = {};
  if (searchId) mongoQuery.id = searchId;
  if (searchName) mongoQuery.NAME = { $regex: searchName, $options: 'i' };

  // Get all results matching Mongo query (for correct total count)
  const results = await collection.find(mongoQuery).toArray();

  // Map and clean up fields for view and filter by price in-memory
  let filteredListings = results.map(item => {
    let priceValue = item.price
      ? parseFloat(String(item.price).replace(/[^0-9.]/g, ''))
      : null;
    return {
      id: item.id || '',
      name: item.NAME || '',
      hostname: item['host name'] || '',
      country: item.country || '',
      price: priceValue,
      image: item.thumbnail || ''
    };
  }).filter(l => {
    if (!isNaN(minPrice) && l.price !== null && l.price < minPrice) return false;
    if (!isNaN(maxPrice) && l.price !== null && l.price > maxPrice) return false;
    if ((req.query.minPrice || req.query.maxPrice) && (l.price === null || isNaN(l.price))) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageListings = filteredListings.slice(start, start + pageSize);

  res.render('viewData', {
    title: `All Airbnb Listings (Page ${page} of ${totalPages})`,
    listings: pageListings,
    page,
    totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
    query: req.query
  });
});


app.get('/viewDataclean', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 100;
  const searchId = (req.query.searchId || "").trim();
  const searchName = (req.query.searchName || "").trim().toLowerCase();
  const minPrice = parseFloat(req.query.minPrice);
  const maxPrice = parseFloat(req.query.maxPrice);

  // Query for non-empty NAME
  let query = { NAME: { $nin: [null, '', ' '] } };
  if (searchId) query.id = searchId;
  if (searchName) query.NAME = { $regex: searchName, $options: 'i' };

  // Fetch all results for post-filtering and counting
  let results = await collection.find(query).toArray();

  // Map and clean up fields - only include listings with a valid name
  let cleanListings = results
    .filter(item => item.NAME && item.NAME.trim() !== '')
    .map(item => {
      let priceValue = item.price
        ? parseFloat(String(item.price).replace(/[^0-9.]/g, ""))
        : null;
      return {
        id: item.id,
        name: item.NAME || '',
        hostname: item['host name'] || '',
        country: item.country || '',
        price: priceValue,
        image: item.thumbnail || ''
      };
    }).filter(l => {
      // Price: only apply filters if value is valid
      if (!isNaN(minPrice) && l.price !== null && l.price < minPrice) return false;
      if (!isNaN(maxPrice) && l.price !== null && l.price > maxPrice) return false;
      if ((req.query.minPrice || req.query.maxPrice) && (l.price === null || isNaN(l.price))) return false;
      return true;
    });

  const totalPages = Math.max(1, Math.ceil(cleanListings.length / pageSize));
  const start = (page - 1) * pageSize;
  const pagedListings = cleanListings.slice(start, start + pageSize);

  res.render('viewDataclean', {
    title: `Cleaned Airbnb Listings (Page ${page} of ${totalPages})`,
    listings: pagedListings,
    page,
    totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
    query: req.query
  });
});


// Search by Property ID (form and detail view - GET/POST supports both)
app.get('/searchid', async (req, res) => {
  let id = req.query.id ? req.query.id.trim() : '';
  let found = id ? await collection.findOne({ id }) : null;
  let details = found ? Object.entries(found) : [];
  res.render('searchid', {
    title: "Search by Property ID",
    result: found,
    details,
    errors: []
  });
});

app.post('/searchid', async (req, res) => {
  const id = req.body.PropertyID ? req.body.PropertyID.trim() : '';
  let found = id ? await collection.findOne({ id }) : null;
  let details = found ? Object.entries(found) : [];
  res.render('searchid', {
    title: "Search by Property ID",
    result: found,
    details,
    errors: []
  });
});

// Search by Name with pagination, view button
app.get('/searchname', async (req, res) => {
  const searchQuery = req.query.name ? req.query.name.trim().toLowerCase() : "";
  const page = parseInt(req.query.page) || 1;
  const pageSize = 10;
  let results = [];
  if (searchQuery) {
    results = await collection.find({ NAME: { $regex: searchQuery, $options: 'i' } })
      .skip((page - 1) * pageSize).limit(pageSize).toArray();
  }
  const total = searchQuery ? await collection.countDocuments({ NAME: { $regex: searchQuery, $options: 'i' } }) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  res.render('searchname', {
    title: 'Search Airbnb Property',
    results,
    query: req.query.name || "",
    page,
    totalPages
  });
});

app.post('/searchname', (req, res) => {
  const name = req.body.name || '';
  res.redirect(`/searchname?name=${encodeURIComponent(name)}&page=1`);
});


// Property detail view
app.get('/property/:id', async (req, res) => {
  const propertyId = req.params.id;
  const found = await collection.findOne({ id: propertyId });
  let details = found ? Object.entries(found) : [];
  res.render('propertydetail', {
    title: "Property Details",
    result: found,
    details
  });
});

// Show the price range form (GET)
app.get('/viewDataprice', async (req, res) => {
  const min = req.query.min ? parseInt(req.query.min) : '';
  const max = req.query.max ? parseInt(req.query.max) : '';
  const page = parseInt(req.query.page) || 1;
  const pageSize = 20;
  let errors = [];

  let results = [];

  // Only filter if inputs are valid
  if (min !== '' && max !== '' && min <= max) {
    let query = {};

    // Get all potential results (price is a string in DB, so we need mapping)
    const rawResults = await collection.find({}).toArray();
    results = rawResults
      .map(item => {
        let priceValue = item.price
          ? parseFloat(String(item.price).replace('$', '').replace(',', '').trim())
          : null;
        return {
          id: item.id,
          name: item.NAME || '',
          hostname: item['host name'] || '',
          country: item.country || '',
          price: priceValue,
          image: item.thumbnail || ''
        };
      })
      .filter(l =>
        l.price !== null &&
        !isNaN(l.price) &&
        l.price >= min &&
        l.price <= max
      );
  } else if (min !== '' && max !== '' && min > max) {
    errors.push({ msg: 'Minimum price must be less than or equal to maximum price.' });
  }

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
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
    res.redirect(`/viewDataprice?min=${min}&max=${max}&page=1`);
  }
);


// Catch-all 404 handler
app.use(function (req, res) {
  res.status(404).render('error', { title: "Error", message: "Wrong Route" });
});

app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});
