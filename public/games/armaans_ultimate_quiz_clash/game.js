'use strict';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const COSTS = {bronze:10,silver:25,gold:50,myth:100};
const NAMES = {bronze:'Bronze',silver:'Silver',gold:'Gold',myth:'Ultra Mythical'};
const all = Object.entries(players).flatMap(([rarity,list])=>list.map(p=>({rarity,name:p[0],rating:p[1],position:p[2],nation:p[3],club:p[4],image:p[5]})));
const byName = name => all.find(p=>p.name===name);
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readStore(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
let state = readStore('armaanQuizClash',{coins:0,owned:[],squad:[]});
if(!state||typeof state!=='object')state={};
state.coins=Number.isFinite(state.coins)?Math.max(0,Math.floor(state.coins)):0;
state.owned=Array.isArray(state.owned)?state.owned.filter(n=>typeof n==='string'):[];
const oldSquad=Array.isArray(state.squad)?state.squad:[];
const seen=new Set();
state.squad=Array.from({length:11},(_,i)=>{const name=oldSquad[i];if(!byName(name)||!state.owned.includes(name)||seen.has(name))return null;seen.add(name);return name});
state.formation=['433','442','352'].includes(String(state.formation))?String(state.formation):'433';
function save(){try{localStorage.setItem('armaanQuizClash',JSON.stringify(state))}catch{toast('Your browser could not save progress. Download a backup from the Sticker Book.')}$('#coins').textContent=state.coins}
const copies=name=>state.owned.filter(n=>n===name).length;
function saleValue(p){
  if(p.rarity==='bronze')return p.rating>=79?12:5;
  if(p.rarity==='silver')return p.rating>=84?30:18;
  if(p.rarity==='gold')return p.rating>=89?65:28;
  return p.rating>=92?140:65;
}
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
save();

// Audio is unlocked by a real click, then scheduled after resume completes.
let audioContext,master;
let soundOn=readStore('armaanQuizSound',true)!==false;
let musicWanted=false;
const music=$('#backgroundMusic');
const preferences=readStore('armaanAudioLevels',{music:22,effects:75});
$('#musicVolume').value=Number.isFinite(preferences.music)?preferences.music:22;
$('#effectsVolume').value=Number.isFinite(preferences.effects)?preferences.effects:75;
const musicLevel=()=>Number($('#musicVolume').value)/100;
music.volume=musicLevel();
function syncSound(){const button=$('#soundToggle');button.textContent=soundOn?'Effects on':'Effects off';button.setAttribute('aria-pressed',String(soundOn))}
syncSound();
async function audioReady(){
  if(!soundOn)return null;
  try{
    const Constructor=window.AudioContext||window.webkitAudioContext;
    if(!Constructor)throw Error('Audio is unavailable');
    if(!audioContext){audioContext=new Constructor();master=audioContext.createGain();master.connect(audioContext.destination)}
    if(audioContext.state==='suspended')await audioContext.resume();
    master.gain.value=Number($('#effectsVolume').value)/100;
    return audioContext.state==='running'?audioContext:null;
  }catch{$('#audioStatus').textContent='Effects could not start. Try Test effects again.';return null}
}
function note(ctx,freq,offset,duration=.18,type='triangle',volume=.18,endFreq=freq){
  const t=ctx.currentTime+offset,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);
  g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+duration);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.02);
}
function noise(ctx,offset,duration,volume,highpass=700){
  const frames=Math.ceil(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,frames,ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1)*(1-i/frames);
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),t=ctx.currentTime+offset;
  source.buffer=buffer;filter.type='highpass';filter.frequency.value=highpass;gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.01);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  source.connect(filter);filter.connect(gain);gain.connect(master);source.start(t);source.stop(t+duration+.02);
}
function applause(ctx,offset=0,amount=7){for(let i=0;i<amount;i++)noise(ctx,offset+i*.095+(i%3)*.015,.075,.11,900)}
function crowdCheer(ctx,offset=0,duration=.9){
  [155,180,205,235,270].forEach((freq,i)=>note(ctx,freq,offset+i*.018,duration,'sawtooth',.027,freq*1.16));
  noise(ctx,offset,duration,.075,350);
}
function crowdChant(ctx,offset=0){
  [196,247,294,247,196,247,330].forEach((freq,i)=>note(ctx,freq,offset+i*.19,.22,'triangle',.075));
  applause(ctx,offset+.1,10);
}
async function effect(kind){
  const ctx=await audioReady();if(!ctx)return;
  if(kind==='correct'||kind==='win'||kind==='test'){
    [523,659,784,1047].forEach((f,i)=>note(ctx,f,i*.13,.26,'triangle',.21));
    applause(ctx,.12,kind==='win'?10:6);crowdCheer(ctx,.32,kind==='win'?1.3:.72);
    if(kind==='win')crowdChant(ctx,.55);
  }
  else if(kind==='wrong'){note(ctx,220,0,.3,'triangle',.2,120)}
  else if(kind==='coin'){[1000,1500,1800].forEach((f,i)=>note(ctx,f,i*.07,.18,'sine',.19))}
  else if(kind==='pack'){
    for(let i=0;i<12;i++){note(ctx,80+i*12,i*.4,.2,'sine',.27);note(ctx,220+i*35,i*.4,.28,'triangle',.09)}
    note(ctx,120,4.8,1,'sawtooth',.09,900);
  }else if(kind==='reveal'){[261,329,392,523,659].forEach((f,i)=>note(ctx,f,i*.05,.8,'triangle',.13))}
}
$('#testSound').onclick=async()=>{soundOn=true;try{localStorage.setItem('armaanQuizSound','true')}catch{}syncSound();await effect('test');$('#audioStatus').textContent=audioContext?.state==='running'?'Test chime played. If it is silent, check the tab and device volume.':'Audio could not start in this browser.'};
$('#soundToggle').onclick=()=>{soundOn=!soundOn;try{localStorage.setItem('armaanQuizSound',JSON.stringify(soundOn))}catch{}if(master)master.gain.value=soundOn?Number($('#effectsVolume').value)/100:0;syncSound();if(soundOn)effect('test')};
function musicButton(){const playing=!music.paused;$('#musicToggle').textContent=playing?'Ⅱ Pause music':'▶ Start music';$('#musicToggle').setAttribute('aria-pressed',String(playing))}
$('#musicToggle').onclick=async()=>{if(!music.paused){music.pause();musicWanted=false;return}try{await music.play();musicWanted=true;$('#audioStatus').textContent='Background music is playing.'}catch{$('#audioStatus').textContent='Music could not start. Keep the assets/audio folder alongside the game.'}musicButton()};
music.addEventListener('play',musicButton);music.addEventListener('pause',musicButton);
music.addEventListener('error',()=>{$('#audioStatus').textContent='The music file could not load. Check assets/audio/background-music.mp3.';musicButton()});
for(const id of ['musicVolume','effectsVolume'])$('#'+id).oninput=()=>{music.volume=musicLevel();if(master)master.gain.value=soundOn?Number($('#effectsVolume').value)/100:0;try{localStorage.setItem('armaanAudioLevels',JSON.stringify({music:Number($('#musicVolume').value),effects:Number($('#effectsVolume').value)}))}catch{}};

