"use strict";
(function () {
  const cfg = window.EDUTRACK_DATA_CONFIG || {};
  const base = (cfg.supabaseUrl || "").replace(/\/+$/, "");
  const key = cfg.supabaseAnonKey || "";
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) && key.length > 20;
  let client = null;
  function getClient() {
    if (!configured) throw new Error("Chưa cấu hình kết nối dữ liệu Supabase.");
    if (!window.supabase?.createClient) throw new Error("Không tải được thư viện đăng nhập Supabase.");
    if (!client) client = window.supabase.createClient(base,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }
  async function getCurrentUser() {
    if (!configured) return null;
    const {data,error} = await getClient().auth.getUser();
    if (error && error.status !== 400) throw error;
    return data?.user || null;
  }
  async function sendLoginLink(email, fullName) {
    const {error} = await getClient().auth.signInWithOtp({ email, options:{
      emailRedirectTo: window.location.href.split('#')[0],
      data:{full_name:fullName}, shouldCreateUser:true
    }});
    if (error) throw error;
  }
  async function updateFullName(fullName) {
    const {error} = await getClient().auth.updateUser({data:{full_name:fullName}});
    if (error) throw error;
  }
  async function requireUser() {
    const user = await getCurrentUser();
    if (!user) throw new Error("Bạn cần đăng nhập trước khi thực hiện.");
    if (!String(user.user_metadata?.full_name||"").trim()) throw new Error("Vui lòng cập nhật họ tên trong tài khoản.");
    return user;
  }
  async function request(table,{method="GET",query="",body,prefer}={}) {
    if (!configured) throw new Error("Cơ sở dữ liệu trực tuyến chưa được cấu hình.");
    const {data:{session},error:sessionError} = await getClient().auth.getSession();
    if (sessionError) throw sessionError;
    const headers = {apikey:key,Authorization:`Bearer ${session?.access_token || key}`};
    if (body !== undefined) headers["Content-Type"]="application/json";
    if (prefer) headers.Prefer=prefer;
    const response=await fetch(`${base}/rest/v1/${table}${query}`,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"
    });
    if (!response.ok) {
      let message = `Dịch vụ dữ liệu trả về lỗi ${response.status}`;
      try { const value = await response.json();message=value.message || message; } catch(_) {}
      throw new Error(message);
    }
    const text=await response.text();return text?JSON.parse(text):[];
  }
  async function getReviews(courseId) {
    const rows=await request("course_reviews",{query:`?course_id=eq.${encodeURIComponent(courseId)}&select=id,user_id,author_name,content,created_at&order=created_at.desc&limit=100`});
    return rows.map(r=>({id:r.id,userId:r.user_id,authorName:r.author_name,content:r.content,createdAt:r.created_at}));
  }
  async function createReview(courseId,content) {
    await requireUser();
    const rows=await request("course_reviews",{method:"POST",prefer:"return=representation",body:{course_id:courseId,content}});
    return rows[0];
  }
  async function deleteReview(id) {
    await requireUser();
    await request("course_reviews",{method:"DELETE",query:`?id=eq.${encodeURIComponent(id)}`,prefer:"return=minimal"});
  }
  async function createQuestion(courseId,content) {
    await requireUser();
    await request("course_questions",{method:"POST",prefer:"return=minimal",body:{course_id:courseId,content}});
  }
  async function getAdvisorQuestions(status="pending") {
    await requireUser();
    return request("course_questions",{query:`?select=id,course_id,user_id,content,status,created_at,answer,answered_at&status=eq.${encodeURIComponent(status)}&order=created_at.desc`});
  }
  async function answerQuestion(questionId,answer) {
    await requireUser();
    if (!answer?.trim() || answer.trim().length < 3 || answer.length > 5000) throw new Error("Phản hồi phải có từ 3 đến 5000 ký tự.");
    return request("course_questions",{method:"PATCH",query:`?id=eq.${encodeURIComponent(questionId)}`,body:{answer:answer.trim(),status:"answered",answered_at:new Date().toISOString()},prefer:"return=representation"});
  }
  window.EduTrackData=Object.freeze({isCloudConfigured:()=>configured,getCurrentUser,sendLoginLink,updateFullName,
    getReviews,createReview,deleteReview,createQuestion,getAdvisorQuestions,answerQuestion});
})();
