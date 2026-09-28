const base = process.env.UI_BASE_URL || 'http://localhost:5180';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {}),headless:true});
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addInitScript(()=>{localStorage.setItem('accessToken','test');localStorage.setItem('virtual-guard.session',JSON.stringify({id:'test',name:'Admin',email:'test@example.com',role:'ADMIN'}));});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const rows=[{id:'pending',cameraId:'c1',cameraLabel:'Entrance',detectionType:'SHOPLIFTING',confidence:.9,suspicionScore:75,reviewStatus:'PENDING_REVIEW',detectedAt:new Date().toISOString(),notes:[],evidence:{}},{id:'past',cameraId:'c2',cameraLabel:'Storage',detectionType:'SHOPLIFTING',confidence:.8,suspicionScore:50,reviewStatus:'CONFIRMED',detectedAt:new Date().toISOString(),reviewedBy:'Officer Example',reviewedAt:new Date().toISOString(),notes:[{id:'note',text:'Historical note',author:'Officer Example',createdAt:new Date().toISOString()}],evidence:{}}];
 let loads=0;
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/auth/me')return route.fulfill({json:{id:'test',name:'Admin',email:'test@example.com',role:'ADMIN'}});if(url.pathname==='/api/incidents'){loads++;return route.fulfill({json:rows});}return route.fulfill({json:[]});});
 await page.route('**/health',r=>r.fulfill({json:{status:'UP'}}));
 await page.goto(base+'/reports');await page.getByRole('heading',{name:'Incidents',exact:true}).waitFor();
 await page.getByPlaceholder('Search reports').fill('Officer Example');await page.getByText('Reference: past',{exact:true}).waitFor();await page.getByText('Historical note',{exact:true}).waitFor();
 await page.locator('textarea').fill('Draft to preserve');
 const before=loads;await page.getByRole('link',{name:'Trends',exact:true}).click();await page.getByRole('heading',{name:'Incident trends'}).waitFor();
 await page.getByRole('link',{name:'Records & review',exact:true}).click();assert.equal(await page.locator('textarea').inputValue(),'Draft to preserve');assert.equal(await page.getByPlaceholder('Search reports').inputValue(),'Officer Example');assert.equal(loads,before);
 await page.getByRole('button',{name:'Clear report filters'}).click();assert.equal(await page.getByPlaceholder('Search reports').inputValue(),'');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();assert.match((await downloadPromise).suggestedFilename(),/incidents/);
 for(const [path,title] of [['/analytics','Incident trends'],['/history','Incident records']]) {await page.goto('http://localhost:5180'+path);await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.match(page.url(),/\/reports/);}
 await page.getByRole('button',{name:'Open menu',exact:true}).click();assert.equal(await page.getByRole('link',{name:'Incidents',exact:true}).count(),1);for(const name of ['Analytics','Reports','History']) assert.equal(await page.getByRole('link',{name,exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS unified navigation, legacy redirects, shared data, reviewer search, review history, draft/filter preservation, and CSV export.');
}finally{await browser.close();}
