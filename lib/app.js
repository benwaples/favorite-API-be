const express = require('express');
const cors = require('cors');
const request = require('superagent');
const client = require('./client.js');
const app = express();
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');

const {
  NASA_API_KEY
} = process.env;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/api/test', (req, res) => {
  res.json({
    message: `in this proctected route, we get the user's id like so: ${req.userId}`
  });
});

app.get('/api/favorites', async(req, res) => {

  const userId = req.userId;

  const data = await client.query(`SELECT * from favorites WHERE favorites.user_id = ${userId}`);

  res.json(data.rows);
});

app.get('/api/getPic', async(req, res) => {
  try {
    const data = await request.get(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`);

    const pic = data.body;

    res.json({
      title: pic.title,
      img: pic.url,
      date: pic.date,
      description: pic.explanation,
      copyright: pic.copyright,
      media_type: pic.media_type
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/getPic/date', async(req, res) => {
  try {
    const date = req.query.date;

    const data = await request.get(`https://api.nasa.gov/planetary/apod?date=${date}&api_key=${NASA_API_KEY}`);
    const pic = data.body;

    res.json({
      title: pic.title,
      url: pic.url,
      date: pic.date,
      description: pic.explanation,
      copyright: pic.copyright,
      media_type: pic.media_type
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/getPic', async(req, res) => {
  try {

    const user_id = req.userId;

    const addFavorite = {
      title: req.body.title,
      date: req.body.date,
      url: req.body.url,
      copyright: req.body.copyright,
      media_type: req.body.media_type
    };

    const data = await client.query(`
      INSERT INTO favorites(title, date, url, copyright, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`, [addFavorite.title, addFavorite.date, addFavorite.url, addFavorite.copyright, user_id]);

    res.json(data.rows);

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/deleteFavorite/', async(req, res) => {
  try {
    const favId = req.body.id;

    const data = await client.query('DELETE FROM favorites WHERE favorites.id=$1', [favId]);

    res.json(data.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(require('./middleware/error'));

module.exports = app;
