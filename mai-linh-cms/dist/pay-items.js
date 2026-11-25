'use strict';

const itemSections = {
  allowances: { title: '2. Các khoản phụ cấp theo ngày', icon: 'coins', doc: 'DEMO/0393', issued: '2020-07-01', from: '2020-08-01' },
  dailyFees: { title: '3. Khoản phí thu theo ngày', icon: 'receipt-text', doc: 'DEMO/0394', issued: '2020-07-01', from: '2020-07-01' },
  monthlyFees: { title: '4. Khoản phí thu theo tháng', icon: 'calendar-range', doc: 'DEMO/0557', issued: '2025-06-01', from: '2025-06-01' },
  tax: { title: '5. Thuế TNCN và các khoản giảm trừ', icon: 'calculator' }
};
const allowancePayer = 'Nhà đầu tư (nếu xe HTKD)';
const moneyRule = (code, name, cash, rate = 0) => ({code, name, cash, rate});
const referenceItems = {
  allowances: [
    moneyRule('holiday','Thưởng lễ tết',0,5),
    {...moneyRule('tenure','Đãi ngộ thâm niên',0), bands:[
      {lo:24,hi:36,shifts:0,cash:0,rate:1},{lo:36,hi:10000,shifts:0,cash:0,rate:2}
    ]},
    {...moneyRule('newPay','Hỗ trợ lái xe mới',0),days:90,bands:[{lo:0,hi:0,cash:0,rate:0}]},
    moneyRule('overtime','Phụ cấp tăng ca',0,5)
  ],
  dailyFees: [
    moneyRule('accident','Hỗ trợ tai nạn',4000), moneyRule('marketing','Kinh doanh tiếp thị',5000),
    moneyRule('wash','Rửa xe, hút bụi',15000)
  ],
  monthlyFees: [
    moneyRule('social','Bảo hiểm xã hội',425700),moneyRule('health','Bảo hiểm y tế',70950),
    moneyRule('union','Kinh phí công đoàn',47300)
  ],
  tax: {self:15500000,dependent:6200000,bands:[5000000,10000000,18000000,32000000,52000000,80000000,1000000000].map((hi,i)=>({hi,rate:5*(i+1)}))}
};
const extraKey = 'ml-cms-bo-sung-2-5-v1';
let extraState;
try { extraState = JSON.parse(localStorage.getItem(extraKey) || '{}') || {}; } catch { extraState = {}; }
extraState.versions ||= {};
extraState.periods ||= {};
let itemDate = '2026-11-25';
let editBands = [];
const bandsLabel = {tenure:'tháng',newPay:'km'};
const taxRef = 'Biểu trong ảnh tài liệu chưa ghi kỳ hiệu lực. Kế toán cần xác nhận biểu dùng cho kỳ lương.';
const emptyItem = kind => kind==='tax' ? {self:0,dependent:0,bands:[{hi:null,rate:0}]} :
  referenceItems[kind].map(r=>({...structuredClone(r),cash:0,rate:0,...(r.bands?{bands:r.bands.map(b=>({...b,cash:0,rate:0}))}:{})}));
function saveExtra() {
  try { localStorage.setItem(extraKey,JSON.stringify(extraState)); return true; }
  catch { toast('Đã cập nhật trong phiên. Trình duyệt chưa lưu được dữ liệu.'); return false; }
}
function documentVersions(kind, org) {
  const overrides = extraState.versions[org+'|'+kind] || [];
  const ref = itemSections[kind];
  const dates = new Map();
  if (org===mainUnit && ref.from) dates.set(ref.from,{from:ref.from,data:referenceItems[kind],source:true});
  overrides.forEach(v=>dates.set(v.from,v));
  return [...dates.values()].sort((a,b)=>b.from.localeCompare(a.from));
}
// Existing documents contain whole fee lists. Replay only changed fields so a scheduled
// rate change on one fee keeps independent fees added for an earlier date.
const feeFields=['name','cash','rate'];
const isFeeList=kind=>kind==='dailyFees'||kind==='monthlyFees';
const feeStorageKey=(kind,org)=>(kind==='monthlyFees'?'ml-cms-monthly-fees-v1|':'ml-cms-daily-fees-v1|')+org;
const feeSession=new Map();
function storedFeeChanges(kind,org) {
  const storage=feeStorageKey(kind,org);
  if(!feeSession.has(storage)) {
    let value={};
    try { value=JSON.parse(localStorage.getItem(storage)||'{}')||{}; } catch {}
    feeSession.set(storage,value);
  }
  return feeSession.get(storage);
}
function feeHistory(kind,org,changes=storedFeeChanges(kind,org)) {
  const docs=new Map(documentVersions(kind,org).map(v=>[v.from,v]));
  const dates=[...new Set([...docs.keys(),...Object.keys(changes)])].sort();
  const rows=new Map(),history=[];
  let previous=new Map(),customized=false;
  for(const from of dates) {
    const doc=docs.get(from);
    if(doc) {
      const current=new Map(doc.data.map(row=>[row.code,row]));
      for(const code of previous.keys())if(!current.has(code))rows.delete(code);
      for(const [code,row] of current) {
        const last=previous.get(code),merged={...rows.get(code),code};
        for(const field of feeFields)if(!last||last[field]!==row[field])merged[field]=row[field];
        rows.set(code,merged);
      }
      previous=current;
    }
    for(const change of changes[from]||[]) {
      rows.set(change.code,{...rows.get(change.code),...change});
      customized=true;
    }
    history.push({from,data:[...rows.values()],source:!!doc?.source&&!customized});
  }
  return history.reverse();
}
function versions(kind,org) {
  return isFeeList(kind)?feeHistory(kind,org):documentVersions(kind,org);
}
function effectiveItem(kind,date,org=mainUnit) { return versions(kind,org).find(v=>v.from<=date); }
function itemView(kind) {
  const v=effectiveItem(kind,itemDate,scope);
  if(v)return v;
  if(kind==='tax' && scope===mainUnit)return {from:'',data:referenceItems.tax,source:true};
  return null;
}
const amountCell = n => '<td class="num">'+fmt(n)+'</td>';
const pct = n => fmt(n)+'%';
const rateValue = (row,rev) => row.cash+Math.round(row.rate*rev/100);
const boundedInput = (id,v,step=1,max=9999999999,required=true) =>
  '<input id="'+id+'" type="number" min="0" max="'+max+'" step="'+step+'" '+(required?'required':'')+' value="'+esc(v??'')+'">';
