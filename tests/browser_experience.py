from playwright.sync_api import sync_playwright
import json,os,shutil,threading
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from urllib.parse import parse_qs,urlsplit
ROOT=Path(os.environ.get('LUTERA_TEST_DIR',Path(__file__).resolve().parents[1]/'_site')).resolve()
CONTACT=json.loads((Path(__file__).resolve().parents[1]/'content/site.json').read_text())['company']
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):return super().translate_path(path.removeprefix('/LUTERA-TECHNOLOGIES'))
 def log_message(self,*args):pass
server=None
base=os.environ.get('LUTERA_TEST_URL')
if not base:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}'+os.environ.get('LUTERA_TEST_BASE','/')
# Programmatic route jumps here represent internal browsing within the visit.
def visit(page,url,**options):
 return page.goto(url,referer=base,**options)

with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 q=c.new_page();errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
 visit(q,base,wait_until='networkidle')
 q.get_by_role('button',name='Reject optional',exact=True).click()
 assert not errors,errors
 assert q.locator('.service-grid .service-card').count()==8
 # Header enquiry is a complete empty-state/list workflow, not a dead link.
 q.locator('.enquiry-nav').click()
 assert q.locator('#enquiry-dialog').is_visible()
 assert 'Your next setup starts here' in q.locator('#enquiry-items').inner_text()
 assert q.locator('[data-clear-enquiry]').is_disabled()
 assert q.locator('[data-copy-enquiry]').is_disabled()
 q.keyboard.press('Escape')
 assert q.locator('.enquiry-nav').evaluate('(el)=>el===document.activeElement')
 # A transferred list is consumed once: removing it must survive a reload.
 visit(q,base+'request-quote/?items=laptop:3&category=hardware',wait_until='networkidle')
 assert 'items=' not in q.url and 'category=hardware' in q.url,(q.url,errors)
 q.locator('[data-open-enquiry]').first.click()
 q.locator('[data-remove="laptop"]').click()
 q.keyboard.press('Escape');q.reload(wait_until='networkidle')
 assert 'No equipment selected' in q.locator('[data-quote-list]').inner_text()
 assert q.locator('#service_category').input_value()=='hardware'
 # Copy has a usable fallback when clipboard permissions are denied.
 visit(q,base+'solutions/',wait_until='networkidle')
 q.locator('[data-add="laptop"]').first.click()
 q.locator('.enquiry-nav').click()
 q.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}})")
 q.locator('[data-copy-enquiry]').click()
 assert q.get_by_role('textbox',name='Equipment list to copy').input_value()=='Business laptops: 1'
 q.locator('[data-clear-enquiry]').click()
 assert q.locator('[data-enquiry-count]').first.inner_text()=='0'
 assert 'Your next setup starts here' in q.locator('#enquiry-items').inner_text()
 q.keyboard.press('Escape');q.reload(wait_until='networkidle')
 assert q.locator('[data-enquiry-count]').first.inner_text()=='0'
 visit(q,base,wait_until='networkidle')
 q.locator('#tab-server').click();assert q.locator('[data-explorer-title]').inner_text()=='Servers & storage'
 assert q.locator('[data-explorer-photo]').get_attribute('src').endswith('/servers-960.webp')
 q.locator('#tab-server').press('ArrowRight');assert q.locator('#tab-network').get_attribute('aria-selected')=='true'
 q.get_by_role('tab',name='04 Agree next steps',exact=False).click()
 assert 'Agree the scope' in q.locator('[data-stage-title]').inner_text()
 visit(q,base+'solutions/',wait_until='networkidle')
 q.locator('[data-add="laptop"]').first.click()
 q.locator('[data-add="server"]').first.click()
 q.locator('[data-open-enquiry]').first.click()
 assert q.locator('#enquiry-dialog').is_visible()
 qty=q.locator('[data-item-quantity="laptop"]');qty.fill('5');qty.press('Tab')
 assert q.locator('[data-enquiry-count]').first.inner_text()=='6'
 qty.fill('0');qty.press('Tab')
 q.locator('[data-continue-quote]').click()
 assert q.locator('#enquiry-dialog').is_visible(),'Invalid quantities must block continuing'
 qty.fill('5');qty.press('Tab')
 q.get_by_role('button',name='Close enquiry list').click()
 q.locator('[data-compare="workstation"]').uncheck()
 assert not q.locator('th[data-compare-col="workstation"]').is_visible()
 q.locator('[data-compare="desktop"]').click()
 assert q.locator('[data-compare="desktop"]').is_checked()
 assert 'at least two' in q.locator('.compare-feedback').inner_text()
 # The same list persists across pages and use-case selection seeds the brief.
 visit(q,base+'request-quote/?need=office',wait_until='networkidle')
 assert q.locator('[data-quote-step="0"]').is_visible()
 assert q.locator('[data-quote-step="1"]').is_hidden()
 assert q.locator('#project_type').input_value()=='office'
 assert 'new office setup' in q.locator('#requirements').input_value()
 assert 'Business laptops' in q.locator('[data-quote-list]').inner_text()
 q.locator('[data-wizard-next]').click()
 assert q.locator('[data-quote-step="1"]').is_visible()
 assert q.locator('#quantity').input_value()=='6'
 q.locator('#needed_by').fill('2020-01-01');q.locator('[data-wizard-next]').click()
 assert q.locator('[data-quote-step="1"]').is_visible()
 assert 'future' in q.locator('#wizard-status').inner_text().lower()
 q.locator('#needed_by').fill('');q.locator('#budget_range').fill('Optional budget to discuss')
 q.locator('[data-wizard-back]').click();assert q.locator('#requirements').input_value()
 q.locator('[data-wizard-next]').click();assert q.locator('#budget_range').input_value()=='Optional budget to discuss'
 q.locator('[data-wizard-next]').click()
 assert q.locator('[data-quote-step="2"]').is_visible()
 q.locator('#rfq-submit').click();assert q.locator('#wizard-status').inner_text()
 q.locator('#organization_name').fill('QA ONLY — not a real enquiry')
 q.locator('#contact_name').fill('QA tester');q.locator('#email').fill('qa@example.com')
 q.locator('[name="privacy_acknowledged"]').check()
 assert 'Business laptops: 5' in q.locator('[data-review-summary]').inner_text()
 captured=[]
 def intercept(route):
  captured.append(parse_qs(route.request.post_data));route.fulfill(status=200,content_type='text/html',body='<h1>Mock provider; no email was sent</h1>')
 q.route('https://workspace.luteratech.com/api/enquiry',intercept)
 q.locator('#rfq-submit').click();q.wait_for_url('https://workspace.luteratech.com/api/enquiry')
 payload=captured[-1];assert payload['equipment_list'][0].replace('\r\n','\n')=='Business laptops: 5\nServers & storage: 1',payload
 assert payload['quantity']==['6'];assert payload['email']==['qa@example.com'];assert payload['privacy_acknowledged_at'];assert 'New office setup' in payload['enquiry_summary'][0]
 # Free text and contact information never enter session storage.
 saved=q.evaluate("sessionStorage.getItem('lutera_equipment_v1')") if q.url.startswith(base) else None
 visit(q,base+'contact/',wait_until='networkidle')
 saved=q.evaluate("sessionStorage.getItem('lutera_equipment_v1')");assert 'qa@example.com' not in saved;assert 'QA tester' not in saved
 q.locator('#name').fill('QA tester');q.locator('#email').fill('qa@example.com');q.locator('#message').fill('QA ONLY: verify contact transport; do not send.');q.get_by_role('checkbox').check();q.get_by_role('button',name='Send message').click();q.wait_for_url('https://workspace.luteratech.com/api/enquiry');assert captured[-1]['message']
 # Solutions include every service group; digital and consulting/support links preselect the requested work.
 for category in ['ai','software','data','cloud','consulting','support']:
  visit(q,base+'solutions/',wait_until='domcontentloaded')
  assert q.locator('.digital-grid article').count()==4
  assert q.locator('.service-solutions-grid article').count()==3
  assert q.locator('#hardware-solutions .equipment-card').count()==6
  q.locator('main a[href$="category='+category+'"]').first.click()
  q.wait_for_url('**/request-quote/?category='+category)
  assert q.locator('#service_category').input_value()==category
  q.locator('#requirements').fill('Discuss our digital project requirements and an appropriate implementation scope.')
  q.locator('[data-wizard-next]').click()
  assert q.locator('[data-quote-step="1"]').is_visible()
  assert not q.locator('#quantity').evaluate('(el)=>el.required')
  q.locator('#quantity').fill('');q.locator('[data-wizard-next]').click()
  assert q.locator('[data-quote-step="2"]').is_visible()
 # All public routes and layouts, including comparison horizontal-scroll containment.
 for width in [360,768,1024,1440]:
  q.set_viewport_size({'width':width,'height':900})
  for route in ['', 'solutions/','request-quote/','contact/','services/it-procurement/','services/ai-automation/','services/software-development/','services/data-analytics/','services/cloud-integration/']:
   visit(q,base+route,wait_until='domcontentloaded')
   assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
   toggle=q.locator('.floating-contact-toggle');options=q.locator('.floating-contact-options')
   assert toggle.is_visible() and not options.is_visible()
   rect=toggle.bounding_box();assert rect['x']>width/2 and rect['y']>750,(width,route,rect)
   toggle.click();assert options.is_visible()
   assert q.get_by_role('link',name='WhatsApp chat',exact=False).last.get_attribute('href')==CONTACT['whatsapp']
   assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route,'expanded contact')
   q.keyboard.press('Escape');assert not options.is_visible()
   assert toggle.evaluate('(el)=>el===document.activeElement')
   toggle.click();q.locator('h1').click();assert not options.is_visible()
 q.set_viewport_size({'width':1440,'height':1000});visit(q,base,wait_until='networkidle')

 if os.environ.get('LUTERA_SCREENSHOTS'):q.screenshot(path=os.environ['LUTERA_SCREENSHOTS']+'/desktop.png',full_page=True)
 q.set_viewport_size({'width':390,'height':844});
 if os.environ.get('LUTERA_SCREENSHOTS'):q.screenshot(path=os.environ['LUTERA_SCREENSHOTS']+'/mobile.png',full_page=True)
 # An enquiry dialog must trap focus and return to its trigger when escaped.
 q.locator('.menu').click();q.locator('[data-open-enquiry]').first.click();q.keyboard.press('Escape');assert not q.locator('#enquiry-dialog').is_visible()
 # No JavaScript: all quote fields are visible and native HTML can submit.
 nojs=b.new_context(java_script_enabled=False,viewport={'width':1440,'height':1000});r=nojs.new_page();r.goto(base+'request-quote/')
 assert r.locator('[data-quote-step]:visible').count()==3
 assert r.locator('#rfq-form').get_attribute('method')=='POST'
 r.locator('.floating-contact-toggle').click();assert r.locator('.floating-contact-options').is_visible()
 assert r.locator('.floating-quote-link').get_attribute('href')==urlsplit(base).path+'request-quote/'
 nojs.close()
 # Storage restrictions retain the current list and pass it to the quote URL.
 limited=b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce');r=limited.new_page();r.add_init_script("Storage.prototype.setItem=function(){throw new Error('blocked')};Storage.prototype.getItem=function(){throw new Error('blocked')};");r.goto(base+'solutions/',wait_until='networkidle');r.locator('[data-add="laptop"]').first.click();r.locator('.floating-contact-toggle').click();r.locator('.floating-quote-link').click();r.wait_for_url('**/request-quote/**');assert 'items=laptop' in r.url;assert 'Business laptops' in r.locator('[data-quote-list]').inner_text();limited.close()
 assert not errors,errors
 b.close()
print('PASS: all interactive features, cross-page enquiry persistence, quantity validation, comparison controls, step validation/back navigation, structured email POST, contact POST, privacy of storage, all responsive widths, floating contact disclosure and links, no-JS form and storage-blocked quote fallback. Test email sends were intercepted.')

if server:server.shutdown()
