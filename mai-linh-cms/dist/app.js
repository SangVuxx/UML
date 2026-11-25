
'use strict';
const $=q=>document.querySelector(q);
const el=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('vi-VN').format(n);
const dong=n=>fmt(n)+' ₫';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const icon=(id)=>`<svg class="ico" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="icons.svg#${id}"></use></svg>`;
const btn=(label,act,ic='',cl='',val='')=>`<button class="btn ${cl}" data-act="${act}" data-val="${esc(val)}">${ic?icon(ic):''}${label}</button>`;
const chip=(s,t)=>`<span class="chip ${t}"><i></i>${s}</span>`;
const rowbtn=(name,act,val,ic)=>`<button class="rowact" title="${esc(name)}" aria-label="${esc(name)}" data-act="${act}" data-val="${esc(val)}">${icon(ic)}</button>`;
const datefmt=d=>d.split('-').reverse().join('/');
const opts=(values,value)=>values.map(([k,v])=>`<option value="${esc(k)}" ${k==value?'selected':''}>${esc(v)}</option>`).join('');
const field=(label,control)=>`<label class="field">${label}${control}</label>`;
const numIn=(id,v,min=0,max=999999999)=>`<input type="number" step="1" id="${id}" min="${min}" max="${max}" required value="${v}">`;
const info=(label,value)=>`<div class="kv"><small>${label}</small><b>${value}</b></div>`;
const pages={pay:['Thống kê công lương tài xế','wallet'],base:['Số ca ban đầu','clipboard-list'],policy:['1. Cấu hình ăn chia','sliders-horizontal'],...Object.fromEntries(Object.entries(itemSections).map(([key,v])=>[key,[v.title,v.icon]])),closing:['6. Nhập doanh thu hằng ngày','clipboard-list'],profiles:['Tài xế','users-round'],fleet:['Phương tiện','car-front']};

const mainUnit='2060';
const orgs=[[mainUnit,'2060 - Đội KD Bắc Ninh'],['demo02','Đơn vị minh họa 02']];
const models=[
 {id:'vios',brand:'Toyota',name:'Vios',legacy:0},
 {id:'soluto',brand:'Kia',name:'Soluto',legacy:0},
 {id:'avanza',brand:'Toyota',name:'Avanza',legacy:1},
 {id:'vf5',brand:'VinFast',name:'VF5',legacy:2},
 {id:'attrage',brand:'Mitsubishi',name:'Attrage'}
];
const modelInfo=id=>models.find(m=>m.id===id);
const modelName=id=>{const m=modelInfo(id);return m?m.brand+' '+m.name:'Chưa gắn dòng xe'};
const fleet=[
 ['X01','vios'],['X02','soluto'],['X03','avanza'],['X04','vf5'],['X05','vios'],
 ['X06','soluto'],['X07','vf5'],['X08','avanza'],['X09','vios'],['X10','soluto'],
 ['X11','attrage'],['X12',null],['X13','soluto']
].map(([id,model],i)=>({id,unit:mainUnit,model,code:'DEMO-X'+String(i+1).padStart(2,'0'),plate:'XE-MẪU-'+String(i+1).padStart(2,'0')}));
fleet.push({id:'D01',unit:'demo02',model:'vios',code:'DEMO01',plate:'XE-MẪU-B01'});
// Public demo fixtures use fictitious identifiers and generated shift data.
const people=[89,'old',30,'old',10,null,0,'old',84,50].map((base,index)=>{
 const number=String(index+1).padStart(2,'0');
 return {id:'DEMO-'+number,name:'Tài xế mẫu '+number,vehicleId:'X'+number,base};
});


const mkpolicy=(b,r)=>({bounds:b,rates:r});
const originalPolicies=[
 [mkpolicy([800000,950000,1100000,1230000],[49,52,54,56,63]),mkpolicy([800000,950000,1100000,1230000],[47,50,52,54,61])],
 [mkpolicy([850000,1000000,1200000,1400000],[50,53,55,57,61]),mkpolicy([850000,1000000,1200000,1400000],[48,51,53,55,59])],
 [mkpolicy([750000,900000,1050000,1200000],[51,53,55,57,62]),mkpolicy([750000,900000,1050000,1200000],[49,51,53,55,60])]
];
const storeKey='ml-cms-demo-v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(storeKey)||'{}')||{}}catch{}
const policyStart='2026-11-01';
let cutoff=saved.cutoff||policyStart;
let baseline=Object.fromEntries(people.map(p=>[p.id,p.base]));
Object.assign(baseline,saved.baseline||{});

