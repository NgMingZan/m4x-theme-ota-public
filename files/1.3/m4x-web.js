(function(){
  "use strict";

  const STORAGE_KEY="m4xSavedWebsites";
  const DEFAULT_LINKS_KEY="m4xDefaultWebLinksConfigV1";
  const DEFAULT_APPS_KEY="m4xDefaultAppsConfigV1";
  const BUILTIN_LINKS=[
    {id:"football",title:"Đá bóng",url:"https://xoilacxtz.tv/",icon:"⚽",enabled:true,adult:false},
    {id:"movies",title:"Xem Phim",url:"https://cobephim.pro/",icon:"🎬",enabled:true,adult:false},
    {id:"adult",title:"18+",url:"https://vnsextop1.com/",icon:"🔞",enabled:true,adult:true}
  ];

  let savedSites=[];
  let defaultLinks=[];
  let defaultApps=[];
  let editingDefaultAppId=null;

  try{
    savedSites=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
    if(!Array.isArray(savedSites))savedSites=[];
  }catch(_){savedSites=[];}

  function notify(message){
    if(typeof toastMsg==="function")toastMsg(message);
    else alert(message);
  }

  function safeText(value){
    return String(value||"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function normalizeUrl(value){
    let raw=String(value||"").trim();
    if(!raw)return "";
    if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))raw="https://"+raw;
    try{
      const url=new URL(raw);
      if(url.protocol!=="https:"&&url.protocol!=="http:")return "";
      return url.href;
    }catch(_){return "";}
  }

  function defaultTitle(url){
    try{return new URL(url).hostname.replace(/^www\./,"")||"Website";}
    catch(_){return "Website";}
  }

  function isAdmin(){
    try{return Boolean(typeof currentUser!=="undefined"&&currentUser&&currentUser.role==="admin");}
    catch(_){return false;}
  }

  function loadDefaultLinks(){
    let stored=[];
    try{
      stored=JSON.parse(localStorage.getItem(DEFAULT_LINKS_KEY)||"[]");
      if(!Array.isArray(stored))stored=[];
    }catch(_){stored=[];}

    defaultLinks=BUILTIN_LINKS.map(function(base){
      const custom=stored.find(function(item){return item&&item.id===base.id;})||{};
      const customUrl=normalizeUrl(custom.url);
      return {
        id:base.id,
        title:base.title,
        icon:base.icon,
        adult:Boolean(base.adult),
        url:customUrl||base.url,
        enabled:typeof custom.enabled==="boolean"?custom.enabled:base.enabled
      };
    });
  }

  function persistDefaultLinks(){
    localStorage.setItem(DEFAULT_LINKS_KEY,JSON.stringify(defaultLinks.map(function(item){
      return {id:item.id,url:item.url,enabled:Boolean(item.enabled)};
    })));
  }


  function normalizeAppUrl(value){
    let raw=String(value||"").trim();
    if(!raw)return "";
    if(/^(javascript|data|file|content):/i.test(raw))return "";
    if(!/^[a-z][a-z0-9+.-]*:/i.test(raw))raw="https://"+raw;
    if(!/^[a-z][a-z0-9+.-]*:/i.test(raw))return "";
    return raw;
  }

  function normalizePackageName(value){
    const raw=String(value||"").trim();
    return /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(raw)?raw:"";
  }

  function loadDefaultApps(){
    let stored=[];
    try{
      stored=JSON.parse(localStorage.getItem(DEFAULT_APPS_KEY)||"[]");
      if(!Array.isArray(stored))stored=[];
    }catch(_){stored=[];}

    defaultApps=stored.map(function(item,index){
      if(!item||typeof item!=="object")return null;
      const name=String(item.name||"").trim();
      const packageName=normalizePackageName(item.packageName);
      const openUrl=normalizeAppUrl(item.openUrl);
      const downloadUrl=normalizeAppUrl(item.downloadUrl);
      if(!name||(!packageName&&!openUrl&&!downloadUrl))return null;
      return {
        id:String(item.id||("app_"+Date.now()+"_"+index)),
        name:name.slice(0,70),
        packageName:packageName,
        openUrl:openUrl,
        downloadUrl:downloadUrl,
        icon:String(item.icon||"📱").trim().slice(0,500)||"📱",
        enabled:typeof item.enabled==="boolean"?item.enabled:true
      };
    }).filter(Boolean).slice(0,40);
  }

  function persistDefaultApps(){
    localStorage.setItem(DEFAULT_APPS_KEY,JSON.stringify(defaultApps));
  }

  function appIconMarkup(icon,name){
    const raw=String(icon||"").trim();
    if(/^https?:\/\//i.test(raw)){
      return '<img src="'+safeText(raw)+'" alt="'+safeText(name)+'" loading="lazy" referrerpolicy="no-referrer">';
    }
    return '<span>'+safeText(raw||"📱")+'</span>';
  }

  function launchAppTarget(item){
    const fallback=item.openUrl||item.downloadUrl||(item.packageName?"market://details?id="+item.packageName:"");
    if(!fallback&&!item.packageName){notify("Ứng dụng chưa có link mở hoặc link cài đặt");return;}
    let target=fallback;
    if(item.packageName){
      target="m4x-app://launch?package="+encodeURIComponent(item.packageName)+"&fallback="+encodeURIComponent(fallback);
    }
    try{
      if(window.Android&&typeof Android.openExternal==="function"){
        Android.openExternal(target);
        return;
      }
    }catch(_){}
    if(fallback)location.href=fallback;
  }

  window.openDefaultApp=function(id){
    const item=defaultApps.find(function(app){return app.id===id;});
    if(!item)return;
    if(!item.enabled){notify("Ứng dụng này đang được Admin tạm tắt");return;}
    launchAppTarget(item);
  };

  window.openDefaultAppEditor=function(id){
    if(!isAdmin()){notify("Chỉ Admin mới có quyền thêm hoặc sửa ứng dụng");return;}
    const modal=document.getElementById("defaultAppEditorModal");
    if(!modal)return;
    const item=id?defaultApps.find(function(app){return app.id===id;}):null;
    editingDefaultAppId=item?item.id:null;
    const set=function(field,value){const node=document.getElementById(field);if(node)node.value=value||"";};
    set("defaultAppName",item?item.name:"");
    set("defaultAppPackage",item?item.packageName:"");
    set("defaultAppOpenUrl",item?item.openUrl:"");
    set("defaultAppDownloadUrl",item?item.downloadUrl:"");
    set("defaultAppIcon",item?item.icon:"📱");
    const title=document.getElementById("defaultAppEditorTitle");
    if(title)title.textContent=item?"Sửa ứng dụng mặc định":"Thêm ứng dụng mặc định";
    modal.classList.remove("hidden");
  };

  window.closeDefaultAppEditor=function(){
    editingDefaultAppId=null;
    const modal=document.getElementById("defaultAppEditorModal");
    if(modal)modal.classList.add("hidden");
  };

  window.saveDefaultAppEditor=function(){
    if(!isAdmin()){notify("Chỉ Admin mới có quyền lưu ứng dụng");return;}
    const get=function(id){const node=document.getElementById(id);return node?node.value.trim():"";};
    const name=get("defaultAppName");
    const packageRaw=get("defaultAppPackage");
    const packageName=packageRaw?normalizePackageName(packageRaw):"";
    const openRaw=get("defaultAppOpenUrl");
    const downloadRaw=get("defaultAppDownloadUrl");
    const openUrl=openRaw?normalizeAppUrl(openRaw):"";
    const downloadUrl=downloadRaw?normalizeAppUrl(downloadRaw):"";
    const icon=get("defaultAppIcon")||"📱";

    if(!name){notify("Hãy nhập tên ứng dụng");return;}
    if(packageRaw&&!packageName){notify("Tên gói không hợp lệ. Ví dụ: com.example.app");return;}
    if(openRaw&&!openUrl){notify("Link mở ứng dụng không hợp lệ");return;}
    if(downloadRaw&&!downloadUrl){notify("Link cài đặt không hợp lệ");return;}
    if(!packageName&&!openUrl&&!downloadUrl){notify("Cần ít nhất tên gói, link mở hoặc link cài đặt");return;}

    if(editingDefaultAppId){
      const item=defaultApps.find(function(app){return app.id===editingDefaultAppId;});
      if(item){
        item.name=name.slice(0,70);
        item.packageName=packageName;
        item.openUrl=openUrl;
        item.downloadUrl=downloadUrl;
        item.icon=icon.slice(0,500);
      }
    }else{
      defaultApps.push({
        id:"app_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
        name:name.slice(0,70),
        packageName:packageName,
        openUrl:openUrl,
        downloadUrl:downloadUrl,
        icon:icon.slice(0,500),
        enabled:true
      });
    }
    const wasEditing=Boolean(editingDefaultAppId);
    persistDefaultApps();
    closeDefaultAppEditor();
    renderDefaultApps();
    notify(wasEditing?"Đã cập nhật ứng dụng":"Đã thêm ứng dụng mặc định");
  };

  window.adminToggleDefaultApp=function(id){
    if(!isAdmin()){notify("Chỉ Admin mới có quyền bật hoặc tắt ứng dụng");return;}
    const item=defaultApps.find(function(app){return app.id===id;});
    if(!item)return;
    item.enabled=!item.enabled;
    persistDefaultApps();
    renderDefaultApps();
    notify(item.enabled?"Đã bật "+item.name:"Đã tắt "+item.name);
  };

  window.adminDeleteDefaultApp=function(id){
    if(!isAdmin()){notify("Chỉ Admin mới có quyền xóa ứng dụng");return;}
    const item=defaultApps.find(function(app){return app.id===id;});
    if(!item)return;
    if(!confirm("Xóa ứng dụng “"+item.name+"” khỏi danh sách mặc định?"))return;
    defaultApps=defaultApps.filter(function(app){return app.id!==id;});
    persistDefaultApps();
    renderDefaultApps();
    notify("Đã xóa ứng dụng");
  };

  window.renderDefaultApps=function(){
    const list=document.getElementById("defaultAppList");
    const count=document.getElementById("defaultAppCount");
    const note=document.getElementById("defaultAppAdminNote");
    const addButton=document.getElementById("defaultAppAddButton");
    if(!list||!count)return;
    const admin=isAdmin();
    const active=defaultApps.filter(function(item){return item.enabled;}).length;
    count.textContent=active+"/"+defaultApps.length+" ứng dụng đang bật";
    if(note){
      note.classList.remove("hidden");
      note.textContent=admin
        ?"Admin có thể thêm, sửa, bật/tắt hoặc xóa ứng dụng. Người dùng thường chỉ được mở ứng dụng đang bật."
        :"Danh sách ứng dụng do Admin quản lý. Bạn không thể sửa hoặc xóa.";
    }
    if(addButton)addButton.classList.toggle("hidden",!admin);

    if(!defaultApps.length){
      list.innerHTML='<div class="empty">'+(admin?'Chưa có ứng dụng. Nhấn “Thêm ứng dụng” để tạo mục đầu tiên.':'Admin chưa thêm ứng dụng mặc định.')+'</div>';
      return;
    }

    list.innerHTML=defaultApps.map(function(item){
      const status=item.enabled?'<span class="webStatus on">Đang hoạt động</span>':'<span class="webStatus off">Tạm tắt</span>';
      const detail=admin?(item.packageName?safeText(item.packageName):safeText(item.openUrl||item.downloadUrl||"Liên kết ứng dụng")):"";
      const detailMarkup=detail?'<small>'+detail+'</small>':'';
      const disabled=item.enabled?'':' disabled aria-disabled="true"';
      const adminActions=admin
        ?'<div class="defaultAppAdminActions">'+
          '<button type="button" onclick="openDefaultAppEditor(\''+item.id+'\')">✎ Sửa</button>'+
          '<button type="button" class="webToggle '+(item.enabled?'on':'off')+'" onclick="adminToggleDefaultApp(\''+item.id+'\')">'+(item.enabled?'Tắt':'Bật')+'</button>'+
          '<button type="button" class="appDeleteBtn" onclick="adminDeleteDefaultApp(\''+item.id+'\')">Xóa</button>'+
          '</div>'
        :'';
      return '<article class="defaultAppCard '+(item.enabled?'':'disabled')+'">'+
        '<div class="defaultAppTop">'+
          '<div class="defaultAppIcon">'+appIconMarkup(item.icon,item.name)+'</div>'+
          '<div class="webItemText"><div class="defaultWebTitle"><b>'+safeText(item.name)+'</b>'+status+'</div>'+detailMarkup+'</div>'+
          '<button class="defaultOpenBtn" type="button"'+disabled+' onclick="openDefaultApp(\''+item.id+'\')">Mở <span>›</span></button>'+
        '</div>'+adminActions+
      '</article>';
    }).join("");
  };

  function launchInApp(url){
    try{
      if(window.Android&&typeof Android.openExternal==="function"){
        Android.openExternal("m4x-inapp:"+url);
        return;
      }
    }catch(_){}
    location.href=url;
  }

  window.openWebUrl=function(value){
    const url=normalizeUrl(value);
    if(!url){notify("Link web không hợp lệ. Hãy dùng link HTTP hoặc HTTPS.");return;}
    launchInApp(url);
  };

  window.openDefaultWebLink=function(id){
    const item=defaultLinks.find(function(link){return link.id===id;});
    if(!item)return;
    if(!item.enabled&&!isAdmin()){
      notify("Mục này đang được Admin tắt");
      return;
    }
    if(item.adult){
      const accepted=confirm("Nội dung 18+. Bạn xác nhận đã đủ 18 tuổi để tiếp tục?");
      if(!accepted)return;
    }
    launchInApp(item.url);
  };

  window.adminEditDefaultWebLink=function(id){
    if(!isAdmin()){
      notify("Chỉ Admin mới có quyền thay đổi link");
      return;
    }
    const item=defaultLinks.find(function(link){return link.id===id;});
    if(!item)return;
    const value=prompt("Nhập link mới cho “"+item.title+"”:",item.url);
    if(value===null)return;
    const url=normalizeUrl(value);
    if(!url){notify("Link không hợp lệ");return;}
    item.url=url;
    persistDefaultLinks();
    renderDefaultWebLinks();
    notify("Đã cập nhật link "+item.title);
  };

  window.adminToggleDefaultWebLink=function(id){
    if(!isAdmin()){
      notify("Chỉ Admin mới có quyền bật hoặc tắt mục này");
      return;
    }
    const item=defaultLinks.find(function(link){return link.id===id;});
    if(!item)return;
    item.enabled=!item.enabled;
    persistDefaultLinks();
    renderDefaultWebLinks();
    notify(item.enabled?"Đã bật "+item.title:"Đã tắt "+item.title);
  };

  window.renderDefaultWebLinks=function(){
    const list=document.getElementById("defaultWebsiteList");
    const count=document.getElementById("defaultWebsiteCount");
    const adminNote=document.getElementById("defaultWebsiteAdminNote");
    if(!list||!count)return;

    const admin=isAdmin();
    const visible=defaultLinks.slice();
    const activeCount=defaultLinks.filter(function(item){return item.enabled;}).length;
    count.textContent=activeCount+"/"+defaultLinks.length+" mục đang bật";

    if(adminNote){
      adminNote.classList.remove("hidden");
      adminNote.textContent=admin
        ?"Quản trị liên kết: chỉ Admin được đổi link và bật/tắt. Ba mục mặc định không thể xóa."
        :"Các mục mặc định do Admin quản lý. Bạn chỉ có quyền mở mục đang bật.";
    }

    list.innerHTML=visible.map(function(item){
      const status=item.enabled?'<span class="webStatus on">Đang hoạt động</span>':'<span class="webStatus off">Tạm tắt</span>';
      const subText=admin?safeText(item.url):"";
      const subTextMarkup=subText?'<small>'+subText+'</small>':'';
      const openDisabled=!item.enabled?' disabled aria-disabled="true"':'';
      const adminActions=admin
        ?'<div class="webAdminActions">'+
          '<button type="button" onclick="adminEditDefaultWebLink(\''+item.id+'\')">✎ Đổi link</button>'+
          '<button type="button" class="webToggle '+(item.enabled?'on':'off')+'" onclick="adminToggleDefaultWebLink(\''+item.id+'\')">'+(item.enabled?'Tắt mục':'Bật mục')+'</button>'+
          '</div>'
        :'';
      return '<article class="defaultWebCard '+(item.enabled?'':'disabled')+'">'+
        '<div class="defaultWebTop">'+
          '<div class="webItemIcon">'+safeText(item.icon)+'</div>'+
          '<div class="webItemText"><div class="defaultWebTitle"><b>'+safeText(item.title)+'</b>'+status+'</div>'+subTextMarkup+'</div>'+
          '<button class="defaultOpenBtn" type="button"'+openDisabled+' onclick="openDefaultWebLink(\''+item.id+'\')">Mở <span>›</span></button>'+
        '</div>'+adminActions+
      '</article>';
    }).join("");
  };

  window.openWebFromInput=function(save){
    const urlNode=document.getElementById("webUrlInput");
    const titleNode=document.getElementById("webTitleInput");
    const url=normalizeUrl(urlNode?urlNode.value:"");
    if(!url){notify("Hãy dán một link web hợp lệ");return;}
    const title=(titleNode&&titleNode.value.trim())||defaultTitle(url);
    if(urlNode)urlNode.value=url;
    if(save){
      const found=savedSites.findIndex(function(item){return normalizeUrl(item.url)===url;});
      if(found>=0)savedSites.splice(found,1);
      savedSites.unshift({title:title,url:url});
      savedSites=savedSites.slice(0,30);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(savedSites));
      renderSavedWebsites();
    }
    launchInApp(url);
  };

  window.removeSavedWebsite=function(index){
    savedSites.splice(index,1);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(savedSites));
    renderSavedWebsites();
  };

  window.copySavedWebsite=async function(index){
    const item=savedSites[index];
    if(!item)return;
    try{
      await navigator.clipboard.writeText(item.url);
      notify("Đã sao chép link");
    }catch(_){notify(item.url);}
  };

  window.renderSavedWebsites=function(){
    const list=document.getElementById("savedWebsiteList");
    const count=document.getElementById("savedWebsiteCount");
    if(!list||!count)return;
    count.textContent=savedSites.length+" trang";
    if(!savedSites.length){
      list.innerHTML='<div class="empty">Chưa có website đã lưu</div>';
      return;
    }
    list.innerHTML=savedSites.map(function(item,index){
      const url=JSON.stringify(item.url).replace(/"/g,"&quot;");
      return '<div class="webItem"><div class="webItemIcon">🌐</div><div class="webItemText"><b>'+safeText(item.title||defaultTitle(item.url))+'</b><small>'+safeText(item.url)+'</small></div><div class="webItemActions"><button type="button" onclick="openWebUrl('+url+')">Mở</button><button type="button" onclick="copySavedWebsite('+index+')">⧉</button><button type="button" class="webDelete" onclick="removeSavedWebsite('+index+')">×</button></div></div>';
    }).join("");
  };

  function renderAllWebLists(){
    renderDefaultWebLinks();
    renderDefaultApps();
    renderSavedWebsites();
  }

  function installShowPageHook(){
    if(typeof window.showPage!=="function"||window.__m4xWebWrapped)return;
    const originalShowPage=window.showPage;
    window.__m4xWebWrapped=true;
    window.showPage=function(name){
      originalShowPage(name);
      if(name==="web")setTimeout(renderAllWebLists,0);
    };
  }

  function installInputShortcut(){
    const input=document.getElementById("webUrlInput");
    if(input&&!input.__m4xEnterBound){
      input.__m4xEnterBound=true;
      input.addEventListener("keydown",function(event){
        if(event.key==="Enter"){
          event.preventDefault();
          window.openWebFromInput(false);
        }
      });
    }
  }

  loadDefaultLinks();
  loadDefaultApps();
  window.addEventListener("load",function(){
    installShowPageHook();
    installInputShortcut();
    renderAllWebLists();
  });
  setTimeout(function(){
    installShowPageHook();
    installInputShortcut();
    renderAllWebLists();
  },1000);
})();
