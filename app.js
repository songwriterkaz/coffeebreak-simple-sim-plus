var $=function(s){return document.querySelector(s)};
var P='cbsplus-',BASE=location.origin+location.pathname,q=new URLSearchParams(location.search);
function clean(n){n=n||'';var m=String(n).match(/[?&]call=([^&#]+)/)||String(n).match(/[?&]me=([^&#]+)/);if(m)n=decodeURIComponent(m[1]);return n.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20)}
function nameOf(pid){return pid.slice(P.length).split('-')[0]}
var me=clean(q.get('me'))||clean(localStorage.getItem('cbs_me')),target=clean(q.get('call'));
var dev=localStorage.getItem('cbsp_dev');if(!dev){dev=Math.random().toString(36).slice(2,8);localStorage.setItem('cbsp_dev',dev)}
// contacts: {k,n,sim,tel,t,del}
var book=JSON.parse(localStorage.getItem('cbsp_book')||'[]');
var peer,conn,mcall,stream,muted=false,paused=false,wake,second=false,ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
try{var ic=JSON.parse(localStorage.getItem('cbs_ice')||'null');if(ic&&ic.iceServers)ICE=ic}catch(e){}
fetch('https://songwriterkaz.github.io/coffeebreak-ice/ice.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.iceServers){ICE={iceServers:j.iceServers};localStorage.setItem('cbs_ice',JSON.stringify(ICE))}}).catch(function(){});
function st(t,ok){$('#st').textContent=t;$('#st').className=ok?'ok':''}
function key(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function live(){return book.filter(function(c){return !c.del})}
function store(){localStorage.setItem('cbsp_book',JSON.stringify(book));fill();drawList()}
function merge(list,quiet){var ch=0;(list||[]).forEach(function(c){if(!c||!c.k)return;var o=book.find(function(x){return x.k==c.k});
if(!o){book.push({k:c.k,n:c.n||c.k,sim:clean(c.sim),tel:c.tel||'',t:c.t||Date.now(),del:!!c.del});ch++}
else if((c.t||0)>(o.t||0)){o.n=c.n||o.n;o.sim=clean(c.sim);o.tel=c.tel||'';o.t=c.t;o.del=!!c.del;ch++}});
if(ch){store();if(!quiet)push()}return ch}
function upsert(n,sim,tel){var k=key(n||sim);if(!k)return;var o=book.find(function(x){return x.k==k});merge([{k:k,n:n||sim,sim:sim||(o&&o.sim)||'',tel:tel||(o&&o.tel)||'',t:Date.now(),del:false}])}
function save(sim){if(!sim||sim==me)return;if(book.some(function(c){return c.sim==sim&&!c.del}))return;upsert(sim,sim,'')}
function fill(){var w=$('#who');w.innerHTML='';var L=live().filter(function(c){return c.sim});if(!L.length){w.innerHTML='<option value="">Share your link to add people</option>';return}
L.forEach(function(c){var o=document.createElement('option');o.value=c.sim;o.textContent=c.n;w.appendChild(o)});if(target)w.value=target}
$('#who').onchange=function(){target=this.value;link()};
// ---- own-device contact sync over ntfy ----
var lastPush='';
function push(){if(!me)return;var body=JSON.stringify({d:dev,b:book});if(body==lastPush)return;lastPush=body;fetch('https://ntfy.sh/cbsplus-sync-'+me,{method:'POST',body:body}).catch(function(){})}
function syncListen(){try{var es=new EventSource('https://ntfy.sh/cbsplus-sync-'+me+'/sse?since=12h');es.onmessage=function(e){try{var m=JSON.parse(JSON.parse(e.data).message);if(m.d==dev)return;var ch=merge(m.b,true);
var mine=JSON.stringify(book.slice().sort(function(a,b){return a.k<b.k?-1:1})),theirs=JSON.stringify((m.b||[]).slice().sort(function(a,b){return a.k<b.k?-1:1}));if(mine!=theirs){lastPush='';push()}}catch(x){}}}catch(e){}}
// ---- start ----
if(location.hash.indexOf('#c=')==0){try{var got=JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3)))));var n=merge(got.map(function(c){return {k:key(c.n||c.sim),n:c.n,sim:c.sim,tel:c.tel,t:Date.now()}}));setTimeout(function(){st('Added '+n+' contacts',true)},2500)}catch(e){}history.replaceState(null,'',location.pathname+location.search)}
if(!me){$('#setup').classList.remove('hide');$('#nm').focus()}else go();
$('#start').onclick=function(){var n=clean($('#nm').value);if(!n){$('#nm').focus();return}me=n;go()};
$('#nm').onkeydown=function(e){if(e.key=='Enter')$('#start').click()};
function go(){localStorage.setItem('cbs_me',me);var u=BASE+'?me='+me+(target?'&call='+target:'');history.replaceState(null,'',u);
$('#setup').classList.add('hide');$('#app').classList.remove('hide');$('#me').textContent='You are '+me;if(target)save(target);fill();awake();net();
waitFor('QRCode',function(){new QRCode($('#qr'),{text:BASE+'?call='+me,width:120,height:120,colorDark:'#7a1f48'})});
waitFor('Peer',start);listen();syncListen();setTimeout(function(){lastPush='';push()},1500)}
function waitFor(n,f){if(window[n])f();else setTimeout(function(){waitFor(n,f)},150)}
var tries=0;
function start(){st('Going online');if(peer)try{peer.destroy()}catch(e){}
peer=new Peer(second?P+me+'-'+dev:P+me,{config:ICE,debug:0});
peer.on('open',function(){tries=0;st(target?'Connecting to '+target:'Online. Ready',!target);link()});
peer.on('connection',function(c){bind(c)});
peer.on('call',function(c){mcall=c;var n=nameOf(c.peer);save(n);target=n;fill();$('#ans').hidden=false;$('#call').classList.add('hide');st(n+' is calling');ring(true)});
peer.on('disconnected',function(){st('Reconnecting');setTimeout(function(){try{peer.reconnect()}catch(e){start()}},1500)});
peer.on('error',function(e){if(e.type=='unavailable-id'){st('Reconnecting');if(tries>=2)second=true;setTimeout(start,3000+Math.min(tries++,5)*1500)}else if(e.type=='peer-unavailable'){st(target+' is offline. Waiting');ntfy(target)}else if(e.type=='network'||e.type=='server-error'||e.type=='socket-error'){st('Reconnecting');setTimeout(start,3000)}})}
// a second phone with the same name uses its own id, and tries to take the main one back now and then
setInterval(function(){if(second&&!mcall){second=false;tries=2;start()}},90000);
function link(){if(!target||!peer||!peer.open)return;if(conn&&conn.open&&nameOf(conn.peer)==target)return;bind(peer.connect(P+target,{reliable:true}))}
function bind(c){c.on('open',function(){conn=c;var n=nameOf(c.peer);save(n);if(!target){target=n;fill()}st('Connected to '+n,true)});
c.on('data',function(d){if(d=='bye'&&mcall){try{mcall.close()}catch(e){}endUI()}});c.on('close',function(){if(conn==c){conn=null;st('Reconnecting')}});c.on('error',function(){})}
setInterval(function(){if(peer&&peer.disconnected&&!peer.destroyed)try{peer.reconnect()}catch(e){};if(target&&!(conn&&conn.open))link()},6000);
function ntfy(n){fetch('https://ntfy.sh/cbsplus-'+n,{method:'POST',body:me}).catch(function(){})}
function listen(){try{var es=new EventSource('https://ntfy.sh/cbsplus-'+me+'/sse');es.onmessage=function(e){try{var n=clean(JSON.parse(e.data).message);if(n&&n!=me){save(n);if(!(conn&&conn.open)){target=n;fill();link()}}}catch(x){}}}catch(e){}}
function mic(){if(stream)return Promise.resolve(stream);return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}).then(function(s){stream=s;return s})}
function media(c){mcall=c;c.on('stream',function(s){var a=$('#au');a.srcObject=s;a.play().catch(function(){});st('On call with '+nameOf(c.peer),true)});
c.on('close',endUI);c.on('error',endUI);$('#call').textContent='END';$('#call').classList.add('end');$('#call').classList.remove('hide');$('#ans').hidden=true}
function endUI(){mcall=null;ring(false);$('#call').textContent='CALL';$('#call').classList.remove('end','hide');$('#ans').hidden=true;st(conn&&conn.open?'Connected to '+target:'Online. Ready',true)}
function callTo(sim){if(mcall)return;target=sim;fill();link();$('#call').click();window.scrollTo(0,0)}
$('#call').onclick=function(){if(mcall){try{conn&&conn.open&&conn.send('bye')}catch(e){}mcall.close();endUI();return}target=target||$('#who').value;if(!target){st('Share your link first');return}
if(!peer||!peer.open){st('Still going online');return}st('Calling '+target);mic().then(function(s){media(peer.call(P+target,s))}).catch(function(){st('Allow the microphone')})};
$('#ans').onclick=function(){ring(false);var c=mcall;mic().then(function(s){c.answer(s);media(c)}).catch(function(){st('Allow the microphone')})};
$('#mute').onclick=function(){muted=!muted;if(stream)stream.getAudioTracks().forEach(function(t){t.enabled=!muted&&!paused});this.classList.toggle('on',muted);this.textContent=muted?'Unmute':'Mute'};
$('#pause').onclick=function(){paused=!paused;if(stream)stream.getAudioTracks().forEach(function(t){t.enabled=!muted&&!paused});$('#au').muted=paused;this.classList.toggle('on',paused);this.textContent=paused?'Resume':'Pause'};
function shareIt(o,fb){if(navigator.share)navigator.share(o).catch(function(){});else{(navigator.clipboard?navigator.clipboard.writeText(fb):Promise.reject()).then(function(){st('Link copied',true)}).catch(function(){prompt('Copy this',fb)})}}
$('#share').onclick=function(){var u=BASE+'?call='+me;shareIt({title:'Call me',url:u},u)};
var rt;function ring(on){clearInterval(rt);if(on&&navigator.vibrate)rt=setInterval(function(){navigator.vibrate(400)},1200)}
function awake(){if('wakeLock' in navigator)navigator.wakeLock.request('screen').then(function(w){wake=w}).catch(function(){})}
function revive(){net();if(!peer||peer.destroyed){waitFor('Peer',start);return}if(peer.disconnected)try{peer.reconnect()}catch(e){start()};link()}
document.addEventListener('visibilitychange',function(){if(!document.hidden){awake();revive()}});
// ---- network status ----
function net(){var c=navigator.connection,t;if(!navigator.onLine)t='No internet';else if(c&&c.type=='wifi')t='On WiFi';else if(c&&c.type=='cellular')t='On mobile data';else if(c&&c.type&&c.type!='unknown'&&c.type!='none')t='On hotspot/WiFi';else t='Online';$('#net').textContent=t}
window.addEventListener('online',function(){revive();setTimeout(revive,2000)});window.addEventListener('offline',function(){net();st('No internet. Waiting')});
if(navigator.connection&&navigator.connection.addEventListener)navigator.connection.addEventListener('change',function(){setTimeout(revive,1500)});
// ---- More panels ----
var panels=['pContacts','pAdd','pScan','pHot','pBt','pImp','pSend'];
function show(id){panels.forEach(function(p){$('#'+p).classList.toggle('hide',p!=id||!$('#'+p).classList.contains('hide'))});if(id!='pScan')stopScan()}
$('#more').onclick=function(){var b=$('#morebox');b.classList.toggle('hide');this.textContent=b.classList.contains('hide')?'More':'Close'};
$('#bContacts').onclick=function(){drawList();show('pContacts')};
var editing=null;
$('#bAdd').onclick=function(){editing=null;$('#addh').textContent='Add contact';$('#cn').value=$('#cs').value=$('#ct').value='';show('pAdd')};
$('#csave').onclick=function(){var n=$('#cn').value.trim(),s=clean($('#cs').value),t=$('#ct').value.replace(/[^0-9+]/g,'');if(!n&&!s){$('#cn').focus();return}
if(editing&&editing!=key(n||s))merge([{k:editing,t:Date.now(),del:true,n:'',sim:'',tel:''}]);upsert(n||s,s,t);editing=null;st('Saved',true);drawList();show('pContacts')};
function drawList(){var L=live().sort(function(a,b){return a.n.localeCompare(b.n)}),d=$('#clist');d.innerHTML=L.length?'':'<div>No contacts yet</div>';
L.forEach(function(c){var r=document.createElement('div');r.className='ct';var s=document.createElement('span');s.textContent=c.n;r.appendChild(s);
function btn(t,cl,f){var b=document.createElement('button');b.textContent=t;if(cl)b.className=cl;b.onclick=f;r.appendChild(b)}
if(c.sim)btn('📞 Call','g',function(){callTo(c.sim)});
if(c.tel)btn('☎️ Phone','',function(){location.href='tel:'+c.tel});
btn('✏️','',function(){editing=c.k;$('#addh').textContent='Edit contact';$('#cn').value=c.n;$('#cs').value=c.sim;$('#ct').value=c.tel;show('pAdd')});
btn('🗑️','',function(){if(confirm('Delete '+c.n+'?'))merge([{k:c.k,n:c.n,sim:'',tel:'',t:Date.now(),del:true}])});d.appendChild(r)})}
// ---- QR scan ----
var camS,scanT;
function stopScan(){clearTimeout(scanT);if(camS)camS.getTracks().forEach(function(t){t.stop()});camS=null}
function gotCode(txt){var s=clean(txt);stopScan();if(!s){st('Not a SIM code');return}upsert(s,s,'');target=s;fill();link();st('Added '+s,true);show('pContacts')}
function loadJsQR(f){if(window.jsQR)return f();var sc=document.createElement('script');sc.src='jsQR.js';sc.onload=f;document.head.appendChild(sc)}
$('#bScan').onclick=function(){show('pScan');if($('#pScan').classList.contains('hide'))return;var v=$('#cam');
navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(s){camS=s;v.srcObject=s;v.play();
var det=('BarcodeDetector' in window)?new BarcodeDetector({formats:['qr_code']}):null,cv=document.createElement('canvas'),cx=cv.getContext('2d');
function tick(){if(!camS)return;if(v.readyState<2){scanT=setTimeout(tick,200);return}
if(det)det.detect(v).then(function(r){if(r.length)gotCode(r[0].rawValue);else scanT=setTimeout(tick,250)}).catch(function(){det=null;tick()});
else loadJsQR(function(){cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);var r=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);if(r)gotCode(r.data);else scanT=setTimeout(tick,300)})}
tick()}).catch(function(){st('Allow the camera')})};
$('#scanstop').onclick=function(){stopScan();show('pScan')};
// ---- Hotspot ----
$('#bHot').onclick=function(){net();show('pHot')};
// ---- Bluetooth audio output ----
$('#bBt').onclick=function(){show('pBt');var a=$('#au');if(!a.setSinkId&&!(navigator.mediaDevices&&navigator.mediaDevices.selectAudioOutput)){$('#btpick').classList.add('hide');$('#btmsg').textContent='Connect your headset or car in Bluetooth settings. The call sound goes there by itself.'}};
$('#btpick').onclick=function(){var a=$('#au'),md=navigator.mediaDevices;
if(md.selectAudioOutput){md.selectAudioOutput().then(function(d){return a.setSinkId(d.deviceId).then(function(){st('Sound on '+(d.label||'speaker'),true)})}).catch(function(){});return}
mic().then(function(){return md.enumerateDevices()}).then(function(ds){var o=ds.filter(function(d){return d.kind=='audiooutput'}),s=$('#outs');s.innerHTML='';
o.forEach(function(d,i){var e=document.createElement('option');e.value=d.deviceId;e.textContent=d.label||('Speaker '+(i+1));s.appendChild(e)});s.classList.remove('hide');
s.onchange=function(){a.setSinkId(s.value).then(function(){st('Sound on '+s.options[s.selectedIndex].text,true)}).catch(function(){})}}).catch(function(){st('Allow the microphone')})};
// ---- vCard ----
function esc(s){return String(s||'').replace(/([,;\\])/g,'\\$1')}
function toVcf(L){return L.map(function(c){return ['BEGIN:VCARD','VERSION:3.0','FN:'+esc(c.n),'N:'+esc(c.n)+';;;;',c.tel?'TEL;TYPE=CELL:'+c.tel:'',c.sim?'URL:'+BASE+'?call='+c.sim:'',c.sim?'NOTE:Coffeebreak SIM '+c.sim:'','END:VCARD'].filter(Boolean).join('\r\n')}).join('\r\n')+'\r\n'}
function fromVcf(txt){var out=[];txt.replace(/\r?\n[ \t]/g,'').split(/BEGIN:VCARD/i).forEach(function(b){if(!/END:VCARD/i.test(b))return;var c={n:'',sim:'',tel:''};
b.split(/\r?\n/).forEach(function(l){var i=l.indexOf(':');if(i<0)return;var k=l.slice(0,i).toUpperCase().split(';')[0].replace(/^ITEM\d+\./,''),v=l.slice(i+1).replace(/\\([,;\\])/g,'$1');
if(k=='FN')c.n=v.trim();else if(k=='N'&&!c.n)c.n=v.split(';').reverse().filter(Boolean).join(' ').trim();else if(k=='TEL'&&!c.tel)c.tel=v.replace(/[^0-9+]/g,'');else if(k=='URL'&&/[?&]call=/.test(v))c.sim=clean(v)});
if(c.n||c.sim||c.tel)out.push(c)});return out}
function addMany(L){var t=Date.now();return merge(L.map(function(c){var n=c.n||c.sim||c.tel;return {k:key(n),n:n,sim:c.sim||'',tel:c.tel||'',t:t}}).filter(function(c){return c.k}))}
$('#bImp').onclick=function(){if(!('contacts' in navigator&&'ContactsManager' in window))$('#pick').classList.add('hide');show('pImp')};
$('#pick').onclick=function(){navigator.contacts.select(['name','tel'],{multiple:true}).then(function(r){var n=addMany(r.map(function(c){return {n:(c.name||[])[0]||'',tel:((c.tel||[])[0]||'').replace(/[^0-9+]/g,'')}}));st('Added '+n+' contacts',true);show('pContacts')}).catch(function(){})};
$('#vcfbtn').onclick=function(){$('#vcf').click()};
$('#vcf').onchange=function(){var f=this.files[0];if(!f)return;f.text().then(function(t){var n=addMany(fromVcf(t));st('Added '+n+' contacts',true);drawList();show('pContacts')});this.value=''};
function vcfFile(){return new File([toVcf(live())],'coffeebreak-contacts.vcf',{type:'text/vcard'})}
function download(f){var a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000)}
$('#bSave').onclick=function(){if(!live().length){st('No contacts yet');return}download(vcfFile());st('Contacts file saved',true)};
$('#bSend').onclick=function(){show('pSend')};
$('#sendlink').onclick=function(){var L=live().map(function(c){return {n:c.n,sim:c.sim,tel:c.tel}});var u=BASE+'#c='+btoa(unescape(encodeURIComponent(JSON.stringify(L))));shareIt({title:'My Coffeebreak contacts',url:u},u)};
$('#sendfile').onclick=function(){var f=vcfFile();if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],title:'My contacts'}).catch(function(){});else download(f)};
if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