const checks = (code,label,on) => '<label class="checkline"><input type="checkbox" id="'+code+'" '+(on?'checked':'')+'>'+esc(label)+'</label>';
const btnEdit = row => rowbtn('Sửa '+row.name,'item-edit',row.code,'square-pen');
function renderTaxBands(bands) {
  return table(['Bậc','Kỳ tính',['Thu nhập từ (₫)','num'],['Thu nhập đến (₫)','num'],['Thuế suất','num']],
    bands.map((b,i)=>'<tr><td class="center">'+(i+1)+'</td><td>Tháng</td>'+amountCell(i?bands[i-1].hi+1:0)+
    '<td class="num">'+(b.hi===null?'Trở lên':fmt(b.hi))+'</td><td class="num">'+pct(b.rate)+'</td></tr>').join(''));
}
function bandDetail(row) {
  const tenure=row.code==='tenure';
  return table(tenure?['Từ tháng','Đến tháng','Số ca đạt được','Tiền hỗ trợ (₫)','Tỷ lệ hỗ trợ (% DT)']:
    ['Từ km','Đến km','Tiền hỗ trợ (₫)','Tỷ lệ hỗ trợ (% DT)'],
    row.bands.map(b=>'<tr>'+amountCell(b.lo)+amountCell(b.hi)+(tenure?amountCell(b.shifts):'')+amountCell(b.cash)+
    '<td class="num">'+pct(b.rate)+'</td></tr>').join(''));
}
function itemScreen(kind) {
  const meta=itemSections[kind], fees=isFeeList(kind), version=itemView(kind), stored=versions(kind,scope);
  const filters='<div class="filterbox"><div class="toolbar">'+chooseOrg()+
    labelled('Ngày tra cứu','<input type="date" id="itemDate" value="'+itemDate+'">')+'</div></div>';
  const header=titlebar()+filters;
  if(!version&&!fees) return header+'<div class="viewport"><div class="policyfoot">Chưa có cấu hình tại ngày đã chọn. '+btn('Tạo cấu hình','item-edit','plus','','all')+'</div></div>';
  const data=version?.data||[];
  const actions = kind==='tax'?btn('Tính thử thuế tháng','tax-sim','calculator')+btn('Thiết lập theo kỳ hiệu lực','item-edit','square-pen','','tax'):
    (fees?btn('Thêm loại phí','fee-add','plus','primary'):'')+
    (data.length?btn('Chỉnh sửa cấu hình','item-edit','square-pen','','all'):'');
  let html='<div class="item-heading"><div><strong>'+(kind==='tax'?'Cấu hình thuế theo tháng':meta.title.slice(3))+'</strong><small>'+
    (version?.source?(kind==='tax'?'Ảnh tham chiếu trong thẻ Công lương':'Văn bản 206 · '+meta.doc+' · Ban hành '+datefmt(meta.issued)):version?'Cấu hình đã lưu trong bản mẫu':'Chưa có cấu hình tại ngày đã chọn')+
    (version?.from?' · Áp dụng từ '+datefmt(version.from):'')+'</small></div><div class="item-actions">'+actions+'</div></div>';
  if(kind==='tax') {
    if(version.source)html+='<p class="note warn">'+taxRef+'</p>';
    html+='<div class="detailgrid taxcards">'+info('Giảm trừ bản thân / tháng',dong(data.self))+info('Giảm trừ mỗi người phụ thuộc / tháng',dong(data.dependent))+
      '</div><h2 class="subheading">Biểu thuế lũy tiến từng phần theo tháng</h2>'+renderTaxBands(data.bands);
  } else {
    const allow=kind==='allowances',cycle=kind==='monthlyFees'?'Tháng':'Ngày';
    html+=table(allow?['Khoản phụ cấp','Tiền hỗ trợ (₫)','Tỷ lệ (% DT)','Tính theo DT','Tính vào lương','Người trả','Người nhận','Sửa']:
      ['Tên phí','Số tiền (₫)','Tỷ lệ (% DT)','Tính theo DT','Tính vào lương','Chịu phí','Sửa'],
      data.map(r=>'<tr><td><b>'+esc(r.name)+'</b></td>'+amountCell(r.cash)+'<td class="num">'+(r.bands?'Theo bảng dưới':pct(r.rate))+
      '</td><td>'+cycle+'</td><td>'+cycle+'</td>'+(allow?'<td>'+allowancePayer+'</td>':'')+
      '<td>Lái xe</td><td class="center">'+btnEdit(r)+'</td></tr>').join('')||empty(7,'Chưa có loại phí. Chọn “Thêm loại phí” để thiết lập khoản đầu tiên.'));
    if(kind==='dailyFees')html+='<p class="item-caption">Số tiền cấu hình là mức chuẩn của ca 24h. Ca 12h và 24h thu ×1, ca 48h thu ×2. Phí được ghi theo từng ca trong mục 6.</p>';
    if(kind==='monthlyFees')html+='<p class="item-caption">BHXH và BHYT lấy theo tháng đã xác nhận tính đóng trong hồ sơ của từng tài xế.</p>';
    if(version?.source && (allow||kind==='monthlyFees'))html+='<p class="item-caption">Định mức trong văn bản áp dụng cho chi nhánh Bắc Ninh: 100% doanh thu.</p>';
    if(allow)for(const row of data.filter(r=>r.bands)) {
      html+='<h2 class="subheading">'+esc(row.name)+'</h2>';
      if(row.code==='newPay')html+='<p class="item-caption">Số ngày hỗ trợ: <b>'+fmt(row.days)+'</b>. Thứ tự ca để áp dụng tỷ lệ ăn chia được quản lý tại mục 1.</p>';
      html+=bandDetail(row);
      if(row.code==='tenure'&&row.bands.some((b,i)=>i&&b.lo===row.bands[i-1].hi))html+='<p class="item-caption">Ở mốc trùng giữa hai khoảng, khoản thâm niên chờ đối soát nếu hai mức hưởng khác nhau.</p>';
    }
  }
  if(stored.length>1)html+='<details class="item-history"><summary>Các mốc hiệu lực ('+stored.length+')</summary>'+
    stored.map(v=>btn(datefmt(v.from),'item-version','calendar-days','',v.from)).join(' ')+'</details>';
  return header+'<div class="viewport"><div class="item-content">'+html+'</div></div><div class="panelFoot">'+
    (kind==='tax'?'Thuế thu nhập cá nhân · Kỳ tháng':kind==='allowances'?'4 khoản phụ cấp · Kỳ ngày':fmt(data.length)+' loại phí · Kỳ '+(kind==='monthlyFees'?'tháng':'ngày'))+'</div>';
}
function rateInputs(prefix,row) {
  return field('Số tiền (₫)',boundedInput(prefix+'-cash',row.cash))+field('Tỷ lệ (% doanh thu)',boundedInput(prefix+'-rate',row.rate,0.01,100));
}
let feeEditor=null;
const feeNameKey=name=>name.normalize('NFC').replace(/\s+/g,' ').trim().toLocaleLowerCase('vi');
function openFeeEditor(key=null) {
  const adding=key===null,kind=page,monthly=kind==='monthlyFees';
  const rows=adding?[moneyRule('fee-'+crypto.randomUUID(),'',0)]:
    (itemView(kind)?.data||[]).filter(r=>key==='all'||r.code===key);
  if(!rows.length)return;
  feeEditor={kind,org:scope,adding,rows};
  const title=adding?'Thêm loại phí':key==='all'?'Chỉnh sửa các loại phí':'Sửa loại phí';
  const controls=rows.map(r=>{
    const name=field('Tên phí','<input type="text" id="'+r.code+'-name" value="'+esc(r.name)+'" placeholder="Nhập tên loại phí" required>');
    const fields=name+'<div class="formgrid space">'+rateInputs(r.code,r)+'</div>';
    return rows.length===1?fields:'<fieldset class="item-group"><legend>'+esc(r.name)+'</legend>'+fields+'</fieldset>';
  }).join('');
  const body='<form id="feeForm">'+controls+
    '<div class="space">'+field(monthly?'Hiệu lực từ tháng':'Hiệu lực từ ngày','<input type="'+(monthly?'month':'date')+'" id="feeFrom" value="'+(monthly?itemDate.slice(0,7):itemDate)+'" required>')+'</div>'+
    '<p class="item-caption">'+(monthly?'Phí thu bằng số tiền cố định cộng với tỷ lệ trên doanh thu tháng.':'Số tiền cố định tính theo ca chuẩn 24h. Ca 12h và 24h thu ×1, ca 48h thu ×2. Phần tỷ lệ, nếu có, tính trên doanh thu thực tế của ca.')+'</p>'+
    '<p id="feeError" role="alert"></p></form>';
  const actions=btn('Hủy','close')+(adding?btn('Lưu và thêm tiếp','fee-save','plus','','again'):'')+
    btn(adding?'Lưu loại phí':'Lưu thay đổi','fee-save','check','primary');
  sheet(title,orgTitle(),body,actions,rows.length>1);
  el(rows[0].code+'-name').focus();
}
function saveFeeEditor(again) {
  if(!el('feeForm').reportValidity())return;
  const {kind,org,adding,rows}=feeEditor,from=el('feeFrom').value+(kind==='monthlyFees'?'-01':'');
  const atDate=effectiveItem(kind,from,org)?.data||[];
  const patches=[];
  for(const r of rows) {
    const nameInput=el(r.code+'-name');
    const name=nameInput.value.trim().replace(/\s+/g,' ');
    if(!name){nameInput.focus();return formError('feeError','Vui lòng nhập tên phí.');}
    const next=moneyRule(r.code,name,+el(r.code+'-cash').value,+el(r.code+'-rate').value);
    const patch={code:r.code};
    for(const k of feeFields)if(adding||next[k]!==r[k])patch[k]=next[k];
    if(Object.keys(patch).length===1)continue;
    if(!adding&&!atDate.some(v=>v.code===r.code))
      return formError('feeError','Loại phí “'+r.name+'” chưa tồn tại tại ngày hiệu lực đã chọn.');
    patches.push(patch);
  }
  if(!patches.length){close();return;}
  const changes=structuredClone(storedFeeChanges(kind,org));
  const updated=new Map((changes[from]||[]).map(v=>[v.code,v]));
  for(const patch of patches)updated.set(patch.code,{...updated.get(patch.code),...patch});
  changes[from]=[...updated.values()];
  for(const version of feeHistory(kind,org,changes).filter(v=>v.from>=from)) {
    const names=new Set();
    for(const row of version.data) {
      const name=feeNameKey(row.name);
      if(names.has(name))return formError('feeError','Tên phí “'+row.name+'” bị trùng trong đơn vị tại ngày '+datefmt(version.from)+'. Vui lòng dùng tên khác.');
      names.add(name);
    }
  }
  feeSession.set(feeStorageKey(kind,org),changes);
  let message=adding?'Đã thêm loại phí.':'Đã lưu thay đổi.';
  try {localStorage.setItem(feeStorageKey(kind,org),JSON.stringify(changes));}
  catch {message='Đã cập nhật trong phiên. Trình duyệt chưa lưu được dữ liệu.';}
  itemDate=from;
  close();render();
  if(again&&adding)openFeeEditor();
  toast(message);
}
window.addEventListener('storage',e=>{
  if(e.key===null){feeSession.clear();}
  else if(['dailyFees','monthlyFees'].some(k=>e.key.startsWith(feeStorageKey(k,'')))){feeSession.delete(e.key);}
  else return;
  if((isFeeList(page)||page==='pay')&&!opened)render();
});

