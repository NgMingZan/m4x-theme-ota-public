(function(){
  "use strict";
  const state={last:null};
  const byId=id=>document.getElementById(id);
  const nativeFn=name=>Boolean(window.Android&&typeof window.Android[name]==="function");

  function ensureUi(){
    if(byId("m4xOtaOverlay"))return;
    const wrap=document.createElement("div");
    wrap.id="m4xOtaOverlay";
    wrap.innerHTML=`
      <section id="m4xOtaSheet" role="dialog" aria-modal="true" aria-labelledby="m4xOtaTitle">
        <div class="m4xOtaHead">
          <div>
            <div id="m4xOtaTitle" class="m4xOtaTitle">Cập nhật trực tuyến</div>
            <div id="m4xOtaStatus">Sẵn sàng kiểm tra phiên bản mới từ máy chủ OTA.</div>
          </div>
          <button class="m4xOtaClose" type="button" aria-label="Đóng">×</button>
        </div>
        <div id="m4xOtaProgressWrap"><div id="m4xOtaProgress"></div></div>
        <div class="m4xOtaActions">
          <button id="m4xOtaCheckButton" type="button">Kiểm tra</button>
          <button id="m4xOtaInstallButton" type="button" hidden>Cập nhật ngay</button>
        </div>
      </section>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click",e=>{if(e.target===wrap)close();});
    wrap.querySelector(".m4xOtaClose").addEventListener("click",close);
    byId("m4xOtaCheckButton").addEventListener("click",check);
    byId("m4xOtaInstallButton").addEventListener("click",install);
  }

  function settingState(text){
    const el=byId("m4xOtaSettingState");
    if(el)el.textContent=text||"Kiểm tra ›";
  }
  function status(text){const el=byId("m4xOtaStatus");if(el)el.textContent=text;}
  function progress(value,show=true){
    const wrap=byId("m4xOtaProgressWrap"),bar=byId("m4xOtaProgress");
    if(!wrap||!bar)return;
    wrap.style.display=show?"block":"none";
    bar.style.width=Math.max(0,Math.min(100,Number(value)||0))+"%";
  }
  function open(){ensureUi();byId("m4xOtaOverlay").classList.add("show");}
  function close(){const el=byId("m4xOtaOverlay");if(el)el.classList.remove("show");}

  function check(showSheet=true){
    ensureUi();
    if(showSheet)open();
    const installBtn=byId("m4xOtaInstallButton");
    installBtn.hidden=true;
    installBtn.disabled=false;
    byId("m4xOtaCheckButton").disabled=true;
    progress(0,false);
    status("Đang kết nối máy chủ OTA…");
    settingState("Đang kiểm tra…");
    if(!nativeFn("checkOtaUpdate")){
      status("Bản APK này chưa có cầu nối OTA. Hãy build lại bằng bộ OTA đã bật.");
      settingState("Chưa hỗ trợ");
      byId("m4xOtaCheckButton").disabled=false;
      return;
    }
    try{window.Android.checkOtaUpdate();}
    catch(e){status("Không thể bắt đầu kiểm tra cập nhật.");settingState("Lỗi");byId("m4xOtaCheckButton").disabled=false;}
  }

  function versionParts(value){
    const match=String(value||"").trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    return match?[Number(match[1]||0),Number(match[2]||0),Number(match[3]||0)]:null;
  }

  function compareVersions(left,right){
    const a=versionParts(left),b=versionParts(right);
    if(!a||!b)return null;
    for(let i=0;i<3;i++){
      if(a[i]>b[i])return 1;
      if(a[i]<b[i])return -1;
    }
    return 0;
  }

  function currentAppVersion(){
    return String((window.appConfig&&window.appConfig.appVersion)||
      (byId("versionText")&&byId("versionText").textContent)||"1.0").trim();
  }

  function isLegacyServerVersion(result){
    const raw=String((result&&result.versionName)||"").trim();
    const parts=versionParts(raw);
    // Dòng đánh số cũ từng dùng 4.x/5.x. Sau khi khởi động lại từ 1.0,
    // các gói cũ này phải bị chặn để không ghi đè giao diện hiện tại.
    // OTA mới dùng 1.1, 1.2...; các dòng 2.x/3.x sau này vẫn được chấp nhận.
    return Boolean(parts&&parts[0]>=4);
  }

  function isSameOrOlderServerVersion(result){
    const server=String((result&&result.versionName)||"").trim();
    const compared=compareVersions(server,currentAppVersion());
    return compared!==null&&compared<=0;
  }

  function install(){
    if(!nativeFn("installOtaUpdate")){
      status("Không thể bắt đầu cập nhật trên bản APK này.");
      return;
    }
    byId("m4xOtaInstallButton").disabled=true;
    byId("m4xOtaCheckButton").disabled=true;
    progress(5,true);
    status("Đang chuẩn bị tải bản cập nhật…");
    settingState("Đang cập nhật…");
    try{window.Android.installOtaUpdate();}
    catch(e){status("Không thể khởi động bộ cập nhật.");settingState("Lỗi");byId("m4xOtaInstallButton").disabled=false;}
  }

  window.onM4XOtaStatus=function(result){
    ensureUi();
    if(!result)return;
    if(typeof result==="string"){
      try{result=JSON.parse(result);}catch(_){result={success:false,message:result};}
    }
    state.last=result;
    const installBtn=byId("m4xOtaInstallButton");
    const checkBtn=byId("m4xOtaCheckButton");

    if(result.phase){
      const phase=String(result.phase);
      progress(result.progress||0,true);
      status(result.message||"Đang cập nhật…");
      settingState(phase==="done"?"Đã cập nhật":phase==="error"?"Lỗi":"Đang cập nhật…");
      if(phase==="error"){
        installBtn.hidden=false;installBtn.disabled=false;checkBtn.disabled=false;
      }
      return;
    }

    checkBtn.disabled=false;
    progress(0,false);
    if(!result.success){
      status(result.message||"Không kết nối được máy chủ OTA.");
      settingState("Kiểm tra lại ›");
      installBtn.hidden=true;
      return;
    }
    if(result.compatible===false){
      status(result.message||"Bản cập nhật này yêu cầu cài APK mới.");
      settingState("Cần APK mới");
      installBtn.hidden=true;
      return;
    }
    if(result.available&&isSameOrOlderServerVersion(result)){
      close();
      status("Bạn đang dùng phiên bản mới nhất ("+currentAppVersion()+"). Gói OTA "+String(result.versionName||"")+" trên máy chủ đã được bỏ qua.");
      settingState("Mới nhất");
      installBtn.hidden=true;
      installBtn.disabled=true;
      return;
    }
    if(result.available&&isLegacyServerVersion(result)){
      close();
      const version=result.versionName?" "+result.versionName:"";
      status("Máy chủ đang chứa gói thuộc dòng phiên bản cũ"+version+". Bản này đã bị chặn để không làm mất giao diện Web mới.");
      settingState("Đã bỏ qua bản cũ");
      installBtn.hidden=true;
      return;
    }
    if(result.available){
      const version=result.versionName?" "+result.versionName:"";
      status("Có bản cập nhật"+version+(result.message?" — "+result.message:""));
      settingState("Có bản"+version+" ›");
      installBtn.hidden=false;installBtn.disabled=false;
      return;
    }
    status(result.message||"Bạn đang dùng phiên bản mới nhất.");
    settingState("Mới nhất");
    installBtn.hidden=true;
  };

  window.M4XOta={open,close,check,install};
  window.addEventListener("load",function(){
    ensureUi();
    setTimeout(function(){
      try{if(nativeFn("markOtaReady"))window.Android.markOtaReady();}catch(_){}
    },900);
    setTimeout(function(){if(nativeFn("checkOtaUpdate"))check(false);},3500);
  });
})();
