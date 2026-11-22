/* Gemeinsame Basis – Gerüst wird hier eingefügt, Marke kommt aus window.BRAND (brand.js der Variante) */
(()=>{const BR=window.BRAND||{};
document.title=BR.name||'Rechner';
document.body.insertAdjacentHTML('afterbegin','<div id="splash" aria-hidden="true"><img src="'+(BR.splash||'')+'" alt=""></div>'+`<div id="app">
  <header>
    <h1 id="title">Rechner</h1>
    <div>
      <button class="hbtn" id="btnTheme" aria-label="Hell/Dunkel wechseln">🌓</button>
      <button class="hbtn" id="btnSettings" aria-label="Einstellungen">⚙</button>
    </div>
  </header>
  <main id="main"></main>
  <nav id="tabbar" aria-label="Bereiche"></nav>
</div>

<dialog id="dlg">
  <div class="dlg">
    <h2>Einstellungen</h2>
    <div class="set-row"><span>Design</span><select class="inp" id="s-theme"><option value="auto">Automatisch</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></div>
    <div class="set-row"><span>Vibration bei Tasten</span><input type="checkbox" id="s-vib"></div>
    <div class="set-row"><span>Nachkommastellen (0–8)</span><input class="inp" id="s-dec" type="number" min="0" max="8" step="1" inputmode="numeric"></div>
    <div class="set-row"><span>Standard-Steuersatz (%)</span><input class="inp" id="s-tax" inputmode="decimal"></div>
    <div class="set-row"><span>Winkelmodus</span><select class="inp" id="s-ang"><option>DEG</option><option>RAD</option><option>GRAD</option></select></div>
    <div class="grid2" style="margin-top:14px"><button class="btn danger sm" id="s-reset">Alle Daten löschen</button><button class="btn sm" id="s-close">Fertig</button></div>
    <p class="hint" style="margin-bottom:0">Alle Daten bleiben nur auf diesem Gerät gespeichert.</p>
  </div>
</dialog>
<div id="toast" role="status" aria-live="polite"></div>`);
const t=document.querySelector('#title');if(t)t.textContent=BR.name||'Rechner';})();
(()=>{
'use strict';
/* ---------- Helfer ---------- */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function h(tag,p,...kids){const e=document.createElement(tag);for(const a in (p||{})){const v=p[a];if(v==null||v===false)continue;if(a==='class')e.className=v;else if(a==='style')e.style.cssText=v;else if(a==='html')e.innerHTML=v;else if(a.startsWith('on'))e.addEventListener(a.slice(2),v);else if(v===true)e.setAttribute(a,'');else e.setAttribute(a,v)}for(const c of kids.flat(9)){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(c))}return e}
const debounce=(f,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms)}};
const N=s=>{if(s==null)return NaN;s=String(s).trim().replace(/\s/g,'');if(!s)return NaN;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');return Number(s)};
const nfc={};const nf=(min,max)=>{const k=min+'/'+max;return nfc[k]||(nfc[k]=new Intl.NumberFormat('de-DE',{minimumFractionDigits:min,maximumFractionDigits:max}))};
const trimN=(n,max=6)=>nf(0,max).format(+n.toPrecision(12));
const raw=(n,max=8)=>String(+(+n).toFixed(max)).replace('.',',');
const EUR=n=>nf(2,2).format(Math.round(n*100)/100)+' €';
const pad=n=>String(n).padStart(2,'0');
const plain=v=>{if(Object.is(v,-0))v=0;const r=+v.toPrecision(12);const a=Math.abs(r);return(a===0||(a<1e21&&a>=1e-6))?String(r):null};

/* ---------- Zustand ---------- */
const BR=window.BRAND||{};
const KEY=BR.key||'rechner.v3';
const DEF={theme:'auto',vib:true,dec:2,tax:19,ang:'DEG',bar:BR.bar||['calc','sci','fx','post','price'],hist:[],mem:0,ans:0,fxRates:{},fxCustom:{},fxDate:'',fx:{from:'EUR',to:'USD',amt:'100'},tools:{},list:[],notes:'',tab:'calc',pr:{tax:null,qty:'1'},post:{len:'22',wid:'11',thick:'2',w:'20',qty:'1',bwVat:false,prices:{dp:{},bw:{}}}};
let S=JSON.parse(JSON.stringify(DEF));
try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');for(const k in o)S[k]=(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])&&DEF[k]&&typeof DEF[k]==='object')?Object.assign({},DEF[k],o[k]):o[k]}catch(e){}
S.post.prices=S.post.prices||{dp:{},bw:{}};
const saveNow=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const save=debounce(saveNow,250);
let tt;const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),1500)};
const vib=()=>{if(S.vib&&navigator.vibrate)try{navigator.vibrate(8)}catch(e){}};
const copy=async txt=>{try{await navigator.clipboard.writeText(txt)}catch(e){const t=h('textarea',{style:'position:fixed;opacity:0'});t.value=txt;document.body.append(t);t.select();try{document.execCommand('copy')}catch(_){}t.remove()}toast('Kopiert: '+txt)};
document.addEventListener('click',e=>{const c=e.target.closest('[data-copy]');if(c&&c.dataset.copy)copy(c.dataset.copy)});

/* ---------- Verlauf ---------- */
const BADGE={calc:'Rechner',sci:'Wiss.',fx:'Währung',price:'Preis',post:'Porto',extra:'Extra'};
function pushHist(type,expr,res,rawv){const last=S.hist[0];if(last&&last.expr===expr&&last.res===res)return;S.hist.unshift({type,expr,res,raw:rawv??null,t:Date.now()});S.hist=S.hist.slice(0,10);save();if(cur==='hist')renderHist()}
const logTimers={};const logLater=(type,expr,res,rawv)=>{clearTimeout(logTimers[type]);logTimers[type]=setTimeout(()=>pushHist(type,expr,res,rawv),1600)};
function renderHist(){
  const l=$('#h-list');l.innerHTML='';$('#h-count').textContent=S.hist.length?`${S.hist.length} von max. 10 Einträgen`:'';
  if(!S.hist.length){l.append(h('li',{class:'empty'},'Noch keine Einträge.'));return}
  S.hist.forEach((it,i)=>{
    const d=new Date(it.t);let lp;
    const li=h('li',{class:'h-item'},
      h('span',{class:'badge b-'+it.type},BADGE[it.type]||'Extra'),
      h('div',{class:'h-main'},h('div',{class:'h-expr'},it.expr),h('div',{class:'h-res'},it.res)),
      h('div',{class:'h-side'},h('span',{class:'h-time'},pad(d.getHours())+':'+pad(d.getMinutes())),
        h('div',{class:'h-btns'},
          h('button',{'aria-label':'Kopieren',onclick:e=>{e.stopPropagation();copy(it.raw||it.res)}},'⧉'),
          h('button',{'aria-label':'Löschen',onclick:e=>{e.stopPropagation();S.hist.splice(i,1);save();renderHist()}},'✕'))));
    li.addEventListener('pointerdown',()=>{lp=setTimeout(()=>{lp=null;copy(it.raw||it.res)},550)});
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>li.addEventListener(ev,()=>clearTimeout(lp)));
    li.addEventListener('click',()=>{if(it.raw&&!isNaN(N(it.raw))){calcs.calc.load(it.raw);showTab('calc')}else copy(it.res)});
    l.append(li)});
}

/* ---------- Rechenkern ---------- */
const toRad=(x,a)=>a==='DEG'?x*Math.PI/180:a==='GRAD'?x*Math.PI/200:x;
const fromRad=(x,a)=>a==='DEG'?x*180/Math.PI:a==='GRAD'?x*200/Math.PI:x;
const clean0=v=>Math.abs(v)<1e-14?0:v;
function fact(n){if(n<0||Math.abs(n-Math.round(n))>1e-9||n>170)throw new Error('Fakultät nicht definiert');n=Math.round(n);let r=1;for(let i=2;i<=n;i++)r*=i;return r}
function evaluate(src,ang,ans){
  const tk=[];let i=0;
  while(i<src.length){const c=src[i];
    if(c===' '){i++;continue}
    if(/[0-9.]/.test(c)){let j=i;while(j<src.length&&/[0-9.]/.test(src[j]))j++;tk.push({t:'n',v:parseFloat(src.slice(i,j))});i=j;continue}
    if(/[a-z]/.test(c)){let j=i;while(j<src.length&&/[a-z]/.test(src[j]))j++;tk.push({t:'i',v:src.slice(i,j)});i=j;continue}
    tk.push({t:'o',v:c});i++}
  let p=0;const isO=v=>tk[p]&&tk[p].t==='o'&&tk[p].v===v;
  const chk=v=>{if(!isFinite(v))throw new Error('Ungültige Eingabe');return v};
  function expr(){let l=term();while(isO('+')||isO('-')){const op=tk[p++].v;const r=term();const rv=r.pct?l.v*r.v:r.v;l={v:op==='+'?l.v+rv:l.v-rv,pct:false}}return l}
  function term(){let l=unary();while(isO('*')||isO('/')){const op=tk[p++].v;const r=unary();if(op==='/'&&r.v===0)throw new Error('Division durch 0');l={v:op==='*'?l.v*r.v:l.v/r.v,pct:false}}return l}
  function unary(){if(isO('-')){p++;const x=unary();return{v:-x.v,pct:x.pct}}if(isO('+')){p++;return unary()}return power()}
  function power(){const b=post();if(isO('^')){p++;const e=unary();if(b.v<0&&Math.abs(e.v-Math.round(e.v))>1e-12)throw new Error('Ungültige Eingabe');return{v:chk(Math.pow(b.v,e.v)),pct:false}}return b}
  function post(){let x=prim();for(;;){if(isO('!')){p++;x={v:chk(fact(x.v)),pct:false}}else if(isO('%')){p++;x={v:x.v/100,pct:true}}else break}return x}
  const F={sin:x=>clean0(Math.sin(toRad(x,ang))),cos:x=>clean0(Math.cos(toRad(x,ang))),
    tan:x=>{const full=ang==='DEG'?180:ang==='GRAD'?200:Math.PI;if(Math.abs(Math.abs(((x%full)+full)%full)-full/2)<1e-9)throw new Error('Nicht definiert');return clean0(Math.tan(toRad(x,ang)))},
    asin:x=>{if(Math.abs(x)>1)throw new Error('Nicht definiert');return fromRad(Math.asin(x),ang)},acos:x=>{if(Math.abs(x)>1)throw new Error('Nicht definiert');return fromRad(Math.acos(x),ang)},atan:x=>fromRad(Math.atan(x),ang),
    ln:x=>{if(x<=0)throw new Error('Nicht definiert');return Math.log(x)},log:x=>{if(x<=0)throw new Error('Nicht definiert');return clean0(Math.log10(x))},
    sqrt:x=>{if(x<0)throw new Error('Wurzel aus negativer Zahl');return Math.sqrt(x)},cbrt:Math.cbrt,abs:Math.abs};
  function prim(){const t=tk[p++];if(!t)throw new Error('Unvollständig');
    if(t.t==='n'){if(isNaN(t.v))throw new Error('Ungültige Zahl');return{v:t.v,pct:false}}
    if(t.t==='o'&&t.v==='('){const x=expr();if(isO(')'))p++;return{v:x.v,pct:false}}
    if(t.t==='i'){if(t.v==='pi')return{v:Math.PI,pct:false};if(t.v==='e')return{v:Math.E,pct:false};if(t.v==='ans')return{v:ans,pct:false};
      if(F[t.v]){if(!isO('('))throw new Error('Unvollständig');p++;const x=expr();if(isO(')'))p++;return{v:chk(F[t.v](x.v)),pct:false}}}
    throw new Error('Ungültige Eingabe')}
  const r=expr();if(p<tk.length)throw new Error('Ungültige Eingabe');return chk(r.v)}
