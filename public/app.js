const sections = {
  devices: {
    title: 'Devices', singular: 'device', icon: '◈',
    fields: [['name','Device name'],['category','Category'],['model','Model'],['url','App or support URL','url'],['notes','Notes','textarea']]
  },
  vets: { title: 'Veterinary information', singular: 'vet', icon: '✚', fields: [['clinic','Clinic'],['vet','Veterinarian'],['phone','Phone','tel'],['address','Address'],['email','Email','email'],['notes','Notes','textarea']] },
  conditions: { title: 'Health conditions', singular: 'condition', icon: '♡', fields: [['name','Condition'],['date','Diagnosis date','date'],['status','Status',['Active','Managed','Resolved','Unknown']],['notes','Notes','textarea']] },
  medications: { title: 'Medications', singular: 'medication', icon: '✦', fields: [['name','Medication'],['dose','Dose as prescribed'],['schedule','Schedule'],['date','Start date','date'],['status','Status',['Current','Completed','Discontinued']],['notes','Notes','textarea']] },
  surgeries: { title: 'Surgeries', singular: 'surgery', icon: '✚', fields: [['name','Procedure'],['date','Procedure date','date'],['clinic','Clinic'],['notes','Notes','textarea']] },
  claims: { title: 'Insurance claims', singular: 'claim', icon: '◇', fields: [['name','Claim reason'],['provider','Insurer'],['number','Claim number'],['date','Filed on','date'],['amount','Claim amount ($)','money'],['paid','Reimbursement ($)','money'],['status','Status',['Submitted','Pending','Approved','Paid','Denied']],['notes','Notes','textarea']] },
  subscriptions: { title: 'Subscriptions', singular: 'subscription', icon: '▤', fields: [['provider','Provider'],['name','Plan or items'],['price','Cost per renewal ($)','money'],['frequency','Renewal frequency'],['date','Next renewal','date'],['status','Status',['Active','Paused','Canceled']],['notes','Notes','textarea']] }
};
const profileFields = [['name','Pet name'],['species','Species'],['breed','Breed'],['age','Age in years','age'],['owners','Owner(s)'],['adoption','Adopted from'],['adoptionDate','Adoption date','date'],['chipStatus','Microchip status',['Unknown','Not chipped','Chipped','Registered','Needs update']],['chip','Microchip number'],['registry','Microchip registry']];
const sample = {
  id:'sample', name:'Maple', species:'Dog', breed:'Golden Retriever', age:'4', owners:'Jamie Taylor', adoption:'Willow Creek Animal Rescue',
  adoptionDate:'2022-08-21', chipStatus:'Registered', registry:'Example Pet Registry', chip:'000000000000001',
  vets:[{clinic:'Greenwood Animal Hospital',vet:'Dr. Morgan Lee',phone:'(202) 555-0138'}],
  conditions:[{name:'Seasonal allergies',status:'Managed'}],
  medications:[{name:'Allergy medication',status:'Current',notes:'See prescription label for directions.'}],
  surgeries:[{name:'Spay',date:'2022-10-11',clinic:'Greenwood Animal Hospital'}],
  claims:[{name:'Annual wellness visit',provider:'Example Pet Insurance',number:'DEMO-1042',date:'2026-10-12',amount:'120',paid:'65',status:'Paid'}]
};
const seed = {
  pets:[sample], selected:'sample', subscriptions:[
    {provider:'Chewy',name:'Food & treats autoship',price:'48.99',frequency:'Every 4 weeks',date:'2026-11-24',status:'Active',sample:true},
    {provider:'PetSmart',name:'Grooming plan',price:'30',frequency:'Monthly',date:'2026-12-03',status:'Active',sample:true},
    {provider:'Petco',name:'Repeat Delivery',price:'25',frequency:'Monthly',date:'2026-12-10',status:'Paused',sample:true}
  ]
};
const starterDevices = [
  {
    name:'Litter-Robot', category:'Automatic litter box',
    url:'https://www.litter-robot.com/faq.html',
    notes:'See Whisker app information and setup help for your model.'
  },
  {
    name:'PetSafe FreshFeed', category:'Automatic feeder',
    url:'https://www.petsafe.com/p/freshfeed-refrigerated-pet-feeder/PFD00-18290',
    notes:'Open the FreshFeed product page for feeding and setup information.'
  },
  {
    name:'Petlibro Dockstream', category:'Water fountain',
    url:'https://petlibro.com/pages/faq-product/dockstream-smart-fountain',
    notes:'See Petlibro app help for compatible Dockstream models.'
  }
];
const storageKey = 'petfolio-records-v1';
let legacyData;
try { legacyData = JSON.parse(localStorage.getItem(storageKey)); } catch {}
let data = legacyData || structuredClone(seed);
data.devices ??= structuredClone(starterDevices);
let revision = null;
let writable = false;
let saving = false;
const pages = {overview:['Overview','⌂'],profile:['Pet profile','♡'],health:['Health records','✚'],claims:['Insurance claims','◇'],subscriptions:['Subscriptions','▤'],devices:['Devices','◈']};
const mobileLabels = {
  overview:'Home', profile:'Pet', health:'Health',
  claims:'Claims', subscriptions:'Subs', devices:'Devices'
};
let page = 'overview';
let editing;
const main = document.querySelector('#main');
const nav = document.querySelector('#nav');
const picker = document.querySelector('#pet-picker');
const dialog = document.querySelector('#editor');
const form = document.querySelector('#edit-form');
const formError = document.querySelector('#form-error');
const pet = () => data.pets.find(item => item.id === data.selected) || data.pets[0];
const household = key => key === 'subscriptions' || key === 'devices';
const list = key => (household(key) ? data[key] : pet()[key]) || [];
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = value => new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
const button = (label, action, key='', index='', style='button secondary') => `<button type="button" class="${style}" data-action="${action}" data-key="${key}" data-index="${index}">${label}</button>`;
const syncStatus = document.querySelector('#sync-status');

