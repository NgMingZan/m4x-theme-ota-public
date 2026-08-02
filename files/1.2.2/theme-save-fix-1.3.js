(function(){
  "use strict";

  const FIELDS = [
    ["adminThemeEditName","Tên Theme",true],
    ["adminThemeEditAuthor","Tác giả hiển thị",false],
    ["adminThemeEditCategory","Danh mục",false],
    ["adminThemeEditMode","Chế độ / Hệ điều hành",false],
    ["adminThemeEditSize","Dung lượng hoặc nguồn file",false],
    ["adminThemeEditRating","Điểm đánh giá từ 0 đến 5",false],
    ["adminThemeEditVersion","Phiên bản Theme",false],
    ["adminThemeEditPrice","Giá mở khóa bằng điểm",false],
    ["adminThemeEditPassword","Mật khẩu Theme — không phải tên Theme",false],
    ["adminThemeEditPreview","Link ảnh xem trước",true],
    ["adminThemeEditDownload","Link tải Theme",true],
    ["adminThemeEditTags","Thẻ, cách nhau bằng dấu phẩy",true],
    ["adminThemeEditDescription","Mô tả Theme",true]
  ];

  let saving=false;

  function byId(id){
    return document.getElementById(id);
  }

  function sleep(ms){
    return new Promise(function(resolve){ setTimeout(resolve,ms); });
  }

  function addFieldLabels(){
    const grid=document.querySelector("#adminThemeEditModal .adminThemeEditorGrid");
    if(!grid)return false;

    FIELDS.forEach(function(item){
      const id=item[0], labelText=item[1], wide=item[2];
      const field=byId(id);
      if(!field)return;

      // Luôn cho phép nhập lại sau khi modal được mở.
      field.disabled=false;
      field.readOnly=false;
      field.removeAttribute("aria-disabled");

      if(field.closest(".adminThemeField"))return;

      const wrapper=document.createElement("label");
      wrapper.className="adminThemeField"+(wide||field.classList.contains("wide")?" wide":"");
      wrapper.setAttribute("for",id);

      const label=document.createElement("span");
      label.textContent=labelText;

      field.parentNode.insertBefore(wrapper,field);
      wrapper.appendChild(label);
      wrapper.appendChild(field);
    });

    let notice=byId("adminThemeSaveNotice");
    if(!notice){
      notice=document.createElement("div");
      notice.id="adminThemeSaveNotice";
      notice.className="adminThemeSaveNotice";
      notice.textContent="Chỉnh sửa thông tin rồi bấm Lưu thay đổi.";
      grid.appendChild(notice);
    }

    return true;
  }

  function setNotice(message,type){
    addFieldLabels();
    const notice=byId("adminThemeSaveNotice");
    if(!notice)return;
    notice.className="adminThemeSaveNotice"+(type?" "+type:"");
    notice.textContent=message;
  }

  function setButtonBusy(busy){
    const button=byId("adminThemeSaveBtn");
    if(!button)return;
    button.disabled=busy;
    button.textContent=busy?"Đang lưu…":"Lưu thay đổi";
  }

  function sameValue(a,b){
    return String(a==null?"":a).trim()===String(b==null?"":b).trim();
  }

  async function request(action,payload){
    if(typeof apiNetworkRequest==="function"){
      return await apiNetworkRequest(action,payload||{});
    }
    if(typeof api==="function"){
      return await api(action,payload||{});
    }
    throw new Error("Không tìm thấy kết nối Backend");
  }

  function updateLocalTheme(theme,changes){
    try{
      if(typeof themeCatalogChangesCache!=="undefined"){
        const rest=(Array.isArray(changes)?changes:themeCatalogChangesCache||[])
          .filter(function(item){ return String(item.id||item.themeId)!==String(theme.id); });
        themeCatalogChangesCache=[...rest,{...theme,action:"updated"}];
      }

      if(typeof themes!=="undefined"&&Array.isArray(themes)){
        const index=themes.findIndex(function(item){ return String(item.id)===String(theme.id); });
        if(index>=0)themes[index]=typeof normalizeTheme==="function"?normalizeTheme({...themes[index],...theme},index):{...themes[index],...theme};
        else themes.push(typeof normalizeTheme==="function"?normalizeTheme(theme,themes.length):theme);

        if(typeof rebuildThemeIndexes==="function")rebuildThemeIndexes();
      }

      if(typeof current!=="undefined"&&current&&String(current.id)===String(theme.id)){
        current={...current,...theme};
      }

      if(typeof renderAll==="function"&&typeof currentUser!=="undefined"&&currentUser){
        renderAll();
      }else{
        if(typeof renderHome==="function")renderHome();
        if(typeof renderCategory==="function")renderCategory();
        if(typeof renderFavorites==="function")renderFavorites();
      }
    }catch(_){ }
  }

  async function verifySavedTheme(theme){
    const waits=[350,700,1300,2200];
    let latestChanges=[];

    for(let i=0;i<waits.length;i++){
      await sleep(waits[i]);
      try{
        const verify=await request("themeCatalogChanges",{fresh:Date.now(),requestId:"theme-verify-"+Date.now()});
        latestChanges=Array.isArray(verify&&verify.changes)?verify.changes:[];
        const found=latestChanges.find(function(item){
          return String(item.id||item.themeId)===String(theme.id)
            && String(item.action)!=="deleted";
        });

        if(!found)continue;

        const mismatch=[];
        if(!sameValue(found.name,theme.name))mismatch.push("Tên Theme");
        if(!sameValue(found.author,theme.author))mismatch.push("Tác giả");
        if(!sameValue(found.category,theme.category))mismatch.push("Danh mục");
        if(Number(found.pointCost||0)!==Number(theme.pointCost||0))mismatch.push("Giá điểm");

        if(!mismatch.length)return {confirmed:true,changes:latestChanges,found:found};
      }catch(_){ }
    }

    return {confirmed:false,changes:latestChanges};
  }

  async function refreshAfterSave(){
    if(typeof clearApiReadCache==="function")clearApiReadCache();

    // Việc tải lại giao diện không được phép biến một lần lưu thành công thành lỗi giả.
    try{
      if(typeof loadRemote==="function")await loadRemote();
    }catch(_){ }

    try{
      if(typeof loadAdminPublishedThemes==="function")await loadAdminPublishedThemes();
    }catch(_){ }
  }

  window.saveAdminThemeEditor=async function(){
    if(saving)return;

    try{
      if(typeof adminThemeEditingId==="undefined"||!adminThemeEditingId){
        throw new Error("Chưa chọn Theme cần sửa");
      }
      if(typeof themeFromAdminEditor!=="function"){
        throw new Error("Không đọc được biểu mẫu Theme");
      }

      addFieldLabels();
      const theme=themeFromAdminEditor();

      if(!theme||String(theme.name||"").trim().length<2){
        throw new Error("Tên Theme phải từ 2 ký tự");
      }

      saving=true;
      setButtonBusy(true);
      setNotice("Đang gửi thay đổi lên Backend…","");

      const result=await request("adminSavePublishedTheme",{
        theme:theme,
        requestId:"theme-save-"+Date.now()
      });

      // Backend có thể trả {theme}, {savedTheme}, hoặc chỉ {ok:true}.
      const returned=result&&(result.theme||result.savedTheme||result.data&&result.data.theme);
      if(returned&&returned.id!=null&&String(returned.id)!==String(theme.id)){
        throw new Error("Backend trả về sai Theme vừa lưu");
      }

      updateLocalTheme(theme);
      setNotice("Đã gửi lưu. Đang kiểm tra dữ liệu…","");

      const verified=await verifySavedTheme(theme);
      if(verified.confirmed){
        updateLocalTheme(theme,verified.changes);
        setNotice("Đã lưu thành công: "+theme.name,"ok");
        if(typeof toastMsg==="function")toastMsg("Đã lưu Theme: "+theme.name);
      }else{
        // Không báo lỗi giả khi Backend đã trả ok nhưng Google Sheet đồng bộ chậm.
        setNotice("Đã gửi lưu thành công. Dữ liệu đang đồng bộ, hãy mở lại danh sách sau vài giây.","ok");
        if(typeof toastMsg==="function")toastMsg("Đã gửi lưu Theme");
      }

      await refreshAfterSave();

      setTimeout(function(){
        if(typeof closeAdminThemeEditor==="function")closeAdminThemeEditor();
      },500);
    }catch(error){
      const message=error&&error.message?error.message:String(error||"Không lưu được Theme");
      setNotice(message,"error");
      if(typeof toastMsg==="function")toastMsg(message);
    }finally{
      saving=false;
      setButtonBusy(false);
    }
  };

  function boot(){
    addFieldLabels();

    const button=byId("adminThemeSaveBtn");
    if(button){
      button.type="button";
      button.onclick=function(event){
        if(event){event.preventDefault();event.stopPropagation();}
        window.saveAdminThemeEditor();
        return false;
      };
    }

    const modal=byId("adminThemeEditModal");
    if(modal){
      new MutationObserver(function(){
        if(!modal.classList.contains("hidden")){
          addFieldLabels();
          setNotice("Chỉnh sửa thông tin rồi bấm Lưu thay đổi.","");
        }
      }).observe(modal,{attributes:true,attributeFilter:["class"]});
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }
})();
