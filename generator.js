'use strict';

/*
 * 数独生成器（标准回溯算法）
 * 思路：随机生成完整解 -> 按随机顺序挖空 -> 每步校验唯一解。
 * 该算法为通用的公开实现思路，无外部依赖，可自由使用。
 */

const DIFFICULTY_CLUES = {
	easy: 40,
	medium: 32,
	hard: 26
};

function shuffle(list) {
	const a = list.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const t = a[i];
		a[i] = a[j];
		a[j] = t;
	}
	return a;
}

function candidates(grid, index) {
	const row = Math.floor(index / 9);
	const col = index % 9;
	const boxRow = Math.floor(row / 3) * 3;
	const boxCol = Math.floor(col / 3) * 3;
	const used = new Array(10).fill(false);

	for (let i = 0; i < 9; i++) {
		used[grid[row * 9 + i]] = true;
		used[grid[i * 9 + col]] = true;
	}
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			used[grid[(boxRow + r) * 9 + (boxCol + c)]] = true;
		}
	}

	const result = [];
	for (let n = 1; n <= 9; n++) {
		if (!used[n]) {
			result.push(n);
		}
	}
	return result;
}

function fillGrid(grid, pos) {
	if (pos === 81) {
		return true;
	}
	if (grid[pos] !== 0) {
		return fillGrid(grid, pos + 1);
	}
	for (const n of shuffle(candidates(grid, pos))) {
		grid[pos] = n;
		if (fillGrid(grid, pos + 1)) {
			return true;
		}
		grid[pos] = 0;
	}
	return false;
}

function generateSolvedGrid() {
	for (;;) {
		const grid = new Array(81).fill(0);
		if (fillGrid(grid, 0)) {
			return grid;
		}
	}
}

function countSolutions(grid, limit) {
	const limitCount = limit || 2;
	const board = grid.slice();
	let count = 0;

	function solve() {
		if (count >= limitCount) {
			return;
		}

		let best = -1;
		let bestCands = null;
		let bestLen = 10;
		for (let i = 0; i < 81; i++) {
			if (board[i] !== 0) {
				continue;
			}
			const cands = candidates(board, i);
			if (cands.length === 0) {
				return;
			}
			if (cands.length < bestLen) {
				bestLen = cands.length;
				best = i;
				bestCands = cands;
				if (bestLen === 1) {
					break;
				}
			}
		}

		if (best === -1) {
			count++;
			return;
		}

		for (const n of bestCands) {
			board[best] = n;
			solve();
			board[best] = 0;
			if (count >= limitCount) {
				return;
			}
		}
	}

	solve();
	return count;
}

function generatePuzzle(difficulty) {
	const key = DIFFICULTY_CLUES[difficulty] ? difficulty : 'medium';
	const target = DIFFICULTY_CLUES[key];

	for (;;) {
		const solution = generateSolvedGrid();
		const puzzle = solution.slice();
		const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));
		let removed = 0;

		for (const pos of cells) {
			if (81 - removed <= target) {
				break;
			}
			const backup = puzzle[pos];
			puzzle[pos] = 0;
			if (countSolutions(puzzle, 2) === 1) {
				removed++;
			} else {
				puzzle[pos] = backup;
			}
		}

		if (81 - removed === target) {
			return {
				difficulty: key,
				clues: target,
				puzzle: puzzle,
				solution: solution
			};
		}
	}
}

function validatePuzzle(puzzle, solution, difficulty) {
	const clueCount = puzzle.filter(function (v) {
		return v !== 0;
	}).length;
	const expected = DIFFICULTY_CLUES[difficulty];

	if (expected !== undefined && clueCount !== expected) {
		return { valid: false, reason: '提示数不符：' + clueCount + ' / ' + expected };
	}

	for (let i = 0; i < 81; i++) {
		if (puzzle[i] !== 0 && puzzle[i] !== solution[i]) {
			return { valid: false, reason: '提示数与答案不一致' };
		}
		if (solution[i] < 1 || solution[i] > 9) {
			return { valid: false, reason: '答案越界' };
		}
	}

	for (let r = 0; r < 9; r++) {
		const seenRow = new Set();
		const seenCol = new Set();
		for (let c = 0; c < 9; c++) {
			const nRow = solution[r * 9 + c];
			const nCol = solution[c * 9 + r];
			if (seenRow.has(nRow)) {
				return { valid: false, reason: '行重复' };
			}
			if (seenCol.has(nCol)) {
				return { valid: false, reason: '列重复' };
			}
			seenRow.add(nRow);
			seenCol.add(nCol);
		}
	}

	for (let br = 0; br < 3; br++) {
		for (let bc = 0; bc < 3; bc++) {
			const seen = new Set();
			for (let r = 0; r < 3; r++) {
				for (let c = 0; c < 3; c++) {
					const n = solution[(br * 3 + r) * 9 + (bc * 3 + c)];
					if (seen.has(n)) {
						return { valid: false, reason: '宫重复' };
					}
					seen.add(n);
				}
			}
		}
	}

	if (countSolutions(puzzle, 2) !== 1) {
		return { valid: false, reason: '题目不是唯一解' };
	}

	return { valid: true };
}

module.exports = {
	DIFFICULTY_CLUES: DIFFICULTY_CLUES,
	generatePuzzle: generatePuzzle,
	countSolutions: countSolutions,
	validatePuzzle: validatePuzzle
};
