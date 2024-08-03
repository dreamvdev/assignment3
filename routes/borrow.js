// routes/borrow.js
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB connection details
const uri = "mongodb+srv://julibru:tichoune@mongodbatlas.mduypth.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
const dbName = "LibraryDatabase";
let db;

async function connectToDb() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log(`Connected to MongoDB in borrow.js: ${dbName}`);
    } catch (err) {
        console.error('Failed to connect to MongoDB in borrow.js', err);
    }
}

connectToDb();

// Borrow route
router.post('/borrow', async (req, res) => {
    if (!req.session.username) {
        return res.redirect('/');
    }

    try {
        const booksCollection = db.collection('books');
        const clientsCollection = db.collection('clients');
        const borrowedBooks = req.body.books;

        if (Array.isArray(borrowedBooks)) {
            await booksCollection.updateMany(
                { ID: { $in: borrowedBooks.map(id => Number(id)) } },
                { $set: { Available: false } }
            );
            await clientsCollection.updateOne(
                { Username: req.session.username },
                { $addToSet: { IDBooksBorrowed: { $each: borrowedBooks } } }
            );
        } else {
            await booksCollection.updateOne(
                { ID: Number(borrowedBooks) },
                { $set: { Available: false } }
            );
            await clientsCollection.updateOne(
                { Username: req.session.username },
                { $addToSet: { IDBooksBorrowed: borrowedBooks } }
            );
        }

        res.redirect('/home');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
