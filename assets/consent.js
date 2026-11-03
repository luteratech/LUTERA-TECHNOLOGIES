'use strict';
(() => {
 const panel=document.querySelector('#cookie-consent');
 if(!panel)return;
 const settings=[...document.querySelectorAll('[data-cookie-settings]')];
 const current=panel.querySelector('#cookie-current');
 const feedback=document.querySelector('#cookie-feedback');
 const key='lutera_storage_notice_session_v3',version=3;
 const site=new URL('../',document.currentScript.src);
 // A fresh entry asks again, including returning from another website or
 // entering the address directly. Internal navigation and reloads keep the
 // current tab's choice. Do not reuse the former 180-day preference.
 try{localStorage.removeItem('lutera_cookie_consent_v1');sessionStorage.removeItem('lutera_cookie_consent_session_v2')}catch{}
 const navigation=performance.getEntriesByType('navigation')[0]?.type||'navigate';
 let internalReferrer=false;
 try{const referrer=new URL(document.referrer);internalReferrer=referrer.origin===site.origin&&referrer.pathname.startsWith(site.pathname)}catch{}
 if(navigation==='navigate'&&!internalReferrer){try{sessionStorage.removeItem(key)}catch{}}
 let choice=null,returnFocus=null,feedbackTimer;
 function read(){
  try{
   const value=JSON.parse(sessionStorage.getItem(key));
   const now=Date.now();
   if(value?.version===version&&value.choice==='acknowledged'&&
      Number.isFinite(value.chosenAt)&&value.chosenAt<=now)return value;
  }catch{}
  return null;
 }
 function show(trigger){
  clearTimeout(feedbackTimer);feedback.textContent='';
  returnFocus=trigger||null;
  current.hidden=!choice;
  current.textContent=choice?`You have acknowledged this notice for the current visit. No optional tracking is installed.`:'';
  panel.hidden=false;
  // Do not interrupt a first-time visitor's focus. Explicit settings requests
  // move focus to the controls; this non-modal notice leaves navigation usable.
  if(trigger)panel.querySelector('[data-cookie-choice]').focus({preventScroll:true});
 }
 function hide(){
  const focused=panel.contains(document.activeElement);
  panel.hidden=true;
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  else if(focused)settings[0]?.focus({preventScroll:true});
  returnFocus=null;
 }
 for(const button of settings){
  button.hidden=false;
  button.addEventListener('click',()=>show(button));
 }
 panel.addEventListener('click',event=>{
  const button=event.target.closest('[data-cookie-choice]');
  if(!button)return;
  const chosenAt=Date.now();
  choice={version,choice:button.dataset.cookieChoice,chosenAt};
  let saved=true;
  try{sessionStorage.setItem(key,JSON.stringify(choice))}catch{saved=false}
  hide();
  feedback.textContent='Storage notice acknowledged. No optional tracking is installed.'+
   (saved?' Reopen this notice in Cookie settings.':' Browser storage is blocked, so the notice may return on the next page.');
  clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{feedback.textContent=''},6000);
 });
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&choice){event.preventDefault();hide()}
 });
 window.addEventListener('storage',event=>{
  if(event.storageArea!==sessionStorage)return;
  if(event.key!==key&&event.key!==null)return;
  choice=read();
  if(choice)hide();else show();
 });
 choice=read();
 if(!choice)show();
})();