function fmtRes(n){if(Object.is(n,-0))n=0;const r=+n.toPrecision(12);const a=Math.abs(r);if(a!==0&&(a>=1e15||a<1e-9))return r.toExponential().replace('.',',').replace('e','E');return nf(0,10).format(r)}
const dispExpr=s=>(s+')'.repeat(Math.max(0,(s.match(/\(/g)||[]).length-(s.match(/\)/g)||[]).length))).replace(/asin/g,'sin⁻¹').replace(/acos/g,'cos⁻¹').replace(/atan/g,'tan⁻¹').replace(/sqrt/g,'√').replace(/cbrt/g,'∛').replace(/\*/g,'×').replace(/\//g,'÷').replace(/-/g,'−').replace(/\./g,',').replace(/pi/g,'π').replace(/ans/g,'Ans').replace(/\^2/g,'²').replace(/\^3/g,'³');

function Calc(p,type){
  const st={s:'',done:false,err:null,shown:'',res:0,carry:''};
  const ex=$('#'+p+'-expr'),rs=$('#'+p+'-res'),mi=$('#'+p+'-m');
  const lastNum=()=>(st.s.match(/(\d*\.?\d*)$/)||[''])[0];
  const endsOperand=()=>/(\)|!|%|pi|ans|\d|\.)$|(^|[^a-z])e$/.test(st.s);
  const needMul=()=>/(\)|!|%|pi|ans)$|(^|[^a-z])e$/.test(st.s);
  function render(){
    ex.textContent=st.err?dispExpr(st.s):st.done?st.shown:dispExpr(st.s);
    rs.classList.remove('preview','err');let t='0',cp='';
    if(st.err){t=st.err;rs.classList.add('err')}
    else if(st.done){t=fmtRes(st.res);cp=raw(st.res,10)}
    else if(!st.s){t='0'}
    else if(/^\d*\.?\d*$/.test(st.s)){const[ip,fp]=st.s.split('.');t=nf(0,0).format(+(ip||0))+(fp!==undefined?','+fp:'');cp=st.s.replace('.',',')}
    else{try{const v=evaluate(st.s.replace(/[+\-*/^]+$/,''),S.ang,S.ans);t=fmtRes(v);cp=raw(v,10);rs.classList.add('preview')}catch(e){t=ex.textContent&&lastNum()?(nf(0,0).format(+lastNum()||0)+(lastNum().includes('.')?','+lastNum().split('.')[1]:'')):'0'}}
    rs.textContent=t;rs.dataset.copy=cp;
    mi.textContent=S.mem?'M':'';if(p==='sci')$('#sci-ang').textContent=S.ang}
  function curVal(){if(st.done)return st.res;try{return evaluate(st.s.replace(/[+\-*/^]+$/,''),S.ang,S.ans)}catch(e){return NaN}}
  function key(k){
    vib();
    if(st.err){st.err=null;st.s='';st.done=false}
    const O='+-*/^';
    if(k==='C'){st.s='';st.done=false;return render()}
    if(k==='BS'){if(st.done){st.s='';st.done=false}else st.s=st.s.replace(/([a-z]+\(|pi|ans|[\s\S])$/,'');return render()}
    if(k==='='){let src=st.s.replace(/[+\-*/^]+$/,'');if(!src){return render()}
      try{const v=evaluate(src,S.ang,S.ans);S.ans=v;st.res=v;st.shown=dispExpr(src)+' =';st.done=true;st.carry=plain(v)||'ans';
        if(/[^0-9.\-]/.test(src))pushHist(type,dispExpr(src),fmtRes(v),raw(v,10));save()}
      catch(e){st.err=e.message}return render()}
    if(['MC','MR','M+','M-'].includes(k)){
      if(k==='MC'){S.mem=0;toast('Speicher gelöscht')}
      else if(k==='MR'){if(st.done){st.s='';st.done=false}if(needMul())st.s+='*';const m=plain(S.mem)||'0';if(/\d$/.test(st.s)&&!needMul()){st.s=st.s.replace(/[\d.]+$/,'')}st.s+=(S.mem<0?'(':'')+m;}
      else{const v=curVal();if(isNaN(v))toast('Kein Wert');else{S.mem+=(k==='M+'?v:-v);S.mem=+S.mem.toPrecision(12);toast('Speicher: '+fmtRes(S.mem))}}
      save();return render()}
    if(k==='ANG'){S.ang=S.ang==='DEG'?'RAD':S.ang==='RAD'?'GRAD':'DEG';save();updAng();return render()}
    if(k==='2ND'){return}
    if(k==='NEG'){if(st.done){st.s=st.carry;st.done=false}
      const m=st.s.match(/(\(-)?(\d*\.?\d+|\d+\.)$/);
      if(m){st.s=m[1]?st.s.slice(0,m.index)+m[2]:st.s.slice(0,m.index)+'(-'+m[2]}
      else if(st.s===''||/[+\-*/^(]$/.test(st.s))st.s+='(-';
      else if(/\)$/.test(st.s)){}
      return render()}
    if(/^[0-9]$/.test(k)){if(st.done){st.s='';st.done=false}if(needMul())st.s+='*';if(/(^|[^0-9.])0$/.test(st.s))st.s=st.s.slice(0,-1);st.s+=k;return render()}
    if(k==='.'){if(st.done){st.s='';st.done=false}if(lastNum().includes('.'))return;if(needMul())st.s+='*';st.s+=lastNum()===''?'0.':'.';return render()}
    if(O.includes(k)){
      if(st.done){st.s=st.carry;st.done=false}
      if(st.s===''){if(k==='-')st.s='-';else st.s='0'+k;return render()}
      const last=st.s.slice(-1);
      if(last==='('){if(k==='-')st.s+=k}
      else if(O.includes(last)){if(st.s!=='-')st.s=st.s.slice(0,-1)+k}
      else st.s+=k;
      return render()}
    if(k==='('){if(st.done){st.s='';st.done=false}if(endsOperand()&&!/[+\-*/^(]$/.test(st.s))st.s+='*';st.s+='(';return render()}
    if(k===')'){const o=(st.s.match(/\(/g)||[]).length,c=(st.s.match(/\)/g)||[]).length;if(o>c&&endsOperand())st.s+=')';return render()}
    if(k==='!'||k==='%'){if(st.done){st.s=st.carry;st.done=false}if(endsOperand())st.s+=k;return render()}
    const ix=k.indexOf(':');
    if(ix>0){const kind=k.slice(0,ix),val=k.slice(ix+1);
      if(kind==='start'){if(st.done){st.s=val+st.carry+')';st.done=false;return render()}if(endsOperand())st.s+='*';st.s+=val;return render()}
      if(kind==='post'){if(st.done){st.s=st.carry;st.done=false}if(endsOperand())st.s+=val;return render()}
      if(kind==='const'){if(st.done){st.s='';st.done=false}if(endsOperand())st.s+='*';st.s+=val;return render()}}
  }
  return{key,render,load(v){st.s=String(v).replace(',','.');st.done=false;st.err=null;render()},get st(){return st}}
}

/* ---------- Tasten aufbauen ---------- */
const plusImg=()=>h('img',{src:BR.plusImg,alt:'+'});
const kb=(k,l,cls='',extra={})=>k==='+'&&BR.plusImg?h('button',Object.assign({class:'key plus '+cls,'data-k':k,type:'button','aria-label':'Plus'},extra),plusImg()):h('button',Object.assign({class:'key '+cls,'data-k':k,type:'button'},extra),l);
function buildCalc(){
  const a=['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','±','0',',','='];
  const ks=['C','BS','%','/','7','8','9','*','4','5','6','-','1','2','3','+','NEG','0','.','='];
  const cl=k=>k==='C'||k==='BS'||k==='%'||k==='NEG'?'fn':'+-*/'.includes(k)?'op':k==='='?'eq':'';
  return h('section',{class:'panel',id:'tab-calc'},
    h('div',{class:'disp'},h('div',{class:'ind'},h('span',{id:'calc-m'})),h('div',{class:'expr',id:'calc-expr'}),h('div',{class:'res',id:'calc-res',title:'Tippen zum Kopieren'},'0')),
    h('div',{class:'keys',id:'calc-keys'},ks.map((k,i)=>kb(k,a[i],cl(k)))))}
function buildSci(){
  const F=[['2ND','2nd','fn sm tog'],['ANG','DEG','fn sm'],['(','(','fn sm'],[')',')','fn sm'],['BS','⌫','fn sm'],
   ['start:sin(','sin','fn sm','start:asin(','sin⁻¹'],['start:cos(','cos','fn sm','start:acos(','cos⁻¹'],['start:tan(','tan','fn sm','start:atan(','tan⁻¹'],['start:ln(','ln','fn sm','start:e^(','eˣ'],['start:log(','log','fn sm','start:10^(','10ˣ'],
   ['post:^2','x²','fn sm','post:^3','x³'],['^','xʸ','fn sm','post:^(1/','ʸ√x'],['start:sqrt(','√','fn sm','start:cbrt(','∛'],['!','x!','fn sm','start:abs(','|x|'],['post:^(-1)','1/x','fn sm','%','%'],
   ['const:pi','π','fn sm'],['const:e','e','fn sm'],['const:ans','Ans','fn sm'],['NEG','±','fn sm'],['C','C','fn sm']];
  const Nn=[['MC','MC','fn sm'],['7','7'],['8','8'],['9','9'],['/','÷','op'],['MR','MR','fn sm'],['4','4'],['5','5'],['6','6'],['*','×','op'],['M+','M+','fn sm'],['1','1'],['2','2'],['3','3'],['-','−','op'],['M-','M−','fn sm'],['0','0'],['.',',',''],['=','=','eq'],['+','+','op']];
  return h('section',{class:'panel',id:'tab-sci'},
    h('div',{class:'disp'},h('div',{class:'ind'},h('span',{id:'sci-ang'},'DEG'),h('span',{id:'sci-m'})),h('div',{class:'expr',id:'sci-expr'}),h('div',{class:'res',id:'sci-res',title:'Tippen zum Kopieren'},'0')),
    h('div',{class:'sci-wrap'},
      h('div',{class:'keys',id:'sci-fn'},F.map(f=>kb(f[0],f[1],f[2],f[3]?{'data-ak':f[3],'data-l':f[1],'data-al':f[4]}:{}))),
      h('div',{class:'keys',id:'sci-num'},Nn.map(f=>kb(f[0],f[1],f[2]||'')))))}
const calcs={};
function updAng(){const b=$('#sci-fn [data-k="ANG"]');if(b)b.textContent=S.ang;const i=$('#sci-ang');if(i)i.textContent=S.ang;const s=$('#s-ang');if(s)s.value=S.ang}
function wireCalc(){
  calcs.calc=Calc('calc','calc');calcs.sci=Calc('sci','sci');
  $('#calc-keys').addEventListener('click',e=>{const b=e.target.closest('.key');if(b)calcs.calc.key(b.dataset.k)});
  const sciClick=e=>{const b=e.target.closest('.key');if(!b)return;
    if(b.dataset.k==='2ND'){b.classList.toggle('on');const on=b.classList.contains('on');$$('#sci-fn [data-ak]').forEach(x=>{if(!x._k)x._k=x.dataset.k;x.dataset.k=on?x.dataset.ak:x._k;x.textContent=on?x.dataset.al:x.dataset.l});return}
    calcs.sci.key(b.dataset.k)};
  $('#sci-fn').addEventListener('click',sciClick);$('#sci-num').addEventListener('click',sciClick);
  calcs.calc.render();calcs.sci.render();updAng()}
document.addEventListener('keydown',e=>{
  if(!['calc','sci'].includes(cur)||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.ctrlKey||e.metaKey||$('#dlg').open)return;
  const c=calcs[cur];let k=e.key;
  const map={Enter:'=','=':'=',Backspace:'BS',Escape:'C',Delete:'C',',':'.','.':'.','(':'(',')':')','^':'^','!':'!','%':'%','+':'+','-':'-','*':'*','/':'/'};
  if(/^[0-9]$/.test(k))k=k;else if(map[k])k=map[k];else return;
  e.preventDefault();c.key(k)});

/* ---------- Werkzeug-Rahmen (Eingabefelder + Ergebnisse) ---------- */
function buildTool(id,def){
  const sec=h('section',{class:'panel',id:'tab-'+id});
  const T=S.tools[id]=S.tools[id]||{};T.v=T.v||{};
  const modes=def.modes||[Object.assign({k:'_'},def)];
  T.mode=T.mode||modes[0].k;
  let segEl=null;const bodies={};
  if(def.modes){segEl=h('div',{class:'seg'},modes.map(m=>h('button',{type:'button','data-k':m.k,onclick:()=>{T.mode=m.k;save();show()}},m.label)));sec.append(segEl)}
  modes.forEach(m=>{
    const inputs={};const out=h('div',{class:'rows'});
    const fields=m.fields.map(f=>{
      const key=m.k+'.'+f.k;let el;
      if(f.t==='chips'){const chips=h('div',{class:'chips',style:'margin:0'},f.o.map(v=>h('button',{type:'button',class:'chip',onclick:()=>{const tg=inputs[f.to];tg.value=String(v);T.v[m.k+'.'+f.to]=tg.value;save();run()}},f.fmt?f.fmt(v):v)));return h('div',{style:'grid-column:1/-1'},chips)}
      if(f.t==='select'){el=h('select',{class:'inp'},f.o.map(o=>h('option',{value:o[0]},o[1])));el.value=T.v[key]??f.def??f.o[0][0]}
      else{el=h('input',{class:'inp',type:f.t==='date'||f.t==='time'?f.t:'text',autocomplete:'off',inputmode:f.t==='text'||!f.t?'text':f.t==='num'?'decimal':null,placeholder:f.ph||null});if(f.t==='num'||!f.t)el.setAttribute('inputmode','decimal');if(f.t==='txt')el.removeAttribute('inputmode');el.value=T.v[key]??(typeof f.def==='function'?f.def():f.def??'')}
      el.addEventListener('input',()=>{T.v[key]=el.value;save();run()});el.addEventListener('change',()=>{T.v[key]=el.value;save();run()});
      inputs[f.k]=el;
      return h('div',{style:f.full?'grid-column:1/-1':null},h('label',{class:'lbl'},f.l),el)});
    const v=()=>{const o={};for(const k in inputs)o[k]=inputs[k].value;return o};
    function run(){
      const r=m.calc(v(),inputs);out.innerHTML='';
      if(typeof r==='string'||!r){out.append(h('div',{class:'hint'},r||'Werte eingeben.'));return}
      r.rows.forEach(x=>out.append(h('div',{class:'row'+(x.big?' big':'')},h('span',null,x.l),h('b',{'data-copy':x.c??x.v},x.v))));
      if(r.log)logLater('extra',r.log[0],r.log[1],r.log[2])}
    m._run=run;
    bodies[m.k]=h('div',null,h('div',{class:'card'},m.intro?h('p',{class:'hint',style:'margin-top:0'},m.intro):null,h('div',{class:'fgrid'},fields)),h('div',{class:'card'},out));
    sec.append(bodies[m.k])});
  function show(){modes.forEach(m=>{bodies[m.k].classList.toggle('hidden',m.k!==T.mode);if(m.k===T.mode)m._run()});if(segEl)$$('button',segEl).forEach(b=>b.classList.toggle('on',b.dataset.k===T.mode))}
  sec._show=show;show();return sec}

/* Datum-Helfer */
const pd=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]):null};
const todayS=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const dayDiff=(a,b)=>Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/864e5);
const fmtD=d=>d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
function ymd(a,b){let y=b.getFullYear()-a.getFullYear(),m=b.getMonth()-a.getMonth(),d=b.getDate()-a.getDate();if(d<0){m--;d+=new Date(b.getFullYear(),b.getMonth(),0).getDate()}if(m<0){y--;m+=12}return[y,m,d]}
const addMonths=(d,n)=>{const r=new Date(d.getFullYear(),d.getMonth()+n,1);r.setDate(Math.min(d.getDate(),new Date(r.getFullYear(),r.getMonth()+1,0).getDate()));return r};
const vol=(ml)=>ml>=1000?trimN(ml/1000,3)+' l':trimN(ml,1)+' ml';

