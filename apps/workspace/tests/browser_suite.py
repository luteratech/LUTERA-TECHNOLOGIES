"""Owner, accounting and signing UI fixtures; never writes company records or sends mail."""
import os,json,re,shutil,copy,base64,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
v=dict(l.split('=',1) for l in (root/'.env.local').read_text().splitlines() if l and not l.startswith('#'))
origin=os.environ.get('LUTERA_TEST_URL',v['WORKSPACE_ORIGIN']);entry=v['WORKSPACE_ENTRY'];out=root/'test-results';out.mkdir(exist_ok=True)
uid='daae4165-3435-47ea-b5f1-f5df516e9c6b';fid='cf4464da-bb13-42d0-89a1-92a34cfbdc64';did='d0a364ef-8af2-4441-a711-d138f6f406cb'
setup={'tax':{'status':'pending','tax_id':'','registration_number':'','vat_status':'unconfirmed','effective_from':'','reference':'','notes':''},'accounting':{'enabled':False,'cutover':'2026-10-15','opening_reviewed':True,'year_end':'12-31','opening_position':{'currency':'NGN','total_minor':0,'no_receivables':True,'no_payables':True,'no_deposits':True,'no_loans':True,'no_stock':True,'no_fixed_assets':True}},'solo_owner':True}
cfg={'owner':True,'read':True,'write':True,'post':True,'close':True,'sign':True,'setup':{'payload':setup,'version':1},'accounting_enabled':False,'tax_status':'pending','closed_through':None,'profile':None,'factors':[{'id':fid,'name':'Fixture authenticator'}],'members':[{'email':'owner@example.invalid','role':'owner','active':True},{'email':'staff@example.invalid','role':'staff','active':True}],'responsibilities':[]}
accounts=[{'code':'1000','name':'Bank','category':'asset','cash_account':True},{'code':'3000','name':'Owner capital','category':'equity','cash_account':False}]
settings={'company':{'name':'Lutera Technology Ltd','address':'Abuja','email':'info@luteratech.com','phone':'+2349026276130','website':'https://luteratech.com'},'currency':'NGN','bank_name':'','account_name':'','account_number':'','tax_id':'','document_notes':''}
state={'documents':[],'staff':[],'audit':[],'members':cfg['members'],'content':None,'settings':{'payload':settings,'version':1},'publications':[],'publishing_connected':False}
business={'owner':True,'me':uid,'people':[],'access':{a:{'read':True,'write':True,'approve':True} for a in ['sales','finance','procurement','inventory','projects','support','reports']}}
journals=[];signatures=[];calls=[];sign_attempts=0;errors=[]
doc={'id':did,'number':'LUT-QUO-FIXTURE','status':'issued','kind':'quotation','version':2,'total_minor':10000,'created_at':'2026-11-01','payload':{'currency':'NGN','customer':{'name':'Synthetic customer'},'items':[{'description':'Synthetic equipment','quantity':1,'unit_minor':10000}],'notes':'Review before signing'}}
def fixture(route):
 global sign_attempts
 path=route.request.url.split('/api/',1)[1];action=path.split('?')[0];body=route.request.post_data_json if route.request.method=='POST' else {};calls.append(action)
 def reply(value,status=200,headers=None):return route.fulfill(status=status,content_type='application/json',headers=headers or {},body=json.dumps(value))
 if action=='session':return reply({'email':'owner@example.invalid','role':'owner','verified':True,'factors':cfg['factors']})
 if action=='state':return reply(state)
 if action=='business/config':return reply(business)
 if action=='business/dashboard':return reply({'enquiries':0,'open_projects':0,'overdue_tasks':0,'finance':[]})
 if action=='business/list':return reply({'rows':[],'more':False})
 if action=='suite/config':return reply(cfg)
 if action=='members/save':
  assert set(body['roles'])=={'editor','finance'} and body['active']
  member=next(m for m in state['members'] if m['email']==body['email']);member.update({'role':'finance','roles':body['roles']});return reply({'success':True})
 if action=='suite/setup':
  assert body['version']==cfg['setup']['version'];cfg['setup']={'payload':body['data'],'version':body['version']+1};cfg['accounting_enabled']=body['data']['accounting']['enabled'];return reply(cfg['setup'])
 if action=='suite/accounts':return reply(accounts)
 if action=='suite/journals':return reply({'rows':journals,'more':False})
 if action=='suite/journal-save':
  assert body['request_key'];j={'id':str(uuid.uuid4()),'reference':'LUT-JRN-FIXTURE','status':'draft','version':1,**body['data']};journals.append(j);return reply(j)
 if action=='suite/journal-update':journals[0].update(body['data']);journals[0]['version']+=1;return reply(journals[0])
 if action=='suite/journal-post':
  j=journals[0]
  if sum(l['debit_minor'] for l in j['lines'])!=sum(l['credit_minor'] for l in j['lines']):return reply({'error':'Journal debits and credits must balance.'},400)
  assert cfg['accounting_enabled'];j['status']='posted';j['version']+=1;return reply(j)
 if action=='suite/reports':return reply({'balances':[{'code':'1000','name':'Bank','category':'asset','cash_account':True,'currency':'NGN','balance_minor':10000},{'code':'3000','name':'Owner capital','category':'equity','cash_account':False,'currency':'NGN','balance_minor':-10000}],'activity':[]})
 if action=='suite/close':assert body['reconciled'];cfg['closed_through']=body['through'];return reply({'success':True})
 if action=='suite/reopen':cfg['closed_through']=None;return reply({'success':True})
 if action=='suite/signature-profile':assert body['image_data'].startswith('data:image/png');cfg['profile']=body;return reply({'success':True})
 if action=='suite/documents':return reply({'rows':[doc],'more':False})
 if action=='suite/document-preview':return reply({**doc,'_approval_hash':'a'*64})
 if action=='suite/signatures':return reply(signatures)
 if action=='suite/sign':
  sign_attempts+=1
  if sign_attempts==1:return reply({'error':'Too many attempts. Please wait before retrying.'},429,{'Retry-After':'2'})
  assert body['source_id']==did and body['source_version']==2 and body['expected_hash']=='a'*64 and body['factorId']==fid and body['code']=='123456'
  signatures.append({'id':str(uuid.uuid4()),**cfg['profile'],'source_version':2,'source_hash':'a'*64,'approval_reason':body['reason'],'created_at':'2026-11-01T10:00:00Z','self_approved':True});return reply({'success':True})
 if action=='suite/responsibilities':assert body['email']=='staff@example.invalid' and body['ledger_post'];cfg['responsibilities']=[body];return reply({'success':True})
 return reply({'error':'Unexpected fixture endpoint: '+action},400)
