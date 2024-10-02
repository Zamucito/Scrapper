const puppeteer = require('puppeteer');
const fs = require('fs');

const generateUniqueId = () => {
  return `img-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const dbFilePath = 'db.json';
let results = { images: [] };
if (fs.existsSync(dbFilePath)) {
  results = JSON.parse(fs.readFileSync(dbFilePath, 'utf-8'));
  if (!results.images) results.images = [];
}

(async () => {
  const pinterestUrl = `https://es.pinterest.com/zamucito83/pfp/`;  // replace with the link from your pinterest board

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(pinterestUrl, { waitUntil: 'networkidle2' });

  let previousHeight;
  let images = new Set(); 
  let scrollCount = 0;
  const maxScrolls = 120;

  try {
    while (scrollCount < maxScrolls) {
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newImages = await page.evaluate(() => {
        const imgElements = document.querySelectorAll('div[data-test-id="pin"] img');
        return Array.from(imgElements).map(img => {
          let url = img.src;

          if (img.srcset) {
            const srcsetUrls = img.srcset.split(',').map(src => src.trim().split(' '));
            const highestResolution = srcsetUrls.reduce((acc, curr) => {
              const [srcUrl, width] = curr;
              return parseInt(width) > parseInt(acc[1] || '0') ? curr : acc;
            }, []);
            url = highestResolution[0];
          }


          if (url && url.includes('.gif')) {
            return url.replace(/\/\d+x\//, '/originals/');
          }

          if (url && url.includes('pinimg.com')) {
            return url.replace(/\/\d+x\//, '/236x/');
          }

          return null;
        }).filter(Boolean);
      });

      newImages.forEach(url => images.add(url)); 

      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === previousHeight) {
        console.log("Llegamos al final de la página.");
        break;
      }

      scrollCount++;
      console.log(`Scroll ${scrollCount}/${maxScrolls} completado. Encontradas ${images.size} imágenes hasta ahora.`);
    }

    const existingUrls = new Set(results.images.map(item => item.url));
    let newImagesAdded = 0;

    images.forEach(url => {
      if (!existingUrls.has(url)) {
        const id = generateUniqueId();
        results.images.push({ id, url });
        existingUrls.add(url);
        newImagesAdded++;
      }
    });

    console.log(`Añadidas ${newImagesAdded} nuevas imágenes únicas.`);

  } catch (error) {
    console.error(`Error al extraer imágenes:`, error);
  }

  await browser.close();

  fs.writeFileSync(dbFilePath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`Scraping completed: ${results.images.length}`);
})();