async function persist(next) {
  if (!writable) throw new Error('Account storage is unavailable. Reload Petfolio and try again.');
  const response = await fetch('/api/records',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({data:next,revision})
  });
  if (response.status === 409) {
    writable = false;
    syncStatus.textContent = 'Records changed on another device. Reload to get the latest version.';
  }
  if (!response.ok) {
    const detail = await response.json().catch(()=>({}));
    throw new Error(detail.error || 'Changes could not be saved. Try again.');
  }
  ({revision} = await response.json());
  data = next;
  syncStatus.textContent = 'Saved to your Petfolio account.';
}

async function loadRecords() {
  try {
    const response = await fetch('/api/records',{cache:'no-store'});
    if (!response.ok) throw new Error();
    const saved = await response.json();
    revision = saved.revision;
    writable = true;
    if (saved.data) {
      data = saved.data;
      syncStatus.textContent = 'Saved to your Petfolio account.';
    } else if (legacyData) {
      await persist(data);
    } else {
      syncStatus.textContent = 'Your changes save to your Petfolio account.';
    }
  } catch {
    writable = false;
    syncStatus.textContent = 'Account storage is unavailable. Reload Petfolio to try again.';
  }
  render();
}
function fieldDetails(fields, item) {
  const entries = fields.filter(([key]) => item[key] !== undefined && item[key] !== '');
  return entries.length ? `<dl class="details">${entries.map(([key,label,type]) => {
    const value = item[key];
    const display = type === 'date' ? date(value) : type === 'money' ? money(value) : value;
    return `<div><dt>${label}</dt><dd>${safe(display)}</dd></div>`;
  }).join('')}</dl>` : '<p class="empty">No details added.</p>';
}
function summary(key, item) {
  switch (key) {
    case 'vets': return [item.clinic,item.vet];
    case 'subscriptions': return [item.provider,[item.name,item.price ? money(item.price) : '',item.date ? 'Renews '+date(item.date) : ''].filter(Boolean).join(' · ')];
    case 'claims': return [item.name,[item.provider,item.status,item.date ? date(item.date) : ''].filter(Boolean).join(' · ')];
    default: return [item.name,item.status || (item.date ? date(item.date) : '')];
  }
}
function deviceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
function deviceLink(item) {
  const url = deviceUrl(item.url);
  return url ? `<a class="button secondary device-link" href="${safe(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${safe(item.name)} link in a new tab">Open link</a>` : '';
}
function deviceShortcuts() {
  const shortcuts = list('devices').map(item => `
    <div class="row">
      <div><strong>${safe(item.name)}</strong><p class="label">${safe(item.category)}</p></div>
      ${deviceLink(item)}
    </div>`).join('');
  return shortcuts || '<p class="empty">Add a device to keep its app or support link handy.</p>';
}
function recordSection(key) {
  const section = sections[key];
  const records = list(key).map((item,index) => {
    const [title] = summary(key,item);
    return `<article class="card record"><div class="row"><h3>${safe(title)} ${item.sample ? '<span class="badge">Sample</span>' : ''}</h3>${button('Edit','edit',key,index,'link')}</div>${fieldDetails(section.fields.slice(1).filter(([name])=>name!=='url'),item)}${key==='devices'?deviceLink(item):''}</article>`;
  }).join('');
  return `<section class="section"><div class="heading"><h2>${section.title}</h2>${button('+ Add '+section.singular,'add',key)}</div>${records || '<p class="empty">No records yet.</p>'}</section>`;
}
function overviewCard(title,icon,target,content) {
  return `<section class="card"><div class="cardhead"><span class="icon" aria-hidden="true">${icon}</span><h3>${title}</h3>${button('View','go',target,'','link')}</div>${content}</section>`;
}
function compact(key,max=2) {
  return list(key).slice(0,max).map(item => {
    const [title,subtitle] = summary(key,item);
    return `<div class="row"><div><p><strong>${safe(title)}</strong></p>${subtitle ? `<p class="label">${safe(subtitle)}</p>` : ''}</div></div>`;
  }).join('') || '<p class="empty">No records yet.</p>';
}
const photoPattern = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
function petPhoto(item) {
  if (typeof item.photo === 'string' && item.photo.length <= 32000 && photoPattern.test(item.photo)) {
    return item.photo;
  }
  return item.id === 'sample' ? '/maple.webp' : '';
}

