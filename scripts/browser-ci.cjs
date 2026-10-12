
const { chromium, webkit } = require('playwright');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const server = createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(process.cwd(), name === '/' ? 'index.html' : name);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  const types = {'.html':'text/html', '.js':'text/javascript', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const engine of [chromium, webkit]) {
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ viewport: {width:390, height:844}, reducedMotion:'reduce', hasTouch:true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.route('https://fonts.gstatic.com/**', route => route.abort());
        // The app must work even when an old external rating file cannot load.
        await page.route('**/mastery.js*', route => route.abort());
        await page.clock.install();
        await page.goto(url);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        assert.equal(await page.locator('#map td').count(),64);
        await page.locator('#soundBtn').click();
        await page.locator('[data-n="all"]').click();
        assert.equal(await page.locator('[data-n="7"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('[data-n="2"]').getAttribute('aria-pressed'),'false');
        await page.locator('#goBtn').click();
        await page.clock.runFor(300);
        await page.locator('#quitBtn').click();
        await page.locator('#goBtn').click();
        await page.clock.runFor(2200);
        assert.equal(await page.locator('#count').isVisible(),true);
        await page.clock.runFor(300);
        assert.equal(await page.locator('#count').isVisible(),false);
        assert.equal(await page.locator('#qa').innerText(),'7');
        let answer = Number(await page.locator('#qa').innerText()) * Number(await page.locator('#qb').innerText());
        await page.locator('[data-k="1"]').click();
        await page.locator('[data-k="del"]').click();
        assert.equal(await page.locator('#ans').innerText(),'?');
        for (const digit of String(answer)) await page.locator('[data-k="'+digit+'"]').click();
        assert.ok(Number(await page.locator('#score').innerText()) > 0);
        await page.clock.runFor(250);
        await page.keyboard.type('00');
        assert.equal(await page.locator('#hint').innerText(),'Запомни!');
        await page.clock.runFor(1400);
        await page.clock.runFor(60000);
        assert.equal(await page.locator('#result').isVisible(),true);
        assert.equal(await page.locator('#rOk').innerText(),'1');
        assert.equal(await page.locator('#rBad').innerText(),'1');
        await page.locator('#againBtn').click();
        await page.clock.runFor(2500);
        assert.equal(await page.locator('#game').isVisible(),true);
        await page.locator('#quitBtn').click();
        assert.equal(await page.locator('#map td').count(),64);
        assert.equal(await page.locator('#fixBtn').isVisible(),true);
        await page.locator('#fixBtn').click();
        await page.clock.runFor(2500);
        await page.locator('#quitBtn').click();
        await page.reload();
        assert.equal(await page.locator('#map td').count(),64);
        assert.equal(await page.locator('#fixBtn').isVisible(),true);

        // Star ranks are independent of knowledge; check every boundary and the visible journey.
        for (const [stars, name, position] of [
          [0,'Искра',1],[4,'Искра',1],[5,'На разгоне',2],[14,'На разгоне',2],
          [15,'Турбо',3],[29,'Турбо',3],[30,'Босс умножения',4],[59,'Босс умножения',4],
          [60,'Легенда',5],[99,'Легенда',5],[100,'Сверхзвезда',6],[159,'Сверхзвезда',6],
          [160,'Герой галактики',7],[249,'Герой галактики',7],[250,'Чемпион вселенной',8]
        ]) {
          await page.evaluate(stars => localStorage.setItem('umnozhayka-v1', JSON.stringify({stars,sound:false})), stars);
          await page.reload();
          assert.equal(await page.locator('#rankName').innerText(), name);
          assert.equal(await page.locator('#rankPosition').innerText(), String(position));
          assert.equal(await page.locator('#rankTotal').innerText(), '8');
          assert.equal(await page.locator('#rankJourney .rank-step').count(), 8);
          assert.equal(await page.locator('#rankJourney .rank-step.current').count(), 1);
          assert.equal(await page.locator('#rankJourney .rank-step.current strong').innerText(), name);
          assert.equal(await page.locator('#masteryTitle').innerText(), 'Освоено 0 из 64');
          assert.equal(await page.locator('#masteryScore').innerText(), '0');
          assert.equal(await page.locator('#map td').count(), 64);
        }

        // Crossing a boundary must reveal a clear reward, not only change a label in the menu.
        await page.evaluate(() => localStorage.setItem('umnozhayka-v1', JSON.stringify({stars:4,sound:false})));
        await page.reload();
        await page.locator('#goBtn').click();
        await page.clock.runFor(2500);
        for (let i = 0; i < 8; i++) {
          const value = Number(await page.locator('#qa').innerText()) * Number(await page.locator('#qb').innerText());
          for (const digit of String(value)) await page.locator('[data-k="'+digit+'"]').click();
          await page.clock.runFor(250);
        }
        await page.clock.runFor(60000);
        assert.equal(await page.locator('#result').isVisible(), true);
        assert.equal(await page.locator('#newRank').innerText(), 'Новое звание: На разгоне');
        assert.equal(await page.locator('#rankUnlock').isVisible(), true);
        assert.equal(await page.locator('#rankUnlockName').innerText(), 'На разгоне');
        assert.equal(await page.locator('#rankUnlockIcon').innerText(), '🚀');

        await page.evaluate(() => {
          const stats = {};
          for (let a=2;a<=9;a++) for(let b=2;b<=9;b++)
            stats[a+'x'+b]={n:5,err:0,last:[1,1,1,1,1],avgT:2000,lastAt:Date.now()};
          localStorage.setItem('umnozhayka-v1',JSON.stringify({stars:0,sound:false,stats}));
        });
        await page.reload();
        assert.equal(await page.locator('#rankName').innerText(),'Искра');
        assert.equal(await page.locator('#masteryTitle').innerText(),'Освоено 64 из 64');
        assert.equal(await page.locator('#masteryScore').innerText(),'100');
        assert.equal(await page.locator('#map td.m-good').count(),64);
        await page.locator('#soundBtn').click();
        assert.equal(await page.locator('#soundBtn').getAttribute('aria-pressed'),'true');
        await page.locator('#soundBtn').click();
        assert.equal(await page.locator('#soundBtn').getAttribute('aria-pressed'),'false');
        // Partially damaged legacy storage must not disable all controls.
        await page.evaluate(() => localStorage.setItem('umnozhayka-v1',JSON.stringify({
          tables:[], stats:{'7x8':{n:4,last:null},'bad':{}}, stars:null, best:'invalid'
        })));
        await page.reload();
        assert.equal(await page.locator('#map td').count(),64);
        await page.locator('#goBtn').click();
        await page.clock.runFor(2500);
        assert.equal(await page.locator('#count').isVisible(),false);
        assert.deepEqual(errors,[]);
        await context.close();
        console.log(engine.name() + ': menu, mobile keypad, keyboard, countdown restart, scoring, errors, results, replay, persistence, legacy storage PASS');
      } finally { await browser.close(); }
    }
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
