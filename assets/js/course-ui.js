"use strict";
/* Thông báo chung của riêng course-detail; không can thiệp trang đăng nhập nhóm. */
(() => {
  let timer=null;
  let focusBefore=null;
  const $=id=>document.getElementById(id);
  function closeNotice(){
    const box=$('et-notice');if(!box||box.hidden)return;
    clearTimeout(timer);timer=null;box.hidden=true;
    if(focusBefore?.isConnected)focusBefore.focus();
  }
  function showNotice(message,kind='success',title,options={}){
    const box=$('et-notice');if(!box)return;
    clearTimeout(timer);timer=null;
    focusBefore=document.activeElement;
    box.dataset.kind=kind;
    $('et-notice-title').textContent=title||(kind==='error'?'Chưa thể thực hiện':'Thành công');
    $('et-notice-message').textContent=message||'';
    const symbol=box.querySelector('.et-notice-symbol');symbol.textContent=kind==='error'?'!':'✓';
    const actions=$('et-notice-actions');actions.hidden=!options.login;
    box.hidden=false;
    box.querySelector('.et-notice-close')?.focus();
    timer=setTimeout(closeNotice,5000);
  }
  function requestLogin(reason='nhận xét'){
    const message=reason==='câu hỏi'?'Vui lòng đăng nhập để đặt câu hỏi!':'Vui lòng đăng nhập để nhận xét!';
    showNotice('', 'error',message,{login:true});
  }
  function closeBootstrap(id){if(window.jQuery?.fn?.modal)window.jQuery(`#${id}`).modal('hide');}
  async function ensureSignedIn(reason='nhận xét'){
    // Trạng thái xác thực thật phải do Supabase Auth xác nhận; không tin localStorage của trình duyệt.
    if(!window.EduTrackData?.isCloudConfigured()){requestLogin(reason);return false;}
    try {
      const user=await window.EduTrackData.getCurrentUser();
      if(!user||!String(user.user_metadata?.full_name||'').trim()){requestLogin(reason);return false;}
      return true;
    }catch(e){showNotice('Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.','error');return false;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const notice=$('et-notice');
    notice?.querySelector('.et-notice-close')?.addEventListener('click',closeNotice);
    notice?.querySelector('.et-notice-cancel')?.addEventListener('click',closeNotice);
    notice?.addEventListener('click',event=>{if(event.target===notice)closeNotice();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!notice?.hidden){event.preventDefault();closeNotice();}});
  });
  window.EduTrackUI=Object.freeze({showNotice,closeNotice,requestLogin,ensureSignedIn,closeBootstrap});
})();
