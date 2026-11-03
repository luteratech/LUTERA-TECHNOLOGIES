"""Correction regression tests use synthetic records, never company writes or emails."""
import asyncio, json, os, shutil, re
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.async_api import async_playwright, expect
root=Path(__file__).resolve().parents[1]
v=dict(l.split('=',1) for l in (root/'.env.local').read_text().splitlines() if l and not l.startswith('#'))
origin=os.environ.get('LUTERA_TEST_URL',v['WORKSPACE_ORIGIN']);entry=v['WORKSPACE_ENTRY']
out=root/'test-results';out.mkdir(exist_ok=True)
uid='daae4165-3435-47ea-b5f1-f5df516e9c6b';rid='8fe434ad-6b01-4960-abba-b2cdf7edb8f9'
access={a:{'read':True,'write':True,'approve':True} for a in ['sales','finance','procurement','inventory','projects','support','reports']}
config={'owner':True,'legacy_documents':True,'me':uid,'people':[{'id':uid,'name':'Fixture owner'}],'access':access}
site=json.loads((root/'../../content/site.json').resolve().read_text())
settings={'company':{'name':'Lutera Technology Ltd','address':'Abuja','email':'info@luteratech.com','phone':'+2349026276130','website':'https://luteratech.com'},'currency':'NGN','bank_name':'','account_name':'','account_number':'','tax_id':'','document_notes':''}
state={'documents':[],'staff':[],'audit':[],'members':[{'email':'owner@example.invalid','role':'owner','roles':['owner'],'active':True}],'content':{'content':site,'version':1},'settings':{'payload':settings,'version':1},'publications':[],'publishing_connected':True}
rows={'commercial':[{'id':rid,'number':'LUT-INV-ZERO','total_minor':0,'currency':'NGN','kind':'invoice','status':'draft','document_date':'2026-11-03'}], 'customers':[{'id':rid,'name':'A long customer organisation name for responsive review','email':'fixture@example.invalid','version':1}], 'items':[{'id':rid,'name':'Business laptop','sku':'LAP-01','kind':'equipment','version':1}], 'tasks':[{'id':rid,'title':'Install and hand over the customer network','assigned_to':uid,'status':'doing','due_on':'2026-11-04','version':1}], 'payments':[{'id':rid,'reference':'PAY-FIXTURE','amount_minor':10000,'currency':'NGN','status':'confirmed'}]}
errors=[];unexpected=[];writes=[]
async def fixture(route):
 action=route.request.url.split('/api/',1)[1].split('?')[0];params=parse_qs(urlsplit(route.request.url).query)
 body=route.request.post_data_json if route.request.method=='POST' else {}
 async def reply(data,status=200):await route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
 if action=='session':return await reply({'email':'owner@example.invalid','role':'owner','roles':['owner'],'verified':True,'factors':[]})
 if action=='state':return await reply(state)
 if action=='business/config':return await reply(config)
 if action=='business/list':return await reply({'rows':rows.get(body['entity'],[]),'more':False})
 if action=='business/references':return await reply({'references':{r['key']:{'entity':r['entity'],'id':r['id'],'label':'Fixture owner' if r['entity']=='person' else 'Linked customer'} for r in json.loads(params.get('values',['[]'])[0])}})
 if action=='business/detail':return await reply({'record':next((r for r in rows.get(params['entity'][0],[]) if r['id']==params['id'][0]),{}),'lines':[]})
 if action=='business/related':return await reply([])
 if action=='business/payment-overview':return await reply({'allocated':2500,'refunded':1000,'available':6500,'invoices':[{'id':rid,'invoice_id':rid,'number':'LUT-INV-FIXTURE','amount_minor':2500}]})
 if action=='business/inventory-overview':return await reply({'balances':[{'location':'Abuja office','on_hand':10,'reserved':3,'quarantined':5,'available':2}],'movements':[],'assets':[]})
 if action=='business/stock-balances':return await reply([{'item_id':rid,'item_name':'Business laptop','sku':'LAP-01','location':'Abuja office','on_hand':10,'reserved':3,'quarantined':5,'available':2}])
 if action=='business/bank-import':
  assert body['confirm'] is False,'This test must not import bank records'
  return await reply({'rows':[{'posted_on':'2026-11-03','amount_minor':125050,'currency':'NGN','reference':'BANK-FIXTURE','duplicate':True}]})
 if action=='operations/reports':
  cutoff=params.get('cutoff',[''])[0]
  if cutoff=='2026-10-30':await asyncio.sleep(.75)
  return await reply({key:([{'number':'REPORT-'+cutoff,'customer':'Synthetic customer','currency':'NGN','outstanding_minor':100}] if key=='receivables' else []) for key in ['receivables','payables','spending','cost_centers','projects','commitments','orders']})
 if action=='suite/config':return await reply({'owner':True,'members':state['members'],'responsibilities':[]})
 if action=='business/audit':return await reply({'rows':[],'actors':[],'more':False})
 if route.request.method=='POST':writes.append(action)
 unexpected.append(action);return await reply({'error':'Unmodelled fixture endpoint'},503)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
  context=await browser.new_context(viewport={'width':1440,'height':1000})
  # The new endpoints must require real authentication before interception is installed.
  for endpoint in ['references','payment-overview?id='+rid,'bank-candidates?id='+rid,'inventory-overview?id='+rid]:
   response=await context.request.get(origin+'/api/business/'+endpoint);assert response.status==401,(endpoint,response.status)
  await context.route('**/api/**',fixture)
  page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  async def go(query):await page.goto(origin+'/'+entry+'?'+query,wait_until='networkidle')
  await go('section=operations&module=commercial&kind=invoice')
  row=page.get_by_role('row').filter(has_text='LUT-INV-ZERO');await expect(row).to_contain_text('0.00');assert '2026-11-03' not in await row.inner_text()
  await page.get_by_role('button',name='Create an invoice',exact=True).click()
  tax=page.get_by_label('Tax percentage',exact=True);await tax.fill('7.5');assert await tax.evaluate('(e)=>e.validity.valid')
  await page.get_by_label(re.compile('^Unit price')).fill('1.234');await page.get_by_label('Item 1 description',exact=False).fill('Equipment description stays available while a decimal is corrected')
  assert not errors,errors
  # The in-app guard retains a dirty document when navigation is cancelled.
  await page.get_by_role('button',name='Back to list',exact=True).click()
  await page.get_by_role('dialog').get_by_role('button',name='Keep editing',exact=True).click();assert await tax.input_value()=='7.5'
  await page.get_by_role('button',name='Back to list',exact=True).click();await page.get_by_role('dialog').get_by_role('button',name='Discard changes',exact=True).click()
  await go('section=operations&module=customers')
  axe=(root/'node_modules/axe-core/axe.min.js').read_text()
  for width in [320,390,640,768,1024,1440]:
   await page.set_viewport_size({'width':width,'height':1000})
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   assert (await page.locator('#workspace-main .toolbar').first.bounding_box())['height'] < 200, 'Toolbar must remain compact in column layouts'
   if width<=900:
    table=await page.locator('.business-records-table').bounding_box();container=await page.locator('.business-records-table').locator('..').bounding_box();assert table['width']<=container['width']+1, 'Compact record cards must fit their container'
   if width in [390,768,1440]:
    await page.add_script_tag(content=axe)
    violations=(await page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})"))['violations'];assert not violations,[(v['id'],v['help']) for v in violations]
    await page.screenshot(path=str(out/f'corrections-customers-{width}.png'),full_page=True)
  await page.set_viewport_size({'width':1440,'height':1000})
  await go('section=operations&module=bank_lines');await page.get_by_text('Import bank statement CSV',exact=True).click()
  await page.get_by_label('CSV contents',exact=True).fill('date,amount,currency,reference\n2026-11-03,1250.50,NGN,BANK-FIXTURE')
  await page.get_by_role('button',name='Validate and preview',exact=True).click();await expect(page.get_by_role('table')).to_contain_text('Already imported');await expect(page.get_by_role('table')).to_contain_text('BANK-FIXTURE')
  await go('section=operations&module=payments&record='+rid)
  await expect(page.get_by_role('region',name='Payment allocation overview')).to_contain_text('65.00');await expect(page.get_by_role('link',name='LUT-INV-FIXTURE',exact=True)).to_be_visible()
  await go('section=operations&module=items&record='+rid)
  stock=page.get_by_role('region',name='Item stock by location');await expect(stock).to_contain_text('Abuja office');assert await stock.locator('tbody tr td').all_text_contents()==['Abuja office','10','3','5','2']
  await go('section=operations&module=tasks');await page.get_by_role('button',name='Board',exact=True).click();await expect(page.get_by_role('region',name='Work board')).to_contain_text('Install and hand over');await page.get_by_role('button',name='Calendar',exact=True).click();await expect(page.get_by_role('region',name='Work calendar')).to_contain_text('4 Nov 2026')
  await go('section=reports')
  cutoff=page.get_by_label('Report cutoff date (Abuja time)',exact=True);await cutoff.fill('2026-10-30');await page.wait_for_timeout(100);await cutoff.fill('2026-10-31');await expect(page.get_by_text('REPORT-2026-10-31',exact=True)).to_be_visible();await page.wait_for_timeout(900);assert await page.get_by_text('REPORT-2026-10-30',exact=True).count()==0
  await expect(page.get_by_role('heading',name='Cost centres',exact=True)).to_be_visible()
  assert not unexpected,unexpected;assert not errors,errors;assert not writes,writes
  await browser.close()
 print('PASS correction regressions: new endpoint auth denial, zero money, fractional tax, decimal editing, in-app draft guard, 320–1440 layouts/axe, bank preview, payment balances, stock holds, task board/calendar and delayed report responses. No company writes.')
asyncio.run(main())
