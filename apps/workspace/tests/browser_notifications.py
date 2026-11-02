"""In-app feedback fixtures only. No real backup, email, account or payment."""
import os,json,re,shutil
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
v=dict(l.split('=',1) for l in (root/'.env.local').read_text().splitlines() if l and not l.startswith('#'))
origin=os.environ.get('LUTERA_TEST_URL',v['WORKSPACE_ORIGIN']);entry=v['WORKSPACE_ENTRY'];out=root/'test-results';out.mkdir(exist_ok=True)
settings={'company':{'name':'Lutera Technology Ltd','address':'Synthetic address','email':'info@example.invalid','phone':'+234000000000','website':'https://luteratech.com'},'currency':'NGN','bank_name':'','account_name':'','account_number':'','tax_id':'','document_notes':''}
state={'documents':[],'staff':[],'audit':[],'members':[{'email':'owner@example.invalid','role':'owner','active':True}],'content':None,'settings':{'payload':settings,'version':1},'publications':[],'publishing_connected':False}
automation={k:False for k in ['invoice_reminders','maintenance_reminders','enquiry_reminders','warranty_reminders','visit_reminders','delivery_notices']};automation.update({'id':1,'version':1,'interval_days':7})
pending=[];calls=[];errors=[];health_failure=False
access={a:{'read':True,'write':True,'approve':True}for a in ['sales','finance','procurement','inventory','projects','support','reports']}
def fixture(route):
 action=route.request.url.split('/api/',1)[1].split('?')[0];calls.append(action)
 def reply(value,status=200):return route.fulfill(status=status,content_type='application/json',body=json.dumps(value))
 if action=='session':return reply({'email':'owner@example.invalid','role':'owner','verified':True,'factors':[]})
 if action=='state':return reply(state)
 if action=='business/config':return reply({'owner':True,'me':'daae4165-3435-47ea-b5f1-f5df516e9c6b','people':[],'access':access})
 if action=='business/dashboard':return reply({'enquiries':0,'open_projects':0,'overdue_tasks':0,'finance':[]})
 if action=='business/health':return reply({'error':'Synthetic health refresh failed'},503) if health_failure else reply({'automation':automation,'health':{'encrypted_primary_backup':True,'backup_status':'primary; Drive pending'}})
 if action=='business/delivery-calendar':return reply({'id':1,'version':1,'days':[1,2,3,4,5],'start_minute':540,'end_minute':1020,'holidays':[]})
 if action=='operations/list':return reply({'rows':[{'id':1,'version':1,'notes':''}],'more':False})
 if action=='operations/config':return reply({'owner':True,'me':'daae4165-3435-47ea-b5f1-f5df516e9c6b','access':access,'people':[]})
 if action=='business/policy':return reply({'version':1,'payload':{'portal_upload_limit':5,'response_hours':24}})
 if action=='business/backup-run':pending.append(route);return
 if action=='auth/signout':return reply({'success':True})
 if action=='portal/session':return reply({'error':'Sign in to continue'},401)
 return reply({})
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium')or None,headless=True,args=['--no-sandbox'])
 c=browser.new_context(viewport={'width':1280,'height':900});page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:errors.append('Native dialog: '+d.type))
 c.route('**/api/**',fixture);page.goto(origin+'/'+entry+'?section=business-settings')
 page.get_by_role('heading',name='Business operations settings',exact=True).wait_for()
 page.get_by_text('Backup and accounting arrangements',exact=True).click()
 button=page.get_by_role('button',name='Run backup now',exact=True);button.click()
 region=page.get_by_role('region',name='Workspace notifications',exact=True)
 region.get_by_text('Creating backup',exact=True).wait_for();expect(page.get_by_role('button',name='Creating backup…',exact=True)).to_be_disabled()
 page.wait_for_function('document.querySelector("[aria-busy=true]")!==null')
 assert len(pending)==1
 page.get_by_role('button',name='Creating backup…',exact=True).evaluate('el=>el.click()');assert calls.count('business/backup-run')==1
 field=page.get_by_label('Minimum reminder period in days',exact=True);field.focus()
 latest={'id':'00000000-0000-4000-8000-000000000001','day':datetime.now(timezone.utc).date().isoformat(),'status':'primary','created_at':datetime.now(timezone.utc).isoformat(),'bytes':100,'file_count':0}
 pending.pop(0).fulfill(status=200,content_type='application/json',body=json.dumps({'configured':True,'primary_created':True,'offsite_pending':1,'latest':latest}))
 region.get_by_text('Backup saved to Supabase',exact=True).wait_for();expect(field).to_be_focused()
 expect(region.get_by_role('status')).to_contain_text('Google Drive copy is still pending')
 expect(page.locator('[data-backup-result]')).to_contain_text('created and verified')
 # Explicit server errors remain visible until dismissed, with an enabled retry.
 button.click();page.wait_for_timeout(100);assert len(pending)==1
 pending.pop(0).fulfill(status=500,content_type='application/json',body=json.dumps({'error':'Synthetic backup failure'}))
 region.get_by_role('alert').get_by_text(re.compile('Synthetic backup failure')).wait_for();expect(button).to_be_enabled()
 page.wait_for_timeout(8500);expect(region.get_by_role('alert')).to_be_visible()
 # A later retry recovers the same notification and does not create duplicates.
 button.click();page.wait_for_timeout(100)
 pending.pop(0).fulfill(status=200,content_type='application/json',body=json.dumps({'configured':True,'primary_created':False,'offsite_pending':1,'latest':latest}))
 region.get_by_text("Today's backup already exists",exact=True).wait_for();expect(region.locator('article')).to_have_count(1)
 # Required/range validation uses application UI and focuses the actual field.
 field.fill('0');page.get_by_role('button',name='Save reminder settings',exact=True).click()
 region.get_by_text('Check the form',exact=True).wait_for();expect(field).to_be_focused();assert field.get_attribute('aria-invalid')=='true'
 field.fill('7');assert field.get_attribute('aria-invalid')is None
 axe=(root/'node_modules/axe-core/axe.min.js').read_text()
 for width in [320,390,768,1280]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  bounds=region.bounding_box();assert bounds and bounds['x']>=0 and bounds['x']+bounds['width']<=width+1
  page.add_script_tag(content=axe);report=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
  assert not report['violations'],[(x['id'],[(n['target'],n['failureSummary'])for n in x['nodes']])for x in report['violations']]
  page.screenshot(path=str(out/f'notifications-{width}.png'),full_page=True)
 page.get_by_role('button',name=re.compile('^Notifications')).click();history=page.get_by_role('region',name='Recent notifications',exact=True)
 expect(history).to_be_visible();expect(history).to_contain_text('Synthetic backup failure');history.press('Escape');expect(history).not_to_be_visible()
 # Notifications and private history clear on sign-out.
 page.set_viewport_size({'width':1280,'height':900});page.get_by_role('button',name='Sign out',exact=True).click()
 page.get_by_role('heading',name='Welcome back.',exact=True).wait_for();expect(region.locator('article')).to_have_count(0)
 page.get_by_role('button',name='Notifications',exact=True).click();page.get_by_text('No notifications yet.',exact=True).wait_for()
 page.goto(origin+'/portal');page.get_by_role('heading',name='Sign in to view shared documents.',exact=True).wait_for();expect(region.locator('article')).to_have_count(0)
 assert not errors,errors;browser.close()
print('PASS: in-app backup progress/result/error/retry, duplicate-click guard, persistent errors, primary-versus-Drive wording, custom form validation, keyboard/focus, responsive notification history and sign-out clearing. No real backups or emails.')
