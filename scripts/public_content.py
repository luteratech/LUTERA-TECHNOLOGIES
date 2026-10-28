"""Validate the public content contract and fetch only its published snapshot.

The public build uses an anon/publishable key, never an admin database key.
Private financial, staff and access tables have no anonymous privileges.
"""
import json
import re
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ICONS = {'procurement','hardware','consulting','support','server','network','laptop','accessory','printer','automation','software','data','cloud'}
PHOTOS = {'laptop','desktop','consulting','support','ai','software','data','servers','network','accessory','printer','procurement','workplace'}
COMPANY_FIELDS = {'name','legal_name','registration_completed','registration_number','email','phone','display_phone','whatsapp','street_address','city','state','country','lga','house_number','nature_of_business','brand_name'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def string(value, maximum, minimum=0):
    return isinstance(value, str) and minimum <= len(value.strip()) <= maximum and not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value)

def https(value):
    if not string(value, 300, 1): return False
    parsed = urlsplit(value)
    return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username and not parsed.password

def validate(site):
    require(isinstance(site, dict) and set(site) <= {'hosting','company','services','commitments','socials'} and {'hosting','company','services','commitments'} <= set(site), 'Invalid public content fields')
    require(site['hosting']['production_origin'] == 'https://luteratech.com', 'The primary domain must remain luteratech.com')
    c = site['company']
    require(isinstance(c, dict) and COMPANY_FIELDS <= set(c) <= COMPANY_FIELDS | {'support_email'}, 'Invalid company fields')
    require(all(string(v, 4000) for k,v in c.items() if k != 'registration_completed'), 'Invalid company text')
    require(isinstance(c['registration_completed'], bool), 'Invalid registration status')
    require(all(string(c[k], 250, 1) for k in ['name','legal_name','brand_name','street_address','city','state','display_phone']), 'Company identity fields are required')
    require(bool(re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+",c['email'])), 'Invalid company email')
    if 'support_email' in c:
        require(bool(re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+", c['support_email'])), 'Invalid support email')
    require(bool(re.fullmatch(r'\+[1-9][0-9]{7,14}',c['phone'])), 'Invalid phone number')
    require(bool(re.fullmatch(r'[A-Z]{2}',c['country'])) and https(c['whatsapp']), 'Invalid contact information')
    services = site['services']
    require(isinstance(services,list) and 1 <= len(services) <= 30, 'Include 1–30 services')
    for s in services:
        require(isinstance(s,dict) and {'key','slug','title','icon','image','alt','description'} <= set(s) and set(s) <= {'key','slug','title','icon','image','alt','description','detail'}, 'Invalid service fields')
        require(bool(re.fullmatch('[a-z][a-z0-9-]{1,39}',s['key'])) and bool(re.fullmatch('[a-z][a-z0-9-]{1,59}',s['slug'])), 'Invalid service key or address')
        require(s['icon'] in ICONS and s['image'] in PHOTOS, 'Unknown image or icon')
        require(string(s['title'],120,1) and string(s['alt'],220,1) and string(s['description'],800,1), 'Invalid service description')
        if 'detail' in s:
            d=s['detail']
            require(isinstance(d,dict) and set(d)=={'heading','body','points'} and string(d['heading'],160,1) and string(d['body'],5000,1) and isinstance(d['points'],list) and 1<=len(d['points'])<=12 and all(string(p,300,1) for p in d['points']), 'Invalid custom service page')
    require(len({s['key'] for s in services}) == len(services) == len({s['slug'] for s in services}), 'Duplicate service key or address')
    require(isinstance(site['commitments'],list) and 1<=len(site['commitments'])<=8, 'Include 1–8 commitments')
    for item in site['commitments']:
        require(set(item)=={'title','description'} and string(item['title'],140,1) and string(item['description'],800,1), 'Invalid commitment')
    require(isinstance(site.get('socials',[]),list) and len(site.get('socials',[]))<=8, 'Too many social links')
    for item in site.get('socials',[]):
        require(set(item)=={'label','url'} and string(item['label'],40,1) and https(item['url']), 'Invalid social link')
    return site

def published(configuration):
    host=configuration['url'].rstrip('/')
    require(host=='https://zwtjemhrubzgaueuyuxn.supabase.co', 'Unexpected published-content provider')
    request=Request(host+'/rest/v1/work_public_site?select=revision,content&id=eq.1',headers={'apikey':configuration['publishable_key'],'Accept':'application/json'})
    with urlopen(request,timeout=20) as response:
        raw=response.read(1_000_001)
    require(len(raw)<=1_000_000, 'Public content is too large')
    rows=json.loads(raw)
    require(isinstance(rows,list) and len(rows)==1, 'Published content is unavailable; keep the existing deployment')
    revision=rows[0]['revision']
    require(bool(re.fullmatch('[0-9a-f-]{36}',revision)), 'Invalid publication revision')
    return validate(rows[0]['content']),revision