/* ===== Zinsrechner (Geldanlage) – Rechenkern ===== */
const ZFREQ={d:365,m:12,q:4,y:1};
const ZLABEL={d:'Täglich',m:'Monatlich',q:'Vierteljährlich',y:'Jährlich',s:'Ausgezahlt (einfache Zinsen)'};
const zinsYears=(n,u)=>u==='y'?n:u==='m'?n/12:n/365;
function zinsCalc(P,ratePct,years,way){
  if(!(P>0)||!(ratePct>=0)||!(years>0))throw new Error('Bitte Betrag, Zins und Laufzeit prüfen');
  if(years>200)throw new Error('Laufzeit zu lang (maximal 200 Jahre)');
  const r=ratePct/100;let end,apy;
  if(way==='s'){end=P*(1+r*years);apy=r}
  else{const m=ZFREQ[way];end=P*Math.pow(1+r/m,m*years);apy=Math.pow(1+r/m,m)-1}
  if(!isFinite(end))throw new Error('Ergebnis zu groß');
  return{end,interest:end-P,apy}}
const zEur=x=>EUR(x),zRaw=x=>raw(x,2),fmtNum=(x,d=6)=>trimN(x,d);
const zUnits=[['y','Jahre'],['m','Monate'],['d','Tage']];
const zWays=[['m','Monatlich'],['d','Täglich'],['q','Vierteljährlich'],['y','Jährlich'],['s','Ausgezahlt']];
const zDur=(t,u)=>fmtNum(t)+' '+{y:'J.',m:'Mon.',d:'Tage'}[u];
const zRows=r=>r.map(x=>({l:x[0],v:x[1],c:x[2],big:x[3]==='big'}));
const zWrap=f=>v=>{const o=Object.assign({},v);['p','z','t','x','za','zb'].forEach(k=>{if(k in o)o[k]=N(o[k])});try{return f(o)}catch(e){return e.message}};
/* ===== Ende Kern ===== */
const TOOLS={
date:{modes:[
 {k:'span',label:'Zeitraum',intro:'Wie viele Tage liegen zwischen zwei Daten?',fields:[{k:'a',l:'Von',t:'date',def:todayS},{k:'b',l:'Bis',t:'date',def:todayS}],
  calc:v=>{let a=pd(v.a),b=pd(v.b);if(!a||!b)return'Beide Daten wählen.';if(a>b)[a,b]=[b,a];const d=dayDiff(a,b);const[y,m,dd]=ymd(a,b);let w=0;for(let t=new Date(a),n=0;t<=b&&n<80000;t.setDate(t.getDate()+1),n++){const g=t.getDay();if(g&&g<6)w++}
   return{rows:[{l:'Tage',v:String(d),big:1},{l:'Wochen',v:`${Math.floor(d/7)} W. ${d%7} T.`},{l:'Jahre, Monate, Tage',v:`${y} J. ${m} M. ${dd} T.`},{l:'Werktage Mo–Fr (inkl. Start/Ende)',v:String(w)}],log:[`${v.a} → ${v.b}`,d+' Tage',String(d)]}}},
 {k:'add',label:'Datum ± Zeit',intro:'Datum plus oder minus eine Zeitspanne.',fields:[{k:'a',l:'Startdatum',t:'date',def:todayS,full:1},{k:'n',l:'Anzahl',t:'num',ph:'z. B. 30'},{k:'u',l:'Einheit',t:'select',o:[['d','Tage'],['w','Wochen'],['m','Monate'],['y','Jahre']]},{k:'s',l:'Richtung',t:'select',o:[['+','plus'],['-','minus']],full:1}],
  calc:v=>{const a=pd(v.a),n=N(v.n);if(!a||isNaN(n))return'Datum und Anzahl eingeben.';const q=(v.s==='-'?-1:1)*n;let r;if(v.u==='d'){r=new Date(a);r.setDate(r.getDate()+q)}else if(v.u==='w'){r=new Date(a);r.setDate(r.getDate()+7*q)}else r=addMonths(a,v.u==='m'?q:q*12);
   return{rows:[{l:'Ergebnis',v:fmtD(r),big:1,c:r.toLocaleDateString('de-DE')}],log:[`${a.toLocaleDateString('de-DE')} ${v.s==='-'?'−':'+'} ${v.n} ${{d:'T.',w:'W.',m:'M.',y:'J.'}[v.u]}`,r.toLocaleDateString('de-DE')]}}},
 {k:'age',label:'Alter',intro:'Alter und nächster Geburtstag.',fields:[{k:'a',l:'Geburtsdatum',t:'date',full:1}],
  calc:v=>{const a=pd(v.a);const t=pd(todayS());if(!a||a>t)return'Geburtsdatum wählen.';const[y,m,d]=ymd(a,t);let nb=new Date(t.getFullYear(),a.getMonth(),a.getDate());if(nb<t)nb=new Date(t.getFullYear()+1,a.getMonth(),a.getDate());
   return{rows:[{l:'Alter',v:`${y} J. ${m} M. ${d} T.`,big:1},{l:'Tage gelebt',v:nf(0,0).format(dayDiff(a,t))},{l:'Nächster Geburtstag in',v:dayDiff(t,nb)+' Tagen'},{l:'Geboren an einem',v:a.toLocaleDateString('de-DE',{weekday:'long'})}]}}}]},
work:{intro:'Arbeitszeit aus Beginn, Ende und Pause. Über Mitternacht wird erkannt.',fields:[{k:'a',l:'Beginn',t:'time',def:'08:00'},{k:'b',l:'Ende',t:'time',def:'16:30'},{k:'p',l:'Pause (Minuten)',t:'num',def:'30'},{k:'r',l:'Stundenlohn € (optional)',t:'num'}],
 calc:v=>{if(!v.a||!v.b)return'Beginn und Ende wählen.';const[h1,m1]=v.a.split(':').map(Number),[h2,m2]=v.b.split(':').map(Number);let mins=(h2*60+m2)-(h1*60+m1);if(mins<=0)mins+=1440;const pa=N(v.p)||0;mins-=pa;if(mins<0)return'Pause länger als Arbeitszeit.';const dec=mins/60;
  const rows=[{l:'Arbeitszeit',v:`${Math.floor(mins/60)}:${pad(mins%60)} h`,c:`${Math.floor(mins/60)}:${pad(mins%60)}`,big:1},{l:'Dezimal',v:trimN(dec,2)+' h',c:raw(dec,2)}];const r=N(v.r);if(!isNaN(r))rows.push({l:'Verdienst',v:EUR(dec*r),c:raw(dec*r,2)});return{rows,log:[`${v.a}–${v.b}, ${pa} Min. Pause`,`${Math.floor(mins/60)}:${pad(mins%60)} h`]}}},
mix:{modes:(()=>{
  const chips={k:'c',t:'chips',to:'r',o:[5,10,20,50,100],fmt:v=>'1:'+v};
  const rat=[{k:'r',l:'Verhältnis 1 : …',t:'num',def:'20'}];
  const kind={k:'x',l:'„1 : X“ bedeutet',t:'select',o:[['a','1 Teil Mittel + X Teile Wasser'],['b','insgesamt X Teile']],full:1};
  const unit={k:'u',l:'Einheit der Menge',t:'select',o:[['l','Liter'],['ml','Milliliter']]};
  const toMl=(v,k)=>N(v[k])*(v.u==='l'?1000:1);
  const chk=v=>{const r=N(v.r);return r>0&&(v.x==='a'||r>1)?r:null};
  return[
  {k:'water',label:'Wasser da',intro:'Wie viel Mittel kommt in mein Wasser? Beispiel: 1:20 bei 5 Litern Wasser.',fields:[chips,...rat,{k:'m',l:'Wassermenge',t:'num',ph:'z. B. 5'},unit,kind],
   calc:v=>{const r=chk(v),w=toMl(v,'m');if(!r||!(w>0))return'Werte eingeben.';const mit=v.x==='a'?w/r:w/(r-1);return{rows:[{l:'Mittel',v:vol(mit),big:1,c:raw(mit,1)+' ml'},{l:'Wasser',v:vol(w)},{l:'Gesamt',v:vol(w+mit)}]}}},
  {k:'total',label:'Gesamtmenge',intro:'Du willst eine bestimmte Gesamtmenge anrühren.',fields:[chips,...rat,{k:'m',l:'Gesamtmenge',t:'num',ph:'z. B. 5'},unit,kind],
   calc:v=>{const r=chk(v),t=toMl(v,'m');if(!r||!(t>0))return'Werte eingeben.';const mit=v.x==='a'?t/(1+r):t/r;return{rows:[{l:'Mittel',v:vol(mit),big:1,c:raw(mit,1)+' ml'},{l:'Wasser',v:vol(t-mit)},{l:'Gesamt',v:vol(t)}]}}},
  {k:'conc',label:'Mittel da',intro:'Du hast eine bestimmte Menge Mittel.',fields:[chips,...rat,{k:'m',l:'Mittelmenge',t:'num',ph:'z. B. 100'},{k:'u',l:'Einheit der Menge',t:'select',o:[['ml','Milliliter'],['l','Liter']]},kind],
   calc:v=>{const r=chk(v),mit=toMl(v,'m');if(!r||!(mit>0))return'Werte eingeben.';const w=v.x==='a'?mit*r:mit*(r-1);return{rows:[{l:'Wasser',v:vol(w),big:1,c:raw(w,1)+' ml'},{l:'Mittel',v:vol(mit)},{l:'Gesamt',v:vol(w+mit)}]}}}]})()},
loan:{intro:'Monatliche Rate eines Annuitätendarlehens (gleichbleibende Rate).',fields:[{k:'p',l:'Darlehen (€)',t:'num',ph:'10000',full:1},{k:'z',l:'Zins p. a. (%)',t:'num',ph:'5'},{k:'j',l:'Laufzeit (Jahre)',t:'num',ph:'5'}],
 calc:v=>{const P=N(v.p),z=N(v.z),j=N(v.j);if(!(P>0)||isNaN(z)||!(j>0))return'Werte eingeben.';const n=Math.round(j*12),r=z/1200;const rate=r===0?P/n:P*r/(1-Math.pow(1+r,-n));return{rows:[{l:'Monatliche Rate',v:EUR(rate),big:1,c:raw(rate,2)},{l:'Gesamtzahlung',v:EUR(rate*n)},{l:'Zinskosten',v:EUR(rate*n-P)},{l:'Raten',v:n+' Monate'}],log:[`${EUR(P)}, ${v.z} %, ${v.j} J.`,EUR(rate)+' / Monat']}}},
save:{intro:'Wie viel Geld ist es am Ende? Zinsen werden monatlich gutgeschrieben, Sparrate am Monatsende.',fields:[{k:'s',l:'Startkapital (€)',t:'num'},{k:'r',l:'Sparrate pro Monat (€)',t:'num'},{k:'z',l:'Zins p. a. (%)',t:'num'},{k:'j',l:'Dauer (Jahre)',t:'num'}],
 calc:v=>{const s=N(v.s)||0,r=N(v.r)||0,z=N(v.z),j=N(v.j);if(isNaN(z)||!(j>0)||(!s&&!r))return'Werte eingeben.';const n=Math.round(j*12),i=z/1200;const fv=i===0?s+r*n:s*Math.pow(1+i,n)+r*((Math.pow(1+i,n)-1)/i);const ein=s+r*n;return{rows:[{l:'Endkapital',v:EUR(fv),big:1,c:raw(fv,2)},{l:'Eingezahlt',v:EUR(ein)},{l:'Zinsen',v:EUR(fv-ein)}],log:[`${EUR(s)} + ${EUR(r)}/Mon., ${v.z} %, ${v.j} J.`,EUR(fv)]}}},
zins:{modes:[
 {k:'one',label:'Geldanlage',intro:'Ich lege Geld bei der Bank an – was habe ich am Ende?',
  fields:[{k:'p',l:'Anlagebetrag (€)',t:'num',def:'10000'},{k:'z',l:'Zins p. a. (%)',t:'num',def:'3'},{k:'t',l:'Laufzeit',t:'num',def:'5'},{k:'u',l:'Einheit',t:'select',o:zUnits},{k:'f',l:'Zinsgutschrift (Ausgezahlt = ohne Zinseszins)',t:'select',o:zWays,full:1},{k:'x',l:'Steuer auf Zinsen (%, optional)',t:'num',ph:'z. B. 26,375',full:1}],
  calc:zWrap(v=>{
   if(isNaN(v.p)||isNaN(v.z)||isNaN(v.t))return null;
   const yrs=zinsYears(v.t,v.u),r=zinsCalc(v.p,v.z,yrs,v.f);
   const rows=[['Endbetrag',zEur(r.end),zRaw(r.end),'big'],['Zinsen gesamt',zEur(r.interest),zRaw(r.interest)]];
   if(v.f!=='s'){const s=zinsCalc(v.p,v.z,yrs,'s');rows.push(['davon Zinseszins',zEur(r.interest-s.interest),zRaw(r.interest-s.interest)])}
   rows.push(['Effektiver Jahreszins',fmtNum(r.apy*100,3)+' %']);
   if(!isNaN(v.x)&&v.x>0){const tax=r.interest*v.x/100;rows.push(['Steuer ('+fmtNum(v.x,3)+' % der Zinsen)','− '+zEur(tax),zRaw(tax)],['Endbetrag nach Steuer',zEur(r.end-tax),zRaw(r.end-tax)])}
   return{rows:zRows(rows),log:[zEur(v.p)+' · '+fmtNum(v.z,3)+' % · '+zDur(v.t,v.u)+' · '+ZLABEL[v.f],zEur(r.end),zRaw(r.end)]}})},
 {k:'freq',label:'Gutschrift',intro:'Gleicher Zins, andere Gutschrift: Was bringt täglich, monatlich oder jährlich – und was ohne Zinseszins?',
  fields:[{k:'p',l:'Anlagebetrag (€)',t:'num',def:'10000'},{k:'z',l:'Zins p. a. (%)',t:'num',def:'3'},{k:'t',l:'Laufzeit',t:'num',def:'10'},{k:'u',l:'Einheit',t:'select',o:zUnits}],
  calc:zWrap(v=>{
   if(isNaN(v.p)||isNaN(v.z)||isNaN(v.t))return null;
   const yrs=zinsYears(v.t,v.u),res={};['d','m','q','y','s'].forEach(k=>{res[k]=zinsCalc(v.p,v.z,yrs,k)});
   const rows=['d','m','q','y','s'].map((k,i)=>[ZLABEL[k],zEur(res[k].end),zRaw(res[k].end),i===0?'big':'']);
   const gain=res.d.end-res.y.end;
   rows.push(['Täglich statt jährlich','+ '+zEur(gain),zRaw(gain)],['Zinseszins-Effekt (täglich)','+ '+zEur(res.d.end-res.s.end),zRaw(res.d.end-res.s.end)]);
   return{rows:zRows(rows),log:['Gutschrift: '+zEur(v.p)+' · '+fmtNum(v.z,3)+' % · '+zDur(v.t,v.u),'täglich '+zEur(res.d.end),zRaw(res.d.end)]}})},
 {k:'cmp',label:'2 Angebote',intro:'Zwei Bankangebote mit gleichem Betrag und gleicher Laufzeit vergleichen. „Ausgezahlt“ = Zinsen werden ausgezahlt, ohne Zinseszins.',
  fields:[{k:'p',l:'Anlagebetrag (€)',t:'num',def:'10000'},{k:'t',l:'Laufzeit',t:'num',def:'5'},{k:'u',l:'Einheit',t:'select',o:zUnits,full:1},{k:'za',l:'Angebot A: Zins (%)',t:'num',def:'3'},{k:'fa',l:'A: Gutschrift',t:'select',o:zWays},{k:'zb',l:'Angebot B: Zins (%)',t:'num',def:'3,1'},{k:'fb',l:'B: Gutschrift',t:'select',o:zWays}],
  calc:zWrap(v=>{
   if(isNaN(v.p)||isNaN(v.t)||isNaN(v.za)||isNaN(v.zb))return null;
   const yrs=zinsYears(v.t,v.u),a=zinsCalc(v.p,v.za,yrs,v.fa),b=zinsCalc(v.p,v.zb,yrs,v.fb);
   const diff=b.end-a.end,tie=Math.abs(diff)<0.005;
   const winner=tie?'Gleich gut':(diff>0?'Angebot B':'Angebot A')+' (+ '+zEur(Math.abs(diff))+')';
   return{rows:zRows([['Besser',winner,winner,'big'],['A: Endbetrag',zEur(a.end),zRaw(a.end)],['B: Endbetrag',zEur(b.end),zRaw(b.end)],['A: Zinsen',zEur(a.interest),zRaw(a.interest)],['B: Zinsen',zEur(b.interest),zRaw(b.interest)],['A: Effektiver Jahreszins',fmtNum(a.apy*100,3)+' %'],['B: Effektiver Jahreszins',fmtNum(b.apy*100,3)+' %']]),
    log:['A '+fmtNum(v.za,3)+' % '+ZLABEL[v.fa].toLowerCase()+' vs. B '+fmtNum(v.zb,3)+' % '+ZLABEL[v.fb].toLowerCase(),tie?'Gleich gut':(diff>0?'B':'A')+' besser: + '+zEur(Math.abs(diff)),zRaw(Math.abs(diff))]}})}]},
fuel:{modes:[
 {k:'cost',label:'Fahrtkosten',intro:'Was kostet eine Fahrt?',fields:[{k:'d',l:'Strecke (km)',t:'num'},{k:'c',l:'Verbrauch (l/100 km)',t:'num',ph:'6,5'},{k:'p',l:'Preis pro Liter (€)',t:'num',ph:'1,80',full:1}],
  calc:v=>{const d=N(v.d),c=N(v.c),p=N(v.p);if(!(d>0)||!(c>0)||!(p>0))return'Werte eingeben.';const l=d*c/100;return{rows:[{l:'Kosten',v:EUR(l*p),big:1,c:raw(l*p,2)},{l:'Verbrauch',v:trimN(l,2)+' l'},{l:'Kosten pro 100 km',v:EUR(c*p)}],log:[`${v.d} km, ${v.c} l/100 km, ${v.p} €/l`,EUR(l*p)]}}},
 {k:'cons',label:'Verbrauch',intro:'Verbrauch aus Tankfüllung und gefahrenen Kilometern.',fields:[{k:'d',l:'Gefahrene km',t:'num'},{k:'l',l:'Getankte Liter',t:'num'},{k:'p',l:'Preis pro Liter (€, optional)',t:'num',full:1}],
  calc:v=>{const d=N(v.d),l=N(v.l);if(!(d>0)||!(l>0))return'Werte eingeben.';const c=l/d*100;const rows=[{l:'Verbrauch',v:trimN(c,2)+' l/100 km',big:1,c:raw(c,2)}];const p=N(v.p);if(p>0)rows.push({l:'Kosten pro 100 km',v:EUR(c*p)},{l:'Kosten pro km',v:nf(3,3).format(c*p/100)+' €'});return{rows}}}]},
ratio:{intro:'Beispiel: 3 kg kosten 7,50 € – was kosten 5 kg? → A = 3, B = 7,5, C = 5.',fields:[{k:'t',l:'Art',t:'select',o:[['p','Je mehr, desto mehr (proportional)'],['i','Je mehr, desto weniger (umgekehrt)']],full:1},{k:'a',l:'A'},{k:'b',l:'gehört zu B'},{k:'c',l:'Dann gehört zu C …',full:1}],
 calc:v=>{const a=N(v.a),b=N(v.b),c=N(v.c);if([a,b,c].some(isNaN)||a===0||(v.t==='i'&&c===0))return'Werte eingeben.';const x=v.t==='p'?c*b/a:a*b/c;return{rows:[{l:'Ergebnis',v:trimN(x,6),big:1,c:raw(x,6)}],log:[`${v.a} ↔ ${v.b}, ${v.c} ↔ ?`,trimN(x,6),raw(x,6)]}}},
uprice:{intro:'Welche Packung ist günstiger? Beide Mengen in derselben Einheit eingeben.',fields:[{k:'u',l:'Einheit der Menge',t:'select',o:[['g','Gramm (g)'],['kg','Kilogramm (kg)'],['ml','Milliliter (ml)'],['l','Liter (l)'],['st','Stück']],full:1},{k:'pa',l:'Preis A (€)',t:'num'},{k:'qa',l:'Menge A',t:'num'},{k:'pb',l:'Preis B (€)',t:'num'},{k:'qb',l:'Menge B',t:'num'}],
 calc:v=>{const pa=N(v.pa),qa=N(v.qa),pb=N(v.pb),qb=N(v.qb);if(!(pa>0&&qa>0&&pb>0&&qb>0))return'Werte eingeben.';const f=v.u==='g'||v.u==='ml'?1000:1,lab={g:'kg',kg:'kg',ml:'l',l:'l',st:'Stück'}[v.u];const ua=pa/qa*f,ub=pb/qb*f;const d=Math.abs(ua-ub)/Math.max(ua,ub)*100;
  return{rows:[{l:'A pro '+lab,v:EUR(ua)},{l:'B pro '+lab,v:EUR(ub)},{l:'Günstiger',v:ua===ub?'gleich teuer':(ua<ub?'A':'B')+' (−'+trimN(d,1)+' %)',big:1}]}}},
base:{intro:'Zahlen zwischen Dezimal, Hexadezimal, Binär und Oktal umrechnen.',fields:[{k:'n',l:'Zahl',t:'txt',ph:'z. B. 255 oder FF',full:1},{k:'b',l:'Eingabe ist …',t:'select',o:[['10','Dezimal'],['16','Hexadezimal'],['2','Binär'],['8','Oktal']],full:1}],
 calc:v=>{const s=(v.n||'').trim().replace(/\s/g,'');if(!s)return'Werte eingeben.';const b=+v.b;const ok={10:/^\d+$/,16:/^[0-9a-f]+$/i,2:/^[01]+$/,8:/^[0-7]+$/}[b];if(!ok.test(s))return'Ungültige Ziffern für dieses Zahlensystem.';
  let n;try{n=b===10?BigInt(s):BigInt({16:'0x',2:'0b',8:'0o'}[b]+s)}catch(e){return'Ungültige Eingabe'}
  return{rows:[{l:'Dezimal',v:n.toString(10)},{l:'Hexadezimal',v:n.toString(16).toUpperCase()},{l:'Binär',v:n.toString(2)},{l:'Oktal',v:n.toString(8)}]}}}
};

