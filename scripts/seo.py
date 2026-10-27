"""Unique search metadata and structured data for public, crawlable HTML pages."""
import json
from html import escape
from company import SERVICES

PAGE_META={
 '':('Hardware, Software & AI | Lutera Technology Ltd','Abuja-based IT and AI solutions: AI agents, automation, software development, data analytics, cloud integration, hardware supply and technical support.'),
 'about':('About LUTERA Technologies | IT & AI Company in Abuja','Meet LUTERA Technologies in Garki, Abuja. Explore our approach to AI, software, IT consultancy, hardware procurement and technology support.'),
 'services':('IT & AI Services in Abuja | LUTERA Technologies','Explore AI automation, software development, analytics, cloud integration, IT consulting, hardware procurement and maintenance services from LUTERA.'),
 'solutions':('AI, Software & Hardware Solutions | LUTERA Technologies','Find AI, software, cloud and workplace equipment solutions. Explore consulting, hardware supply and technical support for your business in Abuja.'),
 'request-quote':('Request an IT or AI Project Quote | LUTERA Technologies','Describe your AI, software, IT service or equipment requirements. Send LUTERA a project brief with your priorities, quantities and preferred timing.'),
 'contact':('Contact LUTERA Technologies | Garki, Abuja','Contact LUTERA Technologies at No. 7 Mahatma Gandhi Street, Area 11, Garki, Abuja. Send an enquiry by email, WhatsApp or our contact form.'),
 'services/it-procurement':('IT Procurement & Equipment Supply in Abuja | LUTERA','Discuss computer hardware sourcing, importation, exportation, wholesale and retail supply. Request a quotation based on your equipment requirements.'),
 'services/hardware':('Computer Hardware & Equipment in Abuja | LUTERA','Explore business laptops, desktops, servers, networking equipment, printers and accessories. Ask LUTERA about specifications, quantities and supply.'),
 'services/consulting':('IT & Technology Consulting in Abuja | LUTERA','Discuss IT priorities, software and AI planning, cloud integration and equipment specifications with LUTERA Technologies in Abuja.'),
 'services/technical-support':('Computer Labs, Installation & IT Support | Lutera','Plan computer labs, equipment installation, commissioning, maintenance and technical support with Lutera in Abuja.'),
 'services/ai-automation':('AI Agents & Business Automation in Abuja | LUTERA','Explore AI agent development and business process automation with LUTERA. Define workflows, system access, review steps and implementation requirements.'),
 'services/software-development':('Software Development in Abuja | LUTERA Technologies','Discuss custom software design, development and implementation. Plan business applications, workflows and integrations with LUTERA Technologies.'),
 'services/data-analytics':('Data Analytics & Business Reporting in Abuja | LUTERA','Plan data analytics, business reporting and dashboards with LUTERA. Start with the decisions you need to support, your data sources and reporting needs.'),
 'services/cloud-integration':('Cloud Solutions & Systems Integration in Abuja | LUTERA','Explore cloud-based solutions and systems integration. Discuss application connections, migration requirements and compatibility with LUTERA Technologies.'),
 'privacy':('Privacy Notice | LUTERA Technologies','Learn how LUTERA handles contact and quote enquiries, functional equipment-list storage, email processing, privacy questions and data requests.'),
 'terms':('Website & Enquiry Terms | LUTERA Technologies','Read the terms for using the LUTERA website and sending enquiries, including quotation scope, equipment availability and written supply agreements.'),
 'cookies':('Cookies & Browser Storage | LUTERA Technologies','Understand functional session storage, the equipment enquiry list and third-party form processing on the LUTERA Technologies website.'),
 'thank-you':('Enquiry Submitted | LUTERA Technologies','Your enquiry has been received by Lutera. Find direct email and WhatsApp contact details for LUTERA Technologies.'),
 '404':('Page Not Found | LUTERA Technologies','The requested LUTERA page could not be found. Explore our IT, AI and hardware services or return to the homepage.'),
}
SERVICE_NAMES={
 'it-procurement':'IT procurement and equipment supply','hardware':'Computer hardware and equipment',
 'consulting':'Technology and IT consulting','technical-support':'Computer labs, installation, maintenance and technical support',
 'ai-automation':'AI agent development and business process automation','software-development':'Software design, development and implementation',
 'data-analytics':'Data analytics and business reporting','cloud-integration':'Cloud-based solutions and systems integration',
}
SERVICE_NAMES={s['slug']:s['title'] for s in SERVICES}

def metadata(route):
    if route.startswith('services/'):
        service=next(s for s in SERVICES if s['slug']==route.split('/')[1])
        return service['title']+' | Lutera Technology Ltd', service['description']
    title,description=PAGE_META[route]
    for old,new in [('LUTERA Technologies','Lutera Technology Ltd'),('LUTERA technology','Lutera technology'),('LUTERA','Lutera')]:
        title=title.replace(old,new);description=description.replace(old,new)
    return title,description

