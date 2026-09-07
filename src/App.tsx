import { useEffect, useRef, useState } from 'react';
import GameScreen from './GameScreen';
import Home, { type Screen } from './Home';
import Teacher from './Teacher';
import type { Difficulty } from './types';
import './index.css';

const MAIN_BGM='/assets/audio/bgm_main_memory_mazy_loop.mp3',RESULT_BGM='/assets/audio/bgm_result_maze_reveal.mp3';

function AudioDock(){const audioRef=useRef<HTMLAudioElement|null>(null),[playing,setPlaying]=useState(false),[volume,setVolume]=useState(.35),[track,setTrack]=useState<'main'|'result'>('main');useEffect(()=>{const audio=new Audio(MAIN_BGM);audio.loop=true;audio.volume=volume;audioRef.current=audio;const result=()=>{audio.pause();audio.src=RESULT_BGM;audio.loop=true;audio.currentTime=0;void audio.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));setTrack('result')},stop=()=>{audio.pause();audio.currentTime=0;setPlaying(false)},main=()=>{audio.pause();audio.src=MAIN_BGM;audio.loop=true;audio.currentTime=0;setTrack('main');setPlaying(false)};addEventListener('memory-maze:result-bgm',result);addEventListener('memory-maze:stop-bgm',stop);addEventListener('memory-maze:main-bgm',main);return()=>{removeEventListener('memory-maze:result-bgm',result);removeEventListener('memory-maze:stop-bgm',stop);removeEventListener('memory-maze:main-bgm',main);audio.pause()}},[]);useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume;document.documentElement.dataset.soundVolume=String(volume)},[volume]);const toggle=()=>{const audio=audioRef.current;if(!audio)return;if(playing){audio.pause();setPlaying(false)}else void audio.play().then(()=>setPlaying(true));};return <aside className="audio-dock" aria-label="배경 음악 조절"><button onClick={toggle} aria-label={playing?'배경 음악 일시 정지':'배경 음악 재생'}>{playing?'Ⅱ':'▶'}</button><div><b>BGM</b><span>{track==='main'?'기억의 미로':'결과 공개'}</span></div><span aria-hidden="true">🔉</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))} aria-label="음량"/></aside>}

export default function App(){
  useEffect(()=>{let audio:AudioContext|undefined;const play=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest('button');if(!button||button.disabled)return;audio??=new AudioContext();const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;const danger=button.classList.contains('danger-btn'),command=Boolean(button.closest('.command-buttons')),primary=button.classList.contains('primary')||button.classList.contains('run'),volume=Number(document.documentElement.dataset.soundVolume||.35);oscillator.type=danger?'sawtooth':command?'triangle':'sine';oscillator.frequency.setValueAtTime(danger?180:command?540:primary?430:310,now);if(command)oscillator.frequency.exponentialRampToValueAtTime(710,now+.055);gain.gain.setValueAtTime(.045*volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+.09);oscillator.connect(gain).connect(audio.destination);oscillator.start(now);oscillator.stop(now+.1)};document.addEventListener('click',play,true);return()=>{document.removeEventListener('click',play,true);void audio?.close()}},[]);
  const params=new URLSearchParams(location.search);
  const venue=Number(params.get('venue')||0),lobby=params.get('lobby')==='1',code=params.get('class')||'',encoded=params.get('players'),venueCount=Math.max(1,Number(params.get('venues')||venue||1));
  const difficulty:Difficulty=params.get('difficulty')==='hard'?'hard':'easy';
  let roster=['홍길동','임꺽정','심청이','흥부'];
  try{if(encoded)roster=JSON.parse(decodeURIComponent(escape(atob(encoded))))}catch{}
  const [screen,setScreen]=useState<Screen>(venue||lobby?'venue':'home');
  const page=screen==='home'?<Home go={setScreen}/>:screen==='teacher'?<Teacher goHome={()=>setScreen('home')}/>:<GameScreen practice={screen==='practice'} initialVenue={venue} venueCount={venueCount} code={code||'0000'} roster={roster} difficulty={difficulty} goHome={()=>{history.replaceState(null,'',location.pathname);setScreen('home')}}/>;
  return <>{page}<AudioDock/></>;
}
