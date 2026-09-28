import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.UI_BASE_URL || 'http://localhost:5180';
const browser = await chromium.launch({...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {}),headless:true});
const sizes = [[390,844],[768,1024],[1366,768],[1440,900],[1920,1080],[2560,1440],[3440,1440],[3840,2160]];
const out = new URL('../../output/submission-audit/ui/', import.meta.url);
await mkdir(out,{recursive:true});
try {
 const context=await browser.newContext();
 await context.addInitScript(()=>localStorage.setItem('accessToken','ui-fixture'));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let role='ADMIN', mustChange=false, failSave=false;
 const user=()=>({id:'u1',name:'Example Officer',email:'officer@example.test',role,mustChangePassword:mustChange});
 const guards=[{id:'g1',name:'Example Security Guard',email:'officer@example.test',phone:'0123456789',badgeNumber:'VG-001',status:'ACTIVE',dateJoined:'2026-09-01',loginAvailable:true}];
 const cameras=['Storage','Aisle A','Aisle B','Checkout','Entrance'].map((label,i)=>({id:'c'+i,label,x:20+i*12,y:20+i*14,monitored:true,status:i===0?'REVIEW':'IDLE'}));
 const incidents=[{id:'case-001',cameraId:'c0',cameraLabel:'Storage',detectionType:'SHOPLIFTING',confidence:.82,suspicionScore:75,reviewStatus:'PENDING_REVIEW',detectedAt:new Date().toISOString(),notes:[],evidence:{}}];
 await page.route('**/health',r=>r.fulfill({json:{status:'UP'}}));
 await page.route('**/api/**',async r=>{
  const req=r.request(),url=new URL(req.url()),path=url.pathname;
  if(path==='/api/auth/me')return r.fulfill({json:user()});
  if(path==='/api/auth/login')return r.fulfill({json:{accessToken:'ui-fixture',refreshToken:'ui-refresh',user:user()}});
  if(path==='/api/auth/change-password') {mustChange=false;return r.fulfill({json:{accessToken:'ui-new',refreshToken:'ui-refresh-new',user:user()}});}
  if(path==='/api/notifications/count')return r.fulfill({json:{count:1}});
  if(path==='/api/cameras'&&req.method()==='GET')return r.fulfill({json:cameras});
  if(path.startsWith('/api/cameras/')&&req.method()==='PUT'){Object.assign(cameras[0],req.postDataJSON());return r.fulfill({json:cameras[0]});}
  if(path==='/api/jobs')return r.fulfill({json:[]});
  if(path==='/api/guards'&&req.method()==='GET')return r.fulfill({json:guards});
  if(path==='/api/guards'&&req.method()==='POST') {
   if(failSave)return r.fulfill({status:400,json:{error:'Badge number already exists'}});
   const item={...req.postDataJSON(),id:'g2',status:'ACTIVE',dateJoined:'2026-09-27',loginAvailable:true};guards.push(item);return r.fulfill({json:item});
  }
  if(path==='/api/guards/g1'&&req.method()==='PUT'){Object.assign(guards[0],req.postDataJSON());return r.fulfill({json:guards[0]});}
  if(path.endsWith('/status')){guards[0].status=url.searchParams.get('status');return r.fulfill({json:guards[0]});}
  if(path.endsWith('/reset-password'))return r.fulfill({status:204});
  if(path==='/api/incidents')return r.fulfill({json:incidents});
  if(path==='/api/incidents/case-001')return r.fulfill({json:incidents[0]});
  return r.fulfill({status:404,json:{error:'Unexpected fixture request'}});
 });
 const routes=[['/','Camera recordings'],['/reports','Incidents'],['/reports?view=trends','Incident trends'],['/settings','Camera settings'],['/guards','Security guards']];
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  for(const [path,title] of routes){
   await page.goto(base+path);await page.getByRole('heading',{name:title,exact:true}).waitFor();
   assert.ok(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${path}: horizontal overflow at ${width}`);
   if(width===1366 || width===2560)await page.screenshot({path:fileURLToPath(new URL(`${width}-${title.replaceAll(' ','-')}.png`,out)),fullPage:true});
  }
 }
 await page.setViewportSize({width:1366,height:768});
 await page.goto(base+'/settings');await page.getByRole('heading',{name:'Camera settings'}).waitFor();
 assert.equal(await page.locator('main').getByText('Detection',{exact:true}).count(),0);
 await page.getByLabel('Display name',{exact:true}).fill('Updated Storage');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.goto(base+'/guards');await page.getByRole('button',{name:'View profile',exact:true}).click();
 for(const action of ['Suspend','Reactivate','Deactivate','Reactivate','Reset password']){
  await page.getByRole('button',{name:action,exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 }
 await page.getByRole('button',{name:'Edit guard',exact:true}).click();await page.getByLabel('Full name').fill('Updated Guard');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Add guard',exact:true}).click();
 for(const [label,value] of [['Full name','New Guard'],['Email','new@example.test'],['Phone','0123456789'],['Badge number','VG-002'],['Initial login password (new accounts)','Fixture-password-123']])await page.getByLabel(label,{exact:true}).fill(value);
 failSave=true;await page.locator('#guard-form').getByRole('button',{name:'Add Guard',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();
 failSave=false;await page.locator('#guard-form').getByRole('button',{name:'Add Guard',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('link',{name:'Settings',exact:true}).waitFor();await page.getByRole('button',{name:'Close menu'}).click();
 role='SECURITY_GUARD';await page.goto(base+'/settings');await page.getByRole('heading',{name:'Camera recordings'}).waitFor();
 await page.getByRole('button',{name:'Open menu'}).click();assert.equal(await page.getByRole('link',{name:'Settings',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'Guards',exact:true}).count(),0);await page.getByRole('button',{name:'Close menu'}).click();
 mustChange=true;await page.goto(base+'/');await page.getByRole('heading',{name:'Change password',exact:true}).waitFor();assert.ok(page.url().endsWith('/change-password'));
 await page.getByLabel('Current or temporary password').fill('Temporary-password-123');await page.getByLabel('New password',{exact:true}).fill('Personal-password-456');await page.getByLabel('Confirm new password').fill('Wrong-password-123');await page.getByRole('button',{name:'Save new password'}).click();await page.getByRole('alert').waitFor();
 await page.getByLabel('Confirm new password').fill('Personal-password-456');await page.getByRole('button',{name:'Save new password'}).click();await page.getByRole('heading',{name:'Camera recordings'}).waitFor();
 await page.goto(base+'/change-password');await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
 assert.equal(await page.getByText('Local bootstrap accounts').count(),0);
 for(const [width,height] of sizes){await page.setViewportSize({width,height});assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 assert.deepEqual(errors,[]);
 console.log(`PASS: 5 active workspaces at ${sizes.map(s=>s.join('x')).join(', ')}; settings, guard create/edit/status/reset, errors, role navigation, forced change and logout (mock APIs). No page errors.`);
} finally {await browser.close();}
