/* M4X Community 2.0 — B18 */
(function(){
'use strict';
const EMOJIS=['❤️','👍','🔥','😂','😮','😢','👏','💜'];
const S={mode:'new',page:1,limit:10,posts:[],hasMore:false,loading:false,detailId:'',commentPage:1,commentHasMore:false,comments:[],replyTo:'',opened:false};
const $=id=>document.getElementById(id);
const C2_PROFILE_TTL=5*60*1000;
const c2ProfileCache=new Map();
let c2UploadedMedia=[];

function latestOwnProfile(user){
 const u=user||me()||{};
 let p={};
 try{
  if(typeof userProfile==="function")p=userProfile()||{};
 }catch(_){}
 return Object.assign({},u,p,{
  avatarUrl:p.avatarUrl||u.avatarUrl||"",
  verifiedType:p.verifiedType||u.verifiedType||""
 });
}

async function hydrateCommunityProfiles(items){
 const list=Array.isArray(items)?items:[];
 const names=[...new Set(list.map(x=>String(x&&x.username||"").trim()).filter(Boolean))];
 const now=Date.now();

 await Promise.all(names.map(async username=>{
  const cached=c2ProfileCache.get(username);
  if(cached&&now-cached.time<C2_PROFILE_TTL)return;
  try{
   const result=await api("communityProfile",{username});
   const profile=result&&result.profile?result.profile:null;
   if(profile)c2ProfileCache.set(username,{time:Date.now(),profile});
  }catch(_){}
 }));

 list.forEach(item=>{
  if(!item)return;
  const own=me()&&String(item.username)===String(me().username);
  const cached=c2ProfileCache.get(String(item.username));
  const profile=own?latestOwnProfile(me()):(cached&&cached.profile);
  if(!profile)return;
  item.name=profile.name||item.name;
  item.avatarUrl=profile.avatarUrl||item.avatarUrl||"";
  item.role=profile.role||item.role;
  item.verifiedType=profile.verifiedType||item.verifiedType||"";
 });
}

function c2PreviewUrl(url){
 try{
  return typeof previewSource==="function"?previewSource(url):url;
 }catch(_){
  return url;
 }
}

function c2ReadImage(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Không đọc được ảnh"));
  reader.onload=()=>{
   const image=new Image();
   image.onerror=()=>reject(new Error("Ảnh không hợp lệ"));
   image.onload=()=>resolve(image);
   image.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
}

async function c2CompressImage(file){
 const image=await c2ReadImage(file);
 const maxSide=1280;
 const w=image.naturalWidth||image.width;
 const h=image.naturalHeight||image.height;
 const scale=Math.min(1,maxSide/Math.max(w,h));
 const canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(w*scale));
 canvas.height=Math.max(1,Math.round(h*scale));
 const ctx=canvas.getContext("2d",{alpha:false});
 ctx.fillStyle="#071526";
 ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(image,0,0,canvas.width,canvas.height);
 let quality=.82;
 let data=canvas.toDataURL("image/jpeg",quality);
 while(data.length>1800000&&quality>.48){
  quality-=.08;
  data=canvas.toDataURL("image/jpeg",quality);
 }
 return data;
}

function renderPostImagePreview(){
 const box=$("c2PostImagePreview");
 if(!box)return;
 box.innerHTML=c2UploadedMedia.map((url,index)=>(
  '<div class="c2-upload-item">'
  +'<img src="'+safe(c2PreviewUrl(url))+'" alt="Ảnh đã chọn">'
  +'<button type="button" onclick="M4XCommunityV2.removePostImage('+index+')">×</button>'
  +'</div>'
 )).join("");
}

function chooseAvatar(){
 try{
  if(typeof chooseAvatarFromPhone==="function"){
   chooseAvatarFromPhone();
   return;
  }
  if(typeof editAvatar==="function"){
   editAvatar();
   return;
  }
 }catch(_){}
 toastMsg("Không mở được trình chọn ảnh đại diện");
}

function choosePostImages(){
 $("c2ComposeMore")?.classList.add("open");
 const input=$("c2PostImageInput");
 if(!input)return toastMsg("Không tìm thấy trình chọn ảnh");
 input.value="";
 input.click();
}

async function handlePostImages(event){
 const files=Array.from(event.target.files||[]).filter(f=>/^image\//i.test(f.type||""));
 if(!files.length)return;
 const remain=Math.max(0,4-c2UploadedMedia.length);
 if(!remain)return toastMsg("Mỗi bài tối đa 4 ảnh");

 const status=$("c2UploadStatus");
 if(status){
  status.classList.remove("hidden");
  status.textContent="Đang tải ảnh lên…";
 }

 try{
  for(const file of files.slice(0,remain)){
   if(file.size>12*1024*1024)throw new Error("Ảnh tối đa 12 MB");
   const dataUrl=await c2CompressImage(file);
   const base64=dataUrl.split(",")[1]||"";
   const result=await api("uploadSmallFile",{
    fileName:(file.name||("community-"+Date.now()+".jpg")).replace(/\.[^.]+$/,"")+".jpg",
    mimeType:"image/jpeg",
    base64
   });
   if(result&&result.url)c2UploadedMedia.push(result.url);
   renderPostImagePreview();
  }
  if(status)status.textContent="Đã tải "+c2UploadedMedia.length+"/4 ảnh";
 }catch(error){
  if(status)status.textContent=error&&error.message?error.message:"Không tải được ảnh";
  toastMsg(error&&error.message?error.message:"Không tải được ảnh");
 }
}

function removePostImage(index){
 c2UploadedMedia.splice(Number(index),1);
 renderPostImagePreview();
 const status=$("c2UploadStatus");
 if(status){
  status.textContent=c2UploadedMedia.length?("Đã tải "+c2UploadedMedia.length+"/4 ảnh"):"";
  status.classList.toggle("hidden",!c2UploadedMedia.length);
 }
}

function safe(value){return typeof esc==='function'?esc(String(value??'')):String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function safeUrl(value){const v=String(value||'').trim();return /^https:\/\//i.test(v)?v:''}
function nowId(prefix){return prefix+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,9)}
function me(){
  try{
    if(typeof currentUser!=="undefined"&&currentUser){
      return currentUser;
    }
  }catch(_){}

  try{
    const cached=JSON.parse(
      localStorage.getItem("m4xUserCache")||"null"
    );

    if(cached&&cached.username){
      return cached;
    }
  }catch(_){}

  return null;
}
function avatarHtml(user,large){
 let value=user||{};
 const own=me()&&String(value.username||"")===String(me().username||"");
 if(own)value=latestOwnProfile(Object.assign({},me(),value));
 const url=safeUrl(value&&value.avatarUrl);
 const label=safe((value&&value.name||value&&value.username||"M").trim().slice(0,1).toUpperCase());
 return `<div class="c2-avatar${large?" large":""}">${url?`<img src="${safe(c2PreviewUrl(url))}" loading="lazy" onerror="this.remove()">`:label}</div>`;
}
function timeAgo(value){const t=new Date(value).getTime();if(!t)return '';const s=Math.max(1,Math.floor((Date.now()-t)/1000));if(s<60)return s+' giây';if(s<3600)return Math.floor(s/60)+' phút';if(s<86400)return Math.floor(s/3600)+' giờ';if(s<604800)return Math.floor(s/86400)+' ngày';return new Date(t).toLocaleDateString('vi-VN')}
function reactionCountMap(r){return r&&typeof r==='object'?r:{}}
function reactionTotal(r){return Object.values(reactionCountMap(r)).reduce((a,b)=>a+Number(b||0),0)}
function reactionChips(targetType,targetId,reactions,mine){const map=reactionCountMap(reactions);const used=Object.entries(map).filter(([,count])=>Number(count)>0).map(([emoji,count])=>`<button class="c2-react-chip ${mine===emoji?'active':''}" onclick="event.stopPropagation();M4XCommunityV2.react('${targetType}','${safe(targetId)}','${emoji}')">${emoji} ${Number(count)}</button>`).join('');return used?`<div class="c2-reactions">${used}</div>`:''}
function postMenuButton(p){const u=me();if(!u)return '';const mine=p.username===u.username,admin=u.role==='admin';let choices=[];if(mine||admin)choices.push('Sửa','Xóa');if(!mine)choices.push('Báo cáo');if(admin)choices.push(p.pinned?'Bỏ ghim':'Ghim',p.commentsLocked?'Mở bình luận':'Khóa bình luận', 'Ẩn');return `<button class="c2-menu" onclick="event.stopPropagation();M4XCommunityV2.postMenu('${safe(p.id)}')">⋮</button>`}
function mediaHtml(urls){
 const list=(Array.isArray(urls)?urls:[]).map(safeUrl).filter(Boolean).slice(0,4);
 if(!list.length)return "";
 return `<div class="c2-media ${list.length===1?"one":"multi"}">${list.map(u=>`<img src="${safe(c2PreviewUrl(u))}" loading="lazy" onclick="event.stopPropagation();openExternal('${safe(u)}')" onerror="this.remove()">`).join("")}</div>`;
}
function postCard(p,detail){const u=me()||{};const mine=p.username===u.username;const badge=[p.pinned?'<span class="c2-badge pin">📌 Đã ghim</span>':'',p.role==='admin'?'<span class="c2-badge admin">ADMIN</span>':'',p.verifiedType?`<span class="c2-badge">✓ ${safe(p.verifiedType)}</span>`:''].join('');const follow=!mine?`<button class="c2-follow ${p.isFollowing?'on':''}" onclick="event.stopPropagation();M4XCommunityV2.follow('${safe(p.username)}')">${p.isFollowing?'Đang theo dõi':'Theo dõi'}</button>`:postMenuButton(p);const tags=(Array.isArray(p.tags)?p.tags:[]).map(t=>`<span class="c2-tag">#${safe(t)}</span>`).join('');const total=Number(p.reactionCount||reactionTotal(p.reactions));return `<article class="c2-card ${p.pinned?'pinned':''}" data-post-id="${safe(p.id)}" ${detail?'':`onclick="M4XCommunityV2.openDetail('${safe(p.id)}')"`}><div class="c2-card-head" onclick="event.stopPropagation();M4XCommunityV2.openProfile('${safe(p.username)}')">${avatarHtml(p)}<div class="c2-author"><b>${safe(p.name||p.username)}${typeof verifiedIcon==='function'?verifiedIcon(p.verifiedType):''}</b><small>@${safe(p.username)} · ${timeAgo(p.createdAt)}</small></div>${follow}</div>${badge?`<div class="c2-badges">${badge}</div>`:''}${p.text?`<div class="c2-text">${safe(p.text)}</div>`:''}${mediaHtml(p.mediaUrls)}${p.themeId?`<div class="c2-theme-link" onclick="event.stopPropagation();M4XCommunityV2.openTheme('${safe(p.themeId)}')"><span>🎨 Theme đính kèm</span><b>${safe(p.themeId)} ›</b></div>`:''}${tags?`<div class="c2-tags">${tags}</div>`:''}<div class="c2-stats"><span>${total} reaction</span><span>${Number(p.commentCount||0)} bình luận</span><span>${Number(p.viewCount||0)} lượt xem</span></div>${reactionChips('post',p.id,p.reactions,p.myReaction)}<div class="c2-actions"><button class="c2-action ${p.myReaction?'active':''}" onclick="event.stopPropagation();M4XCommunityV2.pickReaction('post','${safe(p.id)}')">${p.myReaction||'♡'} Thả cảm xúc</button><button class="c2-action" onclick="event.stopPropagation();M4XCommunityV2.openDetail('${safe(p.id)}')">💬 Bình luận</button><button class="c2-action" onclick="event.stopPropagation();M4XCommunityV2.sharePost('${safe(p.id)}')">↗ Chia sẻ</button></div></article>`}
function renderFeed(){const box=$('c2Feed');if(!box)return;if(!S.posts.length){box.innerHTML=`<div class="c2-empty">${S.mode==='following'?'Bạn chưa theo dõi tác giả nào hoặc họ chưa đăng bài.':'Chưa có bài viết. Hãy là người đầu tiên chia sẻ!'}</div>`}else box.innerHTML=S.posts.map(p=>postCard(p,false)).join('');const more=$('c2LoadMore');if(more){more.classList.toggle('hidden',!S.hasMore);more.disabled=S.loading;more.textContent=S.loading?'Đang tải…':'Tải thêm'}}
async function loadFeed(reset){
 if(S.loading||!me())return;
 S.loading=true;
 if(reset){
  S.page=1;
  S.posts=[];
  $("c2Feed").innerHTML='<div class="c2-loading">Đang tải bảng tin…</div>';
 }
 try{
  const r=await api("communityFeed",{mode:S.mode,page:S.page,limit:S.limit});
  const list=Array.isArray(r.posts)?r.posts:[];
  S.posts=reset?list:S.posts.concat(list.filter(x=>!S.posts.some(y=>y.id===x.id)));
  S.hasMore=Boolean(r.hasMore);
  await hydrateCommunityProfiles(S.posts);
  renderFeed();
 }catch(e){
  $("c2Feed").innerHTML=`<div class="c2-empty">${safe(e.message||"Không tải được bảng tin")}</div>`;
  if(typeof toastMsg==="function")toastMsg(e.message);
 }finally{
  S.loading=false;
  renderFeed();
 }
}
function switchMode(mode){S.mode=['new','following','trending'].includes(mode)?mode:'new';['New','Following','Trending'].forEach(k=>{const b=$('c2Tab'+k);if(b)b.classList.toggle('active',S.mode===k.toLowerCase())});loadFeed(true)}
function fillMyAvatar(){
 const box=$("c2MyAvatar"),u=me();
 if(!box||!u)return;
 const profile=latestOwnProfile(u);
 const rendered=avatarHtml(profile)
  .replace('class="c2-avatar"','id="c2MyAvatar" class="c2-avatar c2-avatar-editable" role="button" title="Đổi ảnh đại diện" onclick="M4XCommunityV2.chooseAvatar()"');
 box.outerHTML=rendered;
}
function toggleComposeMore(){$('c2ComposeMore')?.classList.toggle('open')}
async function createPost(){
 const text=$("c2PostText").value.trim();
 const manual=$("c2MediaUrls").value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
 const mediaUrls=[...new Set(c2UploadedMedia.concat(manual))].slice(0,4);
 const themeId=$("c2ThemeId").value.trim();
 const tags=$("c2Tags").value.split(/[,#]/).map(x=>x.trim()).filter(Boolean).slice(0,5);

 if(text.length<2&&!mediaUrls.length&&!themeId)return toastMsg("Nhập nội dung, ảnh hoặc ID theme");

 const btn=$("c2PublishBtn");
 btn.disabled=true;
 btn.textContent="Đang đăng…";

 try{
  await api("communityCreatePost",{
   requestId:nowId("post"),
   text,
   mediaUrls,
   themeId,
   tags
  });

  $("c2PostText").value="";
  $("c2MediaUrls").value="";
  $("c2ThemeId").value="";
  $("c2Tags").value="";
  c2UploadedMedia=[];
  renderPostImagePreview();

  const status=$("c2UploadStatus");
  if(status){
   status.textContent="";
   status.classList.add("hidden");
  }

  $("c2ComposeMore").classList.remove("open");
  S.mode="new";
  await loadFeed(true);
  toastMsg("Đã đăng bài");
 }catch(e){
  toastMsg(e.message);
 }finally{
  btn.disabled=false;
  btn.textContent="Đăng bài";
 }
}
function findPost(id){return S.posts.find(p=>p.id===id)||null}
async function follow(username){try{const r=await api('communityToggleFollow',{username});S.posts.forEach(p=>{if(p.username===username)p.isFollowing=Boolean(r.following)});renderFeed();if(S.detailId)refreshDetail(false);toastMsg(r.following?'Đã theo dõi':'Đã bỏ theo dõi')}catch(e){toastMsg(e.message)}}
async function react(targetType,targetId,emoji){try{const r=await api('communityToggleReaction',{targetType,targetId,emoji});if(targetType==='post'){S.posts.forEach(p=>{if(p.id===targetId){p.reactions=r.reactions?.counts||{};p.myReaction=r.reactions?.mine||'';p.reactionCount=r.reactionCount}});renderFeed();if(S.detailId===targetId)refreshDetail(false)}else if(S.detailId)refreshDetail(false)}catch(e){toastMsg(e.message)}}
function pickReaction(targetType,targetId){const value=(prompt('Chọn reaction: '+EMOJIS.join(' '),'❤️')||'').trim();if(!EMOJIS.includes(value))return value&&toastMsg('Reaction không hợp lệ');react(targetType,targetId,value)}
async function openDetail(id){S.detailId=id;S.commentPage=1;S.comments=[];$('c2Detail').classList.remove('hidden');document.body.style.overflow='hidden';$('c2DetailPost').innerHTML='<div class="c2-loading">Đang tải bài viết…</div>';$('c2Comments').innerHTML='';await refreshDetail(true)}
function closeDetail(){S.detailId='';S.replyTo='';$('c2Detail').classList.add('hidden');document.body.style.overflow='';updateReplying()}
async function refreshDetail(reset){
 if(!S.detailId)return;
 try{
  const r=await api("communityPostDetail",{postId:S.detailId,page:reset?1:S.commentPage,limit:30});
  const p=r.post;
  await hydrateCommunityProfiles([p]);

  if(reset){
   S.commentPage=1;
   S.comments=Array.isArray(r.comments)?r.comments:[];
  }else{
   S.comments=S.comments.concat((r.comments||[]).filter(x=>!S.comments.some(y=>y.id===x.id)));
  }

  await hydrateCommunityProfiles(S.comments);
  S.commentHasMore=Boolean(r.hasMore);
  $("c2DetailPost").innerHTML=postCard(p,true);

  const idx=S.posts.findIndex(x=>x.id===p.id);
  if(idx>=0)S.posts[idx]=p;

  renderComments();
  renderFeed();
 }catch(e){
  $("c2DetailPost").innerHTML=`<div class="c2-empty">${safe(e.message)}</div>`;
 }
}
function renderComments(){const box=$('c2Comments');if(!box)return;if(!S.comments.length)box.innerHTML='<div class="c2-empty">Chưa có bình luận.</div>';else box.innerHTML=S.comments.map(c=>commentCard(c)).join('');const more=$('c2MoreComments');more.classList.toggle('hidden',!S.commentHasMore)}
function commentCard(c){const u=me()||{},mine=c.username===u.username,admin=u.role==='admin';return `<div class="c2-comment ${c.parentId?'reply':''}">${`<div class="c2-comment-head">${avatarHtml(c)}<div class="c2-comment-meta"><b>${safe(c.name||c.username)}${typeof verifiedIcon==='function'?verifiedIcon(c.verifiedType):''}</b><small>@${safe(c.username)} · ${timeAgo(c.createdAt)}</small></div></div>`}<div class="c2-comment-text">${safe(c.text)}</div>${reactionChips('comment',c.id,c.reactions,c.myReaction)}<div class="c2-comment-actions"><button onclick="M4XCommunityV2.reply('${safe(c.id)}','${safe(c.username)}')">Trả lời</button><button onclick="M4XCommunityV2.pickReaction('comment','${safe(c.id)}')">Reaction</button>${mine||admin?`<button class="danger" onclick="M4XCommunityV2.deleteComment('${safe(c.id)}')">Xóa</button>`:''}${!mine?`<button onclick="M4XCommunityV2.report('comment','${safe(c.id)}')">Báo cáo</button>`:''}</div></div>`}
function reply(id,username){S.replyTo=id;updateReplying(username);$('c2CommentText').focus()}
function updateReplying(username){const el=$('c2Replying');if(!el)return;if(S.replyTo){el.classList.remove('hidden');el.innerHTML=`Đang trả lời @${safe(username||'người dùng')} · <button onclick="M4XCommunityV2.cancelReply()">Hủy</button>`}else{el.classList.add('hidden');el.textContent=''}}
function cancelReply(){S.replyTo='';updateReplying()}
async function addComment(){const text=$('c2CommentText').value.trim();if(!text)return toastMsg('Nhập bình luận');try{await api('communityAddComment',{requestId:nowId('comment'),postId:S.detailId,parentId:S.replyTo,text});$('c2CommentText').value='';S.replyTo='';updateReplying();await refreshDetail(true);toastMsg('Đã bình luận')}catch(e){toastMsg(e.message)}}
async function deleteComment(id){if(!confirm('Xóa bình luận này?'))return;try{await api('communityDeleteComment',{commentId:id});await refreshDetail(true);toastMsg('Đã xóa bình luận')}catch(e){toastMsg(e.message)}}
async function loadMore(){if(!S.hasMore)return;S.page++;await loadFeed(false)}
async function loadMoreComments(){if(!S.commentHasMore)return;S.commentPage++;await refreshDetail(false)}
async function editPost(id){const p=findPost(id)||{};const text=prompt('Sửa nội dung bài viết:',p.text||'');if(text===null)return;try{await api('communityEditPost',{postId:id,text,mediaUrls:p.mediaUrls||[],themeId:p.themeId||'',tags:p.tags||[]});await loadFeed(true);if(S.detailId===id)await refreshDetail(true);toastMsg('Đã sửa bài')}catch(e){toastMsg(e.message)}}
async function deletePost(id){if(!confirm('Xóa bài viết này?'))return;try{await api('communityDeletePost',{postId:id});S.posts=S.posts.filter(p=>p.id!==id);renderFeed();if(S.detailId===id)closeDetail();toastMsg('Đã xóa bài')}catch(e){toastMsg(e.message)}}
async function report(targetType,targetId){const reason=(prompt('Lý do báo cáo:','Spam / nội dung không phù hợp')||'').trim();if(!reason)return;const detail=(prompt('Mô tả thêm:','')||'').trim();try{await api('communityReport',{targetType,targetId,reason,detail});toastMsg('Đã gửi báo cáo')}catch(e){toastMsg(e.message)}}
async function moderate(action,targetType,targetId){if(!confirm('Xác nhận thao tác '+action+'?'))return;try{await api('adminCommunityModerate',{moderationAction:action,targetType,targetId,note:''});await loadFeed(true);if(S.detailId===targetId)await refreshDetail(true);toastMsg('Đã cập nhật')}catch(e){toastMsg(e.message)}}
function postMenu(id){const p=findPost(id)||{};const u=me()||{},mine=p.username===u.username,admin=u.role==='admin';let options=[];if(mine||admin)options.push('1. Sửa','2. Xóa');if(!mine)options.push('3. Báo cáo');if(admin)options.push(`4. ${p.pinned?'Bỏ ghim':'Ghim'}`,`5. ${p.commentsLocked?'Mở bình luận':'Khóa bình luận'}`,'6. Ẩn');const choice=(prompt(options.join('\n')+'\n\nNhập số:','')||'').trim();if(choice==='1')editPost(id);else if(choice==='2')deletePost(id);else if(choice==='3')report('post',id);else if(choice==='4'&&admin)moderate(p.pinned?'unpin':'pin','post',id);else if(choice==='5'&&admin)moderate(p.commentsLocked?'unlockComments':'lockComments','post',id);else if(choice==='6'&&admin)moderate('hide','post',id)}
async function openProfile(username){try{const r=await api('communityProfile',{username});const p=r.profile||{};const follow=p.username!==me().username?`<button class="c2-follow ${p.isFollowing?'on':''}" onclick="M4XCommunityV2.follow('${safe(p.username)}');this.closest('.modal').classList.add('hidden')">${p.isFollowing?'Đang theo dõi':'Theo dõi'}</button>`:'';showCommunityModal(`<div class="c2-profile glass"><div class="c2-profile-top">${avatarHtml(p,true)}<div><b>${safe(p.name||p.username)}${typeof verifiedIcon==='function'?verifiedIcon(p.verifiedType):''}</b><div class="muted">@${safe(p.username)}</div>${follow}</div></div><div class="c2-profile-stats"><div class="c2-profile-stat"><b>${Number(p.postCount||0)}</b><small>Bài viết</small></div><div class="c2-profile-stat"><b>${Number(p.followerCount||0)}</b><small>Người theo dõi</small></div><div class="c2-profile-stat"><b>${Number(p.followingCount||0)}</b><small>Đang theo dõi</small></div></div></div>`)}catch(e){toastMsg(e.message)}}
function openMyProfile(){const u=me();if(u)openProfile(u.username)}
function showCommunityModal(content){let modal=$('c2Modal');if(!modal){modal=document.createElement('div');modal.id='c2Modal';modal.className='modal hidden';modal.innerHTML='<div class="modalbox"><button class="close" onclick="this.closest(\'.modal\').classList.add(\'hidden\')">×</button><div id="c2ModalBody"></div></div>';document.body.appendChild(modal)}$('c2ModalBody').innerHTML=content;modal.classList.remove('hidden')}
function openTheme(id){const fn=window.openDetail;if(typeof fn==='function')fn(id);else toastMsg('Theme: '+id)}
async function sharePost(id){const text='Xem bài viết trên M4X THEME · '+id;if(navigator.share){try{await navigator.share({title:'M4X Community',text});return}catch(_){}}try{await navigator.clipboard.writeText(text);toastMsg('Đã sao chép nội dung chia sẻ')}catch(_){toastMsg(text)}}
function refresh(){loadFeed(true)}
function refreshDetailPublic(){refreshDetail(true)}
function open(){
  S.opened=true;

  if(typeof stopChatPolling==="function"){
    stopChatPolling();
  }

  let attempts=0;

  const start=function(){
    if(me()){
      fillMyAvatar();
      loadFeed(true);
      return;
    }

    attempts++;

    if(attempts<20){
      setTimeout(start,300);
      return;
    }

    const box=$("c2Feed");

    if(box){
      box.innerHTML=
        '<div class="c2-empty">Không đọc được tài khoản. Hãy đăng nhập lại.</div>';
    }
  };

  start();
}
function close(){S.opened=false;closeDetail()}
window.M4XCommunityV2={chooseAvatar,choosePostImages,handlePostImages,removePostImage,open,close,refresh,switchMode,toggleComposeMore,createPost,loadMore,follow,react,pickReaction,openDetail,closeDetail,refreshDetail:refreshDetailPublic,loadMoreComments,reply,cancelReply,addComment,deleteComment,editPost,deletePost,report,moderate,postMenu,openProfile,openMyProfile,openTheme,sharePost};
})();
