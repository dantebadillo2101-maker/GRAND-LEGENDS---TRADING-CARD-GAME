"use strict";

const assert = require("assert");
const rules = require("../js/rules.js");

const card = { id: "T001", name: "Carta de prueba", cost: 1, power: 500, type: "Personaje" };
const library = [card];

assert.strictEqual(rules.validateCardData(card, new Set(["T001"])).valid, true);
assert.strictEqual(rules.validateCardData({ ...card, cost: -1 }, new Set(["T001"])).valid, false);
assert.strictEqual(rules.validateDeckData(Array.from({ length: 40 }, () => ({ ...card })), library).valid, false);
assert.strictEqual(rules.validateDeckData(Array.from({ length: 40 }, (_, index) => ({ ...card, id: "T" + String(index).padStart(3, "0") })), library).valid, false);
assert.strictEqual(rules.canAttackLeaderThroughField({ canAttackLeader: true }, [card]), true);
assert.strictEqual(rules.canAttackLeaderThroughField({}, []), true);
assert.strictEqual(rules.canAttackLeaderThroughField({}, [card]), false);

const unit = { ...card, ...rules.createUnitState(card, 700), hasAttacked: true, canAttackLeader: true, attached: 3 };
rules.resetUnitForTurn(unit);
assert.strictEqual(unit.attached, 0, "attached DON must reset to 0 at start of turn");
assert.strictEqual(unit.tempBoost, 0);
assert.strictEqual(unit.hasAttacked, false);
assert.strictEqual(unit.canAttackLeader, false);
assert.strictEqual(unit.summoningSickness, false);

// canUnitDefeat assertions
assert.strictEqual(rules.canUnitDefeat(3000, 2500), true, "3000 beats 2500");
assert.strictEqual(rules.canUnitDefeat(3000, 3000), true, "3000 ties 3000 (mutual defeat)");
assert.strictEqual(rules.canUnitDefeat(2000, 2500), false, "2000 loses to 2500");

console.log("rules.test.js: OK");

