"""Build the static public Lutera website from shared content and templates."""
from pathlib import Path
from html import escape
from hashlib import sha256
import json
import os
import re

from company import (SITE, COMPANY, SERVICES, STREET_ADDRESS, CITY, STATE, NATURE_OF_BUSINESS,
                     address_block, directions_link, company_details, service_cards, commitments, SUPPORT_EMAIL, WHATSAPP_PHONE, WHATSAPP_DISPLAY_PHONE)
from consent import notice as consent_notice, STORAGE_NOTICE
from seo import metadata, schema, add_digital_pages
from experience import enhance, chrome

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('SITE_BASE', '/').rstrip('/') + '/'
ORIGIN = os.environ['SITE_ORIGIN'].rstrip('/')
FORM_ORIGIN = os.environ.get('FORM_ORIGIN', ORIGIN).rstrip('/')
NOINDEX = os.environ.get('SITE_NOINDEX') == '1'
HOSTING_PROVIDER = 'Vercel'
REV = 'services2'

ICONS = {
 'procurement':'<path d="M9 5H5v16h14V5h-4M9 3h6v5H9Z"/><path d="m8 14 3 3 5-6"/>',
 'hardware':'<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/>',
 'consulting':'<path d="M4 20V4h16v12H9Zm4-12h8M8 12h5"/>',
 'support':'<path d="m14 7 3 3 4-4a7 7 0 0 1-9 9l-6 6-3-3 6-6a7 7 0 0 1 9-9Z"/>',
 'server':'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 9h14M5 15h14M9 6h1m-1 6h1m-1 6h1"/>',
 'network':'<rect x="8" y="2" width="8" height="6" rx="1"/><path d="M12 8v5M4 17v-4h16v4"/><rect x="1" y="17" width="6" height="5" rx="1"/><rect x="9" y="17" width="6" height="5" rx="1"/><rect x="17" y="17" width="6" height="5" rx="1"/>',
 'laptop':'<path d="M4 16V4h16v12m-16 0h16l3 4H1Z"/>',
 'accessory':'<rect x="2" y="9" width="20" height="11" rx="2"/><path d="M5 13h2m2 0h2m2 0h2m2 0h2M6 17h12M12 9V4h7"/>',
 'printer':'<path d="M6 8V2h12v6M6 17H2V8h20v9h-4M6 13h12v9H6Zm12-2h1"/>',
 'automation':'<rect x="2" y="3" width="7" height="6" rx="1"/><rect x="15" y="15" width="7" height="6" rx="1"/><path d="M9 6h6a4 4 0 0 1 4 4v5M5 9v6a4 4 0 0 0 4 4h6m-5-9 2 2-2 2"/>',
 'software':'<path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 20"/>',
 'data':'<path d="M3 3v18h18M7 16v-5m5 5V6m5 10V9"/>',
 'cloud':'<path d="M6 18a5 5 0 1 1 0-10 7 7 0 0 1 13-1 5 5 0 0 1-1 11M9 15l3-3 3 3m-3-3v9"/>',
}

def icon(key):
    return '<span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[key]+'</svg></span>'

def url(route=''):
    return BASE + route.strip('/') + ('/' if route else '')

def link(route, label, cls=''):
    return f'<a href="{url(route)}" class="{cls}">{label}</a>'

def btn(route, label, cls=''):
    return link(route, label+' <span aria-hidden="true">↗</span>', 'btn '+cls)

def eye(label):
    # Section headings carry the hierarchy; decorative labels are intentionally omitted.
    return ''

def pagehero(title, description, label='', crumb=''):
    return ('<div class="page-hero"><div class="wrap"><nav class="breadcrumb" aria-label="Breadcrumb">'+
            link('', 'Home')+'<span aria-hidden="true">/</span><span>'+escape(crumb or title)+'</span></nav>'+
            '<h1>'+title+'</h1><p>'+description+'</p></div></div>')

def photo(name, alt, cls='', eager=False):
    return f'<img class="{cls}" src="{BASE}assets/photos/{name}.jpg" width="1100" height="730" loading="{"eager" if eager else "lazy"}" decoding="async" alt="{escape(alt,quote=True)}">'

def cta():
    return ('<section class="cta-section"><div class="wrap"><div class="cta"><div><h2>Tell us what comes next.</h2>'
            '<p>Share the project, the requirements and your timeline. We reply within two working days.</p></div>'+
            btn('request-quote','Request a quote')+'</div></div></section>')

