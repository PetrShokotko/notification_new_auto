const axios = require('axios');
const cheerio = require('cheerio');
const { openLinks } = require('./linkExtractor');
const moment = require('moment-timezone');
const { sendMessageToTelegram } = require('./telegramBot');
const { getAllLinks, upsertLink } = require('./dbLinks');

// Функция чтения посещенных ссылок из MongoDB
async function readVisitedLinks() {
    try {
        const links = await getAllLinks();
        return links || [];
    } catch (error) {
        console.error('Ошибка при чтении из MongoDB:', error.message);
        return [];
    }
}

// Функция сохранения ссылок в MongoDB
async function saveVisitedLinks(links) {
    try {
        for (const link of links) {
            await upsertLink({
                ...link,
                dateTime: link.dateTime ? link.dateTime.toISOString() : null,
                firstSeen: link.firstSeen ? link.firstSeen.toISOString() : null
            });
        }
        console.log(`Успешно сохранено ${links.length} ссылок в MongoDB`);
    } catch (error) {
        console.error('Ошибка при сохранении ссылок:', error.message);
    }
}

// Функция для отправки уведомления о снижении цены
async function sendPriceDropNotification(url, oldPrice, newPrice, phoneNumber, adsCount) {
    const message = `🔻 <b>Цена снижена</b> ${oldPrice} → ${newPrice}\n\n` +
                    `🔗 <a href="${url}">Ссылка на объявление</a>\n` +
                    `📞 Телефон: ${phoneNumber}\n` +
                    `📊 Количество объявлений: ${adsCount || 'не указано'}`;
    
    await sendMessageToTelegram(message);
}

