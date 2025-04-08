const TELEGRAM_BOT_TOKEN = '7883521251:AAHWwngD4BKBWlwKaecIYUejU62LLpkHpeM';
const GROUP_CHAT_ID = '-1002666452738';
const axios = require('axios');

async function sendMessageToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        await axios.post(url, {
            chat_id: GROUP_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('Сообщение отправлено в Telegram');
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error.message);
    }
}

module.exports = { sendMessageToTelegram };
// // _______________________________
// const TELEGRAM_BOT_TOKEN = '7883521251:AAHWwngD4BKBWlwKaecIYUejU62LLpkHpeM';
// // Ваш ID чата (группы)
// const GROUP_CHAT_ID = '-1002666452738';
// const axios = require('axios'); // Используем axios для выполнения HTTP запросов

// function sendTelegramNotification(url, phoneNumber, count) {
//     console.log(`Отправка уведомления:\nURL: ${url}, Номер телефона: ${phoneNumber}, Количество объявлений: ${count}`);

//     const notificationURL = url;
//     const phone = phoneNumber;
//     const notificationCount = count;

//     const message = `🔍 Знайдено нову пропозицію на AUTO.RIA!\n\n` +
//                     `📍 URL: ${notificationURL}\n` +
//                     `📞 Номер телефону: ${phone}\n` +
//                     `📊 Кількість оголошень: ${notificationCount}`;

//     // Вывод сообщения в консоль
//     console.log("Сформированное сообщение для Telegram:\n", message);

//     // Отправка сообщения в Telegram
//     sendMessageToTelegram(message);
// }

// function sendMessageToTelegram(message) {
//     const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//     const data = {
//         chat_id: GROUP_CHAT_ID,
//         text: message,
//         parse_mode: 'HTML', // Изменено на HTML для избежания проблем с Markdown
//     };

//     axios.post(url, data)
//         .then(response => {
//             console.log('Сообщение отправлено в Telegram:', response.data);
//         })
//         .catch(error => {
//             console.error('Ошибка при отправке сообщения в Telegram:', error);
//         });
// }

// // Экспортируем функцию
// module.exports = { sendTelegramNotification };
// ____________________-
// const TELEGRAM_BOT_TOKEN = '7883521251:AAHWwngD4BKBWlwKaecIYUejU62LLpkHpeM';
// // Ваш ID чата (группы)
// const GROUP_CHAT_ID = '-1002666452738';
// _________________________________________________________