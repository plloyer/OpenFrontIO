import { PlayerType } from "./Game";

interface RepickPlayer {
  type(): PlayerType;
  isAlive(): boolean;
  numTilesOwned(): number;
}

// Nations a dead player may take over: alive and smaller (by territory) than
// the weakest human still alive. Shared by the execution and the death modal.
export function repickCandidates<P extends RepickPlayer>(players: P[]): P[] {
  const humans = players.filter(
    (p) => p.type() === PlayerType.Human && p.isAlive(),
  );
  if (humans.length === 0) return [];
  const weakestHuman = Math.min(...humans.map((p) => p.numTilesOwned()));
  return players.filter(
    (p) =>
      p.type() === PlayerType.Nation &&
      p.isAlive() &&
      p.numTilesOwned() < weakestHuman,
  );
}
