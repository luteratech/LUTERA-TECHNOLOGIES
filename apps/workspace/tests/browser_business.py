import os
"""Business UI fixtures + real API denial checks. No live business writes/mail."""
import base64,json,re,shutil,uuid
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
v=dict(l.split('=',1) for l in (root/'.env.local').read_text().splitlines() if l and not l.startswith('#'))
origin=os.environ.get('LUTERA_TEST_URL',v['WORKSPACE_ORIGIN']);entry=v['WORKSPACE_ENTRY'];out=root/'test-results';out.mkdir(exist_ok=True)
uid='daae4165-3435-47ea-b5f1-f5df516e9c6b';cid='8fe434ad-6b01-4960-abba-b2cdf7edb8f9'
customer={'id':cid,'name':'UI business fixture','email':'ui@example.invalid','phone':'','address':'','delivery_address':'','sector':'','tax_id':'','assigned_to':uid,'archived':False,'version':1}
rows={'customers':[customer],'payments':[]};ops_rows={};calls=[];errors=[]
settings={'company':{'name':'Lutera Technology Ltd','address':'Abuja, Nigeria','email':'chimaster010@gmail.com','phone':'+2349026276130','website':'https://luteratech.com'},'currency':'NGN','bank_name':'','account_name':'','account_number':'','tax_id':'','document_notes':''}
state={'documents':[],'staff':[],'audit':[],'members':[],'content':None,'settings':{'payload':settings,'version':1},'publications':[],'publishing_connected':False}
conf={'owner':True,'me':uid,'people':[{'id':uid,'name':'Fixture Owner'}],'access':{a:{'read':True,'write':True,'approve':True} for a in ['sales','finance','inventory','procurement','projects','support','reports']}}

def fixture(route):
 action=route.request.url.split('/api/',1)[1].split('?')[0]
 body=route.request.post_data_json if route.request.method=='POST' else {};calls.append(action)
 def reply(value,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(value))
 if action=='session':return reply({'email':'ui@example.invalid','role':'owner','verified':True,'factors':[]})
 if action=='state':return reply(state)
 if action=='business/config':return reply(conf)
 if action=='business/dashboard':return reply({'enquiries':0,'open_projects':0,'overdue_tasks':0,'finance':[]})
 if action=='business/list':return reply({'rows':rows.get(body['entity'],[]),'more':False})
 if action=='business/detail':
  params=parse_qs(urlparse(route.request.url).query)
  return reply({'record':next(r for r in rows.get(params['entity'][0],[]) if r['id']==params['id'][0])})
 if action=='business/save':
  assert body['request_key'];c={**body['data'],'id':cid,'version':body['version']+1};rows['customers']=[c];return reply(c)
 if action=='business/file':assert body['data'];return reply({'id':'c2fddfaa-ed8d-41df-a918-e0c698afdb1d'})
 if action=='business/payment':
  assert body['data']['confirmed'] is True and body['data']['evidence_id'];rows['payments']=[{'id':str(uuid.uuid4()),**body['data'],'status':'confirmed','version':1}];return reply(rows['payments'][0])
 if action=='operations/list':
  entity=parse_qs(urlparse(route.request.url).query).get('entity',[''])[0]
  return reply({'rows':[{'id':1,'version':1,'notes':''}] if entity=='operating_policy' else ops_rows.get(entity,[]),'more':False})
 if action=='operations/command':
  assert body['request_key']
  if body['action']=='location':
   r={'id':str(uuid.uuid4()),'version':1,**body['data']};ops_rows.setdefault('locations',[]).append(r);return reply(r)
  return reply({'success':True})
 if action=='operations/reports':return reply({key:[] for key in ['receivables','payables','spending','cost_centers','projects','commitments','orders']})
 if action=='business/delivery-calendar':return reply({'id':1,'version':1,'days':[1,2,3,4,5],'start_minute':540,'end_minute':1020,'holidays':[]})
 if action=='business/reports':return reply({'receivables':[],'payables':[],'spending':[],'orders':[]})
 if action=='business/health':return reply({'automation':{'id':1,'version':1,'interval_days':7,'invoice_reminders':False,'maintenance_reminders':False},'health':{'business_email':True,'latest_backup':'Not run yet'}})
 if action=='portal/session':return reply({'email':'ui@example.invalid','customers':[{'id':cid,'name':'UI business fixture'}],'documents':[],'work':[]})
 return reply({'error':'Fixture endpoint not implemented: '+action},400)

