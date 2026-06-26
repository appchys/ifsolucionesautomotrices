const puppeteer = require('puppeteer');

async function run() {
  console.log('Iniciando diagnóstico...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capturar logs de consola
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    if (msg.text().includes('DEBUG') || msg.text().includes('setInspeccionOpen') || msg.text().includes('isModalInspeccionOpen')) {
      // Imprimir el mensaje completo
      console.log('DEBUG LOG DETECTADO:', msg.text());
    }
  });

  try {
    console.log('Visitando login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });

    console.log('Llenando credenciales...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@ifsolucionesautomotrices.com');
    await page.type('input[type="password"]', 'Admin2024!');
    
    console.log('Enviando formulario...');
    await page.click('button[type="submit"]');

    console.log('Esperando navegación al dashboard...');
    // Esperar a que cambie la URL o aparezca un elemento del dashboard
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    console.log('Login exitoso. Estamos en:', page.url());

    // Esperar 1 segundo
    await new Promise(r => setTimeout(r, 1000));

    console.log('Abriendo bandeja de chat...');
    const chatToggleSelector = '#sidebar-chat-toggle';
    await page.waitForSelector(chatToggleSelector);
    await page.click(chatToggleSelector);

    console.log('Esperando a que la bandeja de chat cargue...');
    const chatItemSelector = '.chat-inbox-item';
    await page.waitForSelector(chatItemSelector, { timeout: 10000 });

    console.log('Haciendo clic en el primer chat de la bandeja...');
    await page.click(chatItemSelector);
    
    console.log('Esperando 3 segundos para ver si se abre la inspección...');
    await new Promise(r => setTimeout(r, 3000));

    console.log('Finalizando diagnóstico.');
  } catch (error) {
    console.error('Error durante el diagnóstico:', error);
  } finally {
    await browser.close();
  }
}

run();