let itemEdit = null;
function editItem(key) {
  if(isFeeList(page)){openFeeEditor(key);return;}
  const kind=page,v=itemView(kind);
  itemEdit={kind,key,org:scope,data:structuredClone(v?.data||emptyItem(kind))};
  const d=itemEdit.data, tax=kind==='tax', monthly=tax||kind==='monthlyFees';
  let body=field(monthly?'Áp dụng từ tháng':'Hiệu lực từ ngày','<input id="itemFrom" type="'+(monthly?'month':'date')+'" required value="'+(monthly?itemDate.slice(0,7):itemDate)+'">');
  if(tax) {
    body+='<div class="formgrid space">'+field('Giảm trừ bản thân (₫/tháng)',boundedInput('self',d.self))+
      field('Giảm trừ mỗi người phụ thuộc (₫/tháng)',boundedInput('dependent',d.dependent))+'</div><h3 class="subheading">Biểu lũy tiến theo tháng</h3>';
    editBands=structuredClone(d.bands);
    body+='<div id="taxBandsEditor"></div><div class="item-actions space">'+btn('Thêm bậc','tax-add','plus')+btn('Bỏ bậc cuối','tax-remove','x')+'</div>'+
      '<p class="note">Ngưỡng trên để trống ở bậc cuối nghĩa là không giới hạn. Bản lưu dùng để tính thử trong bản mẫu từ tháng đã chọn.</p>';
  } else for(const row of d.filter(r=>key==='all'||r.code===key)) {
    body+='<fieldset class="item-group"><legend>'+esc(row.name)+'</legend>';
    if(!row.bands)body+='<div class="formgrid">'+rateInputs(row.code,row)+'</div>';
    else{
      const tenure=row.code==='tenure',unit=bandsLabel[row.code];
      if(!tenure)body+=field('Số ngày hỗ trợ',boundedInput('days',row.days,1,10000));
      body+=table(['Từ '+unit,'Đến '+unit,...(tenure?['Số ca đạt được']:[]),'Tiền hỗ trợ (₫)','Tỷ lệ (%)'],row.bands.map((b,i)=>{
        const p=row.code+i;
        return '<tr>'+['lo','hi',...(tenure?['shifts']:[]),'cash','rate'].map(k=>'<td class="rulecell">'+boundedInput(p+k,b[k],k==='rate'?0.01:1,k==='rate'?100:9999999999)+'</td>').join('')+'</tr>';
      }).join(''));
    }
    body+='</fieldset>';
  }
  sheet(tax?'Thiết lập thuế và giảm trừ':'Chỉnh sửa cấu hình',itemSections[kind].title+' · '+orgTitle(),'<form id="itemForm">'+body+
    '<p id="itemError" role="alert"></p></form>',btn('Hủy','close')+btn('Lưu cấu hình','item-save','check','primary'),true);
  if(tax) drawTaxEditor();
}
function drawTaxEditor() {
  el('taxBandsEditor').innerHTML=table(['Bậc','Thu nhập đến (₫)','Thuế suất (%)'],editBands.map((b,i)=>'<tr><td class="center">'+(i+1)+'</td><td class="rulecell">'+
    boundedInput('hi'+i,b.hi,1,999999999999,i!==editBands.length-1)+'</td><td class="rulecell">'+boundedInput('rate'+i,b.rate,0.01,100)+'</td></tr>').join(''));
}
function readTaxBands() { return editBands.map((_,i)=>({hi:el('hi'+i).value===''?null:+el('hi'+i).value,rate:+el('rate'+i).value})); }
function formError(id,msg){const target=el(id);target.className='note warn';target.textContent=msg;target.scrollIntoView({block:'nearest'});}
function saveItem() {
  if(!el('itemForm').reportValidity())return;
  const {kind,key,org,data}=itemEdit;
  let from=el('itemFrom').value;
  if(kind==='tax'||kind==='monthlyFees')from+='-01';
  if(kind==='tax') {
    data.self=+el('self').value;data.dependent=+el('dependent').value;data.bands=readTaxBands();
    if(data.bands.some((b,i)=>b.hi!==null&&b.hi<=(i?data.bands[i-1].hi:0)||i&&b.rate<data.bands[i-1].rate))
      return formError('itemError','Ngưỡng thu nhập phải tăng dần và thuế suất bậc sau phải bằng hoặc cao hơn bậc trước.');
  } else {
    for(const row of data.filter(r=>key==='all'||r.code===key)) {
      if(!row.bands){row.cash=+el(row.code+'-cash').value;row.rate=+el(row.code+'-rate').value;continue;}
      if(row.code==='newPay')row.days=+el('days').value;
      row.bands=row.bands.map((b,i)=>Object.fromEntries(Object.keys(b).map(k=>[k,+el(row.code+i+k).value])));
      if(row.bands.some((b,i)=>b.hi<b.lo||(i&&b.lo<row.bands[i-1].hi)))
        return formError('itemError','Kiểm tra lại cận dưới, cận trên và khoảng chồng lấn của các mức hỗ trợ.');
    }
  }
  const id=org+'|'+kind;
  extraState.versions[id]=[...(extraState.versions[id]||[]).filter(v=>v.from!==from),{from,data:structuredClone(data)}];
  itemDate=from;close();render();if(saveExtra())toast('Đã lưu phiên bản cấu hình.');
}
function progressive(amount,dependents,profile) {
  const deduction=profile.self+dependents*profile.dependent,base=Math.max(0,amount-deduction);
  const last=profile.bands.at(-1);
  if(last.hi!==null && base>last.hi)return {base,deduction,amount:null,parts:[]};
  let lower=0;
  const parts=profile.bands.map((b,i)=>{
    const part=Math.max(0,Math.min(base,b.hi??Infinity)-lower);
    lower=b.hi??Infinity;
    return {i:i+1,part,rate:b.rate,tax:part*b.rate/100};
  }).filter(b=>b.part>0);
  return {base,deduction,parts,amount:Math.round(parts.reduce((sum,b)=>sum+b.tax,0))};
}
const taxIncomeLabel='Thu nhập sau các khoản được trừ khác, trước giảm trừ gia cảnh (₫)';
function taxSim() {
  const v=itemView('tax'); if(!v)return;
  sheet('Tính thử thuế tháng',v.source?'Biểu tham chiếu trong tài liệu':'Biểu áp dụng từ '+datefmt(v.from),'<form id="taxSimForm"><div class="formgrid">'+
    field(taxIncomeLabel,boundedInput('simIncome',30000000))+field('Số người phụ thuộc',boundedInput('simDependents',1,1,100))+
    '</div><div id="taxResult" aria-live="polite"></div></form>',btn('Đóng','close'),true);drawTaxSim();
}
function drawTaxSim() {
  const target=el('taxResult');if(!el('taxSimForm').checkValidity()){target.textContent='Nhập đủ thu nhập và số người phụ thuộc.';return;}
  const r=progressive(+el('simIncome').value,+el('simDependents').value,itemView('tax').data);
  target.innerHTML='<div class="detailgrid space">'+info('Tổng giảm trừ gia cảnh',dong(r.deduction))+info('Thu nhập tính thuế',dong(r.base))+'</div>'+
    (r.amount===null?'<p class="note warn">Thu nhập vượt ngưỡng cuối của biểu đang xem.</p>':
    table(['Bậc','Phần thu nhập trong bậc (₫)','Thuế suất','Tiền thuế (₫)'],r.parts.map(b=>'<tr><td>'+b.i+'</td>'+amountCell(b.part)+'<td class="num">'+pct(b.rate)+'</td>'+amountCell(Math.round(b.tax))+'</tr>').join('')||empty(4,'Thu nhập tính thuế bằng 0.'))+
    '<div class="detailsum">Thuế TNCN tính thử <b>'+dong(r.amount)+'</b></div>');
}

