import { chromium } from '../../output/browser-check/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'msedge', headless:true});
try {
 const context = await browser.newContext();
 await context.addInitScript(() => {
  localStorage.setItem('accessToken','expired-access'); localStorage.setItem('refreshToken','test-refresh');
  localStorage.setItem('virtual-guard.session',JSON.stringify({id:'user',name:'Audit Admin',email:'audit@example.com',role:'ADMIN'}));
 });
 const page = await context.newPage();
 const rows = [
 {id:'pending-id',cameraId:'cam-storage',cameraLabel:'Storage',detectionType:'SHOPLIFTING',confidence:.9,suspicionScore:85,reviewStatus:'PENDING_REVIEW',detectedAt:'2026-09-14T08:00:00',annotatedVideoFileName:'clip.mp4',notes:[],evidence:{}},
 {id:'confirmed-id',cameraId:'cam-storage',cameraLabel:'Older camera',detectionType:'SHOPLIFTING',confidence:.8,suspicionScore:75,reviewStatus:'CONFIRMED',detectedAt:'2026-01-01T08:00:00',notes:[],evidence:{}}
 ];
 let tickets = 0, refreshes = 0, expireTicket = true, denyRefresh = false;
 const footage = await readFile(new URL('./fixtures/clip.mp4', import.meta.url));
 await page.route('**/api/**',async route => {
  const url = new URL(route.request().url()); const path = url.pathname;
  const json = body => route.fulfill({json:body});
  if (path==='/api/auth/refresh') { refreshes++; return denyRefresh ? route.fulfill({status:401,json:{error:'Account is deactivated'}}) : json({accessToken:'fresh-access',refreshToken:'fresh-refresh'}); }
  if (path.endsWith('/ticket')) {
   if (expireTicket) { expireTicket=false; return route.fulfill({status:401}); }
   return json({ticket:'file-ticket-'+ ++tickets});
  }
  if (path==='/api/video/clip.mp4') return route.fulfill({contentType:'video/mp4',body:footage});
  if (path==='/api/incidents') return json(rows);
  if (path.endsWith('/notes')) { const row=rows.find(r=>path.includes(r.id)); const note=route.request().postDataJSON(); row.notes.push({...note,author:'audit@example.com',createdAt:new Date().toISOString()}); return json(row); }
  if (path.startsWith('/api/incidents/')) return json(rows.find(r=>path.includes(r.id)));
  if (path==='/api/cameras') return json([{id:'cam-storage',label:'Storage',x:17,y:63,monitored:true,status:'ALERT'}]);
  return json([]);
 });
 await page.goto('http://127.0.0.1:5175/reports');
 await page.getByText('ID: pending-id',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
 assert.equal(refreshes,1); assert.equal(await page.evaluate(()=>localStorage.getItem('accessToken')),'fresh-access');
 assert.match(await page.locator('video').getAttribute('src'),/ticket=file-ticket-/);
 assert.doesNotMatch(await page.locator('video').getAttribute('src'),/access|refresh/);
 const before=tickets;
 await page.locator('video').evaluate(video=>{video.currentTime=.4;video.dispatchEvent(new Event('error'));});
 await page.waitForFunction(n=>document.querySelector('video')?.src.includes('file-ticket-'+n),before+1);
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
 assert.equal(await page.getByText('Unable to load video evidence').count(),0);
 await page.locator('select').selectOption('CONFIRMED');
 await page.getByText('ID: confirmed-id',{exact:true}).waitFor();
 assert.equal(await page.getByText('ID: pending-id',{exact:true}).count(),0);
 await page.getByPlaceholder('Search reports').fill('no-matching-record');
 await page.getByText('No reports match these filters.').waitFor();
 assert.equal(await page.getByText('Report details',{exact:true}).count(),0);
 await page.getByPlaceholder('Search reports').fill(''); await page.locator('select').selectOption('ALL');
 await page.locator('textarea').fill('Persisted audit note');
 await page.getByRole('button',{name:'Save review',exact:true}).click();
 await page.locator('p').filter({hasText:'Persisted audit note'}).waitFor();
 await page.reload(); await page.locator('p').filter({hasText:'Persisted audit note'}).waitFor();
 console.log('PASS reports filters, empty state, notes-only save/reload, media refresh/recovery');
 await page.goto('http://127.0.0.1:5175/settings');
 await page.getByTitle('Storage',{exact:true}).waitFor();
 assert.equal(await page.getByTitle('Storage',{exact:true}).evaluate(el=>el.style.left),'17%');
 assert.equal(await page.getByTitle('Storage',{exact:true}).evaluate(el=>el.style.top),'63%');
 await page.goto('http://127.0.0.1:5175/');
 await page.waitForFunction(()=>[...document.querySelectorAll('[style]')].some(el=>el.style.left==='17%'&&el.style.top==='63%'));
 console.log('PASS saved named camera coordinates in Settings and dashboard');
 await page.goto('http://127.0.0.1:5175/reports');
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
 expireTicket=true; denyRefresh=true;
 await page.locator('video').evaluate(video=>video.dispatchEvent(new Event('error')));
 await page.waitForURL('**/login');
 assert.equal(await page.evaluate(()=>localStorage.getItem('accessToken')),null);
 console.log('PASS failed media session refresh returns to login');
} finally { await browser.close(); }