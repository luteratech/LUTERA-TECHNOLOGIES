"""Generate Lutera Supabase auth templates and a non-secret Management API payload."""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent
ORIGIN = 'https://workspace.luteratech.com'
COMPANY = 'Lutera Technology Ltd'
LOGO = 'https://luteratech.com/assets/logo/lutera-email-logo.png'
# name, heading, body, action, Supabase verification type
AUTH = [
 ('confirmation','Confirm your email','Confirm your email address to continue to the private Lutera workspace. Account access is limited to approved staff.','Confirm email','email'),
 ('invite','Welcome to Lutera','You have been invited to the Lutera private business workspace. Choose your own password, then set up your authenticator to protect your account.','Accept invitation','invite'),
 ('recovery','Recover your Lutera account','A password reset was requested for your account. Continue to verify your authenticator, then choose a new password in My account. Your existing authenticator remains required.','Continue recovery','recovery'),
 ('magic_link','Your secure sign-in link','Use this one-time link to continue to the private workspace. You will still need to complete authenticator verification.','Continue to workspace','magiclink'),
 ('email_change','Confirm your email change','Confirm the requested change to {{ .NewEmail }}. You may need to confirm this change in both mailboxes. The company owner must also approve your new email for workspace access.','Confirm email change','email_change'),
 ('reauthentication','Your verification code','Use this one-time code to confirm the account action you requested. Never share it with another person.','',None),
]
NOTICES = [
 ('password_changed','Your password was changed','The password for your Lutera workspace account was changed. If you did not make this change, contact the company owner immediately.'),
 ('email_changed','Your email address was changed','The email address for your workspace account was changed from {{ .OldEmail }} to {{ .Email }}. If you did not make this change, contact the company owner immediately.'),
 ('phone_changed','Your phone number was changed','The phone number for your account was changed from {{ .OldPhone }} to {{ .Phone }}. If you did not make this change, contact the company owner immediately.'),
 ('identity_linked','A sign-in method was added','A {{ .Provider }} sign-in method was added to your account. If you did not make this change, contact the company owner immediately.'),
 ('identity_unlinked','A sign-in method was removed','A {{ .Provider }} sign-in method was removed from your account. If you did not make this change, contact the company owner immediately.'),
 ('mfa_factor_enrolled','A verification method was added','A {{ .FactorType }} verification method was added to your account. If you did not make this change, contact the company owner immediately.'),
 ('mfa_factor_unenrolled','A verification method was removed','A {{ .FactorType }} verification method was removed from your account. If you did not make this change, contact the company owner immediately.'),
]

def email(title, body, action='', kind=None, otp=False, notification=False):
    link = ORIGIN + '/auth/confirm?token_hash={{ .TokenHash }}&amp;type=' + kind if kind else ''
    button = f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#3456FF" style="border-radius:8px"><a href="{link}" style="display:inline-block;padding:15px 24px;font-size:16px;font-weight:bold;text-decoration:none;color:#FFFFFF">{html.escape(action)}</a></td></tr></table><p style="font-size:13px;line-height:1.7;color:#525B75;word-break:break-all">If the button does not open, copy this link into your browser:<br /><a href="{link}" style="color:#2340D0">{link}</a></p>''' if kind else ''
    if otp: button='<p style="font-family:Consolas,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px;background:#EEF0FF;color:#151936;text-align:center">{{ .Token }}</p>'
    safety = 'If you did not request this, do not use the link or code. Contact the company owner if you need help.' if not notification else 'For your security, never share your password, authenticator code or recovery link.'
    return f'''<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>{html.escape(title)} | {COMPANY}</title></head>
<body style="margin:0;padding:0;background:#F3F2EE;color:#151936;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{html.escape(title)} — a secure account message from Lutera.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F3F2EE"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #D7DAE4;border-radius:12px;overflow:hidden">
<tr><td bgcolor="#151936" style="padding:30px 28px;background:#151936"><a href="https://luteratech.com"><img src="{LOGO}" width="170" height="49" alt="{COMPANY}" style="display:block;border:0;width:170px;max-width:100%;height:auto" /></a><p style="margin:14px 0 0;color:#FFFFFF;font-size:14px">{COMPANY}</p></td></tr>
<tr><td style="padding:32px 28px"><p style="margin:0 0 12px;color:#525B75;font-size:12px;letter-spacing:2px;text-transform:uppercase">Private business workspace</p>
<h1 style="margin:0 0 20px;font-size:28px;line-height:1.25;letter-spacing:-0.5px;color:#151936">{html.escape(title)}</h1>
<p style="font-size:16px;line-height:1.75;margin:0 0 24px">{body}</p>{button}
<p style="font-size:14px;line-height:1.7;color:#525B75;margin-top:24px">{'This link or code is single-use and expires according to the account security settings. ' if not notification else ''}{safety}</p>
<p style="font-size:16px;line-height:1.7;margin:24px 0 0">The Lutera team<br /><span style="color:#525B75;font-size:14px">Supply. Build. Connect.</span></p></td></tr>
<tr><td style="padding:24px 28px;border-top:1px solid #D7DAE4;background:#FAFAF8"><p style="font-size:13px;line-height:1.7;color:#525B75;margin:0"><strong>{COMPANY}</strong><br />No. 7, Mahatma Gandhi Street, Area 11, Garki, Abuja, FCT, Nigeria<br /><a href="https://luteratech.com" style="color:#2340D0">luteratech.com</a> &nbsp;·&nbsp; <a href="mailto:support@luteratech.com" style="color:#2340D0">Contact Lutera</a></p></td></tr>
</table></td></tr></table></body></html>
'''

def generate():
    payload={'site_url':ORIGIN+'/auth/confirm','uri_allow_list':ORIGIN+'/auth/confirm','smtp_sender_name':COMPANY,'disable_signup':True,'mailer_autoconfirm':False,'mailer_secure_email_change_enabled':True,'password_min_length':12}
    manifest=[]
    for name,title,body,action,kind in AUTH:
        subject=f'{COMPANY} | {title}'
        content=email(title,body,action,kind,otp=name=='reauthentication')
        payload[f'mailer_subjects_{name}']=subject
        payload[f'mailer_templates_{name}_content']=content
        (ROOT/'templates'/f'{name}.html').write_text(content)
        manifest.append({'template':name,'subject':subject,'file':f'templates/{name}.html'})
    for name,title,body in NOTICES:
        key=name+'_notification'
        content=email(title,body,notification=True)
        payload[f'mailer_subjects_{key}']=f'{COMPANY} | {title}'
        payload[f'mailer_templates_{key}_content']=content
        payload[f'mailer_notifications_{name}_enabled']=True
        (ROOT/'templates'/f'{key}.html').write_text(content)
        manifest.append({'template':key,'subject':payload[f'mailer_subjects_{key}'],'file':f'templates/{key}.html'})
    (ROOT/'auth-config.json').write_text(json.dumps(payload,indent=2)+'\n')
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Generated 13 branded account email templates and a non-secret configuration payload.')

if __name__=='__main__':generate()
