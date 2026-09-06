import { useEffect, useState } from 'react';
import Peer from 'peerjs';
import { createMatch, executeProgram, hasWall, inBounds, makeId, pointKey, stepFrom, toResult, turn, validateProgram } from './game';
import type { Command, CommandType, Difficulty, Direction, MatchResult, MatchState, Point } from './types';

const IMG='/assets/images/';
const LABEL:Record<CommandType,string>={forward:'앞으로 1칸',turnLeft:'왼쪽 90°',turnRight:'오른쪽 90°'};
const ARROW:Record<Direction,string>={north:'↑',east:'→',south:'↓',west:'←'};
const PENDING_KEY='memory-maze:pending-results:v4';
type VenueEvent={type:'connected'|'occupied'|'available'|'result';venue:number;result?:MatchResult};
type SelectionPhase='venue'|'first'|'second'|'ready'|'play'|'closed';
type Visual={playerId:string;position:Point;direction:Direction};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function sendVenueEvent(code:string,event:VenueEvent){
  const queue:VenueEvent[]=JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');
  if(event.type==='result'&&!queue.some(item=>item.result?.matchId===event.result?.matchId)){
    queue.push(event);localStorage.setItem(PENDING_KEY,JSON.stringify(queue));
  }
  return new Promise<boolean>(resolve=>{
    const peer=new Peer(),timer=setTimeout(()=>{peer.destroy();resolve(false)},4500);
    peer.on('open',()=>{const connection=peer.connect(`memory-maze-class-${code}`,{reliable:true});connection.on('open',()=>connection.send(event));connection.on('data',data=>{if((data as {ok?:boolean}).ok){clearTimeout(timer);if(event.type==='result'){const left=(JSON.parse(localStorage.getItem(PENDING_KEY)||'[]') as VenueEvent[]).filter(item=>item.result?.matchId!==event.result?.matchId);localStorage.setItem(PENDING_KEY,JSON.stringify(left))}peer.destroy();resolve(true)}})});
    peer.on('error',()=>{clearTimeout(timer);peer.destroy();resolve(false)});
  });
}

function Pawn({index,direction,bump,current}:{index:number;direction:Direction;bump?:boolean;current?:boolean}){
  return <div className={`pawn-wrap p${index} ${bump?'bump':''} ${current?'active-turn':''}`}>
    <img className="pawn-img" src={`${IMG}${index?'pawn_player_coral.png':'pawn_player_mint.png'}`} style={{transform:`rotate(${({north:0,east:90,south:180,west:270} as Record<Direction,number>)[direction]}deg)`}}/>
    <b>{ARROW[direction]}</b>{bump&&<img className="collision" src={`${IMG}effect_wall_collision.png`}/>} 
  </div>;
}

function MazeBoard({match,visual,bump,wallFlash}:{match:MatchState;visual:Visual|null;bump:boolean;wallFlash:{position:Point;direction:Direction}|null}){
  const movingIndex=visual?match.players.findIndex(p=>p.id===visual.playerId):-1;
  return <div className="maze" role="grid" aria-label="7×7 기억의 미로">
    {Array.from({length:49},(_,index)=>{const row=Math.floor(index/7),col=index%7,key=`${row},${col}`;return <div className="cell" role="gridcell" key={key}>
      {match.players.map((p,i)=>pointKey(p.start)===key&&<span key={`s${p.id}`} className={`start-zone p${i}`}>출발</span>)}
      {match.players.map((p,i)=>pointKey(p.goal)===key&&<span key={`g${p.id}`} className={`goal-zone p${i}`}><img src={`${IMG}marker_goa_flag.png`}/>도착</span>)}
      {wallFlash&&pointKey(wallFlash.position)===key&&<span className={`wall-flash ${wallFlash.direction}`}/>} 
      <div className="pawns">{match.players.map((p,i)=>visual?.playerId!==p.id&&pointKey(p.position)===key?<Pawn key={p.id} index={i} direction={p.direction} current={p.id===match.currentPlayerId}/>:null)}</div>
    </div>})}
    {visual&&<div className="moving-pawn" style={{left:`${visual.position.col*100/7}%`,top:`${visual.position.row*100/7}%`}}><Pawn index={movingIndex} direction={visual.direction} bump={bump} current/></div>}
  </div>;
}