# Photo changes never replace or hide the readable company proposition.
HERO_SCENES = [
    ('hero-workplace', 'Equipment and digital workspaces', '50% 48%'),
    ('hero-support', 'Computer installation and support', '50% 48%'),
    ('hero-cloud', 'Cloud and connected infrastructure', '50% 50%'),
]
hero_scenes = [{'src':BASE+'assets/photos/'+name+'-1280.webp',
                'srcset':', '.join(BASE+'assets/photos/'+name+'-'+str(w)+'.webp '+str(w)+'w' for w in [768,1280,1920]),
                'name':name_label,'position':position} for name,name_label,position in HERO_SCENES]
hero_manifest = json.dumps(hero_scenes,ensure_ascii=False).replace('<','\\u003c')
first_scene = hero_scenes[0]
hero=(f'<section class="hero hero--photographic" data-hero aria-labelledby="hero-title">'
      f'<div class="hero-media" data-hero-media aria-hidden="true"><img class="hero-slide is-active" src="{first_scene["src"]}" srcset="{first_scene["srcset"]}" sizes="100vw" width="1920" height="1200" alt="" fetchpriority="high" decoding="async" style="object-position:{first_scene["position"]}"></div>'
      '<div class="hero-shade" aria-hidden="true"></div><div class="wrap hero-grid"><div class="hero-copy"><h1 id="hero-title">Hardware, software<br>and intelligent<br><em class="lt-accent">systems.</em></h1>'
      '<p>Built around your organisation. From equipment supply and computer labs to AI, software, data and cloud, we plan, source, build and support the technology your work depends on.</p>'
      '<div class="actions">'+btn('request-quote','Request a quote')+link('services','Explore our services ↗','text-link')+'</div></div>'
      '<div class="hero-panel"><div class="hero-panel-copy"><h2>Supply. Build. Connect.</h2><p>One considered approach.<br>From your first brief to ongoing support.</p></div></div></div>'
      '<script id="hero-scenes" type="application/json">'+hero_manifest+'</script></section>')
service_section='<section class="home-services" id="our-services"><div class="wrap"><div class="section-head"><h2>Eight services.<br>One place to start.</h2><p>Choose the expertise your project needs. Every service starts with your organisation, your users and a clear scope.</p></div>'+service_cards(BASE,icon)+'</div></section>'
home=hero+service_section

about=pagehero('Good technology starts<br>with understanding.','Lutera brings equipment, software, intelligent systems and technical expertise together around the way your organisation works.','', 'About')
about+='<section><div class="wrap split"><div><h2>One team.<br>A broader perspective.</h2><p>Lutera Technology Ltd works across AI and automation, software development, analytics, cloud integration, technology consulting, hardware supply and support.</p><p>We help schools, public organisations and companies define their requirements, source suitable equipment and build or connect the systems they need. Computer-lab installation and commissioning form part of our installation and technical-support work.</p><p>Project specifications, deliverables and supply terms are agreed in writing. We keep the conversation clear from the first brief through handover and ongoing support.</p></div><figure class="service-figure">'+photo('consulting','A team discussing project requirements with laptops around a shared table')+'</figure></div></section>'
about+='<section class="pale"><div class="wrap two-cards"><article class="card"><h2>Make technology useful.</h2><p>Our mission is to simplify how organisations plan, adopt, build, source and support technology, with practical thinking and clear communication.</p></article><article class="card"><h2>Keep the work moving.</h2><p>We bring the equipment, software and support conversation together, so each decision can serve the organisation beyond the initial purchase.</p></article></div></section>'
about+=company_details()+commitments(BASE)+cta()
servicepage=pagehero('IT and AI services.<br>Built around your organisation.','Lutera Technology Ltd brings hardware supply, software, AI, data, cloud and technical support together from Abuja. Explore our services to find the expertise your project needs.','','Services')
servicepage+='<section><div class="wrap">'+service_cards(BASE,icon,'h2')+'</div></section>'
servicepage+=('<section class="pale" aria-labelledby="service-planning"><div class="wrap split"><div>'
              '<h2 id="service-planning">Choose the service around the work.</h2>'
              '<p>For a new office or computer lab, start with the number of users, the applications they need and the space available. Hardware supply and procurement cover the equipment; installation and technical support cover setup, commissioning and the agreed support arrangements.</p>'
              '<p>For a digital project, describe what your team does today and what should improve. Software development supports a new application or business process. AI and automation can assist with defined repeatable tasks, data analytics supports reporting and decisions, and cloud integration connects the systems involved.</p>'
              '<p>If the right approach is still unclear, begin with technology consulting. One project can involve several services. We discuss the dependencies and responsibilities together before agreeing the scope.</p></div><div>'
              '<h2>What to include in your brief.</h2>'
              '<ul class="ticks"><li>The business problem, the people affected and the outcome you need.</li>'
              '<li>Your existing equipment, applications or data sources, and anything that must connect.</li>'
              '<li>The project location, estimated quantities or users, and preferred timing.</li>'
              '<li>Any delivery, handover, training or ongoing support requirements.</li></ul>'
              '<p>You can enquire before you have a finished specification. Include the details you know; leave out passwords and confidential records. We use the brief to clarify requirements and prepare an appropriate next step.</p>'
              +btn('request-quote','Discuss your service requirements')+'</div></div></section>')
