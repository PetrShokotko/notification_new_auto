const puppeteer = require('puppeteer');
const { sendMessageToTelegram } = require('./telegramBot');
const { updatePhoneInfo } = require('./dbLinks');

async function checkPhoneNumber(phoneNumber, url) {
    if (phoneNumber === 'не указан') {
        console.log('Номер телефона не указан для проверки.');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
    });
    const page = await browser.newPage();

    try {
        await page.goto('https://autopartner.incolor.agency/auth/login');
        await page.waitForSelector('input[name="phone"]');
        await page.type('input[name="phone"]', phoneNumber);
        await page.click('input[type="submit"]');
        await page.waitForSelector('table tbody');

        const tableData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));
            return rows.map(row => {
                const columns = row.querySelectorAll('td');
                return {
                    id: columns[10]?.querySelector('a')?.href.match(/_(\d+)\.html$/)?.[1] || '',
                    brand: columns[3]?.innerText.trim() || '',
                    model: columns[4]?.innerText.trim() || '',
                    year: columns[5]?.innerText.trim() || '',
                    price: columns[6]?.innerText.trim() || '',
                    platform: columns[9]?.innerText.trim() || '',
                    link: columns[10]?.querySelector('a')?.href || '',
                    phone: columns[7]?.innerText.trim() || '',
                    city: columns[2]?.innerText.trim() || '',
                    dateAdded: columns[1]?.innerText.trim() || ''
                };
            });
        });

        const filteredTableData = tableData.filter(row => 
            row.id || row.brand || row.model || row.year || row.price || row.platform || row.link || row.phone || row.city || row.dateAdded
        );

        const count = filteredTableData.length;
        console.log(`Всего найдено объектов: ${count}`);

        // Обновляем запись в MongoDB
        await updatePhoneInfo(url, phoneNumber, count);

        // Формируем сообщение для Telegram
        const message = `🔍 Новое объявление на AUTO.RIA!\n\n` +
                       `📍 URL: ${url}\n` +
                       `📞 Номер: ${phoneNumber || 'не указан'}\n` +
                       `📊 Количество: ${count}`;

        if (count < 6) {
            await sendMessageToTelegram(message);
        }
    } catch (error) {
        console.error('Ошибка при проверке номера:', error);
    } finally {
        await browser.close();
    }
}

module.exports = { checkPhoneNumber };
// _____________ без Монго _________
// const puppeteer = require('puppeteer');
// const { sendMessageToTelegram } = require('./telegramBot');
// const fs = require('fs');

// // Функция для чтения visitedLinks.json
// function readVisitedLinks() {
//     try {
//         if (!fs.existsSync('visitedLinks.json')) {
//             return [];
//         }
//         const data = fs.readFileSync('visitedLinks.json', 'utf8');
//         return JSON.parse(data);
//     } catch (error) {
//         console.error('Ошибка при чтении visitedLinks.json:', error);
//         return [];
//     }
// }

// // Функция для сохранения visitedLinks.json
// function saveVisitedLinks(links) {
//     try {
//         fs.writeFileSync('visitedLinks.json', JSON.stringify(links, null, 2), 'utf8');
//     } catch (error) {
//         console.error('Ошибка при сохранении visitedLinks.json:', error);
//     }
// }

// // Функция для обновления записи в visitedLinks.json
// function updateVisitedLink(url, phoneNumber, count) {
//     const visitedLinks = readVisitedLinks();
//     const updatedLinks = visitedLinks.map(link => {
//         if (link.url === url) {
//             return {
//                 ...link,
//                 phone: phoneNumber,
//                 count: count
//             };
//         }
//         return link;
//     });
    
//     saveVisitedLinks(updatedLinks);
// }

// async function checkPhoneNumber(phoneNumber, url) {
//     if (phoneNumber === 'не указан') {
//         console.log('Номер телефона не указан для проверки.');
//         return;
//     }

//     const browser = await puppeteer.launch({
//         headless: true,
//         defaultViewport: null,
//     });
//     const page = await browser.newPage();

//     try {
//         await page.goto('https://autopartner.incolor.agency/auth/login');
//         await page.waitForSelector('input[name="phone"]');
//         await page.type('input[name="phone"]', phoneNumber);
//         await page.click('input[type="submit"]');
//         await page.waitForSelector('table tbody');

