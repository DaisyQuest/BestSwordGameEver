import { createControlMapper } from "../controls/controlSystem.js";
import { createPhysicsWorld } from "../physics/physicsSystem.js";
import { createMovementController } from "../physics/movementSystem.js";

const normalizeActorId = (actorId) => {
  if (typeof actorId !== "string" || actorId.length === 0) {
    throw new TypeError("actorId must be a non-empty string");
  }
  return actorId;
};

const normalizeInputs = (inputs) => {
  if (inputs === undefined) {
    return [];
  }
  if (!Array.isArray(inputs)) {
    throw new TypeError("inputs must be an array");
  }
  return inputs;
};

export const createSimulation = ({
  physics = {},
  controls = {},
  movement = {}
} = {}) => {
  const world = createPhysicsWorld(physics);
  const mapper = createControlMapper(controls);
  const mover = createMovementController(movement);

  const actors = new Map();

  const addActor = ({ id, body = {}, bindings } = {}) => {
    const actorId = normalizeActorId(id);
    if (actors.has(actorId)) {
      throw new RangeError(`actor '${actorId}' already exists`);
    }
    const bodyRecord = world.createBody({ id: actorId, ...body });
    const controlMapper = bindings
      ? createControlMapper({ bindings })
      : mapper;

    const actor = {
      id: actorId,
      body: bodyRecord,
      controls: controlMapper
    };
    actors.set(actorId, actor);
    return actor;
  };

  const removeActor = (actorId) => {
    const resolved = normalizeActorId(actorId);
    const existed = actors.delete(resolved);
    if (existed) {
      world.removeBody(resolved);
    }
    return existed;
  };

  const getActor = (actorId) => {
    const resolved = normalizeActorId(actorId);
    return actors.get(resolved) ?? null;
  };

  const step = (deltaMs, actorId, inputs, options) => {
    const resolvedInputs = normalizeInputs(inputs);
    const actor = getActor(actorId);
    if (!actor) {
      throw new RangeError(`actor '${actorId}' not found`);
    }

    const intent = actor.controls.mapInputs(resolvedInputs);
    const movementResult = mover.applyMovement(world, actor.id, intent, options);
    world.step(deltaMs);

    return {
      actorId: actor.id,
      intent,
      movement: movementResult,
      body: { ...actor.body, position: { ...actor.body.position }, velocity: { ...actor.body.velocity } }
    };
  };

  return {
    addActor,
    removeActor,
    getActor,
    step,
    world,
    mapper,
    mover
  };
};