function CommandPanel({match,disabled,onRun}:{match:MatchState;disabled:boolean;onRun:(commands:Command[],useDouble:boolean)=>void}){
  const current=match.players.find(p=>p.id===match.currentPlayerId)!;
  const [commands,setCommands]=useState<Command[]>([]),[selected,setSelected]=useState<string>(),[double,setDouble]=useState(false);
  const check=validateProgram(commands,double),limit=double?18:12;
  const add=(type:CommandType)=>{if(disabled||commands.length>=limit||(type==='forward'&&check.forwards>=check.required))return;setCommands(v=>[...v,{id:makeId('cmd'),type}])};
  const move=(delta:number)=>{const index=commands.findIndex(c=>c.id===selected);if(index<0||index+delta<0||index+delta>=commands.length)return;const next=[...commands],[item]=next.splice(index,1);next.splice(index+delta,0,item);setCommands(next)};
  return <aside className="command-panel">
    <div className="panel-title"><div><small>이번 턴 프로그램</small><h2>명령을 조립하세요</h2></div><b>{check.forwards}/{check.required}칸</b></div>
    <div className="command-buttons"><button disabled={disabled} onClick={()=>add('forward')}>↑<span>앞으로 1칸</span></button><button disabled={disabled} onClick={()=>add('turnLeft')}>↶<span>왼쪽 회전</span></button><button disabled={disabled} onClick={()=>add('turnRight')}>↷<span>오른쪽 회전</span></button></div>
    <ol className="command-list">{commands.length?commands.map((c,i)=><li key={c.id} onClick={()=>setSelected(c.id)} className={selected===c.id?'selected':''}><span>{i+1}</span><b>{c.type==='forward'?'↑':c.type==='turnLeft'?'↶':'↷'} {LABEL[c.type]}</b></li>):<li className="empty">명령을 눌러<br/>실행 순서를 만드세요</li>}</ol>
    <div className="edit-row"><button onClick={()=>move(-1)} disabled={!selected||disabled}>위로</button><button onClick={()=>move(1)} disabled={!selected||disabled}>아래로</button><button onClick={()=>setCommands(v=>v.filter(c=>c.id!==selected))} disabled={!selected||disabled}>선택 삭제</button><button onClick={()=>setCommands([])} disabled={disabled}>전체 초기화</button></div>
    <button className={`double ${double?'active':''}`} disabled={disabled||(!double&&current.doubleChancesRemaining<1)} onClick={()=>{setDouble(v=>!v);setCommands([])}}><img src={`${IMG}icon_double_chance.png`}/>더블찬스 <span>남은 {current.doubleChancesRemaining-(double?1:0)}회</span></button>
    <p className={check.valid?'hint ok':'hint'}>{disabled?'프로그램을 실행하고 있어요.':check.message}</p>
    <button className="run" disabled={disabled||!check.valid} onClick={()=>{onRun(commands,double);setCommands([]);setSelected(undefined);setDouble(false)}}>▶ 프로그램 실행</button>
  </aside>;
}