servicepage+=commitments(BASE)+cta()

# The experience module supplies Solutions and the native, progressively enhanced quote form.
pages={'':('Home',home),'about':('About',about),'services':('Services',servicepage),'solutions':('Solutions',''),'request-quote':('Request a quote','')}

def field(name,label,typ='text',required=False,attrs=''):
    return f'<div class="field"><label for="{name}">{label}{" *" if required else " <small>(optional)</small>"}</label><input id="{name}" name="{name}" type="{typ}" {"required" if required else ""} {attrs}></div>'

def contactside():
    return ('<aside class="sidebar"><h2>Let’s talk it through.</h2><p>We reply to enquiries within two working days.</p>'
            f'<div class="sidebar-box"><h3>General enquiries</h3><a href="mailto:{COMPANY["email"]}">{COMPANY["email"]}</a><h3>Support</h3><a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a></div>'
            f'<div class="sidebar-box"><h3>Phone & WhatsApp</h3><a href="tel:{COMPANY["phone"]}">{COMPANY["display_phone"]}</a><a class="text-link" href="{COMPANY["whatsapp"]}" target="_blank" rel="noopener noreferrer">WhatsApp {WHATSAPP_DISPLAY_PHONE} ↗</a></div>'
            '<div class="sidebar-box"><h3>Visit by arrangement</h3>'+address_block()+directions_link()+'</div></aside>')

contact=pagehero('A conversation is<br>a good place to start.','Tell us about the project, the question or the technology decision ahead. We’ll help you find a practical next step.','','Contact')
contact+='<section><div class="wrap form-layout"><div class="form-box"><h2>Send us a message</h2><p>Fields marked * are required. Please leave out passwords, payment details and confidential documents.</p>'
contact+=f'<form id="contact-form" action="https://formsubmit.co/{COMPANY["email"]}" method="POST"><input type="hidden" name="_subject" value="Lutera | New contact enquiry"><input type="hidden" name="_template" value="table"><input type="hidden" name="_next" value="{FORM_ORIGIN+BASE}thank-you/"><div class="honey" aria-hidden="true"><label for="contact-website">Leave empty</label><input id="contact-website" name="_honey" tabindex="-1" autocomplete="off"></div><div class="form-grid">'
contact+=field('name','Your name',required=True,attrs='maxlength="120" autocomplete="name"')+field('organization','Organisation',attrs='maxlength="160" autocomplete="organization"')+field('email','Email address','email',True,'maxlength="254" autocomplete="email"')
contact+=f'<div class="field full"><label for="message">Your message *</label><textarea id="message" name="message" required minlength="10" maxlength="5000"></textarea></div><div class="field full"><label class="check"><input type="checkbox" name="privacy_acknowledged" required><span>I have read the <a href="{url("privacy")}">privacy notice</a>. *</span></label></div><div class="field full"><button class="btn" type="submit">Send message ↗</button><p id="contact-status" role="status"></p></div></div></form></div>'+contactside()+'</div></section>'
pages['contact']=('Contact',contact)

