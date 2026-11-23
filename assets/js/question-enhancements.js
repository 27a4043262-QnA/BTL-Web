"use strict";
document.addEventListener("DOMContentLoaded",function(){
  const form=document.getElementById("question-form"),field=document.getElementById("question-content");
  const count=document.getElementById("question-count"),api=window.EduTrackData,ui=window.EduTrackUI;
  if(!form||!field||!api||!ui)return;
  const courseId=new URLSearchParams(location.search).get("id")||"MAT15A";
  let busy=false;
  field.addEventListener("input",()=>{if(count)count.textContent=`${field.value.length}/500 ký tự`;});
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(busy)return;
    const text=field.value.trim();
    if(text.length<10||text.length>500){ui.showNotice("Câu hỏi phải có từ 10 đến 500 ký tự.","error","Nội dung chưa hợp lệ");return;}
    busy=true;const button=form.querySelector('[type="submit"]');button.disabled=true;
    try {
      if(!await ui.ensureSignedIn('câu hỏi'))return;
      await api.createQuestion(courseId,text);
      form.reset();if(count)count.textContent="0/500 ký tự";
      ui.closeBootstrap("questionModal");ui.showNotice("Câu hỏi đã được gửi vào hệ thống và đang chờ cố vấn phản hồi.");
    }catch(e){ui.showNotice(e.message,"error");}
    finally{busy=false;button.disabled=false;}
  });
});