// A single modal manages focus, closing and pending pack timers.
let modalReturnFocus,packPending=null;
let timers=[];
function clearTimers(){timers.forEach(clearTimeout);timers=[]}
function closeModal(){
  if(packPending){revealPack();return}
  clearTimers();$('#modal').hidden=true;$('#modal').className='modal';document.body.style.overflow='';music.volume=musicLevel();
  if(modalReturnFocus?.isConnected)modalReturnFocus.focus();
}
function modal(title,body,kicker='',actions=[]){
  clearTimers();packPending=null;if($('#modal').hidden)modalReturnFocus=document.activeElement;
  $('#modal').className='modal';$('#modal').hidden=false;document.body.style.overflow='hidden';
  $('#modalTitle').textContent=title;$('#modalKicker').textContent=kicker;$('#modalBody').innerHTML=body;
  $('#modalClose').hidden=false;$('#modalActions').replaceChildren();
  for(const action of actions){const button=document.createElement('button');button.className=action.secondary?'secondary':'primary';button.textContent=action.label;button.onclick=action.run;$('#modalActions').append(button)}
  $('.dialog').focus();
}
$('#modalClose').onclick=closeModal;
$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal()};
document.addEventListener('keydown',e=>{
  if($('#modal').hidden)return;
  if(e.key==='Escape'){e.preventDefault();closeModal()}
  if(e.key==='Tab'){
    const focusable=[...$('.dialog').querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&!el.hidden);
    if(!focusable.length){e.preventDefault();return}
    const first=focusable[0],last=focusable.at(-1);
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('.dialog'))){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===$('.dialog'))){e.preventDefault();first.focus()}
  }
});

