"""Check the generated public SEO surface, independently of page templates."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json,struct,xml.etree.ElementTree as ET
from company import SERVICES, SITE
ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
 def __init__(self):super().__init__();self.title='';self.in_title=False;self.meta={};self.canon=[];self.structured=[];self.in_schema=False;self.schema_text='';self.hrefs=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='title':self.in_title=True
  if tag=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
  if tag=='a':self.hrefs.append(a.get('href',''))
  if tag=='link' and a.get('rel')=='canonical':self.canon.append(a.get('href'))
  if tag=='script' and a.get('type')=='application/ld+json':self.in_schema=True;self.schema_text=''
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
  if tag=='script' and self.in_schema:self.structured.append(json.loads(self.schema_text));self.in_schema=False
 def handle_data(self,data):
  if self.in_title:self.title+=data
  if self.in_schema:self.schema_text+=data
image_bytes=(ROOT/'assets/social.png').read_bytes();assert image_bytes.startswith(b'\x89PNG\r\n\x1a\n')
assert struct.unpack('>II',image_bytes[16:24])==(1200,630)
sitemap=ET.parse(ROOT/'sitemap.xml');urls={el.text for el in sitemap.findall('.//{*}loc')}
seen_titles=set();seen_descriptions=set();indexed=set();all_hrefs=set()
for f in ROOT.rglob('*.html'):
 if {'.git','_site','apps','node_modules','.next'} & set(f.parts):continue
 p=Page();p.feed(f.read_text());assert len(p.canon)==1,f
 canonical=p.canon[0];assert canonical.startswith('https://'),f
 assert p.title and p.title not in seen_titles,('duplicate/missing title',f)
 desc=p.meta.get('description');assert desc and desc not in seen_descriptions,('duplicate/missing description',f)
 seen_titles.add(p.title);seen_descriptions.add(desc);all_hrefs.update(p.hrefs)
 assert p.meta.get('og:title')==p.title and p.meta.get('og:description')==desc,f
 assert p.meta.get('og:url')==canonical,f
 assert p.meta.get('twitter:card')=='summary_large_image',f
 image=p.meta.get('og:image','');assert image.endswith('.png') and (ROOT/'assets/social.png').exists(),f
 assert len(p.structured)==1,f
 graph=p.structured[0]['@graph'];types={n['@type'] for n in graph}
 assert {'Organization','WebSite'}<=types,f
 page=next(n for n in graph if n['@type'] in ['WebPage','AboutPage','ContactPage','CollectionPage'])
 assert page['url']==canonical and page['name']==p.title,f
 if 'noindex' in p.meta.get('robots',''):assert canonical not in urls,f
 else:
  indexed.add(canonical);assert canonical in urls,('not in sitemap',f)
 if '/services/' in canonical and not canonical.endswith('/services/'):
  archived=any(s.get('archived') and canonical.endswith('/services/'+s['slug']+'/') for s in SITE['services'])
  assert {'BreadcrumbList'}<=types,f
  if archived:assert 'noindex' in p.meta.get('robots','') and 'Service' not in types,f
  else:assert 'Service' in types,f
  assert len(next(n for n in graph if n['@type']=='BreadcrumbList')['itemListElement'])==3,f
assert urls==indexed,('sitemap mismatch',urls^indexed)
for slug in [s['slug'] for s in SERVICES]:
 assert any(h.endswith('/services/'+slug+'/') for h in all_hrefs),('unlinked service',slug)
print(f'PASS: {len(seen_titles)} unique page titles/descriptions, canonical and social metadata, Organization/WebSite/Service/Breadcrumb schema, all {len(urls)} indexable sitemap URLs, noindex exclusions and linked digital service pages.')
