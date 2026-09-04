import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import { createMatch, executeProgram, makeId } from './game';
import type { Command, MatchState } from './types';

type WireMessage =
  | { type: 'hello'; name: string }
  | { type: 'snapshot'; state: MatchState }
  | { type: 'action'; actionId: string; commands: Command[]; useDouble: boolean; playerId: string }
  | { type: 'ping' };
type Role = 'host' | 'guest' | 'demo' | null;
const savedKey = 'memory-maze:active-match:v1';
const safeSnapshot = (state: MatchState): MatchState => ({ ...state, walls: [] });

export function useRealtimeMatch() {
  const [match, setMatchValue] = useState<MatchState | null>(() => { try { const raw = localStorage.getItem(savedKey); return raw ? JSON.parse(raw) : null; } catch { return null; } });
  const [status, setStatus] = useState<'offline'|'connecting'|'waiting'|'connected'|'reconnecting'|'error'>('offline');
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem('memory-maze:role') as Role) || null), [roomCode, setRoomCode] = useState(() => sessionStorage.getItem('memory-maze:room') || '');
  const peerRef = useRef<Peer | null>(null), connRef = useRef<DataConnection | null>(null), matchRef = useRef(match);
  const localPlayerId = role === 'guest' ? 'player-b' : 'player-a';
  const setMatch = useCallback((next: MatchState | null) => { matchRef.current = next; setMatchValue(next); if (next) localStorage.setItem(savedKey, JSON.stringify(next)); else localStorage.removeItem(savedKey); }, []);
  const publish = useCallback((state: MatchState) => { setMatch(state); if (connRef.current?.open) connRef.current.send({ type: 'snapshot', state: safeSnapshot(state) } satisfies WireMessage); }, [setMatch]);

  const bindConnection = useCallback((connection: DataConnection, host: boolean) => {
    connRef.current = connection;
    connection.on('open', () => { setStatus('connected'); if (!host) connection.send({ type: 'hello', name: sessionStorage.getItem('memory-maze:name') || '도전자' } satisfies WireMessage); });
    connection.on('close', () => setStatus('reconnecting'));
    connection.on('error', () => setStatus('error'));
    connection.on('data', data => {
      const message = data as WireMessage;
      if (message.type === 'hello' && host && matchRef.current) { const next = { ...matchRef.current, players: matchRef.current.players.map((p, i) => i === 1 ? { ...p, name: message.name, connected: true } : p) as MatchState['players'], revision: matchRef.current.revision + 1 }; publish(next); }
      if (message.type === 'snapshot' && !host) setMatch(message.state);
      if (message.type === 'action' && host && matchRef.current) { try { publish(executeProgram(matchRef.current, message.playerId, message.commands, message.useDouble, message.actionId)); } catch { publish(matchRef.current); } }
    });
  }, [publish, setMatch]);

  const createRoom = useCallback((name: string, code: string) => {
    peerRef.current?.destroy(); setStatus('connecting'); setRole('host'); setRoomCode(code); sessionStorage.setItem('memory-maze:name', name); sessionStorage.setItem('memory-maze:role','host'); sessionStorage.setItem('memory-maze:room',code); sessionStorage.setItem('memory-maze:active','1');
    const state = createMatch([name, '상대 기다리는 중'], code, code); setMatch(state);
    const peer = new Peer(`memory-maze-${code.toLowerCase()}`); peerRef.current = peer;
    peer.on('open', () => setStatus('waiting')); peer.on('connection', connection => bindConnection(connection, true)); peer.on('error', () => setStatus('error'));
  }, [bindConnection, setMatch]);
  const joinRoom = useCallback((name: string, code: string) => {
    peerRef.current?.destroy(); setStatus('connecting'); setRole('guest'); setRoomCode(code); sessionStorage.setItem('memory-maze:name', name); sessionStorage.setItem('memory-maze:role','guest'); sessionStorage.setItem('memory-maze:room',code); sessionStorage.setItem('memory-maze:active','1');
    const peer = new Peer(); peerRef.current = peer; peer.on('open', () => bindConnection(peer.connect(`memory-maze-${code.toLowerCase()}`, { reliable: true }), false)); peer.on('error', () => setStatus('error'));
  }, [bindConnection]);
  const startDemo = useCallback(() => { setRole('demo'); setRoomCode('CLASS-204'); setStatus('connected'); sessionStorage.setItem('memory-maze:role','demo'); sessionStorage.setItem('memory-maze:room','CLASS-204'); sessionStorage.setItem('memory-maze:active','1'); setMatch(createMatch(['민준','서연'], `demo-${Date.now()}`, 'CLASS-204')); }, [setMatch]);
  const submit = useCallback((commands: Command[], useDouble: boolean) => {
    if (!matchRef.current) return;
    const actionId = makeId('action');
    if (role === 'guest') connRef.current?.send({ type: 'action', actionId, commands, useDouble, playerId: 'player-b' } satisfies WireMessage);
    else publish(executeProgram(matchRef.current, matchRef.current.currentPlayerId, commands, useDouble, actionId));
  }, [publish, role]);
  const disconnect = useCallback(() => { connRef.current?.close(); peerRef.current?.destroy(); connRef.current = null; peerRef.current = null; setStatus('offline'); setRole(null); setRoomCode(''); sessionStorage.removeItem('memory-maze:active'); sessionStorage.removeItem('memory-maze:role'); sessionStorage.removeItem('memory-maze:room'); }, []);
  useEffect(() => () => peerRef.current?.destroy(), []);
  return { match, setMatch, status, role, roomCode, localPlayerId, createRoom, joinRoom, startDemo, submit, disconnect };
}
