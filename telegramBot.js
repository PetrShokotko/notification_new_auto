const axios = require('axios');

// Your new Telegram bot token
const TELEGRAM_BOT_TOKEN = '7883521251:AAHWwngD4BKBWlwKaecIYUejU62LLpkHpeM';
// Your chat ID (group ID)
const GROUP_CHAT_ID = '-1002666452738';

// Function to send a message to Telegram
async function sendTelegramMessage(link, phone, count) {
    const message = `Объявление:\nСсылка: ${link}\nКоличество: ${count}\nТелефон: ${phone}`;
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        const response = await axios.post(url, {
            chat_id: GROUP_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });

        console.log('Сообщение отправлено:', response.data);
    } catch (error) {
        console.error('Ошибка при отправке сообщения:');
        if (error.response) {
            console.error('Статус ошибки:', error.response.status);
            console.error('Данные ошибки:', error.response.data);
        } else {
            console.error('Ошибка:', error.message);
        }
    }
}

// Example usage of the function
const exampleLink = 'https://example.com/your-announcement';
const examplePhone = '0979097544';
const exampleCount = 5;

sendTelegramMessage(exampleLink, examplePhone, exampleCount);
// const axios = require('axios');

// // Ваш токен Telegram-бота
// const TELEGRAM_BOT_TOKEN = '7391185906:AAFio2fK367I-djKzl9Nz5Hvw91h46-ob8U';
// // Ваш ID чата (можно использовать @username или ID чата)
// const GROUP_CHAT_ID = '-1002666452738';

// // Функция отправки сообщения в Telegram
// async function sendTelegramMessage(link, phone, count) {
//     const message = `Объявление:\nСсылка: ${link}\nКоличество: ${count}\nТелефон: ${phone}`;
    
//     const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
//     try {
//         const response = await axios.post(url, {
//             chat_id: GROUP_CHAT_ID, // Исправлено с CHAT_ID на GROUP_CHAT_ID
//             text: message,
//             parse_mode: 'Markdown'
//         });

//         console.log('Сообщение отправлено:', response.data);
//     } catch (error) {
//         console.error('Ошибка при отправке сообщения:', error.message);
//     }
// }

// // Пример использования функции
// const exampleLink = 'https://example.com/your-announcement';
// const examplePhone = '0979097544';
// const exampleCount = 5;

// sendTelegramMessage(exampleLink, examplePhone, exampleCount);