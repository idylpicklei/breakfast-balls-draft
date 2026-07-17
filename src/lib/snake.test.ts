import assert from "node:assert/strict";
import { getUserIdAtPick } from "./snake";

const order = ["a", "b", "c", "d"];

// Round 1
assert.equal(getUserIdAtPick(1, order), "a");
assert.equal(getUserIdAtPick(2, order), "b");
assert.equal(getUserIdAtPick(3, order), "c");
assert.equal(getUserIdAtPick(4, order), "d");
// Round 2 snake
assert.equal(getUserIdAtPick(5, order), "d");
assert.equal(getUserIdAtPick(6, order), "c");
assert.equal(getUserIdAtPick(7, order), "b");
assert.equal(getUserIdAtPick(8, order), "a");
// Round 3
assert.equal(getUserIdAtPick(9, order), "a");
assert.equal(getUserIdAtPick(24, order), "a");

console.log("snake.test.ts passed");
