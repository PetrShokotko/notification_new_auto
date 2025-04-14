const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://shokotkop:9Q6ydWf7JMSumWgK@datascraperauto.78jwr.mongodb.net/DataScraperAuto?retryWrites=true&w=majority';
const dbName = 'DataScraperAuto';
const visitedCollection = 'visited_links';

let client;
let db;

async function connectDB() {
    if (!client) {
        client = new MongoClient(uri, {
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            }
        });
        await client.connect();
        db = client.db(dbName);
    }
    return db;
}

async function getAllLinks() {
    const db = await connectDB();
    return await db.collection(visitedCollection)
        .find()
        .sort({ dateTime: -1 })
        .toArray();
}

async function upsertLink(link) {
    const db = await connectDB();
    await db.collection(visitedCollection).updateOne(
        { url: link.url },
        { $set: link },
        { upsert: true }
    );
}

async function updatePhoneInfo(url, phone, count) {
    const db = await connectDB();
    await db.collection(visitedCollection).updateOne(
        { url },
        { $set: { phone, count, lastChecked: new Date() } }
    );
}

// Добавим функцию для закрытия соединения
async function closeConnection() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}

process.on('SIGINT', async () => {
    await closeConnection();
    process.exit();
});

module.exports = {
    getAllLinks,
    upsertLink,
    updatePhoneInfo,
    closeConnection
};
// dbLinks.js — модуль для работы с MongoDB вместо visitedLinks.json

// const { MongoClient } = require('mongodb');

// const uri = 'mongodb+srv://shokotkop:9Q6ydWf7JMSumWgK@datascraperauto.78jwr.mongodb.net/?retryWrites=true&w=majority';
// const dbName = 'DataScraperAuto';
// const visitedCollection = 'visited_links';
// const viewedPagesCollection = 'viewed_pages';

// let client;
// let db;

// async function connectDB() {
//     if (!client) {
//         client = new MongoClient(uri);
//         await client.connect();
//         db = client.db(dbName);
//     }
//     return db;
// }

// async function getAllLinks() {
//     const db = await connectDB();
//     return await db.collection(visitedCollection).find().toArray();
// }

// async function upsertLink(link) {
//     const db = await connectDB();
//     await db.collection(visitedCollection).updateOne(
//         { url: link.url },
//         { $set: link },
//         { upsert: true }
//     );
// }

// async function updatePhoneInfo(url, phone, count) {
//     const db = await connectDB();
//     await db.collection(visitedCollection).updateOne(
//         { url },
//         { $set: { phone, count } }
//     );
// }

// module.exports = {
//     getAllLinks,
//     upsertLink,
//     updatePhoneInfo
// };