DETAILS={
 'it-procurement':('Equipment sourcing.<br>A clear specification.','Bring the specification, quantity, location and timing. We help turn your brief into suitable equipment options and an agreed supply plan.','Source with the details in view.', ['Procurement, importation and exportation of computer hardware and peripherals','Wholesale, retail and bulk supply against an agreed specification','Pre-shipment inspection and supply documentation','Staged delivery and installation planning where agreed']),
 'hardware':('The right equipment.<br>For the work ahead.','Explore business computers, infrastructure and everyday essentials, selected around your workloads and working environment.','Start with what it needs to do.', ['Business laptops, desktops and all-in-one computers','Servers, storage and networking equipment','Printers, peripherals and workplace accessories','Model, compatibility, warranty and supply requirements']),
 'consulting':('Clear advice.<br>Better technology decisions.','Discuss the priorities, constraints and requirements behind your next equipment, software or systems decision.','Ask the useful questions first.', ['Technology planning and requirements discovery','AI, software, data and cloud implementation advice','Equipment specifications and procurement planning','Compatibility, systems integration and project scoping']),
 'technical-support':('Installed, commissioned<br>and supported.','From individual computers to a complete computer lab, plan the installation and support that makes the equipment useful.','The deliverable is a working setup.', ['Computer-lab seat and furniture layout, power and network planning','Computer installation, operating-system imaging and software loading','Structured cabling, asset tagging and a machine register','Seat-by-seat testing, commissioning and handover','Maintenance, troubleshooting and a named support contact']),
}
for service in [s for s in SERVICES if s['slug'] in DETAILS]:
    headline,description,heading,items=DETAILS[service['slug']]
    quote=f'<a class="btn" href="{BASE}request-quote/?category={service["key"]}">Discuss your requirements ↗</a>'
    body=pagehero(headline,description,'',service['title'])
    body+='<section><div class="wrap split"><div><h2>'+heading+'</h2><p>'+service['description']+'</p><ul class="ticks">'+''.join('<li>'+item+'</li>' for item in items)+'</ul>'+quote+'</div><figure class="service-figure">'+photo(service['image'],service['alt'])+'</figure></div></section>'
    body+='<section class="pale"><div class="wrap"><h2>What to include in your enquiry.</h2><div class="steps">'+''.join('<article class="step"><span>'+number+'</span><h3>'+title+'</h3><p>'+copy+'</p></article>' for number,title,copy in [('01','The context','Describe your users, applications, equipment or existing systems.'),('02','The requirements','Share specifications, quantities, site details or the issue you need to resolve.'),('03','Your priorities','Include the location, preferred timing and an optional budget range.')])+'</div></div></section>'
    if service['key']=='support':
        body+='<section><div class="wrap support-terms"><h2>Support that stays clear.</h2><div class="commitment-grid"><article><h3>A named contact</h3><p>One named support contact for your site, with maintenance and on-site arrangements agreed in writing.</p></article><article><h3>Locally held spare parts</h3><p>Support for the equipment we supply, including locally held spares and the agreed parts provision.</p></article><article><h3>Warranty from acceptance</h3><p>The parts warranty starts at site acceptance. The written quotation confirms its duration, coverage and exclusions.</p></article></div><p class="form-footnote">We reply to enquiries within two working days. Fault resolution times and any service-level commitments are agreed separately.</p></div></section>'
    pages['services/'+service['slug']]=(service['title'],body+cta())

legal=json.loads((ROOT/'content/legal.json').read_text().replace('{{hosting_provider}}', HOSTING_PROVIDER))
for route,(title,subtitle,parts) in legal.items():
    if route in ['privacy','cookies']:parts.append(('Your cookie preferences',STORAGE_NOTICE))
    pages[route]=(title,pagehero(title,subtitle,'',title)+'<section><div class="wrap legal">'+''.join('<h2>'+heading+'</h2><p>'+copy+'</p>' for heading,copy in parts)+'</div></section>')
pages['thank-you']=('Enquiry submitted',pagehero('Thank you for<br>starting the conversation.','If you completed the form service’s verification, your enquiry has been submitted for processing. We reply within two working days.','','Thank you')+'<section><div class="wrap split"><div><h2>Your next step.</h2><p>An enquiry does not place an order. If you need to follow up or did not finish the form service’s check, contact us directly using the details here.</p>'+btn('','Back to home')+'</div>'+contactside()+'</div></section>')
pages['404']=('Page not found',pagehero('A different<br>way forward.','This page could not be found. Explore our services or return to the homepage.','','Page not found')+'<section><div class="wrap">'+btn('','Back to home')+'</div></section>')

pages=enhance(pages,BASE,FORM_ORIGIN,icon,eye,btn,pagehero,cta)
pages['']=(pages[''][0],pages[''][1].replace(cta(),commitments(BASE)+cta()))
pages=add_digital_pages(pages,BASE,pagehero,icon)

