document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Variables ---------- */
  let bpm = 100,
      denominator = 4,
      grouping = [4],
      accentPos = [0],
      mode = 'normal',
      beatCount = 0,
      claveCount = 0,
      intervalId = null;

  const clavePatterns = {
    '2_2_clave_3_2': [1,4,7,11,13],
    '2_2_clave_2_3': [3,5,9,12,15]
  };

  /* ---------- Knob horizontal ---------- */
  const needle   = document.getElementById('needle');
  const bpmLabel = document.getElementById('bpm-label');
  const knobSVG  = document.getElementById('knob');

  function angleFromBpm(v){ return -135 + (v-40)*270/280; }
  function updateNeedle(){
    needle.style.transform = `rotate(${angleFromBpm(bpm)}deg)`;
    bpmLabel.textContent   = bpm;
  }
  updateNeedle();

  let dragging=false,startX=0,startBpm=bpm;
  knobSVG.addEventListener('pointerdown',e=>{
    dragging=true; startX=e.clientX; startBpm=bpm;
    knobSVG.setPointerCapture(e.pointerId);
  });
  knobSVG.addEventListener('pointermove',e=>{
    if(!dragging) return;
    const dx=e.clientX-startX;
    bpm = Math.min(320,Math.max(40,Math.round(startBpm+dx)));
    updateNeedle();
  });
  knobSVG.addEventListener('pointerup',e=>{
    dragging=false; knobSVG.releasePointerCapture(e.pointerId);
    if(intervalId) restart();
  });

  /* ---------- Audio con <audio> ---------- */
  function playSample(id, vol=1){
    const el = document.getElementById(id).cloneNode();
    el.volume = Math.min(1, vol);
    el.play();
  }
  function click(isAccent=false){
    playSample(isAccent ? 'wav-accent' : 'wav-pulse', isAccent ? 1 : 0.9);
  }

  /* ---------- Luz / visualizador ---------- */
  function flash(isAccent){
    const v=document.getElementById('visualizer');
    v.style.background=isAccent?'var(--secondary)':'#4caf50';
    setTimeout(()=>v.style.background='',80);
  }
  function moveLight(){
    const bar=document.querySelector('.light-bar');
    const light=document.querySelector('.light');
    const max=bar.clientWidth-light.clientWidth;
    const dur=mode==='clave' ? (60000/bpm)/4 : (60000/bpm)*(4/denominator);
    const from=light.style.left==='0px'||!light.style.left?0:max;
    const to  =from===0?max:0;
    light.animate([{left:from+'px'},{left:to+'px'}],{duration:dur,easing:'linear',fill:'forwards'});
  }

  function updateAccentPos(){
    accentPos=[0]; let s=0;
    grouping.slice(0,-1).forEach(g=>{s+=g; accentPos.push(s);});
  }

  /* ---------- Tick ---------- */
  function tick(){
    let isAcc=false;

    if(mode==='clave'){
      claveCount = (claveCount % 16) + 1;
      const m = document.querySelector('.meter-btn.active').dataset.meter;
      isAcc   = clavePatterns[m].includes(claveCount);

      /* Acentos con pulse.wav, suaves en silencio */
      if (isAcc){
        playSample('wav-pulse', 1);   // ← aquí suena pulse.wav
      }
      // golpes suaves: no sonido

    }else{
      // Compases normales
      isAcc = accentPos.includes(beatCount);
      click(isAcc);

      const base = (60000/bpm)*(4/denominator);
      if(document.getElementById('sub-eighth-btn').classList.contains('active'))
        setTimeout(()=>playSample('wav-sub',0.8), base/2);

      if(document.getElementById('sub-triplet-btn').classList.contains('active')){
        setTimeout(()=>playSample('wav-sub',0.8), base/3);
        setTimeout(()=>playSample('wav-sub',0.8), 2*base/3);
      }
      if(document.getElementById('sub-swing-btn').classList.contains('active'))
       setTimeout(()=>playSample('wav-sub', 0.9), 2*base/3);

      beatCount = (beatCount + 1) % grouping.reduce((a,b)=>a+b,0);
    }

    flash(isAcc);
    moveLight();
  }

  /* ---------- Control ---------- */
  function start(){
    if(intervalId) return;
    updateAccentPos(); tick();
    const int = mode==='clave' ? (60000/bpm)/4 : (60000/bpm)*(4/denominator);
    intervalId = setInterval(tick,int);
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled  = false;
  }
  function stop(){
    clearInterval(intervalId); intervalId=null;
    document.getElementById('start').disabled=false;
    document.getElementById('stop').disabled=true;
  }
  function restart(){ stop(); start(); }

  document.getElementById('start').addEventListener('click',start);
  document.getElementById('stop' ).addEventListener('click',stop);

  /* ---------- Compases ---------- */
  document.querySelectorAll('.meter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.meter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');

      const val = btn.dataset.meter;
      if(val.startsWith('2_2_clave')){
        mode='clave'; grouping=[16];
      }else{
        mode='normal';
        const p = val.split('_').map(Number);
        denominator = p[1];
        grouping    = p.slice(2);
      }
      restart();
    });
  });

  /* ---------- Subdivisiones ---------- */
  document.querySelectorAll('.sub-btn').forEach(btn=>
    btn.addEventListener('click',()=>btn.classList.toggle('active'))
  );

  /* ---------- Skins ---------- */
  document.querySelectorAll('.themes button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.body.className = btn.dataset.theme;
      const sec = getComputedStyle(document.body).getPropertyValue('--secondary').trim();
      document.querySelector('#needle').style.stroke = sec;
      document.querySelector('.light' ).style.background = sec;
    });
  });
});