function ledgerFor(id) {
  return extraState.periods[[mainUnit,period,id].join('|')] || {days:{},dailyDone:false,monthly:null,tax:null};
}
function saveLedger(id,ledger) {extraState.periods[[mainUnit,period,id].join('|')]=ledger;return saveExtra();}
const lastMonthDay = () => period+'-'+new Date(Number(period.slice(0,4)),Number(period.slice(5)),0).getDate();
function computeDay(data,date,org=mainUnit) {
  const a=effectiveItem('allowances',date,org);
  let allowance=a?0:null,conflict=false;
  if(a)for(const r of a.data) {
    if(!data.on.includes(r.code)) continue;
    let band=r;
    if(r.bands){
      const matches=r.code==='tenure'?r.bands.filter(b=>data.months>=b.lo&&data.months<=b.hi&&data.shifts>=b.shifts):
        data.supportDay>=1&&data.supportDay<=r.days?r.bands.filter(b=>data.km>=b.lo&&data.km<=b.hi):[];
      if(new Set(matches.map(b=>rateValue(b,data.rev))).size>1)conflict=true;
      band=matches[0];
    }
    if(band)allowance+=rateValue(band,data.rev);
  }
  return {allowance:conflict?null:allowance,conflict};
}
function periodItems(id) {
  const book=ledgerFor(id);
  const daily=Object.entries(book.days).map(([d,x])=>computeDay(x,d));
  const sum=k=>book.dailyDone&&daily.every(d=>d[k]!==null)?daily.reduce((s,d)=>s+d[k],0):null;
  const tax=effectiveItem('tax',period+'-01'),deps=dependentsAt(id,period);
  const fees=monthlyAmounts(id,period,book);
  const withheld=book.tax&&tax&&deps.count!==null?progressive(book.tax.income,deps.count,tax.data).amount:null;
  return {allowance:sum('allowance'),dayFees:periodShiftFees(id,book),monthFees:fees.total,social:fees.social,health:fees.health,tax:withheld};
}
const itemKeys=['allowance','dayFees','monthFees','tax'];
const itemLabels=['2. Phụ cấp ngày','3. Phí thu theo ca','4. Phí thu tháng','5. Thuế TNCN'];
const showAmount=v=>v===null?'—':dong(v);
const fullItems = (a,values) => !a.pending && itemKeys.every(k=>values[k]!==null);
const subtotal = (a,v) => fullItems(a,v)?a.amount+v.allowance-v.dayFees-v.monthFees-v.tax:null;
function wholeMonth() {return modelFilter==='all';}
function itemPending(a) {return wholeMonth()?!fullItems(a,periodItems(a.p.id)):a.pending;}
function driverItems(id) {
  const v=periodItems(id);
  return '<div class="item-driver-heading"><h3 class="subheading">Khoản theo tài xế · '+periodText()+'</h3>'+
    '<div class="item-actions">'+namedBtn('Hồ sơ công lương','profile',id,'users-round')+namedBtn('Đối soát mục 2–5','ledger',id,'list-checks')+'</div></div>'+
    table(['Khoản','Số tiền','Trạng thái'],itemKeys.map((k,i)=>'<tr><td>'+itemLabels[i]+'</td><td class="num">'+showAmount(v[k])+'</td><td>'+
    (v[k]===null?chip('Chờ đối soát','amber'):chip('Đã đối soát','mint'))+'</td></tr>').join(''))+
    '<p class="item-caption">Trong phí tháng · BHXH '+showAmount(v.social)+' · BHYT '+showAmount(v.health)+'</p>'+
    (wholeMonth()?'':'<p class="item-caption">Mục 2–5 hiển thị cho toàn kỳ của tài xế, gồm tất cả các dòng xe.</p>');
}
const ledgerSub=id=>pof(id).name+' · '+id+' · '+periodText();
const backLedger=id=>btn('Đối soát mục 2–5','ledger','arrow-left','',id);
function ledgerPanel(id) {
  const book=ledgerFor(id),v=periodItems(id),dates=Object.keys(book.days).sort(),mismatch=legacyUnmatched(id,book);
  const dailyRows=dates.map(d=>{const x=book.days[d],y=computeDay(x,d);return '<tr><td>'+datefmt(d)+'</td>'+amountCell(x.rev)+
    '<td class="num">'+showAmount(y.allowance)+'</td><td class="center">'+
    rowbtn('Sửa ngày '+datefmt(d),'ledger-day',id+'|'+d,'square-pen')+'</td></tr>';}).join('');
  let body='<div class="item-driver-heading"><h3 class="subheading">2. Phụ cấp theo ngày</h3>'+
    namedBtn('Nhập ngày đối soát','ledger-day',id,'plus')+'</div>'+
    table(['Ngày áp dụng','Doanh thu ngày (₫)','Phụ cấp','Sửa'],dailyRows||empty(4,'Chưa nhập ngày phát sinh.'))+
    '<div class="item-actions space">'+(book.dailyDone?chip('Đã xác nhận đủ ngày của kỳ','mint'):chip('Chưa xác nhận đủ ngày','amber'))+
    namedBtn(book.dailyDone?'Mở lại đối soát ngày':dates.length?'Xác nhận đã nhập đủ ngày':'Xác nhận không phát sinh trong kỳ','ledger-days-done',id,'check')+'</div>'+
    '<h3 class="subheading">3. Phí thu hộ theo ca</h3>'+table(['Ngày ca','Chạy ca','Phí thu hộ','Phiếu kết ca'],pshifts(id).map(s=>'<tr><td>'+datefmt(s.date)+'</td><td>'+s.hours+'h</td><td class="num">'+showAmount(feeForShift(s).total)+'</td><td>'+namedBtn('Mở phiếu','close-form',s.id,'clipboard-list')+'</td></tr>').join('')||empty(4,'Không có ca trong kỳ.'))+
    (mismatch.length?'<p class="note warn">Phiếu ngày cũ có phí nhưng chưa khớp ca: '+mismatch.map(datefmt).join(', ')+'. Bổ sung ca tại mục 6 để đối soát.</p>':'')+
    '<h3 class="subheading">4–5. Khoản theo tháng</h3>'+table(['Khoản','Số tiền','Thao tác'],
    '<tr><td>Phí thu tháng</td><td class="num">'+showAmount(v.monthFees)+'</td><td>'+namedBtn('Đối soát phí tháng','ledger-month',id,'square-pen')+'</td></tr>'+
    '<tr><td>Thuế TNCN sau giảm trừ</td><td class="num">'+showAmount(v.tax)+'</td><td>'+namedBtn('Nhập căn cứ tính thuế','ledger-tax',id,'square-pen')+'</td></tr>');
  sheet('Đối soát phụ cấp, phí và thuế',ledgerSub(id),body,btn('Về chi tiết lương','driver','arrow-left','',id)+btn('Đóng','close'),true);
}
function dayPanel(id,date) {
  const existing=ledgerFor(id).days,initialDay=date||pshifts(id).find(s=>!existing[s.date])?.date||period+'-01';
  sheet('Đối soát một ngày kinh doanh',ledgerSub(id),'<form id="dayForm">'+
    field('Ngày áp dụng','<input required type="date" id="ledgerDate" min="'+period+'-01" max="'+lastMonthDay()+'" value="'+initialDay+'">')+
    '<div id="dayFields"></div></form>',backLedger(id)+btn('Lưu ngày','ledger-day-save','check','primary',id),true);
  loadDayFields(id);
}
function loadDayFields(id) {
  const date=el('ledgerDate').value;
  if(!el('ledgerDate').checkValidity()){el('dayFields').innerHTML='';return;}
  const existing=ledgerFor(id).days[date],suggested=dailyClosingData(id,date), d=existing||{rev:suggested.rev,on:suggested.on,months:0,shifts:0,km:0,supportDay:1};
  const a=effectiveItem('allowances',date);
  if(!a){el('dayFields').innerHTML='<div class="note warn">Thiếu cấu hình phụ cấp tại ngày này.</div>';return;}
  let body='<div class="space">'+field('Doanh thu tính phụ cấp trong ngày (₫)',boundedInput('dayRev',d.rev))+'</div>'+
    '<p class="item-caption">Dùng doanh thu của ngày để tính phụ cấp. Với ca 48h, nhập doanh thu tương ứng của từng ngày.</p><fieldset class="item-group"><legend>Khoản phụ cấp đủ điều kiện</legend>';
  body+=a.data.map(r=>checks('on-'+r.code,r.name,d.on.includes(r.code))).join('');
  body+='<div id="tenureFields" class="formgrid space">'+field('Thâm niên (tháng)',boundedInput('dayMonths',d.months,1,10000))+
    field('Số ca đạt được để xét thâm niên',boundedInput('dayShifts',d.shifts,1,100000))+
    '<small class="fieldnote">Khoản có hai mức hưởng khác nhau tại cùng mốc thâm niên sẽ chờ đối soát.</small></div>'+
    '<div id="newFields" class="formgrid space">'+field('Ngày hỗ trợ thứ',boundedInput('supportDay',d.supportDay,1,10000))+
    field('Số km trong ngày',boundedInput('dayKm',d.km,0.01))+'</div></fieldset>'+
    '<div id="dayResult"></div>';
  el('dayFields').innerHTML=body;updateDay();
}
function readDay() {
  return {rev:+el('dayRev').value,months:+el('dayMonths').value,shifts:+el('dayShifts').value,km:+el('dayKm').value,supportDay:+el('supportDay').value,
    on:[...el('dayFields').querySelectorAll('input[type="checkbox"]:checked')].map(n=>n.id.slice(3))};
}
function updateDay() {
  if(!el('dayRev'))return;
  for(const [box,code] of [['tenureFields','tenure'],['newFields','newPay']]) {
    const group=el(box); group.hidden=!el('on-'+code).checked;
    group.querySelectorAll('input').forEach(n=>n.disabled=group.hidden);
  }
  const day=readDay(),r=computeDay(day,el('ledgerDate').value);
  el('dayResult').innerHTML=el('dayForm').checkValidity()?'<div class="detailgrid">'+info('Tổng phụ cấp ngày',showAmount(r.allowance))+'</div>'+(r.conflict?'<p class="note warn">Có hai mức phụ cấp cùng khớp. Cần xác nhận lại khoảng áp dụng tại mục 2.</p>':''):'';
}
function monthPanel(id) {
  const b=ledgerFor(id).monthly, v=effectiveItem('monthlyFees',lastMonthDay());
  if(!v){toast('Chưa có cấu hình phí tháng tại kỳ này.');return;}
  const manual=v.data.filter(r=>!isInsurance(r.code)),percentage=v.data.some(r=>r.rate>0);
  const amounts=monthlyAmounts(id,period,ledgerFor(id));
  const rows=Object.keys(insLabels).map(k=>'<tr><td>'+insLabels[k]+'</td><td>'+insuranceBadge(insuranceAt(id,k,period))+'</td><td class="num">'+showAmount(amounts[k])+'</td><td>'+namedBtn('Xác nhận tính đóng '+insLabels[k],'profile-ins',id+'|'+k,'check')+'</td></tr>').join('');
  const rev=b?.rev??pshifts(id).reduce((sum,s)=>sum+s.rev,0);
  sheet('Đối soát các khoản phí tháng',ledgerSub(id),'<form id="monthForm">'+
    (percentage?field('Doanh thu tính phí trong tháng (₫)',boundedInput('monthRev',rev)):'')+
    '<h3 class="subheading">Bảo hiểm theo hồ sơ tài xế</h3>'+table(['Khoản','Trạng thái trong kỳ','Số tiền','Thao tác'],rows)+
    '<h3 class="subheading">Các khoản cố định của tháng</h3>'+table(['Khoản','Số tiền trong kỳ'],manual.map(r=>{
      const applies=b&&!b.automatic?b.on.includes(r.code):pshifts(id).length>0;
      return '<tr><td>'+esc(r.name)+'</td><td class="num">'+dong(applies?rateValue(r,rev):0)+'</td></tr>';
    }).join('')||empty(2,'Chưa có khoản phí khác.'))+
    (b&&!b.automatic?'<p class="item-caption">Hiển thị theo đối soát đã lưu của kỳ này.</p>':'')+
    '</form>',backLedger(id)+namedBtn('Hồ sơ công lương','profile',id)+(percentage?btn('Lưu doanh thu tính phí','ledger-month-save','check','primary',id):btn('Đóng','close')));
}
function taxPanel(id) {
  const b=ledgerFor(id).tax,v=effectiveItem('tax',period+'-01'),deps=dependentsAt(id,period);
  const controls='<div class="detailgrid">'+info('Người phụ thuộc trong tháng',deps.count===null?'Chờ xác nhận':fmt(deps.count)+' người')+info('Căn cứ',deps.source)+'</div>'+
    '<div class="space">'+namedBtn('Hồ sơ công lương','profile',id,'users-round')+'</div>';
  const taxEntry=v?'<form id="taxMonthForm" class="space">'+field(taxIncomeLabel,boundedInput('taxIncome',b?.income))+
    '<p class="item-caption">Biểu thuế và mức giảm trừ áp dụng từ '+datefmt(v.from)+'.</p><div id="taxDue" aria-live="polite"></div></form>':
    '<div class="note warn">Kỳ này chưa có biểu thuế đã xác nhận.</div>'+btn('Mở cấu hình thuế','ledger-open-tax','square-pen');
  sheet('Căn cứ tính thuế trong tháng',ledgerSub(id),controls+taxEntry,backLedger(id)+(v?btn('Lưu căn cứ tính thuế','ledger-tax-save','check','primary',id):''));
  if(v){el('taxMonthForm').dataset.driver=id;updateDue();}
}
function updateDue() {
  const form=el('taxMonthForm'),deps=dependentsAt(form.dataset.driver,period);
  if(deps.count===null){el('taxDue').textContent='Cần xác nhận hồ sơ người phụ thuộc để tính thuế.';return;}
  if(!form.checkValidity()){el('taxDue').textContent='';return;}
  const t=progressive(+el('taxIncome').value,deps.count,effectiveItem('tax',period+'-01').data);
  el('taxDue').innerHTML='<div class="detailgrid">'+info('Giảm trừ gia cảnh',dong(t.deduction))+info('Thu nhập tính thuế',dong(t.base))+'</div>'+
    (t.amount!==null?'<div class="detailsum">Thuế TNCN <b>'+dong(t.amount)+'</b></div>':'<div class="note warn">Thu nhập vượt ngưỡng của biểu. Cần đối soát biểu thuế.</div>');
}
function ledgerSaved(id,book) {saveLedger(id,book);render();ledgerPanel(id);}
let dayOwner='';
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
  const id=t.dataset.val;
  switch(t.dataset.act) {
    case 'fee-add':openFeeEditor();break;
    case 'fee-save':saveFeeEditor(id==='again');break;
    case 'item-edit':editItem(id);break;
    case 'item-save':saveItem();break;
    case 'item-version':itemDate=id;render();break;
    case 'tax-sim':taxSim();break;
    case 'tax-add':editBands=readTaxBands();editBands.push({hi:null,rate:editBands.at(-1).rate});drawTaxEditor();break;
    case 'tax-remove':if(editBands.length>1){editBands=readTaxBands().slice(0,-1);drawTaxEditor();}break;
    case 'ledger':ledgerPanel(id);break;
    case 'ledger-day':{const [owner,date]=id.split('|');dayOwner=owner;dayPanel(owner,date);break;}
    case 'ledger-day-save':{
      if(!el('dayForm').reportValidity()||!el('dayRev'))return;
      const book=ledgerFor(id),d=el('ledgerDate').value,previous=book.days[d]?.on||[];const entry=readDay();entry.on.push(...previous.filter(k=>!['holiday','overtime','tenure','newPay'].includes(k)));book.days[d]=entry;book.dailyDone=false;ledgerSaved(id,book);break;
    }
    case 'ledger-days-done':{const book=ledgerFor(id);book.dailyDone=!book.dailyDone;ledgerSaved(id,book);break;}
    case 'ledger-month':monthPanel(id);break;
    case 'ledger-month-save':{
      if(!el('monthForm').reportValidity())return;
      const book=ledgerFor(id);book.monthly={...(book.monthly||{automatic:true,on:[]}),rev:+el('monthRev').value};
      ledgerSaved(id,book);break;
    }
    case 'ledger-tax':taxPanel(id);break;
    case 'ledger-open-tax':scope=mainUnit;itemDate=period+'-01';close();location.hash='tax';break;
    case 'ledger-tax-save':{
      if(!el('taxMonthForm').reportValidity())return;
      const book=ledgerFor(id);book.tax={...book.tax,income:+el('taxIncome').value};ledgerSaved(id,book);break;
    }
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='itemDate'&&e.target.value){itemDate=e.target.value;render();}
  if(e.target.id==='ledgerDate')loadDayFields(dayOwner);
});
document.addEventListener('input',e=>{
  if(e.target.closest('#taxSimForm'))drawTaxSim();
  if(e.target.closest('#taxMonthForm'))updateDue();
  if(e.target.closest('#dayFields'))updateDay();
});