def schema(route,title,description,organization,origin,base):
    home=origin+base
    canonical=home+('404.html' if route=='404' else route+'/' if route else '')
    organization=dict(organization,**{'@id':home+'#organization','logo':{'@type':'ImageObject','url':home+'assets/logo/lutera-social-logo.png','width':600,'height':172}})
    organization.pop('@context',None)
    organization['hasOfferCatalog']={'@type':'OfferCatalog','name':'Lutera technology services','itemListElement':[
        {'@type':'Offer','itemOffered':{'@type':'Service','name':name,'url':home+'services/'+slug+'/'}}
        for slug,name in SERVICE_NAMES.items()]}
    page_type={'about':'AboutPage','contact':'ContactPage','services':'CollectionPage','solutions':'CollectionPage'}.get(route,'WebPage')
    webpage={'@type':page_type,'@id':canonical+'#webpage','url':canonical,'name':title,'description':description,'inLanguage':'en-NG',
             'isPartOf':{'@id':home+'#website'},'about':{'@id':home+'#organization'}}
    graph=[organization,{'@type':'WebSite','@id':home+'#website','url':home,'name':'Lutera Technology Ltd','inLanguage':'en-NG','publisher':{'@id':home+'#organization'}},webpage]
    if route=='services':
        catalogue={'@type':'ItemList','@id':canonical+'#service-list','name':'Lutera IT and AI services','numberOfItems':len(SERVICES),'itemListElement':[
            {'@type':'ListItem','position':i+1,'item':{'@type':'Service','@id':home+'services/'+service['slug']+'/#service',
             'url':home+'services/'+service['slug']+'/','name':service['title'],'description':service['description'],
             'provider':{'@id':home+'#organization'}}} for i,service in enumerate(SERVICES)]}
        graph.append(catalogue)
        webpage['mainEntity']={'@id':catalogue['@id']}
    if route and route not in ['404','thank-you']:
        crumbs=[('Home',home)]
        if route.startswith('services/'):crumbs.append(('Services',home+'services/'))
        crumbs.append((SERVICE_NAMES.get(route.removeprefix('services/'),title.split(' | ')[0]),canonical))
        graph.append({'@type':'BreadcrumbList','@id':canonical+'#breadcrumb','itemListElement':[
            {'@type':'ListItem','position':i+1,'name':name,'item':url} for i,(name,url) in enumerate(crumbs)]})
        webpage['breadcrumb']={'@id':canonical+'#breadcrumb'}
    if route.startswith('services/'):
        name=SERVICE_NAMES[route.split('/')[1]]
        service={'@type':'Service','@id':canonical+'#service','name':name,'serviceType':name,'description':description,'url':canonical,'provider':{'@id':home+'#organization'}}
        graph.append(service);webpage['mainEntity']={'@id':canonical+'#service'}
    return '<script type="application/ld+json">'+json.dumps({'@context':'https://schema.org','@graph':graph},ensure_ascii=False).replace('<','\\u003c')+'</script>'

