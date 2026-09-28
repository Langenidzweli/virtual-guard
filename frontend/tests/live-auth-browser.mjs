import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const cfg=Object.fromEntries((await readFile(new URL('../../.env',import.meta.url),'utf8')).split(/\r?\n/).filter(line=>line.includes('=')&&!line.trim().startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}));
const base=process.env.UI_BASE_URL || `http://localhost:${cfg.FRONTEND_PORT||8080}`;
const apiBase=`http://localhost:${cfg.BACKEND_PORT||8090}`;
const fixtureId=randomUUID().replaceAll('-',''), fixtureEmail=`browser_${fixtureId}@example.invalid`;
const initialPassword='Initial-'+randomUUID(), personalPassword='Personal-'+randomUUID();
const browser=await chromium.launch({...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{}),headless:true});
let stage='fixture setup';
try {
 const adminResponse=await fetch(apiBase+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@virtualguard.com',password:cfg.BOOTSTRAP_PASSWORD})});
 assert.equal(adminResponse.status,200);const admin=await adminResponse.json();
 const created=await fetch(apiBase+'/api/guards',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+admin.accessToken},body:JSON.stringify({name:'Browser regression fixture',email:fixtureEmail,phone:'0000000000',badgeNumber:'B-'+fixtureId.slice(0,12),password:initialPassword})});assert.equal(created.status,201);
 const context=await browser.newContext({viewport:{width:1366,height:768}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.name));
 for(const [email,isAdmin] of [['admin@virtualguard.com',true],[fixtureEmail,false]]){
  stage=isAdmin?'administrator login and routes':'guard forced change and routes';
  await page.goto(base+'/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(isAdmin?cfg.BOOTSTRAP_PASSWORD:cfg.GUARD_TEMPORARY_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  if(!isAdmin){
   await page.getByRole('heading',{name:'Change password',exact:true}).waitFor();
   await page.getByLabel('Current or temporary password').fill(cfg.GUARD_TEMPORARY_PASSWORD);await page.getByLabel('New password',{exact:true}).fill(personalPassword);await page.getByLabel('Confirm new password').fill(personalPassword);await page.getByRole('button',{name:'Save new password'}).click();
  }
  await page.getByRole('heading',{name:'Camera recordings',exact:true}).waitFor();
  for(const [path,title] of isAdmin?[['/settings','Camera settings'],['/guards','Security guards'],['/reports','Incidents'],['/reports?view=trends','Incident trends']]:[['/reports','Incidents']]){await page.goto(base+path);await page.getByRole('heading',{name:title,exact:true}).waitFor();}
  if(isAdmin){
   stage='administrator reset confirmation';await page.goto(base+'/guards');await page.getByPlaceholder('Search guards').fill(fixtureEmail);await page.getByRole('button',{name:'View profile',exact:true}).click();await page.getByRole('button',{name:'Reset password',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await page.getByText('Password reset to the configured temporary password. The guard must change it at next login.',{exact:true}).waitFor();
  } else {await page.goto(base+'/guards');await page.getByRole('heading',{name:'Camera recordings',exact:true}).waitFor();}
  await page.goto(base+'/change-password');await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('accessToken')),null);
 }
 stage='guard login with new password';const verifyLogin=await fetch(apiBase+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fixtureEmail,password:personalPassword})});assert.equal(verifyLogin.status,200);await page.getByLabel('Email',{exact:true}).fill(fixtureEmail);await page.getByLabel('Password',{exact:true}).fill(personalPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Camera recordings',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS real browser ADMIN/GUARD login, routes, admin reset confirmation, forced password change, new-password login, role redirect and logout; no page errors.');
} catch(error){let message=String(error.message);for(const value of [...Object.entries(cfg).filter(([key])=>/PASSWORD|SECRET|KEY|TOKEN/.test(key)).map(([,v])=>v),initialPassword,personalPassword])if(value)message=message.replaceAll(value,'[REDACTED]');console.error('Live browser failure at '+stage+': '+message);process.exitCode=1;}
finally {
 await browser.close();
 execFileSync('docker',['compose','exec','-T','postgres','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'],{cwd:root,input:`BEGIN; DELETE FROM guards WHERE email='${fixtureEmail}'; DELETE FROM users WHERE email='${fixtureEmail}' AND role='SECURITY_GUARD'; COMMIT;`,stdio:['pipe','pipe','pipe']});
 console.log('Disposable browser guard/account removed.');
}
