import { useEffect, useState } from 'react';
import GameScreen from './GameScreen';
import Home, { type Screen } from './Home';
import Teacher from './Teacher';
import type { Difficulty } from './types';
import './index.css';

export default function App(){
  useEffect(()=>{let audio:AudioContext|undefined;const play=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest('button');if(!button||button.disabled||document.documentElement.dataset.soundMuted==='true')return;audio??=new AudioContext();const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;const danger=button.classList.contains('danger-btn'),command=Boolean(button.closest('.command-buttons')),primary=button.classList.contains('primary')||button.classList.contains('run');oscillator.type=danger?'sawtooth':command?'triangle':'sine';oscillator.frequency.setValueAtTime(danger?180:command?540:primary?430:310,now);if(command)oscillator.frequency.exponentialRampToValueAtTime(710,now+.055);gain.gain.setValueAtTime(.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+.09);oscillator.connect(gain).connect(audio.destination);oscillator.start(now);oscillator.stop(now+.1)};document.addEventListener('click',play,true);return()=>{document.removeEventListener('click',play,true);void audio?.close()}},[]);
  const params=new URLSearchParams(location.search);
  const venue=Number(params.get('venue')||0),lobby=params.get('lobby')==='1',code=params.get('class')||'',encoded=params.get('players'),venueCount=Math.max(1,Number(params.get('venues')||venue||1));
  const difficulty:Difficulty=params.get('difficulty')==='hard'?'hard':'easy';
  let roster=['홍길동','임꺽정','심청이','흥부'];
  try{if(encoded)roster=JSON.parse(decodeURIComponent(escape(atob(encoded))))}catch{}
  const [screen,setScreen]=useState<Screen>(venue||lobby?'venue':'home');
  if(screen==='home')return <Home go={setScreen}/>;
  if(screen==='teacher')return <Teacher goHome={()=>setScreen('home')}/>;
  return <GameScreen practice={screen==='practice'} initialVenue={venue} venueCount={venueCount} code={code||'0000'} roster={roster} difficulty={difficulty} goHome={()=>{history.replaceState(null,'',location.pathname);setScreen('home')}}/>;
}
