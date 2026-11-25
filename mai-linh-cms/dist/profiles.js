'use strict';

const reportKeys=['allowance','dayFees','monthFees','social','health','tax'];
const reportLabels=[...itemLabels.slice(0,3),'Trong phí tháng · BHXH','Trong phí tháng · BHYT',itemLabels[3]];
const insLabels={social:'BHXH',health:'BHYT'};
const isInsurance=code=>Object.hasOwn(insLabels,code);
const profilesByDriver=new Map();
const profileKey=id=>'ml-cms-profile-v1|'+mainUnit+'|'+id;
const monthText=m=>m?m.slice(5,7)+'/'+m.slice(0,4):'—';
function profileFor(id){
  if(!profilesByDriver.has(id)){
    let record={};
    try{record=JSON.parse(localStorage.getItem(profileKey(id))||'{}')||{};}catch{}
    profilesByDriver.set(id,record);
  }
  return profilesByDriver.get(id);
}
function writeProfile(id,patch){
  const record={...profileFor(id),...patch};
  profilesByDriver.set(id,record);
  try{localStorage.setItem(profileKey(id),JSON.stringify(record));return true;}
  catch{toast('Đã cập nhật trong phiên. Trình duyệt chưa lưu được hồ sơ.');return false;}
}
function insuranceAt(id,code,month){
  const history=profileFor(id).insurance?.[code]||[];
  const event=history.findLast(e=>e.from<=month);
  if(event)return {on:event.on,from:event.from,legacy:false};
  // Previously reconciled insurance is evidence for that particular month only.
  const prior=extraState.periods[[mainUnit,month,id].join('|')]?.monthly;
  const legacy=!!prior?.on?.includes(code);
  return {on:legacy,from:legacy?month:'',legacy};
}
function dependentsAt(id,month){
  const profile=profileFor(id);
  if(profile.reviewFrom && month>=profile.reviewFrom){
    const count=profile.dependents.filter(r=>r.from<=month&&(!r.to||r.to>=month)).length;
    return {count,source:'Hồ sơ tài xế'};
  }
  const old=extraState.periods[[mainUnit,month,id].join('|')]?.tax;
  if(Number.isInteger(old?.dependents))return {count:old.dependents,source:'Đối soát đã lưu của riêng kỳ này'};
  return {count:null,source:'Chưa xác nhận người phụ thuộc'};
}
function monthlyAmounts(id,month,book){
  const config=effectiveItem('monthlyFees',month+'-01');
  const worked=shifts.filter(s=>s.driver===id&&s.date.startsWith(month)&&s.date>=cutoff);
  const revenue=book.monthly?.rev??worked.reduce((t,s)=>t+s.rev,0);
  const result={social:0,health:0,manual:book.monthly&&config?0:null,total:null};
  for(const code of Object.keys(insLabels)){
    if(!insuranceAt(id,code,month).on)continue;
    const rule=config?.data.find(r=>r.code===code);
    result[code]=rule?rateValue(rule,revenue):null;
  }
  const manual=config?.data.filter(r=>!isInsurance(r.code));
  if(manual){
    const included=manual.filter(r=>Array.isArray(book.monthly?.on)&&!book.monthly.automatic?book.monthly.on.includes(r.code):worked.length>0);
    result.manual=included.reduce((n,r)=>n+rateValue(r,revenue),0);
  }
  if([result.social,result.health,result.manual].every(v=>v!==null))result.total=result.social+result.health+result.manual;
  return result;
}
function profileList(){
  const records=people.filter(match);
  const body=sliceRows(records).map((p,i)=>{
    const dep=dependentsAt(p.id,period),base=baseline[p.id];
    return '<tr><td class="center">'+rowNum(i)+'</td><td>'+esc(p.id)+'</td><td>'+esc(p.name)+'</td><td>'+
      (base===null?'Chờ đối soát':base==='old'?'Đã đủ 90 ca':fmt(base)+' ca')+'</td><td>'+
      (dep.count===null?'Chưa xác nhận':fmt(dep.count)+' người')+'</td>'+
      Object.keys(insLabels).map(k=>'<td>'+insuranceBadge(insuranceAt(p.id,k,period))+'</td>').join('')+
      '<td>'+namedBtn('Hồ sơ công lương','profile',p.id,'square-pen')+'</td></tr>';
  }).join('');
  return titlebar()+'<div class="filterbox">'+searchLine()+'<div class="toolbar">'+unit()+periodFields()+'</div></div><div class="viewport">'+
    table(['STT','Mã tài xế','Họ và tên','Số ca ban đầu','Người phụ thuộc','BHXH','BHYT','Công lương'],body||empty(8,'Không tìm thấy tài xế.'))+'</div>'+footer(records.length);
}
function insuranceBadge(v){
  return v.on?chip(v.legacy?'Đã thu trong kỳ':'Tham gia từ '+monthText(v.from),'mint'):
    (v.from?chip('Dừng từ '+monthText(v.from),'amber'):'Chưa ghi nhận tham gia');
}
const profileBack=id=>btn('Về hồ sơ','profile','arrow-left','',id);
function profilePanel(id){
  const p=pof(id),rec=profileFor(id),deps=dependentsAt(id,period),base=baseline[id];
  const counted=shifts.filter(s=>s.driver===id&&s.date>=cutoff&&s.date.slice(0,7)<=period).length;
  const baseText=base===null?'Chờ đối soát':base==='old'?'Đã đủ 90 ca':fmt(base)+' ca';
  const cumulative=period<cutoff.slice(0,7)?'Trước mốc chốt':typeof base==='number'?fmt(base+counted)+' ca':base==='old'?'Đã đủ 90 ca':'Chờ số ca ban đầu';
  let body='<div class="item-driver-heading"><h3 class="subheading">Ca kinh doanh</h3>'+namedBtn('Sửa số ca ban đầu','profile-base',id,'pencil')+'</div>'+
    '<div class="detailgrid">'+info('Số ca trước '+datefmt(cutoff),baseText)+info('Lũy kế đến hết '+monthText(period),cumulative)+'</div>'+
    '<p class="item-caption">CMS đã ghi nhận '+fmt(counted)+' ca từ mốc chốt đến hết kỳ. Mỗi ca 12h, 24h hoặc 48h được tính là một ca.</p>'+
    '<div class="item-driver-heading"><h3 class="subheading">Người phụ thuộc</h3>'+namedBtn('Cập nhật người phụ thuộc','profile-deps',id,'square-pen')+'</div>'+
    '<p class="item-caption">'+(deps.count===null?deps.source:fmt(deps.count)+' người trong tháng '+monthText(period)+' · '+deps.source)+'</p>';
  if(rec.dependents?.length)body+=table(['Người phụ thuộc / mã hồ sơ','Từ tháng','Đến hết tháng'],rec.dependents.map(d=>'<tr><td>'+esc(d.label)+'</td><td>'+monthText(d.from)+'</td><td>'+(d.to?monthText(d.to):'Đang áp dụng')+'</td></tr>').join(''));
  body+='<h3 class="subheading">Tham gia bảo hiểm</h3>'+table(['Khoản','Trạng thái kỳ '+monthText(period),'Thao tác'],Object.entries(insLabels).map(([code,label])=>'<tr><td>'+label+'</td><td>'+insuranceBadge(insuranceAt(id,code,period))+'</td><td>'+
    namedBtn('Xác nhận tính đóng '+label,'profile-ins',id+'|'+code,'square-pen')+'</td></tr>').join(''));
  sheet('Hồ sơ tài xế · Công lương',p.name+' · '+id+' · '+periodText(),body,
    (page==='pay'?btn('Về chi tiết lương','driver','arrow-left','',id):'')+btn('Đóng','close'),true);
}
function insurancePanel(id,code){
  const name=insLabels[code],history=profileFor(id).insurance?.[code]||[];
  const body='<form id="insForm"><div class="formgrid">'+field('Áp dụng từ tháng','<input id="insMonth" type="month" value="'+period+'" required>')+
    '<div class="field">Trạng thái'+checks('insOn','Tham gia '+name,insuranceAt(id,code,period).on)+'</div></div></form>'+
    '<p class="item-caption">Để dừng thu, chọn tháng bắt đầu dừng rồi bỏ tích tham gia.</p>'+
    (history.length?'<h3 class="subheading">Lịch sử tham gia</h3>'+table(['Từ tháng','Trạng thái'],[...history].reverse().map(e=>'<tr><td>'+monthText(e.from)+'</td><td>'+(e.on?'Tham gia':'Dừng tham gia')+'</td></tr>').join('')):'');
  sheet('Xác nhận tính đóng '+name,pof(id).name+' · '+id,body,profileBack(id)+btn('Xác nhận '+name,'profile-ins-save','check','primary',id+'|'+code));
  let changed=false;
  el('insOn').addEventListener('change',()=>{changed=true;});
  el('insMonth').addEventListener('change',e=>{if(e.target.value&&!changed)el('insOn').checked=insuranceAt(id,code,e.target.value).on;});
}
function saveInsurance(id,code){
  if(!el('insForm').reportValidity())return;
  const month=el('insMonth').value,on=el('insOn').checked,insurance={...profileFor(id).insurance};
  insurance[code]=[...(insurance[code]||[]).filter(e=>e.from!==month),{from:month,on,confirmedAt:new Date().toISOString()}].sort((a,b)=>a.from.localeCompare(b.from));
  const saved=writeProfile(id,{insurance});render();profilePanel(id);
  if(saved)toast('Đã cập nhật '+insLabels[code]+' từ tháng '+monthText(month)+'.');
}
function depRow(d={}){
  return '<div class="dep-row"><label class="field">Tên hoặc mã hồ sơ<input data-field="label" type="text" value="'+esc(d.label||'')+'" required></label>'+
    '<label class="field">Từ tháng<input data-field="from" type="month" value="'+esc(d.from||period)+'" required></label>'+
    '<label class="field">Đến hết tháng<input data-field="to" type="month" value="'+esc(d.to||'')+'"></label>'+
    (d.label?'':btn('Bỏ dòng','dep-drop','x'))+'</div>';
}
function depPanel(id){
  const p=profileFor(id);
  const body='<form id="depForm">'+field('Đã đối chiếu hồ sơ từ tháng','<input type="month" id="reviewFrom" required value="'+esc(p.reviewFrom||period)+'">')+
    '<p class="item-caption">Nhập từng người theo hồ sơ đăng ký mà kế toán đã đối chiếu. Điền tháng kết thúc khi dừng giảm trừ. Danh sách trống ghi nhận 0 người từ tháng đã đối chiếu.</p>'+
    '<div id="depRows">'+(p.dependents||[]).map(depRow).join('')+'</div></form>'+btn('Thêm người phụ thuộc','dep-add','plus')+'<div id="depError" role="alert"></div>';
  sheet('Cập nhật người phụ thuộc',pof(id).name+' · '+id,body,profileBack(id)+btn('Lưu hồ sơ','profile-dep-save','check','primary',id),true);
}
function saveDeps(id){
  if(!el('depForm').reportValidity())return;
  const reviewFrom=el('reviewFrom').value;
  const rows=[...el('depRows').children].map(group=>Object.fromEntries([...group.querySelectorAll('input')].map(n=>[n.dataset.field,n.value.trim()])));
  if(rows.some(d=>!d.label||d.to&&d.to<d.from))return formError('depError','Kiểm tra lại tên hồ sơ và khoảng tháng giảm trừ.');
  const overlap=rows.some((d,i)=>rows.slice(0,i).some(r=>feeNameKey(d.label)===feeNameKey(r.label)&&(!r.to||r.to>=d.from)&&(!d.to||d.to>=r.from)));
  if(overlap)return formError('depError','Cùng một hồ sơ có hai khoảng giảm trừ trùng nhau.');
  const saved=writeProfile(id,{reviewFrom,dependents:rows});render();profilePanel(id);
  if(saved)toast('Đã lưu hồ sơ và cập nhật số người phụ thuộc cho kỳ lương.');
}
let baseProfileOrigin='';
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  const [id,code]=(t.dataset.val||'').split('|');
  switch(t.dataset.act){
    case 'profile':profilePanel(id);break;
    case 'profile-ins':insurancePanel(id,code);break;
    case 'profile-ins-save':saveInsurance(id,code);break;
    case 'profile-base':baseProfileOrigin=id;editBase(id);break;
    case 'profile-deps':depPanel(id);break;
    case 'profile-dep-save':saveDeps(id);break;
    case 'dep-add':el('depRows').insertAdjacentHTML('beforeend',depRow());el('depRows').lastElementChild.querySelector('input').focus();break;
    case 'dep-drop':t.closest('.dep-row').remove();break;
    case 'editbase':case 'close':baseProfileOrigin='';break;
  }
});
window.addEventListener('storage',e=>{
  if(e.key===null)profilesByDriver.clear();
  else if(e.key.startsWith(profileKey('')))profilesByDriver.delete(e.key.slice(profileKey('').length));
  else return;
  if(!opened&&(page==='pay'||page==='profiles'))render();
});
