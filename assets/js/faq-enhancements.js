"use strict";
document.addEventListener("DOMContentLoaded",function(){
  const faq=document.getElementById("faq"),toggle=document.getElementById("toggle-faq");
  if(!faq||!toggle)return;
  let expanded=false;
  function refresh(){
    const items=[...faq.querySelectorAll(":scope > .faq-item")];
    items.forEach((el,i)=>{el.hidden=!expanded&&i>=3;});
    toggle.hidden=items.length<=3;
    toggle.textContent=expanded?"Thu gọn":"Xem thêm";
    toggle.setAttribute("aria-expanded",String(expanded));
  }
  toggle.addEventListener("click",()=>{expanded=!expanded;refresh();});
  window.updateCourseFAQ=refresh;
  refresh();
});
