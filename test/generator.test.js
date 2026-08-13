'use strict';

const assert = require('assert');
const generator = require('../generator');

for (const difficulty of ['easy', 'medium', 'hard']) {
	for (let i = 0; i < 10; i++) {
		const result = generator.generatePuzzle(difficulty);
		assert.strictEqual(result.difficulty, difficulty, 'difficulty mismatch');
		assert.strictEqual(result.clues, generator.DIFFICULTY_CLUES[difficulty], 'clue count mismatch');
		const check = generator.validatePuzzle(result.puzzle, result.solution, difficulty);
		assert.strictEqual(check.valid, true, difficulty + ' #' + (i + 1) + ' invalid: ' + (check.reason || ''));
		assert.strictEqual(generator.countSolutions(result.puzzle, 2), 1, 'not unique');
	}
}

console.log('OK: 30 puzzles validated (easy/medium/hard x10)');