# The public pages stay static. New enquiries are persisted by the separate
# private application before a success redirect. This override provides a
# controlled fallback during a backend outage.
if os.environ.get('LUTERA_ENQUIRY_TRANSPORT', 'workspace') == 'workspace':
    for route,(title,body) in list(pages.items()):
        body=re.sub(r'action="https://formsubmit\.co/[^"]+"', 'action="https://workspace.luteratech.com/api/enquiry"', body)
        body=body.replace('If you completed the form service’s verification, your enquiry has been submitted for processing.', 'Your enquiry has been received.')
        body=body.replace('If you need to follow up or did not finish the form service’s check, contact us directly using the details here.', 'If you need to follow up, contact us using the details here.')
        body=body.replace('Both forms send the submitted fields to FormSubmit, which processes them and routes them to info@luteratech.com. FormSubmit is a third-party form service, not a database operated by LUTERA. It may retain submissions or technical logs under its own policy. Review <a href="https://formsubmit.co/privacy.pdf" target="_blank" rel="noopener noreferrer">FormSubmit’s privacy policy</a>. Its spam-prevention checks may use Google reCAPTCHA. Email is processed by Zoho Mail.', 'Enquiries are saved in Lutera’s private business workspace, hosted through Vercel and Supabase. Authorized staff use them to respond to your request. Resend delivers business notifications and emails; replies to our monitored inbox are processed by Zoho Mail.')
        body=body.replace('Enquiries are reviewed through the business email inbox.', 'Enquiries are reviewed by authorized staff in the private business workspace.')
        body=body.replace('No private customer account or RFQ database is operated by this website.', 'Approved customers may separately access explicitly shared documents through the customer portal. Staff access and customer access are separate.')
        body=body.replace('Sending a form takes you to FormSubmit for processing and spam prevention. Its service and Google reCAPTCHA may use cookies or similar technology. Read <a href="https://formsubmit.co/privacy.pdf" target="_blank" rel="noopener noreferrer">FormSubmit’s privacy policy</a> for details.', 'Public forms send your enquiry to Lutera’s private business system. The customer portal uses a secure session cookie after you explicitly sign in; it is not an advertising or analytics cookie.')
        body=re.sub(r'Spam-prevention services may use their own cookies on the submission page\. Last updated: \d{1,2} [A-Za-z]+ \d{4}\.', 'The separately accessed customer portal uses a secure session cookie. Last updated: 28 October 2026.', body)
        pages[route]=(title,body)


def copy_style(markup):
    # Change visible copy only. Existing form IDs and transport field names stay stable.
    parts=re.split(r'(<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>|<[^>]+>)',markup,flags=re.S|re.I)
    replacements=[(r'\bLUTERA TECHNOLOGIES(?: LTD)?\b','Lutera Technology Ltd'),(r'\bLUTERA Technologies\b','Lutera Technology Ltd'),(r'\bLUTERA\b','Lutera'),(r'\borganizations\b','organisations'),(r'\borganization\b','organisation'),(r'\bOrganization\b','Organisation'),(r'\bprioritization\b','prioritisation'),(r'\borganized\b','organised')]
    for i in range(0,len(parts),2):
        for pattern,replacement in replacements:parts[i]=re.sub(pattern,replacement,parts[i])
    return ''.join(parts)

for route,(title,body) in list(pages.items()):
    count = {1:'One',2:'Two',3:'Three',4:'Four',5:'Five',6:'Six',7:'Seven',8:'Eight',9:'Nine',10:'Ten'}.get(len(SERVICES),str(len(SERVICES)))
    body=body.replace('Eight services.',count+' service'+('s' if len(SERVICES)!=1 else '')+'.').replace('all eight services','all our services')
    if route.startswith('services/'):
        body=body.replace('>Home</a><span aria-hidden="true">/</span>','>Home</a><span aria-hidden="true">/</span>'+link('services','Services')+'<span aria-hidden="true">/</span>',1)
    pages[route]=(title,copy_style(body))

def brand(dark=False):
    variant='dark' if dark else 'light'
    return f'<a class="brand" href="{url()}" aria-label="Lutera home"><img class="brand-lockup" src="{BASE}assets/logo/lutera-horizontal-{variant}.svg" width="112" height="32" alt="Lutera"></a>'

