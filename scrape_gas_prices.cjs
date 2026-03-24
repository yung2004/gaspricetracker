const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://www.gasbuddy.com/gasprices/british-columbia/richmond';
const DATA_DIR = path.join(__dirname, 'data', 'richmond');
const PUBLIC_DATA_DIR = path.join(__dirname, 'public', 'data', 'richmond');

function getCaptureTime() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    //const pst = new Date(utc - 8 * 60 * 60 * 1000);
    const pst = new Date(utc - 7 * 60 * 60 * 1000);  // day light saving
    const year = pst.getFullYear();
    const month = String(pst.getMonth() + 1).padStart(2, '0');
    const day = String(pst.getDate()).padStart(2, '0');
    const hours = String(pst.getHours()).padStart(2, '0');
    const minutes = String(pst.getMinutes()).padStart(2, '0');
    const seconds = String(pst.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US'
    });
    
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    
    const captureTime = getCaptureTime();
    
    const data = await page.evaluate(() => {
        const divs = document.querySelectorAll('div[class*="station"], div[class*="card"], article, section[class*="list"]');
        const stations = [];
        const seenNames = new Set();
        
        divs.forEach((div) => {
            const text = div.innerText;
            const priceMatch = text.match(/(\d+\.?\d*)\s*¢/);
            
            if (priceMatch) {
                const price = priceMatch[1];
                const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                
                let name = '';
                
                for (let j = 0; j < Math.min(lines.length, 40); j++) {
                    const line = lines[j];
                    
                    if (line.includes('¢')) continue;
                    if (line.includes('Richmond') || line.includes(', BC')) continue;
                    
                    const skipPhrases = ['Amenities', 'Reviews', 'Details', 'VIEW FULL', 
                                       'Pay at Pump', 'Restrooms', 'Air Pump', 'ATM', 
                                       'C-Store', 'Propane', 'Car Wash', 'Lotto', 
                                       'Service Station', 'Full Service', 'Loyalty', 
                                       'Restaurant', 'Membership', 'Payphone', 
                                       'Minutes', 'Hour', 'Days', 'Ago'];
                    
                    if (skipPhrases.some(p => line.includes(p))) continue;
                    if (/^\d{3,}$/.test(line)) continue;
                    
                    const brands = ['Super Save', 'Mobil', 'Petro-Canada', 'Chevron', 
                                   'Shell', 'Esso', 'Domo', 'Pioneer', 'Petro', 'Husky', 
                                   'Costco', 'Walmart', 'Safeway', 'Parkland'];
                    
                    for (const brand of brands) {
                        if (line.includes(brand)) {
                            name = line;
                            break;
                        }
                    }
                    
                    if (name) break;
                }
                
                if (name && !seenNames.has(name)) {
                    seenNames.add(name);
                    stations.push({ name, price });
                }
            }
        });
        
        return stations.slice(0, 10);
    });
    
    console.log(`Capture Time: ${captureTime}`);
    console.log(`Number of stations found: ${data.length}`);
    console.log();
    
    console.log('Station Name,Price ($/L),Capture Time');
    for (const station of data) {
        const priceCents = parseFloat(station.price);
        const priceLiters = priceCents / 100;
        console.log(`${station.name},${priceLiters.toFixed(3)},${captureTime}`);
    }
    
    if (data.length > 0) {
        const prices = data.map(s => parseFloat(s.price) / 100);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        console.log(`\nAverage Price: $${avgPrice.toFixed(3)}/L`);

        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(PUBLIC_DATA_DIR)) {
            fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
        }

        const avgCsvPath = path.join(DATA_DIR, 'avg.csv');
        const avgPublicPath = path.join(PUBLIC_DATA_DIR, 'avg.csv');
        const avgHeader = 'average,price,capture time\n';
        if (!fs.existsSync(avgCsvPath)) {
            fs.writeFileSync(avgCsvPath, avgHeader, 'utf-8');
            fs.writeFileSync(avgPublicPath, avgHeader, 'utf-8');
        }
        const avgLine = `average,${avgPrice.toFixed(3)},${captureTime}\n`;
        fs.appendFileSync(avgCsvPath, avgLine, 'utf-8');
        fs.appendFileSync(avgPublicPath, avgLine, 'utf-8');
        console.log(`Average appended to: ${avgCsvPath}`);

        const vendorsCsvPath = path.join(DATA_DIR, 'vendors.csv');
        const vendorsPublicPath = path.join(PUBLIC_DATA_DIR, 'vendors.csv');
        const vendorsHeader = 'station name,price,capture time\n';
        if (!fs.existsSync(vendorsCsvPath)) {
            fs.writeFileSync(vendorsCsvPath, vendorsHeader, 'utf-8');
            fs.writeFileSync(vendorsPublicPath, vendorsHeader, 'utf-8');
        }
        for (const station of data) {
            const priceLiters = parseFloat(station.price) / 100;
            const vendorLine = `${station.name},${priceLiters.toFixed(3)},${captureTime}\n`;
            fs.appendFileSync(vendorsCsvPath, vendorLine, 'utf-8');
            fs.appendFileSync(vendorsPublicPath, vendorLine, 'utf-8');
        }
        console.log(`Stations appended to: ${vendorsCsvPath}`);
    }
    
    await browser.close();
}

main().catch(console.error);