/* ---------- Prozent, Trinkgeld, Einheiten ---------- */
function buildPct(){
  const mk=(title,a,b,fn,type)=>{const A=h('input',{class:'inp',inputmode:'decimal',placeholder:a,autocomplete:'off'}),B=h('input',{class:'inp',inputmode:'decimal',placeholder:b,autocomplete:'off'}),O=h('div',{class:'fx-out'},'–');
    const run=()=>{const x=N(A.value),y=N(B.value);const r=(isNaN(x)||isNaN(y))?null:fn(x,y);if(!r){O.textContent='–';O.dataset.copy='';return}O.textContent=r[0];O.dataset.copy=r[1];logLater('extra',r[2],r[0],r[1])};
    A.addEventListener('input',run);B.addEventListener('input',run);return h('div',{class:'card'},h('h2',null,title),h('div',{class:'grid2'},A,B),O)};
  const sg=n=>(n>0?'+':'')+trimN(n,4)+' %';
  return h('section',{class:'panel',id:'tab-pct'},h('div',null,
    mk('Was sind X % von Y?','X (%)','Y',(x,y)=>{const r=y*x/100;return[trimN(r,6),raw(r,6),`${trimN(x)} % von ${trimN(y)}`]}),
    mk('A ist wie viel % von B?','A','B (Grundwert)',(a,b)=>{if(b===0)return null;const r=a/b*100;return[trimN(r,4)+' %',raw(r,4),`${trimN(a)} von ${trimN(b)}`]}),
    mk('Prozentuale Änderung von A nach B','A (alt)','B (neu)',(a,b)=>{if(a===0)return null;const r=(b-a)/Math.abs(a)*100;return[sg(r),raw(r,4),`${trimN(a)} → ${trimN(b)}`]})))}
