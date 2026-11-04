"""Administration journeys with synthetic data only; no real backups, messages or settings writes."""
import json, os, re, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
v=dict(l.split('=',1) for l in (root/'.env.local').read_text().splitlines() if l and not l.startswith('#'))
origin=os.environ.get('LUTERA_TEST_URL',v['WORKSPACE_ORIGIN']); entry=v['WORKSPACE_ENTRY']
out=root/'test-results';out.mkdir(exist_ok=True)
access={a:{'read':True,'write':True,'approve':True} for a in ['sales','finance','procurement','inventory','projects','support','reports']}
automation={k:False for k in ['invoice_reminders','maintenance_reminders','enquiry_reminders','warranty_reminders','visit_reminders','delivery_notices']};automation.update({'id':1,'version':1,'interval_days':7})
calendar={'version':1,'days':[1,2,3,4,5],'start_minute':540,'end_minute':1020,'holidays':[]}
policy={'id':1,'version':1,'notes':''}
run={'id':'00000000-0000-4000-8000-000000000001','status':'primary','created_at':'2026-11-03T09:30:00Z','updated_at':'2026-11-03T09:31:00Z','bytes':28326,'file_count':0,'drive_verified':False,'last_error':''}
older={**run,'id':'00000000-0000-4000-8000-000000000002','status':'complete','created_at':'2026-11-02T09:30:00Z','drive_verified':True}
health={'encrypted_primary_backup':True,'automatic_primary_backup_configured':True,'next_scheduled_primary_backup':'9 Nov 2026, 08:00','public_site_publishing':True,'business_email':True,'signed_delivery_events':True,'attachment_malware_scanner':False,'background_jobs':True,'failed_messages':0,'pending_messages':0,'unassigned_enquiries':2}
fail_health=False;fail_save=False;fail_scanner=False;errors=[];calls=[]
def fixture(route):
 global fail_health
 action=route.request.url.split('/api/',1)[1].split('?')[0];calls.append(action)
 body=route.request.post_data_json if route.request.method=='POST' else {}
 def reply(value,status=200):return route.fulfill(status=status,content_type='application/json',body=json.dumps(value))
 if action=='session':return reply({'email':'owner@example.invalid','role':'owner','verified':True,'factors':[]})
 if action=='state':return reply({'documents':[],'staff':[],'audit':[],'members':[],'content':None,'settings':{'payload':{'company':{'name':'Lutera Technology Ltd'},'currency':'NGN'},'version':1},'publications':[],'publishing_connected':True})
 if action=='business/config':return reply({'owner':True,'me':'daae4165-3435-47ea-b5f1-f5df516e9c6b','people':[],'access':access})
 if action=='business/health':
  if fail_health:return reply({'error':'Synthetic connection issue'},503)
  return reply({'automation':automation,'health':{**health,'latest_backup':run},'backup_runs':[run,older],'latest_primary':run if run['status'] in ['primary','complete'] else older,'latest_drive':run if run['drive_verified'] else older})
 if action=='business/scanner-check':
  assert body=={}
  if fail_scanner:return reply({'error':'The free scanning allowance is exhausted.'},429)
  return reply({'provider':'bouncer','allowance':{'used':13,'limit':500,'remaining':487,'tier':'free','resetsAt':'2026-12-01T00:00:00Z'}})
 if action=='business/delivery-calendar':return reply(calendar)
 if action=='business/automation':
  if fail_save:return reply({'error':'Synthetic settings error'},409)
  automation.update({**body,'version':automation['version']+1});return reply(automation)
 if action=='business/delivery-work':calendar.update({**body['data'],'version':calendar['version']+1});return reply(calendar)
 if action=='operations/list':return reply({'rows':[policy],'more':False})
 if action=='operations/command':policy.update({**body['data'],'version':policy['version']+1});return reply({'version':policy['version']})
 return reply({})
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox'])
 c=browser.new_context(viewport={'width':1440,'height':1000})
 assert c.request.post(origin+'/api/business/scanner-check',data={},headers={'Origin':origin}).status==401
 assert c.request.post(origin+'/api/business/scanner-check',data={},headers={'Origin':'https://evil.example'}).status==403
 c.route('**/api/**',fixture)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:errors.append('Native '+d.type))
 def open_section(section,heading):
  page.goto(origin+'/'+entry+'?section='+section);page.get_by_role('heading',name=heading,exact=True).wait_for()
 open_section('business-settings','Reminders & updates')
 expect(page.locator('.topbar').get_by_role('button',name=re.compile('^Notifications'))).to_have_count(1)
 expect(page.get_by_role('button',name='Create backup',exact=True)).to_have_count(0)
 expect(page.get_by_text('integer minor units',exact=False)).to_have_count(0)
 page.get_by_role('switch',name='Overdue invoices',exact=True).check()
 page.locator('#workspace-navigation').get_by_role('button',name='Integrations',exact=True).click()
 dialog=page.get_by_role('dialog');expect(dialog).to_be_visible();dialog.get_by_role('button',name='Keep editing',exact=True).click()
 expect(page.get_by_role('switch',name='Overdue invoices',exact=True)).to_be_checked()
 fail_save=True;page.get_by_role('button',name='Save reminder settings',exact=True).click()
 page.get_by_role('alert').get_by_text('Synthetic settings error',exact=True).wait_for();expect(page.get_by_role('switch',name='Overdue invoices',exact=True)).to_be_checked()
 fail_save=False;page.get_by_role('button',name='Save reminder settings',exact=True).click();page.get_by_text('Reminder settings saved.',exact=True).wait_for()
 page.get_by_label('Opening time',exact=True).fill('08:30');page.get_by_role('button',name='Save business calendar',exact=True).click();page.get_by_text('Business calendar saved.',exact=True).wait_for();assert calendar['start_minute']==510
 open_section('backup','Your backup status')
 summary=page.locator('.admin-backup-summary');expect(summary).to_contain_text('Copy pending');expect(summary).to_contain_text('Last verified:')
 expect(page.get_by_role('button',name='Download recovery key',exact=True)).not_to_be_visible()
 expect(page.get_by_role('button',name='Download Drive connection',exact=True)).not_to_be_visible()
 expect(page.get_by_text('Requires company Apps Script authorization',exact=False)).to_have_count(0)
 expect(page.get_by_text('"created_at"',exact=False)).to_have_count(0)
 run.update({'status':'complete','drive_verified':True});page.get_by_role('button',name='Check status',exact=True).click();expect(summary.locator('.badge',has_text='Verified')).to_have_count(2)
 run.update({'status':'failed','drive_verified':False,'last_error':'Synthetic backup failure'});page.get_by_role('button',name='Check status',exact=True).click();page.get_by_text('The latest backup failed',exact=True).wait_for();expect(summary.locator('.badge',has_text='Failed')).to_have_count(1);expect(summary).to_contain_text('Not copied')
 fail_health=True;page.get_by_role('button',name='Check status',exact=True).click();page.get_by_role('alert').get_by_text('Status could not be refreshed',exact=True).wait_for()
 fail_health=False;run.update({'status':'complete','drive_verified':True,'last_error':''});page.get_by_role('button',name='Try again',exact=True).click();expect(page.get_by_text('Status could not be refreshed',exact=True)).to_have_count(0)
 page.get_by_text('Manage Google Drive connection',exact=True).click();expect(page.get_by_role('button',name='Download Drive connection',exact=True)).to_be_visible()
 page.get_by_text('Recovery tools',exact=True).click();expect(page.get_by_role('button',name='Download recovery key',exact=True)).to_be_visible()
 page.get_by_text('Download a separate records export',exact=True).click();expect(page.get_by_label('Confirm backup password',exact=True)).to_be_visible()
 axe=(root/'node_modules/axe-core/axe.min.js').read_text()
 for section,heading in [('business-settings','Reminders & updates'),('backup','Your backup status'),('business-integrations','Connected services'),('business-policy','Retention & recovery targets')]:
  open_section(section,heading)
  if section=='business-integrations':page.get_by_text('Malware scanning is not active.',exact=False).wait_for()
  if section=='business-policy':page.get_by_label('Owner notes and responsibilities',exact=True).wait_for()
  for width in [320,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(60)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(section,width)
   page.add_script_tag(content=axe);report=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})")
   assert not report['violations'],(section,width,[(x['id'],[(n['target'],n['failureSummary']) for n in x['nodes']]) for x in report['violations']])
   if width in [390,1440]:page.screenshot(path=str(out/f'administration-{section}-{width}.png'),full_page=True)
 health.update({'attachment_malware_scanner':True,'attachment_scanner_provider':'bouncer'})
 open_section('business-integrations','Connected services');page.get_by_text('Bouncer attachment scanning',exact=True).click()
 page.get_by_role('button',name='Check Bouncer connection',exact=True).click();page.get_by_text('487 / 500',exact=True).wait_for()
 page.get_by_text('Bouncer connection verified.',exact=False).wait_for()
 for width in [320,768,1440]:
  page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.add_script_tag(content=axe);report=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})");assert not report['violations'],report['violations']
 fail_scanner=True;page.get_by_role('button',name='Check Bouncer connection',exact=True).click();page.get_by_role('alert').get_by_text('The free scanning allowance is exhausted.',exact=True).wait_for();expect(page.get_by_text('487 / 500',exact=True)).to_have_count(0)
 assert not errors,errors
 browser.close()
print('PASS: focused settings, unsaved edits, save errors, calendar writes, verified-versus-pending Drive receipts, failed backups, health retry, advanced tools, scanner warning, 320–1440px layouts and accessibility. Synthetic data only.')
