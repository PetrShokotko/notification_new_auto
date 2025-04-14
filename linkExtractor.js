const puppeteer = require('puppeteer');
const { extractPhoneNumbers } = require('./phoneExtractor');
const { checkPhoneNumber } = require('./checkPhone'); // Импортируем функцию checkPhoneNumber

// Функция для задержки
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Функция для открытия ссылок
async function openLinks(links) {
    try {
        if (!Array.isArray(links) || links.length === 0) {
            console.error('Ссылки не переданы или имеют некорректный формат.');
            return;
        }

        for (const link of links) {
            if (link.url) {
                console.log(`Открываю ссылку: ${link.url}`);
                
                const browser = await puppeteer.launch({ headless: true });
                const page = await browser.newPage();
                await page.goto(link.url, { waitUntil: 'networkidle2' });

                // Вызов функции для извлечения номера телефона на странице
                const phoneNumber = await extractPhoneNumbers(page);
                console.log(`Номер телефона для ${link.url}:`, phoneNumber);

                // Теперь вызываем checkPhoneNumber с номером телефона и URL
                await checkPhoneNumber(phoneNumber, link.url); // Передаем номер телефона и URL

                await delay(2000);
                await page.close();
                await browser.close();
            } else {
                console.warn('Ссылка отсутствует в объекте:', link);
            }
        }
    } catch (error) {
        console.error('Ошибка при открытии ссылок:', error.message);
    }
}

// Экспортируем функцию openLinks
module.exports = { openLinks };
// _____________ без передачи checkPhone _____________
// const puppeteer = require('puppeteer');
// const { extractPhoneNumbers } = require('./phoneExtractor'); // Импортируем функцию для извлечения номеров телефонов

// // Функция для задержки
// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// // Функция для открытия ссылок
// async function openLinks(links) {
//     try {
//         if (!Array.isArray(links) || links.length === 0) {
//             console.error('Ссылки не переданы или имеют некорректный формат.');
//             return;
//         }

//         for (const link of links) {
//             if (link.url) {
//                 console.log(`Открываю ссылку: ${link.url}`);
                
//                 const browser = await puppeteer.launch({ headless: false }); // Запускаем новый экземпляр браузера
//                 const page = await browser.newPage(); // Создаем новую вкладку
//                 await page.goto(link.url, { waitUntil: 'networkidle2' }); // Переходим на страницу

//                 // Вызов функции для извлечения номеров телефонов на странице
//                 const phoneNumbers = await extractPhoneNumbers(page);
//                 console.log(`Номера телефонов для ${link.url}:`, phoneNumbers);

//                 await delay(2000); // Используем delay для паузы
//                 await page.close(); // Закрываем страницу после обработки
//                 await browser.close(); // Закрываем браузер после обработки ссылки
//             } else {
//                 console.warn('Ссылка отсутствует в объекте:', link);
//             }
//         }
//     } catch (error) {
//         console.error('Ошибка при открытии ссылок:', error.message);
//     }
// }

// // Экспортируем функцию openLinks
// module.exports = { openLinks };