def go(page,department,tool):
 page.locator('.workspace').wait_for();sidebar=page.locator('#workspace-navigation')
 if not sidebar.is_visible():page.get_by_role('button',name='Open workspace menu',exact=True).click()
 sidebar.get_by_role('button',name=department,exact=True).click()
 if not sidebar.is_visible():page.get_by_role('button',name='Open workspace menu',exact=True).click()
 sidebar.get_by_role('button',name=tool,exact=True).click()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox']);c=b.new_context(viewport={'width':1280,'height':1000});page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 for path in ['/api/suite/config','/api/suite/accounts','/api/suite/journals']:
  assert c.request.get(origin+path).status==401,path
 assert c.request.post(origin+'/api/suite/setup',data={},headers={'Origin':'https://evil.example'}).status==403
 c.route('**/api/**',fixture);page.goto(origin+'/'+entry)
 go(page,'Administration','Owner tax & accounting setup')
 page.get_by_role('button',name='Save owner settings',exact=True).wait_for()
 assert page.locator('#workspace-navigation').evaluate("el=>getComputedStyle(el).backgroundColor")=='rgb(46, 91, 255)'
 assert page.locator('#workspace-main input[type=checkbox]').count()==3
 expect(page.get_by_label('Financial year-end (MM-DD)',exact=True)).to_have_value('12-31')
 page.get_by_text('Confirmed opening position',exact=True).wait_for()
 page.get_by_text('First accounting period:',exact=False).wait_for()
 assert '15 October 2026' in page.get_by_text('First accounting period:',exact=False).inner_text()
 assert '31 December 2026' in page.get_by_text('First accounting period:',exact=False).inner_text()
 assert page.get_by_label('Accounting start date',exact=True).evaluate('el=>getComputedStyle(el).fontSize')=='16px'
 assert page.locator('.field > span').first.evaluate('el=>getComputedStyle(el).fontSize')=='14px'
 for viewport in [1280,768,390]:
  page.set_viewport_size({'width':viewport,'height':1000})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),viewport
  for checkbox in page.locator('#workspace-main input[type=checkbox]').all():
   bounds=checkbox.bounding_box();assert bounds and bounds['width']<=22 and bounds['height']<=22
  page.screenshot(path=str(out/f'owner-brand-setup-{viewport}.png'),full_page=True)
 page.set_viewport_size({'width':1280,'height':1000})
 page.get_by_role('button',name='Save owner settings',exact=True).click();page.get_by_text('Owner settings saved.',exact=False).wait_for()
 assert cfg['setup']['payload']['tax']==setup['tax'] and not cfg['accounting_enabled']
 page.get_by_label('Accounting start date',exact=True).fill('2026-11-01')
 page.get_by_label('Opening balances reviewed',exact=True).check();page.get_by_label('Enable ledger posting',exact=True).check()
 page.get_by_role('button',name='Save owner settings',exact=True).click();expect(page.get_by_role('button',name='Save owner settings',exact=True)).to_be_enabled()
 go(page,'Finance','Accounting books');page.get_by_role('button',name='Prepare a journal',exact=True).click()
 page.get_by_label('Journal description',exact=True).fill('Synthetic opening capital')
 page.get_by_label('Debit for line 1',exact=True).fill('100');page.get_by_label('Credit for line 2',exact=True).fill('90')
 page.get_by_role('button',name='Save journal draft',exact=True).click();page.get_by_text('Accounting record saved.',exact=True).wait_for()
 page.locator('summary').filter(has_text='LUT-JRN-FIXTURE').click();page.get_by_role('button',name='Post balanced journal',exact=True).click();page.get_by_role('alert').get_by_text('Journal debits and credits must balance.',exact=True).wait_for()
 page.get_by_role('button',name='Edit draft',exact=True).click();page.get_by_label('Credit for line 2',exact=True).fill('100');page.get_by_role('button',name='Save journal draft',exact=True).click();page.locator('summary').filter(has_text='LUT-JRN-FIXTURE').click();page.get_by_role('button',name='Post balanced journal',exact=True).click()
 expect(page.locator('summary').filter(has_text='LUT-JRN-FIXTURE')).to_contain_text('posted')
 page.get_by_role('button',name='Create reversing entry',exact=True).click()
 prompt=page.get_by_role('dialog',name='Create a correcting reversal?',exact=True)
 prompt.get_by_label('Reason',exact=True).fill('xx')
 prompt.get_by_role('button',name='Create reversal',exact=True).click()
 prompt.get_by_role('alert').get_by_text('Enter at least 5 characters for the reason.',exact=True).wait_for()
 prompt.press('Escape')
 expect(page.get_by_role('button',name='Create reversing entry',exact=True)).to_be_focused()
 page.locator('#workspace-main').get_by_role('button',name='Financial reports',exact=True).click();page.get_by_role('heading',name='Trial balance',exact=True).wait_for()
 page.get_by_role('button',name='Period closing',exact=True).click();page.get_by_label('Closing or reopening reason',exact=True).fill('Synthetic reconciliation complete');page.get_by_label('I reconciled the bank accounts, balances and underlying records',exact=True).check();page.get_by_role('button',name='Close period',exact=True).click();page.get_by_text('The period is closed.',exact=True).wait_for()
 go(page,'Administration','My signing profile');page.get_by_label('Signatory full name',exact=True).fill('Fixture Owner');page.get_by_label('Signing capacity or job title',exact=True).fill('Owner')
 png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVxkAAAAASUVORK5CYII=')
 page.get_by_label('Upload your signature',exact=False).set_input_files({'name':'signature.png','mimeType':'image/png','buffer':png});page.get_by_role('button',name='Save personal signature',exact=True).click();page.get_by_text('Your signature profile has been saved.',exact=True).wait_for()
 go(page,'Finance','Document signatures');
 try:page.get_by_label('Approved document type',exact=True).select_option('work_documents',timeout=8000)
 except Exception:
  print('Current section:',page.evaluate("location.search"));print('Main:',page.locator('main').inner_text());print('Errors:',errors);print('Calls:',calls[-18:]);raise
 page.get_by_label('Select an issued or approved document',exact=True).select_option(did)
 page.get_by_role('heading',name='Review the exact document',exact=True).wait_for();page.get_by_role('cell',name='Synthetic equipment',exact=True).wait_for()
 page.get_by_label('Approval reason',exact=True).fill('I reviewed this exact synthetic revision')
 page.get_by_label('Fresh six-digit authenticator code',exact=True).fill('123456');page.get_by_label('I reviewed this exact document and authorise applying my signature',exact=True).check();page.get_by_role('button',name='Approve and apply my signature',exact=True).click()
 expect(page.get_by_role('button',name=re.compile('Try again in'))).to_be_disabled()
 page.get_by_role('button',name='Approve and apply my signature',exact=True).wait_for();page.get_by_label('Fresh six-digit authenticator code',exact=True).fill('123456');page.get_by_role('button',name='Approve and apply my signature',exact=True).click();page.get_by_text('Your signature is recorded on this document version.',exact=True).wait_for()
 assert signatures[0]['full_name']=='Fixture Owner'
 axe=(root/'node_modules/axe-core/axe.min.js').read_text()
 for width in [320,390,768,1024,1280]:
  page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.add_script_tag(content=axe);report=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
  assert not report['violations'],[(x['id'],x['help'],[(n['target'],n['failureSummary']) for n in x['nodes']]) for x in report['violations']]
  page.screenshot(path=str(out/f'owner-signing-{width}.png'),full_page=True)
 page.set_viewport_size({'width':1280,'height':1000});go(page,'Administration','Business permissions')
 page.get_by_text('Signing, posting & period closing authority',exact=True).click();page.get_by_label('Approved colleague',exact=True).select_option('staff@example.invalid');page.get_by_label('Job title or responsibility label',exact=True).fill('Accountant');page.get_by_role('button',name=re.compile('^Approval authorities')).click();page.get_by_role('dialog').get_by_label('May post balanced accounting journals',exact=True).check();page.get_by_role('dialog').get_by_label('May sign authorised documents with their own signature',exact=True).check();page.get_by_role('dialog').get_by_role('button',name='Done',exact=True).click();page.get_by_role('button',name='Save responsibilities',exact=True).click();page.get_by_text('Responsibilities and authority saved.',exact=True).wait_for()
 assert cfg['responsibilities'][0]['ledger_post'] and cfg['responsibilities'][0]['sign_documents']
 go(page,'Administration','User access')
 page.get_by_label('Email',exact=True).fill('staff@example.invalid')
 picker=page.get_by_role('button',name=re.compile('^Workspace roles'))
 picker.click();panel=page.get_by_role('dialog')
 panel.get_by_role('checkbox',name=re.compile('^Website administrator')).check();panel.get_by_role('checkbox',name='Accountant / finance',exact=False).check();panel.get_by_role('button',name='Done',exact=True).click()
 page.get_by_role('button',name='Remove Staff',exact=True).click()
 page.get_by_role('button',name='Save account access',exact=True).click();page.get_by_text('Workspace roles saved.',exact=False).wait_for()
 row=page.locator('.record-row').filter(has_text='staff@example.invalid');expect(row).to_contain_text('Website administrator');expect(row).to_contain_text('Accountant / finance')
 row.get_by_role('button',name='Edit roles',exact=True).click();picker=page.get_by_role('button',name=re.compile('^Workspace roles'));picker.focus();picker.press('ArrowDown');search=page.get_by_label('Search workspace roles',exact=True);expect(search).to_be_focused();search.fill('designer');expect(page.get_by_role('dialog').get_by_role('checkbox')).to_have_count(1);search.press('Escape');expect(picker).to_be_focused()
 picker.click()
 for viewport in [390,768,1280]:
  page.set_viewport_size({'width':viewport,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),viewport
  page.add_script_tag(content=axe);report=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
  assert not report['violations'],[(x['id'],[(n['target'],n['failureSummary']) for n in x['nodes']]) for x in report['violations']]
  page.screenshot(path=str(out/f'role-picker-{viewport}.png'),full_page=True)
 page.get_by_role('dialog').get_by_role('button',name='Done',exact=True).click()
 assert not errors,errors;b.close()
print('PASS: deferred tax setup, protected owner settings, accounting activation, journal correction/posting, reports/closing, personal signature, exact-document preview, signing consent/MFA cooldown, colleague responsibilities, 320–1280 layouts and axe. All writes used isolated UI fixtures.')