let screen='home',subject='maths',difficulty='rookie',match=null,pendingPlayer=null,botRevealTimer=null;
function cancelBotReveal(){if(botRevealTimer){clearTimeout(botRevealTimer);botRevealTimer=null}}
function show(id){
  if(!['home','game','daily','shop','book','squad'].includes(id))id='home';
  screen=id;
  $$('.screen').forEach(el=>el.classList.toggle('active',el.id===id));
  $$('.tab').forEach(el=>{const active=el.dataset.go===id||(id==='game'&&el.dataset.go==='home');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
  if(id==='book')renderBook();if(id==='squad')renderSquad();if(id==='daily')renderDaily();
}
$$('.tab').forEach(b=>b.onclick=()=>{if(b.dataset.go==='home'&&match&&!match.finished)show('game');else show(b.dataset.go)});
$('.brand').onclick=e=>{e.preventDefault();show('home')};
for(const [selector,key] of [['.subject','subject'],['.difficulty','diff']]){
  $$(selector).forEach(button=>button.onclick=()=>{if(key==='subject')subject=button.dataset[key];else difficulty=button.dataset[key];$$(selector).forEach(b=>{const on=b===button;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))})});
}
function shuffled(list){const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
function prepareQuestion(item){
  const options=shuffled(item[1].map((text,i)=>({text,correct:i===item[2]})));
  return {text:item[0],options,written:item[3]==='written'||/written|work this out|calculate 1,204/i.test(item[0])};
}
function selectQuestions(){
  const bank=subject==='maths'?maths:english;
  const history=Array.isArray(state.recentQuestions)?state.recentQuestions:[];
  const fresh=bank.filter(q=>!history.includes(q[0]));
  const pool=fresh.length>=5?fresh:bank;
  let selection;
  if(subject==='maths'){
    const written=shuffled(pool.filter(q=>q[3]==='written'||/written|work this out/i.test(q[0])));
    const mental=shuffled(pool.filter(q=>!written.includes(q)));
    selection=shuffled([...mental.slice(0,4),...(written.length?[written[0]]:mental.slice(4,5))]);
  }else selection=shuffled(pool).slice(0,5);
  state.recentQuestions=[...history,...selection.map(q=>q[0])].slice(-40);save();
  return selection.map(prepareQuestion);
}
$('#start').onclick=()=>{
  const begin=()=>{cancelBotReveal();closeModal();match={questions:selectQuestions(),subject,difficulty,index:0,you:0,bot:0,answered:false,finished:false,botThinking:false};show('game');renderQuestion();effect('coin')};
  if(match&&!match.finished)modal('Start a new match?','<p>Your current match will end without a reward.</p>','MATCH IN PROGRESS',[{label:'Continue match',run:()=>{closeModal();show('game')}},{label:'New match',secondary:true,run:begin}]);else begin();
};
function renderQuestion(){
  cancelBotReveal();
  const q=match.questions[match.index];match.answered=false;
  $('#youScore').textContent=match.you;$('#botScore').textContent=match.bot;$('#botName').textContent=match.difficulty.toUpperCase()+' BOT';
  $('#round').textContent='QUESTION '+(match.index+1)+' OF 5';$('#topic').textContent=match.subject==='maths'?(q.written?'WRITTEN MATHS':'MENTAL MATHS'):'ENGLISH';
  $('#questionProgress').style.width=((match.index+1)*20)+'%';$('#question').textContent=q.text;
  $('#working').hidden=match.subject!=='maths';$('#working').open=q.written;$('#workingText').value='';
  $('#feedback').textContent='';$('#next').hidden=true;$('#answers').replaceChildren();
  q.options.forEach((option,i)=>{const b=document.createElement('button');b.className='answer';b.textContent=option.text;b.onclick=()=>answerQuestion(i);$('#answers').append(b)});
}
function answerQuestion(index){
  if(!match||match.answered||match.finished)return;
  match.answered=true;const q=match.questions[match.index],right=q.options[index].correct;
  [...$('#answers').children].forEach((b,i)=>{b.disabled=true;if(i===index)b.classList.add(right?'right':'wrong')});
  if(right)match.you++;
  const botRight=Math.random()<{rookie:.2,pro:.5,legend:.78}[match.difficulty];
  const botIndex=botRight?q.options.findIndex(o=>o.correct):shuffled(q.options.map((o,i)=>o.correct?null:i).filter(i=>i!==null))[0];
  const currentMatch=match,currentRound=match.index;
  match.botThinking=true;
  $('#youScore').textContent=match.you;$('#botName').textContent=match.difficulty.toUpperCase()+' BOT • THINKING…';
  $('#feedback').textContent=right?'Goal! Correct answer. Now watch the bot choose…':'Not quite. The bot is choosing an answer…';
  effect(right?'correct':'wrong');
  botRevealTimer=setTimeout(()=>{
    if(match!==currentMatch||match.index!==currentRound||match.finished)return;
    botRevealTimer=null;match.botThinking=false;
    const buttons=[...$('#answers').children];buttons[botIndex]?.classList.add('bot-pick');
    buttons.forEach((b,i)=>{if(q.options[i].correct)b.classList.add('right');else if(i===botIndex)b.classList.add('wrong')});
    if(botRight)match.bot++;
    $('#botScore').textContent=match.bot;$('#botName').textContent=match.difficulty.toUpperCase()+' BOT';
    $('#feedback').textContent=(right?'You got it right.':'The correct answer is '+q.options.find(o=>o.correct).text+'.')+' The bot chose '+q.options[botIndex].text+(botRight?' — correct!':' — missed!');
    $('#next').hidden=false;$('#next').textContent=match.index===4?'See result →':'Next question →';
  },900);
}
$('#next').onclick=()=>{if(!match?.answered||match.finished||match.botThinking)return;if(match.index<4){match.index++;renderQuestion()}else finishMatch()};
function finishMatch(){
  if(match.finished)return;match.finished=true;
  const won=match.you>match.bot,draw=match.you===match.bot,reward=won?{rookie:20,pro:40,legend:70}[match.difficulty]:draw?10:0;
  state.coins+=reward;save();effect(won?'win':draw?'coin':'wrong');
  modal(won?'What a win!':draw?'Honours even.':'Keep training!',
    '<p class="result-score">'+match.you+' – '+match.bot+'</p><p>'+(reward?'You earned '+reward+' coins.':'No coins this time. Try another match!')+'</p>',
    won?'FULL TIME / VICTORY':'FULL TIME',
    [{label:'Visit pack shop',run:()=>{closeModal();show('shop')}},{label:'Play again',secondary:true,run:()=>{closeModal();show('home')}}]);
}
function todayKey(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function dailyQuestion(){const key=todayKey();let hash=0;for(const c of key)hash=(hash*31+c.charCodeAt(0))>>>0;return [...maths,...english][hash%(maths.length+english.length)]}
function renderDaily(){
  const date=todayKey(),claimed=state.dailyChallenge===date,attempted=state.dailyAttempt===date||claimed,item=dailyQuestion();
  $('#dailyStatus').textContent=claimed?'100 coins collected':attempted?'Attempt complete • new question tomorrow':'Reward: 100 coins';
  $('#dailyQuestion').textContent=item[0];$('#dailyAnswers').replaceChildren();$('#dailyFeedback').textContent=attempted?(claimed?'Great work. Come back tomorrow!':'Today’s answer: '+item[1][item[2]]+'. Try again tomorrow.'):date+' • One attempt on this device.';
  if(attempted)return;
  const q=prepareQuestion(item);
  q.options.forEach(option=>{const b=document.createElement('button');b.className='answer';b.textContent=option.text;b.onclick=()=>{
    if(state.dailyAttempt===todayKey()||state.dailyChallenge===todayKey())return;
    if(date!==todayKey()){renderDaily();return}
    state.dailyAttempt=date;
    if(option.correct){state.dailyChallenge=date;state.coins+=100;effect('win');toast('+100 daily challenge coins!')}else effect('wrong');
    save();renderDaily();
  };$('#dailyAnswers').append(b)});
}

// Cards, pack odds and transfer values share one source of truth.
function card(p){
  return '<div class="card '+p.rarity+'"><div class="portrait"><img src="'+A+p.image+'" alt="'+esc(p.name)+'" loading="lazy" draggable="false"></div><div class="rating">'+p.rating+'</div><div class="position">'+p.position+'</div><div class="pname">'+esc(p.name)+'<span class="club">'+esc(p.club)+'</span></div><div class="rarity-label">'+NAMES[p.rarity].toUpperCase()+'</div></div>';
}
function playerStats(p){
  const profiles={ST:[88,91,75,83,39,88],RW:[91,85,82,91,43,73],CAM:[78,85,92,88,60,74],CM:[76,74,88,84,75,79],CDM:[74,65,84,78,89,86],CB:[72,40,68,63,91,90],RB:[86,56,78,79,81,79],LWB:[88,61,78,81,75,78]};
  const base=profiles[p.position]||profiles.CM,delta=p.rating-86;
  return ['Pace','Shooting','Passing','Dribbling','Defending','Physical'].map((label,i)=>[label,Math.min(99,Math.max(30,base[i]+delta))]);
}
function showPlayer(p){
  const slot=state.squad.indexOf(p.name);
  modal(p.name,'<div class="stat-layout">'+card(p)+'<div><div class="stat-grid">'+playerStats(p).map(([label,value])=>'<div class="stat"><small>'+label+'</small><b>'+value+'</b><div class="stat-line"><i style="width:'+value+'%"></i></div></div>').join('')+'</div><p class="muted">'+esc(p.nation)+' • '+p.position+'<br>Custom game stats • '+copies(p.name)+' owned</p></div></div>','PLAYER DETAILS',[
    {label:slot>=0?'Replace player':'Place in squad',run:()=>{if(slot>=0)pickForSlot(slot);else{pendingPlayer=p.name;closeModal();show('squad');toast('Tap a position for '+p.name)}}},
    ...(slot>=0?[{label:'Remove from lineup',secondary:true,run:()=>{state.squad[slot]=null;save();closeModal();renderSquad()}}]:[]),
    {label:'Sell one • '+saleValue(p)+' coins',secondary:true,run:()=>confirmSale(p)}
  ]);
}
function renderBook(){
  const owned=all.filter(p=>copies(p.name)>0),total=owned.reduce((sum,p)=>sum+copies(p.name),0);
  $('#collection').textContent=owned.length+' / '+all.length+' players • '+total+' cards • '+(total-owned.length)+' duplicates';
  const search=$('#bookSearch').value.toLowerCase().trim(),filter=$('#bookFilter').value,rarity=$('#rarityFilter').value;
  const list=all.filter(p=>(p.name+' '+p.club).toLowerCase().includes(search)&&(rarity==='all'||p.rarity===rarity)&&(filter==='all'||(filter==='owned'?copies(p.name)>0:copies(p.name)>1)));
  $('#stickers').innerHTML=list.map(p=>{
    const count=copies(p.name),profit=saleValue(p)>COSTS[p.rarity];
    return '<div class="sticker-slot">'+(count?
      '<button class="card-button" data-player="'+esc(p.name)+'" aria-label="View '+esc(p.name)+' stats">'+card(p)+'<span class="card-count">×'+count+'</span></button><div class="slot-actions"><button class="secondary" data-add="'+esc(p.name)+'">'+(state.squad.includes(p.name)?'✓ In Starting 11':'Add to squad')+'</button><button class="secondary" data-sell="'+esc(p.name)+'">Sell one • '+saleValue(p)+' coins</button></div>'+(profit?'<span class="profit-label">Worth more than its pack price</span>':''):
      '<div class="card locked" aria-label="Mystery '+NAMES[p.rarity]+' player, not collected"><div class="lock-symbol">?</div><div class="pname">MYSTERY PLAYER<span class="club">'+NAMES[p.rarity]+' pack</span></div><div class="rarity-label">NOT COLLECTED</div></div>')+'</div>'
  }).join('')||'<p class="empty-state">No players match these filters.</p>';
}
for(const id of ['bookSearch','bookFilter','rarityFilter'])$('#'+id).addEventListener('input',renderBook);
$('#stickers').onclick=e=>{
  const p=e.target.closest('[data-player]');if(p){showPlayer(byName(p.dataset.player));return}
  const sell=e.target.closest('[data-sell]');if(sell){confirmSale(byName(sell.dataset.sell));return}
  const add=e.target.closest('[data-add]');if(add){pendingPlayer=add.dataset.add;show('squad');toast('Tap the position for '+pendingPlayer)}
};
function confirmSale(p){
  if(!p||!copies(p.name))return;
  const last=copies(p.name)===1,assigned=state.squad.includes(p.name);
  modal('Sell '+p.name+'?', '<p>You will receive <strong>'+saleValue(p)+' coins</strong> for one copy.</p><p class="muted">'+(last&&assigned?'This is your last copy, so the player will also leave your Starting 11.':'You will keep '+(copies(p.name)-1)+' copies.')+'</p>','TRANSFER OFFER',[
    {label:'Sell for '+saleValue(p)+' coins',run:()=>{if(!copies(p.name))return;state.owned.splice(state.owned.indexOf(p.name),1);state.coins+=saleValue(p);if(!copies(p.name))state.squad=state.squad.map(n=>n===p.name?null:n);save();closeModal();renderBook();renderSquad();effect('coin');toast('Sold '+p.name+' • +'+saleValue(p)+' coins')}},
    {label:'Keep player',secondary:true,run:closeModal}
  ]);
}
$('#oddsButton').onclick=()=>modal('Know your pack','<table class="odds-table"><thead><tr><th>Pack</th><th>Rarity</th><th>Each player</th></tr></thead><tbody>'+Object.keys(players).map(key=>'<tr><td>'+NAMES[key]+'</td><td>100% '+NAMES[key]+'</td><td>'+(100/players[key].length).toFixed(2)+'%</td></tr>').join('')+'</tbody></table><p class="muted">Every player within a pack is equally likely. Each opening is independent, so duplicates are possible. All coins are earned in the game.</p>','EXACT ODDS',[{label:'Back to shop',run:closeModal}]);
$$('[data-pack]').forEach(b=>b.onclick=()=>openPack(b.dataset.pack));
function openPack(type){
  if(packPending)return;
  if(state.coins<COSTS[type]){modal('A few more coins…','<p>You need '+(COSTS[type]-state.coins)+' more coins for a '+NAMES[type]+' pack.</p>','NOT ENOUGH COINS',[{label:'Play a match',run:()=>{closeModal();show('home')}},{label:'Back',secondary:true,run:closeModal}]);return}
  const pool=all.filter(p=>p.rarity===type),p=pool[Math.floor(Math.random()*pool.length)];
  const duplicate=copies(p.name)>0;state.coins-=COSTS[type];state.owned.push(p.name);save();
  modal('Your next signing…','<div class="spinning-pack '+type+'"><b>?</b><small>'+NAMES[type].toUpperCase()+'</small></div><p id="packHint" class="pack-hint">THE LIGHTS ARE COMING ON</p>','PACK OPENING',[{label:'Skip animation',secondary:true,run:revealPack}]);
  $('#modal').classList.add('pack-stage');packPending={p,duplicate};music.volume=musicLevel()*.22;
  effect('pack');
  timers.push(setTimeout(()=>{if($('#packHint'))$('#packHint').textContent=p.nation.toUpperCase()},2600));
  timers.push(setTimeout(()=>{if($('#packHint'))$('#packHint').textContent=p.position+' • '+p.club.toUpperCase()},4400));
  timers.push(setTimeout(revealPack,6000));
}
function revealPack(){
  if(!packPending)return;
  const {p,duplicate}=packPending;packPending=null;clearTimers();
  modal(p.rating>=90?'Ultra Mythical walkout!':'Meet your new signing.',
    '<div class="reveal-card">'+card(p)+'</div><p>'+(duplicate?'Duplicate! You now own '+copies(p.name)+' copies.':'A new player for your sticker book.')+'</p>',
    NAMES[p.rarity].toUpperCase(),[
      {label:duplicate?'Keep duplicate':'Keep player',run:()=>{closeModal();renderBook();toast(p.name+' saved to your book')}},
      {label:'Sell • '+saleValue(p)+' coins',secondary:true,run:()=>confirmSale(p)},
      {label:'View stats',secondary:true,run:()=>showPlayer(p)}
    ]);
  $('#modal').classList.add('pack-stage');music.volume=musicLevel()*.45;effect('reveal');
  const confetti=document.createElement('div');confetti.className='confetti';confetti.innerHTML=Array.from({length:35},(_,i)=>'<i style="--x:'+((i*29)%100)+'%;--d:'+(i%7)*.09+'s;--c:'+['#d1fa51','#ac8cff','#7bceff','#ffd876'][i%4]+'"></i>').join('');$('#modalBody').append(confetti);
  timers.push(setTimeout(()=>music.volume=musicLevel(),1800));
}

// A fixed array of 11 slots preserves gaps, position changes and drag swaps.
const formationRows={
  '433':[['GK'],['LB','CB','CB','RB'],['CM','CM','CM'],['LW','ST','RW']],
  '442':[['GK'],['LB','CB','CB','RB'],['LM','CM','CM','RM'],['ST','ST']],
  '352':[['GK'],['CB','CB','CB'],['LM','CM','CDM','CM','RM'],['ST','ST']]
};
function positions(){
  return formationRows[state.formation].flatMap((row,r)=>row.map((label,i)=>({label,x:row.length===1?50:12+i*76/(row.length-1),y:[86,63,40,17][r]})));
}
function miniPlayer(p){return '<img src="'+A+p.image+'" alt="" draggable="false"><strong>'+p.rating+'</strong><span class="mini-name">'+esc(p.name)+'</span>'}
function renderSquad(){
  const count=state.squad.filter(Boolean).length,average=count?Math.round(state.squad.reduce((sum,n)=>sum+(byName(n)?.rating||0),0)/count):0;
  $('#squadCount').textContent=count+' / 11 selected'+(count?' • Average rating '+average:'');
  $$('[data-formation]').forEach(b=>{b.classList.toggle('active',b.dataset.formation===state.formation);b.setAttribute('aria-pressed',String(b.dataset.formation===state.formation))});
  $('#squadHint').textContent=pendingPlayer?'Selected: '+pendingPlayer+'. Tap any position to place or swap this player.':'Click an empty position to choose a player. Drag to move or swap cards. Any player can fill a position.';
  $('#pitch').innerHTML=positions().map((pos,index)=>{
    const p=byName(state.squad[index]);
    return '<div class="squad-slot '+(p?'':'empty')+'" data-slot="'+index+'" style="left:'+pos.x+'%;top:'+pos.y+'%">'+(p?'<button class="mini-player" type="button" draggable="true" data-drag="'+esc(p.name)+'" data-field="'+index+'" aria-label="'+esc(p.name)+', '+pos.label+'. View or replace player.">'+miniPlayer(p)+'</button>':'<button class="empty-slot" data-empty="'+index+'" aria-label="Choose player for '+pos.label+'"><b>+</b><span>'+pos.label+'</span></button>')+'<span class="slot-label">'+pos.label+'</span></div>';
  }).join('');
  const reserves=all.filter(p=>copies(p.name)&&!state.squad.includes(p.name)).sort((a,b)=>b.rating-a.rating);
  $('#bench').innerHTML=reserves.map(p=>'<button class="bench-player '+(pendingPlayer===p.name?'selected':'')+'" draggable="true" data-drag="'+esc(p.name)+'" data-reserve="'+esc(p.name)+'"><img src="'+A+p.image+'" alt="" draggable="false"><span>'+esc(p.name)+'<small>'+p.rating+' OVR • '+p.position+'</small></span></button>').join('')||'<p class="muted">Open packs to add more players to your reserves.</p>';
}
function assignPlayer(slot,name){
  if(!Number.isInteger(slot)||slot<0||slot>10||!byName(name)||!copies(name))return;
  const from=state.squad.indexOf(name),replaced=state.squad[slot];
  if(from>=0)state.squad[from]=replaced||null;
  state.squad[slot]=name;pendingPlayer=null;save();renderSquad();toast(name+' placed in your lineup');
}
function pickForSlot(slot){
  const list=all.filter(p=>copies(p.name)).sort((a,b)=>Number(state.squad.includes(a.name))-Number(state.squad.includes(b.name))||b.rating-a.rating);
  modal('Choose your '+positions()[slot].label,
    '<div class="picker">'+(list.map(p=>'<button class="bench-player" data-pick="'+esc(p.name)+'"><img src="'+A+p.image+'" alt=""><span>'+esc(p.name)+'<small>'+p.rating+' OVR • '+p.position+(state.squad.includes(p.name)?' • moves from lineup':'')+'</small></span></button>').join('')||'<p class="muted">Your collection is empty. Win coins and open a pack first.</p>')+'</div>',
    'STARTING 11',[{label:'Cancel',secondary:true,run:closeModal}]);
  $$('#modalBody [data-pick]').forEach(b=>b.onclick=()=>{assignPlayer(slot,b.dataset.pick);closeModal()});
}
$$('[data-formation]').forEach(b=>b.onclick=()=>{state.formation=b.dataset.formation;save();renderSquad()});
let suppressClick=false;
$('#pitch').onclick=e=>{
  if(suppressClick)return;
  const slot=e.target.closest('[data-slot]');if(!slot)return;const index=Number(slot.dataset.slot);
  if(pendingPlayer){assignPlayer(index,pendingPlayer);return}
  if(state.squad[index])showPlayer(byName(state.squad[index]));else pickForSlot(index);
};
$('#bench').onclick=e=>{if(suppressClick)return;const b=e.target.closest('[data-reserve]');if(!b)return;pendingPlayer=pendingPlayer===b.dataset.reserve?null:b.dataset.reserve;renderSquad()};
$('#clearSquad').onclick=()=>modal('Clear your Starting 11?','<p>All players will return to your reserves. You keep every sticker.</p>','LINEUP',[{label:'Clear lineup',run:()=>{state.squad=Array(11).fill(null);pendingPlayer=null;save();closeModal();renderSquad()}},{label:'Cancel',secondary:true,run:closeModal}]);
let draggedName='';
for(const container of [$('#pitch'),$('#bench')]){
  container.addEventListener('dragstart',e=>{if(e.target.closest('[data-drag]'))e.preventDefault()});
  container.addEventListener('dragend',()=>{draggedName='';$$('.drag-over').forEach(el=>el.classList.remove('drag-over'))});
}
$('#pitch').ondragover=e=>{const target=e.target.closest('[data-slot]');if(!target)return;e.preventDefault();$$('.drag-over').forEach(el=>el.classList.remove('drag-over'));target.classList.add('drag-over')};
$('#pitch').ondrop=e=>{e.preventDefault();const slot=e.target.closest('[data-slot]');if(slot)assignPlayer(Number(slot.dataset.slot),draggedName||e.dataTransfer.getData('text/plain'));draggedName=''};
let touchDrag=null;
document.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;const source=e.target.closest('[data-drag]');if(!source)return;
  touchDrag={name:source.dataset.drag,x:e.clientX,y:e.clientY,id:e.pointerId,ghost:null};
});
document.addEventListener('pointermove',e=>{
  if(!touchDrag||e.pointerId!==touchDrag.id)return;
  if(!touchDrag.ghost&&Math.hypot(e.clientX-touchDrag.x,e.clientY-touchDrag.y)>12){touchDrag.ghost=document.createElement('div');touchDrag.ghost.className='drag-ghost';touchDrag.ghost.textContent=touchDrag.name;document.body.append(touchDrag.ghost)}
  if(touchDrag.ghost){e.preventDefault();touchDrag.ghost.style.left=(e.clientX+12)+'px';touchDrag.ghost.style.top=(e.clientY-20)+'px'}
},{passive:false});
document.addEventListener('pointerup',e=>{
  if(!touchDrag)return;
  if(touchDrag.ghost){const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');if(slot)assignPlayer(Number(slot.dataset.slot),touchDrag.name);touchDrag.ghost.remove();suppressClick=true;setTimeout(()=>suppressClick=false,200)}
  touchDrag=null;
});
document.addEventListener('pointercancel',()=>{touchDrag?.ghost?.remove();touchDrag=null});
$('#exportSave').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='armaan-progress-'+todayKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Progress backup downloaded')};
$('#reset').onclick=()=>modal('Reset this collection?','<p>This clears coins, cards and your lineup. Download a progress backup first if you want a copy.</p>','COLLECTION SETTINGS',[{label:'Cancel',run:closeModal},{label:'Reset collection',secondary:true,run:()=>{state={coins:0,owned:[],squad:Array(11).fill(null),formation:'433',dailyAttempt:state.dailyAttempt,dailyChallenge:state.dailyChallenge};pendingPlayer=null;save();closeModal();renderBook();toast('Collection reset')}}]);
show('home');
