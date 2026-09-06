import { useState } from 'react';
import GameScreen from './GameScreen';
import Home, { type Screen } from './Home';
import Teacher from './Teacher';
import type { Difficulty } from './types';
import './index.css';

export default function App(){
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
