"""Verify automatic photo motion, footer pause and low-motion fallbacks."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import json,os,shutil,threading
from playwright.sync_api import sync_playwright
ROOT=Path(os.environ.get('LUTERA_TEST_DIR',Path(__file__).resolve().parents[1]/'_site')).resolve()
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):return super().translate_path(path.removeprefix('/LUTERA-TECHNOLOGIES'))
 def log_message(self,*args):pass
server=None;base=os.environ.get('LUTERA_TEST_URL')
if not base:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}'+os.environ.get('LUTERA_TEST_BASE','/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1191,'height':800});q=c.new_page();errors=[]
 q.on('pageerror',lambda e:errors.append(str(e)))
 q.goto(base,wait_until='networkidle');q.get_by_role('button',name='Got it').click()
 hero=q.locator('[data-hero]');q.wait_for_function('document.querySelector("[data-hero]").dataset.motion==="running"')
 # A slow runner may finish loading after an automatic cycle has occurred.
 assert 1<=q.locator('.hero-media img').count()<=3
 assert q.locator('.hero-controls,[data-hero-next],[data-hero-previous],[data-hero-counter]').count()==0
 active=q.locator('.hero-slide.is-active')
 initial_src=active.get_attribute('src')
 a=active.evaluate('(e)=>getComputedStyle(e).transform');q.wait_for_timeout(400);assert a!=active.evaluate('(e)=>getComputedStyle(e).transform')
 # Real automatic cycles decode each image and loop without navigation controls.
 seen={initial_src}
 for _ in range(3):
  previous=active.get_attribute('src')
  q.wait_for_function('(src)=>document.querySelector(".hero-slide.is-active").getAttribute("src")!==src',arg=previous,timeout=15000)
  assert active.evaluate('(e)=>e.complete&&e.naturalWidth>0')
  seen.add(active.get_attribute('src'))
 assert len(seen)==3,seen
 assert active.get_attribute('src')==initial_src
 assert q.locator('[data-motion-toggle]').count()==0
 q.locator('.enquiry-nav').click();q.wait_for_function('document.querySelector("[data-hero]").dataset.motion==="paused"')
 q.keyboard.press('Escape');q.wait_for_function('document.querySelector("[data-hero]").dataset.motion==="running"')
 q.locator('#our-services').scroll_into_view_if_needed();q.evaluate('scrollBy(0,300)')
 q.wait_for_function('document.querySelector("[data-hero]").dataset.motion==="paused"')
 q.evaluate('scrollTo(0,0)');q.wait_for_function('document.querySelector("[data-hero]").dataset.motion==="running"')
 # Changing the operating-system preference immediately suspends motion.
 q.emulate_media(reduced_motion='reduce');q.wait_for_function('document.querySelector("[data-hero]").dataset.motion==="paused"')
 for width,height in [(320,740),(390,844),(768,1024),(1024,768),(1191,668),(1440,1000)]:
  q.set_viewport_size({'width':width,'height':height});q.evaluate('scrollTo(0,0)')
  assert q.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  box=hero.bounding_box()
  for selector in ['h1','.hero-copy>p','.hero-panel h2','.hero-panel p']:
   text=hero.locator(selector);rect=text.bounding_box()
   assert text.is_visible() and rect['x']>=0 and rect['x']+rect['width']<=width+1,(width,selector,rect)
   assert rect['y']>=box['y'] and rect['y']+rect['height']<=box['y']+box['height']+1,(width,selector)
   assert text.evaluate('(e)=>getComputedStyle(e).color')=='rgb(255, 255, 255)'
 # Reduced-motion and data-saving sessions request just the first hero photo.
 for mode in ['reduce','save-data','no-js']:
  context=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce' if mode=='reduce' else 'no-preference',java_script_enabled=mode!='no-js')
  if mode=='save-data':context.add_init_script("Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){}}})")
  r=context.new_page();requests=[];r.on('request',lambda req:requests.append(req.url));r.goto(base,wait_until='networkidle')
  assert r.locator('.hero-slide').count()==1
  assert r.locator('.hero-slide').evaluate('(e)=>e.complete&&e.naturalWidth>0')
  assert r.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0
  assert not any('hero-support-' in url or 'hero-cloud-' in url for url in requests),(mode,requests)
  assert r.locator('[data-motion-toggle]').count()==0
  if mode!='no-js':assert r.locator('[data-hero]').get_attribute('data-motion')=='paused'
  context.close()
 # Failed downloads retain the valid image, then continue with the next scene.
 fail=b.new_context(viewport={'width':1191,'height':800});r=fail.new_page();failed=[]
 def missing(route):
  failed.append(route.request.url);route.fulfill(status=404,body='Missing photo')
 r.route('**/hero-support-*.webp',missing)
 r.goto(base,wait_until='networkidle');r.get_by_role('button',name='Got it').click()
 r.wait_for_function('document.querySelector("[data-hero]").dataset.motion==="running"')
 r.wait_for_timeout(9500)
 assert failed
 assert 'hero-workplace-' in r.locator('.hero-slide.is-active').get_attribute('src')
 assert r.locator('.hero-slide.is-active').evaluate('(e)=>e.complete&&e.naturalWidth>0')
 r.wait_for_function('document.querySelector(".hero-slide.is-active").src.includes("hero-cloud-")',timeout=15000)
 assert r.locator('.hero-slide.is-active').evaluate('(e)=>e.complete&&e.naturalWidth>0')
 fail.close();assert not errors,errors;b.close()
if server:server.shutdown()
print('PASS hero: automatic three-photo loop without controls, real pan/crossfade, offscreen/modal suspension, dynamic reduced motion, save-data/no-JS still images, failed-image recovery, readable text and 320–1440px layouts.')