function seedPolicyBook(){
 const book={};
 for(const m of models){
  if(m.legacy===undefined)continue;
  const legacy=saved.versions?.[m.legacy]||[{from:policyStart,bands:originalPolicies[m.legacy]}];
  book[mainUnit+'|'+m.id]=[0,1].map(t=>legacy.filter(v=>v.bands?.[t]).map(v=>({from:v.from,rule:structuredClone(v.bands[t])})));
 }
 return book;
}
const policyBook=saved.policyBook||seedPolicyBook();
function ruleAt(org,model,t,date){
 const history=policyBook[org+'|'+model]?.[t]||[];
 return history.filter(v=>v.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
}
function writeRule(org,model,t,date,rule){
 const key=org+'|'+model,byTier=policyBook[key]??=[[],[]];
 byTier[t]=byTier[t].filter(v=>v.from!==date);
 byTier[t].push({from:date,rule:structuredClone(rule)});
}
const save=()=>{try{localStorage.setItem(storeKey,JSON.stringify({baseline,policyBook,cutoff}));return true}catch{toast('Đã cập nhật trong phiên. Trình duyệt chưa lưu được dữ liệu.');return false}};
let scope=mainUnit,brandFilter='all',policyState='all',modelQuery='',fleetModel='all',fleetQuery='',selectedModel=null;
const orgTitle=()=>orgs.find(o=>o[0]===scope)[1];
const fleetForOrg=()=>fleet.filter(v=>v.unit===scope);
function ownModels(){
 const ids=new Set(fleetForOrg().map(v=>v.model));
 for(const key of Object.keys(policyBook)){const [org,m]=key.split('|');if(org===scope)ids.add(m)}
 return models.filter(m=>ids.has(m.id));
}
function modelStatus(model){const n=[0,1].filter(t=>ruleAt(scope,model,t,policyDate)).length;return ['none','partial','ready'][n]}


let page=pages[location.hash.slice(1)]?location.hash.slice(1):'pay',period='2026-11',filter='',groupFilter='all',statusFilter='all',modelFilter='all',pageNo=1,tier=1,policyDate='2026-11-23',opened='',detailDriver='',pendingImport=[];
const timeChoices=[12,24,48,72];
const stage=n=>n===null?'pending':n==='old'||n>=90?'old':'new';
const stageBadge=s=>s==='pending'?chip('Chờ đối soát','amber'):s==='new'?chip('Lái mới','blue'):chip('Lái cũ','mint');
const seedShifts=people.flatMap((p,i)=>{
 const count=6+i%5;let d=1+(i%3);
 return Array.from({length:count},(_,j)=>{const hours=i===0&&j===1?48:(j%7===4?48:j%5===1?12:24),day=d;d+=Math.ceil(hours/24);
  let vehicleId=p.vehicleId;
  if(i===0&&j>=5)vehicleId='X13';
  if(i===8&&j===count-1)vehicleId='X11';
  const vehicle=fleet.find(v=>v.id===vehicleId);
  return {unit:vehicle.unit,vehicleId,plate:vehicle.plate,modelKey:vehicle.model,id:`${p.id}-${j+1}`,driver:p.id,date:`2026-11-${String(day).padStart(2,'0')}`,hours,model:modelName(vehicle.model),rev:(700000+100000*((i+j)%8))*hours/24,seq:j+1};});
});

const shifts=assembleShifts(seedShifts);

function compute(rule,hours,rev){
 const b=rule.bounds.map(v=>v*hours/24),r=rule.rates,parts=[];
 const add=(amt,rate,name)=>{if(amt>0)parts.push({amt,rate,name,pay:Math.round(amt*rate/100)})};
 if(rev<=b[0])add(rev,r[0],'Mức đầu');
 else{add(Math.min(rev,b[1]),r[1],'Phần doanh thu ban đầu');for(let k=2;k<r.length;k++)add(Math.min(rev,b[k]??Infinity)-b[k-1],r[k],'Phần vượt mức '+k)}
 return {parts,total:parts.reduce((s,p)=>s+p.pay,0)};
}
function calc(s){
 const base=baseline[s.driver],ord=typeof base==='number'?base+(1+shifts.filter(a=>a.driver===s.driver&&a.date>=cutoff).findIndex(a=>a.id===s.id)):null;
 const role=base===null?'pending':base==='old'||ord>90?'old':'new';
 const v=ruleAt(s.unit,s.modelKey,role==='new'?0:1,s.date);
 return {role,ord,v,result:role==='pending'||!v?null:compute(v.rule,s.hours,s.rev)};
}
const pshifts=id=>shifts.filter(s=>s.driver===id&&s.date>=cutoff&&s.date.startsWith(period));
function aggregate(p){const list=pshifts(p.id).filter(s=>modelFilter==='all'||s.modelKey===modelFilter);const pay=list.map(s=>calc(s));return {p,list,models:[...new Set(list.map(s=>s.model))].join(' / '),count:list.length,rev:list.reduce((a,s)=>a+s.rev,0),amount:pay.reduce((a,c)=>a+(c.result?.total||0),0),pending:pay.some(c=>!c.result)}}
const pof=id=>people.find(p=>p.id===id);

let pageSize=20,searchBy='all';
const searchable=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
const match=p=>searchable(searchBy==='id'?p.id:searchBy==='name'?p.name:p.name+' '+p.id).includes(searchable(filter).trim());
const empty=(n,txt)=>`<tr><td class="empty" colspan="${n}">${txt}</td></tr>`;
const table=(headers,body)=>`<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th scope="col" class="${Array.isArray(h)?h[1]:''}">${esc(Array.isArray(h)?h[0]:h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
const titlebar=()=>`<h1 class="titlebar">${pages[page][0]}</h1>`;
const labelled=(text,control)=>`<label class="fieldline"><span>${text}</span>${control}</label>`;
const pick=(id,label,options,selected,cls='')=>`<select id="${id}" aria-label="${label}" class="${cls}">${opts(options,selected)}</select>`;
const unit=()=>labelled('Đơn vị',pick('unit','Đơn vị',[['2060','2060 - Đội KD Bắc Ninh']],'2060','unitselect'));
const tool=(label,act,ic)=>`<button class="tool" data-act="${act}">${icon(ic)}${label}</button>`;
const periodText=()=>`Tháng ${Number(period.slice(-2))}/${period.slice(0,4)}`;
const periodFields=()=>labelled('Thời gian',pick('month','Tháng',Array.from({length:12},(_,i)=>[i+1,'Tháng '+(i+1)]),Number(period.slice(-2))))+pick('year','Năm',[2025,2026,2027].map(y=>[y,y]),Number(period.slice(0,4)));
const searchLine=()=>`<div class="toolbar"><span class="leading">Tìm</span><div class="inputgroup"><input id="query" type="search" aria-label="Tìm tài xế" placeholder="Tìm kiếm..." value="${esc(filter)}"><button data-act="search" aria-label="Tìm kiếm tài xế">${icon('search')}</button><button data-act="clear" aria-label="Xóa từ khóa">${icon('x')}</button></div>${labelled('Tìm theo',pick('searchBy','Tìm theo',[['all','Mã hoặc tên tài xế'],['id','Mã tài xế'],['name','Tên tài xế']],searchBy))}</div>`;
const searchActions=()=>`<div class="actionbar">${btn('Tìm kiếm','search','search')}</div>`;
const lastPage=n=>Math.max(1,Math.ceil(n/pageSize));
const rowNum=i=>(pageNo-1)*pageSize+i+1;
function sliceRows(rows){pageNo=Math.min(lastPage(rows.length),Math.max(1,pageNo));return rows.slice(rowNum(0)-1,pageNo*pageSize)}
function footer(n,kind='tài xế'){
 const last=lastPage(n);
 const pageButton=(act,ic,name,disabled)=>`<button class="btn" data-act="${act}" aria-label="${name}" title="${name}" ${disabled?'disabled':''}>${icon(ic)}</button>`;
 return `<div class="panelFoot"><div class="pagernav">${pageButton('prev','chevron-left','Trang trước',pageNo===1)}<label>Trang <input type="number" id="pageNo" aria-label="Trang hiện tại" min="1" max="${last}" value="${pageNo}"></label><span>của ${last}</span>${pageButton('next','chevron-right','Trang sau',pageNo>=last)}<span class="sep"></span>${pick('pageSize','Số dòng mỗi trang',[5,10,20,50].map(n=>[n,n]),pageSize)}</div><span>${n?`Hiển thị từ ${rowNum(0)} - ${Math.min(pageNo*pageSize,n)} trên tổng số ${n} ${kind}`:'Không có dữ liệu phù hợp'}</span></div>`;
}
const allModels=[['all','Tất cả'],...models.map(m=>[m.id,modelName(m.id)])];
function filteredPayroll(){return people.map(aggregate).filter(a=>(a.count||wholeMonth()&&(Object.keys(insLabels).some(k=>insuranceAt(a.p.id,k,period).on)||extraState.periods[[mainUnit,period,a.p.id].join('|')]))&&match(a.p)&&(statusFilter==='all'||(statusFilter==='pending')===itemPending(a)))}
function payroll(){
 const rows=filteredPayroll();
 const stats=rows.map(a=>{const x=periodItems(a.p.id);return {fees:x.dayFees===null||x.monthFees===null?null:x.dayFees+x.monthFees,income:subtotal(a,x)};});
 const statTotal=k=>wholeMonth()&&stats.every(x=>x[k]!==null)?stats.reduce((sum,x)=>sum+x[k],0):null;
 const summary='<div class="toolbar kpi-toolbar">'+info('Tổng doanh thu',dong(rows.reduce((sum,a)=>sum+a.rev,0)))+info('Tổng phí',showAmount(statTotal('fees')))+info('Thu nhập tạm tính',showAmount(statTotal('income')))+'</div>';
 const filters=`<div class="filterbox">${searchLine()}<div class="toolbar">${periodFields()}${labelled('Trạng thái',pick('statusFilter','Trạng thái',[['all','Tất cả'],['done',wholeMonth()?'Đã đối soát':'Đã tính ăn chia'],['pending','Chờ đối soát']],statusFilter))}<div class="push">${tool('Xuất bảng lương','export','download')}</div></div><div class="toolbar">${unit()}${labelled('Dòng xe',pick('modelFilter','Dòng xe',allModels,modelFilter))}</div>${searchActions()}${summary}</div>`;
 const sum=k=>rows.reduce((a,s)=>a+s[k],0);
 const headers=['STT','Trạng thái','Mã tài xế','Họ và tên','Dòng xe','Số ca làm việc','Doanh thu','1. Tiền ăn chia',...reportLabels,'Tạm tính mục 1–5','Chi tiết'];
 const monthly=wholeMonth();
 const data=sliceRows(rows).map((a,i)=>{
   const v=periodItems(a.p.id),pending=itemPending(a);
   return `<tr class="linkrow" data-act="driver" data-val="${a.p.id}"><td class="center">${rowNum(i)}</td><td class="center">${pending?chip('Chờ đối soát','amber'):chip(monthly?'Đã đối soát':'Đã tính ăn chia','blue')}</td><td>${a.p.id}</td><td>${a.p.name}</td><td>${a.models}</td><td class="center">${a.count}</td><td class="num">${dong(a.rev)}</td><td class="num">${showAmount(a.pending?null:a.amount)}</td>`+
     [...reportKeys.map(k=>v[k]),subtotal(a,v)].map(n=>'<td class="num">'+(monthly?showAmount(n):'—')+'</td>').join('')+
     '<td class="center">'+rowbtn('Xem chi tiết '+a.p.name,'driver',a.p.id,'list-checks')+'</td></tr>';
 }).join('');
 const totals=rows.length?'<tr class="totals"><td colspan="5">Tổng theo bộ lọc</td><td class="center">'+fmt(sum('count'))+'</td><td class="num">'+dong(sum('rev'))+'</td><td class="num">'+showAmount(rows.some(a=>a.pending)?null:sum('amount'))+'</td>'+
   [...reportKeys,'total'].map(k=>{const values=rows.map(a=>{const v=periodItems(a.p.id);return k==='total'?subtotal(a,v):v[k]});return '<td class="num">'+showAmount(monthly&&values.every(n=>n!==null)?values.reduce((a,b)=>a+b,0):null)+'</td>'}).join('')+'<td></td></tr>':'';
 const note=monthly?'BHXH và BHYT là hai khoản nằm trong phí tháng. Các cột bảo hiểm cập nhật theo hồ sơ tài xế, kể cả khi các phí khác đang chờ đối soát.':'Bộ lọc dòng xe hiển thị phần ăn chia theo các ca phù hợp. Chọn “Tất cả” để xem các khoản và tổng theo tài xế trong tháng.';
 return titlebar()+filters+'<div class="viewport">'+table(headers,(data||empty(headers.length,'Không có dữ liệu theo điều kiện tìm kiếm.'))+totals)+'<div class="policyfoot">'+note+'</div></div>'+footer(rows.length);
}
function baseScreen(){
 const rows=people.filter(p=>match(p)&&(groupFilter==='all'||stage(baseline[p.id])===groupFilter));
 const filters=`<div class="filterbox">${searchLine()}<div class="toolbar">${labelled('Mốc chốt',btn(datefmt(cutoff),'cutoff','calendar-days'))}${labelled('Nhóm lái',pick('groupFilter','Nhóm lái',[['all','Tất cả'],['new','Lái mới'],['old','Lái cũ'],['pending','Chờ đối soát']],groupFilter))}<div class="push">${tool('Nhập số ca từ Excel','import','upload')}</div></div><div class="toolbar">${unit()}</div>${searchActions()}</div>`;
 const data=sliceRows(rows).map((p,i)=>{const v=baseline[p.id],s=stage(v);
 return `<tr><td class="center">${rowNum(i)}</td><td>${p.id}</td><td>${p.name}</td><td>${modelName(fleet.find(v=>v.id===p.vehicleId)?.model)}</td><td class="center">${v===null?'Chưa xác nhận':v==='old'?'Đã đủ 90 ca':v+' ca'}</td><td class="center">${stageBadge(s)}</td><td>${v===null?'Chờ đối soát':v==='old'?'Mức lái cũ':'Ca '+(v+1)}</td><td class="center">${rowbtn('Sửa số ca '+p.name,'editbase',p.id,'square-pen')}</td></tr>`}).join('');
 return titlebar()+filters+`<div class="viewport">${table(['STT','Mã tài xế','Tên tài xế','Dòng xe','Số ca trước mốc chốt','Nhóm tại mốc chốt','Ca đầu trên CMS','Sửa'],data||empty(8,'Không có tài xế phù hợp.'))}</div>`+footer(rows.length);
}

const chooseOrg=()=>labelled('Đơn vị',pick('orgScope','Đơn vị cấu hình',orgs,scope,'unitselect'));
const brandPicker=()=>labelled('Hãng xe',pick('brandFilter','Hãng xe',[['all','Tất cả'],...Array.from(new Set(ownModels().map(m=>m.brand))).map(b=>[b,b])],brandFilter));
const statuses=[['all','Tất cả'],['none','Chưa cấu hình'],['partial','Thiếu một nhóm lái'],['ready','Đủ hai nhóm lái']];
const stateBadge=state=>chip(statuses.find(s=>s[0]===state)[1],state==='ready'?'mint':'amber');
const namedBtn=(label,act,id,ic='')=>btn(label,act,ic,'smallbtn',id);
const demoFleetFilter=(m)=>fleetForOrg().filter(v=>v.model===m);
function fleetScreen(){
 const query=searchable(fleetQuery.trim()),rows=fleetForOrg().filter(v=>(fleetModel==='all'||(v.model||'none')===fleetModel)&&searchable(v.code+' '+v.plate+' '+modelName(v.model)).includes(query));
 const filters=`<div class="filterbox"><div class="toolbar">${chooseOrg()}${labelled('Dòng xe',pick('fleetModel','Lọc phương tiện theo dòng',[['all','Tất cả'],['none','Chưa gắn dòng xe'],...ownModels().map(m=>[m.id,modelName(m.id)])],fleetModel))}</div><div class="toolbar">${labelled('Tìm',`<input id="fleetQuery" aria-label="Tìm phương tiện" placeholder="Biển số, mã tài hoặc dòng xe" value="${esc(fleetQuery)}">`)}</div></div>`;
 const rowsHtml=sliceRows(rows).map((v,i)=>`<tr><td class="center">${rowNum(i)}</td><td>${v.code}</td><td>${v.plate}</td><td>${modelInfo(v.model)?.brand||'—'}</td><td>${modelInfo(v.model)?.name||'—'}</td><td class="center">${v.model?stateBadge(modelStatus(v.model)):chip('Thiếu dòng xe','amber')}</td><td class="center">${v.model?namedBtn('Xem cấu hình','fromFleet',v.model,'sliders-horizontal'):'Bổ sung tại hồ sơ phương tiện'}</td></tr>`).join('');
 return titlebar()+filters+`<div class="viewport">${table(['STT','Mã tài','Biển số','Hãng xe','Dòng xe','Cấu hình ăn chia','Thao tác'],rowsHtml||empty(7,'Không có phương tiện phù hợp.'))}<div class="policyfoot">Danh sách xe minh họa theo cấu trúc Danh mục → Phương tiện của EMDDI. Trạng thái cấu hình tại ngày ${datefmt(policyDate)}.</div></div>`+footer(rows.length,'phương tiện');
}
function policyScreen(){
 if(selectedModel)return policyDetail();
 const q=searchable(modelQuery.trim()),rows=ownModels().filter(m=>(brandFilter==='all'||brandFilter===m.brand)&&(policyState==='all'||policyState===modelStatus(m.id))&&searchable(modelName(m.id)).includes(q));
 const filters=`<div class="filterbox"><div class="toolbar">${chooseOrg()}${brandPicker()}${labelled('Trạng thái',pick('policyState','Trạng thái cấu hình',statuses,policyState))}</div><div class="toolbar">${labelled('Tìm dòng xe',`<input type="search" id="modelQuery" placeholder="Nhập hãng hoặc dòng xe..." value="${esc(modelQuery)}">`)}${labelled('Ngày tra cứu',`<input type="date" id="policyDate" value="${policyDate}">`)}</div></div>`;
 const items=sliceRows(rows).map((m,i)=>{const dates=[0,1].map(t=>ruleAt(scope,m.id,t,policyDate)?.from);return `<tr><td class="center">${rowNum(i)}</td><td>${m.brand}</td><td><b>${m.name}</b></td><td class="center">${namedBtn(String(demoFleetFilter(m.id).length)+' xe','fleetOf',m.id)}</td><td class="center">${dates[0]?datefmt(dates[0]):'—'}</td><td class="center">${dates[1]?datefmt(dates[1]):'—'}</td><td class="center">${stateBadge(modelStatus(m.id))}</td><td class="center">${namedBtn('Thiết lập','modelDetail',m.id,'square-pen')}</td></tr>`}).join('');
 return titlebar()+filters+`<div class="viewport">${table(['STT','Hãng xe','Dòng xe','Phương tiện','Lái mới · hiệu lực từ','Lái cũ · hiệu lực từ','Trạng thái','Thao tác'],items||empty(8,'Không có dòng xe phù hợp.'))}<div class="policyfoot">Mỗi dòng xe của đơn vị có một cấu hình riêng. Chọn số xe để xem các biển số thuộc dòng đó.</div></div>`+footer(rows.length,'dòng xe');
}
function policyDetail(){
 const m=modelInfo(selectedModel),ver=ruleAt(scope,m.id,tier,policyDate),rule=ver?.rule;
 const controls=`<div class="filterbox"><div class="toolbar">${tool('Danh sách dòng xe','backModels','arrow-left')}<b>${esc(orgTitle())} &nbsp; / &nbsp; ${modelName(m.id)}</b><div class="push">${tool('Sao chép từ dòng khác','copyRule','clipboard-list')}${tool(rule?'Chỉnh sửa bảng tỷ lệ':'Nhập bảng tỷ lệ','editpolicy','square-pen')}${tool('Tính thử','simulate','calculator')}</div></div><div class="toolbar">${labelled('Ngày tra cứu',`<input id="policyDate" type="date" value="${policyDate}">`)}${namedBtn('Xem '+demoFleetFilter(m.id).length+' xe','fleetOf',m.id,'car-front')}</div></div>`;
 const tabs=`<div class="tabbar">${['Lái mới (ca 1–90)','Lái cũ (từ ca 91)'].map((n,i)=>`<button class="tab ${tier===i?'on':''}" aria-pressed="${tier===i}" data-act="tier" data-val="${i}">${n}</button>`).join('')}</div>`;
 const body=rule?rule.rates.map((r,i)=>`<tr><td class="center">${i+1}</td><td class="num">${i?'Trên '+dong(rule.bounds[i-1]):'Từ 0 ₫'}</td><td class="num">${i<rule.bounds.length?dong(rule.bounds[i]):'Không giới hạn'}</td><td class="center">${r}%</td><td class="center">${datefmt(ver.from)}</td></tr>`).join(''):empty(5,'Chưa có tỷ lệ hiệu lực cho nhóm lái này. Nhập bảng tỷ lệ hoặc sao chép từ dòng xe khác.');
 return titlebar()+controls+tabs+`<div class="viewport">${table(['Mức','Ngưỡng từ (24h)','Ngưỡng đến (24h)','Tỷ lệ ăn chia','Hiệu lực từ'],body)}<div class="policyfoot"><p><b>Quy đổi ngưỡng doanh thu</b> &nbsp;12h × 0,5 &nbsp;|&nbsp; 24h × 1 &nbsp;|&nbsp; 48h × 2 &nbsp;|&nbsp; 72h × 3. Mỗi ca được đếm một lần.</p><p>Khi vượt ngưỡng đầu, tỷ lệ mức 2 áp dụng cho doanh thu đến hết ngưỡng 2. Các mức sau áp dụng cho phần vượt.</p>${m.id==='vios'||m.id==='soluto'?'<p>Ngưỡng đầu 800.000 ₫/24h trong dữ liệu mẫu đang chờ xác nhận.</p>':''}</div></div><div class="panelFoot"><span>${modelName(m.id)} · ${tier===0?'Lái mới':'Lái cũ'}</span><span>${rule?.rates.length||0} mức doanh thu</span></div>`;
}
function copyRule(){
 const others=ownModels().filter(m=>m.id!==selectedModel&&modelStatus(m.id)!=='none');
 if(!others.length){toast('Đơn vị chưa có dòng xe khác có cấu hình để sao chép.');return}
 const source=others.find(m=>m.id==='vios')||others[0];
 sheet('Sao chép tỷ lệ ăn chia',orgTitle(),`<div class="formgrid">${field('Dòng xe nguồn',pick('copySource','Dòng xe nguồn',others.map(m=>[m.id,modelName(m.id)]),source.id))}${info('Dòng xe nhận',modelName(selectedModel))}${field('Nhóm lái',pick('copyTier','Nhóm lái cần sao chép',[['both','Cả lái mới và lái cũ'],['0','Chỉ lái mới'],['1','Chỉ lái cũ']],'both'))}${field('Ngày hiệu lực của bản sao',`<input required id="copyDate" type="date" min="${policyStart}" value="${policyDate}">`)}</div><div class="note">Lấy tỷ lệ nguồn tại ngày ${datefmt(policyDate)}. Bản sao thuộc riêng ${modelName(selectedModel)} kể từ ngày hiệu lực. Nếu đã có tỷ lệ tại cùng ngày, bản sao thay thế tỷ lệ của nhóm lái đã chọn.</div><div id="copyPreview"></div>`,btn('Hủy','close')+'<button class="btn primary" id="copyApply" data-act="applyCopy">Lưu bản sao</button>');previewCopy();
}
function previewCopy(){
 const source=el('copySource').value,ts=el('copyTier').value==='both'?[0,1]:[+el('copyTier').value];
 const rules=ts.map(t=>ruleAt(scope,source,t,policyDate));
 el('copyApply').disabled=!el('copyDate').checkValidity()||rules.some(x=>!x);
 el('copyPreview').innerHTML=table(['Nhóm lái','Ngày hiệu lực nguồn','Tỷ lệ theo mức'],rules.map((v,i)=>`<tr><td>${ts[i]===0?'Lái mới':'Lái cũ'}</td><td>${v?datefmt(v.from):'—'}</td><td>${v?v.rule.rates.map(n=>n+'%').join(' / '):'Chưa có tỷ lệ'}</td></tr>`).join(''));
}
function applyCopy(){
 previewCopy();if(el('copyApply').disabled)return;
 const from=el('copyDate').value,source=el('copySource').value,tiers=el('copyTier').value==='both'?[0,1]:[+el('copyTier').value];
 for(const t of tiers)writeRule(scope,selectedModel,t,from,ruleAt(scope,source,t,policyDate).rule);
 policyDate=from;save();close();render();toast('Đã sao chép tỷ lệ cho '+modelName(selectedModel)+'.');
}


function render(stay=false){
 const active=stay?document.activeElement?.id:null,isText=['query','modelQuery','fleetQuery'].includes(active),sel=isText?el(active).selectionStart:null;
 el('links').innerHTML=Object.entries(pages).map(([key,[label,ic]])=>`${key==='pay'?'<div class="navgroup">Thống kê</div>':key==='base'?'<div class="navgroup">Thiết lập công lương</div>':key==='closing'?'<div class="navgroup">Ca kinh doanh</div>':key==='profiles'?'<div class="navgroup">Danh mục</div>':''}<button class="navitem ${key===page?'active':''}" data-act="page" data-val="${key}" ${key===page?'aria-current="page"':''}>${icon(ic)}${label}</button>`).join('');
 el('main').innerHTML=page==='pay'?payroll():page==='base'?baseScreen():page==='fleet'?fleetScreen():page==='profiles'?profileList():page==='closing'?closingScreen():itemSections[page]?itemScreen(page):policyScreen();
 if(active&&el(active)){el(active).focus();if(isText)el(active).setSelectionRange(sel,sel)}
}
let restoreFocus=null;
function sheet(title,sub,body,footer='',wide=false){
 if(!opened)restoreFocus=document.activeElement;
 opened=title;el('modalRoot').innerHTML=`<div class="modalbg"><section class="sheet ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"><div class="sheethead"><div><h2 id="sheetTitle">${title}</h2><p>${sub}</p></div>${rowbtn('Đóng','close','','x')}</div><div class="sheetbody">${body}</div>${footer?`<div class="sheetfoot">${footer}</div>`:''}</section></div>`;
 document.body.style.overflow='hidden';el('main').inert=true;el('nav').inert=true;$('.top').inert=true;$('.sheethead button').focus();
}
function close(){el('modalRoot').innerHTML='';opened='';document.body.style.overflow='';el('main').inert=false;el('nav').inert=false;$('.top').inert=false;restoreFocus?.focus?.()}
let timer;function toast(text){el('notice').textContent=text;el('notice').style.display='block';clearTimeout(timer);timer=setTimeout(()=>el('notice').style.display='none',3500)}
function driver(id){detailDriver=id;const a=aggregate(pof(id));sheet('Chi tiết công lương tài xế',`${a.p.name} · ${id} · ${periodText()}`,
 `<div class="detailgrid">${info('Doanh thu trong kỳ',dong(a.rev))}${info('Tiền ăn chia tạm tính',a.pending?'Chờ đối soát':dong(a.amount))}</div>${driverItems(id)}<h3 class="subheading">Ca kinh doanh (${a.count})</h3><div class="outline">`+
 table(['Ngày / Dòng xe','Thời lượng','Ca thứ','Chính sách',['Tiền ăn chia','num'],''],a.list.map(s=>{const c=calc(s);return `<tr class="linkrow" data-act="shift" data-val="${s.id}"><td><b>${datefmt(s.date)}</b><small class="secondary">${s.model}</small></td><td>${s.hours}h</td><td>${c.ord??(c.role==='old'?'≥ 91':'—')}</td><td>${stageBadge(c.role)}</td><td class="num money">${c.result?fmt(c.result.total):'—'}</td><td>${rowbtn('Xem phép tính ngày '+datefmt(s.date),'shift',s.id,'chevron-right')}</td></tr>`}).join(''))+'</div>',btn('Đóng','close'),true)}
function breakdown(c){return table(['Phần tính',['Doanh thu','num'],['Tỷ lệ','num'],['Tiền hưởng','num']],c.parts.map(b=>`<tr><td>${b.name}</td><td class="num">${fmt(b.amt)}</td><td class="num">${b.rate}%</td><td class="num">${fmt(b.pay)}</td></tr>`).join('')||empty(4,'Doanh thu bằng 0.'))+`<div class="detailsum"><span>Tiền tài xế hưởng</span><b>${dong(c.total)}</b></div>`}
function shift(id){const s=shifts.find(a=>a.id===id),p=pof(s.driver),c=calc(s);sheet('Chi tiết ăn chia một ca',`${p.name} · ${datefmt(s.date)}`,btn('Danh sách ca','driver','arrow-left','tertiary back',s.driver)+namedBtn('Phiếu kết ca','close-form',s.id,'clipboard-list')+`<div class="detailgrid space">${info('Phương tiện trong ca',s.plate)}${info('Dòng xe tại ca',s.model)}${info('Ca kinh doanh',`${s.hours} giờ · Hệ số ${fmt(s.hours/24)}`)}${info('Thứ tự ca của tài xế',c.ord??(c.role==='old'?'Từ ca 91':'Chưa xác định'))}${info('Chính sách',stageBadge(c.role))}${info('Doanh thu ca',dong(s.rev))}${info('Phí thu hộ theo ca',showAmount(feeForShift(s).total))}${info('Ngày hiệu lực',c.v?datefmt(c.v.from):'—')}</div><h3 class="subheading">Chi tiết phép tính</h3>`+(c.result?breakdown(c.result):c.role!=='pending'?`<div class="note warn">${s.modelKey?'Chưa có tỷ lệ hiệu lực cho dòng xe và nhóm lái tại ngày chạy ca.':'Xe trong ca chưa được gắn dòng xe.'}</div>`:`<div class="note warn">Bổ sung dữ liệu số ca ban đầu để xác định nhóm lái.</div>${btn('Sửa số ca ban đầu','editbase','pencil','',p.id)}`),btn('Đóng','close'),true)}
function editBase(id){const p=pof(id),v=baseline[id],s=typeof v==='number'?'known':v===null?'pending':'old';sheet('Cập nhật số ca ban đầu',`${p.name} · ${p.id}`,`<form id="baseForm"><div class="note">Chốt đến trước ngày <b>${datefmt(cutoff)}</b>. CMS tự cộng các ca đã hoàn thành sau mốc này.</div>${field('Tình trạng khi chuyển đổi',`<select id="baseType">${opts([['known','Biết số ca đã hoàn thành'],['old','Đã đủ 90 ca'],['pending','Chờ đối soát']],s)}</select>`)}<div class="space" id="knownBox" ${s==='known'?'':'hidden'}>${field('Số ca đã hoàn thành',numIn('baseValue',typeof v==='number'?v:0,0,99999))}</div></form>`,btn('Hủy','close')+btn('Lưu số ca','savebase','check','primary',id))}
function simulator(){sheet('Tính thử tiền ăn chia',modelName(selectedModel),`<form id="simForm"><div class="formgrid">${field('Nhóm lái',`<select id="simTier">${opts([['0','Lái mới · Ca 1–90'],['1','Lái cũ · Từ ca 91']],tier)}</select>`)}${field('Thời lượng ca',`<select id="simHours">${opts(timeChoices.map(h=>[h,h+' giờ']),24)}</select>`)}${field('Doanh thu ca (₫)',numIn('simRev',1500000))}${field('Ngày áp dụng',`<input id="simDate" type="date" required value="${policyDate}">`)}</div></form><div id="simResult" class="space"></div>`,btn('Đóng','close'));updateSim()}
function updateSim(){const form=el('simForm');if(!form)return;const v=ruleAt(scope,selectedModel,+el('simTier').value,el('simDate').value);if(!form.checkValidity()||!v){el('simResult').innerHTML='<div class="note warn">Kiểm tra doanh thu và ngày có cấu hình hiệu lực.</div>';return}const h=+el('simHours').value;el('simResult').innerHTML=`<div class="note">Hệ số ngưỡng <b>× ${fmt(h/24)}</b> · Số ca được ghi nhận <b>1 ca</b></div>`+breakdown(compute(v.rule,h,+el('simRev').value))}
function editPolicy(){const ver=ruleAt(scope,selectedModel,tier,policyDate),r=ver?.rule||{bounds:['','','',''],rates:['','','','','']};sheet('Chỉnh sửa bảng tỷ lệ',`${modelName(selectedModel)} · ${tier===0?'Lái mới':'Lái cũ'}`,`<form id="policyForm">${field('Hiệu lực từ ngày',`<input id="from" type="date" min="${policyStart}" value="${policyDate}" required>`)}<div class="space outline">`+table(['Mức',['Ngưỡng trên 24h (₫)','num'],['Tỷ lệ (%)','num']],r.rates.map((n,i)=>`<tr><td>${i+1}</td><td class="num rulecell">${i===4?'Phần còn lại':numIn('b'+i,r.bounds[i],1)}</td><td class="num rulecell"><input id="r${i}" type="number" value="${n}" min="0" max="100" step="0.01" required></td></tr>`).join(''))+`</div><div class="note">Thay đổi áp dụng từ ngày hiệu lực cho các ca thuộc bộ chính sách này.</div><div id="policyError" role="alert"></div></form>`,btn('Hủy','close')+btn('Lưu cấu hình','savepolicy','check','primary'))}
function savePolicy(){if(!el('policyForm').reportValidity())return;const bounds=[0,1,2,3].map(i=>+el('b'+i).value),rates=[0,1,2,3,4].map(i=>+el('r'+i).value),from=el('from').value;if(bounds.some((v,i)=>i&&v<=bounds[i-1])){el('policyError').innerHTML='<div class="note warn">Mỗi ngưỡng phải lớn hơn ngưỡng liền trước.</div>';return}writeRule(scope,selectedModel,tier,from,{bounds,rates});policyDate=from;save();close();render();toast('Đã lưu bảng tỷ lệ cho '+modelName(selectedModel)+'.');}
function outCsv(name,rows){const data='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function exportPayroll(){
 const rows=filteredPayroll(),monthly=wholeMonth();
 outCsv('Bang-luong-'+period+'.csv',[['MSNV','Họ tên','Dòng xe','Số ca','Doanh thu','1. Tiền ăn chia',...reportLabels,'Tạm tính mục 1–5','Trạng thái'],...rows.map(a=>{
   const v=periodItems(a.p.id);
   return [a.p.id,a.p.name,a.models,a.count,a.rev,a.pending?'':a.amount,...reportKeys.map(k=>monthly?v[k]:''),monthly?subtotal(a,v):'',itemPending(a)?'Chờ đối soát':monthly?'Đã đối soát':'Đã tính ăn chia'];
 })]);toast('Đã xuất bảng lương theo bộ lọc.');
}
function importPanel(){pendingImport=[];sheet('Nhập số ca từ Excel','Mốc chốt '+datefmt(cutoff),`<div class="note">Dùng mã nhân viên để khớp tài xế. Nhập số ca đã hoàn thành, “Đã đủ 90 ca” hoặc “Chờ đối soát”.</div><a class="btn" href="mau-so-ca.xlsx" download>${icon('download')} Tải file Excel mẫu</a><div class="filedrop space">${icon('file-spreadsheet')}<b>Chọn bảng số ca ban đầu</b><span class="secondary">Chấp nhận .xlsx và .csv theo mẫu</span><input id="importFile" type="file" accept=".xlsx,.csv" aria-label="Tệp số ca ban đầu"></div><div id="importPreview" class="space" aria-live="polite"></div>`,btn('Hủy','close')+'<button class="btn primary" id="applyImport" data-act="applyimport" disabled>Áp dụng</button>')}
function parseCsv(t){let rows=[],row=[],part='',quoted=false;t=t.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');const first=t.split('\n')[0],del=first.includes(';')?';':',';for(let i=0;i<t.length;i++){let c=t[i];if(c==='"'){if(quoted&&t[i+1]==='"'){part+='"';i++}else quoted=!quoted}else if(c===del&&!quoted){row.push(part);part=''}else if(c==='\n'&&!quoted){row.push(part);rows.push(row);row=[];part=''}else part+=c}row.push(part);rows.push(row);return rows}
async function readXlsx(file){
 const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer);let end=bytes.length-22;while(end>=0&&v.getUint32(end,true)!==0x06054b50)end--;if(end<0)throw Error('Tệp Excel không hợp lệ.');
 const files=new Map();let pos=v.getUint32(end+16,true);for(let i=0;i<v.getUint16(end+10,true);i++){const nl=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nl));files.set(name,{method:v.getUint16(pos+10,true),size:v.getUint32(pos+20,true),raw:v.getUint32(pos+24,true),off:v.getUint32(pos+42,true)});pos+=46+nl+extra+comment}
 const xml=async path=>{const f=files.get(path);if(!f)return null;if(f.raw>8e6)throw Error('Trang tính quá lớn cho bản mẫu.');const start=f.off+30+v.getUint16(f.off+26,true)+v.getUint16(f.off+28,true);const data=new Blob([bytes.slice(start,start+f.size)]);const text=f.method===0?await data.text():await new Response(data.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();return new DOMParser().parseFromString(text,'application/xml')};
 const ss=await xml('xl/sharedStrings.xml'),strings=ss?Array.from(ss.getElementsByTagName('si'),s=>s.textContent):[];
 const sheet=await xml('xl/worksheets/sheet1.xml');if(!sheet)throw Error('Dùng trang tính đầu tiên của file mẫu.');
 return Array.from(sheet.getElementsByTagName('row'),row=>{let out=[];for(const c of row.getElementsByTagName('c')){let ref=c.getAttribute('r').replace(/\d/g,''),idx=0;for(const ch of ref)idx=idx*26+ch.charCodeAt(0)-64;let t=c.getAttribute('t'),val=c.getElementsByTagName('v')[0]?.textContent??'';out[idx-1]=t==='s'?strings[+val]:t==='inlineStr'?c.getElementsByTagName('is')[0]?.textContent:val}return out});
}
async function previewImport(file){
 pendingImport=[];el('applyImport').disabled=true;if(!file)return;
 try{if(file.size>5e6)throw Error('Vui lòng chọn tệp dưới 5 MB.');const rows=file.name.toLowerCase().endsWith('.xlsx')?await readXlsx(file):parseCsv(await file.text());const h=rows.shift()?.map(v=>searchable(v||'').trim());const col=h?.indexOf('msnv'),bc=h?.indexOf('so ca ban dau');if(col==null||col<0||bc<0)throw Error('Cần có hai cột MSNV và Số ca ban đầu theo file mẫu.');const seen=new Set(),valid=[];
 for(const [i,row] of rows.entries()){if(!row.some(v=>String(v??'').trim()))continue;const id=String(row[col]??'').trim().toUpperCase(),v=searchable(row[bc]??'').trim();if(!pof(id)||seen.has(id))throw Error(`Dòng ${i+2} có MSNV chưa có trong danh sách hoặc bị trùng.`);seen.add(id);let value;if(v==='da du 90 ca')value='old';else if(v==='cho doi soat')value=null;else if(/^\d{1,5}$/.test(v))value=+v;else throw Error(`Số ca tại dòng ${i+2} chưa hợp lệ.`);valid.push({id,value})}if(!valid.length)throw Error('Tệp chưa có dòng dữ liệu.');if(!el('importPreview'))return;pendingImport=valid;
 el('importPreview').innerHTML=`<h3 class="subheading">Xem trước · ${valid.length} tài xế</h3>`+table(['MSNV','Họ tên','Số ca ban đầu'],valid.map(a=>`<tr><td>${a.id}</td><td>${pof(a.id).name}</td><td>${a.value===null?'Chờ đối soát':a.value==='old'?'Đã đủ 90 ca':a.value}</td></tr>`).join(''));el('applyImport').disabled=false;
 }catch(e){if(el('importPreview'))el('importPreview').innerHTML=`<div class="note warn">${esc(e.message)}</div>`}}
function navigate(to,keepSelection=false){if(!keepSelection){selectedModel=null;fleetModel='all';modelQuery=fleetQuery='';brandFilter=policyState='all'}page=to;filter='';statusFilter=groupFilter=modelFilter='all';pageNo=1;if(window.matchMedia('(max-width:540px)').matches)document.body.classList.remove('collapsed');if(opened)close();render();window.scrollTo(0,0)}
document.addEventListener('click',e=>{
 if(e.target.classList.contains('modalbg')){close();return}const t=e.target.closest('[data-act]');if(!t||t.disabled)return;const a=t.dataset.act,v=t.dataset.val;
 if(a==='menu'){document.body.classList.toggle('collapsed');return}
 if(a==='search'||a==='clear'){filter=a==='clear'?'':el('query').value;pageNo=1;render();return}
 if(a==='cutoff'){sheet('Chọn mốc chốt số ca','Mai Linh Bắc Ninh',field('Ngày bắt đầu ghi nhận ca trên CMS',`<input type="date" id="cutoffDate" required value="${cutoff}">`)+`<div class="note">Số ca ban đầu là số ca đã hoàn thành trước ngày này. Khi đổi mốc, các tài xế sẽ chuyển sang Chờ đối soát để kế toán xác nhận số ca tại mốc mới. CMS đếm các ca có ngày bắt đầu từ mốc đã chọn.</div>`,btn('Hủy','close')+btn('Áp dụng mốc chốt','setcutoff','check','primary'));return}
 if(a==='setcutoff'){const f=el('cutoffDate');if(!f.reportValidity())return;if(f.value!==cutoff){cutoff=f.value;for(const p of people)baseline[p.id]=null;save()}close();render();toast('Đã áp dụng mốc chốt số ca.');return}

 if(a==='modelDetail'||a==='fromFleet'){selectedModel=v;if(page!=='policy')history.pushState(null,'','#policy');navigate('policy',true);return}
 if(a==='backModels'){selectedModel=null;pageNo=1;render();return}
 if(a==='fleetOf'){fleetModel=v;fleetQuery='';history.pushState(null,'','#fleet');navigate('fleet',true);return}
 if(a==='copyRule'){copyRule();return}if(a==='applyCopy'){applyCopy();return}
 if(a==='page'){if(location.hash.slice(1)!==v)location.hash=v;else navigate(v);return}
 if(a==='prev'||a==='next'){pageNo+=a==='next'?1:-1;render();return}
 if(a==='tier'){tier=+v;render();return}
 if(a==='driver')driver(v);if(a==='shift')shift(v);if(a==='editbase')editBase(v);if(a==='close')close();
 if(a==='savebase'){const type=el('baseType').value,f=el('baseValue');if(type==='known'&&!f.reportValidity())return;baseline[v]=type==='known'?Number(f.value):type==='old'?'old':null;save();close();render();if(baseProfileOrigin===v){baseProfileOrigin='';profilePanel(v)}toast('Đã cập nhật số ca và tính lại tiền ăn chia.')}
 if(a==='simulate')simulator();if(a==='editpolicy')editPolicy();if(a==='savepolicy')savePolicy();if(a==='export')exportPayroll();
 if(a==='import')importPanel();if(a==='applyimport'&&pendingImport.length){for(const r of pendingImport)baseline[r.id]=r.value;save();close();render();toast(`Đã cập nhật ${pendingImport.length} tài xế.`);pendingImport=[]}
});
document.addEventListener('input',e=>{if(e.target.id==='query'){filter=e.target.value;pageNo=1;render(true)}if(e.target.id==='modelQuery'){modelQuery=e.target.value;pageNo=1;render(true)}if(e.target.id==='fleetQuery'){fleetQuery=e.target.value;pageNo=1;render(true)}if(e.target.closest('#simForm'))updateSim()});
document.addEventListener('change',e=>{const id=e.target.id,v=e.target.value;if(id==='baseType'){el('knownBox').hidden=v!=='known';return}if(id==='importFile'){previewImport(e.target.files[0]);return}
 if(id==='month')period=period.slice(0,4)+'-'+v.padStart(2,'0');else if(id==='year')period=v+'-'+period.slice(-2);else if(id==='pageNo'){pageNo=Math.max(1,Number(v)||1);render();return}else if(id==='pageSize')pageSize=Number(v);else if(id==='searchBy')searchBy=v;else if(id==='orgScope'){scope=v;selectedModel=null;brandFilter=policyState=fleetModel='all';modelQuery=fleetQuery=''}else if(id==='brandFilter')brandFilter=v;else if(id==='policyState')policyState=v;else if(id==='fleetModel')fleetModel=v;else if(['copyTier','copyDate','copySource'].includes(id)){previewCopy();return}else if(id==='modelFilter')modelFilter=v;else if(id==='statusFilter')statusFilter=v;else if(id==='groupFilter')groupFilter=v;else if(id==='policyDate'){if(!v)return;policyDate=v}else return;pageNo=1;render()});
document.addEventListener('submit',e=>e.preventDefault());
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(opened)close();else document.body.classList.remove('menuopen')}if(e.key==='Tab'&&opened){const nodes=[...el('modalRoot').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(n=>n.offsetParent!==null);if(!nodes.length)return;if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus()}}});
window.addEventListener('hashchange',()=>{if(pages[location.hash.slice(1)])navigate(location.hash.slice(1))});
document.querySelectorAll('[data-icon]').forEach(n=>n.innerHTML=icon(n.dataset.icon));$('.menub').innerHTML=icon('chevron-left');render();

