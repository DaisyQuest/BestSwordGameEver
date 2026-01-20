import { describe, expect, it } from "vitest";
import { createNpcSystem } from "../shared/simulation/npcSystem.js";
import { createRng } from "../shared/determinism/rng.js";

describe("npc system", () => {
  it("simulates a deterministic battle between two NPCs", () => {
    const config = {
      rngSeed: 1337,
      ai: {
        baseDamage: 28,
        variance: 6,
        sharpChance: 0.55,
        weakPointChance: 0.35,
        organChance: 0.6
      },
      combatantDefaults: {
        toggles: { limbLoss: true, organDamage: true }
      }
    };

    const runBattle = () => {
      const system = createNpcSystem(config);
      system.addNpc({ id: "alpha" });
      system.addNpc({ id: "bravo" });

      const reports = [];
      for (let round = 0; round < 6; round += 1) {
        reports.push(
          system.stepBattle({ attackerId: "alpha", defenderId: "bravo" })
        );
        reports.push(
          system.stepBattle({ attackerId: "bravo", defenderId: "alpha" })
        );
      }

      const alpha = system.getNpc("alpha");
      const bravo = system.getNpc("bravo");

      const alphaDamage = Object.values(alpha.combatant.parts).some(
        (part) => part.current < part.maxHealth
      );
      const bravoDamage = Object.values(bravo.combatant.parts).some(
        (part) => part.current < part.maxHealth
      );

      return {
        reports,
        alphaDamage,
        bravoDamage,
        alphaAlive: alpha.combatant.vitals.isAlive,
        bravoAlive: bravo.combatant.vitals.isAlive
      };
    };

    const first = runBattle();
    const second = runBattle();

    expect(first.reports).toEqual(second.reports);
    expect(first.alphaDamage).toBe(true);
    expect(first.bravoDamage).toBe(true);
    expect(first.alphaAlive || first.bravoAlive).toBe(true);
  });

  it("supports custom AI brains", () => {
    const system = createNpcSystem({
      rngSeed: 1,
      ai: {
        brain: ({ defender }) => ({
          part: "torso",
          type: "blunt",
          amount: defender.combatant.parts.torso.maxHealth / 2,
          weakPoint: false
        })
      }
    });

    system.addNpc({ id: "alpha" });
    system.addNpc({ id: "bravo" });

    const result = system.stepBattle({ attackerId: "alpha", defenderId: "bravo" });
    const torso = system.getNpc("bravo").combatant.parts.torso;

    expect(result.hit.part).toBe("torso");
    expect(result.report.applied).toBeGreaterThan(0);
    expect(torso.current).toBeLessThan(torso.maxHealth);
  });

  it("handles severed targets and zero variance rolls", () => {
    const calls = { nextInt: 0, nextFloat: 0 };
    const rng = {
      nextInt: () => {
        calls.nextInt += 1;
        return 0;
      },
      nextFloat: () => {
        calls.nextFloat += 1;
        return 1;
      }
    };

    const system = createNpcSystem({
      rng,
      ai: { variance: 0, weakPointChance: 0 }
    });

    system.addNpc({ id: "alpha" });
    system.addNpc({ id: "bravo" });

    const defender = system.getNpc("bravo");
    for (const part of Object.values(defender.combatant.parts)) {
      part.status = "severed";
    }

    const result = system.stepBattle({ attackerId: "alpha", defenderId: "bravo" });

    expect(result.hit.part).toBe("head");
    expect(result.hit.weakPoint).toBe(false);
    expect(calls.nextInt).toBe(1);
  });

  it("uses defender parts when provided", () => {
    const rng = {
      nextInt: () => 0,
      nextFloat: () => 0
    };
    const system = createNpcSystem({ rng });

    system.addNpc({ id: "alpha" });
    system.addNpc({ id: "bravo" });

    const defender = system.getNpc("bravo");
    defender.parts = defender.combatant.parts;

    const result = system.stepBattle({ attackerId: "alpha", defenderId: "bravo" });

    expect(Object.keys(defender.parts)).toContain(result.hit.part);
  });

  it("accepts combatant overrides and defaults weakPoint to false", () => {
    const system = createNpcSystem({
      rngSeed: 2,
      ai: {
        brain: () => ({
          part: "leftArm",
          type: "blunt",
          amount: 7
        })
      }
    });

    const npc = system.addNpc({
      id: "alpha",
      combatant: {
        armor: {
          layers: [
            {
              key: "outer",
              coverage: ["leftArm"],
              bluntMitigation: 0.1,
              sharpMitigation: 0.1,
              durability: 10
            }
          ],
          weakPoints: []
        }
      }
    });
    system.addNpc({ id: "bravo" });

    const result = system.stepBattle({ attackerId: "alpha", defenderId: "bravo" });

    expect(npc.combatant.armor).not.toBeNull();
    expect(result.hit.weakPoint).toBe(false);
  });

  it("targets organs deterministically with the default brain", () => {
    const floats = [0, 0, 0];
    const rng = {
      nextInt: () => 0,
      nextFloat: () => floats.shift() ?? 0
    };

    const system = createNpcSystem({
      rng,
      ai: {
        weakPointChance: 1,
        organChance: 1
      }
    });

    system.addNpc({ id: "alpha" });
    system.addNpc({ id: "bravo" });

    const result = system.stepBattle({ attackerId: "alpha", defenderId: "bravo" });

    expect(result.hit.part).toBe("head");
    expect(result.hit.organ).toBe("brain");
  });

  it("validates configuration and hit contracts", () => {
    expect(() => createNpcSystem({ rng: { nextInt: () => {} } })).toThrow(
      "rng must expose nextInt and nextFloat"
    );

    expect(() => createNpcSystem({ ai: "nope" })).toThrow(
      "ai config must be an object"
    );

    expect(() => createNpcSystem({ ai: { baseDamage: 0 } })).toThrow(
      "ai.baseDamage must be a positive number"
    );

    expect(() => createNpcSystem({ ai: { variance: -1 } })).toThrow(
      "ai.variance must be a non-negative integer"
    );

    expect(() => createNpcSystem({ ai: { sharpChance: 2 } })).toThrow(
      "ai.sharpChance must be between 0 and 1"
    );

    expect(() => createNpcSystem({ ai: { weakPointChance: -0.1 } })).toThrow(
      "ai.weakPointChance must be between 0 and 1"
    );

    expect(() => createNpcSystem({ ai: { organChance: 1.5 } })).toThrow(
      "ai.organChance must be between 0 and 1"
    );

    expect(() => createNpcSystem({ ai: { brain: 12 } })).toThrow(
      "ai.brain must be a function if provided"
    );

    const invalidWeakPoint = createNpcSystem({
      rng: createRng(0),
      ai: {
        brain: () => ({
          part: "head",
          type: "sharp",
          amount: 10,
          weakPoint: "nope"
        })
      }
    });
    invalidWeakPoint.addNpc({ id: "alpha" });
    invalidWeakPoint.addNpc({ id: "bravo" });

    expect(() =>
      invalidWeakPoint.stepBattle({ attackerId: "alpha", defenderId: "bravo" })
    ).toThrow("hit.weakPoint must be boolean if provided");

    const invalidOrgan = createNpcSystem({
      rng: createRng(0),
      ai: {
        brain: () => ({
          part: "head",
          type: "sharp",
          amount: 10,
          organ: 7
        })
      }
    });
    invalidOrgan.addNpc({ id: "alpha" });
    invalidOrgan.addNpc({ id: "bravo" });

    expect(() =>
      invalidOrgan.stepBattle({ attackerId: "alpha", defenderId: "bravo" })
    ).toThrow("hit.organ must be a string if provided");

    const invalidHit = createNpcSystem({
      rng: createRng(0),
      ai: {
        brain: () => null
      }
    });
    invalidHit.addNpc({ id: "alpha" });
    invalidHit.addNpc({ id: "bravo" });

    expect(() =>
      invalidHit.stepBattle({ attackerId: "alpha", defenderId: "bravo" })
    ).toThrow("brain must return a hit object");

    const invalidType = createNpcSystem({
      rng: createRng(0),
      ai: {
        brain: () => ({
          part: "head",
          type: "magic",
          amount: 10
        })
      }
    });
    invalidType.addNpc({ id: "alpha" });
    invalidType.addNpc({ id: "bravo" });

    expect(() =>
      invalidType.stepBattle({ attackerId: "alpha", defenderId: "bravo" })
    ).toThrow("hit.type must be 'blunt' or 'sharp'");

    const invalidAmount = createNpcSystem({
      rng: createRng(0),
      ai: {
        brain: () => ({
          part: "head",
          type: "sharp",
          amount: 0
        })
      }
    });
    invalidAmount.addNpc({ id: "alpha" });
    invalidAmount.addNpc({ id: "bravo" });

    expect(() =>
      invalidAmount.stepBattle({ attackerId: "alpha", defenderId: "bravo" })
    ).toThrow("hit.amount must be a positive number");

    const invalidPart = createNpcSystem({
      rng: createRng(0),
      ai: {
        brain: () => ({
          part: "",
          type: "sharp",
          amount: 10
        })
      }
    });
    invalidPart.addNpc({ id: "alpha" });
    invalidPart.addNpc({ id: "bravo" });

    expect(() =>
      invalidPart.stepBattle({ attackerId: "alpha", defenderId: "bravo" })
    ).toThrow("hit.part must be a non-empty string");
  });

  it("rejects invalid NPC identifiers", () => {
    const system = createNpcSystem();

    expect(() => system.addNpc()).toThrow("npc id must be a non-empty string");
    system.addNpc({ id: "alpha" });
    expect(() => system.addNpc({ id: "alpha" })).toThrow(
      "npc 'alpha' already exists"
    );
    expect(() => system.getNpc("")).toThrow("npc id must be a non-empty string");
    expect(() => system.removeNpc("")).toThrow("npc id must be a non-empty string");
    expect(() =>
      system.stepBattle({ attackerId: "missing", defenderId: "alpha" })
    ).toThrow("npc 'missing' not found");
  });
});
