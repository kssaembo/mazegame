export type Direction = 'north' | 'east' | 'south' | 'west';
export type CommandType = 'forward' | 'turnLeft' | 'turnRight';
export type Difficulty = 'easy' | 'hard';
export type MatchPhase = 'idle' | 'waiting' | 'ready' | 'active' | 'executing' | 'reconnecting' | 'result_pending' | 'completed' | 'aborted';
export interface Point { row: number; col: number }
export interface Command { id: string; type: CommandType }
export interface PlayerState { id: string; name: string; position: Point; direction: Direction; start: Point; goal: Point; doubleChancesRemaining: number; wallHits: number; connected: boolean; turns: number }
export interface Wall { a: Point; b: Point }
export interface TurnLog { id: string; turn: number; playerId: string; startedAt: number; start: Point; startDirection: Direction; commands: Command[]; usedDouble: boolean; moved: number; collision: boolean; collisionKind?: 'wall' | 'boundary'; failedCommandIndex?: number; end: Point; endDirection: Direction; won: boolean }
export interface MatchState { schemaVersion: 1; matchId: string; classSessionId: string; phase: MatchPhase; difficulty: Difficulty; mazeSeed: string; walls: Wall[]; players: [PlayerState, PlayerState]; currentPlayerId: string; turnNumber: number; executing: boolean; winnerId?: string; finishReason?: 'goal' | 'teacher_decision' | 'aborted' | 'invalid'; logs: TurnLog[]; processedActionIds: string[]; revision: number; startedAt: number; completedAt?: number }
export interface MatchResult { matchId: string; classSessionId: string; venueNumber?: number; playerAId: string; playerBId: string; playerNames: Record<string, string>; winnerId?: string; loserId?: string; turnsByPlayer: Record<string, number>; wallHitsByPlayer: Record<string, number>; doubleChanceUses: Record<string, number>; durationMs: number; finishReason: 'goal' | 'teacher_decision' | 'aborted' | 'invalid'; completedAt: string }
export interface StudentRecord { id: string; name: string }
export interface ClassSession { id: string; code: string; className: string; students: StudentRecord[]; results: MatchResult[]; createdAt: number }
