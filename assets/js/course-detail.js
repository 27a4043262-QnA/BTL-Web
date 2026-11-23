"use strict";
/* Chỉ trang course-detail; tải đúng học liệu của 13 môn do nhóm biên soạn. */
(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const courseId = params.get('id') || 'MAT15A';
  const validId = /^[A-Za-z0-9_-]{1,40}$/.test(courseId);
  const categories = {'dai-cuong':'Đại cương','co-so-nganh':'Cơ sở ngành','chuyen-nganh':'Chuyên ngành'};
  const pdfUrl = value => typeof value === 'string' && /^\.\.\/assets\/materials\/[a-zA-Z0-9_-]+\.pdf$/.test(value) ? value : null;
  const videoUrl = value => typeof value === 'string' && /^\.\.\/assets\/videos\/[a-zA-Z0-9_-]+\.mp4$/.test(value) ? value : null;
  const iconSvg = (name) => {
    const strokes = {
      book:'<path d="M12 7c-2-1.4-5-1.4-9-1v13c4-.4 7-.4 9 1 2-1.4 5-1.4 9-1V6c-4-.4-7-.4-9 1Z"/><path d="M12 7v13"/>',
      edit:'<path d="m15 5 4 4"/><path d="M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/>',
      check:'<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
      play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>',
      download:'<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>',
      doc:'<path d="M6 2h8l5 5v15H6V2Z"/><path d="M14 2v5h5M9 12h7M9 16h7"/>'
    };
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','18');svg.setAttribute('height','18');
    svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.9');
    svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
    // Fixed literals from this file, never user-provided markup.
    svg.innerHTML=strokes[name] || strokes.doc;
    svg.setAttribute('aria-hidden','true');return svg;
  };
  const text=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value||'';return el;};
  const state={opener:null,course:null};
  const viewer=$('et-study-viewer');
  const viewerContent=$('et-study-content');
  const viewerClose=$('et-study-close');
  const viewerDownload=$('et-study-download');
  const viewerTitle=$('et-study-title');
  function positionViewer(){
    const header=document.querySelector('.et-topbar');
    const sidebar=document.querySelector('.et-sidebar');
    let top=header?.getBoundingClientRect().bottom || 60;
    let left=sidebar?.getBoundingClientRect().right || 66;
    if (top<0 || top>180) top=60;
    if (left<0 || left>window.innerWidth*.75) left=66;
    viewer.style.top=`${Math.round(top)}px`;
    viewer.style.left=`${Math.round(left)}px`;
  }
  function closeViewer(){
    if (viewer.hidden)return;
    viewer.hidden=true;
    viewerContent.replaceChildren(); // dừng video, hủy iframe PDF
    document.body.classList.remove('et-study-open');
    if(state.opener?.isConnected) state.opener.focus();
  }
  function openViewer(resource,title,kind,button){
    const url=kind==='video'?videoUrl(resource):pdfUrl(resource);
    if (!url){window.EduTrackUI?.showNotice('Tài liệu này chưa có trong hệ thống.','error','Không tìm thấy tài liệu');return;}
    state.opener=button;viewerTitle.textContent=title;viewerContent.replaceChildren();positionViewer();
    if(kind==='video'){
      const video=document.createElement('video');video.controls=true;video.playsInline=true;
      video.preload='metadata';video.src=url;video.setAttribute('aria-label',title);
      viewerContent.append(video);viewerDownload.hidden=true;viewerDownload.removeAttribute('href');
    } else {
      const frame=document.createElement('iframe');frame.title=title;frame.src=url+'#toolbar=1&navpanes=0';
      frame.setAttribute('allow','fullscreen');viewerContent.append(frame);
      viewerDownload.hidden=false;viewerDownload.href=url;viewerDownload.setAttribute('download','');
    }
    viewer.hidden=false;document.body.classList.add('et-study-open');viewerClose.focus();
  }
  if(viewer){
    viewerClose.addEventListener('click',closeViewer);
    viewer.addEventListener('click',event=>{if(event.target===viewer)closeViewer();});
    document.addEventListener('keydown',event=>{
      if(viewer.hidden)return;
      if(event.key==='Escape'){event.preventDefault();closeViewer();}
      if(event.key==='Tab'){
        const controls=[...viewer.querySelectorAll('a:not([hidden]),button:not([disabled])')].filter(el=>el.offsetParent!==null);
        if(!controls.length)return;
        if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls[controls.length-1].focus();}
        else if(!event.shiftKey&&document.activeElement===controls[controls.length-1]){event.preventDefault();controls[0].focus();}
      }
    });
    window.addEventListener('resize',()=>{if(!viewer.hidden)positionViewer();});
  }
  const actions=[
    ['theoryPdf','Lý thuyết','theory','book'],
    ['exercisePdf','Bài tập','exercise','edit'],
    ['answerPdf','Đáp án','answer','check'],
    ['video','Bài giảng','video','play']
  ];
  function renderChapters(chapters){
    const box=$('detail-chapters-list');box.replaceChildren();
    if(!chapters.length){box.append(text('p','detail-empty','Chưa có bài học.'));return;}
    chapters.forEach((chapter,ci)=>{
      const details=document.createElement('details');details.className='et-chapter';
      const summary=document.createElement('summary');
      summary.append(text('span','et-chapter-index',String(ci+1).padStart(2,'0')));
      const label=text('span','et-chapter-label',`Chương ${ci+1}. ${chapter.title}`);
      const lessons=Array.isArray(chapter.lessons)?chapter.lessons:[];
      label.append(text('span','et-chapter-count',`${lessons.length} bài học`));summary.append(label);details.append(summary);
      const ol=document.createElement('ol');ol.className='et-lesson-list';
      lessons.forEach((lesson,li)=>{
        const row=document.createElement('li');row.className='et-lesson';
        const label=document.createElement('div');label.className='et-lesson-main';
        label.append(text('span','et-lesson-serial',String(li+1)),text('p','et-lesson-name',`Bài ${li+1}. ${lesson.title}`));row.append(label);
        const buttons=document.createElement('div');buttons.className='et-lesson-actions';
        actions.forEach(([key,display,cls,icon])=>{
          const path=key==='video'?lesson.video?.localUrl:lesson[key];
          const good=cls==='video'?videoUrl(path):pdfUrl(path);
          const button=document.createElement('button');button.type='button';button.className=`et-lesson-resource et-action-${cls}`;
          button.append(iconSvg(icon),document.createTextNode(display));button.disabled=!good;
          button.setAttribute('aria-label',`${display} bài ${li+1}: ${lesson.title}`);
          if(good)button.addEventListener('click',()=>openViewer(path,`${display} – Bài ${li+1}. ${lesson.title}` ,cls,button));
          buttons.append(button);
        });row.append(buttons);ol.append(row);
      });details.append(ol);box.append(details);
    });
  }
  function renderReferences(materials){
    const list=$('detail-materials-list');list.replaceChildren();
    if(!materials.length){list.append(text('p','detail-empty','Chưa có tài liệu tham khảo.'));return;}
    materials.forEach(material=>{
      const url=pdfUrl(material.url);if(!url)return;
      const card=document.createElement('article');card.className='et-reference-card';
      const open=document.createElement('button');open.type='button';open.className='et-reference-open';
      open.append(iconSvg('doc'),text('span','et-reference-name',material.name||'Tài liệu tham khảo'));
      open.setAttribute('aria-label',`Xem ${material.name||'tài liệu tham khảo'}`);
      open.addEventListener('click',()=>openViewer(url,material.name||'Tài liệu tham khảo','reference',open));
      const download=document.createElement('a');download.className='et-reference-download';download.href=url;download.download='';
      download.append(iconSvg('download'));download.setAttribute('title','Tải về');
      download.setAttribute('aria-label',`Tải xuống ${material.name||'tài liệu tham khảo'}`);
      card.append(open,download);list.append(card);
    });
  }
  function renderFaq(items){
    const faq=$('faq');faq.querySelectorAll('.faq-item:not([data-admin-answer])').forEach(el=>el.remove());
    const anchor=faq.querySelector('.faq-more-row');
    items.forEach(item=>{
      const detail=document.createElement('details');detail.className='faq-item';
      const summary=text('summary','',item.question||'Câu hỏi');const answer=text('p','',item.answer||'');
      detail.append(summary,answer);faq.insertBefore(detail,anchor);
    });
    $('detail-faq-empty').hidden=items.length>0;
    if(typeof window.updateCourseFAQ==='function')window.updateCourseFAQ();
  }
  function renderRelated(course,all){
    const ul=$('detail-related');ul.replaceChildren();
    const related=(course.related||[]).map(id=>all.find(c=>c.id===id)).filter(Boolean);
    related.forEach(item=>{
      const li=document.createElement('li');li.className='et-related-item';
      const anchor=document.createElement('a');anchor.className='et-related-card';
      anchor.href=`course-detail.html?id=${encodeURIComponent(item.id)}`;
      const media=document.createElement('div');media.className='et-related-media';
      if(typeof item.image==='string' && /^\.\.\/assets\/images\/course\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(item.image)){
        const img=document.createElement('img');img.src=item.image;img.alt=`Ảnh môn ${item.name}`;img.loading='lazy';
        img.addEventListener('error',()=>{img.hidden=true;});media.append(img);
      }
      const info=document.createElement('div');info.className='et-related-info';
      info.append(text('strong','',item.name),text('small','',`${categories[item.category]||item.category} · ${item.credits} tín chỉ`));
      anchor.append(media,info);li.append(anchor);ul.append(li);
    });
  }
  function render(course,all){
    document.title=`${course.name} | EduTrack`;
    $('course-title').textContent=course.name;
    const code=document.querySelector('.course-hero .course-code');if(code)code.textContent=`Mã môn: ${course.id}`;
    const chip=document.querySelector('.course-hero .chip');if(chip)chip.textContent=categories[course.category]||course.category;
    $('detail-description').textContent=course.description||'Chưa có mô tả.';
    const objectives=$('detail-objectives')||document.createElement('section');objectives.id='detail-objectives';
    objectives.setAttribute('aria-label','Mục tiêu học tập');objectives.replaceChildren();
    if(Array.isArray(course.objectives)&&course.objectives.length){
      const h=text('h2','', 'Mục tiêu học tập');const list=document.createElement('ul');
      course.objectives.forEach(item=>list.append(text('li','',item)));objectives.append(h,list);
    }
    if(!objectives.isConnected)$('detail-description').insertAdjacentElement('afterend',objectives);
    const notice=$('detail-content-status');if(notice)notice.hidden=true;
    $('detail-credits').textContent=`${course.credits} tín chỉ`;
    $('detail-code').textContent=course.id;
    $('detail-year').textContent=course.year||'—';
    $('detail-prerequisite').textContent=course.prerequisite||'—';
    $('detail-category').textContent=categories[course.category]||course.category;
    renderChapters(course.chapters||[]);renderReferences(course.materials||[]);
    renderFaq(course.faq||[]);renderRelated(course,all);
    $('course-detail').hidden=false;$('detail-status').hidden=true;
  }
  function status(message){const el=$('detail-status');el.textContent=message;el.hidden=false;el.classList.add('detail-error');}
  async function init(){
    if(!validId)return status('Mã môn không hợp lệ.');
    try {
      const res=await fetch('../assets/data/course-details.json',{cache:'no-store'});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const all=await res.json();if(!Array.isArray(all))throw new Error('Dữ liệu không hợp lệ');
      const course=all.find(c=>c.id===courseId);
      if(!course)return status('Không tìm thấy mã môn này. Hãy kiểm tra liên kết trong danh mục.');
      render(course,all);
    }catch(error){console.error('Không tải được môn học',error);status('Không tải được dữ liệu. Hãy chạy bằng Live Server và kiểm tra file course-details.json.');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