export default function GameScreen({practice,initialVenue,venueCount,code,roster,difficulty,goHome}:{practice:boolean;initialVenue:number;venueCount:number;code:string;roster:string[];difficulty:Difficulty;goHome:()=>void}){
  const [phase,setPhase]=useState<SelectionPhase>(practice||initialVenue?'first':'venue');
  const [venue,setVenue]=useState(initialVenue);
  const [names,setNames]=useState<[string,string]>(['','']);
  const [match,setMatch]=useState<MatchState|null>(null),[visual,setVisual]=useState<Visual|null>(null),[bump,setBump]=useState(false),[wallFlash,setWallFlash]=useState<{position:Point;direction:Direction}|null>(null),[animating,setAnimating]=useState(false),[message,setMessage]=useState('현재 차례의 플레이어가 명령을 조립하세요.');

  useEffect(()=>{if(practice||!venue)return;void sendVenueEvent(code,{type:'connected',venue});const peer=new Peer(`memory-maze-venue-${code}-${venue}`);peer.on('connection',conn=>conn.on('data',data=>{if((data as {type?:string}).type==='game-ended'){setPhase('closed');setMatch(null)}}));return()=>peer.destroy()},[practice,code,venue]);
  useEffect(()=>{if(practice)return;const retry=()=>{const pending=JSON.parse(localStorage.getItem(PENDING_KEY)||'[]') as VenueEvent[];for(const event of pending)void sendVenueEvent(code,event)};retry();const timer=setInterval(retry,8000);return()=>clearInterval(timer)},[practice,code]);

  const start=()=>{const next=createMatch(names,`${code}-${venue}-${Date.now()}`,code,difficulty);setMatch(next);setPhase('play');if(!practice)void sendVenueEvent(code,{type:'occupied',venue})};
  const run=async(commands:Command[],useDouble:boolean)=>{
    if(!match||animating)return;setAnimating(true);
    const actor=match.players.find(p=>p.id===match.currentPlayerId)!;const actorIndex=match.players.findIndex(p=>p.id===actor.id);
    let position={...actor.position},direction=actor.direction,hit=false;
    setVisual({playerId:actor.id,position,direction});
    for(const command of commands){
      await wait(420);
      if(command.type==='turnLeft')direction=turn(direction,'left');
      else if(command.type==='turnRight')direction=turn(direction,'right');
      else{
        const next=stepFrom(position,direction);
        if(!inBounds(next)||hasWall(match.walls,position,next)){
          hit=true;setWallFlash({position:{...position},direction});setBump(true);setMessage('쿵! 숨겨진 벽이 나타났어요. 어느 명령이었는지 기억하세요.');
          await wait(650);setBump(false);setWallFlash(null);
          if(match.difficulty==='hard'){position={...actor.start};direction=actorIndex===0?'east':'west';setVisual({playerId:actor.id,position,direction});await wait(420)}
          break;
        }
        position=next;
      }
      setVisual({playerId:actor.id,position,direction});
    }
    await wait(250);
    const next=executeProgram(match,actor.id,commands,useDouble,makeId('action'));setMatch(next);setVisual(null);setAnimating(false);
    const log=next.logs.at(-1)!;
    setMessage(log.won?`${actor.name} 승리! 목적지에 도착했습니다.`:hit?(match.difficulty==='hard'?'출발점으로 돌아왔어요. 방향도 처음 상태로 돌아갑니다.':'충돌한 자리에서 다음 차례를 계속합니다.'):`${log.moved}칸 이동했습니다. 다음 플레이어 차례입니다.`);
    if(next.phase==='completed'&&!practice){const result={...toResult(next),venueNumber:venue};const ok=await sendVenueEvent(code,{type:'result',venue,result});setMessage(ok?`${actor.name} 승리! 결과가 교사에게 전송됐습니다.`:`${actor.name} 승리! 결과를 기기에 보관했습니다. 연결되면 다시 전송합니다.`);void sendVenueEvent(code,{type:'available',venue})}
  };

  if(phase==='closed')return <main className="closed-screen"><img src={`${IMG}icon_victory_trophy.png`}/><h1>전체 게임이 종료되었습니다.</h1><p>교사가 최종 순위를 발표합니다.</p></main>;
  if(phase==='venue')return <main className="venue-select"><header><div className="brand"><img src={`${IMG}icon_logo_maze_mark.png`}/><b>기억의 미로</b></div></header><section><span>경기장 선택</span><h1>경기장 번호를 선택하세요</h1><div className="venue-number-grid">{Array.from({length:venueCount},(_,i)=><button key={i} onClick={()=>{setVenue(i+1);setPhase('first')}}>{i+1}</button>)}</div><p className="selection-help">태블릿에서 경기장 번호는 선생님이 직접 지정해 주세요.</p></section></main>;
  if(phase==='first'||phase==='second'||phase==='ready')return <main className="venue-select"><header><div className="brand"><img src={`${IMG}icon_logo_maze_mark.png`}/><b>{practice?'연습 경기':`${venue}번 경기장`}</b></div>{practice&&<button className="secondary" onClick={goHome}>메인화면</button>}</header><section><span>플레이어 선택</span><h1>대결할 두 플레이어를 선택하세요.</h1>{phase!=='ready'?<><h2>{phase==='first'?'첫 번째':'두 번째'} 플레이어를 선택하세요</h2><div className="player-pick-grid">{roster.filter(name=>phase==='first'||name!==names[0]).map(name=><button key={name} onClick={()=>{if(phase==='first'){setNames([name,'']);setPhase('second')}else{setNames([names[0],name]);setPhase('ready')}}}>{name}</button>)}</div></>:<><div className="matchup"><strong>{names[0]}</strong><b>VS</b><strong>{names[1]}</strong></div><button className="primary" onClick={start}>게임 시작 →</button><button className="text-button" onClick={()=>setPhase('first')}>플레이어 다시 선택</button></>}</section></main>;
  if(!match)return null;
  const current=match.players.find(p=>p.id===match.currentPlayerId)!;
  return <main className="game"><header><button className="logo-button"><img src={`${IMG}icon_logo_maze_mark.png`}/></button><div><span>{practice?'연습 경기':`${venue}번 경기장`} · {match.difficulty==='easy'?'쉬움':'어려움'}</span><h1><b>{match.turnNumber}턴</b> · {match.phase==='completed'?'경기 종료':`${current.name} 차례`}</h1></div>{practice&&<button className="secondary" onClick={goHome}>메인화면으로</button>}</header><div className="game-layout">
    <aside className="players">{match.players.map((p,i)=><article key={p.id} className={`p${i} ${p.id===current.id?'current':''}`}><div><img src={`${IMG}${i?'pawn_player_coral.png':'pawn_player_mint.png'}`}/><span><small>{i+1}P</small><h2>{p.name}</h2></span></div><p>현황 <b>{p.turns}턴 · 충돌 {p.wallHits}회</b></p><p>더블찬스 <b>{'⚡'.repeat(p.doubleChancesRemaining)}{'○'.repeat(2-p.doubleChancesRemaining)}</b></p></article>)}<div className="quick-rules"><h3>게임 목표</h3><p>내 말과 같은 색의 <b>도착점</b>에 먼저 도착하세요.</p><h3>게임 방법</h3><p>전진 3번과 회전 명령을 조립합니다. {match.difficulty==='hard'?'벽에 부딪히면 처음 방향으로 출발점에 돌아갑니다.':'벽에 부딪히면 그 자리에서 다음 차례를 계속합니다.'}</p></div><div className="memory-tip"><img src={`${IMG}icon_memory_note.png`}/><div><b>기억 수첩</b><p>어느 명령에서 멈췄는지 기억하세요.</p></div></div></aside>
    <section className="board-area"><div className="turn-banner"><i className={current.id==='player-a'?'mint':'coral'}>{ARROW[visual?.playerId===current.id?visual.direction:current.direction]}</i><div><b>{match.phase==='completed'?`${current.name} 승리!`:`${current.name} 차례`}</b><span>{message}</span></div></div><MazeBoard match={match} visual={visual} bump={bump} wallFlash={wallFlash}/><p className="secret-note">보이지 않는 벽 32개가 숨어 있습니다 · 새 경기마다 미로가 바뀝니다</p></section>
    {match.phase==='completed'?<aside className="command-panel result-card"><img src={`${IMG}icon_victory_trophy.png`}/><h2>{current.name} 승리!</h2><p>명령의 순서를 떠올리며 결정적 순간을 복기해 보세요.</p><button className="primary" onClick={()=>{setNames(['','']);setPhase('first');setMatch(null)}}>다음 경기</button></aside>:<CommandPanel key={match.turnNumber} match={match} disabled={animating} onRun={run}/>} 
  </div></main>;
}
