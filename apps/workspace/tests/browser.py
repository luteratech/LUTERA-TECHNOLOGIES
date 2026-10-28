import os
"""UI flow fixtures + real unauthenticated HTTP denials. Never send emails."""
import base64
import copy
import json
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
values=dict(line.split('=',1) for line in (root/'.env.local').read_text().splitlines() if line and not line.startswith('#'))
origin=os.environ.get('LUTERA_TEST_URL',values['WORKSPACE_ORIGIN'])
entry=values['WORKSPACE_ENTRY']
site=json.loads((root/'../../content/site.json').resolve().read_text())
settings={'company':{'name':'Lutera Technology Ltd','address':'No. 7, Mahatma Gandhi Street, Area 11, Garki, Abuja, FCT, Nigeria','email':'chimaster010@gmail.com','phone':'+234 902 6276 130','website':'https://luteratech.com'},'bank_name':'','account_name':'','account_number':'','tax_id':'','document_notes':'','currency':'NGN'}
state={'documents':[],'staff':[],'audit':[],'members':[{'email':'chimaster010@gmail.com','role':'owner','active':True}],'content':{'content':site,'version':1},'settings':{'payload':settings,'version':1},'publications':[],'publishing_connected':True}
session=None
calls=[]
errors=[]
resultdir=root/'test-results';resultdir.mkdir(exist_ok=True)
def payload(route):
 global session
 action=route.request.url.split('/api/',1)[1].split('?')[0]
 body=route.request.post_data_json if route.request.method=='POST' else {}
 calls.append(action)
 def respond(value,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(value))
 if action=='session':return respond(session,200) if session else respond({'error':'Sign in to continue'},401)
 if action=='auth/signin':session={'email':'chimaster010@gmail.com','role':'owner','verified':False,'factors':[]};return respond({'success':True})
 if action=='mfa/enroll':return respond({'id':'cf4464da-bb13-42d0-89a1-92a34cfbdc64','qr':'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>','secret':'UI-FIXTURE-NOT-A-REAL-KEY'})
 if action=='mfa/verify':session['verified']=True;return respond({'success':True})
 if action=='state':return respond(state)
 if action=='business/config':return respond({'owner':True,'me':'daae4165-3435-47ea-b5f1-f5df516e9c6b','people':[],'access':{a:{'read':True,'write':True,'approve':True} for a in ['sales','finance','inventory','procurement','projects','support','reports']}})
 if action=='business/dashboard':return respond({'enquiries':0,'open_projects':0,'overdue_tasks':0,'finance':[]})
 if action=='records':
  records=state['documents' if body['area']=='finance' else 'staff']
  if body.get('kind'):records=[r for r in records if r.get('kind')==body['kind']]
  return respond({'rows':records,'more':False})
 if action=='auth/signout':session=None;return respond({'success':True})
 if action=='documents/save':
  doc=body['payload'];subtotal=sum(i['quantity']*i['unit_minor'] for i in doc['items']);total=subtotal-doc['discount_minor']+((subtotal-doc['discount_minor'])*doc['tax_bps']+5000)//10000
  current={'id':body.get('id','d0a364ef-8af2-4441-a711-d138f6f406cb'),'number':None,'status':'draft','kind':doc['kind'],'payload':doc,'total_minor':total,'version':body.get('version',0)+1,'created_at':'2026-10-22T12:00:00Z','issued_at':None}
  state['documents']=[current];return respond(current)
 if action=='documents/status':
  current=state['documents'][0];current['status']='issued';current['number']='LUT-QUO-2026-000001';current['version']+=1;current['payload']['company']=settings;return respond(current)
 if action=='staff/save':
  current={'id':'5f2b953d-5a0c-41a3-959e-90da018b3c1f','payload':body['payload'],'version':1,'created_at':'2026-10-22T12:00:00Z'};state['staff']=[current];return respond(current)
 if action=='content/save':state['content']={'content':body['payload'],'version':state['content']['version']+1};return respond(state['content'])
 if action=='content/publish':state['publications']=[{'id':'9353a207-9b06-4acf-9638-72c46039a137','status':'building','created_at':'2026-10-22T12:00:00Z'}];return respond({'status':'building','revision':state['publications'][0]['id']})
 if action=='content/check-live':state['publications'][0]['status']='live';return respond({'live':True})
 if action=='export':return route.fulfill(status=200,content_type='application/pdf',headers={'Content-Disposition':'attachment; filename="fixture.pdf"'},body=(resultdir/'exports/quotation.pdf').read_bytes())
 return respond({'error':'Fixture endpoint not implemented: '+action},400)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page=context.new_page()
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'Content Security Policy' in m.text else None)
 # Real server checks, without authentication or dummy network stubs.
 assert context.request.get(origin+'/').status==404
 assert context.request.get(origin+'/admin').status==404
 assert context.request.get(origin+'/api/state').status==401
 assert context.request.post(origin+'/api/documents/save',data={},headers={'Origin':'https://evil.example','Content-Type':'application/json'}).status==403
 assert context.request.get(origin+'/robots.txt').text().find('Disallow: /')>=0
 response=page.goto(origin+'/'+entry);assert response.status==200
 assert 'noindex' in response.headers.get('x-robots-tag','')
 assert "frame-ancestors 'none'" in response.headers.get('content-security-policy','')
 assert 'no-store' in response.headers.get('cache-control','')
 page.get_by_role('heading',name='Welcome back.').wait_for()
 assert page.locator('input[name=password]').get_attribute('type')=='password'
 page.screenshot(path=str(resultdir/'login-desktop.png'),full_page=True)
 axe=(root/'node_modules/axe-core/axe.min.js').read_text()
 def accessibility(label):
  page.add_script_tag(content=axe)
  report=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
  (resultdir/f'axe-{label}.json').write_text(json.dumps(report,indent=2))
  assert not report['violations'],[(v['id'],v['help'],len(v['nodes'])) for v in report['violations']]
 accessibility('login')
 context.route('**/api/**',payload)
 page.get_by_label('Work email').fill('chimaster010@gmail.com')
 page.get_by_label('Password',exact=True).fill('UI-FIXTURE-ONLY-NOT-A-REAL-PASSWORD')
 page.get_by_role('button',name='Continue securely').click()
 page.get_by_role('button',name='Set up authenticator').click()
 page.get_by_label('Six-digit code').fill('123456')
 page.get_by_role('button',name='Verify and open workspace').click()
 page.get_by_role('heading',name='Dashboard',exact=True).wait_for()
 accessibility('overview')
 page.screenshot(path=str(resultdir/'overview-desktop.png'),full_page=True)
 page.locator('#workspace-navigation').get_by_role('button',name='Finance',exact=True).click()
 page.locator('#workspace-navigation').get_by_role('button',name='Document archive',exact=True).click()
 page.get_by_role('button',name='New document').click()
 page.get_by_label('Customer name').fill('UI Sample Customer')
 page.get_by_label('Document date').fill('2026-10-22')
 page.get_by_label('Item 1 description').fill('UI TEST ONLY — no order')
 page.get_by_label('Quantity').fill('3')
 page.get_by_label('Unit price').fill('100.01')
 page.get_by_label('Discount amount').fill('0.03')
 page.get_by_label('Tax rate').fill('7.50')
 page.get_by_role('button',name='Save draft',exact=True).click()
 page.get_by_role('heading',name='Saved draft',exact=True).wait_for()
 page.get_by_role('button',name='Review & issue').click()
 page.get_by_role('dialog').get_by_role('button',name='Confirm',exact=True).click()
 page.get_by_role('heading',name='LUT-QUO-2026-000001').wait_for()
 assert page.get_by_label('Customer name').is_disabled()
 with page.expect_download() as exported:page.get_by_role('button',name='PDF ↓',exact=True).click()
 assert exported.value.suggested_filename=='fixture.pdf'
 page.screenshot(path=str(resultdir/'document-desktop.png'),full_page=True)
 accessibility('document')
 # Standalone document tools must filter the shared archive and open the right new-document form.
 page.locator('#workspace-navigation').get_by_role('button',name='Sales & Customers',exact=True).click()
 page.locator('#workspace-navigation').get_by_role('button',name='Quotation documents',exact=True).click()
 page.get_by_text('LUT-QUO-2026-000001',exact=True).wait_for()
 page.locator('#workspace-navigation').get_by_role('button',name='Finance',exact=True).click()
 page.locator('#workspace-navigation').get_by_role('button',name='Pro forma invoices',exact=True).click()
 page.get_by_role('heading',name='Pro forma invoices',exact=True,level=1).wait_for()
 expect(page.get_by_text('LUT-QUO-2026-000001',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Prepare a pro forma',exact=True).click()
 page.get_by_label('Customer name').wait_for()
 assert 'documentKind=proforma' in page.url and 'document=new' in page.url
 page.locator('#workspace-navigation').get_by_role('button',name='Staff & Cards',exact=True).click()
 page.locator('#workspace-navigation').get_by_role('button',name='Staff profiles & cards',exact=True).click()
 page.get_by_role('button',name='Add staff profile').click()
 page.get_by_label(re.compile('^name',re.I)).fill('Sample Profile')
 page.get_by_label(re.compile('^title',re.I)).fill('UI review — sample only')
 page.get_by_label(re.compile('^staff number',re.I)).fill('SAMPLE-001')
 page.get_by_role('button',name='Save staff profile').click()
 page.get_by_role('heading',name='Sample Profile',level=2,exact=True).wait_for()
 page.get_by_label('Template').select_option('id')
 page.screenshot(path=str(resultdir/'staff-desktop.png'),full_page=True)
 accessibility('staff')
 page.locator('#workspace-navigation').get_by_role('button',name='Website cPanel',exact=True).click()
 page.locator('#workspace-navigation').get_by_role('button',name='Company & contact',exact=True).click()
 page.get_by_label('Registered company name',exact=True).fill('Lutera Technology Ltd')
 page.get_by_role('button',name='Save website draft').click()
 page.get_by_text('Website draft saved.',exact=False).wait_for()
 page.get_by_role('button',name='Publish website').click()
 page.get_by_role('dialog').get_by_role('button',name='Confirm',exact=True).click()
 page.get_by_text('Build requested.',exact=False).wait_for()
 page.get_by_role('button',name='Check live version').click()
 page.get_by_text('This version is live',exact=False).wait_for()
 for width in [390,768,1280]:
  page.set_viewport_size({'width':width,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.screenshot(path=str(resultdir/f'website-{width}.png'),full_page=True)
  accessibility('website-'+str(width))
 page.get_by_role('button',name='Sign out',exact=True).click()
 page.get_by_role('heading',name='Welcome back.').wait_for()
 assert not errors,errors
 browser.close()
print('PASS: real anonymous and CSRF denials; fixture-based login→MFA→quotation→issue→export, staff cards, website draft→publish→verify, responsive widths and axe accessibility. No real emails, accounts, payments or publishing.')
