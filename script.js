document.addEventListener('DOMContentLoaded', () => {

/* ------------------------------------------------- */
/* 1. AudioContext y carga de WAV en AudioBuffer     */
/* ------------------------------------------------- */
const audioCtx = new (window.AudioContext||window.webkitAudioContext)();

const buffers = {};              // {accent,pulse,sub}
Promise.all([
  fetch('accent.wav').then(r=>r.arrayBuffer()).then(b=>audioCtx.decodeAudioData(b)),
  fetch('pulse.wav' ).then(r=>r.arrayBuffer()).then(b=>audioCtx.decodeAudioData(b)),
  fetch('sub.wav'   ).then(r=>r.arrayBuffer()).then(b=>audioCtx.decodeAudioData(b))
]).then(([a,p,s])=>{
  buffers.accent = a; buffers.pulse = p; buffers.sub = s;
});

/* Utilidad para programar un golpe con precisión */
function play(type, when, gain=1){
  const src  = audioCtx.createBufferSource();
  const g    = audioCtx.createGain();
  src.buffer = buffers[type];
  src.connect(g); g.connect(audioCtx.destination);
  g.gain.value = gain;
  src.start(when);
}

/* ------------------------------------------------- */
/* 2. Estados del metrónomo                          */
/* ------------------------------------------------- */
let bpm = 100,
    denominator = 4,
    grouping = [4],
    accentPos = [0],
    mode = 'normal',
    beatCount = 0,
    claveCount = 0;

const clavePatterns = {
  '2_2_clave_3_2':[1,4,7,11,13],
  '2_2_clave_2_3':[3,5,9,12,15]
};

/* ------------------------------------------------- */
/* 3. Scheduler look-ahead                           */
/* ------------------------------------------------- */
let nextTickTime = 0;      // en segundos
const lookAheadMs    = 25; // intervalo del setInterval
const scheduleAhead  = 0.25; // cuánto audio se cola (0.25 s)

function scheduler(){
  /* programa golpes hasta 250 ms por delante */
  while(nextTickTime < audioCtx.currentTime + scheduleAhead){
    scheduleNote(nextTickTime);
    advanceTick();
  }
}

function scheduleNote(time){
  let isAccent=false;

  if(mode==='clave'){
    claveCount = (claveCount%16)+1;
    const m = document.querySelector('.meter-btn.active').dataset.meter;
    isAccent = clavePatterns[m].includes(claveCount);

    if(isAccent) play('pulse', time, 1);        // solo acentos con pulse.wav

  }else{
    isAccent = accentPos.includes(beatCount);
    play(isAccent?'accent':'pulse', time, isAccent?1:0.9);

    /* Subdivisiones */
    const base = (60/bpm)*(4/denominator);
    const eighth = base/2, tr1 = base/3, tr2 = 2*base/3;

    if(document.getElementById('sub-eighth-btn').classList.contains('active'))
      play('sub', time+eighth, 0.8);

    if(document.getElementById('sub-triplet-btn').classList.contains('active')){
      play('sub', time+tr1, 0.8);
      play('sub', time+tr2, 0.8);
    }
    if(document.getElementById('sub-swing-btn').classList.contains('active'))
      play('sub', time+tr2, 0.9);  // swing -> sub.wav
  }

  /* Visual / luz */
  flash(isAccent); moveLight(baseSecs());
}

function advanceTick(){
  beatCount = (beatCount+1)%grouping.reduce((a,b)=>a+b,0);
  nextTickTime += baseSecs();
}
function baseSecs(){
  if (mode === 'clave') {
    return (60 / bpm) / 4;        // 1/16 de nota → pulso de la clave
  }
  return (60 / bpm) * (4 / denominator);
}

/* ------------------------------------------------- */
/* 4. UI utilidades (flash / luz / needle / knob)    */
/* ------------------------------------------------- */
function flash(isAcc){
  const v=document.getElementById('visualizer');
  v.style.background=isAcc?'var(--secondary)':'#4caf50';
  setTimeout(()=>v.style.background='',80);
}
function moveLight(duration){
  const bar=document.querySelector('.light-bar');
  const light=document.querySelector('.light');
  const max=bar.clientWidth-light.clientWidth;
  const from=light.style.left==='0px'||!light.style.left?0:max;
  const to  =from===0?max:0;
  light.animate([{left:from+'px'},{left:to+'px'}],{duration:duration*1000,easing:'linear',fill:'forwards'});
}

/* Knob horizontal ----------------------------------*/
const needle = document.getElementById('needle');
const bpmLabel = document.getElementById('bpm-label');
const knobSVG = document.getElementById('knob');
function angle(v){ return -135+(v-40)*270/280; }
function updateNeedle(){ needle.style.transform=`rotate(${angle(bpm)}deg)`; bpmLabel.textContent=bpm; }
updateNeedle();

let dragging=false,startX=0,startBpm=100;
knobSVG.addEventListener('pointerdown',e=>{
  dragging=true;startX=e.clientX;startBpm=bpm;knobSVG.setPointerCapture(e.pointerId);
});
knobSVG.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const dx=e.clientX-startX;
  bpm=Math.min(320,Math.max(40,Math.round(startBpm+dx)));
  updateNeedle();
});
knobSVG.addEventListener('pointerup',e=>{
  dragging=false;knobSVG.releasePointerCapture(e.pointerId);
});

/* ------------------------------------------------- */
/* 5. Start / Stop                                   */
/* ------------------------------------------------- */
let schedTimer=null;
function start(){
  audioCtx.resume();
  if(schedTimer) return;

  updateAccentPos();
  beatCount = 0; claveCount = 0;
  nextTickTime = audioCtx.currentTime + 0.05; // arranca 50 ms después

  scheduler();                               // programa los primeros
  schedTimer = setInterval(scheduler, lookAheadMs);

  document.getElementById('start').disabled=true;
  document.getElementById('stop').disabled=false;
}
function stop(){
  clearInterval(schedTimer); schedTimer=null;
  document.getElementById('start').disabled=false;
  document.getElementById('stop').disabled=true;
}
document.getElementById('start').addEventListener('click',start);
document.getElementById('stop' ).addEventListener('click',stop);

/* ------------------------------------------------- */
/* 6. Compases / subdiv / skins                      */
/* ------------------------------------------------- */
function updateAccentPos(){
  accentPos=[0]; let s=0;
  grouping.slice(0,-1).forEach(g=>{s+=g;accentPos.push(s);});
}

document.querySelectorAll('.meter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.meter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');

    const v = btn.dataset.meter;
    if(v.startsWith('2_2_clave')){
      mode='clave'; grouping=[16];
    }else{
      mode='normal';
      const p=v.split('_').map(Number);
      denominator=p[1]; grouping=p.slice(2);
    }
    updateAccentPos();
  });
});

document.querySelectorAll('.sub-btn').forEach(btn=>
  btn.addEventListener('click',()=>btn.classList.toggle('active'))
);

document.querySelectorAll('.themes button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.body.className = btn.dataset.theme;
    const sec=getComputedStyle(document.body).getPropertyValue('--secondary').trim();
    document.querySelector('#needle').style.stroke = sec;
    document.querySelector('.light').style.background = sec;
  });
});

});