//         const tableData = await page.evaluate(() => {
//             const rows = Array.from(document.querySelectorAll('table tbody tr'));
//             return rows.map(row => {
//                 const columns = row.querySelectorAll('td');
//                 return {
//                     id: columns[10]?.querySelector('a')?.href.match(/_(\d+)\.html$/)?.[1] || '',
//                     brand: columns[3]?.innerText.trim() || '',
//                     model: columns[4]?.innerText.trim() || '',
//                     year: columns[5]?.innerText.trim() || '',
//                     price: columns[6]?.innerText.trim() || '',
//                     platform: columns[9]?.innerText.trim() || '',
//                     link: columns[10]?.querySelector('a')?.href || '',
//                     phone: columns[7]?.innerText.trim() || '',
//                     city: columns[2]?.innerText.trim() || '',
//                     dateAdded: columns[1]?.innerText.trim() || ''
//                 };
//             });
//         });

//         const filteredTableData = tableData.filter(row => 
//             row.id || row.brand || row.model || row.year || row.price || row.platform || row.link || row.phone || row.city || row.dateAdded
//         );

//         const count = filteredTableData.length;
//         console.log(`Всего найдено объектов: ${count}`);

//         // Обновляем запись в visitedLinks.json
//         updateVisitedLink(url, phoneNumber, count);

//         // Формируем сообщение для Telegram
//         const message = `🔍 Новое объявление на AUTO.RIA!\n\n` +
//                        `📍 URL: ${url}\n` +
//                        `📞 Номер: ${phoneNumber || 'не указан'}\n` +
//                        `📊 Количество: ${count}`;

//         if (count < 6) {
//             await sendMessageToTelegram(message);
//         }
//     } catch (error) {
//         console.error('Ошибка при проверке номера:', error);
//     } finally {
//         await browser.close();
//     }
// }

// module.exports = { checkPhoneNumber };
// _______________________________________
// const puppeteer = require('puppeteer');
// const { sendMessageToTelegram } = require('./telegramBot');

// async function checkPhoneNumber(phoneNumber, url) {
//     if (phoneNumber === 'не указан') {
//         console.log('Номер телефона не указан для проверки.');
//         return;
//     }

//     const browser = await puppeteer.launch({
//         headless: false,
//         defaultViewport: null,
//     });
//     const page = await browser.newPage();

//     try {
//         await page.goto('https://autopartner.incolor.agency/auth/login');
//         await page.waitForSelector('input[name="phone"]');
//         await page.type('input[name="phone"]', phoneNumber);
//         await page.click('input[type="submit"]');
//         await page.waitForSelector('table tbody');

//         const tableData = await page.evaluate(() => {
//             const rows = Array.from(document.querySelectorAll('table tbody tr'));
//             return rows.map(row => {
//                 const columns = row.querySelectorAll('td');
//                 return {
//                     id: columns[10]?.querySelector('a')?.href.match(/_(\d+)\.html$/)?.[1] || '',
//                     brand: columns[3]?.innerText.trim() || '',
//                     model: columns[4]?.innerText.trim() || '',
//                     year: columns[5]?.innerText.trim() || '',
//                     price: columns[6]?.innerText.trim() || '',
//                     platform: columns[9]?.innerText.trim() || '',
//                     link: columns[10]?.querySelector('a')?.href || '',
//                     phone: columns[7]?.innerText.trim() || '',
//                     city: columns[2]?.innerText.trim() || '',
//                     dateAdded: columns[1]?.innerText.trim() || ''
//                 };
//             });
//         });

//         const filteredTableData = tableData.filter(row => 
//             row.id || row.brand || row.model || row.year || row.price || row.platform || row.link || row.phone || row.city || row.dateAdded
//         );

//         const count = filteredTableData.length;
//         console.log(`Всего найдено объектов: ${count}`);

//         // Формируем сообщение здесь
//         const message = `🔍 Новое объявление на AUTO.RIA!\n\n` +
//                        `📍 URL: ${url}\n` +
//                        `📞 Номер: ${phoneNumber || 'не указан'}\n` +
//                        `📊 Количество: ${count}`;

//         if (count < 6) {
//             await sendMessageToTelegram(message);
//         }
//     } catch (error) {
//         console.error('Ошибка при проверке номера:', error);
//     } finally {
//         await browser.close();
//     }
// }

// module.exports = { checkPhoneNumber };
// ____________________________________
// const puppeteer = require('puppeteer');
// // Импортируем функцию отправки уведомлений из telegramBot.js
// const { sendTelegramNotification } = require('./telegramBot');

// async function checkPhoneNumber(phoneNumber, url) {
//     // Проверяем, если номер не указан
//     if (phoneNumber === 'не указан') {
//         console.log('Номер телефона не указан для проверки.');
//         return;
//     }

//     const browser = await puppeteer.launch({
//         headless: false,
//         defaultViewport: null,
//     });
//     const page = await browser.newPage();

//     await page.goto('https://autopartner.incolor.agency/auth/login');

