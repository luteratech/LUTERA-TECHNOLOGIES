"""Shared privacy notice. Optional tracking is not installed on this site."""

def notice(base):
    return f'''<div id="cookie-consent" class="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-title" aria-describedby="cookie-description" hidden>
    <div class="cookie-heading"><span class="cookie-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></svg></span><h2 id="cookie-title">Cookies &amp; your privacy</h2></div>
    <p id="cookie-description">We use essential browser storage to keep your enquiry list during this visit. No optional analytics or advertising cookies are installed. This notice appears again when you enter the site afresh.</p>
    <p id="cookie-current" class="cookie-current" hidden></p>
    <div class="cookie-actions"><button type="button" data-cookie-choice="acknowledged">Got it</button></div>
    <a class="cookie-policy" href="{base}cookies/">Read our cookies policy <span aria-hidden="true">↗</span></a>
    </div><div id="cookie-feedback" class="cookie-feedback" role="status" aria-live="polite" aria-atomic="true"></div>'''

STORAGE_NOTICE = 'The public site uses essential session storage for your equipment enquiry list and to remember that you have seen the storage notice during this visit. No optional analytics or advertising cookies are installed. The notice has an acknowledgement button; it does not request permission for optional tracking. The acknowledgement stores only the notice version, acknowledgement and time under lutera_storage_notice_session_v3. It remains during internal navigation and reloads in the same tab. A fresh entry, a new tab or a return from another website shows the notice again. Closing the tab ends its stored session. Reopen the notice using Cookie settings in the footer. If browser storage is blocked, acknowledgement applies to the current page only. The separately accessed customer portal and staff workspace use secure authentication storage when you sign in.'
