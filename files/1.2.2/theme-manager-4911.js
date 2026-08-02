(function(){
  "use strict";

  const FIELD_LABELS = [
    ["adminThemeEditName","Tên Theme",true],
    ["adminThemeEditAuthor","Tác giả hiển thị",false],
    ["adminThemeEditCategory","Danh mục",false],
    ["adminThemeEditMode","Chế độ / Hệ điều hành",false],
    ["adminThemeEditSize","Dung lượng hoặc nguồn file",false],
    ["adminThemeEditRating","Điểm đánh giá từ 0 đến 5",false],
    ["adminThemeEditVersion","Phiên bản Theme",false],
    ["adminThemeEditPrice","Giá mở khóa bằng điểm",false],
    ["adminThemeEditPassword","Mật khẩu Theme",false],
    ["adminThemeEditPreview","Link ảnh xem trước",true],
    ["adminThemeEditDownload","Link tải Theme",true],
    ["adminThemeEditTags","Thẻ, cách nhau bằng dấu phẩy",true],
    ["adminThemeEditDescription","Mô tả Theme",true]
  ];

  let saving=false;

  function el(id){
    return document.getElementById(id);
  }

  function installLabels(){
    const grid=document.querySelector(
      "#adminThemeEditModal .adminThemeEditorGrid"
    );
    if(!grid)return false;

    FIELD_LABELS.forEach(function(item){
      const input=el(item[0]);
      if(!input||input.closest(".adminThemeField"))return;

      const wrapper=document.createElement("label");
      wrapper.className=
        "adminThemeField"+(item[2]||input.classList.contains("wide")
          ?" wide":"");
      wrapper.setAttribute("for",item[0]);

      const title=document.createElement("span");
      title.textContent=item[1];

      input.parentNode.insertBefore(wrapper,input);
      wrapper.appendChild(title);
      wrapper.appendChild(input);
    });

    if(!el("adminThemeSaveNotice")){
      const box=document.createElement("div");
      box.id="adminThemeSaveNotice";
      box.className="adminThemeSaveNotice";
      box.textContent=
        "Thay đổi sẽ được lưu vào ThemeCatalogOverrides và áp dụng ngay.";
      grid.appendChild(box);
    }

    return true;
  }

  function showNotice(message,type){
    installLabels();

    const box=el("adminThemeSaveNotice");
    if(!box)return;

    box.className="adminThemeSaveNotice"+(type?" "+type:"");
    box.textContent=message;
  }

  function withTimeout(promise,timeoutMs){
    return Promise.race([
      promise,
      new Promise(function(_,reject){
        setTimeout(function(){
          reject(new Error(
            "Backend phản hồi quá lâu. Hãy kiểm tra bản triển khai Apps Script."
          ));
        },timeoutMs);
      })
    ]);
  }

  function request(action,payload){
    if(typeof apiNetworkRequest==="function"){
      return withTimeout(
        apiNetworkRequest(action,payload||{}),
        35000
      );
    }

    if(typeof api==="function"){
      return withTimeout(
        api(action,payload||{}),
        35000
      );
    }

    return Promise.reject(
      new Error("Không tìm thấy kết nối Backend")
    );
  }

  function equalValue(a,b){
    return String(a==null?"":a).trim()===
      String(b==null?"":b).trim();
  }

  function applyFreshChanges(changes){
    const list=Array.isArray(changes)?changes:[];

    themeCatalogChangesCache=list;

    if(Array.isArray(themes)){
      themes=applyThemeCatalogChanges(themes,list);
      rebuildThemeIndexes();
    }

    if(typeof renderHome==="function")renderHome();
    if(typeof renderCategory==="function")renderCategory();
    if(typeof renderFavorites==="function")renderFavorites();
  }

  async function saveTheme(event){
    if(event){
      event.preventDefault();
      event.stopPropagation();
    }

    if(saving)return false;

    const button=el("adminThemeSaveBtn");

    try{
      if(
        typeof adminThemeEditingId==="undefined"||
        !String(adminThemeEditingId||"").trim()
      ){
        throw new Error("Chưa chọn Theme cần sửa");
      }

      if(typeof themeFromAdminEditor!=="function"){
        throw new Error("Không đọc được biểu mẫu chỉnh sửa");
      }

      const theme=themeFromAdminEditor();

      if(!theme||String(theme.name||"").trim().length<2){
        throw new Error("Tên Theme phải từ 2 ký tự");
      }

      saving=true;

      if(button){
        button.disabled=true;
        button.textContent="Đang lưu…";
      }

      showNotice("Đang ghi thay đổi lên Backend…","");

      const savedResponse=await request(
        "adminSavePublishedTheme",
        {
          theme:theme,
          requestId:"theme-save-"+Date.now()
        }
      );

      const savedTheme=savedResponse&&savedResponse.theme
        ?savedResponse.theme
        :null;

      if(
        !savedTheme||
        String(savedTheme.id)!==String(theme.id)
      ){
        throw new Error(
          "Backend không trả lại đúng Theme vừa lưu"
        );
      }

      // Update immediately, before any remote reload.
      const provisional=Array.isArray(themeCatalogChangesCache)
        ?themeCatalogChangesCache.filter(function(item){
            return String(item.id)!==String(theme.id);
          })
        :[];

      provisional.push(savedTheme);
      applyFreshChanges(provisional);

      showNotice(
        "Đã ghi. Đang đọc lại Google Sheet để xác nhận…",
        ""
      );

      await new Promise(function(resolve){
        setTimeout(resolve,650);
      });

      const verifyResponse=await request(
        "themeCatalogChanges",
        {fresh:Date.now()}
      );

      const changes=Array.isArray(
        verifyResponse&&verifyResponse.changes
      )
        ?verifyResponse.changes
        :[];

      const verified=changes.find(function(item){
        return String(item.id)===String(theme.id)&&
          String(item.action)!=="deleted";
      });

      if(!verified){
        throw new Error(
          "Google Sheet chưa có Theme vừa lưu"
        );
      }

      const mismatched=[];
      if(!equalValue(verified.name,theme.name)){
        mismatched.push("Tên Theme");
      }
      if(!equalValue(verified.author,theme.author)){
        mismatched.push("Tác giả");
      }
      if(!equalValue(verified.category,theme.category)){
        mismatched.push("Danh mục");
      }
      if(
        Number(verified.pointCost||0)!==
        Number(theme.pointCost||0)
      ){
        mismatched.push("Giá điểm");
      }

      if(mismatched.length){
        throw new Error(
          "Backend lưu chưa đúng: "+mismatched.join(", ")
        );
      }

      applyFreshChanges(changes);

      if(typeof clearApiReadCache==="function"){
        clearApiReadCache();
      }

      if(typeof loadAdminPublishedThemes==="function"){
        await loadAdminPublishedThemes();
      }

      showNotice(
        "Đã lưu thành công: "+theme.name,
        "ok"
      );

      if(typeof toastMsg==="function"){
        toastMsg("Đã lưu Theme: "+theme.name);
      }

      setTimeout(function(){
        if(typeof closeAdminThemeEditor==="function"){
          closeAdminThemeEditor();
        }
      },700);
    }catch(error){
      const message=error&&error.message
        ?error.message
        :"Không lưu được Theme";

      showNotice(message,"error");

      if(typeof toastMsg==="function"){
        toastMsg(message);
      }
    }finally{
      saving=false;

      if(button){
        button.disabled=false;
        button.textContent="Lưu thay đổi";
      }
    }

    return false;
  }

  function bindSaveButton(){
    const button=el("adminThemeSaveBtn");
    if(!button)return false;

    button.type="button";
    button.removeAttribute("onclick");
    button.onclick=saveTheme;
    button.dataset.m4xThemeSave="4911";

    return true;
  }

  function boot(){
    installLabels();
    bindSaveButton();

    const modal=el("adminThemeEditModal");

    if(modal){
      new MutationObserver(function(){
        bindSaveButton();

        if(!modal.classList.contains("hidden")){
          installLabels();
          showNotice(
            "Sửa đúng ô có nhãn rồi bấm Lưu thay đổi.",
            ""
          );
        }
      }).observe(modal,{
        attributes:true,
        childList:true,
        subtree:true,
        attributeFilter:["class"]
      });
    }
  }

  window.saveAdminThemeEditor=saveTheme;

  if(document.readyState==="loading"){
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      {once:true}
    );
  }else{
    boot();
  }
})();
