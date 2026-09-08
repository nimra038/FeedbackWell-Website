import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const origin = process.env.UI_BASE_URL || 'http://localhost:3001';
const artifacts = resolve('.artifacts');
await mkdir(artifacts, { recursive: true });
const edge = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = spawn(edge, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9227',`--user-data-dir=${resolve(artifacts,'edge-profile')}`,'about:blank'], { windowsHide:true, stdio:'ignore' });
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
async function waitFor(fn, label, timeout=120000) { const start=Date.now(); while(Date.now()-start<timeout){ if(await fn()) return; await delay(300); } throw new Error(`Timed out: ${label}`); }
try {
  await waitFor(async()=>{try{return (await fetch('http://127.0.0.1:9227/json/version')).ok;}catch{return false;}},'browser');
  const target = await (await fetch('http://127.0.0.1:9227/json/new?about:blank',{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0; const pending=new Map(); const failures=[];
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const portalToken='a'.repeat(64);
  const user={id:'staff-a',organizationId:'org-a',firstName:'Alex',lastName:'Morgan',email:'alex@example.test',role:'owner'};
  const organization={id:'org-a',name:'Demo Lending',brand_color:'#2d4a7a',timezone:'America/New_York',country:'US'};
  const customer={id:'customer-a',firstName:'Jordan',lastName:'Lee',email:'jordan@example.test',status:'active',customerType:'individual',createdAt:new Date().toISOString()};
  const documentRequest={id:'request-a',title:'Home purchase documents',status:'in_progress',portalToken,createdAt:new Date().toISOString(),dueDate:new Date(Date.now()-86400000).toISOString(),customer,creator:user,assignedUser:user,progress:{total:3,completed:1,missing:2}};
  const requirements=[{id:'requirement-a',name:'Government-issued ID',required:true,status:'missing',minFiles:1,maxFiles:10,documents:[]},{id:'requirement-b',name:'Bank statements',required:true,status:'accepted',minFiles:1,maxFiles:10,documents:[]},{id:'requirement-c',name:'Pay stubs',required:true,status:'missing',minFiles:1,maxFiles:10,documents:[]}];
  const messages=[{id:'internal-note',body:'STAFF_ONLY_FIXTURE',isInternal:true,senderType:'user',createdAt:new Date().toISOString()}];
  const checklist=()=>({total:3,completed:1,requirements,customer:{firstName:'Jordan'},status:'in_progress',description:'Please provide the documents below.'});
  socket.onmessage=async event=>{
    const message=JSON.parse(event.data);
    if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);if(message.error)p.reject(new Error(JSON.stringify(message.error)));else p.resolve(message.result);}return;}
    if(message.method==='Runtime.exceptionThrown') failures.push(message.params.exceptionDetails.text);
    if(message.method!=='Fetch.requestPaused')return;
    const {requestId,request}=message.params;
    const path=new URL(request.url).pathname;let data;let status=200;
    if(request.method==='OPTIONS')data={};
    else if(path==='/v1/users/me')data=user;
    else if(path==='/v1/organizations/org-a')data=organization;
    else if(path==='/v1/users')data=[user];
    else if(path==='/v1/requests')data=[documentRequest];
    else if(path==='/v1/requests/request-a')data=documentRequest;
    else if(path==='/v1/requests/request-a/requirements')data=requirements;
    else if(path==='/v1/customers')data=[customer];
    else if(path==='/v1/applications')data=[{id:'application-a',customerId:customer.id,customer,assignedUser:user,applicationNumber:'DEMO-001',applicationType:'Residential mortgage',status:'collecting'}];
    else if(path==='/v1/templates')data=[
      {id:'builtin-mortgage',name:'Residential mortgage - purchase',builtIn:true,requirements:[{name:'Government-issued ID'},{name:'Last 2 years W-2'},{name:'Last 2 months bank statements'},{name:'Purchase contract'},{name:'Homeowners insurance'}]},
      {id:'builtin-business',name:'Business loan - standard documentation',builtIn:true,requirements:[{name:'Business formation documents'},{name:'Business tax returns'},{name:'Business bank statements'},{name:'Profit & loss statement'},{name:'Balance sheet'},{name:'Business debt schedule'}]},
      {id:'builtin-tax',name:'Accounting & tax preparation',builtIn:true,requirements:[{name:'Government-issued ID'},{name:'Previous tax return'},{name:'Income statements'}]},
    ];
    else if(path==='/v1/audit')data=[];
    else if(path===`/v1/portal/${portalToken}`)data={title:documentRequest.title,emailHint:'j***@example.test',dueDate:documentRequest.dueDate,organization:{name:'Demo Lending'}};
    else if(path.endsWith('/otp/send'))data={message:'Code sent'};
    else if(path.endsWith('/otp/verify'))data={accessToken:'fixture-portal-token'};
    else if(path===`/v1/portal/${portalToken}/requirements`)data=checklist();
    else if(path===`/v1/portal/${portalToken}/upload`){requirements[0].status='uploaded';requirements[0].documents.push({id:'doc-a',originalName:'identity.pdf',fileSize:128,mimeType:'application/pdf',malwareScanPassed:true});data=requirements[0].documents[0];}
    else if(path.includes('/messages')){
      if(request.method==='POST'){const body=JSON.parse(request.postData||'{}');messages.push({id:`message-${messages.length}`,body:body.message,isInternal:body.isInternal||false,senderType:path.includes('/portal/')?'customer':'user',createdAt:new Date().toISOString()});}
      data=path.includes('/portal/')?messages.filter(m=>!m.isInternal):messages;
    } else {status=404;data={message:`Unmocked fixture path: ${path}`};failures.push(`Unmocked request ${path}`);}
    try{await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'authorization,content-type'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,DELETE,OPTIONS'},{name:'Access-Control-Allow-Credentials',value:'true'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});}catch(e){if(!e.message.includes('Invalid InterceptionId'))failures.push(e.message);}
  };
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/v1/*',requestStage:'Request'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"if(location.origin === '"+origin+"') localStorage.setItem('token','fixture-staff-token');"});
  const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const body=async()=>{try{return await evaluate('document.body?.innerText')||'';}catch{return '';}};
  const click=label=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(label)}))?.click()`);
  const fill=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const screenshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(artifacts,name),Buffer.from(r.data,'base64'));};
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`${origin}/dashboard`});await waitFor(async()=>(await body()).includes('1/3 complete'),'dashboard');
  assert.ok((await body()).includes('Demo Lending'));assert.ok(!(await body()).includes('Acme Lending'));
  await screenshot('dashboard-desktop.png');console.log('PASS dashboard data and desktop rendering');
  await send('Page.navigate',{url:`${origin}/templates`});await waitFor(async()=>(await body()).includes('Document templates'),'templates page');await delay(1500);const templatesBody=await body();assert.ok(templatesBody.toLowerCase().includes('feedbackwell starter'),`Templates did not load: ${templatesBody.slice(0,500)}`);await screenshot('templates-desktop.png');console.log('PASS redesigned templates rendering');
  await send('Page.navigate',{url:`${origin}/dashboard`});await waitFor(async()=>(await body()).includes('1/3 complete'),'dashboard return');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await waitFor(async()=>await evaluate('window.innerWidth===390'),'mobile viewport');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),'No page overflow');
  await screenshot('dashboard-mobile.png');console.log('PASS mobile dashboard has no page overflow');
  await send('Page.navigate',{url:`${origin}/portal/${portalToken}`});await waitFor(async()=>(await body()).includes('verify your email'),'portal verification screen');
  await click('Send verification code');await waitFor(async()=>(await body()).includes('Verification code'),'OTP input');
  await fill('#verification-code','123456');await delay(100);await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(async()=>(await body()).includes('Hello, Jordan'),'verified portal');assert.ok(!(await body()).includes('STAFF_ONLY_FIXTURE'));
  await screenshot('portal-mobile.png');console.log('PASS borrower OTP flow and internal-note separation');
  await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Upload files for Government-issued ID"]');const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.7 demo'], 'identity.pdf', {type:'application/pdf'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(async()=>(await body()).includes('uploaded and checked'),'upload confirmation');console.log('PASS borrower upload and checklist refresh');
  await fill('input[aria-label="Message your lender"]','Please confirm my documents.');await delay(100);await evaluate('document.querySelector("form").requestSubmit()');await waitFor(async()=>(await body()).includes('Please confirm my documents.'),'borrower message');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`${origin}/requests/request-a`});await waitFor(async()=>(await body()).includes('Messages & notes'),'lender request');assert.ok((await body()).includes('STAFF_ONLY_FIXTURE'));assert.ok((await body()).includes('identity.pdf'));await screenshot('request-desktop.png');console.log('PASS lender document and message view');
  await send('Page.navigate',{url:`${origin}/customers`});await waitFor(async()=>(await body()).includes('Add Customer'),'customers');await click('Add Customer');await waitFor(async()=>await evaluate("Boolean(document.querySelector('[role=dialog]'))"),'customer dialog');assert.ok(await evaluate("(()=>{const r=document.querySelector('[role=dialog] > div').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()"),'Customer dialog fits viewport');await screenshot('customer-modal-desktop.png');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);assert.ok(await evaluate("(()=>{const r=document.querySelector('[role=dialog] > div').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()"),'Customer dialog fits mobile viewport');await screenshot('customer-modal-mobile.png');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});console.log('PASS customer modal fits desktop and mobile viewports');
  for(const [route,title] of [['applications','Applications'],['settings','Organization settings'],['audit','Audit history']]){await send('Page.navigate',{url:`${origin}/${route}`});await waitFor(async()=>{const value=await body();return value.includes(title) && await evaluate(`location.pathname === '/${route}' && document.querySelector('h1')?.textContent === ${JSON.stringify(title)}`);},route);assert.ok(!(await body()).includes('This page could not be found'),route);}
  assert.deepEqual(failures,[]);console.log('PASS all UI smoke checks (synthetic API fixtures; no real email or customer data)');
  await send('Browser.close');
} finally { if(socket?.readyState===WebSocket.OPEN) socket.close(); browser.kill(); }