DIGITAL_PAGES={
 'ai':('ai-automation','AI agents & automation.\nBuilt around your workflow.',
       'Explore artificial intelligence (AI) solutions, agent development and business process automation with LUTERA Technologies in Abuja.',
       'Start with the task, then define the technology.',
       'An AI project starts with a clear process: what comes in, what decision or action is needed, and who reviews the result. Tell us where repeated work, disconnected information or manual handovers are slowing your team down.',
       ['AI agents for defined business tasks','Business process automation and workflow planning','Connections to existing applications and approved data sources'],
       'Decide what an agent is allowed to do.',
       'We discuss system access, the information an agent needs and the actions that should require human approval. Expected outputs, error handling, evaluation and handover requirements belong in the agreed scope.',
       ['Describe the current workflow and its users','List the systems involved without sharing passwords or confidential records','Identify review steps, acceptable results and implementation priorities']),
 'software':('software-development','Software for the way\nyour business works.',
       'Discuss software design, development and implementation with LUTERA Technologies in Abuja.',
       'Build a clear brief before building an application.',
       'Describe the work your software needs to support, who will use it and the information that moves through the process. A useful brief focuses on the business task and the existing tools before deciding on the implementation.',
       ['Business application and interface design','Custom software development around agreed requirements','Implementation and connections to existing systems'],
       'Plan the whole path from design to use.',
       'Discuss user roles, required screens, integrations, testing and implementation needs. Hosting, migration, documentation and support arrangements are scoped separately so the expected deliverables and responsibilities are clear.',
       ['Explain the problem and the people who will use the software','Share essential functions, integration requirements and existing constraints','Include preferred timing, implementation needs and optional budget guidance']),
 'data':('data-analytics','Make your business data\nmore useful.',
       'Plan data analytics, reporting and dashboards with LUTERA Technologies in Abuja.',
       'Start with the decisions you need to make.',
       'Better reporting begins with a practical question. Tell us which decisions need support, what your current reports are missing and where the relevant information is held. We can discuss an analytics brief around those needs.',
       ['Business data analysis and reporting requirements','Dashboard and operational reporting planning','Data preparation, quality and source-integration requirements'],
       'Connect the figures to their meaning.',
       'Definitions matter: identify the measures, source systems, reporting intervals and people who will use the results. Data access, preparation, validation and how reports are delivered should be agreed as part of the project.',
       ['Describe the business questions and reports you need','List data sources and their formats without uploading sensitive records','Explain users, reporting frequency and any existing reporting tools']),
 'cloud':('cloud-integration','Connect your systems.\nPlan your cloud solution.',
       'Explore cloud-based solutions and systems integration with LUTERA Technologies in Abuja.',
       'Look at the connections as well as the components.',
       'Cloud and integration requirements depend on the applications, people and information already in your organization. Describe the systems you use, what needs to connect and the business outcome you want to achieve.',
       ['Cloud-based application and service requirements','Systems integration and application connections','Migration, compatibility and deployment planning'],
       'Define the responsibilities around the connection.',
       'Discuss authentication, information flows, compatibility and operational requirements before implementation. Hosting subscriptions, migration work, monitoring, maintenance and support commitments are confirmed in the agreed scope.',
       ['List existing applications, infrastructure and required connections','Explain compatibility, access and migration constraints','Include implementation timing and the support arrangements you need']),
}

def add_digital_pages(pages,base,pagehero,icon):
    from company import DIGITAL_SERVICES, DIGITAL_SERVICE_IMAGES, DIGITAL_SERVICE_SLUGS
    for key,label,short in DIGITAL_SERVICES:
        _,headline,intro,heading,copy,items,next_heading,next_copy,brief=DIGITAL_PAGES[key]
        service=next(s for s in SERVICES if s['key']==key)
        slug=service['slug']
        photo,alt=DIGITAL_SERVICE_IMAGES[key]
        alt=escape(alt,quote=True)
        quote=f'<a class="btn" href="{base}request-quote/?category={key}">Discuss your project <span aria-hidden="true">↗</span></a>'
        content=pagehero(headline.replace('\n','<br>'),escape(short),'IT & AI services',escape(label))
        content+=f'<section><div class="wrap split"><div><h2>{heading}</h2><p>{copy}</p><ul class="ticks">'+''.join('<li>'+i+'</li>' for i in items)+f'</ul>{quote}</div><figure class="service-figure"><img src="{base}assets/photos/{photo}.jpg" width="960" height="640" loading="lazy" decoding="async" alt="{alt}"></figure></div></section>'
        content+=f'<section class="pale"><div class="wrap split"><div><h2>{next_heading}</h2><p>{next_copy}</p></div><div><h3>What to include in your enquiry</h3><ul class="ticks">'+''.join('<li>'+i+'</li>' for i in brief)+f'</ul>{quote}<p class="form-footnote">Project deliverables, timing and support terms are confirmed in writing. An online enquiry does not place an order.</p></div></div></section>'
        content+=f'<section><div class="wrap"><h2>Explore related technology services.</h2><div class="related-services">'+''.join(f'<a class="text-link" href="{base}services/{DIGITAL_SERVICE_SLUGS[other]}/">{escape(title)} ↗</a>' for other,title,_ in DIGITAL_SERVICES if other!=key)+'</div></div></section>'
        pages['services/'+slug]=(label,content)
    # Generic and explicitly customised service pages follow the same public contract.
    for service in SERVICES:
        route='services/'+service['slug']
        if route in pages and not service.get('detail'):continue
        detail=service.get('detail',{'heading':service['title'],'body':service['description'],'points':['Tell us about your requirements, location and preferred timing.']})
        body=pagehero(escape(service['title']),escape(service['description']),'',escape(service['title']))
        body+=f'<section><div class="wrap split"><div><h2>{escape(detail["heading"])}</h2><p>'+escape(detail['body']).replace('\n','<br>')+'</p><ul class="ticks">'+''.join('<li>'+escape(point)+'</li>' for point in detail['points'])+f'</ul><a class="btn" href="{base}request-quote/?category={service["key"]}">Discuss your requirements ↗</a></div><figure class="service-figure"><img src="{base}assets/photos/{service["image"]}.jpg" width="960" height="640" loading="lazy" decoding="async" alt="{escape(service["alt"],quote=True)}"></figure></div></section>'
        pages[route]=(service['title'],body)
    return pages
