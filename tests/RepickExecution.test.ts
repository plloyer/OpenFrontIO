import { RepickExecution } from "../src/core/execution/RepickExecution";
import {
  Duos,
  Game,
  GameMode,
  Player,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { playerInfo, setup } from "./util/Setup";

describe("RepickExecution", () => {
  let game: Game;
  let dead: Player;
  let alive: Player;
  let weak: Player;
  let strong: Player;
  let other: Player;

  const square = (p: Player, x0: number, y0: number, size: number) => {
    for (let x = x0; x < x0 + size; x++)
      for (let y = y0; y < y0 + size; y++) p.conquer(game.ref(x, y));
  };
  const kill = (p: Player) => {
    for (const t of Array.from(p.tiles())) p.relinquish(t);
    game.executeNextTick();
  };
  const repick = (p: Player, target: Player) => {
    game.addExecution(new RepickExecution(p, target.id()));
    game.executeNextTick(); // init
    game.executeNextTick(); // tick
  };

  beforeEach(async () => {
    game = await setup("plains", { instantBuild: true }, [
      playerInfo("Dead", PlayerType.Human),
      playerInfo("Alive", PlayerType.Human),
      playerInfo("Weak", PlayerType.Nation),
      playerInfo("Strong", PlayerType.Nation),
      playerInfo("Other", PlayerType.Nation),
    ]);
    [dead, alive, weak, strong, other] = [
      "Dead",
      "Alive",
      "Weak",
      "Strong",
      "Other",
    ].map((id) => game.player(id));
    // weak, other < alive (the weakest living human) < strong
    square(dead, 0, 0, 3);
    square(alive, 20, 0, 5);
    square(weak, 0, 20, 3);
    square(other, 10, 20, 2);
    square(strong, 20, 20, 7);
    while (game.inSpawnPhase()) game.executeNextTick();

    kill(dead);
    expect(dead.isAlive()).toBe(false);
  });

  test("a dead human takes over a weaker nation, keeping their own name", () => {
    const tiles = weak.numTilesOwned();
    const city = weak.buildUnit(UnitType.City, Array.from(weak.tiles())[0], {});

    repick(dead, weak);

    expect(dead.isAlive()).toBe(true);
    expect(dead.name()).toBe("Dead");
    expect(dead.numTilesOwned()).toBe(tiles);
    expect(weak.isAlive()).toBe(false);
    expect(city.owner()).toBe(dead);
    expect(dead.hasRepicked()).toBe(true);

    // The player's economy runs again (PlayerExecution re-added).
    dead.setTroops(0);
    for (let i = 0; i < 20; i++) game.executeNextTick();
    expect(dead.troops()).toBeGreaterThan(0);
  });

  test("a nation not weaker than the weakest living human is refused", () => {
    repick(dead, strong);
    expect(dead.isAlive()).toBe(false);
    expect(strong.isAlive()).toBe(true);
  });

  test("only one repick per game", () => {
    repick(dead, weak);
    kill(dead);
    repick(dead, other);

    expect(dead.isAlive()).toBe(false);
    expect(other.isAlive()).toBe(true);
  });

  test("no repick when no human is left alive to compare against", () => {
    kill(alive);
    repick(dead, weak);
    expect(dead.isAlive()).toBe(false);
  });

  test("a living player cannot repick", () => {
    repick(alive, weak);
    expect(weak.isAlive()).toBe(true);
  });
});

describe("RepickExecution in a team game", () => {
  test("the repicked player stays on their team, with the nation's land", async () => {
    const game = await setup(
      "plains",
      { instantBuild: true, gameMode: GameMode.Team, playerTeams: Duos },
      [
        playerInfo("Dead", PlayerType.Human),
        playerInfo("Friend", PlayerType.Human),
        playerInfo("Enemy1", PlayerType.Human),
        playerInfo("Enemy2", PlayerType.Human),
        playerInfo("Weak", PlayerType.Nation),
      ],
    );
    const [dead, weak] = [game.player("Dead"), game.player("Weak")];
    const humans = ["Dead", "Friend", "Enemy1", "Enemy2"].map((id) =>
      game.player(id),
    );
    const friend = humans.find((p) => p !== dead && p.isOnSameTeam(dead));
    expect(friend).toBeDefined();
    const team = dead.team();
    expect(weak.team()).not.toBe(team);

    humans.forEach((p, i) => {
      for (let x = 20 * i; x < 20 * i + 5; x++)
        for (let y = 0; y < 5; y++) p.conquer(game.ref(x, y));
    });
    for (let x = 0; x < 3; x++)
      for (let y = 20; y < 23; y++) weak.conquer(game.ref(x, y));
    while (game.inSpawnPhase()) game.executeNextTick();

    for (const t of Array.from(dead.tiles())) dead.relinquish(t);
    game.executeNextTick();
    game.addExecution(new RepickExecution(dead, weak.id()));
    game.executeNextTick();
    game.executeNextTick();

    expect(dead.isAlive()).toBe(true);
    expect(dead.team()).toBe(team);
    expect(dead.isOnSameTeam(friend!)).toBe(true);
    const owner = game.owner(game.ref(1, 21));
    expect(owner.isPlayer() && owner.isOnSameTeam(friend!)).toBe(true);
  });
});
