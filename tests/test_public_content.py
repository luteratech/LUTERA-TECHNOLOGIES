"""Exercise changing the service catalogue without touching the working tree."""
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from public_content import validate
root=Path(__file__).resolve().parents[1]
site=json.loads((root/'content/site.json').read_text())
validate(site)
for patch in [{'staff':[{'name':'Private'}]}, {'socials':[{'label':'Bad','url':'javascript:alert(1)'}]}, {'services':[site['services'][0],site['services'][0]]}]:
 try:validate(dict(site,**patch))
 except ValueError:pass
 else:raise AssertionError('Unsafe or invalid content accepted')
with tempfile.TemporaryDirectory(prefix='lutera-cms-test-') as tmp:
 stage=Path(tmp)
 for folder in ['scripts','assets','content']:shutil.copytree(root/folder,stage/folder)
 shutil.copy2(root/'indexnow.txt',stage/'indexnow.txt')
 custom=copy.deepcopy(site)
 custom['company']['email']='fixture@example.invalid'
 custom['company']['whatsapp']='https://wa.me/2348012345678'
 custom['company']['display_phone']='+234 801 234 5678'
 custom['services']=[{**custom['services'][4],'slug':'new-ai-service','title':'AI & workflow <review>'},{**custom['services'][0],'key':'new-service','slug':'new-service','title':'Custom service','description':'New safely escaped service.','detail':{'heading':'A clear <brief>','body':'Plain text <script>alert(1)</script>','points':['One useful point.']}}]
 custom['socials']=[{'label':'Company profile','url':'https://example.com/company?view=lutera&source=website'}]
 custom['services'].append({**site['services'][1],'archived':True})
 validate(custom)
 (stage/'content/site.json').write_text(json.dumps(custom))
 subprocess.run([sys.executable,str(stage/'scripts/build_vercel.py')],cwd=stage,env=dict(os.environ,LUTERA_CONTENT_SOURCE='repository'),check=True)
 output=stage/'_site'
 assert len(list(output.rglob('*.html')))==14
 assert (output/'services/new-service/index.html').exists()
 assert (output/('services/'+site['services'][1]['slug']+'/index.html')).exists()
 archived=(output/('services/'+site['services'][1]['slug']+'/index.html')).read_text()
 assert 'archived' in archived.lower() and 'Explore current services' in archived
 assert (output/'services/new-ai-service/index.html').exists()
 assert not (output/'services/it-procurement/index.html').exists()
 home=(output/'index.html').read_text()
 assert 'Two services.' in home and 'AI &amp; workflow &lt;review&gt;' in home
 assert 'Company profile' in home and 'view=lutera&amp;source=website' in home
 quote=(output/'request-quote/index.html').read_text()
 assert 'https://workspace.luteratech.com/api/enquiry' in quote and 'fixture@example.invalid' in quote
 assert 'https://wa.me/2348012345678' in quote
 assert '<option value="new-service">Custom service</option>' in quote
 detail=(output/'services/new-service/index.html').read_text()
 assert '&lt;script&gt;alert(1)&lt;/script&gt;' in detail
 assert '<script>alert(1)</script>' not in detail
 assert not (output/'apps').exists() and not (output/'content').exists()
 print('PASS: add/remove/rename/reorder services, escaped custom pages/social links, shared contact/form destinations, dynamic sitemap and public-only packaging.')
