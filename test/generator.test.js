'use strict';

const assert = require('assert');
const generator = require('../generator');

const tiers = ['beginner', 'easy', 'medium', 'hard'];

for (const difficulty of tiers) {
	const expectedTier = generator.TIER_BY_DIFFICULTY[difficulty];
	for (let i = 0; i < 3; i++) {
		const started = Date.now();
		const result = generator.generatePuzzle(difficulty);
		const ms = Date.now() - started;
		assert.strictEqual(result.difficulty, difficulty, 'difficulty mismatch');
		assert.strictEqual(result.tier, expectedTier, 'tier mismatch');
		assert.ok(result.clues >= generator.MIN_CLUES && result.clues <= generator.MAX_CLUES, 'clue count out of range: ' + result.clues);
		const check = generator.validatePuzzle(result.puzzle, result.solution, difficulty);
		assert.strictEqual(check.valid, true, difficulty + ' #' + (i + 1) + ' invalid: ' + (check.reason || ''));
		assert.strictEqual(generator.classifyTier(result.puzzle), expectedTier, 'classifyTier mismatch');
		console.log(difficulty + ' #' + (i + 1) + ': clues=' + result.clues + ' tier=' + result.tier + ' (' + ms + 'ms)');
	}
}

console.log('OK: 12 puzzles validated (beginner/easy/medium/hard x3)');