//     await page.waitForSelector('input[name="phone"]');
//     await page.type('input[name="phone"]', phoneNumber);
//     await page.click('input[type="submit"]');
//     await page.waitForSelector('table tbody');

//     const tableData = await page.evaluate(() => {
//         const rows = Array.from(document.querySelectorAll('table tbody tr'));
//         return rows.map(row => {
//             const columns = row.querySelectorAll('td');
//             return {
//                 id: columns[10]?.querySelector('a')?.href.match(/_(\d+)\.html$/)?.[1] || '',
//                 brand: columns[3]?.innerText.trim() || '',
//                 model: columns[4]?.innerText.trim() || '',
//                 year: columns[5]?.innerText.trim() || '',
//                 price: columns[6]?.innerText.trim() || '',
//                 platform: columns[9]?.innerText.trim() || '',
//                 link: columns[10]?.querySelector('a')?.href || '',
//                 phone: columns[7]?.innerText.trim() || '',
//                 city: columns[2]?.innerText.trim() || '',
//                 dateAdded: columns[1]?.innerText.trim() || ''
//             };
//         });
//     });

//     await browser.close();

//     const filteredTableData = tableData.filter(row => 
//         row.id || row.brand || row.model || row.year || row.price || row.platform || row.link || row.phone || row.city || row.dateAdded
//     );

//     // Выводим количество объектов
//     console.log(`Всего найдено объектов: ${filteredTableData.length}`);

//     // Добавляем уведомление, если найдено менее 6 объектов
//     if (filteredTableData.length < 6) {
//         console.warn('Внимание: найдено меньше 6 объявлений.');

//         // Получаем данные и выводим в консоль через функцию telegramBot
//         sendTelegramNotification(url, phoneNumber, filteredTableData.length);
//     }
// }

// // Экспортируем функцию
// module.exports = { checkPhoneNumber };
// ____________________________________________
// const puppeteer = require('puppeteer');

// async function checkPhoneNumber() {
//     // Фиксированный номер телефона для проверки
//     const phoneNumber = '0979097544';

//     const browser = await puppeteer.launch({
//         headless: false,
//         defaultViewport: null,
//     });
//     const page = await browser.newPage();

//     await page.goto('https://autopartner.incolor.agency/auth/login');

//     await page.waitForSelector('input[name="phone"]');
//     await page.type('input[name="phone"]', phoneNumber);

//     const inputValue = await page.$eval('input[name="phone"]', el => el.value);
//     console.log(`Номер телефона введен: ${inputValue}`);

//     await page.click('input[type="submit"]');
//     await page.waitForSelector('table tbody');

//     const tableData = await page.evaluate(() => {
//         const rows = Array.from(document.querySelectorAll('table tbody tr'));
//         return rows.map(row => {
//             const columns = row.querySelectorAll('td');
//             const link = columns[10]?.querySelector('a')?.href || '';
//             const id = link ? link.match(/_(\d+)\.html$/)?.[1] || '' : '';
            
//             let phone = columns[7]?.innerText.trim() || '';
//             if (phone.startsWith('+380')) {
//                 phone = phone.replace('+380', '0');
//             }

//             return {
//                 id,
//                 brand: columns[3]?.innerText.trim() || '',
//                 model: columns[4]?.innerText.trim() || '',
//                 year: columns[5]?.innerText.trim() || '',
//                 price: columns[6]?.innerText.trim() || '',
//                 platform: columns[9]?.innerText.trim() || '',
//                 link,
//                 phone,
//                 city: columns[2]?.innerText.trim() || '',
//                 dateAdded: columns[1]?.innerText.trim() || ''
//             };
//         });
//     });

//     try {
//         console.log('Закрытие браузера после извлечения данных...');
//         await browser.close();
//     } catch (error) {
//         console.error('Ошибка при закрытии браузера:', error);
//     }

//     const filteredTableData = tableData.filter(row => 
//         row.id || row.brand || row.model || row.year || row.price || row.platform || row.link || row.phone || row.city || row.dateAdded
//     );

//     const cars = filteredTableData.map(car => ({
//         vin: "не указан",
//         licensePlate: "не указан",
//         id: car.id,
//         url: car.link,
//         platform: car.platform,
//         date: car.dateAdded,
//         mark: car.brand,
//         model: car.model,
//         year: parseInt(car.year, 10),
//         price: car.price.replace('$', '') + ' $'
//     }));

//     console.log(cars); // Выводим результаты в консоль
    
//     // Выводим количество объектов
//     console.log(`Всего найдено объектов: ${cars.length}`);
// }

// // Вызов функции для выполнения
// checkPhoneNumber();