const HTTP_PORT = process.env.PORT || 3000;
const express = require("express");
const exphbs = require('express-handlebars');
const path = require("path");
const fs = require('fs');
const session = require('express-session');
const randomstring = require('randomstring');
const { MongoClient } = require('mongodb');
const app = express();

// Import the borrow router
const borrowRouter = require('./routes/borrow');

// MongoDB connection details
const uri = "mongodb+srv://julibru:tichoune@mongodbatlas.mduypth.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
const dbName = "LibraryDatabase";
let db;

// Handlebars setup
app.engine(".hbs", exphbs.engine({
    extname: ".hbs", 
    defaultLayout: false,
    partialsDir: path.join(__dirname, 'views/partials') 
}));
app.set("view engine", ".hbs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: randomstring.generate(32),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3 * 60 * 1000 }
}));

// Connect to MongoDB and set up the database reference
async function connectToDb() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log(`Connected to MongoDB: ${dbName}`);
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}

connectToDb();

// Middleware to ensure the database connection
function ensureDb(req, res, next) {
    if (!db) {
        console.error('Database connection not established');
        return res.status(500).send('Internal Server Error');
    }
    next();
}

// Use the borrow router
app.use('/', borrowRouter);

app.get("/", function(req, res){
    res.render('landing', {});                                               
});

app.get("/signin", function(req, res){
    res.render('signin', { title: 'Sign In' });                                               
});

app.post('/signin', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));

    if (!users[username]) {
        return res.render('signin', { title: 'Sign In', error: 'Not a registered username' });
    }

    if (users[username] !== password) {
        return res.render('signin', { title: 'Sign In', error: 'Invalid password' });
    }

    req.session.username = username;
    req.session.sessionID = randomstring.generate(32);

    res.redirect(`/home`);
});

app.get("/home", ensureDb, async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/');
    }

    try {
        const booksCollection = db.collection('books');
        const clientsCollection = db.collection('clients');

        // Fetch all books
        const books = await booksCollection.find({}).toArray();
        console.log('Books from MongoDB:', books);

        // Fetch the client data
        const client = await clientsCollection.findOne({ Username: req.session.username });
        console.log('Client from MongoDB:', client);

        if (!client) {
            console.error(`No client found for email: ${req.session.username}`);
            return res.status(404).send('Client not found');
        }

        // Determine available and borrowed books
        const availableBooks = books.filter(book => book.Available);
        const borrowedBooks = books.filter(book => book.ID && !book.Available && client.IDBooksBorrowed.includes(book.ID.toString()));

        console.log('Available Books:', availableBooks);
        console.log('Borrowed Books:', borrowedBooks);

        // Render the home template with fetched data
        res.render('home', {
            title: 'Home Page',
            showSignout: true,
            username: req.session.username,
            availableBooks,
            borrowedBooks
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/signout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/home');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

const server = app.listen(HTTP_PORT, () => {
    console.log(`Listening on port ${HTTP_PORT}`);
});