// Основная функция для извлечения и обновления ссылок
async function extractLinksFromSearchUrl(searchUrl) {
    const visitedLinks = await readVisitedLinks();
    
    const linksMap = new Map();
    visitedLinks.forEach(link => {
        if (link.url) {
            linksMap.set(link.url, {
                ...link,
                dateTime: link.dateTime ? moment(link.dateTime) : null,
                firstSeen: link.firstSeen ? moment(link.firstSeen) : null
            });
        }
    });

    try {
        console.log(`Загружаем страницу: ${searchUrl}`);
        const response = await axios.get(searchUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const newLinks = [];
        const contentBars = $('.content-bar');

        console.log(`Найдено ${contentBars.length} элементов content-bar`);

        for (const contentBar of contentBars.toArray()) {
            try {
                const link = $(contentBar).find('.m-link-ticket').attr('href');
                const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

                if (!link) {
                    console.warn('Пропущен блок без ссылки');
                    continue;
                }

                const now = moment.tz("Europe/Kiev");
                const normalizedLink = link.split('?')[0];

                if (linksMap.has(normalizedLink)) {
                    const existingLink = linksMap.get(normalizedLink);
                    
                    if (existingLink.currentPrice !== currentPrice) {
                        console.log(`Обновление цены для ${normalizedLink}: ${existingLink.currentPrice} → ${currentPrice}`);
                        
                        const oldPriceNum = parseInt(existingLink.currentPrice.replace(/\s+/g, ''));
                        const newPriceNum = parseInt(currentPrice.replace(/\s+/g, ''));
                        
                        const adsCount = parseInt(existingLink.count) || 0;
                        if (newPriceNum < oldPriceNum && existingLink.phone && adsCount <= 6) {
                            console.log(`Цена снижена для ${normalizedLink}, отправляем уведомление`);
                            await sendPriceDropNotification(
                                normalizedLink,
                                existingLink.currentPrice,
                                currentPrice,
                                existingLink.phone,
                                existingLink.count || 'не указано'
                            );
                        }

                        linksMap.set(normalizedLink, {
                            ...existingLink,
                            previousPrice: existingLink.currentPrice,
                            currentPrice: currentPrice,
                            dateTime: now,
                            updated: true
                        });
                    }
                } else {
                    console.log(`Новая ссылка: ${normalizedLink} (${currentPrice})`);
                    const newLink = {
                        url: normalizedLink,
                        currentPrice,
                        dateTime: now,
                        firstSeen: now,
                        updated: false
                    };
                    linksMap.set(normalizedLink, newLink);
                    newLinks.push(newLink);
                }
            } catch (error) {
                console.error('Ошибка при обработке элемента content-bar:', error.message);
            }
        }

        const updatedLinks = Array.from(linksMap.values());
        
        if (newLinks.length > 0 || updatedLinks.some(link => link.updated)) {
            await saveVisitedLinks(updatedLinks);
        } else {
            console.log('Изменений не обнаружено, база не обновляется.');
        }

        return newLinks;
    } catch (error) {
        console.error('Ошибка при обработке страницы:', error.message);
        return [];
    }
}

// Функция задержки
function delay(ms) {
    console.log(`Пауза ${ms} мс...`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Основная функция
async function main(searchUrl) {
    let allNewLinks = [];
    let page = 0;
    let hasMorePages = true;

    while (hasMorePages) {
        try {
            const currentUrl = searchUrl.replace(/([&?]page=)\d+/, `$1${page}`)
                                      .replace(/([&?]countpage=)\d+/, '$1100');
            
            console.log(`\nОбработка страницы ${page + 1}: ${currentUrl}`);
            
            const linksFromPage = await extractLinksFromSearchUrl(currentUrl);
            
            if (linksFromPage.length > 0) {
                allNewLinks = [...allNewLinks, ...linksFromPage];
                console.log(`Найдено ${linksFromPage.length} новых ссылок на этой странице`);
                page++;
                await delay(2000 + Math.random() * 1000);
            } else {
                console.log('Больше новых ссылок не найдено. Завершение.');
                hasMorePages = false;
            }
        } catch (error) {
            console.error(`Ошибка на странице ${page}:`, error.message);
            hasMorePages = false;
        }
    }

    console.log(`\nЗавершено. Всего новых ссылок: ${allNewLinks.length}`);
    
    if (allNewLinks.length > 0) {
        console.log('Передача новых ссылок в linkExtractor...');
        await openLinks(allNewLinks);
    }
}

// URL для поиска
const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2004&year[0].lte=2022&categories.main.id=1&country.import.usa.not=-1&region.id[0]=14&price.USD.gte=3000&price.USD.lte=20000&price.currency=1&mileage.lte=250&top=1&abroad.not=0&custom.not=1&page=0&size=100';

// Функция для бесконечного цикла с перезапуском
async function runWithRestart() {
    try {
        await main(searchUrl);
    } catch (error) {
        console.error('Ошибка в основной функции:', error);
    } finally {
        console.log('\nПерезапуск через 15 секунд...');
        setTimeout(runWithRestart, 15000);
    }
}

// Запуск цикла
runWithRestart();

module.exports = { 
    extractLinksFromSearchUrl, 
    saveVisitedLinks,
    readVisitedLinks
};
// ________________ Без монго _________________--
// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');
// const { openLinks } = require('./linkExtractor');
// const moment = require('moment-timezone');
// const { sendMessageToTelegram } = require('./telegramBot');

// // Улучшенная функция чтения посещенных ссылок с обработкой ошибок
// function readVisitedLinks() {
//     try {
//         if (!fs.existsSync('visitedLinks.json')) {
//             console.warn('Файл visitedLinks.json не найден. Создаем новый.');
//             return [];
//         }
        
//         const data = fs.readFileSync('visitedLinks.json', 'utf8');
//         const parsedData = JSON.parse(data);
        
//         // Валидация данных
//         if (!Array.isArray(parsedData)) {
//             console.warn('Некорректный формат данных в visitedLinks.json. Используем пустой массив.');
//             return [];
//         }
        
//         return parsedData;
//     } catch (error) {
//         console.error('Ошибка при чтении visitedLinks.json:', error.message);
//         return [];
//     }
// }

// // Улучшенная функция сохранения ссылок
// function saveVisitedLinks(links) {
//     try {
//         fs.writeFileSync('visitedLinks.json', JSON.stringify(links, null, 2), 'utf8');
//         console.log(`Успешно сохранено ${links.length} ссылок в visitedLinks.json`);
//     } catch (error) {
//         console.error('Ошибка при сохранении ссылок:', error.message);
//     }
// }

// // Функция для отправки уведомления о снижении цены (ТОЛЬКО если count <= 6)
// async function sendPriceDropNotification(url, oldPrice, newPrice, phoneNumber, adsCount) {
//     const message = `🔻 <b>Цена снижена</b> ${oldPrice} → ${newPrice}\n\n` +
//                     `🔗 <a href="${url}">Ссылка на объявление</a>\n` +
//                     `📞 Телефон: ${phoneNumber}\n` +
//                     `📊 Количество объявлений: ${adsCount || 'не указано'}`;
    
//     await sendMessageToTelegram(message);
// }

// // Основная функция для извлечения и обновления ссылок
// async function extractLinksFromSearchUrl(searchUrl) {
//     const visitedLinks = readVisitedLinks();
    
//     // Создаем Map для быстрого доступа к существующим ссылкам
//     const linksMap = new Map();
//     visitedLinks.forEach(link => {
//         if (link.url) {
//             linksMap.set(link.url, {
//                 ...link,
//                 dateTime: link.dateTime ? moment.tz(link.dateTime, "Europe/Kiev") : null
//             });
//         }
//     });

//     try {
//         console.log(`Загружаем страницу: ${searchUrl}`);
//         const response = await axios.get(searchUrl, {
//             timeout: 10000, // 10 секунд таймаут
//             headers: {
//                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
//             }
//         });
        
//         const $ = cheerio.load(response.data);
//         const newLinks = [];
//         const contentBars = $('.content-bar');

//         console.log(`Найдено ${contentBars.length} элементов content-bar`);

//         for (const contentBar of contentBars.toArray()) {
//             try {
//                 const link = $(contentBar).find('.m-link-ticket').attr('href');
//                 const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//                 if (!link) {
//                     console.warn('Пропущен блок без ссылки');
//                     continue;
//                 }

//                 const now = moment.tz("Europe/Kiev");
//                 const normalizedLink = link.split('?')[0]; // Убираем параметры запроса для нормализации

//                 if (linksMap.has(normalizedLink)) {
//                     const existingLink = linksMap.get(normalizedLink);
                    
//                     if (existingLink.currentPrice !== currentPrice) {
//                         console.log(`Обновление цены для ${normalizedLink}: ${existingLink.currentPrice} → ${currentPrice}`);
                        
//                         // Проверяем, была ли цена снижена
//                         const oldPriceNum = parseInt(existingLink.currentPrice.replace(/\s+/g, ''));
//                         const newPriceNum = parseInt(currentPrice.replace(/\s+/g, ''));
                        
//                         // Проверяем условия для отправки уведомления:
//                         // 1. Цена снизилась (newPriceNum < oldPriceNum)
//                         // 2. Есть телефон (existingLink.phone)
//                         // 3. Количество объявлений <= 6 или не указано
//                         const adsCount = parseInt(existingLink.count) || 0;
//                         if (newPriceNum < oldPriceNum && existingLink.phone && adsCount <= 6) {
//                             console.log(`Цена снижена для ${normalizedLink}, отправляем уведомление`);
//                             await sendPriceDropNotification(
//                                 normalizedLink,
//                                 existingLink.currentPrice,
//                                 currentPrice,
//                                 existingLink.phone,
//                                 existingLink.count || 'не указано'
//                             );
//                         }

//                         // Обновляем запись, сохраняя предыдущую цену
//                         linksMap.set(normalizedLink, {
//                             ...existingLink,
//                             previousPrice: existingLink.currentPrice,
//                             currentPrice: currentPrice,
//                             dateTime: now,
//                             updated: true
//                         });
//                     }
//                 } else {
//                     console.log(`Новая ссылка: ${normalizedLink} (${currentPrice})`);
//                     const newLink = {
//                         url: normalizedLink,
//                         currentPrice,
//                         dateTime: now,
//                         firstSeen: now,
//                         updated: false
//                     };
//                     linksMap.set(normalizedLink, newLink);
//                     newLinks.push(newLink);
//                 }
//             } catch (error) {
//                 console.error('Ошибка при обработке элемента content-bar:', error.message);
//             }
//         }

//         // Собираем обновленные данные
//         const updatedLinks = Array.from(linksMap.values());
        
//         // Сохраняем только если есть изменения
//         if (newLinks.length > 0 || updatedLinks.some(link => link.updated)) {
//             saveVisitedLinks(updatedLinks);
//         } else {
//             console.log('Изменений не обнаружено, файл не обновляется.');
//         }

//         return newLinks;
//     } catch (error) {
//         console.error('Ошибка при обработке страницы:', error.message);
//         return [];
//     }
// }

// // Функция задержки с логированием
// function delay(ms) {
//     console.log(`Пауза ${ms} мс...`);
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// // Основная функция с улучшенной логикой пагинации
// async function main(searchUrl) {
//     let allNewLinks = [];
//     let page = 0;
//     let hasMorePages = true;

//     while (hasMorePages) {
//         try {
//             const currentUrl = searchUrl.replace(/([&?]page=)\d+/, `$1${page}`)
//                                       .replace(/([&?]countpage=)\d+/, '$1100');
            
//             console.log(`\nОбработка страницы ${page + 1}: ${currentUrl}`);
            
//             const linksFromPage = await extractLinksFromSearchUrl(currentUrl);
            
//             if (linksFromPage.length > 0) {
//                 allNewLinks = [...allNewLinks, ...linksFromPage];
//                 console.log(`Найдено ${linksFromPage.length} новых ссылок на этой странице`);
//                 page++;
//                 await delay(2000 + Math.random() * 1000); // Случайная задержка 2-3 сек
//             } else {
//                 console.log('Больше новых ссылок не найдено. Завершение.');
//                 hasMorePages = false;
//             }
//         } catch (error) {
//             console.error(`Ошибка на странице ${page}:`, error.message);
//             hasMorePages = false;
//         }
//     }

//     console.log(`\nЗавершено. Всего новых ссылок: ${allNewLinks.length}`);
    
//     if (allNewLinks.length > 0) {
//         console.log('Передача новых ссылок в linkExtractor...');
//         await openLinks(allNewLinks);
//     }
// }

// // URL для поиска
// const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2006&year[0].lte=2022&categories.main.id=1&country.origin.id[2].not=643&country.import.usa.not=-1&region.id[0]=11&price.USD.gte=4000&price.USD.lte=20000&price.currency=1&mileage.gte=5&mileage.lte=218&engine.gte=1.2&sort[0].order=price.asc&top=1&abroad.not=0&custom.not=1&page=0&size=100';

// // Функция для бесконечного цикла с перезапуском
// async function runWithRestart() {
//     try {
//         await main(searchUrl);
//     } catch (error) {
//         console.error('Ошибка в основной функции:', error);
//     } finally {
//         console.log('\nПерезапуск через 15 секунд...');
//         setTimeout(runWithRestart, 15000); // Перезапуск через 15 секунд
//     }
// }

// // Запуск цикла
// runWithRestart();

// module.exports = { 
//     extractLinksFromSearchUrl, 
//     saveVisitedLinks,
//     readVisitedLinks
// };
// ____________________ код без автозапуска _________________
// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');
// const { openLinks } = require('./linkExtractor');
// const moment = require('moment-timezone');
// const { sendMessageToTelegram } = require('./telegramBot');

// // Улучшенная функция чтения посещенных ссылок с обработкой ошибок
// function readVisitedLinks() {
//     try {
//         if (!fs.existsSync('visitedLinks.json')) {
//             console.warn('Файл visitedLinks.json не найден. Создаем новый.');
//             return [];
//         }
        
//         const data = fs.readFileSync('visitedLinks.json', 'utf8');
//         const parsedData = JSON.parse(data);
        
//         // Валидация данных
//         if (!Array.isArray(parsedData)) {
//             console.warn('Некорректный формат данных в visitedLinks.json. Используем пустой массив.');
//             return [];
//         }
        
//         return parsedData;
//     } catch (error) {
//         console.error('Ошибка при чтении visitedLinks.json:', error.message);
//         return [];
//     }
// }

// // Улучшенная функция сохранения ссылок
// function saveVisitedLinks(links) {
//     try {
//         fs.writeFileSync('visitedLinks.json', JSON.stringify(links, null, 2), 'utf8');
//         console.log(`Успешно сохранено ${links.length} ссылок в visitedLinks.json`);
//     } catch (error) {
//         console.error('Ошибка при сохранении ссылок:', error.message);
//     }
// }

// // Функция для отправки уведомления о снижении цены (ТОЛЬКО если count <= 6)
// async function sendPriceDropNotification(url, oldPrice, newPrice, phoneNumber, adsCount) {
//     const message = `🔻 <b>Цена снижена</b> ${oldPrice} → ${newPrice}\n\n` +
//                     `🔗 <a href="${url}">Ссылка на объявление</a>\n` +
//                     `📞 Телефон: ${phoneNumber}\n` +
//                     `📊 Количество объявлений: ${adsCount || 'не указано'}`;
    
//     await sendMessageToTelegram(message);
// }

// // Основная функция для извлечения и обновления ссылок
// async function extractLinksFromSearchUrl(searchUrl) {
//     const visitedLinks = readVisitedLinks();
    
//     // Создаем Map для быстрого доступа к существующим ссылкам
//     const linksMap = new Map();
//     visitedLinks.forEach(link => {
//         if (link.url) {
//             linksMap.set(link.url, {
//                 ...link,
//                 dateTime: link.dateTime ? moment.tz(link.dateTime, "Europe/Kiev") : null
//             });
//         }
//     });

//     try {
//         console.log(`Загружаем страницу: ${searchUrl}`);
//         const response = await axios.get(searchUrl, {
//             timeout: 10000, // 10 секунд таймаут
//             headers: {
//                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
//             }
//         });
        
//         const $ = cheerio.load(response.data);
//         const newLinks = [];
//         const contentBars = $('.content-bar');

//         console.log(`Найдено ${contentBars.length} элементов content-bar`);

//         for (const contentBar of contentBars.toArray()) {
//             try {
//                 const link = $(contentBar).find('.m-link-ticket').attr('href');
//                 const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//                 if (!link) {
//                     console.warn('Пропущен блок без ссылки');
//                     continue;
//                 }

//                 const now = moment.tz("Europe/Kiev");
//                 const normalizedLink = link.split('?')[0]; // Убираем параметры запроса для нормализации

//                 if (linksMap.has(normalizedLink)) {
//                     const existingLink = linksMap.get(normalizedLink);
                    
//                     if (existingLink.currentPrice !== currentPrice) {
//                         console.log(`Обновление цены для ${normalizedLink}: ${existingLink.currentPrice} → ${currentPrice}`);
                        
//                         // Проверяем, была ли цена снижена
//                         const oldPriceNum = parseInt(existingLink.currentPrice.replace(/\s+/g, ''));
//                         const newPriceNum = parseInt(currentPrice.replace(/\s+/g, ''));
                        
//                         // Проверяем условия для отправки уведомления:
//                         // 1. Цена снизилась (newPriceNum < oldPriceNum)
//                         // 2. Есть телефон (existingLink.phone)
//                         // 3. Количество объявлений <= 6 или не указано
//                         const adsCount = parseInt(existingLink.count) || 0;
//                         if (newPriceNum < oldPriceNum && existingLink.phone && adsCount <= 6) {
//                             console.log(`Цена снижена для ${normalizedLink}, отправляем уведомление`);
//                             await sendPriceDropNotification(
//                                 normalizedLink,
//                                 existingLink.currentPrice,
//                                 currentPrice,
//                                 existingLink.phone,
//                                 existingLink.count || 'не указано'
//                             );
//                         }

//                         // Обновляем запись, сохраняя предыдущую цену
//                         linksMap.set(normalizedLink, {
//                             ...existingLink,
//                             previousPrice: existingLink.currentPrice,
//                             currentPrice: currentPrice,
//                             dateTime: now,
//                             updated: true
//                         });
//                     }
//                 } else {
//                     console.log(`Новая ссылка: ${normalizedLink} (${currentPrice})`);
//                     const newLink = {
//                         url: normalizedLink,
//                         currentPrice,
//                         dateTime: now,
//                         firstSeen: now,
//                         updated: false
//                     };
//                     linksMap.set(normalizedLink, newLink);
//                     newLinks.push(newLink);
//                 }
//             } catch (error) {
//                 console.error('Ошибка при обработке элемента content-bar:', error.message);
//             }
//         }

//         // Собираем обновленные данные
//         const updatedLinks = Array.from(linksMap.values());
        
//         // Сохраняем только если есть изменения
//         if (newLinks.length > 0 || updatedLinks.some(link => link.updated)) {
//             saveVisitedLinks(updatedLinks);
//         } else {
//             console.log('Изменений не обнаружено, файл не обновляется.');
//         }

//         return newLinks;
//     } catch (error) {
//         console.error('Ошибка при обработке страницы:', error.message);
//         return [];
//     }
// }

// // Функция задержки с логированием
// function delay(ms) {
//     console.log(`Пауза ${ms} мс...`);
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// // Основная функция с улучшенной логикой пагинации
// async function main(searchUrl) {
//     let allNewLinks = [];
//     let page = 0;
//     let hasMorePages = true;

//     while (hasMorePages) {
//         try {
//             const currentUrl = searchUrl.replace(/([&?]page=)\d+/, `$1${page}`)
//                                       .replace(/([&?]countpage=)\d+/, '$1100');
            
//             console.log(`\nОбработка страницы ${page + 1}: ${currentUrl}`);
            
//             const linksFromPage = await extractLinksFromSearchUrl(currentUrl);
            
//             if (linksFromPage.length > 0) {
//                 allNewLinks = [...allNewLinks, ...linksFromPage];
//                 console.log(`Найдено ${linksFromPage.length} новых ссылок на этой странице`);
//                 page++;
//                 await delay(2000 + Math.random() * 1000); // Случайная задержка 2-3 сек
//             } else {
//                 console.log('Больше новых ссылок не найдено. Завершение.');
//                 hasMorePages = false;
//             }
//         } catch (error) {
//             console.error(`Ошибка на странице ${page}:`, error.message);
//             hasMorePages = false;
//         }
//     }

//     console.log(`\nЗавершено. Всего новых ссылок: ${allNewLinks.length}`);
    
//     if (allNewLinks.length > 0) {
//         console.log('Передача новых ссылок в linkExtractor...');
//         await openLinks(allNewLinks);
//     }
// }

// // URL для поиска
// const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2009&year[0].lte=2010&categories.main.id=1&country.import.usa.not=-1&region.id[0]=11&price.currency=1&top=1&abroad.not=0&custom.not=1&page=0&size=100';

// // Запуск
// main(searchUrl).catch(console.error);

// module.exports = { 
//     extractLinksFromSearchUrl, 
//     saveVisitedLinks,
//     readVisitedLinks
// };
// ___________________нормальный ко
// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');
// const { openLinks } = require('./linkExtractor');
// const moment = require('moment-timezone');

// // Улучшенная функция чтения посещенных ссылок с обработкой ошибок
// function readVisitedLinks() {
//     try {
//         if (!fs.existsSync('visitedLinks.json')) {
//             console.warn('Файл visitedLinks.json не найден. Создаем новый.');
//             return [];
//         }
        
//         const data = fs.readFileSync('visitedLinks.json', 'utf8');
//         const parsedData = JSON.parse(data);
        
//         // Валидация данных
//         if (!Array.isArray(parsedData)) {
//             console.warn('Некорректный формат данных в visitedLinks.json. Используем пустой массив.');
//             return [];
//         }
        
//         return parsedData;
//     } catch (error) {
//         console.error('Ошибка при чтении visitedLinks.json:', error.message);
//         return [];
//     }
// }

// // Улучшенная функция сохранения ссылок
// function saveVisitedLinks(links) {
//     try {
//         fs.writeFileSync('visitedLinks.json', JSON.stringify(links, null, 2), 'utf8');
//         console.log(`Успешно сохранено ${links.length} ссылок в visitedLinks.json`);
//     } catch (error) {
//         console.error('Ошибка при сохранении ссылок:', error.message);
//     }
// }

// // Основная функция для извлечения и обновления ссылок
// async function extractLinksFromSearchUrl(searchUrl) {
//     const visitedLinks = readVisitedLinks();
    
//     // Создаем Map для быстрого доступа к существующим ссылкам
//     const linksMap = new Map();
//     visitedLinks.forEach(link => {
//         if (link.url) {
//             linksMap.set(link.url, {
//                 ...link,
//                 dateTime: link.dateTime ? moment.tz(link.dateTime, "Europe/Kiev") : null
//             });
//         }
//     });

//     try {
//         console.log(`Загружаем страницу: ${searchUrl}`);
//         const response = await axios.get(searchUrl, {
//             timeout: 10000, // 10 секунд таймаут
//             headers: {
//                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
//             }
//         });
        
//         const $ = cheerio.load(response.data);
//         const newLinks = [];
//         const contentBars = $('.content-bar');

//         console.log(`Найдено ${contentBars.length} элементов content-bar`);

//         for (const contentBar of contentBars.toArray()) {
//             try {
//                 const link = $(contentBar).find('.m-link-ticket').attr('href');
//                 const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//                 if (!link) {
//                     console.warn('Пропущен блок без ссылки');
//                     continue;
//                 }

//                 const now = moment.tz("Europe/Kiev");
//                 const normalizedLink = link.split('?')[0]; // Убираем параметры запроса для нормализации

//                 if (linksMap.has(normalizedLink)) {
//                     const existingLink = linksMap.get(normalizedLink);
                    
//                     if (existingLink.currentPrice !== currentPrice) {
//                         console.log(`Обновление цены для ${normalizedLink}: ${existingLink.currentPrice} → ${currentPrice}`);
                        
//                         // Обновляем запись, сохраняя предыдущую цену
//                         linksMap.set(normalizedLink, {
//                             ...existingLink,
//                             previousPrice: existingLink.currentPrice,
//                             currentPrice: currentPrice,
//                             dateTime: now,
//                             updated: true
//                         });
//                     }
//                 } else {
//                     console.log(`Новая ссылка: ${normalizedLink} (${currentPrice})`);
//                     const newLink = {
//                         url: normalizedLink,
//                         currentPrice,
//                         dateTime: now,
//                         firstSeen: now,
//                         updated: false
//                     };
//                     linksMap.set(normalizedLink, newLink);
//                     newLinks.push(newLink);
//                 }
//             } catch (error) {
//                 console.error('Ошибка при обработке элемента content-bar:', error.message);
//             }
//         }

//         // Собираем обновленные данные
//         const updatedLinks = Array.from(linksMap.values());
        
//         // Сохраняем только если есть изменения
//         if (newLinks.length > 0 || updatedLinks.some(link => link.updated)) {
//             saveVisitedLinks(updatedLinks);
//         } else {
//             console.log('Изменений не обнаружено, файл не обновляется.');
//         }

//         return newLinks;
//     } catch (error) {
//         console.error('Ошибка при обработке страницы:', error.message);
//         return [];
//     }
// }

// // Функция задержки с логированием
// function delay(ms) {
//     console.log(`Пауза ${ms} мс...`);
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// // Основная функция с улучшенной логикой пагинации
// async function main(searchUrl) {
//     let allNewLinks = [];
//     let page = 0;
//     let hasMorePages = true;

//     while (hasMorePages) {
//         try {
//             const currentUrl = searchUrl.replace(/([&?]page=)\d+/, `$1${page}`)
//                                       .replace(/([&?]countpage=)\d+/, '$1100');
            
//             console.log(`\nОбработка страницы ${page + 1}: ${currentUrl}`);
            
//             const linksFromPage = await extractLinksFromSearchUrl(currentUrl);
            
//             if (linksFromPage.length > 0) {
//                 allNewLinks = [...allNewLinks, ...linksFromPage];
//                 console.log(`Найдено ${linksFromPage.length} новых ссылок на этой странице`);
//                 page++;
//                 await delay(2000 + Math.random() * 1000); // Случайная задержка 2-3 сек
//             } else {
//                 console.log('Больше новых ссылок не найдено. Завершение.');
//                 hasMorePages = false;
//             }
//         } catch (error) {
//             console.error(`Ошибка на странице ${page}:`, error.message);
//             hasMorePages = false;
//         }
//     }

//     console.log(`\nЗавершено. Всего новых ссылок: ${allNewLinks.length}`);
    
//     if (allNewLinks.length > 0) {
//         console.log('Передача новых ссылок в linkExtractor...');
//         await openLinks(allNewLinks);
//     }
// }

// // URL для поиска
// const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2009&year[0].lte=2010&categories.main.id=1&country.import.usa.not=-1&region.id[0]=11&price.currency=1&top=1&abroad.not=0&custom.not=1&page=0&size=100';

// // Запуск
// main(searchUrl).catch(console.error);

// module.exports = { 
//     extractLinksFromSearchUrl, 
//     saveVisitedLinks,
//     readVisitedLinks
// };
// _______________________________
// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');
// const { openLinks } = require('./linkExtractor'); // Импортируем функцию для открытия ссылок
// const moment = require('moment-timezone');

// // Функция для извлечения ссылок из поисковой страницы
// function readVisitedLinks() {
//     if (!fs.existsSync('visitedLinks.json')) {
//         console.warn('Файл visitedLinks.json не найден. Возвращаем пустой массив.');
//         return [];
//     }
    
//     const data = fs.readFileSync('visitedLinks.json', 'utf8');
    
//     try {
//         return JSON.parse(data);
//     } catch (error) {
//         console.error('Ошибка при парсинге JSON из файла visitedLinks:', error);
//         return [];
//     }
// }

// function saveVisitedLinks(links) {
//     if (links.length === 0) {
//         console.warn('Новых ссылок нет. Файл visitedLinks.json не обновляется.');
//         return; // Прерываем выполнение, чтобы файл не перезаписывался пустым массивом
//     }
    
//     try {
//         fs.writeFileSync('visitedLinks.json', JSON.stringify(links, null, 2), 'utf8');
//         console.log('Ссылки успешно сохранены в файл visitedLinks.json');
//     } catch (error) {
//         console.error('Ошибка при сохранении ссылок в файл:', error.message);
//     }
// }

// async function extractLinksFromSearchUrl(searchUrl) {
//     const visitedLinks = readVisitedLinks();
    
//     const visitedLinksMap = {};
//     visitedLinks.forEach(link => {
//         if (link.url && link.currentPrice && link.dateTime) {
//             visitedLinksMap[link.url] = {
//                 currentPrice: link.currentPrice,
//                 dateTime: moment.tz(link.dateTime, "Europe/Kiev"),
//             };
//         } else {
//             console.warn('Некорректная запись в visitedLinks:', link);
//         }
//     });

//     try {
//         const response = await axios.get(searchUrl);
//         const $ = cheerio.load(response.data);
//         const newLinks = [];
//         const contentBars = $('.content-bar');

//         for (const contentBar of contentBars.toArray()) {
//             const link = $(contentBar).find('.m-link-ticket').attr('href');
//             const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//             if (link) {
//                 const now = moment.tz("Europe/Kiev");

//                 if (visitedLinksMap[link]) {
//                     const oldPriceData = visitedLinksMap[link];
//                     if (oldPriceData.currentPrice !== currentPrice) {
//                         console.log(`Обновление цены для ссылки: ${link} | Старая цена: ${oldPriceData.currentPrice} | Новая цена: ${currentPrice}`);
//                         oldPriceData.currentPrice = currentPrice; // Обновляем текущую цену и дату
//                         oldPriceData.dateTime = now;
//                     } else {
//                         console.log(`Цена не изменилась для ссылки: ${link}, текущая цена: ${currentPrice}. Пропуск.`);
//                     }
//                 } else {
//                     console.log(`Найдена новая ссылка: ${link}, цена: ${currentPrice}, дата: ${now}`);
//                     newLinks.push({ url: link, currentPrice, dateTime: now });
//                 }
//             } else {
//                 console.warn(`Пропущен блок с некорректной ссылкой.`);
//             }
//         }

//         // Обновляем массив существующих ссылок с новыми ценами и добавляем новые ссылки
//         const updatedLinks = [...visitedLinks];  // Копируем старые ссылки в новый массив

//         // Добавляем новые ссылки в массив, если они не существуют
//         newLinks.forEach(newLink => {
//             if (!visitedLinksMap[newLink.url]) {
//                 updatedLinks.push(newLink);  // Добавляем только новые ссылки
//             }
//         });

//         if (updatedLinks.length > 0) {
//             saveVisitedLinks(updatedLinks);
//         } else {
//             console.warn('Нет новых ссылок, файл visitedLinks.json не обновляется.');
//         }

//         return newLinks;
//     } catch (error) {
//         console.error('Ошибка при извлечении ссылок:', error.message);
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

//     while (true) {
//         const currentUrl = searchUrl.replace(/(&page=)\d+/, `&page=${page}`).replace(/(&countpage=)\d+/, '$1' + 100); 
//         console.log(`Запрос к: ${currentUrl}`);

//         const linksFromPage = await extractLinksFromSearchUrl(currentUrl);
        
//         if (linksFromPage.length > 0) {
//             allLinks = allLinks.concat(linksFromPage);
//             console.log(`Собрано ссылок: ${allLinks.length}`);
//         } else {
//             console.log('На этой странице больше никаких ссылок не найдено.');
//             break; 
//         }

//         page += 1; 
//         await delay(1500); // Время задержки между запросами
//     }

//     console.log(`Всего найдено ссылок: ${allLinks.length}`);

//     // Сохраняем собранные ссылки в файл
//     saveVisitedLinks(allLinks);

//     // Передаем ссылки в linkExtractor
//     await openLinks(allLinks);
// }

// const searchUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2011&year[0].lte=2011&categories.main.id=1&country.import.usa.not=-1&region.id[0]=11&price.currency=1&top=11&abroad.not=0&custom.not=1&page=0&size=100';
// main(searchUrl);

// module.exports = { extractLinksFromSearchUrl, saveVisitedLinks };