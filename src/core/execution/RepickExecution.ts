import { z } from "zod";
import { Execution, Game, Player, PlayerID, Structures } from "../game/Game";
import { repickCandidates } from "../game/Repick";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { zPlayerRef } from "../snapshot/SnapshotType";
import { PlayerExecution } from "./PlayerExecution";

// A dead human absorbs a weak nation: its land, troops, gold and structures
// become theirs, so they keep their own name, team and stats. Once per game.
export class RepickExecution implements Execution {
  private mg: Game;
  private active = true;

  constructor(
    private player: Player,
    private targetID: PlayerID,
  ) {}

  init(mg: Game, _: number): void {
    this.mg = mg;
  }

  // In tick, not init: executions added during init() are dropped by the game loop.
  tick(_: number): void {
    this.active = false;
    const mg = this.mg;
    if (this.player.isAlive() || this.player.hasRepicked()) return;
    if (!mg.hasPlayer(this.targetID)) return;
    const target = mg.player(this.targetID);
    if (!repickCandidates(mg.players()).includes(target)) return;

    // ponytail: only structures move over; boats, warships and in-flight
    // attacks die with the nation (its PlayerExecution cleans them up).
    for (const u of target.units()) {
      if (Structures.has(u.type())) this.player.captureUnit(u);
    }
    for (const tile of Array.from(target.tiles())) this.player.conquer(tile);
    this.player.setTroops(target.troops());
    this.player.addGold(target.gold());
    this.player.markRepicked();
    mg.addExecution(new PlayerExecution(this.player));
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return RepickExecutionSnapshot.write({
      player: w.player(this.player),
      targetID: this.targetID,
      active: this.active,
      initialized: this.mg !== undefined,
    });
  }

  restoreSnapshot(s: RepickState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.targetID = s.targetID;
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
  }
}

const RepickStateSchema = z.object({
  player: zPlayerRef(),
  targetID: z.string(),
  active: z.boolean(),
  initialized: z.boolean(),
});
type RepickState = z.infer<typeof RepickStateSchema>;

export const RepickExecutionSnapshot = execSnapshotType({
  name: "Repick",
  version: 1,
  schema: RepickStateSchema,
  cls: () => RepickExecution,
});
