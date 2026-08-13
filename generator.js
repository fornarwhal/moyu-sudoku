'use strict';

/*
 * 数独生成与难度分级（零依赖）
 * 生成：随机完整解 -> 随机挖空（保持唯一解）-> 按目标技巧档位停止。
 * 分级：候选数传播式技巧求解器，返回解题所需的最高技巧层级 T1~T4。
 *   T1 唯一数 / T2 隐藏单数 / T3 区块数对与三数集 / T4 X-Wing 或需回溯
 */

const TIER_BY_DIFFICULTY = {
	beginner: 1,
	easy: 2,
	medium: 3,
	hard: 4
};
const MIN_CLUES = 24;
const MAX_CLUES = 45;
const MAX_ATTEMPTS = 100;

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

function countFilled(grid) {
	let n = 0;
	for (let i = 0; i < 81; i++) {
		if (grid[i] !== 0) {
			n++;
		}
	}
	return n;
}

function buildCandidates(grid) {
	const cands = [];
	for (let i = 0; i < 81; i++) {
		cands.push(grid[i] !== 0 ? [] : candidates(grid, i));
	}
	return cands;
}

function sameSet(a, b) {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

function classifyTier(puzzle) {
	const grid = puzzle.slice();
	const cands = buildCandidates(grid);
	let maxTier = 1;

	function place(i, v) {
		grid[i] = v;
		cands[i] = [];
		const row = Math.floor(i / 9);
		const col = i % 9;
		for (let c = 0; c < 9; c++) {
			const j = row * 9 + c;
			if (j !== i && cands[j]) {
				const k = cands[j].indexOf(v);
				if (k >= 0) {
					cands[j].splice(k, 1);
				}
			}
		}
		for (let r = 0; r < 9; r++) {
			const j = r * 9 + col;
			if (j !== i && cands[j]) {
				const k = cands[j].indexOf(v);
				if (k >= 0) {
					cands[j].splice(k, 1);
				}
			}
		}
		const boxRow = Math.floor(row / 3) * 3;
		const boxCol = Math.floor(col / 3) * 3;
		for (let r = 0; r < 3; r++) {
			for (let c = 0; c < 3; c++) {
				const j = (boxRow + r) * 9 + (boxCol + c);
				if (j !== i && cands[j]) {
					const k = cands[j].indexOf(v);
					if (k >= 0) {
						cands[j].splice(k, 1);
					}
				}
			}
		}
	}

	const units = [];
	for (let r = 0; r < 9; r++) {
		units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
	}
	for (let c = 0; c < 9; c++) {
		units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
	}
	for (let br = 0; br < 3; br++) {
		for (let bc = 0; bc < 3; bc++) {
			const u = [];
			for (let r = 0; r < 3; r++) {
				for (let c = 0; c < 3; c++) {
					u.push((br * 3 + r) * 9 + (bc * 3 + c));
				}
			}
			units.push(u);
		}
	}

	function applyHiddenSingles() {
		let found = false;
		for (const unit of units) {
			const empties = unit.filter((i) => grid[i] === 0);
			for (let d = 1; d <= 9; d++) {
				const hits = empties.filter((i) => cands[i].indexOf(d) >= 0);
				if (hits.length === 1) {
					place(hits[0], d);
					found = true;
				}
			}
		}
		return found;
	}

	function applyNakedPairs() {
		let found = false;
		for (const unit of units) {
			const empties = unit.filter((i) => grid[i] === 0);
			for (let a = 0; a < empties.length; a++) {
				for (let b = a + 1; b < empties.length; b++) {
					const i = empties[a];
					const j = empties[b];
					if (cands[i].length === 2 && sameSet(cands[i], cands[j])) {
						for (const k of unit) {
							if (k !== i && k !== j && grid[k] === 0) {
								const before = cands[k].length;
								cands[k] = cands[k].filter((n) => cands[i].indexOf(n) < 0);
								if (cands[k].length !== before) {
									found = true;
								}
							}
						}
					}
				}
			}
		}
		return found;
	}

	function applyHiddenPairs() {
		let found = false;
		for (const unit of units) {
			const empties = unit.filter((i) => grid[i] === 0);
			for (let d1 = 1; d1 <= 9; d1++) {
				for (let d2 = d1 + 1; d2 <= 9; d2++) {
					const p1 = empties.filter((i) => cands[i].indexOf(d1) >= 0);
					const p2 = empties.filter((i) => cands[i].indexOf(d2) >= 0);
					if (p1.length === 2 && sameSet(p1, p2)) {
						for (const i of p1) {
							const before = cands[i].length;
							cands[i] = cands[i].filter((n) => n === d1 || n === d2);
							if (cands[i].length !== before) {
								found = true;
							}
						}
					}
				}
			}
		}
		return found;
	}

	function applyPointing() {
		let found = false;
		for (let br = 0; br < 3; br++) {
			for (let bc = 0; bc < 3; bc++) {
				const box = [];
				for (let r = 0; r < 3; r++) {
					for (let c = 0; c < 3; c++) {
						box.push((br * 3 + r) * 9 + (bc * 3 + c));
					}
				}
				for (let d = 1; d <= 9; d++) {
					const hits = box.filter((i) => grid[i] === 0 && cands[i].indexOf(d) >= 0);
					if (hits.length < 2) {
						continue;
					}
					const rows = hits.map((i) => Math.floor(i / 9));
					const cols = hits.map((i) => i % 9);
					if (rows.every((r) => r === rows[0])) {
						const row = rows[0];
						for (let c = 0; c < 9; c++) {
							const i = row * 9 + c;
							if (box.indexOf(i) < 0 && grid[i] === 0 && cands[i].indexOf(d) >= 0) {
								cands[i] = cands[i].filter((n) => n !== d);
								found = true;
							}
						}
					}
					if (cols.every((c) => c === cols[0])) {
						const col = cols[0];
						for (let r = 0; r < 9; r++) {
							const i = r * 9 + col;
							if (box.indexOf(i) < 0 && grid[i] === 0 && cands[i].indexOf(d) >= 0) {
								cands[i] = cands[i].filter((n) => n !== d);
								found = true;
							}
						}
					}
				}
			}
		}
		return found;
	}

	function applyClaiming() {
		let found = false;
		for (let line = 0; line < 9; line++) {
			for (let d = 1; d <= 9; d++) {
				const rowHits = [];
				const colHits = [];
				for (let k = 0; k < 9; k++) {
					if (grid[line * 9 + k] === 0 && cands[line * 9 + k].indexOf(d) >= 0) {
						rowHits.push(line * 9 + k);
					}
					if (grid[k * 9 + line] === 0 && cands[k * 9 + line].indexOf(d) >= 0) {
						colHits.push(k * 9 + line);
					}
				}
				if (rowHits.length >= 2) {
					const boxes = rowHits.map((i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));
					if (boxes.every((b) => b === boxes[0])) {
						const boxRow = Math.floor(boxes[0] / 3) * 3;
						const boxCol = (boxes[0] % 3) * 3;
						for (let r = 0; r < 3; r++) {
							for (let c = 0; c < 3; c++) {
								const i = (boxRow + r) * 9 + (boxCol + c);
								if (Math.floor(i / 9) !== line && grid[i] === 0 && cands[i].indexOf(d) >= 0) {
									cands[i] = cands[i].filter((n) => n !== d);
									found = true;
								}
							}
						}
					}
				}
				if (colHits.length >= 2) {
					const boxes = colHits.map((i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));
					if (boxes.every((b) => b === boxes[0])) {
						const boxRow = Math.floor(boxes[0] / 3) * 3;
						const boxCol = (boxes[0] % 3) * 3;
						for (let r = 0; r < 3; r++) {
							for (let c = 0; c < 3; c++) {
								const i = (boxRow + r) * 9 + (boxCol + c);
								if (i % 9 !== line && grid[i] === 0 && cands[i].indexOf(d) >= 0) {
									cands[i] = cands[i].filter((n) => n !== d);
									found = true;
								}
							}
						}
					}
				}
			}
		}
		return found;
	}

	function applyNakedTriples() {
		let found = false;
		for (const unit of units) {
			const empties = unit.filter((i) => grid[i] === 0);
			for (let a = 0; a < empties.length; a++) {
				for (let b = a + 1; b < empties.length; b++) {
					for (let c = b + 1; c < empties.length; c++) {
						const cells = [empties[a], empties[b], empties[c]];
						const union = [];
						for (const i of cells) {
							for (const n of cands[i]) {
								if (union.indexOf(n) < 0) {
									union.push(n);
								}
							}
						}
						if (union.length > 3) {
							continue;
						}
						for (const k of unit) {
							if (cells.indexOf(k) >= 0 || grid[k] !== 0) {
								continue;
							}
							const before = cands[k].length;
							cands[k] = cands[k].filter((n) => union.indexOf(n) < 0);
							if (cands[k].length !== before) {
								found = true;
							}
						}
					}
				}
			}
		}
		return found;
	}

	function applyHiddenTriples() {
		let found = false;
		for (const unit of units) {
			const empties = unit.filter((i) => grid[i] === 0);
			for (let d1 = 1; d1 <= 9; d1++) {
				for (let d2 = d1 + 1; d2 <= 9; d2++) {
					for (let d3 = d2 + 1; d3 <= 9; d3++) {
						const pos = [];
						for (const i of empties) {
							if (cands[i].indexOf(d1) >= 0 || cands[i].indexOf(d2) >= 0 || cands[i].indexOf(d3) >= 0) {
								pos.push(i);
							}
						}
						if (pos.length > 3) {
							continue;
						}
						for (const i of pos) {
							const before = cands[i].length;
							cands[i] = cands[i].filter((n) => n === d1 || n === d2 || n === d3);
							if (cands[i].length !== before) {
								found = true;
							}
						}
					}
				}
			}
		}
		return found;
	}

	function applyXWing() {
		let found = false;
		for (let d = 1; d <= 9; d++) {
			const rowCols = [];
			for (let r = 0; r < 9; r++) {
				const cols = [];
				for (let c = 0; c < 9; c++) {
					if (grid[r * 9 + c] === 0 && cands[r * 9 + c].indexOf(d) >= 0) {
						cols.push(c);
					}
				}
				rowCols.push(cols);
			}
			for (let r1 = 0; r1 < 9; r1++) {
				if (rowCols[r1].length !== 2) {
					continue;
				}
				for (let r2 = r1 + 1; r2 < 9; r2++) {
					if (rowCols[r2].length !== 2 || !sameSet(rowCols[r1], rowCols[r2])) {
						continue;
					}
					const c1 = rowCols[r1][0];
					const c2 = rowCols[r1][1];
					for (let r = 0; r < 9; r++) {
						if (r === r1 || r === r2) {
							continue;
						}
						for (const c of [c1, c2]) {
							if (grid[r * 9 + c] === 0 && cands[r * 9 + c].indexOf(d) >= 0) {
								cands[r * 9 + c] = cands[r * 9 + c].filter((n) => n !== d);
								found = true;
							}
						}
					}
				}
			}

			const colRows = [];
			for (let c = 0; c < 9; c++) {
				const rows = [];
				for (let r = 0; r < 9; r++) {
					if (grid[r * 9 + c] === 0 && cands[r * 9 + c].indexOf(d) >= 0) {
						rows.push(r);
					}
				}
				colRows.push(rows);
			}
			for (let c1 = 0; c1 < 9; c1++) {
				if (colRows[c1].length !== 2) {
					continue;
				}
				for (let c2 = c1 + 1; c2 < 9; c2++) {
					if (colRows[c2].length !== 2 || !sameSet(colRows[c1], colRows[c2])) {
						continue;
					}
					const r1 = colRows[c1][0];
					const r2 = colRows[c1][1];
					for (let c = 0; c < 9; c++) {
						if (c === c1 || c === c2) {
							continue;
						}
						for (const r of [r1, r2]) {
							if (grid[r * 9 + c] === 0 && cands[r * 9 + c].indexOf(d) >= 0) {
								cands[r * 9 + c] = cands[r * 9 + c].filter((n) => n !== d);
								found = true;
							}
						}
					}
				}
			}
		}
		return found;
	}

	let changed = true;
	while (changed) {
		changed = false;
		for (let i = 0; i < 81; i++) {
			if (grid[i] === 0 && cands[i].length === 1) {
				place(i, cands[i][0]);
				changed = true;
			}
		}
		if (applyHiddenSingles()) {
			maxTier = Math.max(maxTier, 2);
			changed = true;
		}
		if (changed) {
			continue;
		}
		if (applyPointing() || applyClaiming() || applyNakedPairs() || applyHiddenPairs()) {
			maxTier = Math.max(maxTier, 3);
			changed = true;
			continue;
		}
		if (applyNakedTriples() || applyHiddenTriples()) {
			maxTier = Math.max(maxTier, 3);
			changed = true;
			continue;
		}
		if (applyXWing()) {
			maxTier = Math.max(maxTier, 4);
			changed = true;
			continue;
		}
	}

	for (let i = 0; i < 81; i++) {
		if (grid[i] === 0) {
			return Math.max(maxTier, 4);
		}
	}
	return maxTier;
}

function generatePuzzle(difficulty) {
	const key = TIER_BY_DIFFICULTY[difficulty] ? difficulty : 'medium';
	const target = TIER_BY_DIFFICULTY[key];

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const solution = generateSolvedGrid();
		const puzzle = solution.slice();
		const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));

		for (const pos of cells) {
			if (countFilled(puzzle) <= MIN_CLUES) {
				break;
			}
			const backup = puzzle[pos];
			puzzle[pos] = 0;
			if (countSolutions(puzzle, 2) !== 1) {
				puzzle[pos] = backup;
				continue;
			}
			if (classifyTier(puzzle) > target) {
				puzzle[pos] = backup;
			}
		}

		const clues = countFilled(puzzle);
		if (classifyTier(puzzle) === target && clues >= MIN_CLUES && clues <= MAX_CLUES) {
			return {
				difficulty: key,
				tier: target,
				clues: clues,
				puzzle: puzzle,
				solution: solution
			};
		}
	}

	throw new Error('无法生成目标难度: ' + key);
}

function validatePuzzle(puzzle, solution, difficulty) {
	const clueCount = countFilled(puzzle);

	if (difficulty !== undefined && (clueCount < MIN_CLUES || clueCount > MAX_CLUES)) {
		return { valid: false, reason: '提示数超出范围：' + clueCount };
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
	TIER_BY_DIFFICULTY: TIER_BY_DIFFICULTY,
	MIN_CLUES: MIN_CLUES,
	MAX_CLUES: MAX_CLUES,
	generatePuzzle: generatePuzzle,
	countSolutions: countSolutions,
	classifyTier: classifyTier,
	validatePuzzle: validatePuzzle
};