function buildTip(){
  const T=S.tools.tip=S.tools.tip||{};Object.assign(T,{pct:T.pct??10,own:T.own||'',n:T.n||1,round:!!T.round,amt:''});
  const amt=h('input',{class:'inp',id:'t-amt',inputmode:'decimal',placeholder:'0,00',autocomplete:'off'});
  const own=h('input',{class:'inp',inputmode:'decimal',placeholder:'eigener Satz in %',autocomplete:'off',value:T.own});
  const out=h('div',{class:'rows'},h('div',{class:'hint'},'Betrag eingeben.'));
  const nEl=h('div',{style:'flex:1;text-align:center;font-size:24px;font-weight:600'},String(T.n));
  const chips=h('div',{class:'chips',style:'margin:0 0 8px'},[0,5,10,15,20].map(p=>h('button',{class:'chip',type:'button',onclick:()=>{T.pct=p;T.own='';own.value='';save();run()}},p+' %')));
  const rnd=h('input',{type:'checkbox',id:'t-round',style:'width:24px;height:24px;accent-color:var(--accent)'});rnd.checked=T.round;
  function run(){
    const o=N(own.value);const p=!isNaN(o)?o:T.pct;$$('.chip',chips).forEach((c,i)=>c.classList.toggle('on',isNaN(o)&&[0,5,10,15,20][i]===T.pct));
    nEl.textContent=T.n;const a=N(amt.value);out.innerHTML='';if(!(a>=0)||isNaN(a)){out.append(h('div',{class:'hint'},'Betrag eingeben.'));return}
    const tip=a*p/100,tot=a+tip;let pp=tot/T.n;if(T.round)pp=Math.ceil(pp-1e-9);const rows=[['Trinkgeld',EUR(tip)],['Gesamt',EUR(T.round?pp*T.n:tot)]];
    if(T.n>1)rows.push(['Pro Person',EUR(pp)]);else if(T.round)rows.push(['Aufgerundet',EUR(pp)]);
    const big=T.n>1||T.round?2:1;rows.forEach((r,i)=>out.append(h('div',{class:'row'+(i===big?' big':'')},h('span',null,r[0]),h('b',{'data-copy':raw(parseFloat(r[1].replace(/\./g,'').replace(',','.')),2)},r[1]))));
    logLater('extra',`${EUR(a)} + ${trimN(p)} % Trinkgeld`+(T.n>1?`, ${T.n} Pers.`:''),EUR(T.round?pp*T.n:tot)+(T.n>1?` (${EUR(pp)} p. P.)`:''))}
  amt.addEventListener('input',run);own.addEventListener('input',()=>{T.own=own.value;save();run()});rnd.addEventListener('change',()=>{T.round=rnd.checked;save();run()});
  const sec=h('section',{class:'panel',id:'tab-tip'},h('div',null,
    h('div',{class:'card'},h('label',{class:'lbl',for:'t-amt'},'Rechnungsbetrag (€)'),amt,h('label',{class:'lbl',style:'margin-top:10px'},'Trinkgeld'),chips,own,h('label',{class:'lbl',style:'margin-top:10px'},'Personen'),
      h('div',{class:'row-flex'},h('button',{class:'btn alt sm',style:'width:56px',onclick:()=>{T.n=Math.max(1,T.n-1);save();run()}},'−'),nEl,h('button',{class:'btn alt sm',style:'width:56px',onclick:()=>{T.n=Math.min(50,T.n+1);save();run()}},'+')),
      h('div',{class:'row-flex',style:'margin-top:12px'},rnd,h('label',{for:'t-round'},'Pro Person auf ganze Euro aufrunden'))),
    h('div',{class:'card'},out)));
  run();return sec}
const UN={
 len:{n:'Länge',u:[['mm','Millimeter (mm)',.001],['cm','Zentimeter (cm)',.01],['m','Meter (m)',1],['km','Kilometer (km)',1000],['in','Zoll (in)',.0254],['ft','Fuß (ft)',.3048],['yd','Yard (yd)',.9144],['mi','Meile (mi)',1609.344],['nm','Seemeile (nm)',1852]]},
 mass:{n:'Gewicht',u:[['mg','Milligramm (mg)',1e-6],['g','Gramm (g)',.001],['kg','Kilogramm (kg)',1],['t','Tonne (t)',1000],['oz','Unze (oz)',.028349523125],['lb','Pfund (lb)',.45359237]]},
 temp:{n:'Temperatur',u:[['c','Celsius (°C)'],['f','Fahrenheit (°F)'],['k','Kelvin (K)']]},
 vol:{n:'Volumen',u:[['ml','Milliliter (ml)',.001],['cl','Zentiliter (cl)',.01],['l','Liter (l)',1],['m3','Kubikmeter (m³)',1000],['floz','Fl. oz (US)',.0295735295625],['cup','Cup (US)',.2365882365],['gal','Gallone (US)',3.785411784],['galuk','Gallone (UK)',4.54609]]},
 area:{n:'Fläche',u:[['cm2','cm²',1e-4],['m2','m²',1],['ar','Ar (a)',100],['ha','Hektar (ha)',1e4],['km2','km²',1e6],['in2','in²',6.4516e-4],['ft2','ft²',.09290304],['ac','Acre (ac)',4046.8564224]]},
 speed:{n:'Geschwindigkeit',u:[['kmh','km/h',1/3.6],['ms','m/s',1],['mph','mph',.44704],['kn','Knoten (kn)',.514444444],['fts','ft/s',.3048]]}};
function convUnit(cat,v,f,t){if(cat==='temp'){let c=f==='c'?v:f==='f'?(v-32)*5/9:v-273.15;return t==='c'?c:t==='f'?c*9/5+32:c+273.15}const m=k=>UN[cat].u.find(x=>x[0]===k)[2];return v*m(f)/m(t)}
function buildUnit(){
  const T=S.tools.unit=S.tools.unit||{};T.cat=T.cat||'len';
  const cat=h('select',{class:'inp','aria-label':'Kategorie'},Object.keys(UN).map(k=>h('option',{value:k},UN[k].n)));cat.value=T.cat;
  const val=h('input',{class:'inp',inputmode:'decimal',placeholder:'Wert',autocomplete:'off',style:'margin-top:10px'});
  const from=h('select',{class:'inp','aria-label':'Von'}),to=h('select',{class:'inp','aria-label':'Nach'});
  const out=h('div',{class:'fx-out'},'–');
  function fill(reset){[from,to].forEach(s=>{s.innerHTML='';UN[cat.value].u.forEach(u=>s.append(h('option',{value:u[0]},u[1])))});if(reset||!T.f||!UN[cat.value].u.some(u=>u[0]===T.f)){from.selectedIndex=0;to.selectedIndex=Math.min(2,UN[cat.value].u.length-1)}else{from.value=T.f;to.value=T.t}}
  function run(){T.cat=cat.value;T.f=from.value;T.t=to.value;save();const v=N(val.value);if(isNaN(v)){out.textContent='–';out.dataset.copy='';return}const r=convUnit(cat.value,v,from.value,to.value);const sh=trimN(r,6);const lab=UN[cat.value].u.find(u=>u[0]===to.value)[1].replace(/.*\(|\)/g,'')||to.value;out.textContent=sh+' '+lab;out.dataset.copy=raw(r,6);
    logLater('extra',`${trimN(v)} ${from.value}`,sh+' '+lab,raw(r,6))}
  cat.addEventListener('change',()=>{fill(true);run()});[val].forEach(x=>x.addEventListener('input',run));from.addEventListener('change',run);to.addEventListener('change',run);
  fill(false);if(T.v)val.value=T.v;val.addEventListener('input',()=>{T.v=val.value});
  return h('section',{class:'panel',id:'tab-unit'},h('div',null,h('div',{class:'card'},cat,val,h('div',{class:'row-flex',style:'margin-top:10px'},from,h('button',{class:'fx-swap',onclick:()=>{const a=from.value;from.value=to.value;to.value=a;run()},'aria-label':'Tauschen'},'⇄'),to),out)))}

/* ---------- Währung ---------- */
const CUR=[['EUR','Euro'],['USD','US-Dollar'],['GBP','Brit. Pfund'],['CHF','Schweizer Franken'],['PLN','Polnischer Złoty'],['CZK','Tschechische Krone'],['TRY','Türkische Lira'],['JPY','Japanischer Yen'],['CNY','Chinesischer Yuan'],['SEK','Schwedische Krone'],['NOK','Norwegische Krone'],['DKK','Dänische Krone'],['AUD','Austral. Dollar'],['BRL','Brasil. Real'],['CAD','Kanad. Dollar'],['HKD','Hongkong-Dollar'],['HUF','Ungarischer Forint'],['IDR','Indones. Rupiah'],['ILS','Israelischer Schekel'],['INR','Indische Rupie'],['ISK','Isländische Krone'],['KRW','Südkoreanischer Won'],['MXN','Mexikan. Peso'],['MYR','Malays. Ringgit'],['NZD','Neuseeland-Dollar'],['PHP','Philippin. Peso'],['RON','Rumän. Leu'],['SGD','Singapur-Dollar'],['THB','Thailändischer Baht'],['ZAR','Südafrikan. Rand']];
const FX0={USD:1.0992,GBP:.83581,CHF:.9262,PLN:4.417,CZK:24.427,TRY:55.4737,JPY:175.84,CNY:7.328,SEK:11.147,NOK:10.6475,DKK:7.4742,AUD:1.6378,BRL:6.4765,CAD:1.5719,HKD:8.6239,HUF:369.43,IDR:20073.1,ILS:3.6149,INR:102.55,ISK:137.2,KRW:1460.23,MXN:20.7946,MYR:4.5205,NZD:1.989,PHP:70.014,RON:5.3473,SGD:1.4176,THB:37.268,ZAR:18.9948};
const baseRate=c=>c==='EUR'?1:(S.fxRates[c]??FX0[c]);
const rate=c=>c==='EUR'?1:(S.fxCustom[c]!=null?S.fxCustom[c]:baseRate(c));
const curList=()=>CUR.concat(Object.keys(S.fxCustom).filter(c=>!CUR.some(x=>x[0]===c)).map(c=>[c,c]));
const curName=c=>(curList().find(x=>x[0]===c)||[c,c])[1];
const rateTxt=r=>nf(0,6).format(+r.toPrecision(5));
function buildFx(){
  const sec=h('section',{class:'panel',id:'tab-fx'});
  const amt=h('input',{class:'inp',id:'fx-amt',inputmode:'decimal',autocomplete:'off',placeholder:'0',value:S.fx.amt});
  const from=h('select',{class:'inp','aria-label':'Von Währung'}),to=h('select',{class:'inp','aria-label':'In Währung'});
  const out=h('div',{class:'fx-out'}),rt=h('div',{class:'hint'}),nm=h('div',{class:'hint'});
  const status=h('div',{class:'hint'}),quick=h('div',{class:'rows'}),ed=h('div',{class:'card hidden'}),rowsEl=h('div');
  const fillSel=()=>{[from,to].forEach((s,i)=>{const v=s.value||(i?S.fx.to:S.fx.from);s.innerHTML='';curList().forEach(c=>s.append(h('option',{value:c[0]},c[0])));s.value=curList().some(c=>c[0]===v)?v:'EUR'})};
  const conv=(a,f,t)=>a*rate(t)/rate(f);
  function run(){S.fx={from:from.value,to:to.value,amt:amt.value};save();
    const a=N(amt.value);const f=from.value,t=to.value;const r=isNaN(a)?0:conv(a,f,t);
    out.textContent=nf(S.dec,S.dec).format(r)+' '+t;out.dataset.copy=raw(r,S.dec);
    rt.textContent=`1 ${f} = ${rateTxt(conv(1,f,t))} ${t}`;nm.textContent=`${curName(f)} → ${curName(t)}`;
    status.textContent=S.fxDate?`Stand: ${S.fxDate} (EZB-Referenzkurse)`:'Stand: 19.11.2026 (EZB-Referenzkurse)';
    quick.innerHTML='';const base=isNaN(a)||a===0?100:a;const favs=['USD','GBP','CHF','PLN','CZK','TRY'].filter(c=>c!==f);if(f!=='EUR')favs.unshift('EUR');
    favs.slice(0,6).forEach(c=>{const v=conv(base,f,c);quick.append(h('div',{class:'row'},h('span',null,c+' '+curName(c)),h('b',{'data-copy':raw(v,S.dec)},nf(S.dec,S.dec).format(v))))});
    if(!isNaN(a)&&a>0)logLater('fx',`${trimN(a)} ${f}`,nf(S.dec,S.dec).format(r)+' '+t,raw(r,S.dec))}
  function buildEdit(){rowsEl.innerHTML='';curList().filter(c=>c[0]!=='EUR').forEach(([c,n])=>{
    const extra=!CUR.some(x=>x[0]===c);const inp=h('input',{class:'inp',inputmode:'decimal','aria-label':'Kurs '+c,value:raw(rate(c),6)});
    const rb=h('button',{class:'btn alt sm',style:'min-height:44px;padding:0','aria-label':extra?'Entfernen':'Zurücksetzen',onclick:()=>{delete S.fxCustom[c];save();fillSel();buildEdit();run()}},extra?'✕':'↺');rb.disabled=!extra&&S.fxCustom[c]==null;
    inp.addEventListener('input',()=>{const v=N(inp.value);if(v>0){S.fxCustom[c]=v;rb.disabled=false;save();run()}});
    rowsEl.append(h('div',{class:'edit-row'},h('div',{class:'code'},c,h('small',null,n)),inp,rb))})}
  const nc=h('input',{class:'inp',placeholder:'Kürzel, z. B. AED',maxlength:5,autocapitalize:'characters',autocomplete:'off'}),nr=h('input',{class:'inp',inputmode:'decimal',placeholder:'Kurs pro 1 EUR',autocomplete:'off'});
  ed.append(h('h2',null,'Kurse bearbeiten (Wert für 1 EUR)'),h('p',{class:'hint'},'Eigene Werte (z. B. für den Urlaub) bleiben erhalten, bis du sie mit ↺ zurücksetzt.'),rowsEl,h('h2',{style:'margin-top:14px'},'Eigene Währung hinzufügen'),h('div',{class:'grid2'},nc,nr),
    h('button',{class:'btn sm',style:'margin-top:8px;width:100%',onclick:()=>{const c=nc.value.trim().toUpperCase(),r=N(nr.value);if(!/^[A-Z]{2,5}$/.test(c)||!(r>0)||c==='EUR'){toast('Kürzel und Kurs prüfen');return}S.fxCustom[c]=r;nc.value=nr.value='';save();fillSel();buildEdit();run()}},'Hinzufügen'));
  const refresh=async()=>{try{const ctl=new AbortController();setTimeout(()=>ctl.abort(),8000);const r=await fetch('https://api.frankfurter.dev/v1/latest?base=EUR',{signal:ctl.signal});const d=await r.json();if(!d.rates)throw 0;S.fxRates=d.rates;const[y,m,dd]=d.date.split('-');S.fxDate=`${dd}.${m}.${y}`;save();buildEdit();run();toast('Kurse aktualisiert')}catch(e){toast('Offline – gespeicherte Kurse bleiben')}};
  fillSel();from.value=S.fx.from;to.value=S.fx.to;if(!from.value)from.value='EUR';if(!to.value)to.value='USD';
  amt.addEventListener('input',run);from.addEventListener('change',run);to.addEventListener('change',run);
  sec.append(h('div',{class:'card'},h('label',{class:'lbl',for:'fx-amt'},'Betrag'),amt,h('div',{class:'row-flex',style:'margin-top:10px'},from,h('button',{class:'fx-swap','aria-label':'Währungen tauschen',onclick:()=>{const a=from.value;from.value=to.value;to.value=a;run()}},'⇄'),to),out,rt,nm),
    h('div',{class:'card'},status,h('div',{class:'grid2',style:'margin-top:8px'},h('button',{class:'btn alt sm',onclick:refresh},'Kurse aktualisieren'),h('button',{class:'btn alt sm',onclick:()=>{ed.classList.toggle('hidden');if(!ed.classList.contains('hidden'))buildEdit()}},'Kurse bearbeiten'))),
    h('div',{class:'card'},h('h2',null,'Schnellübersicht'),quick),ed);
  run();return sec}

