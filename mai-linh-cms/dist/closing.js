'use strict';

const closeKey='ml-ket-ca-v1|';
const closingRecords=new Map();
try{
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key?.startsWith(closeKey))closingRecords.set(key.slice(closeKey.length),JSON.parse(localStorage.getItem(key)));
  }
}catch{}
const cashChannels=[
  ['cash','Tiền mặt'],['bank','Thẻ ngân hàng'],['mcc','Thẻ MCC'],
  ['voucher','Thẻ Voucher'],['other','Nguồn thu khác'],['mccHold','Giữ MCC dư'],
  ['vnpay','VNPay'],['vnp','App VNP'],['mpass','Mpass'],['momo','App Momo'],
  ['sacom','Token Sacom'],['travel','TraveLoka'],['mccOffline','MCC Offline']
];
function assembleShifts(seed){
  const byId=new Map(seed.map(s=>[s.id,s]));
  for(const [id,r] of closingRecords){
    const car=fleet.find(v=>v.id===r.vehicleId);
    if(!car||!people.some(p=>p.id===r.driver))continue;
    byId.set(id,{...byId.get(id),id,unit:car.unit,driver:r.driver,vehicleId:car.id,modelKey:car.model,
      model:modelName(car.model),plate:car.plate,date:r.date,hours:r.hours,rev:r.rev,
      seq:byId.get(id)?.seq??Number.MAX_SAFE_INTEGER});
  }
  return [...byId.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.seq-b.seq||a.id.localeCompare(b.id));
}
const feeFactors={12:1,24:1,48:2};
function feeForShift(s){
  const factor=feeFactors[s.hours],rules=effectiveItem('dailyFees',s.date,s.unit);
  if(!factor||!rules)return {factor,parts:[],total:null};
  const parts=rules.data.map(r=>({...r,amount:r.cash*factor+Math.round(s.rev*r.rate/100)}));
  return {factor,parts,total:parts.reduce((n,r)=>n+r.amount,0)};
}
function dayOffset(date,days){
  const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function legacyUnmatched(driver,book){
  const list=shifts.filter(s=>s.driver===driver&&s.date>=cutoff);
  return Object.entries(book.days).filter(([d,x])=>x.on.some(code=>!['holiday','tenure','newPay','overtime'].includes(code))&&
    !list.some(s=>s.date<=d&&d<dayOffset(s.date,Math.ceil(s.hours/24)))).map(([d])=>d);
}
function periodShiftFees(id,book){
  if(legacyUnmatched(id,book).length)return null;
  const items=pshifts(id).map(s=>feeForShift(s).total);
  return items.every(v=>v!==null)?items.reduce((sum,v)=>sum+v,0):null;
}
function dailyClosingData(id,date){
  const records=[...closingRecords.values()].filter(r=>r.driver===id&&r.date<=date&&date<dayOffset(r.date,Math.ceil(r.hours/24)));
  return {on:['holiday','overtime'].filter(code=>records.some(r=>r[code])),
    rev:records.length&&records.every(r=>r.hours<=24)?records.reduce((n,r)=>n+r.rev,0):null};
}
function feeTable(f){
  if(f.total===null)return '<div class="note warn">Chưa có mức phí cho ngày hoặc loại ca đã chọn.</div>';
  return table(['Phí thu hộ','Mức chuẩn 24h (₫)','Hệ số','% doanh thu ca','Tiền thu (₫)'],
    f.parts.map(r=>'<tr><td>'+esc(r.name)+'</td>'+amountCell(r.cash)+'<td class="center">×'+f.factor+'</td><td class="num">'+pct(r.rate)+'</td>'+amountCell(r.amount)+'</tr>').join(''))+
    '<div class="detailsum">Tổng phí thu hộ của ca <b>'+dong(f.total)+'</b></div>';
}
let closingStatus='all';
function closingScreen(){
  const rows=shifts.filter(s=>s.unit===mainUnit&&s.date.startsWith(period)&&match(pof(s.driver))&&
    (closingStatus==='all'||closingRecords.has(s.id)===(closingStatus==='entered')));
  const filters='<div class="filterbox">'+searchLine()+'<div class="toolbar">'+unit()+periodFields()+
    labelled('Phiếu kết ca',pick('closingStatus','Lọc phiếu kết ca',[['all','Tất cả'],['pending','Chưa nhập chi tiết'],['entered','Đã nhập chi tiết']],closingStatus))+
    '<div class="push">'+btn('Nhập ca mới','close-new','plus','primary')+'</div></div></div>';
  const body=sliceRows(rows).map(s=>{
    const p=pof(s.driver),v=fleet.find(v=>v.id===s.vehicleId),done=closingRecords.has(s.id);
    return '<tr><td>'+datefmt(s.date)+'</td><td>'+p.id+' · '+esc(p.name)+'</td><td>'+esc(v.code)+' · '+esc(s.plate)+'</td><td class="center">'+s.hours+'h</td>'+
      '<td class="num">'+dong(s.rev)+'</td><td class="num">'+showAmount(feeForShift(s).total)+'</td><td>'+chip(done?'Đã nhập chi tiết':'Chưa nhập chi tiết',done?'mint':'amber')+'</td>'+
      '<td>'+namedBtn(done?'Xem / sửa phiếu':'Nhập kết ca','close-form',s.id,'square-pen')+'</td></tr>';
  }).join('');
  return titlebar()+filters+'<div class="viewport">'+table(['Ngày ca','Mã số lái xe','Số tài / biển số','Chạy ca','DT thực tế','Phí thu hộ','Phiếu kết ca','Thao tác'],body||empty(8,'Chưa có ca phù hợp.'))+'</div>'+footer(rows.length,'ca');
}
const numField=(key,label,value=0,step=1)=>field(label,boundedInput('cc-'+key,value,step,999999999999));
const textField=(key,label,value='')=>field(label,'<input id="cc-'+key+'" value="'+esc(value)+'">');
const closeGroup=(name,body)=>'<fieldset class="item-group close-group"><legend>'+name+'</legend>'+body+'</fieldset>';
let editingClose=null;
function closingForm(id){
  const s=shifts.find(v=>v.id===id),draft=closingRecords.get(id)||{};
  const existing=!!s,driver=s?.driver||people[0].id,car=s?.vehicleId||pof(driver).vehicleId;
  const date=s?.date||period+'-01',hours=s?.hours||24,rev=s?.rev??'';
  editingClose={id:id||'ca-'+crypto.randomUUID(),existing,driver,car,date};
  const vehicleField=existing?info('Số tài / biển số',esc(fleet.find(v=>v.id===car).code+' · '+s.plate)):
    field('Số tài / biển số',pick('cc-car','Số tài / biển số',fleet.filter(v=>v.unit===mainUnit).map(v=>[v.id,v.code+' · '+v.plate]),car));
  const driverField=existing?info('Mã số lái xe',esc(driver+' · '+pof(driver).name)):field('Mã số lái xe',pick('cc-driver','Mã số lái xe',people.map(p=>[p.id,p.id+' · '+p.name]),driver));
  const dateField=existing?info('Ngày ca kinh doanh',datefmt(date)):field('Ngày ca kinh doanh','<input id="cc-date" type="date" required min="'+cutoff+'" value="'+date+'">');
  const base='<div class="close-grid">'+vehicleField+driverField+field('Hình thức',pick('cc-mode','Hình thức',[['','Chưa ghi nhận'],['company','Xe công ty'],['partner','Xe hợp tác kinh doanh']],draft.mode||''))+
    dateField+field('Thời gian kết thúc','<input id="cc-end" type="datetime-local" required value="'+esc(draft.end||'')+'" min="'+date+'T00:00">')+
    field('Chạy ca',pick('cc-hours','Chạy ca',[12,24,48].map(h=>[h,'Ca '+h+'h']),hours))+
    numField('trips','Số cuốc',draft.trips)+numField('paidKm','Số km có khách',draft.paidKm,0.01)+numField('km','Số km vận hành',draft.km,0.01)+
    numField('rev','DT thực tế (₫)',rev)+numField('meter','Số lưu đồng hồ',draft.meter,0.01)+numField('night','DT đêm thực tế (₫)',draft.night)+
    numField('device','Phí thuê thiết bị (₫)',draft.device)+numField('debt','Nợ doanh thu (₫)',draft.debt)+'</div><div class="close-checks">'+
    checks('cc-penalty','Phạt vi phạm',draft.penalty)+checks('cc-holiday','Thưởng lễ (Tết)',draft.holiday)+checks('cc-overtime','Tăng ca',draft.overtime)+'</div>';
  const channels='<div class="close-grid">'+cashChannels.map(([k,label])=>numField(k,label,draft.channels?.[k])).join('')+'</div><div class="item-caption" id="cc-channel-sum"></div>';
  const fuel='<div class="close-grid">'+textField('station','Tên cây xăng',draft.station)+numField('fuel','Số tiền (₫)',draft.fuel)+numField('litres','Số lượng (lít)',draft.litres,0.01)+'</div>';
  const body='<form id="closingForm">'+base+closeGroup('Doanh thu chi tiết (₫)',channels)+closeGroup('Tiền xăng',fuel)+
    closeGroup('Phí thu hộ','<div id="cc-fees" aria-live="polite"></div>')+
    field('Ghi chú','<textarea id="cc-note" rows="2">'+esc(draft.note||'')+'</textarea>')+'<p id="cc-error" role="alert"></p></form>';
  sheet('Thông tin kết thúc ca kinh doanh',existing?pof(driver).name+' · '+datefmt(date):'Nhập ca mới · Mai Linh Bắc Ninh',body,
    btn('Hủy','close')+btn('Lưu kết ca','close-save','check','primary'),true);
  updateClosing();
}
function closingInputs(){
  return {unit:mainUnit,driver:el('cc-driver')?.value||editingClose.driver,vehicleId:el('cc-car')?.value||editingClose.car,
    date:el('cc-date')?.value??editingClose.date,hours:+el('cc-hours').value,rev:+el('cc-rev').value};
}
function updateClosing(){
  const values=closingInputs();
  if(values.date)el('cc-end').min=values.date+'T00:00';
  el('cc-fees').innerHTML=feeTable(feeForShift(values));
  const sum=cashChannels.reduce((n,[k])=>n+Number(el('cc-'+k).value),0);
  el('cc-channel-sum').textContent='Tổng đã nhập theo kênh: '+dong(sum)+' · Chênh lệch với DT thực tế: '+dong(values.rev-sum);
}
function saveClosing(){
  if(!el('closingForm').reportValidity())return;
  const draft=closingInputs(),value=k=>el('cc-'+k).value;
  if(+value('paidKm')>+value('km'))return formError('cc-error','Số km có khách không được vượt số km vận hành.');
  if(feeForShift(draft).total===null)return formError('cc-error','Cần có cấu hình phí hiệu lực cho ca này.');
  draft.end=value('end');
  if([...closingRecords.entries()].some(([id,r])=>id!==editingClose.id&&r.end===draft.end&&(r.driver===draft.driver||r.vehicleId===draft.vehicleId)))
    return formError('cc-error','Đã có phiếu cùng thời gian kết thúc cho tài xế hoặc xe này.');
  draft.mode=value('mode');draft.station=value('station').trim();draft.note=value('note').trim();
  for(const k of ['trips','paidKm','km','meter','night','device','debt','fuel','litres'])draft[k]=+value(k);
  for(const k of ['penalty','holiday','overtime'])draft[k]=el('cc-'+k).checked;
  draft.channels=Object.fromEntries(cashChannels.map(([k])=>[k,+value(k)]));
  const id=editingClose.id,prior=closingRecords.get(id);
  let persisted=true;
  try{localStorage.setItem(closeKey+id,JSON.stringify(draft));}catch{persisted=false;}
  closingRecords.set(id,draft);
  shifts.splice(0,shifts.length,...assembleShifts(seedShifts));
  // Changes to allowance inputs require daily reconciliation again.
  if(!prior||['rev','hours','holiday','overtime'].some(k=>prior[k]!==draft[k])){
    const book=extraState.periods[[mainUnit,draft.date.slice(0,7),draft.driver].join('|')];
    if(book?.dailyDone){book.dailyDone=false;saveExtra();}
  }
  period=draft.date.slice(0,7);close();render();
  toast(persisted?'Đã lưu kết ca và cập nhật thống kê công lương.':'Đã cập nhật trong phiên. Trình duyệt chưa lưu được phiếu.');
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  switch(t.dataset.act){
    case 'close-new':closingForm('');break;
    case 'close-form':closingForm(t.dataset.val);break;
    case 'close-save':saveClosing();break;
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='closingStatus'){closingStatus=e.target.value;pageNo=1;render();}
  if(e.target.id==='cc-driver'&&el('cc-car'))el('cc-car').value=pof(e.target.value).vehicleId;
});
document.addEventListener('input',e=>{
  if(e.target.closest('#closingForm')&&(['cc-hours','cc-rev','cc-date'].includes(e.target.id)||cashChannels.some(([k])=>e.target.id==='cc-'+k)))updateClosing();
});
window.addEventListener('storage',e=>{
  if(!e.key?.startsWith(closeKey))return;
  const id=e.key.slice(closeKey.length);
  if(e.newValue)closingRecords.set(id,JSON.parse(e.newValue));else closingRecords.delete(id);
  shifts.splice(0,shifts.length,...assembleShifts(seedShifts));
  if(!opened)render();
});
