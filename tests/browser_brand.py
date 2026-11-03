"""Public rebrand regression checks: service access, assets and device layouts."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os, shutil, threading
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('LUTERA_TEST_DIR',Path(__file__).resolve().parents[1]/'_site')).resolve()
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):return super().translate_path(path.removeprefix('/LUTERA-TECHNOLOGIES'))
 def log_message(self,*args):pass
server=None
base=os.environ.get('LUTERA_TEST_URL')
if not base:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}'+os.environ.get('LUTERA_TEST_BASE','/')
services={
 'it-procurement':'procurement','hardware':'hardware','consulting':'consulting',
 'technical-support':'support','ai-automation':'ai','software-development':'software',
 'data-analytics':'data','cloud-integration':'cloud',
}
routes=['','about/','services/','solutions/','contact/','request-quote/','privacy/','terms/','cookies/','thank-you/','404.html']+['services/'+s+'/' for s in services]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1000})
 q=c.new_page();errors=[];failed=[];requests=[]
 q.on('pageerror',lambda e:errors.append(str(e)))
 q.on('requestfailed',lambda r:failed.append(r.url))
 q.on('request',lambda r:requests.append(r.url))
 q.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)
 for width in [320,390,768,1024,1440]:
  q.set_viewport_size({'width':width,'height':1000})
  for route in ['', 'services/']:
   q.goto(base+route,referer=base,wait_until='load')
   if q.locator('#cookie-consent').is_visible():q.get_by_role('button',name='Got it').click()
   assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
   cards=q.locator('[data-service-grid] article')
   assert cards.count()==8
   widths=[round(card.bounding_box()['width']) for card in cards.all()]
   assert max(widths)-min(widths)<=1,('unequal service widths',width,widths)
   for slug in services:
    assert cards.locator(f'a[href$="/services/{slug}/"]').count()==1
   if width<1024:
    q.get_by_role('button',name='Toggle navigation').click()
    assert q.get_by_role('navigation',name='Main navigation').is_visible()
    q.keyboard.press('Escape')
    assert not q.get_by_role('navigation',name='Main navigation').is_visible()
    assert q.get_by_role('button',name='Toggle navigation').evaluate('(e)=>e===document.activeElement')
 q.set_viewport_size({'width':1440,'height':1000})
 for route in routes:
  q.goto(base+route,referer=base,wait_until='load')
  assert q.locator('h1').count()==1
  assert q.locator('footer').inner_text().count('Lutera Technology Ltd')>=1
  body=q.locator('body').inner_text()
  assert 'incorporation is pending' not in body.lower()
  assert 'registration pending' not in body.lower()
  assert 'RC number' not in body
  # Load below-fold images to verify actual image bytes, including every service.
  q.locator('img').evaluate_all('(imgs)=>imgs.forEach(img=>img.loading="eager")')
  q.wait_for_function('Array.from(document.images).every(img=>img.complete && img.naturalWidth>0)')
  assert q.locator('canvas').count()==0
  assert q.locator('header img').get_attribute('src').endswith('lutera-horizontal-light.svg')
  assert q.locator('footer img').get_attribute('src').endswith('lutera-horizontal-dark.svg')
  for width in [390,768,1440]:
   q.set_viewport_size({'width':width,'height':1000})
   assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),(route,width)
  if route.startswith('services/') and route!='services/':
   slug=route.split('/')[1]
   q.locator(f'main a[href$="category={services[slug]}"]').first.click()
   q.wait_for_url('**/request-quote/?category='+services[slug])
   assert q.locator('#service_category').input_value()==services[slug]
 q.goto(base+'services/technical-support/',referer=base,wait_until='load')
 text=q.locator('main').inner_text().lower()
 for phrase in ['computer-lab','commissioning','asset tagging','locally held','site acceptance','two working days']:
  assert phrase in text,phrase
 q.emulate_media(reduced_motion='reduce')
 q.goto(base,referer=base,wait_until='networkidle')
 assert q.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0
 assert not any('/three/' in url or 'scene.js' in url for url in requests)
 # Fresh contexts verify the real selected image rather than a larger cached
 # candidate left over from resizing. Mobile high-DPI screens get a middle size.
 for width,scale,variant in [(1440,1,'-480.webp'),(390,1.75,'-768.webp')]:
  image_context=b.new_context(viewport={'width':width,'height':1000},device_scale_factor=scale,reduced_motion='reduce')
  image_page=image_context.new_page();image_page.goto(base,wait_until='load')
  image_page.locator('.service-card>img').evaluate_all('(imgs)=>imgs.forEach(img=>img.loading="eager")')
  image_page.wait_for_function('Array.from(document.querySelectorAll(".service-card>img")).every(img=>img.complete&&img.naturalWidth>0)')
  assert all(img.evaluate('(el)=>el.currentSrc').endswith(variant) for img in image_page.locator('.service-card>img').all()),(width,scale)
  assert image_page.locator('link[rel="stylesheet"]').count()==1
  assert image_page.locator('link[rel="preload"][href$="PlayfairDisplay-Italic-500.woff2"]').count()==1
  image_context.close()
 # Mobile navigation and quote link remain available with JavaScript disabled.
 nc=b.new_context(java_script_enabled=False,viewport={'width':390,'height':844});n=nc.new_page()
 n.goto(base+'request-quote/',wait_until='load')
 assert n.get_by_role('navigation',name='Main navigation').is_visible()
 assert n.get_by_role('link',name='Services',exact=True).first.is_visible()
 assert n.locator('[data-quote-step]:visible').count()==3
 assert n.evaluate('document.documentElement.scrollWidth<=innerWidth')
 nc.close()
 assert not errors,errors
 assert not failed,failed
 b.close()
if server:server.shutdown()
print('PASS: all 19 routes and image assets, all 8 service/quote links, equal service prominence, 320–1440px layouts, keyboard/mobile navigation, company identity, lab/support content, reduced motion, no 3D downloads and no-JS mobile navigation/form.')
