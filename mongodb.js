const { MongoClient } = require('mongodb');

// Параметры подключения (замените <PASSWORD> на реальный пароль!)
const ATLAS_URI = 'mongodb+srv://shokotkop:9Q6ydWf7JMSumWgK@datascraperauto.78jwr.mongodb.net/DataScraperAuto?retryWrites=true&w=majority';
const DB_NAME = 'DataScraperAuto';

let client;
let db;

/**
 * Подключение к MongoDB Atlas
 */
async function connectToMongoDB() {
    try {
        console.log('⌛ Подключение к MongoDB Atlas...');
        
        client = new MongoClient(ATLAS_URI, {
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            }
        });

        await client.connect();
        db = client.db(DB_NAME);

        // Проверка подключения
        await db.command({ ping: 1 });
        console.log('✅ Успешное подключение к MongoDB Atlas!');
        return db;

    } catch (error) {
        console.error('❌ Ошибка подключения:', error.message);
        process.exit(1);
    }
}

/**
 * Проверка работы базы данных
 */
async function testDatabase() {
    try {
        const testCollection = db.collection('test_connection');
        
        // Тест записи
        await testCollection.insertOne({
            message: 'Тестовые данные от ' + new Date().toISOString(),
            test: true
        });
        console.log('✔ Тест записи: Успешно');

        // Тест чтения
        const docs = await testCollection.find({ test: true }).toArray();
        console.log('✔ Тест чтения: Найдено', docs.length, 'документов');

        // Очистка (опционально)
        await testCollection.deleteMany({ test: true });
        console.log('✔ Тестовые данные удалены');

    } catch (error) {
        console.error('❌ Ошибка теста базы данных:', error.message);
    }
}

/**
 * Закрытие подключения
 */
async function closeConnection() {
    if (client) {
        await client.close();
        console.log('🔌 Подключение закрыто');
    }
}

// Автозапуск проверки
(async () => {
    try {
        await connectToMongoDB();
        await testDatabase();
    } finally {
        await closeConnection();
    }
})();

// Экспорт для использования в других файлах
module.exports = { connectToMongoDB, closeConnection, getDB: () => db };