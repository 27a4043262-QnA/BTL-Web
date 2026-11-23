"use strict";
function initializeCourseReviews(){
  const form=document.getElementById("course-review-form"),input=document.getElementById("review-content");
  const list=document.getElementById("review-list"),count=document.getElementById("review-count");
  const empty=document.getElementById("detail-review-empty"),prev=document.getElementById("review-prev"),next=document.getElementById("review-next");
  const api=window.EduTrackData, ui=window.EduTrackUI;
  if(!form||!input||!list||!prev||!next||!api||!ui)return;
  if(form.dataset.etInitialized === 'true')return;
  // Trang danh mục cũ truyền ?code=, các liên kết mới có thể dùng ?id=.
  const params = new URLSearchParams(location.search);
  const courseId = params.get("code") || params.get("id");
  if(!courseId || !/^[A-Za-z0-9_-]{1,40}$/.test(courseId)) {
    console.error("EduTrack: Không tìm thấy mã môn học hợp lệ trong URL.");
    return;
  }
  form.dataset.etInitialized = 'true';
  let reviews=[],page=0,userId=null,busy=false;
  const PAGE=3;
  const authorName=value=>String(value||"Người học").trim();
  function initials(value){return authorName(value).split(/\s+/).slice(-2).map(s=>s.charAt(0).toUpperCase()).join("");}
  function render(){
    if(!list.isConnected)return;
    list.replaceChildren();
    const pages=Math.max(1,Math.ceil(reviews.length/PAGE));
    page=Math.max(0,Math.min(page,pages-1));
    const subset=reviews.slice(page*PAGE,(page+1)*PAGE);
    subset.forEach(r=>{
      const article=document.createElement("article");article.className="et-review-card";
      const header=document.createElement("div");header.className="review-author";
      const avatar=document.createElement("span");avatar.className="avatar";avatar.textContent=initials(r.authorName);
      const heading=document.createElement("h3");heading.textContent=authorName(r.authorName);
      header.append(avatar,heading);
      const text=document.createElement("p");text.className="review-text";text.textContent=r.content;
      const footer=document.createElement("div");footer.className="et-review-footer";
      const date=document.createElement("time");date.dateTime=r.createdAt;
      const parsed=new Date(r.createdAt);date.textContent=Number.isNaN(parsed.getTime())?"":parsed.toLocaleDateString("vi-VN");
      footer.append(date);
      if(userId&&r.userId===userId){
        const del=document.createElement("button");del.type="button";del.className="et-review-delete";
        del.textContent="Xóa";del.setAttribute("aria-label","Xóa nhận xét của bạn");
        del.addEventListener("click",async()=>{
          if(!window.confirm("Bạn có chắc muốn xóa nhận xét này?"))return;
          del.disabled=true;
          try{await api.deleteReview(r.id);await refresh();ui.showNotice("Đã xóa nhận xét của bạn.");}
          catch(e){ui.showNotice(e.message,"error");del.disabled=false;}
        });footer.append(del);
      }
      article.append(header,text,footer);list.append(article);
    });
    if(empty)empty.hidden=reviews.length>0;
    prev.disabled=page===0;next.disabled=(page+1)*PAGE>=reviews.length;
    // Không hiển thị nút rỗng nếu không có trang kế tiếp.
    prev.setAttribute("aria-label",`Nhận xét trước, trang ${page+1}/${pages}`);
    next.setAttribute("aria-label",`Nhận xét tiếp theo, trang ${page+1}/${pages}`);
  }
  async function refresh(){
    if(!api.isCloudConfigured()){
      reviews=[];render();
      if(empty){empty.hidden=false;empty.textContent="Chưa có nhận xét nào cho môn học này.";}
      return;
    }
    try {const u=await api.getCurrentUser();userId=u?.id||null;reviews=await api.getReviews(courseId);if(!form.isConnected)return;render();}
    catch(e){ui.showNotice(`Không tải được nhận xét: ${e.message}`,"error");}
  }
  prev.addEventListener("click",()=>{if(page>0){page--;render();}});
  next.addEventListener("click",()=>{if((page+1)*PAGE<reviews.length){page++;render();}});
  input.addEventListener("input",()=>{if(count)count.textContent=`${input.value.length}/500 ký tự`;});
  const writeButton=document.querySelector('[data-target="#reviewModal"]');
  writeButton?.removeAttribute("data-toggle");writeButton?.removeAttribute("data-target");
  writeButton?.addEventListener("click",async()=>{
    try {if(await ui.ensureSignedIn())window.jQuery?.("#reviewModal").modal("show");}
    catch(e){ui.showNotice(e.message,"error");}
  });
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(busy)return;
    const text=input.value.trim();
    if(text.length<10||text.length>500){ui.showNotice("Nhận xét phải có từ 10 đến 500 ký tự.","error","Nội dung chưa hợp lệ");input.focus();return;}
    busy=true;const button=form.querySelector('[type="submit"]');button.disabled=true;
    try {
      if(!await ui.ensureSignedIn())return;
      await api.createReview(courseId,text);
      form.reset();if(count)count.textContent="0/500 ký tự";
      page=0;await refresh();ui.closeBootstrap("reviewModal");
      ui.showNotice("Nhận xét của bạn đã được đăng.");
    } catch(e){ui.showNotice(e.message,"error");}
    finally{busy=false;button.disabled=false;}
  });
  refresh();
 }
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCourseReviews, {once: true});
} else {
  initializeCourseReviews();
}
document.addEventListener('edutrack:page-loaded', initializeCourseReviews);