with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1280,'height':1000});page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 for path in ['/api/operations/list?entity=locations','/api/business/config','/api/business/health','/api/business/file?id='+cid,'/api/portal/session','/api/backups/drive','/api/jobs']:
  assert c.request.get(origin+path).status==401,path
 assert c.request.post(origin+'/api/business/payment',data={},headers={'Origin':'https://evil.example'}).status==403
 assert c.request.post(origin+'/api/portal/ticket',data={},headers={'Origin':'https://evil.example'}).status==400
 c.route('**/api/**',fixture)
 page.goto(origin+'/'+entry)
 page.get_by_role('button',name='Business operations',exact=True).click()

 try: page.get_by_role('combobox').first.wait_for(timeout=5000)
 except Exception:
  print('Fixture calls:',calls);print('Page errors:',errors);print(page.locator('main').inner_text());raise
 page.get_by_role('button',name='New record +',exact=True).click()
 page.get_by_label(re.compile('Customer / organization name',re.I)).fill('UI business fixture updated')
 page.get_by_role('button',name='Save record',exact=True).click()
 page.get_by_text('Saved successfully.',exact=True).wait_for()
 page.get_by_role('combobox').first.select_option(label='Customer payments')
 page.get_by_role('button',name='New record +',exact=True).click()
 page.get_by_role('combobox',name='Customer',exact=True).select_option(cid)
 page.get_by_label(re.compile('Amount received',re.I)).fill('1200.50')
 page.get_by_role('checkbox').check()
 page.get_by_role('button',name='Confirm payment and issue receipt',exact=True).click()
 assert 'business/payment' not in calls,'Payment submitted without evidence'
 png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVxkAAAAASUVORK5CYII=')
 page.get_by_label('Upload evidence file',exact=True).set_input_files({'name':'fixture.png','mimeType':'image/png','buffer':png})
 page.get_by_role('link',name='Download uploaded evidence').wait_for()
 axe=(root/'node_modules/axe-core/axe.min.js').read_text()
 for width in [390,768,1280]:
  page.set_viewport_size({'width':width,'height':1000})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.add_script_tag(content=axe)
  report=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
  assert not report['violations'],[(x['id'],x['help']) for x in report['violations']]
  page.screenshot(path=str(out/f'business-payment-{width}.png'),full_page=True)
 page.get_by_role('button',name='Confirm payment and issue receipt',exact=True).click()
 page.get_by_text('Payment recorded with evidence',exact=False).wait_for()
 assert rows['payments'][0]['amount_minor']==120050
 # Desktop/tablet sidebar can collapse, returns width to content and remembers the preference.
 for width in [768,1024,1280]:
  page.set_viewport_size({'width':width,'height':900})
  sidebar=page.locator('#workspace-navigation');assert sidebar.is_visible()
  before=page.locator('#workspace-main').bounding_box()['width']
  assert page.locator('header').get_by_role('button',name='Close workspace menu',exact=True).count()==0
  sidebar.get_by_role('button',name='Close workspace menu',exact=True).click();assert not sidebar.is_visible()
  assert page.locator('#workspace-main').bounding_box()['width']>before
  page.get_by_role('button',name='Open workspace menu',exact=True).click();assert sidebar.is_visible()
 # Mobile navigation is a keyboard-accessible dropdown, not a horizontal strip.
 page.set_viewport_size({'width':390,'height':844});assert not page.locator('#workspace-navigation').is_visible()
 page.get_by_role('button',name='Open workspace menu',exact=True).click()
 assert page.get_by_role('searchbox',name='Find a section').evaluate('(el)=>el===document.activeElement')
 page.locator('#workspace-navigation').get_by_role('button',name='Close workspace menu',exact=True).click()
 assert page.get_by_role('button',name='Open workspace menu',exact=True).evaluate('(el)=>el===document.activeElement')
 page.get_by_role('button',name='Open workspace menu',exact=True).click()
 page.get_by_role('button',name='Business operations',exact=True).click()
 assert page.locator('#workspace-main').evaluate('(el)=>el===document.activeElement')
 page.get_by_role('button',name='Open workspace menu',exact=True).click()
 page.get_by_role('searchbox',name='Find a section').fill('Operational controls')
 page.get_by_role('button',name='Operational controls',exact=True).click()
 assert not page.locator('#workspace-navigation').is_visible()
 page.get_by_role('heading',name='Operational controls',exact=True).wait_for()
 try: page.get_by_label('Operational area',exact=True).select_option('locations',timeout=10000)
 except Exception:
  print('Fixture calls:',calls);print('Page errors:',errors);print(page.locator('main').inner_text());raise
 page.get_by_role('button',name='New record +',exact=True).click()
 page.get_by_label(re.compile(r'^Location name')).fill('UI fixture warehouse')
 page.get_by_role('button',name='Confirm and save',exact=True).click()
 page.get_by_text('Recorded successfully.',exact=False).wait_for()
 assert len(ops_rows['locations'])==1
 page.get_by_role('button',name='Open workspace menu',exact=True).click()
 page.keyboard.press('Escape');assert not page.locator('#workspace-navigation').is_visible()
 assert page.get_by_role('button',name='Open workspace menu',exact=True).evaluate('(el)=>el===document.activeElement')
 for width in [320,390,600,768,1024,1280]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.add_script_tag(content=axe)
  check=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
  assert not check['violations'],[(x['id'],x['help']) for x in check['violations']]
  page.screenshot(path=str(out/f'workspace-controls-{width}.png'),full_page=True)
 page.set_viewport_size({'width':1280,'height':1000})
 page.get_by_role('button',name='Management reports',exact=True).click()
 page.get_by_role('heading',name='Order contribution estimates',exact=True).wait_for()
 page.get_by_role('button',name='Operations settings',exact=True).click()
 page.get_by_role('button',name='Save reminder settings',exact=True).wait_for()
 # New navigation history: module/list/record restoration, native browser controls,
 # cancelled unsaved navigation, branching, reload and blocked browser storage.
 nav=c.new_page();nav.set_viewport_size({'width':1280,'height':900})
 nav.goto(origin+'/'+entry+'?section=overview')
 nav.get_by_role('heading',name='Overview',exact=True).wait_for()
 assert nav.get_by_role('button',name='Go back',exact=True).is_disabled()
 assert nav.get_by_role('button',name='Go forward',exact=True).is_disabled()
 nav.get_by_role('button',name='Business operations',exact=True).click()
 nav.get_by_role('combobox').first.select_option(label='Customer payments')
 nav.wait_for_url('**module=payments*')
 nav.get_by_role('button',name='Go back',exact=True).click()
 nav.get_by_role('combobox').first.wait_for()
 nav.wait_for_function("new URLSearchParams(location.search).get('module')==='customers'")
 nav.get_by_role('button',name='Go forward',exact=True).click()
 nav.wait_for_function("new URLSearchParams(location.search).get('module')==='payments'")
 nav.go_back();nav.wait_for_function("new URLSearchParams(location.search).get('module')==='customers'")
 nav.get_by_role('button',name='Open',exact=True).first.click()
 nav.get_by_label(re.compile('Customer / organization name',re.I)).wait_for()
 nav.wait_for_function("id => new URLSearchParams(location.search).get('record')===id",arg=cid)
 nav.get_by_role('button',name='Go back',exact=True).click()
 nav.get_by_role('button',name='New record +',exact=True).wait_for()
 nav.go_forward()
 name=nav.get_by_label(re.compile('Customer / organization name',re.I));name.wait_for()
 name.fill('Unsaved navigation fixture')
 nav.once('dialog',lambda d:d.dismiss())
 nav.get_by_role('button',name='Go back',exact=True).click()
 nav.wait_for_function("id => new URLSearchParams(location.search).get('record')===id",arg=cid)
 assert name.input_value()=='Unsaved navigation fixture'
 nav.once('dialog',lambda d:d.accept())
 nav.get_by_role('button',name='Go back',exact=True).click()
 nav.get_by_role('button',name='New record +',exact=True).wait_for()
 nav.get_by_role('button',name='Operational controls',exact=True).click()
 nav.get_by_label('Operational area',exact=True).select_option('locations')
 nav.get_by_role('button',name='Go back',exact=True).click()
 nav.wait_for_function("new URLSearchParams(location.search).get('control')==='approval_rules'")
 nav.get_by_role('button',name='Go forward',exact=True).click()
 nav.wait_for_function("new URLSearchParams(location.search).get('control')==='locations'")
 nav.reload();nav.get_by_label('Operational area',exact=True).wait_for()
 assert nav.get_by_label('Operational area',exact=True).input_value()=='locations'
 nav.get_by_role('button',name='Go back',exact=True).click()
 nav.wait_for_function("new URLSearchParams(location.search).get('control')==='approval_rules'")
 nav.get_by_role('button',name='Management reports',exact=True).click()
 nav.get_by_role('heading',name='Order contribution estimates',exact=True).wait_for()
 assert nav.get_by_role('button',name='Go forward',exact=True).is_disabled()
 nav.close()
 limited=b.new_context(viewport={'width':1280,'height':900})
 limited.add_init_script("Object.defineProperty(window,'sessionStorage',{get(){throw Error('Storage disabled for test')}})")
 limited.route('**/api/**',fixture);n=limited.new_page();n.goto(origin+'/'+entry+'?section=overview')
 n.get_by_role('button',name='Operational controls',exact=True).click()
 n.get_by_label('Operational area',exact=True).select_option('locations')
 n.get_by_role('button',name='Go back',exact=True).click()
 n.wait_for_function("new URLSearchParams(location.search).get('control')==='approval_rules'")
 n.get_by_role('button',name='Go forward',exact=True).click()
 n.wait_for_function("new URLSearchParams(location.search).get('control')==='locations'")
 limited.close()
 page.goto(origin+'/portal');page.get_by_role('heading',name='UI business fixture',exact=True).wait_for()
 assert not errors,errors
 b.close()
print('PASS: business API denial, CRM form, evidence-required manual payment, reports/settings/portal fixtures, phone/tablet/desktop layouts, sidebar-local close/mobile dropdown, native and in-app Back/Forward, record restoration, unsaved guards, reload/branching/blocked storage, operational controls and axe. No real transactions or emails.')
