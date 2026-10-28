"""Shared public content. The future workspace can import this data contract."""
from pathlib import Path
from html import escape
from urllib.parse import urlencode, urlsplit
import json

SITE = json.loads((Path(__file__).resolve().parents[1] / 'content/site.json').read_text())
COMPANY = SITE['company']
SERVICES = SITE['services']
SUPPORT_EMAIL = COMPANY.get('support_email', COMPANY['email'])
_whatsapp = urlsplit(COMPANY['whatsapp'])
_digits = _whatsapp.path.strip('/') if _whatsapp.hostname == 'wa.me' else ''
WHATSAPP_PHONE = '+' + _digits if _digits.isdigit() else ''
WHATSAPP_DISPLAY_PHONE = ('+234 ' + _digits[3:6] + ' ' + _digits[6:9] + ' ' + _digits[9:]) if _digits.startswith('234') and len(_digits) == 13 else WHATSAPP_PHONE
STREET_ADDRESS = COMPANY['street_address']
CITY, STATE = COMPANY['city'], COMPANY['state']
ADDRESS = f'{STREET_ADDRESS}, {CITY}, {STATE}, Nigeria'
LGA, HOUSE_NUMBER = COMPANY['lga'], COMPANY['house_number']
NATURE_OF_BUSINESS = COMPANY['nature_of_business']
MAP_URL = 'https://www.google.com/maps/search/?' + urlencode({'api': '1', 'query': ADDRESS})
DIGITAL_SERVICES = [(s['key'], s['title'], s['description']) for s in SERVICES if s['key'] in ['ai','software','data','cloud']]
DIGITAL_SERVICE_SLUGS = {s['key']:s['slug'] for s in SERVICES if s['key'] in ['ai','software','data','cloud']}
DIGITAL_SERVICE_IMAGES = {s['key']:(s['image'],s['alt']) for s in SERVICES if s['key'] in DIGITAL_SERVICE_SLUGS}

def address_block():
    return '<address class="company-address">' + escape(ADDRESS) + '</address>'

def directions_link():
    return '<a class="text-link" href="' + escape(MAP_URL, quote=True) + '" target="_blank" rel="noopener noreferrer">View on Google Maps ↗</a>'

def company_details():
    facts=[('Registered name',COMPANY['legal_name']),('Address',ADDRESS),('City',CITY),('State / FCT',STATE),('LGA',LGA)]
    if COMPANY['registration_number']:facts.append(('Registration number',COMPANY['registration_number']))
    return ('<section><div class="wrap company-profile"><div><h2>Based in Abuja.<br>Connected to your next project.</h2><dl class="company-facts">' +
            ''.join('<div><dt>'+label+'</dt><dd>'+escape(value)+'</dd></div>' for label,value in facts) +
            '</dl>'+directions_link()+'</div><div class="company-scope"><h3>What we do</h3><p>'+escape(NATURE_OF_BUSINESS)+'</p></div></div></section>')

def service_cards(base, icon, heading="h3"):
    return '<div class="service-grid" data-service-grid>'+''.join(
        f'<article class="service-card" data-service="{s["key"]}"><img class="card-photo" src="{base}assets/photos/{s["image"]}.jpg" width="960" height="640" loading="lazy" decoding="async" alt="{escape(s["alt"],quote=True)}"><div class="service-card-copy">{icon(s["icon"])}<{heading}>{escape(s["title"])}</{heading}><p>{escape(s["description"])}</p><a class="text-link" href="{base}services/{s["slug"]}/">Explore {escape(s["title"])} ↗</a></div></article>'
        for s in SERVICES)+'</div>'

def commitments(base):
    support = next((s for s in SERVICES if s['key']=='support'), None)
    return '<section class="commitments"><div class="wrap"><div class="section-head"><h2>Clear commitments.<br>From the start.</h2><p>We reply to enquiries within two working days. Project scope, supply and service terms are agreed in writing.</p></div><div class="commitment-grid">'+''.join(
        '<article><h3>'+escape(c['title'])+'</h3><p>'+escape(c['description'])+'</p></article>' for c in SITE['commitments'])+'</div>'+ (f'<a class="text-link" href="{base}services/{support["slug"]}/">Our installation and support approach ↗</a>' if support else '')+'</div></section>'

def digital_services(base):
    return ('<section class="digital-services" id="digital-solutions"><div class="wrap"><div class="section-head"><h2>Improve a workflow.<br>Connect your systems.</h2><p>Start with the process, application or decision you want to improve. Find the right place to begin below.</p></div><div class="digital-grid">'+''.join(
        f'<article class="equipment-card"><img class="digital-photo" src="{base}assets/photos/{DIGITAL_SERVICE_IMAGES[key][0]}.jpg" width="960" height="640" loading="lazy" decoding="async" alt="{escape(DIGITAL_SERVICE_IMAGES[key][1],quote=True)}"><div><h3>{escape(title)}</h3><p>{escape(description)}</p><a class="text-link" href="{base}request-quote/?category={key}">Discuss your project ↗</a><a class="text-link service-detail-link" href="{base}services/{DIGITAL_SERVICE_SLUGS[key]}/">Explore {escape(title)} ↗</a></div></article>'
        for key,title,description in DIGITAL_SERVICES)+'</div></div></section>')