footer='<footer data-theme="dark"><div class="wrap"><div class="footer-grid"><div>'+brand(True)+'<p>Hardware, software and intelligent systems.<br>Built around your organisation.</p><p class="footer-company">'+escape(COMPANY['legal_name'])+'</p></div><div><h2>Explore</h2>'+''.join(link(r,label) for r,label in [('about','About Lutera'),('services','Services'),('solutions','Solutions'),('request-quote','Request a quote'),('contact','Contact')])+'</div><div class="footer-services"><h2>Our services</h2>'+''.join(link('services/'+s['slug'],escape(s['title'])) for s in SERVICES)+'</div><div><h2>Let’s connect</h2><a href="mailto:'+COMPANY['email']+'">'+COMPANY['email']+'</a><a href="mailto:'+SUPPORT_EMAIL+'">'+SUPPORT_EMAIL+'</a><a href="'+COMPANY['whatsapp']+'" target="_blank" rel="noopener noreferrer">WhatsApp '+WHATSAPP_DISPLAY_PHONE+'</a><a href="tel:'+COMPANY['phone']+'">'+COMPANY['display_phone']+'</a>'+address_block()+'</div></div><div class="footer-bottom"><span>© 2026 '+escape(COMPANY['legal_name'])+'</span><div>'+link('privacy','Privacy')+link('terms','Terms')+link('cookies','Cookies')+'<button class="cookie-settings" type="button" data-cookie-settings aria-controls="cookie-consent" hidden>Cookie settings</button></div></div></div></footer>'
footer=footer.replace(address_block(),address_block()+''.join('<a href="'+escape(s['url'],quote=True)+'" target="_blank" rel="noopener noreferrer">'+escape(s['label'])+'</a>' for s in SITE.get('socials',[])))
def responsive_photos(markup):
    def optimise(match):
        tag=match.group()
        photo=re.search(r'assets/photos/([a-z-]+)\.jpg',tag)
        if not photo:return tag
        stem=photo.group(1)
        sizes='(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 80px) / 2), (max-width: 1199px) calc((100vw - 112px) / 2), 544px'
        if 'card-photo' in tag:
            sizes='(max-width: 639px) calc(100vw - 34px), (max-width: 1023px) calc((100vw - 72px) / 2), (max-width: 1199px) calc((100vw - 116px) / 3), 361px'
        elif 'digital-photo' in tag:
            sizes='(max-width: 639px) calc(100vw - 34px), (max-width: 1023px) calc((100vw - 72px) / 2), (max-width: 1199px) calc((100vw - 92px) / 2), 554px'
        elif 'data-explorer-photo' in tag:
            sizes='(max-width: 639px) calc(100vw - 82px), (max-width: 1023px) 40vw, (max-width: 1199px) 60vw, 684px'
        variants=', '.join(f'{BASE}assets/photos/{stem}-{width}.webp {width}w' for width in [480,768,960])
        return tag.replace(stem+'.jpg',stem+'-960.webp').replace('<img ',f'<img srcset="{variants}" sizes="{sizes}" ',1)
    return re.sub(r'<img\b[^>]*>',optimise,markup)