/* ---------- Preis ---------- */
function buildPrice(){
  const P=S.pr;if(P.tax==null)P.tax=S.tax;
  const amt=h('input',{class:'inp',id:'pr-amt',inputmode:'decimal',autocomplete:'off',placeholder:'0,00'}),qty=h('input',{class:'inp',id:'pr-qty',inputmode:'decimal',autocomplete:'off',value:P.qty||'1'});
  const own=h('input',{class:'inp',inputmode:'decimal',placeholder:'eigener %','aria-label':'Eigener Steuersatz',style:'width:110px;min-height:44px;font-size:16px;border-radius:999px;text-align:center'});
  const chipsEl=h('div',{class:'chips',style:'margin:0'});const rates=[19,7,0];
  const drawChips=()=>{chipsEl.innerHTML='';rates.forEach(r=>chipsEl.append(h('button',{class:'chip'+(P.tax===r&&!own.value?' on':''),type:'button',onclick:()=>{P.tax=r;own.value='';save();drawChips()}},r+' %')));chipsEl.append(own)};
  own.addEventListener('input',()=>{const v=N(own.value);if(!isNaN(v))P.tax=v;save();$$('.chip',chipsEl).forEach(c=>c.classList.remove('on'))});
  if(!rates.includes(P.tax))own.value=raw(P.tax,2);drawChips();
  const out=h('div',{class:'rows'},h('div',{class:'hint'},'Preis eingeben und oben eine Taste wählen.'));
  const calc=plus=>{const a=N(amt.value),q=N(qty.value)||1,t=P.tax;P.qty=qty.value;save();if(isNaN(a)){toast('Preis eingeben');return}
    const net=plus?a:a/(1+t/100),gr=plus?a*(1+t/100):a,tax=gr-net;out.innerHTML='';
    const row=(l,v,big)=>out.append(h('div',{class:'row'+(big?' big':'')},h('span',null,l),h('b',{'data-copy':raw(parseFloat(String(v).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.')),2)},EUR(v))));
    row('Netto',net);row(`MwSt (${trimN(t,2)} %)`,tax);row('Brutto',gr,1);
    if(q!==1){row(`Netto × ${trimN(q)}`,net*q);row(`Brutto × ${trimN(q)}`,gr*q,1)}
    pushHist('price',`${EUR(a)} ${plus?'+':'−'} ${trimN(t,2)} % MwSt${q!==1?' × '+trimN(q):''}`,EUR((plus?gr:net)*q),raw((plus?gr:net)*q,2))};
  const pct=h('input',{class:'inp',id:'pr-pct',inputmode:'decimal',autocomplete:'off',placeholder:'Prozent, z. B. 20'}),dout=h('div',{class:'rows',style:'margin-top:6px'});
  const disc=d=>{const a=N(amt.value),p=N(pct.value);if(isNaN(a)||isNaN(p)){toast('Preis und Prozent eingeben');return}const r=a*(1+d*p/100);dout.innerHTML='';
    dout.append(h('div',{class:'row big'},h('span',null,d<0?'Neuer Preis':'Preis mit Aufschlag'),h('b',{'data-copy':raw(r,2)},EUR(r))),h('div',{class:'row'},h('span',null,d<0?'Ersparnis':'Aufschlag'),h('b',null,EUR(Math.abs(r-a)))));
    pushHist('price',`${EUR(a)} ${d<0?'−':'+'} ${trimN(p)} %`,EUR(r),raw(r,2))};
  return h('section',{class:'panel',id:'tab-price'},
    h('div',{class:'card'},h('div',{class:'grid2'},h('div',null,h('label',{class:'lbl',for:'pr-amt'},'Preis (€)'),amt),h('div',null,h('label',{class:'lbl',for:'pr-qty'},'Menge'),qty)),h('label',{class:'lbl',style:'margin-top:10px'},'Steuersatz'),chipsEl,
      h('div',{class:'grid2',style:'margin-top:12px'},h('button',{class:'btn',onclick:()=>calc(true)},'+ MwSt',h('br'),h('small',null,'Netto → Brutto')),h('button',{class:'btn',onclick:()=>calc(false)},'− MwSt',h('br'),h('small',null,'Brutto → Netto')))),
    h('div',{class:'card'},out),
    h('div',{class:'card'},h('h2',null,'Rabatt / Aufschlag'),h('div',{class:'row-flex'},pct,h('button',{class:'btn alt sm',style:'flex:0 0 auto;min-width:92px',onclick:()=>disc(-1)},'− Rabatt'),h('button',{class:'btn alt sm',style:'flex:0 0 auto;min-width:92px',onclick:()=>disc(1)},'+ Aufschlag')),dout))}

/* ---------- Brief-Porto: BwPost vs. Deutsche Post ---------- */
const PROD=[
 {id:'std',n:'Standardbrief',maxW:20,minL:140,maxL:235,minB:90,maxB:125,maxD:5,ratio:1},
 {id:'kmp',n:'Kompaktbrief',maxW:50,minL:100,maxL:235,minB:70,maxB:125,maxD:10,ratio:1},
 {id:'grs',n:'Großbrief',maxW:500,minL:100,maxL:353,minB:70,maxB:250,maxD:20},
 {id:'max',n:'Maxibrief',maxW:1000,minL:100,maxL:353,minB:70,maxB:250,maxD:50},
 {id:'mxp',n:'Maxibrief bis 2 kg',maxW:2000,minL:100,maxL:600,minB:70,maxB:300,maxD:150}];
const PRICE0={dp:{std:.95,kmp:1.10,grs:1.80,max:2.90,mxp:5.10},bw:{std:.91,kmp:1.07,grs:1.75,max:2.86,mxp:5.10}};
const PROV={dp:'Deutsche Post',bw:'BwPost'};
const pPrice=(pv,id)=>{let p=S.post.prices[pv][id];if(p==null)p=PRICE0[pv][id];if(pv==='bw'&&S.post.bwVat)p=Math.round(p*1.19*100)/100;return p};
function failReasons(p,L,B,D,W){const r=[];if(W>p.maxW)r.push(`Gewicht über ${nf(0,0).format(p.maxW)} g`);if(D>p.maxD)r.push(`Dicke über ${p.maxD} mm`);if(L>p.maxL)r.push(`Länge über ${trimN(p.maxL/10,1)} cm`);if(B>p.maxB)r.push(`Breite über ${trimN(p.maxB/10,1)} cm`);
  if(L<p.minL||B<p.minB)r.push(`unter Mindestmaß ${p.minL/10} × ${p.minB/10} cm`);if(p.ratio&&B>0&&L<1.4*B&&L<=p.maxL&&B<=p.maxB)r.push('Seitenverhältnis unter 1,4 : 1');return r}
function pick(pv,L,B,D,W){for(let i=0;i<PROD.length;i++){if(!failReasons(PROD[i],L,B,D,W).length)return{p:PROD[i],i,price:pPrice(pv,PROD[i].id),why:i?failReasons(PROD[i-1],L,B,D,W):[]}}
  const l=PROD[PROD.length-1];return{p:null,why:failReasons(l,L,B,D,W)}}
function buildPost(){
  const P=S.post;const sec=h('section',{class:'panel',id:'tab-post'});
  const mkI=(k,l,ph)=>{const i=h('input',{class:'inp',inputmode:'decimal',autocomplete:'off',placeholder:ph,value:P[k]});i.addEventListener('input',()=>{P[k]=i.value;save();run()});return{i,el:h('div',null,h('label',{class:'lbl'},l),i)}};
  const fl=mkI('len','Länge (cm)','z. B. 22'),fb=mkI('wid','Breite (cm)','z. B. 11'),fd=mkI('thick','Dicke (mm)','z. B. 2'),fw=mkI('w','Gewicht (g)','z. B. 20'),fq=mkI('qty','Anzahl Briefe','1');
  const presets=[['DIN lang','22','11'],['C6','16,2','11,4'],['C5','22,9','16,2'],['C4','32,4','22,9'],['A4 Versand','35','25']];
  const chips=h('div',{class:'chips',style:'margin:10px 0 0'},presets.map(p=>h('button',{type:'button',class:'chip',onclick:()=>{P.len=fl.i.value=p[1];P.wid=fb.i.value=p[2];save();run()}},p[0])));
  const res=h('div'),ed=h('div',{class:'card hidden'}),hint=h('div',{class:'card'});
  function run(){
    res.innerHTML='';const len=N(P.len)*10,wid=N(P.wid)*10,th=N(P.thick),w=N(P.w),q=Math.max(1,Math.round(N(P.qty))||1);
    if(!(len>0&&wid>0&&th>0&&w>0)){res.append(h('div',{class:'card'},h('div',{class:'hint'},'Länge, Breite, Dicke und Gewicht eingeben.')));return}
    const L=Math.max(len,wid),B=Math.min(len,wid);
    const r={dp:pick('dp',L,B,th,w),bw:pick('bw',L,B,th,w)};
    const ok=['dp','bw'].filter(k=>r[k].p);let win=null;
    if(ok.length===2&&r.dp.price!==r.bw.price)win=r.dp.price<r.bw.price?'dp':'bw';else if(ok.length===1)win=ok[0];
    const card=k=>{const x=r[k];const c=h('div',{class:'pcard'+(x.p?'':' no')+(win===k&&ok.length===2?' win':'')},
      h('div',{class:'who'},h('span',null,PROV[k].toUpperCase()),win===k&&ok.length===2?h('span',{class:'tag'},'günstiger'):null));
      if(x.p){c.append(h('div',{class:'prod'},x.p.n),h('div',{class:'pr','data-copy':raw(x.price,2)},EUR(x.price)),h('div',{class:'why'},x.why.length?'Wegen: '+x.why.join(', '):'passt in das kleinste Format'))}
      else c.append(h('div',{class:'prod'},'Kein Briefformat'),h('div',{class:'pr'},'nicht möglich'),h('div',{class:'why'},x.why.join(', ')+' – Paket/Päckchen oder Warensendung prüfen'));return c};
    res.append(h('div',{class:'pcards'},card('dp'),card('bw')));
    let sum;
    if(ok.length===2){const d=Math.abs(r.dp.price-r.bw.price);
      if(d<0.005)sum=h('div',{class:'pdiff neutral'},'Beide gleich teuer'+(q>1?` – ${EUR(r.dp.price*q)} für ${q} Briefe`:''));
      else{const cheap=win==='dp'?'dp':'bw',pr=r[cheap===('dp')?'bw':'dp'].price;sum=h('div',{class:'pdiff'},`${PROV[cheap]} spart ${EUR(d)} pro Brief (${trimN(d/pr*100,1)} %)`+(q>1?` – bei ${q} Briefen ${EUR(d*q)}`:''))}}
    else if(ok.length===1)sum=h('div',{class:'pdiff neutral'},`Nur ${PROV[ok[0]]} kann diesen Brief als Brief befördern.`);
    else sum=h('div',{class:'pdiff neutral'},'Für diese Maße gibt es bei beiden keinen Brief – bitte Paket wählen.');
    res.append(sum);
    if(q>1&&ok.length)res.append(h('div',{class:'card'},h('div',{class:'rows'},ok.map(k=>h('div',{class:'row'},h('span',null,`${PROV[k]} × ${q}`),h('b',{'data-copy':raw(r[k].price*q,2)},EUR(r[k].price*q)))))));
    if(ok.length)logLater('post',`${P.len}×${P.wid} cm, ${P.thick} mm, ${P.w} g`,ok.map(k=>(k==='dp'?'DP ':'BwPost ')+EUR(r[k].price)).join(' · '))}
  function buildEd(){ed.innerHTML='';ed.append(h('h2',null,'Preise bearbeiten (€ je Brief)'),
    h('table',{class:'ptable'},h('tr',null,h('th',null,'Format'),h('th',null,'Deutsche Post'),h('th',null,'BwPost')),
      PROD.map(p=>h('tr',null,h('td',null,p.n),['dp','bw'].map(pv=>{const i=h('input',{class:'inp',inputmode:'decimal','aria-label':p.n+' '+PROV[pv],value:raw(S.post.prices[pv][p.id]??PRICE0[pv][p.id],2)});i.addEventListener('input',()=>{const v=N(i.value);if(v>=0){S.post.prices[pv][p.id]=v;save();run()}});return h('td',null,i)})))),
    h('button',{class:'btn alt sm',style:'width:100%;margin-top:10px',onclick:()=>{S.post.prices={dp:{},bw:{}};save();buildEd();run();toast('Preise zurückgesetzt')}},'↺ Auf Tarif 2026 zurücksetzen'))}
  const vat=h('input',{type:'checkbox',id:'bwvat'});vat.checked=!!P.bwVat;vat.addEventListener('change',()=>{P.bwVat=vat.checked;save();run()});
  hint.append(h('label',{class:'chk',for:'bwvat'},vat,h('span',null,'BwPost-Preise zzgl. 19 % MwSt. rechnen (die BwPost-Preisliste nennt „zzgl. gesetzlicher MwSt.“, Preise der Deutschen Post sind umsatzsteuerfrei)')),
    h('p',{class:'hint',style:'margin-top:12px'},'Tarife 2026: Deutsche Post (genehmigt bis 31.12.2026) und BwPost-Preisliste ab 01.01.2026. Die Deutsche Post hat höhere Preise ab 01.01.2027 beantragt (z. B. Standardbrief 1,15 €, Kompakt 1,25 €, Groß 2,35 €, Maxi 5,00 €) – noch nicht endgültig genehmigt. Eigene Preise kannst du unten eintragen.'),
    h('p',{class:'hint'},'Gleiche Formate bei beiden Anbietern. Standard- und Kompaktbrief: Länge mindestens das 1,4-Fache der Breite. BwPost stellt nur im eigenen Gebiet selbst zu. Der 2-kg-Maxibrief (mit Zuschlag) ist bei der Deutschen Post nach Preisliste ergänzt – Maße bitte vor dem Versand prüfen.'),
    h('button',{class:'btn alt sm',style:'width:100%;margin-top:6px',onclick:()=>{ed.classList.toggle('hidden');if(!ed.classList.contains('hidden')){buildEd();ed.scrollIntoView({behavior:'smooth',block:'nearest'})}}},'Preise bearbeiten'));
  sec.append(h('div',{class:'card'},h('div',{class:'grid2',style:'row-gap:10px'},fl.el,fb.el,fd.el,fw.el),h('div',{style:'margin-top:10px'},fq.el.firstChild,fq.i),chips),res,hint,ed);
  sec._show=run;run();return sec}

/* ---------- Timer & Stoppuhr ---------- */
function buildTimer(){
  const T={total:300,left:300,run:false,end:0,iv:null};const W={run:false,t0:0,acc:0,laps:[],iv:null};let mode='t';
  let ac;const beep=()=>{try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();[0,.35,.7].forEach(d=>{const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=880;g.gain.value=.25;o.connect(g);g.connect(ac.destination);o.start(ac.currentTime+d);o.stop(ac.currentTime+d+.22)})}catch(e){}if(navigator.vibrate)try{navigator.vibrate([300,150,300,150,300])}catch(e){}};
  const tdisp=h('div',{class:'tdisp'},'05:00'),sdisp=h('div',{class:'tdisp'},'00:00,00');
  const mmss=s=>{s=Math.max(0,Math.ceil(s));const hh=Math.floor(s/3600),m=Math.floor(s%3600/60);return(hh?hh+':'+pad(m):pad(m))+':'+pad(s%60)};
  const sw=ms=>{const c=Math.floor(ms/10)%100,s=Math.floor(ms/1000)%60,m=Math.floor(ms/60000)%60,hh=Math.floor(ms/3600000);return(hh?hh+':':'')+pad(m)+':'+pad(s)+','+pad(c)};
  const startB=h('button',{type:'button',class:'btn'},'Start'),resetB=h('button',{type:'button',class:'btn alt'},'Zurücksetzen');
  const sStart=h('button',{type:'button',class:'btn'},'Start'),sLap=h('button',{type:'button',class:'btn alt'},'Runde'),sReset=h('button',{type:'button',class:'btn alt'},'Zurücksetzen');
  const own=h('input',{class:'inp',inputmode:'decimal',placeholder:'Eigene Minuten, z. B. 12,5',autocomplete:'off','aria-label':'Eigene Minuten'});
  const lapsEl=h('div');
  const setT=s=>{T.total=T.left=s;tdisp.textContent=mmss(s);tdisp.classList.remove('done');startB.textContent='Start'};
  const chips=h('div',{class:'chips'},[1,3,5,10,15,30].map(m=>h('button',{type:'button',class:'chip',onclick:()=>{stopT();own.value='';setT(m*60)}},m+' Min')));
  function tick(){const l=(T.end-Date.now())/1000;if(l<=0){stopT();T.left=0;tdisp.textContent='00:00';tdisp.classList.add('done');startB.textContent='Start';beep();toast('Timer abgelaufen');return}T.left=l;tdisp.textContent=mmss(l)}
  function stopT(){T.run=false;clearInterval(T.iv);startB.textContent=T.left>0&&T.left<T.total?'Weiter':'Start'}
  startB.onclick=()=>{if(T.run){stopT();return}if(T.left<=0)setT(T.total);const o=N(own.value);if(!isNaN(o)&&o>0&&T.left===T.total&&own.value)setT(Math.round(o*60));T.run=true;T.end=Date.now()+T.left*1000;startB.textContent='Pause';tdisp.classList.remove('done');T.iv=setInterval(tick,200);tick();try{ac=ac||new(window.AudioContext||window.webkitAudioContext)()}catch(e){}};
  resetB.onclick=()=>{stopT();setT(T.total)};
  own.addEventListener('input',()=>{const o=N(own.value);if(!isNaN(o)&&o>0&&!T.run)setT(Math.round(o*60))});
  const wt=()=>W.acc+(W.run?Date.now()-W.t0:0);
  const drawLaps=()=>{lapsEl.innerHTML='';if(!W.laps.length){lapsEl.append(h('div',{class:'hint'},'Rundenzeiten erscheinen hier.'));return}W.laps.slice().reverse().forEach((l,i)=>lapsEl.append(h('div',{class:'lap'},h('span',null,'Runde '+(W.laps.length-i)),h('span',null,sw(l.d)),h('b',null,sw(l.t)))))};
  sStart.onclick=()=>{if(W.run){W.acc=wt();W.run=false;clearInterval(W.iv);sStart.textContent='Weiter';sdisp.textContent=sw(W.acc)}else{W.run=true;W.t0=Date.now();sStart.textContent='Stopp';W.iv=setInterval(()=>sdisp.textContent=sw(wt()),37)}};
  sLap.onclick=()=>{if(!W.run&&!W.acc)return;const t=wt();const prev=W.laps.length?W.laps[W.laps.length-1].t:0;W.laps.push({t,d:t-prev});drawLaps()};
  sReset.onclick=()=>{W.run=false;clearInterval(W.iv);W.acc=0;W.laps=[];sStart.textContent='Start';sdisp.textContent='00:00,00';drawLaps()};
  drawLaps();
  const tp=h('div',null,h('div',{class:'card'},tdisp,chips,own,h('div',{class:'btnrow'},startB,resetB),h('p',{class:'hint'},'Der Alarm ertönt nur, solange die App geöffnet ist (Ton + Vibration).')));
  const sp=h('div',{class:'hidden'},h('div',{class:'card'},sdisp,h('div',{class:'btnrow'},sStart,sLap,sReset)),h('div',{class:'card'},lapsEl));
  const bT=h('button',{type:'button',class:'on'},'Timer'),bS=h('button',{type:'button'},'Stoppuhr');
  const sw2=m=>{mode=m;bT.classList.toggle('on',m==='t');bS.classList.toggle('on',m==='s');tp.classList.toggle('hidden',m!=='t');sp.classList.toggle('hidden',m!=='s')};bT.onclick=()=>sw2('t');bS.onclick=()=>sw2('s');
  return h('section',{class:'panel',id:'tab-timer'},h('div',{class:'seg'},bT,bS),tp,sp)}

/* ---------- Zufall, Liste, Notizen ---------- */
function buildRandom(){
  const out=h('div',{class:'rnd-out'},'🎲');const set=t=>{out.textContent=t;out.dataset.copy=t.replace(/\n/g,' ');vib()};
  const ri=(a,b)=>{if(window.crypto&&crypto.getRandomValues){const r=b-a+1,m=Math.floor(4294967296/r)*r;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=m);return a+x%r}return a+Math.floor(Math.random()*(b-a+1))};
  const B=(t,f,s)=>h('button',{type:'button',class:'btn alt',style:s||'',onclick:f},t);
  const lo=h('input',{class:'inp',inputmode:'numeric',value:'1',autocomplete:'off','aria-label':'Von'}),hi=h('input',{class:'inp',inputmode:'numeric',value:'100',autocomplete:'off','aria-label':'Bis'});
  const opt=h('input',{class:'inp',placeholder:'Pizza, Burger, Salat',autocomplete:'off','aria-label':'Optionen'});
  return h('section',{class:'panel',id:'tab-random'},
    h('div',{class:'card'},out,h('div',{class:'hint',style:'text-align:center'},'Tippe auf das Ergebnis zum Kopieren'),h('div',{class:'fgrid'},
      B('🎲 Würfel',()=>set(String(ri(1,6)))),B('🎲🎲 Zwei Würfel',()=>{const a=ri(1,6),b=ri(1,6);set(`${a} + ${b}\n= ${a+b}`)}),B('🎯 W20',()=>set(String(ri(1,20)))),B('🪙 Münze',()=>set(ri(0,1)?'Kopf':'Zahl')),
      B('🎰 Lotto 6 aus 49',()=>{const s=new Set();while(s.size<6)s.add(ri(1,49));set([...s].sort((a,b)=>a-b).join(' · '))},'grid-column:1/-1'))),
    h('div',{class:'card'},h('h2',null,'Zufallszahl von … bis …'),h('div',{class:'fgrid'},lo,hi),h('button',{type:'button',class:'btn',style:'width:100%;margin-top:10px',onclick:()=>{let a=parseInt(lo.value),b=parseInt(hi.value);if(isNaN(a)||isNaN(b)){toast('Zahlen eingeben');return}if(a>b)[a,b]=[b,a];set(String(ri(a,b)))}},'Zahl ziehen')),
    h('div',{class:'card'},h('h2',null,'Entscheider (Optionen mit Komma trennen)'),opt,h('button',{type:'button',class:'btn',style:'width:100%;margin-top:10px',onclick:()=>{const o=opt.value.split(',').map(s=>s.trim()).filter(Boolean);if(o.length<2){toast('Mindestens zwei Optionen');return}set(o[ri(0,o.length-1)])}},'Entscheiden')))}
function buildList(){
  const inp=h('input',{class:'inp',placeholder:'Neuer Eintrag …',autocomplete:'off',enterkeyhint:'done','aria-label':'Neuer Eintrag'}),box=h('div'),cnt=h('div',{class:'hint'});
  const draw=()=>{box.innerHTML='';if(!S.list.length)box.append(h('div',{class:'empty'},'Die Liste ist leer.'));
    S.list.forEach((it,i)=>box.append(h('div',{class:'li'+(it.d?' done':'')},h('div',{class:'box',onclick:()=>{it.d=!it.d;save();draw()}},it.d?'✓':''),h('div',{class:'t',onclick:()=>{it.d=!it.d;save();draw()}},it.t),h('button',{class:'h-btns',style:'width:44px;height:44px;border:0;background:transparent;color:var(--muted);font-size:18px','aria-label':'Löschen',onclick:()=>{S.list.splice(i,1);save();draw()}},'✕'))));
    cnt.textContent=S.list.length?`${S.list.filter(x=>x.d).length} von ${S.list.length} erledigt`:''};
  const add=()=>{const t=inp.value.trim();if(!t)return;S.list.push({t,d:false});inp.value='';save();draw()};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')add()});draw();
  return h('section',{class:'panel',id:'tab-list'},h('div',{class:'row-flex',style:'margin-bottom:10px'},inp,h('button',{type:'button',class:'btn',style:'flex:0 0 auto;min-width:92px',onclick:add},'Hinzu')),box,cnt,
    h('div',{class:'grid2',style:'margin-top:8px'},h('button',{type:'button',class:'btn alt sm',onclick:()=>{S.list=S.list.filter(x=>!x.d);save();draw()}},'Erledigte entfernen'),h('button',{type:'button',class:'btn danger sm',onclick:()=>{if(S.list.length&&confirm('Ganze Liste löschen?')){S.list=[];save();draw()}}},'Alles löschen')))}
function buildNotes(){
  const ta=h('textarea',{class:'inp',placeholder:'Notizen werden automatisch gespeichert …','aria-label':'Notizen'});ta.value=S.notes;const cnt=h('div',{class:'hint'});
  const upd=()=>{cnt.textContent=ta.value.length?ta.value.length+' Zeichen':''};ta.addEventListener('input',()=>{S.notes=ta.value;save();upd()});upd();
  return h('section',{class:'panel',id:'tab-notes'},ta,cnt,h('div',{class:'grid2',style:'margin-top:8px'},h('button',{type:'button',class:'btn alt sm',onclick:()=>{if(ta.value)copy(ta.value);else toast('Nichts zu kopieren')}},'Kopieren'),h('button',{type:'button',class:'btn danger sm',onclick:()=>{if(ta.value&&confirm('Notizen löschen?')){ta.value='';S.notes='';save();upd()}}},'Löschen')))}
function buildHist(){
  return h('section',{class:'panel',id:'tab-hist'},h('div',{class:'row-flex',style:'justify-content:space-between;margin:0 2px 8px'},h('div',{class:'hint',id:'h-count'}),h('button',{class:'btn danger sm',onclick:()=>{if(S.hist.length&&confirm('Verlauf löschen?')){S.hist=[];save();renderHist()}}},'Alles löschen')),
    h('ul',{class:'h-list',id:'h-list'}),h('p',{class:'hint'},'Tippen: Ergebnis in den Rechner übernehmen. Lange drücken oder ⧉: kopieren.'))}

/* ---------- Übersicht / Leiste ---------- */
const META={calc:['🧮','Rechner','Rechnen'],sci:['𝑓','Wissenschaft','Rechnen'],price:['🏷️','Preis','Rechnen'],pct:['％','Prozent','Rechnen'],tip:['🍽️','Trinkgeld','Rechnen'],unit:['📏','Einheiten','Rechnen'],
 post:['✉️','Brief-Porto','Alltag'],date:['📅','Datum','Alltag'],work:['🕒','Arbeitszeit','Alltag'],mix:['🧪','Mischen','Alltag'],timer:['⏲️','Timer','Alltag'],random:['🎲','Zufall','Alltag'],
 fx:['💱','Währung','Geld'],loan:['🏦','Kredit','Geld'],save:['🐖','Sparen','Geld'],zins:['📈','Zinsen','Geld'],fuel:['⛽','Sprit','Geld'],ratio:['⚖️','Dreisatz','Geld'],uprice:['🛒','Stückpreis','Geld'],
 base:['🔢','Zahlsysteme','Weiteres'],list:['✅','Liste','Weiteres'],notes:['📝','Notizen','Weiteres'],hist:['🕘','Verlauf','Weiteres']};
(BR.hide||[]).forEach(id=>{delete META[id]});
const SHORT={sci:'Wiss.',post:'Porto',uprice:'Stückpr.',work:'Arbeit',random:'Zufall',unit:'Einh.',base:'Zahlen',notes:'Notizen'};
let cur='calc',editing=false;
function drawBar(){const bar=$('#tabbar');bar.innerHTML='';
  S.bar.filter(x=>x&&META[x]).forEach(id=>bar.append(h('button',{type:'button','data-tab':id,class:cur===id?'on':'',onclick:()=>showTab(id)},h('span',{class:'ic'},META[id][0]),SHORT[id]||META[id][1])));
  bar.append(h('button',{type:'button','data-tab':'all',class:cur==='all'?'on':'',onclick:()=>showTab('all')},h('span',{class:'ic'},'⊞'),'Alle'))}
function showTab(id){
  cur=id;S.tab=id;save();$$('.panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+id));
  $('#title').textContent=id==='all'?'Alle Helfer':META[id]?META[id][1]:'Rechner';
  const p=$('#tab-'+id);if(p&&p._show)p._show();if(id==='all')drawAll();if(id==='hist')renderHist();
  if(id==='calc')calcs.calc.render();if(id==='sci')calcs.sci.render();drawBar()}
function drawAll(){
  const root=$('#tab-all');root.innerHTML='';
  const slots=h('div',{class:'slots'});
  const drawSlots=()=>{slots.innerHTML='';for(let i=0;i<5;i++){const id=S.bar[i];const s=h('div',{class:'slot'+(id?' full':''),'data-i':i},id?[h('span',{class:'ic'},META[id][0]),META[id][1],h('button',{class:'x','aria-label':'Entfernen',onclick:e=>{e.stopPropagation();S.bar[i]=null;save();drawAll()}},'✕')]:[h('span',{class:'ic'},'＋'),'frei']);
    if(id)s.addEventListener('pointerdown',e=>startDrag(e,id,i));slots.append(s)}};
  const bar=h('div',{class:'editbar'},h('button',{type:'button',class:'btn alt sm',style:'width:100%',onclick:()=>{editing=!editing;drawAll()}},editing?'✓ Fertig':'⚙ Untere Leiste anpassen'));
  if(editing){bar.append(h('p',{class:'hint'},'Tippe auf einen Helfer, um ihn anzuheften oder zu lösen. Oder ziehe ihn am ⠿ in einen Platz.'));drawSlots();bar.append(slots)}
  root.append(bar);
  let g=null,grid;
  Object.keys(META).forEach(id=>{const m=META[id];if(m[2]!==g){g=m[2];root.append(h('div',{class:'grp'},g.toUpperCase()));grid=h('div',{class:'launch'});root.append(grid)}
    const inbar=S.bar.includes(id);
    const t=h('button',{type:'button',class:'tile'+(inbar?' inbar':''),onclick:()=>{if(!editing){showTab(id);return}
      if(inbar){S.bar[S.bar.indexOf(id)]=null}else{const f=S.bar.findIndex(x=>!x);if(f<0){toast('Leiste voll – erst einen Platz freigeben');return}S.bar[f]=id}save();drawAll()}},
      inbar?h('span',{class:'pin'},'•'):null,h('span',{class:'ic'},m[0]),m[1],editing?h('span',{class:'grip','aria-label':'Ziehen',onpointerdown:e=>{e.stopPropagation();startDrag(e,id,-1)}},'⠿'):null);
    grid.append(t)});
}
function startDrag(e,id,from){
  if(!editing)return;e.preventDefault();const gh=h('div',{class:'ghost'},META[id][0]);document.body.append(gh);let over=null;
  const mv=ev=>{gh.style.left=ev.clientX+'px';gh.style.top=ev.clientY+'px';const el=document.elementFromPoint(ev.clientX,ev.clientY);const s=el&&el.closest('.slot');$$('.slot').forEach(x=>x.classList.toggle('over',x===s));over=s?+s.dataset.i:null};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);gh.remove();
    if(over!=null){const old=S.bar.indexOf(id);if(from>=0){const t=S.bar[over];S.bar[over]=id;S.bar[from]=t||null}else{if(old>=0)S.bar[old]=null;S.bar[over]=id}save()}
    if(editing)drawAll()};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);mv(e)}

/* ---------- Einstellungen & Design ---------- */
function applyTheme(){const r=document.documentElement;if(S.theme==='auto')r.removeAttribute('data-theme');else r.dataset.theme=S.theme;
  const bg=getComputedStyle(r).getPropertyValue('--bg').trim();const m=$('meta[name=theme-color]');if(m&&bg)m.content=bg}
function wireSettings(){
  const d=$('#dlg');
  $('#btnTheme').onclick=()=>{S.theme=S.theme==='auto'?'light':S.theme==='light'?'dark':'auto';save();applyTheme();toast('Design: '+({auto:'automatisch',light:'hell',dark:'dunkel'})[S.theme])};
  $('#btnSettings').onclick=()=>{$('#s-theme').value=S.theme;$('#s-vib').checked=S.vib;$('#s-dec').value=S.dec;$('#s-tax').value=raw(S.tax,2);$('#s-ang').value=S.ang;d.showModal()};
  $('#s-close').onclick=()=>d.close();
  $('#s-theme').onchange=e=>{S.theme=e.target.value;save();applyTheme()};
  $('#s-vib').onchange=e=>{S.vib=e.target.checked;save()};
  $('#s-dec').onchange=e=>{S.dec=Math.min(8,Math.max(0,parseInt(e.target.value)||0));e.target.value=S.dec;save()};
  $('#s-tax').onchange=e=>{const v=N(e.target.value);if(v>=0){S.tax=v;S.pr.tax=v;save()}};
  $('#s-ang').onchange=e=>{S.ang=e.target.value;save();updAng();calcs.sci.render()};
  $('#s-reset').onclick=()=>{if(confirm('Wirklich alle gespeicherten Daten löschen?')){try{localStorage.removeItem(KEY)}catch(e){}location.reload()}};
  d.addEventListener('click',e=>{if(e.target===d)d.close()});
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',applyTheme)}

/* ---------- Start ---------- */
function init(){
  const m=$('#main');
  m.append(buildCalc(),buildSci(),buildFx(),buildPrice(),buildPost(),buildPct(),buildTip(),buildUnit(),buildTimer(),buildRandom(),buildList(),buildNotes(),buildHist());
  for(const id in TOOLS)m.append(buildTool(id,TOOLS[id]));
  m.append(h('section',{class:'panel',id:'tab-all'}));
  wireCalc();wireSettings();applyTheme();
  S.bar=(S.bar||[]).filter(x=>x===null||META[x]);while(S.bar.length<5)S.bar.push(null);S.bar=S.bar.slice(0,5);
  showTab(META[S.tab]||S.tab==='all'?S.tab:'calc');
  if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
  const sp=$('#splash'),t0=performance.now();
  const hide=()=>{sp.classList.add('out');setTimeout(()=>sp.remove(),600)};
  const wait=Math.max(0,(matchMedia('(prefers-reduced-motion:reduce)').matches?500:1300)-(performance.now()-t0));setTimeout(hide,wait)}
window.__rechner={get S(){return S},showTab};
try{init()}catch(e){console.error(e);$('#splash')&&$('#splash').remove();document.body.append(h('pre',{style:'padding:16px;color:#b42318'},'Fehler: '+e.message))}
})();
