const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 const page = await browser.newPage({viewport:{width:1000,height:800},reducedMotion:'reduce'}); page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CHESS_URL || 'http://localhost:5173');
 const board=page.locator('canvas[role=application]');
 await board.waitFor();
 let square='e2';
 async function moveTo(to){
  await board.evaluate((canvas, {from,to}) => {
   canvas.focus();
   function key(key) { canvas.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})); }
   const dx=to.charCodeAt(0)-from.charCodeAt(0), dy=Number(to[1])-Number(from[1]);
   for(let i=0;i<Math.abs(dx);i++)key(dx>0?'ArrowRight':'ArrowLeft');
   for(let i=0;i<Math.abs(dy);i++)key(dy>0?'ArrowUp':'ArrowDown');
  },{from:square,to});
  square=to;
 }
 async function enter(){await board.evaluate(canvas=>canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));}
 async function move(from,to){console.log('move',from,to);await moveTo(from);await enter();await moveTo(to);await enter();await page.waitForTimeout(400);}
 await move('e2','e4');assert.match(await page.locator('#history-list').innerText(),/e4/);
 await page.locator('#undo-btn').click();assert.equal(await page.locator('#history-list').innerText(),'');
 await page.locator('#mode-select').selectOption('hvai');square='e2';
 await move('e2','e4');await page.waitForFunction(()=>document.querySelectorAll('#history-list .move').length===2 && document.querySelectorAll('#history-list .move')[1].textContent.length>0);
 await page.locator('#undo-btn').click();assert.equal(await page.locator('#history-list').innerText(),'');
 await move('e2','e4');await page.locator('#reset-btn').click();square='e2';await page.waitForTimeout(2000);assert.equal(await page.locator('#history-list').innerText(),'');
 await page.locator('#mode-select').selectOption('hvh');square='e2';
 await move('f2','f3');await move('e7','e5');await move('g2','g4');await move('d8','h4');
 assert.equal(await page.locator('#overlay').evaluate(e=>e.open),true);assert.match(await page.locator('#overlay-msg').innerText(),/Dusk wins/);
 await page.locator('#overlay-close').click();await page.locator('#undo-btn').click();assert.match(await page.locator('#status').innerText(),/Dusk/);
 await page.locator('#reset-btn').click();
 square='e2';
 await move('a2','a4');await move('h7','h5');await move('a4','a5');await move('h5','h4');
 await move('a5','a6');await move('h4','h3');await move('a6','b7');await move('h3','g2');await move('b7','a8');
 assert.equal(await page.locator('#promotion-dialog').evaluate(e=>e.open),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#promotion-dialog').evaluate(e=>e.open),false);
 await move('b7','a8');await page.locator('[data-promotion=n]').click();
 assert.match(await page.locator('#history-list').innerText(),/bxa8=N/);
 await page.locator('#reset-btn').click();
 await page.screenshot({path:'/tmp/chess-desktop.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await page.reload();await board.waitFor();await page.waitForTimeout(500);
 assert.match(await board.getAttribute('aria-label'),/e2/);
 await page.screenshot({path:'/tmp/chess-mobile.png'});
 for(const id of ['#mode-select','#undo-btn','#reset-btn']){const r=await page.locator(id).boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390&&r.y+r.height<=844);}
 await page.locator('#animal-guide-trigger').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#animal-guide').evaluate(e=>e.hidden),true);
 assert.deepEqual(errors,[]);console.log('PASS: human moves, undo, computer reply, paired undo, reset cancellation, checkmate dialog/winner, mobile controls, reduced-motion startup, guide, no runtime errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