arrow='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18 18 6M6 6h12v12"/></svg>'
styles='\n'.join((ROOT/'assets'/name).read_text() for name in ['style.css','experience.css','consent.css'])
stylesheet='site-'+sha256(styles.encode()).hexdigest()[:16]+'.css'
(ROOT/'assets'/stylesheet).write_text(styles)
script_revisions={name:sha256((ROOT/'assets'/f'{name}.js').read_bytes()).hexdigest()[:12] for name in ['consent','app','experience','motion']}
for route,(page_title,body) in pages.items():
    title,description=metadata(route)
    canonical=ORIGIN+BASE+'404.html' if route=='404' else ORIGIN+url(route)
    organization={'@context':'https://schema.org','@type':'Organization','name':COMPANY['name'],'legalName':COMPANY['legal_name'],'url':ORIGIN+BASE,'description':NATURE_OF_BUSINESS,'email':COMPANY['email'],'telephone':COMPANY['phone'],'address':{'@type':'PostalAddress','streetAddress':STREET_ADDRESS,'addressLocality':CITY,'addressRegion':STATE,'addressCountry':COMPANY['country']}}
    organization['contactPoint']=[{'@type':'ContactPoint','contactType':'sales','email':COMPANY['email'],'telephone':COMPANY['phone']},{'@type':'ContactPoint','contactType':'customer support','email':SUPPORT_EMAIL,**({'telephone':WHATSAPP_PHONE} if WHATSAPP_PHONE else {})}]
    structured=schema(route,title,description,organization,ORIGIN,BASE)
    robots='noindex,follow' if NOINDEX or route in ['404','thank-you'] else 'index,follow,max-image-preview:large'
    verification=''.join(f'<meta name="{name}" content="{escape(os.environ[key],quote=True)}">' for key,name in [('GOOGLE_SITE_VERIFICATION','google-site-verification'),('BING_SITE_VERIFICATION','msvalidate.01')] if os.environ.get(key))
    nav=''.join(f'<a href="{url(r)}"'+(' aria-current="page"' if route==r or (r=='services' and route.startswith('services/')) else '')+'>'+label+'</a>' for r,label in [('about','About'),('services','Services'),('solutions','Solutions'),('contact','Contact')])
    nav+='<button class="enquiry-nav" type="button" data-open-enquiry aria-label="View enquiry list">Enquiry <span data-enquiry-count>0</span></button>'+btn('request-quote','Request a quote','light')
    accent_preload = f'<link rel="preload" href="{BASE}assets/fonts/PlayfairDisplay-Italic-500.woff2" as="font" type="font/woff2" crossorigin>' if route=='' else ''
    head=f'''<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{escape(title)}</title><meta name="description" content="{escape(description,quote=True)}"><meta name="robots" content="{robots}">{verification}<meta name="theme-color" content="#F3F2EE">{structured}<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{escape(title,quote=True)}"><meta property="og:description" content="{escape(description,quote=True)}"><meta property="og:type" content="website"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{ORIGIN+BASE}assets/social.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Lutera — hardware, software and intelligent systems"><meta property="og:site_name" content="{escape(COMPANY['name'],quote=True)}"><meta property="og:locale" content="en_NG"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{escape(title,quote=True)}"><meta name="twitter:description" content="{escape(description,quote=True)}"><meta name="twitter:image" content="{ORIGIN+BASE}assets/social.png">
<link rel="icon" href="{BASE}assets/logo/lutera-favicon.svg?v={REV}" type="image/svg+xml"><link rel="preload" href="{BASE}assets/fonts/Sora-400.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="{BASE}assets/fonts/Sora-500.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="{BASE}assets/fonts/Sora-600.woff2" as="font" type="font/woff2" crossorigin>{accent_preload}<link rel="stylesheet" href="{BASE}assets/{stylesheet}"><script src="{BASE}assets/consent.js?v={script_revisions["consent"]}" defer></script><script src="{BASE}assets/app.js?v={script_revisions["app"]}" defer></script><script src="{BASE}assets/experience.js?v={script_revisions["experience"]}" defer></script><script src="{BASE}assets/motion.js?v={script_revisions["motion"]}" defer></script><noscript><style>.enquiry-nav,[data-open-enquiry],.menu{{display:none!important}}@media(max-width:1023px){{header .nav{{height:auto;flex-wrap:wrap;padding-top:20px;padding-bottom:20px}}#navigation{{display:flex;position:static;width:100%;max-height:none;flex-wrap:wrap;padding:16px 0 0;border:0;box-shadow:none}}#navigation>a:not(.btn){{padding:8px}}}}</style></noscript>'''
    doc='<!DOCTYPE html><html lang="en-NG"><head>'+head+'</head><body data-page="'+route+'"><a href="#main" class="skip">Skip to content</a><header><div class="wrap nav">'+brand()+'<button class="menu" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="navigation"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><nav id="navigation" class="links" aria-label="Main navigation">'+nav+'</nav></div></header><main id="main" tabindex="-1">'+body+'</main>'+footer+chrome(BASE)+consent_notice(BASE)+'</body></html>'
    doc=doc.replace('info@luteratech.com',escape(COMPANY['email'],quote=True))
    destination=ROOT/('404.html' if route=='404' else route+'/index.html' if route else 'index.html')
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(responsive_photos(doc.replace('↗',arrow).replace('<br>','<br> ')))
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+ORIGIN+url(r)+'</loc></url>' for r in pages if not NOINDEX and r not in ['404','thank-you'])+'</urlset>')
(ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\n'+('' if NOINDEX else 'Sitemap: '+ORIGIN+BASE+'sitemap.xml\n'))
print(f'Built {len(pages)} public pages at {ORIGIN+BASE}')
