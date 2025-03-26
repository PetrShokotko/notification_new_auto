const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { openLinks } = require('./linkExtractor'); // Импортируем функцию для открытия ссылок

// Функция для извлечения ссылок из поисковой страницы
async function extractLinksFromSearchUrl(searchUrl) {
    try {
        const response = await axios.get(searchUrl);
        const html = response.data;
        const $ = cheerio.load(html);

        const links = [];
        const contentBars = $('.content-bar');

        for (const contentBar of contentBars.toArray()) {
            const link = $(contentBar).find('.m-link-ticket').attr('href'); 
            const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim(); 

            if (link) {
                const now = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });
                console.log(`Найдена ссылка: ${link}, цена: ${currentPrice}, дата: ${now}`);
                links.push({ url: link, currentPrice, dateTime: now });
            } else {
                console.warn(`Пропущен блок с некорректной ссылкой.`);
            }
        }

        return links;
    } catch (error) {
        console.error('Ошибка при извлечении ссылок:', error.message);
        return [];
    }
}

// Функция для задержки
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для записи данных в файл
function saveToFile(data) {
    try {
        fs.writeFileSync('visitedlinks.json', JSON.stringify(data, null, 2), 'utf8');
        console.log('Ссылки сохранены в файл visitedlinks.json');
    } catch (error) {
        console.error('Ошибка при записи в файл:', error.message);
    }
}

// Основная функция, которая начинает выполнение
async function main(searchUrl) {
    let allLinks = [];
    let page = 0;

    while (true) {
        const currentUrl = searchUrl.replace(/(&page=)\d+/, `&page=${page}`).replace(/(&countpage=)\d+/, '$1' + 100); 
        console.log(`Запрос к: ${currentUrl}`);

        const linksFromPage = await extractLinksFromSearchUrl(currentUrl);
        
        if (linksFromPage.length > 0) {
            allLinks = allLinks.concat(linksFromPage);
            console.log(`Собрано ссылок: ${allLinks.length}`);
        } else {
            console.log('На этой странице больше никаких ссылок не найдено.');
            break; 
        }

        page += 1; 
        await delay(1500); // Время задержки между запросами
    }

    console.log(`Всего найдено ссылок: ${allLinks.length}`);

    // Сохраняем собранные ссылки в файл
    saveToFile(allLinks);

    // Передаем ссылки в linkExtractor
    await openLinks(allLinks);
}

const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2011&year[0].lte=2011&categories.main.id=1&country.import.usa.not=-1&region.id[0]=11&price.currency=1&top=11&abroad.not=0&custom.not=1&page=0&size=100';
main(searchUrl);

module.exports = { extractLinksFromSearchUrl, saveToFile }; // Экспортируем функции
// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');

// // Функция для извлечения ссылок из поисковой страницы
// async function extractLinksFromSearchUrl(searchUrl) {
//     try {
//         const response = await axios.get(searchUrl);
//         const html = response.data;
//         const $ = cheerio.load(html);

//         const links = [];
//         const contentBars = $('.content-bar');

//         for (const contentBar of contentBars.toArray()) {
//             const link = $(contentBar).find('.m-link-ticket').attr('href');
//             const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//             if (link) {
//                 console.log(`Найдена ссылка: ${link}, цена: ${currentPrice}`);
//                 links.push({ url: link, currentPrice });
//             } else {
//                 console.warn(`Пропущен блок с некорректной ссылкой.`);
//             }
//         }

//         return links;
//     } catch (error) {
//         console.error('Ошибка при извлечении ссылок:', error);
//         return [];
//     }
// }

// // Функция для задержки
// function delay(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// // Основная функция, которая начинает выполнение
// async function main(searchUrl) {
//     let allLinks = [];
//     let page = 0;

//     while (true) { // Бесконечный цикл
//         const currentUrl = searchUrl.replace(/&page=\d+/, `&page=${page}`);
//         console.log(`Запрос к: ${currentUrl}`);

//         const linksFromPage = await extractLinksFromSearchUrl(currentUrl);
        
//         // Если на текущей странице найдено ссылок, добавляем их
//         if (linksFromPage.length > 0) {
//             allLinks = allLinks.concat(linksFromPage);
//             console.log(`Собрано ссылок: ${allLinks.length}`);
//         } else {
//             console.log('На этой странице больше никаких ссылок не найдено.');
//             break; // Если ссылки на этой странице не найдены, выходим из цикла
//         }

//         page += 1; // Переход к следующей странице
//         await delay(1500); // Задержка 1,5 секунды
//     }

//     console.log(`Всего найдено ссылок: ${allLinks.length}`);
// }
// const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto%2Corder_auto%2Cnewauto_search&s_yers%5B0%5D=2006&po_yers%5B0%5D=2020&category_id=1&state%5B0%5D=11&price_ot=4000&currency=1&price_do=16000&order_by=2&top=10&abroad=2&custom=1&page=0&countpage=100'; // Укажите ваш searchUrl здесь
// main(searchUrl);
// __________________
// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');

// // Функция для извлечения ссылок из поисковой страницы
// async function extractLinksFromSearchUrl(searchUrl) {
//     try {
//         const response = await axios.get(searchUrl);
//         const html = response.data;
//         const $ = cheerio.load(html);

//         const links = [];
//         const contentBars = $('.content-bar');

//         for (const contentBar of contentBars.toArray()) {
//             const link = $(contentBar).find('.m-link-ticket').attr('href');
//             const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//             if (link) {
//                 console.log(`Найдена ссылка: ${link}, цена: ${currentPrice}`);
//                 links.push({ url: link, currentPrice });
//             } else {
//                 console.warn(`Пропущен блок с некорректной ссылкой.`);
//             }
//         }

//         return links;
//     } catch (error) {
//         console.error('Ошибка при извлечении ссылок:', error);
//         return [];
//     }
// }

// // Основная функция, которая начинает выполнение
// async function main(searchUrl) {
//     const allLinks = await extractLinksFromSearchUrl(searchUrl);
//     console.log(`Всего найдено ссылок: ${allLinks.length}`);
// }

// // Пример использования
// const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2006&year[0].lte=2020&categories.main.id=1&country.import.usa.not=-1&region.id[0]=11&price.USD.gte=4000&price.USD.lte=16000&price.currency=1&sort[0].order=price.asc&top=2&abroad.not=0&custom.not=1&page=0&size=100'; // Укажите ваш searchUrl здесь
// main(searchUrl)