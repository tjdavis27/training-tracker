(() => {
  const CATALOG = window.TRAINING_CATALOG;
  const CONFIG = window.TRAINING_TRACKER_CONFIG || {};
  const WORKSPACE = CONFIG.workspace || 'florence';
  const STORAGE_KEY = 'florenceTrainingTracker.v130';
  const LEGACY_KEYS = ['florenceTrainingTracker.v120','florenceTrainingTracker.v110','florenceTrainingTracker.v100'];
  const BASELINE_VERSION = '130';

  const seedEmployees = [
    {id:'tj',name:'TJ Davis',active:true,display_order:1},
    {id:'izzy',name:'Izzy Smith',active:true,display_order:2},
    {id:'jade',name:'Jade Taylor',active:true,display_order:3},
    {id:'lucie',name:'Lucie Gardener',active:true,display_order:4}
  ];

  const state = {
    employees:[], progress:{}, observations:[], resets:[], quizzes:[], logs:[],
    selectedEmployee:null, selectedRole:'rh1', selectedRoom:'every', view:'dashboard',
    remote:false, supabase:null, subscription:null
  };

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const normName = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const pkey = (employeeId,reqId) => `${employeeId}|${reqId}`;
  const progress = (employeeId,reqId) => state.progress[pkey(employeeId,reqId)] || {employee_id:employeeId,requirement_id:reqId,completed:false};
  const isDone = (employeeId,reqId) => !!progress(employeeId,reqId).completed;
  const roleById = id => CATALOG.roleMap.get(id);
  const employeeById = id => state.employees.find(x=>x.id===id);
  const sortedEmployees = (includeRemoved=false) => [...state.employees].filter(x=>includeRemoved||x.active!==false).sort((a,b)=>(a.display_order??999)-(b.display_order??999)||a.name.localeCompare(b.name));

  function initials(name){return String(name||'?').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()}
  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1900)}
  function setSync(live,label,detail){$('syncDot').classList.toggle('live',live);$('syncLabel').textContent=label;$('syncDetail').textContent=detail}
  function showModal(html){$('modal').innerHTML=html;$('modalBackdrop').classList.remove('hidden');$('modal').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal)}
  function closeModal(){$('modalBackdrop').classList.add('hidden');$('modal').innerHTML=''}

  function allSimpleIdsForRole(roleId){
    const role=roleById(roleId);if(!role)return[];
    const ids=(role.simple||[]).map(x=>x.id);
    (role.roomTabs||[role.singleRoom].filter(Boolean)).forEach(r=>(r.simple||[]).forEach(x=>ids.push(x.id)));
    return ids;
  }
  function allQuizDefsForRole(roleId){
    const role=roleById(roleId);if(!role)return[];
    const out=[...(role.quizzes||[])];
    (role.roomTabs||[role.singleRoom].filter(Boolean)).forEach(r=>(r.quizzes||[]).forEach(x=>out.push({...x,room:r.id})));
    return out;
  }
  function historicalCreditId(roleId,roomId,type){return `history.${roleId}.${roomId}.${String(type).toLowerCase().replace(/\s+/g,'')}`}

  function baselineSpec(){
    const employeeSpecs={
      tj:{roles:['rh1','bb','cxs1','cxs2','cxs3'],clear:['clear.rh1','clear.a8','clear.esp','clear.ftf','clear.bb','clear.cxs1','clear.cxs2','clear.cxs3']},
      izzy:{roles:['rh1','bb','cxs1','cxs2','cxs3'],clear:['clear.rh1','clear.a8','clear.esp','clear.ftf','clear.bb','clear.cxs1','clear.cxs2']},
      jade:{roles:['rh1','bb'],clear:['clear.rh1','clear.a8','clear.esp','clear.ftf','clear.bb']}
    };
    const progressRows=[];const quizRows=[];
    Object.entries(employeeSpecs).forEach(([employee_id,spec])=>{
      spec.roles.forEach(roleId=>allSimpleIdsForRole(roleId).forEach(requirement_id=>progressRows.push({employee_id,requirement_id,completed:true,completed_by:'Historical clearance'})));
      spec.clear.forEach(requirement_id=>progressRows.push({employee_id,requirement_id,completed:true,completed_by:'Historical clearance'}));
      ['rh1'].filter(x=>spec.roles.includes(x)).forEach(()=>{
        ['a8','esp','ftf'].forEach(roomId=>['Intro','Outro','Room Run','resets'].forEach(type=>progressRows.push({employee_id,requirement_id:historicalCreditId('rh1',roomId,type),completed:true,completed_by:'Historical clearance'})));
      });
      if(spec.roles.includes('bb'))['Intro','Outro','Room Run','resets'].forEach(type=>progressRows.push({employee_id,requirement_id:historicalCreditId('bb','bb',type),completed:true,completed_by:'Historical clearance'}));
      spec.roles.forEach(roleId=>allQuizDefsForRole(roleId).forEach(q=>{
        const result=(employee_id==='izzy'&&q.id==='cxs3.emails')?'fail':'pass';
        quizRows.push({
          id:`seed-${employee_id}-${q.id.replace(/[^a-z0-9]+/gi,'-')}`,
          employee_id,track:roleId,room:q.room||'',quiz_id:q.id,quiz_label:q.label,taken_at:null,
          observed_by:'Historical completion',result,created_at:'2026-01-01T00:00:00.000Z'
        });
      }));
    });
    return {progressRows,quizRows};
  }

  function blankState(){
    const base={employees:seedEmployees.map(x=>({...x})),progress:{},observations:[],resets:[],quizzes:[],logs:[],seed_version:BASELINE_VERSION};
    const spec=baselineSpec();
    spec.progressRows.forEach(x=>base.progress[pkey(x.employee_id,x.requirement_id)]={...x});
    base.quizzes=spec.quizRows.map(x=>({...x}));
    return base;
  }

  function normalizeLegacyEmployee(e){
    if(e.id==='jadie'||normName(e.name)==='jadietaylor')return {...e,name:'Jade Taylor'};
    return {...e};
  }
  function loadLocal(){
    try{
      const current=localStorage.getItem(STORAGE_KEY);
      if(current){const x=JSON.parse(current);if(x?.employees?.length)return x}
      for(const key of LEGACY_KEYS){
        const raw=localStorage.getItem(key);if(!raw)continue;
        const old=JSON.parse(raw);if(!old?.employees?.length)continue;
        const fresh=blankState();
        const imported=old.employees.map(normalizeLegacyEmployee);
        imported.forEach(e=>{
          const match=fresh.employees.find(x=>x.id===e.id||normName(x.name)===normName(e.name));
          if(match)Object.assign(match,e,{id:match.id,name:match.id==='jade'?'Jade Taylor':e.name});
          else fresh.employees.push({...e,display_order:fresh.employees.length+1});
        });
        Object.values(old.progress||{}).forEach(p=>{
          const employee_id=p.employee_id==='jadie'?'jade':p.employee_id;
          if(p.completed)fresh.progress[pkey(employee_id,p.requirement_id)]={...p,employee_id};
        });
        fresh.logs=(old.logs||[]).map(l=>({...l,employee_id:l.employee_id==='jadie'?'jade':l.employee_id}));
        fresh.observations=(old.observations||[]).map(x=>({...x,employee_id:x.employee_id==='jadie'?'jade':x.employee_id}));
        fresh.resets=(old.resets||[]).map(x=>({...x,employee_id:x.employee_id==='jadie'?'jade':x.employee_id}));
        const seededById=new Map((fresh.quizzes||[]).map(x=>[x.id,x]));
        (old.quizzes||[]).forEach(x=>seededById.set(x.id,{...x,employee_id:x.employee_id==='jadie'?'jade':x.employee_id}));
        fresh.quizzes=[...seededById.values()];
        return fresh;
      }
    }catch(err){console.warn(err)}
    return blankState();
  }
  function saveLocal(){
    if(state.remote)return;
    localStorage.setItem(STORAGE_KEY,JSON.stringify({
      employees:state.employees,progress:state.progress,observations:state.observations,resets:state.resets,
      quizzes:state.quizzes,logs:state.logs,seed_version:BASELINE_VERSION
    }));
  }

  async function loadSupabaseSdk(){
    if(window.supabase?.createClient)return true;
    if(!CONFIG.supabaseUrl||!CONFIG.supabaseAnonKey)return false;
    return new Promise(resolve=>{
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=()=>resolve(!!window.supabase?.createClient);s.onerror=()=>resolve(false);document.head.appendChild(s);
    });
  }

  async function initData(){
    const canRemote=await loadSupabaseSdk();
    if(!canRemote){Object.assign(state,loadLocal());setSync(false,'Local Mode','Saved on this device');render();return}
    try{
      state.supabase=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);state.remote=true;
      await loadRemote();await ensureRemoteBaseline();await loadRemote();subscribeRemote();
      setSync(true,'Shared Live','Supabase realtime connected');render();
    }catch(err){
      console.error(err);state.remote=false;Object.assign(state,loadLocal());setSync(false,'Local Fallback','Shared connection failed');render();
    }
  }

  async function loadRemote(){
    const sb=state.supabase;
    const [e,p,l,o,r,q]=await Promise.all([
      sb.from('training_employees').select('*').eq('workspace',WORKSPACE).order('display_order'),
      sb.from('training_progress').select('*').eq('workspace',WORKSPACE),
      sb.from('training_logs').select('*').eq('workspace',WORKSPACE),
      sb.from('training_observations').select('*').eq('workspace',WORKSPACE),
      sb.from('training_resets').select('*').eq('workspace',WORKSPACE),
      sb.from('training_quiz_attempts').select('*').eq('workspace',WORKSPACE)
    ]);
    for(const x of [e,p,l,o,r,q])if(x.error)throw x.error;
    if(!e.data.length){await sb.from('training_employees').insert(seedEmployees.map(x=>({...x,workspace:WORKSPACE})));return loadRemote()}
    state.employees=e.data.map(normalizeLegacyEmployee);
    state.progress={};p.data.forEach(x=>state.progress[pkey(x.employee_id,x.requirement_id)]={...x});
    state.logs=l.data||[];state.observations=o.data||[];state.resets=r.data||[];state.quizzes=q.data||[];
  }

  async function ensureRemoteBaseline(){
    const sb=state.supabase;
    const meta=await sb.from('training_meta').select('*').eq('workspace',WORKSPACE).eq('key','baseline_v130').maybeSingle();
    if(meta.error)throw meta.error;if(meta.data)return;

    const byKey={};state.employees.forEach(e=>byKey[normName(e.name)]=e);
    const aliases={tj:byKey.tjdavis||state.employees.find(x=>x.id==='tj'),izzy:byKey.izzysmith||state.employees.find(x=>x.id==='izzy'),jade:byKey.jadetaylor||byKey.jadietaylor||state.employees.find(x=>['jade','jadie'].includes(x.id))};
    if(aliases.jade&&aliases.jade.name!=='Jade Taylor')await sb.from('training_employees').update({name:'Jade Taylor'}).eq('workspace',WORKSPACE).eq('id',aliases.jade.id);
    const spec=baselineSpec();
    const idMap={tj:aliases.tj?.id,izzy:aliases.izzy?.id,jade:aliases.jade?.id};
    const progressRows=spec.progressRows.filter(x=>idMap[x.employee_id]).map(x=>({...x,employee_id:idMap[x.employee_id],workspace:WORKSPACE,updated_at:new Date().toISOString()}));
    if(progressRows.length){const x=await sb.from('training_progress').upsert(progressRows,{onConflict:'workspace,employee_id,requirement_id'});if(x.error)throw x.error}
    const quizRows=spec.quizRows.filter(x=>idMap[x.employee_id]).map(x=>({...x,employee_id:idMap[x.employee_id],workspace:WORKSPACE,id:`${x.id}-${idMap[x.employee_id]}`}));
    if(quizRows.length){const x=await sb.from('training_quiz_attempts').upsert(quizRows,{onConflict:'id'});if(x.error)throw x.error}
    const done=await sb.from('training_meta').insert({workspace:WORKSPACE,key:'baseline_v130',value:'applied'});if(done.error)throw done.error;
  }

  function subscribeRemote(){
    if(!state.supabase)return;state.subscription?.unsubscribe?.();
    let ch=state.supabase.channel(`training-v130-${WORKSPACE}`);
    ['training_employees','training_progress','training_logs','training_observations','training_resets','training_quiz_attempts'].forEach(table=>{
      ch=ch.on('postgres_changes',{event:'*',schema:'public',table,filter:`workspace=eq.${WORKSPACE}`},refreshRemote);
    });
    state.subscription=ch.subscribe();
  }
  let refreshTimer;
  function refreshRemote(){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{await loadRemote();render()},180)}

  async function writeProgress(employeeId,requirementId,completed){
    const row={employee_id:employeeId,requirement_id:requirementId,completed:!!completed,completed_at:completed?today():null,completed_by:completed?'Tracker sign-off':'',updated_at:new Date().toISOString()};
    state.progress[pkey(employeeId,requirementId)]={...progress(employeeId,requirementId),...row};
    if(state.remote){const {error}=await state.supabase.from('training_progress').upsert({workspace:WORKSPACE,...state.progress[pkey(employeeId,requirementId)]},{onConflict:'workspace,employee_id,requirement_id'});if(error)throw error}else saveLocal();
  }

  function roleClear(employeeId,roleId){const role=roleById(roleId);return role?isDone(employeeId,role.clearanceId):false}
  function roomClear(employeeId,room){return room?.clearanceId?isDone(employeeId,room.clearanceId):false}
  function roleStarted(employeeId,roleId){
    if(roleClear(employeeId,roleId))return true;
    const role=roleById(roleId);if(!role)return false;
    const simple=[...(role.simple||[])];(role.roomTabs||[role.singleRoom].filter(Boolean)).forEach(r=>simple.push(...(r.simple||[])));
    if(simple.some(x=>isDone(employeeId,x.id)))return true;
    if(state.observations.some(x=>x.employee_id===employeeId&&x.track===roleId))return true;
    if(state.resets.some(x=>x.employee_id===employeeId&&x.track===roleId))return true;
    if(state.quizzes.some(x=>x.employee_id===employeeId&&x.track===roleId))return true;
    return false;
  }
  function roleStatus(employeeId,roleId){return roleClear(employeeId,roleId)?'Cleared':roleStarted(employeeId,roleId)?'In Progress':'Not Started'}

  function render(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
    $(`${state.view}View`).classList.add('active');
    const titles={dashboard:'Training Dashboard',staff:'Staff Training Files',logs:'Training Updates',setup:'Setup & Sharing'};
    $('pageTitle').textContent=titles[state.view]||'Training Tracker';
    renderDashboard();renderStaff();renderLogs();renderSetup();
  }

  function renderDashboard(){
    const staff=sortedEmployees();
    const cleared=staff.reduce((sum,e)=>sum+CATALOG.roles.filter(r=>roleClear(e.id,r.id)).length,0);
    const total=staff.length*CATALOG.roles.length;
    const needs=state.logs.filter(x=>String(x.needs_work||'').trim()).sort((a,b)=>String(b.training_date||'').localeCompare(String(a.training_date||''))).slice(0,4);
    $('dashboardView').innerHTML=`
      <div class="hero-grid">
        <div class="hero-card"><p class="eyebrow">TRAINING FILES</p><h3>${staff.length} active staff members</h3><p>Open an employee to switch between RH1, BB, and CXS training. Detailed observations live with the requirement they belong to.</p></div>
        <div class="hero-card overall"><div class="ring" style="--p:${total?Math.round(cleared/total*100):0}"><strong>${cleared}</strong></div><div class="overall-info"><strong>${cleared}/${total}</strong><span>role clearances</span></div></div>
      </div>
      <div class="section-head"><div><h3>Staff</h3><p>Click a person to open their training file.</p></div><button class="button small" id="dashAddStaff">+ Add Staff</button></div>
      <div class="staff-grid">${staff.map(staffCard).join('')}</div>
      <div class="section-head"><div><h3>Needs More Work</h3><p>Latest trainer handoff notes.</p></div></div>
      ${needs.length?`<div class="focus-grid">${needs.map(x=>`<div class="focus-card"><strong>${esc(employeeById(x.employee_id)?.name||x.employee_id)}</strong><span>${esc(x.training_date||'')} · ${esc(x.track||'Training')}</span><p>${esc(x.needs_work)}</p></div>`).join('')}</div>`:'<div class="empty">No current focus notes.</div>'}`;
    $('dashAddStaff').onclick=openAddEmployee;
    $('dashboardView').querySelectorAll('[data-open-employee]').forEach(b=>b.onclick=()=>openEmployee(b.dataset.openEmployee));
  }

  function staffCard(e){
    const roles=CATALOG.roles.map(r=>{const s=roleStatus(e.id,r.id);return `<span class="pill ${r.color} ${s==='Cleared'?'done':s==='In Progress'?'working':'pending'}">${esc(r.label)} · ${esc(s)}</span>`}).join('');
    const last=state.logs.filter(x=>x.employee_id===e.id).sort((a,b)=>String(b.training_date||'').localeCompare(String(a.training_date||'')))[0];
    return `<button class="staff-card" data-open-employee="${esc(e.id)}"><div class="staff-head"><div class="staff-name"><div class="avatar">${esc(initials(e.name))}</div><div><h4>${esc(e.name)}</h4><span>${last?`Last trained ${esc(last.training_date||'')}`:'No training journal yet'}</span></div></div><span class="open-arrow">›</span></div><div class="track-pills">${roles}</div></button>`;
  }

  function openEmployee(id){state.selectedEmployee=id;state.selectedRole='rh1';state.selectedRoom='every';state.view='staff';render();setTimeout(()=>document.querySelector('.employee-file')?.scrollIntoView({behavior:'smooth',block:'start'}),10)}

  function renderStaff(){
    const active=sortedEmployees();const removed=sortedEmployees(true).filter(x=>x.active===false);
    if(!state.selectedEmployee||!employeeById(state.selectedEmployee)||employeeById(state.selectedEmployee).active===false){
      $('staffView').innerHTML=`
        <div class="section-head"><div><h3>Active Staff</h3><p>Open a training file or manage the roster.</p></div><button class="button primary" id="addStaffBtn">+ Add Staff</button></div>
        <div class="staff-list">${active.map((e,i)=>`<div class="staff-row"><div class="avatar small-avatar">${esc(initials(e.name))}</div><button class="staff-row-open" data-open-employee="${esc(e.id)}"><strong>${esc(e.name)}</strong><span>Open training file</span></button><div class="order-buttons"><button class="mini-btn" data-move="-1" data-id="${esc(e.id)}" ${i===0?'disabled':''}>↑</button><button class="mini-btn" data-move="1" data-id="${esc(e.id)}" ${i===active.length-1?'disabled':''}>↓</button></div><button class="mini-btn danger-mini" data-remove="${esc(e.id)}">Remove</button></div>`).join('')}</div>
        ${removed.length?`<div class="section-head"><div><h3>Removed Staff</h3><p>History is preserved. Restore them if needed.</p></div></div><div class="removed-list">${removed.map(e=>`<div class="removed-row"><span>${esc(e.name)}</span><button class="mini-btn" data-restore="${esc(e.id)}">Restore</button></div>`).join('')}</div>`:''}`;
      $('addStaffBtn').onclick=openAddEmployee;
      $('staffView').querySelectorAll('[data-open-employee]').forEach(b=>b.onclick=()=>openEmployee(b.dataset.openEmployee));
      $('staffView').querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>moveEmployee(b.dataset.id,Number(b.dataset.move)));
      $('staffView').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeEmployee(b.dataset.remove));
      $('staffView').querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restoreEmployee(b.dataset.restore));
      return;
    }
    $('staffView').innerHTML=employeeFile(employeeById(state.selectedEmployee));
    bindEmployeeFile();
  }

  function employeeFile(e){
    const role=roleById(state.selectedRole)||CATALOG.roles[0];
    return `<div class="employee-file">
      <div class="file-top panel"><button class="back-link" data-back-staff>← Staff</button><div class="detail-person"><div class="avatar big-avatar">${esc(initials(e.name))}</div><div><h3>${esc(e.name)}</h3><p>Training File</p></div></div><button class="button danger small" data-remove-current>Remove Staff</button></div>
      <div class="role-tabs">${CATALOG.roles.map(r=>`<button class="role-tab ${r.id===role.id?'active':''} ${r.color}" data-role="${r.id}">${esc(r.label)}<span>${esc(roleStatus(e.id,r.id))}</span></button>`).join('')}</div>
      ${renderRole(e,role)}
      ${employeeJournal(e)}
    </div>`;
  }

  function clearanceCard(e,role,room=null){
    const id=room?.clearanceId||role.clearanceId;if(!id)return'';
    const label=room?`${room.short} Cleared`:`${role.label} Cleared`;const done=isDone(e.id,id);
    return `<div class="clearance-card ${done?'cleared':''}"><div><span class="clearance-kicker">FINAL SIGN-OFF</span><strong>${esc(label)}</strong><p>${done?'This clearance is marked complete.':'Mark this only when the employee is officially cleared.'}</p></div><button class="clear-toggle ${done?'done':''}" data-progress="${esc(id)}">${done?'✓ Cleared':'Mark Cleared'}</button></div>`;
  }

  function renderRole(e,role){
    if(role.id==='rh1'){
      const room=role.roomTabs.find(x=>x.id===state.selectedRoom)||role.roomTabs[0];
      return `<div class="role-file panel"><div class="role-title"><div><span class="tag ${role.color}">${esc(role.label)}</span><h3>${esc(role.subtitle)}</h3></div>${clearanceCard(e,role)}</div>
        <div class="room-tabs">${role.roomTabs.map(r=>`<button class="room-tab ${r.id===room.id?'active':''}" data-room="${esc(r.id)}">${esc(r.label)}</button>`).join('')}</div>
        ${renderRoomContent(e,role,room)}</div>`;
    }
    if(role.id==='bb')return `<div class="role-file panel"><div class="role-title"><div><span class="tag ${role.color}">${esc(role.label)}</span><h3>${esc(role.subtitle)}</h3></div>${clearanceCard(e,role)}</div>${renderRoomContent(e,role,role.singleRoom)}</div>`;
    return `<div class="role-file panel"><div class="role-title"><div><span class="tag ${role.color}">${esc(role.label)}</span><h3>${esc(role.subtitle)}</h3></div>${clearanceCard(e,role)}</div>${renderSimpleGroups(e,role.simple||[])}${renderQuizSection(e,role,role.quizzes||[],'')}</div>`;
  }

  function renderRoomContent(e,role,room){
    return `${room.id!=='every'?clearanceCard(e,role,room):''}${renderSimpleGroups(e,room.simple||[])}${room.observations?.length?renderObservationSection(e,role,room):''}${room.resetTarget?renderResetSection(e,role,room):''}${renderQuizSection(e,role,room.quizzes||[],room.id)}`;
  }

  function renderSimpleGroups(e,items){
    if(!items.length)return'';
    const groups={};items.forEach(x=>(groups[x.group]??=[]).push(x));
    return `<div class="training-section"><div class="section-label"><h4>Quick Check-Offs</h4><p>Simple yes/no items. No notes required.</p></div>${Object.entries(groups).map(([name,rows])=>`<div class="check-group"><h5>${esc(name)}</h5><div class="check-grid">${rows.map(x=>{const done=isDone(e.id,x.id);return `<label class="simple-check ${done?'done':''}"><input type="checkbox" data-progress="${esc(x.id)}" ${done?'checked':''}><span class="check-box">${done?'✓':''}</span><span>${esc(x.label)}</span></label>`}).join('')}</div></div>`).join('')}</div>`;
  }

  function obsFor(employeeId,track,room,activity){return state.observations.filter(x=>x.employee_id===employeeId&&x.track===track&&x.room===room&&x.activity===activity).sort((a,b)=>String(b.observed_at||'').localeCompare(String(a.observed_at||'')))}
  function renderObservationSection(e,role,room){
    return `<div class="training-section"><div class="section-label"><h4>Observed Performance</h4><p>Intros, outros, and room-running get real feedback instead of a lonely checkbox.</p></div><div class="performance-grid">${room.observations.map(activity=>{
      const rows=obsFor(e.id,role.id,room.id,activity);const hist=isDone(e.id,historicalCreditId(role.id,room.id,activity));
      return `<div class="performance-card"><div class="performance-head"><div><h5>${esc(activity)}</h5><span>${rows.length} recorded observation${rows.length===1?'':'s'}</span></div><button class="mini-btn" data-add-observation="${esc(activity)}" data-room-id="${esc(room.id)}">+ Add</button></div>${hist&&!rows.length?'<div class="history-credit">✓ Historical requirement complete</div>':''}${rows.length?`<div class="record-list">${rows.slice(0,5).map(observationCard).join('')}</div>`:'<div class="mini-empty">No detailed observations yet.</div>'}</div>`}).join('')}</div></div>`;
  }
  function observationCard(x){return `<article class="record-card"><div class="record-top"><span>${esc(x.observed_at||'No date')}</span><b class="score-badge">${esc(x.score)}/10</b><button class="record-delete" data-delete-observation="${esc(x.id)}">×</button></div><div class="observer">Observed by ${esc(x.observed_by||'Not entered')}</div><div class="feedback two"><div><span>Good Stuff</span><p>${esc(x.good_stuff||'—')}</p></div><div><span>Needs Work</span><p>${esc(x.needs_work||'—')}</p></div></div></article>`}

  function resetsFor(employeeId,track,room){return state.resets.filter(x=>x.employee_id===employeeId&&x.track===track&&x.room===room).sort((a,b)=>String(b.reset_at||'').localeCompare(String(a.reset_at||'')))}
  function renderResetSection(e,role,room){
    const rows=resetsFor(e.id,role.id,room.id);const hist=isDone(e.id,historicalCreditId(role.id,room.id,'resets'));
    return `<div class="training-section"><div class="section-label horizontal"><div><h4>Resets</h4><p>Reset feedback includes the reset time.</p></div><button class="button small" data-add-reset data-room-id="${esc(room.id)}">+ Add Reset</button></div><div class="reset-summary"><strong>${hist&&!rows.length?'Historical requirement complete':`${rows.length} / ${room.resetTarget} recorded`}</strong>${hist&&!rows.length?'<span>Detailed legacy times / feedback were not invented.</span>':`<span>${Math.max(0,room.resetTarget-rows.length)} until five are recorded</span>`}</div>${rows.length?`<div class="record-list reset-list">${rows.map(resetCard).join('')}</div>`:'<div class="mini-empty">No detailed reset records yet.</div>'}</div>`;
  }
  function resetCard(x){return `<article class="record-card"><div class="record-top"><span>${esc(x.reset_at||'No date')}</span><b class="time-badge">${esc(x.reset_time||'No time')}</b><b class="score-badge">${esc(x.score)}/10</b><button class="record-delete" data-delete-reset="${esc(x.id)}">×</button></div><div class="observer">Observed by ${esc(x.observed_by||'Not entered')}</div><div class="feedback two"><div><span>Good Stuff</span><p>${esc(x.good_stuff||'—')}</p></div><div><span>Needs Work</span><p>${esc(x.needs_work||'—')}</p></div></div></article>`}

  function quizAttempts(employeeId,quizId){return state.quizzes.filter(x=>x.employee_id===employeeId&&x.quiz_id===quizId).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
  function quizStatus(employeeId,quizId){
    const rows=quizAttempts(employeeId,quizId);
    if(!rows.length)return{label:'Not Taken',tone:'pending'};
    const latest=rows[0];
    if(latest.result==='pass')return{label:'Passed',tone:'pass'};
    if(latest.result==='fail')return{label:'Retake Required',tone:'fail'};
    return{label:'Submitted · Awaiting Grade',tone:'submitted'};
  }
  function attemptResultLabel(a){
    if(a.result==='pass')return'PASS';
    if(a.result==='fail')return'FAIL';
    return'AWAITING GRADE';
  }
  function renderQuizSection(e,role,quizzes,roomId){
    if(!quizzes.length)return'';
    return `<div class="training-section"><div class="section-label"><h4>Quizzes</h4><p>TMs submit quizzes as taken. TJ grades each submitted attempt later as Pass or Fail.</p></div><div class="quiz-grid">${quizzes.map(q=>{
      const attempts=quizAttempts(e.id,q.id),status=quizStatus(e.id,q.id);
      const buttonLabel=status.tone==='fail'?'Submit Retake':'+ Mark Taken';
      return `<div class="quiz-card ${status.tone}"><div class="quiz-head"><div><h5>${esc(q.label)}</h5><span class="quiz-status ${status.tone}">${esc(status.label)}</span></div><button class="mini-btn" data-add-quiz="${esc(q.id)}" data-room-id="${esc(roomId||'')}">${buttonLabel}</button></div>${attempts.length?`<div class="attempt-list">${attempts.map(a=>`<div class="attempt-row"><span>${esc(a.taken_at||'Historical')}</span><span>${esc(a.observed_by||'Not entered')}</span><b class="${a.result==='pass'?'pass-text':a.result==='fail'?'fail-text':'submitted-text'}">${attemptResultLabel(a)}</b>${a.result==null?`<button class="mini-btn grade-btn" data-grade-quiz="${esc(a.id)}">Grade</button>`:''}<button class="record-delete" data-delete-quiz="${esc(a.id)}">×</button></div>`).join('')}</div>`:'<div class="mini-empty">Not taken yet.</div>'}</div>`}).join('')}</div></div>`;
  }

  function employeeJournal(e){
    const logs=state.logs.filter(x=>x.employee_id===e.id).sort((a,b)=>String(b.training_date||'').localeCompare(String(a.training_date||''))).slice(0,6);
    return `<div class="training-journal panel"><div class="section-head"><div><h3>Training Updates</h3><p>What was trained, what went well, and what needs more work.</p></div><button class="button small" data-log-person="${esc(e.id)}">+ Update</button></div>${logs.length?`<div class="journal-list">${logs.map(trainingJournalCard).join('')}</div>`:'<div class="empty">No training updates yet.</div>'}</div>`;
  }
  function trainingJournalCard(log){return `<article class="journal-card"><div class="journal-card-head"><div><strong>${esc(log.training_date||'')}</strong><span>${esc(log.track||'Training')}</span></div><span class="journal-trainer">Trainer: ${esc(log.trainer||'Not entered')}</span></div><div class="journal-grid"><div class="journal-field trained"><span>Trained On</span><p>${esc(log.trained_on||log.activity||'Not entered')}</p></div><div class="journal-field good"><span>Went Well</span><p>${esc(log.went_well||'No note')}</p></div><div class="journal-field focus"><span>Needs More Work</span><p>${esc(log.needs_work||'No note')}</p></div></div></article>`}

  function bindEmployeeFile(){
    const view=$('staffView');const e=employeeById(state.selectedEmployee);const role=roleById(state.selectedRole);if(!e||!role)return;
    view.querySelector('[data-back-staff]').onclick=()=>{state.selectedEmployee=null;render()};
    view.querySelector('[data-remove-current]').onclick=()=>removeEmployee(e.id);
    view.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{state.selectedRole=b.dataset.role;state.selectedRoom=state.selectedRole==='rh1'?'every':'';render()});
    view.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>{state.selectedRoom=b.dataset.room;render()});
    view.querySelectorAll('[data-progress]').forEach(input=>{
      const fn=async()=>{const id=input.dataset.progress;const value=input.matches('input')?input.checked:!isDone(e.id,id);await writeProgress(e.id,id,value);render();toast(value?'Marked complete':'Marked incomplete')};
      input.onchange=input.matches('input')?fn:null;input.onclick=input.matches('input')?null:fn;
    });
    view.querySelectorAll('[data-add-observation]').forEach(b=>b.onclick=()=>openObservationModal(e.id,role.id,b.dataset.roomId,b.dataset.addObservation));
    view.querySelectorAll('[data-add-reset]').forEach(b=>b.onclick=()=>openResetModal(e.id,role.id,b.dataset.roomId));
    view.querySelectorAll('[data-add-quiz]').forEach(b=>b.onclick=()=>openQuizModal(e.id,role.id,b.dataset.roomId,b.dataset.addQuiz));
    view.querySelectorAll('[data-grade-quiz]').forEach(b=>b.onclick=()=>openGradeQuizModal(b.dataset.gradeQuiz));
    view.querySelectorAll('[data-delete-observation]').forEach(b=>b.onclick=()=>deleteRecord('training_observations','observations',b.dataset.deleteObservation));
    view.querySelectorAll('[data-delete-reset]').forEach(b=>b.onclick=()=>deleteRecord('training_resets','resets',b.dataset.deleteReset));
    view.querySelectorAll('[data-delete-quiz]').forEach(b=>b.onclick=()=>deleteRecord('training_quiz_attempts','quizzes',b.dataset.deleteQuiz));
    view.querySelectorAll('[data-log-person]').forEach(b=>b.onclick=()=>openLogModal(b.dataset.logPerson));
  }

  function openObservationModal(employeeId,track,room,activity){
    const e=employeeById(employeeId);
    showModal(`<h3>${esc(activity)} Observation</h3><p class="modal-sub">${esc(e?.name)} · ${esc((roleById(track)?.roomTabs||[roleById(track)?.singleRoom]).find(x=>x?.id===room)?.label||room)}</p><div class="form-grid"><label class="field"><span>Date</span><input id="oDate" type="date" value="${today()}"></label><label class="field"><span>Observed By</span><input id="oBy" placeholder="Trainer / observer"></label><label class="field"><span>Score (1–10)</span><input id="oScore" type="number" min="1" max="10" value="7"></label><label class="field wide"><span>Good Stuff</span><textarea id="oGood" placeholder="What did they do well?"></textarea></label><label class="field wide"><span>Needs More Work</span><textarea id="oBad" placeholder="What should they improve next time?"></textarea></label></div><div class="modal-actions"><button class="button ghost" data-close>Cancel</button><button class="button primary" id="saveObservation">Save Observation</button></div>`);
    $('saveObservation').onclick=async()=>{
      const score=Number($('oScore').value);if(score<1||score>10){toast('Score must be 1–10');return}
      const row={id:uid(),employee_id:employeeId,track,room,activity,observed_at:$('oDate').value,observed_by:$('oBy').value.trim(),good_stuff:$('oGood').value.trim(),needs_work:$('oBad').value.trim(),score,created_at:new Date().toISOString()};
      state.observations.push(row);if(state.remote){const {error}=await state.supabase.from('training_observations').insert({workspace:WORKSPACE,...row});if(error)throw error}else saveLocal();closeModal();render();toast('Observation saved');
    };
  }

  function openResetModal(employeeId,track,room){
    const e=employeeById(employeeId);const role=roleById(track);const roomObj=(role.roomTabs||[role.singleRoom]).find(x=>x?.id===room);
    showModal(`<h3>Add Reset</h3><p class="modal-sub">${esc(e?.name)} · ${esc(roomObj?.label||room)}</p><div class="form-grid"><label class="field"><span>Date</span><input id="rDate" type="date" value="${today()}"></label><label class="field"><span>Observed By</span><input id="rBy" placeholder="Trainer / observer"></label><label class="field"><span>Reset Time</span><input id="rTime" placeholder="Example: 12:45"></label><label class="field"><span>Score (1–10)</span><input id="rScore" type="number" min="1" max="10" value="7"></label><label class="field wide"><span>Good Stuff</span><textarea id="rGood" placeholder="What went well?"></textarea></label><label class="field wide"><span>Needs More Work</span><textarea id="rBad" placeholder="What needs work?"></textarea></label></div><div class="modal-actions"><button class="button ghost" data-close>Cancel</button><button class="button primary" id="saveReset">Save Reset</button></div>`);
    $('saveReset').onclick=async()=>{
      const score=Number($('rScore').value);if(score<1||score>10){toast('Score must be 1–10');return}
      const row={id:uid(),employee_id:employeeId,track,room,reset_at:$('rDate').value,observed_by:$('rBy').value.trim(),reset_time:$('rTime').value.trim(),good_stuff:$('rGood').value.trim(),needs_work:$('rBad').value.trim(),score,created_at:new Date().toISOString()};
      state.resets.push(row);if(state.remote){const {error}=await state.supabase.from('training_resets').insert({workspace:WORKSPACE,...row});if(error)throw error}else saveLocal();closeModal();render();toast('Reset saved');
    };
  }

  function openQuizModal(employeeId,track,room,quizId){
    const e=employeeById(employeeId);const q=CATALOG.quizMap.get(quizId);const status=quizStatus(employeeId,quizId);
    showModal(`<h3>${esc(q?.label||'Quiz')}</h3><p class="modal-sub">${esc(e?.name)}${status.tone==='fail'?' · Retake required':''}</p><div class="form-grid"><label class="field"><span>Date Taken</span><input id="qDate" type="date" value="${today()}"></label><label class="field"><span>Who Was With Them?</span><input id="qBy" placeholder="TM / trainer"></label><div class="field wide quiz-submit-note"><span>Grading</span><p>This only marks the quiz as taken and submitted. TJ can grade it Pass / Fail later.</p></div></div><div class="modal-actions"><button class="button ghost" data-close>Cancel</button><button class="button primary" id="saveQuiz">Submit Quiz Taken</button></div>`);
    $('saveQuiz').onclick=async()=>{
      const row={id:uid(),employee_id:employeeId,track,room:room||'',quiz_id:quizId,quiz_label:q?.label||quizId,taken_at:$('qDate').value,observed_by:$('qBy').value.trim(),result:null,graded_at:null,created_at:new Date().toISOString()};
      state.quizzes.push(row);
      if(state.remote){
        const {error}=await state.supabase.from('training_quiz_attempts').insert({workspace:WORKSPACE,...row});
        if(error)throw error;
      }else saveLocal();
      closeModal();render();toast('Quiz submitted · awaiting grade');
    };
  }

  function openGradeQuizModal(attemptId){
    const attempt=state.quizzes.find(x=>x.id===attemptId);if(!attempt)return;
    const e=employeeById(attempt.employee_id);
    showModal(`<h3>Grade ${esc(attempt.quiz_label||'Quiz')}</h3><p class="modal-sub">${esc(e?.name||attempt.employee_id)} · Taken ${esc(attempt.taken_at||'No date')} · With ${esc(attempt.observed_by||'Not entered')}</p><div class="form-grid"><label class="field wide"><span>Result</span><select id="gradeResult"><option value="pass">Pass</option><option value="fail">Fail</option></select></label></div><div class="modal-actions"><button class="button ghost" data-close>Cancel</button><button class="button primary" id="saveGrade">Save Grade</button></div>`);
    $('saveGrade').onclick=async()=>{
      const result=$('gradeResult').value;
      attempt.result=result;attempt.graded_at=today();
      if(state.remote){
        const {error}=await state.supabase.from('training_quiz_attempts').update({result,graded_at:attempt.graded_at}).eq('workspace',WORKSPACE).eq('id',attempt.id);
        if(error)throw error;
      }else saveLocal();
      closeModal();render();toast(result==='pass'?'Quiz passed':'Failed · retake required');
    };
  }

  async function deleteRecord(table,stateKey,id){
    if(!confirm('Delete this record?'))return;state[stateKey]=state[stateKey].filter(x=>x.id!==id);
    if(state.remote){const {error}=await state.supabase.from(table).delete().eq('workspace',WORKSPACE).eq('id',id);if(error)throw error}else saveLocal();render();
  }

  function renderLogs(){
    const logs=[...state.logs].sort((a,b)=>String(b.training_date||'').localeCompare(String(a.training_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
    $('logsView').innerHTML=`<div class="section-head"><div><h3>Training Updates</h3><p>Trainer handoffs whenever training happens.</p></div><button class="button primary small" id="addLogBtn">+ Update</button></div>${logs.length?`<div class="journal-list full-journal">${logs.map(log=>`<article class="journal-card"><div class="journal-card-head"><div><strong>${esc(log.training_date||'')}</strong><span>${esc(employeeById(log.employee_id)?.name||log.employee_id)} · ${esc(log.track||'Training')}</span></div><div class="journal-card-actions"><span class="journal-trainer">Trainer: ${esc(log.trainer||'Not entered')}</span><button class="record-delete" data-delete-log="${esc(log.id)}">×</button></div></div><div class="journal-grid"><div class="journal-field trained"><span>Trained On</span><p>${esc(log.trained_on||log.activity||'Not entered')}</p></div><div class="journal-field good"><span>Went Well</span><p>${esc(log.went_well||'No note')}</p></div><div class="journal-field focus"><span>Needs More Work</span><p>${esc(log.needs_work||'No note')}</p></div></div></article>`).join('')}</div>`:'<div class="empty">No training updates yet.</div>'}`;
    $('addLogBtn').onclick=()=>openLogModal();$('logsView').querySelectorAll('[data-delete-log]').forEach(b=>b.onclick=()=>deleteLog(b.dataset.deleteLog));
  }

  function roleQuizOptions(roleId){
    return allQuizDefsForRole(roleId).map(q=>({id:q.id,label:q.label,room:q.room||'',track:roleId}));
  }
  function updateQuizPicker(roleId){
    const holder=$('updateQuizPicker');if(!holder)return;
    const quizzes=roleQuizOptions(roleId);
    holder.innerHTML=quizzes.length
      ? `<div class="update-quiz-grid">${quizzes.map(q=>`<label class="update-quiz-check"><input type="checkbox" data-update-quiz="${esc(q.id)}" data-update-room="${esc(q.room||'')}"><span></span><strong>${esc(q.label)}</strong></label>`).join('')}</div>`
      : '<div class="mini-empty">No quizzes in this training area.</div>';
  }
  function openLogModal(employeeId=''){
    const staff=sortedEmployees();const selected=employeeId||state.selectedEmployee||staff[0]?.id||'';
    const defaultRole=state.selectedRole&&roleById(state.selectedRole)?state.selectedRole:'rh1';
    showModal(`<h3>Add Training Update</h3><p class="modal-sub">Use this whenever training happens. You can also submit quizzes from here for TJ to grade later.</p><div class="form-grid"><label class="field"><span>Employee</span><select id="lEmployee">${staff.map(e=>`<option value="${esc(e.id)}" ${e.id===selected?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label><label class="field"><span>Training Area</span><select id="lTrack">${CATALOG.roles.map(t=>`<option value="${esc(t.id)}" ${t.id===defaultRole?'selected':''}>${esc(t.label)}</option>`).join('')}</select></label><label class="field"><span>Date</span><input id="lDate" type="date" value="${today()}"></label><label class="field"><span>Trainer</span><input id="lTrainer" placeholder="Who trained / observed?"></label><div class="field wide"><span>Quizzes Taken / Submitted</span><div id="updateQuizPicker"></div></div><label class="field wide"><span>What We Trained On</span><textarea id="lTrainedOn" placeholder="A8 reset, ESP intro, Clueby..."></textarea></label><label class="field wide"><span>What Went Well</span><textarea id="lWentWell"></textarea></label><label class="field wide"><span>Needs More Work</span><textarea id="lNeedsWork"></textarea></label></div><div class="modal-actions"><button class="button ghost" data-close>Cancel</button><button class="button primary" id="saveLog">Save Update</button></div>`);
    updateQuizPicker(defaultRole);
    $('lTrack').onchange=()=>updateQuizPicker($('lTrack').value);

    $('saveLog').onclick=async()=>{
      const employee_id=$('lEmployee').value;
      const roleId=$('lTrack').value;
      const role=roleById(roleId);
      const trainer=$('lTrainer').value.trim();
      const date=$('lDate').value;
      const selectedQuizzes=[...$('updateQuizPicker').querySelectorAll('[data-update-quiz]:checked')].map(box=>({
        id:box.dataset.updateQuiz,
        room:box.dataset.updateRoom||''
      }));
      const trained_on=$('lTrainedOn').value.trim();
      const went_well=$('lWentWell').value.trim();
      const needs_work=$('lNeedsWork').value.trim();

      if(!trained_on && !went_well && !needs_work && !selectedQuizzes.length){
        toast('Add a training note or mark a quiz as taken');
        return;
      }

      const quizLabels=selectedQuizzes.map(x=>CATALOG.quizMap.get(x.id)?.label||x.id);
      const effectiveTrainedOn=trained_on || (quizLabels.length?`Quizzes submitted: ${quizLabels.join(', ')}`:'Training update');

      const row={id:uid(),employee_id,track:role?.label||roleId,activity:effectiveTrainedOn,trained_on:effectiveTrainedOn,went_well,needs_work,training_date:date,trainer,notes:'',created_at:new Date().toISOString()};

      const quizRows=selectedQuizzes.map(x=>{
        const q=CATALOG.quizMap.get(x.id);
        return {
          id:uid(),employee_id,track:roleId,room:x.room||'',quiz_id:x.id,quiz_label:q?.label||x.id,
          taken_at:date,observed_by:trainer,result:null,graded_at:null,created_at:new Date().toISOString()
        };
      });

      state.logs.unshift(row);
      state.quizzes.push(...quizRows);

      if(state.remote){
        const logResult=await state.supabase.from('training_logs').insert({workspace:WORKSPACE,...row});
        if(logResult.error)throw logResult.error;
        if(quizRows.length){
          const quizResult=await state.supabase.from('training_quiz_attempts').insert(quizRows.map(q=>({workspace:WORKSPACE,...q})));
          if(quizResult.error)throw quizResult.error;
        }
      }else saveLocal();

      closeModal();render();
      toast(quizRows.length?`Update saved · ${quizRows.length} quiz${quizRows.length===1?'':'zes'} awaiting grade`:'Update saved');
    };
  }
  async function deleteLog(id){if(!confirm('Delete this update?'))return;state.logs=state.logs.filter(x=>x.id!==id);if(state.remote){const {error}=await state.supabase.from('training_logs').delete().eq('workspace',WORKSPACE).eq('id',id);if(error)throw error}else saveLocal();render()}

  function renderSetup(){
    const live=state.remote;
    $('setupView').innerHTML=`<div class="setup-grid"><div class="panel"><span class="tag">${live?'LIVE':'LOCAL'}</span><h3>Shared Sync</h3><p>${live?'Supabase is connected. Changes sync across devices.':'Add the Supabase project URL and anon key in config.js to turn on shared syncing.'}</p><div class="code">workspace: ${esc(WORKSPACE)}\nsupabaseUrl: ${CONFIG.supabaseUrl?'configured':'not configured'}\nsupabaseAnonKey: ${CONFIG.supabaseAnonKey?'configured':'not configured'}</div></div><div class="panel"><span class="tag">GitHub Pages</span><h3>Publishing</h3><p>Upload this folder to GitHub Pages. GitHub hosts the app; Supabase stores the changing training records.</p></div><div class="panel"><span class="tag">Database</span><h3>v1.3 Schema</h3><p>Run the included supabase-schema.sql again. Run the included supabase-schema.sql again. It lets TMs submit quizzes before grading and keeps all existing observations, resets, attempts, and updates.</p></div><div class="panel"><span class="tag">Backup</span><h3>Portable Data</h3><p>Export the currently loaded training file as JSON whenever you want a snapshot.</p><button class="button small" id="setupExport">Export Backup</button></div></div>`;
    $('setupExport').onclick=exportBackup;
  }

  function openAddEmployee(){
    showModal(`<h3>Add Staff Member</h3><p class="modal-sub">They start with a blank training file.</p><div class="form-grid"><label class="field wide"><span>Name</span><input id="newEmployeeName" placeholder="First and last name"></label></div><div class="modal-actions"><button class="button ghost" data-close>Cancel</button><button class="button primary" id="saveEmployee">Add Staff</button></div>`);
    $('saveEmployee').onclick=async()=>{const name=$('newEmployeeName').value.trim();if(!name)return;const row={id:`staff-${Date.now()}`,name,active:true,display_order:sortedEmployees(true).length+1};state.employees.push(row);if(state.remote){const {error}=await state.supabase.from('training_employees').insert({workspace:WORKSPACE,...row});if(error)throw error}else saveLocal();closeModal();render();toast('Staff member added')};
  }
  async function moveEmployee(id,dir){
    const list=sortedEmployees();const i=list.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];list.forEach((e,k)=>e.display_order=k+1);state.employees.forEach(e=>{const x=list.find(y=>y.id===e.id);if(x)e.display_order=x.display_order});
    if(state.remote){const rows=list.map(e=>({workspace:WORKSPACE,id:e.id,name:e.name,active:e.active,display_order:e.display_order}));const {error}=await state.supabase.from('training_employees').upsert(rows,{onConflict:'workspace,id'});if(error)throw error}else saveLocal();render();
  }
  async function removeEmployee(id){
    const e=employeeById(id);if(!e||!confirm(`Remove ${e.name} from the active staff list? Their training history will be kept.`))return;e.active=false;
    if(state.remote){const {error}=await state.supabase.from('training_employees').update({active:false}).eq('workspace',WORKSPACE).eq('id',id);if(error)throw error}else saveLocal();
    if(state.selectedEmployee===id)state.selectedEmployee=null;render();toast('Staff member removed');
  }
  async function restoreEmployee(id){const e=employeeById(id);if(!e)return;e.active=true;if(state.remote){const {error}=await state.supabase.from('training_employees').update({active:true}).eq('workspace',WORKSPACE).eq('id',id);if(error)throw error}else saveLocal();render();toast('Staff member restored')}

  function exportBackup(){
    const data={exported_at:new Date().toISOString(),workspace:WORKSPACE,employees:state.employees,progress:Object.values(state.progress),observations:state.observations,resets:state.resets,quiz_attempts:state.quizzes,logs:state.logs};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Florence-Training-Backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
  }

  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;if(state.view!=='staff')state.selectedEmployee=null;render()});
  $('quickLogBtn').onclick=()=>openLogModal();$('exportBtn').onclick=exportBackup;$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal()};
  initData();
})();