async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error('This photo could not be opened. Try a JPEG or PNG.'); }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    for (const limit of [480, 320, 200, 120]) {
      const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL('image/jpeg', 0.75);
      if (photo.length <= 32000 && photoPattern.test(photo)) return photo;
    }
    throw new Error('This photo could not be resized. Try a smaller image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render() {
  const current = pet();
  const photo = petPhoto(current);
  document.title = pages[page][0]+' · Petfolio';
  nav.innerHTML = Object.entries(pages).map(([key,[title,icon]]) => `<button class="nav" data-action="go" data-key="${key}" aria-label="${title}" ${key===page ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span><span class="full-label">${title}</span><span class="short-label">${mobileLabels[key]}</span></button>`).join('');
  picker.innerHTML = data.pets.map(item => `<option value="${safe(item.id)}" ${item.id===current.id?'selected':''}>${safe(item.name)}${item.id==='sample'?' (sample)':''}</option>`).join('');
  const titles = {overview:'Pet care overview',profile:'Pet profile',health:'Health records',claims:'Insurance claims',subscriptions:'Subscriptions',devices:'Devices'};
  const subtitles = {overview:'Health records, claims, and subscriptions in one place.',profile:'Ownership, adoption, and microchip details.',health:'Veterinary contacts, conditions, medications, and surgeries.',claims:'Track claim status, costs, and reimbursements.',subscriptions:'Track autoships, memberships, and upcoming renewals across providers.',devices:'Keep device app and support links, model numbers, and notes together.'};
  let body = '';
  if(page==='overview'){
    const descriptor = [current.breed || current.species,current.age ? current.age+' '+(Number(current.age)===1?'year':'years')+' old' : ''].filter(Boolean).join(' · ');
    body = `<section class="hero"><div class="hero-copy">${current.id==='sample'?'<span class="badge">Sample profile</span>':''}<h2>${safe(current.name)}</h2><p>${safe(descriptor)}</p>${button('Edit profile','edit','profile')}</div><div class="portrait" aria-hidden="true"><span>${current.species?.toLowerCase()==='cat'?'🐈':'🐾'}</span>${photo ? `<img src="${safe(photo)}" alt="">` : ''}</div></section>
    <div class="grid">
    <div class="wide">${overviewCard('Pet devices','◈','devices',deviceShortcuts())}</div>
    ${overviewCard('Microchip','◇','profile',fieldDetails([['chipStatus','Status'],['chip','Microchip number']],current))}
    ${overviewCard('Veterinary care','✚','health',compact('vets',1))}
    ${overviewCard('Insurance claims','◇','claims',compact('claims'))}
    ${overviewCard('Subscriptions','▤','subscriptions',compact('subscriptions'))}
    </div>`;
  }
  if(page==='profile') body = `<div class="grid"><section class="card"><div class="cardhead"><h2>Personal information</h2></div>${photo ? `<img class="profile-photo" src="${safe(photo)}" alt="${safe(current.name)}">` : ''}${fieldDetails(profileFields.slice(0,7),current)}</section><section class="card"><div class="cardhead"><h2>Microchip</h2></div>${fieldDetails(profileFields.slice(7),current)}</section></div>`;
  if(page==='health') body = ['vets','conditions','medications','surgeries'].map(recordSection).join('');
  if(page==='claims' || household(page)) body = recordSection(page);
  if(page==='devices') body += `<section class="card section"><h2>Device alerts</h2><p class="sub">Device alerts are available in the manufacturers’ apps. For the FreshFeed’s last-meal notice, enable Stop After Full Rotation in PetSafe Pet Companion.</p><p class="sub"><a href="https://support.petsafe.net/articles/how-to-change-the-settings-on-my-petsafe-freshfeed-refrigerated-pet-feeder/" target="_blank" rel="noopener noreferrer">FreshFeed alert settings</a></p></section>`;
  main.innerHTML = `<div class="top"><p class="label">${household(page)?'Household':safe(current.name)+(current.id==='sample'?' · Sample pet':'')}</p>${button('+ Add pet','add','profile','','button')}</div><header class="heading"><div><h1>${titles[page]}</h1><p class="sub">${subtitles[page]}</p></div>${page==='profile'?button('Edit profile','edit','profile'):''}</header>${body}`;
}
function openEditor(key,index,add) {
  const profile = key==='profile';
  const spec = profile ? profileFields : sections[key].fields;
  const item = add ? {} : profile ? pet() : list(key)[index];
  editing = {key,index,add};
  document.querySelector('#form-title').textContent = (add?'Add ':'Edit ')+(profile?(add?'pet':'pet profile'):sections[key].singular);
  document.querySelector('#fields').innerHTML = spec.map(([name,label,type],i) => {
    const value = safe(item[name]);
    let control;
    if(Array.isArray(type)) control = `<select name="${name}"><option value="">Select…</option>${type.map(option=>`<option ${item[name]===option?'selected':''}>${option}</option>`).join('')}</select>`;
    else if(type==='textarea') control = `<textarea name="${name}" rows="2">${value}</textarea>`;
    else {
      const number = type==='money' || type==='age';
      control = `<input name="${name}" type="${number?'number':type || 'text'}" ${number?'min="0" step="0.01"':''} value="${value}" ${i===0?'required':''}>`;
    }
    return `<label>${label}${control}</label>`;
  }).join('') + (profile ? `
    <div class="photo-field">
      ${petPhoto(item) ? `<img class="profile-photo" src="${safe(petPhoto(item))}" alt="Current profile picture">` : ''}
      <label>Profile picture<input id="pet-photo" type="file" accept="image/*"></label>
      ${item.photo ? '<label class="photo-remove"><input id="remove-photo" type="checkbox"> Remove current photo</label>' : ''}
    </div>` : '');
  formError.textContent = '';
  form.querySelector('[data-action="remove"]')?.remove();
  if(!add && (!profile || data.pets.length > 1)) {
    form.querySelector('.actions').insertAdjacentHTML('afterbegin',button('Delete '+(profile?'pet':sections[key].singular),'remove','','','link danger'));
  }
  dialog.showModal();
}
async function commitEdit(remove=false) {
  if (saving) return;
  const {key,index,add} = editing;
  const next = structuredClone(data);
  const current = next.pets.find(item=>item.id===pet().id);
  const fields = Object.fromEntries(Array.from(new FormData(form),([name,value])=>[name,value.trim()]));
  const primary = (key==='profile'?profileFields:sections[key].fields)[0][0];
  if(!remove && !fields[primary]) {formError.textContent='Enter a name before saving.';return;}
  if(!remove && key==='devices' && fields.url && !deviceUrl(fields.url)) {
    formError.textContent='Enter a link that starts with https:// or http://.';
    return;
  }
  saving = true;
  formError.textContent = 'Saving…';
  try {
    if (key === 'profile' && !remove) {
      const photo = form.querySelector('#pet-photo').files[0];
      if (photo) fields.photo = await preparePhoto(photo);
      else if (form.querySelector('#remove-photo')?.checked) delete current.photo;
    }
    if(key==='profile'){
      if(remove){
        next.pets = next.pets.filter(item=>item.id!==current.id);
        next.selected = next.pets[0].id;
      } else if(add){
        const id = crypto.randomUUID();
        next.pets.push({id,...fields});
        next.selected = id;
      } else Object.assign(current,fields);
    } else {
      const records = household(key) ? next[key] : (current[key] ??= []);
      if(remove) records.splice(index,1);
      else if(add) records.push(fields);
      else Object.assign(records[index],fields);
    }
    await persist(next);
  }
  catch (error) {
    formError.textContent = error.message || 'Changes could not be saved.';
    return;
  } finally { saving = false; }
  if(key==='profile' && add) page='profile';
  dialog.close();
  render();
}
picker.addEventListener('change',()=>{
  data = {...data,selected:picker.value};
  render();
});
document.addEventListener('click',event=>{
  const control = event.target.closest('[data-action]');
  if(!control) return;
  const {action,key,index} = control.dataset;
  if(action==='go') {
    page=key;
    render();
    main.focus({preventScroll:true});
    window.scrollTo(0,0);
  }
  if(saving) return;
  if(action==='edit' || action==='add') openEditor(key,Number(index),action==='add');
  if(action==='remove' && confirm(editing.key==='profile'?'Delete this pet and its records?':'Delete this record?')) commitEdit(true);
});
document.querySelector('#cancel').addEventListener('click',()=>{ if (!saving) dialog.close(); });
dialog.addEventListener('cancel',event=>{ if (saving) event.preventDefault(); });
form.addEventListener('submit',event=>{event.preventDefault();commitEdit();});
loadRecords();
