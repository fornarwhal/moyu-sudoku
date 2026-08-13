'use strict';

const vscode = require('vscode');
const generator = require('./generator');

const VIEW_ID = 'moyuSudoku.view';
const VIEW_CONTAINER_ID = 'moyu-sudoku';
const STATE_KEY = 'moyuSudoku.state';

class SudokuProvider {
	constructor(context) {
		this._context = context;
		this._view = null;
		this._panel = null;
		this._lastActive = 'view';
		this._pendingMessage = null;
		this._saveTimer = setInterval(() => {
			this._requestSave();
		}, 5000);
		context.subscriptions.push({
			dispose: () => clearInterval(this._saveTimer)
		});
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration('moyuSudoku')) {
					this._broadcast({
						type: 'settings',
						settings: this._getSettings()
					});
				}
			})
		);
	}

	resolveWebviewView(webviewView) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true
		};
		webviewView.webview.html = this._getHtml();
		webviewView.webview.onDidReceiveMessage((msg) => {
			this._onMessage(msg, 'view');
		});
		webviewView.onDidDispose(() => {
			if (this._view === webviewView) {
				this._view = null;
			}
		});
	}

	async _onMessage(msg, sender) {
		try {
			if (msg.type === 'ready') {
				const saved = this._context.globalState.get(STATE_KEY, null);
				await this._postTo(sender, {
					type: 'state',
					state: saved
				});
				await this._postTo(sender, {
					type: 'settings',
					settings: this._getSettings()
				});
				await this._postTo(sender, {
					type: 'panelInfo',
					isPanel: sender === 'panel'
				});
				await this._postTo(sender, {
					type: 'difficulty',
					difficulty: this._context.globalState.get('moyuSudoku.difficulty', 'medium')
				});
				if (this._pendingMessage) {
					await this._postTo(sender, this._pendingMessage);
					this._pendingMessage = null;
				}
				this._lastActive = sender;
			} else if (msg.type === 'newGame') {
				const result = generator.generatePuzzle(msg.difficulty || 'medium');
				const state = {
					puzzle: result.puzzle,
					solution: result.solution,
					values: result.puzzle.slice(),
					notes: Array.from({ length: 81 }, () => []),
					difficulty: result.difficulty,
					elapsed: 0,
					sameHighlight: msg.sameHighlight !== false,
					checkErrors: msg.checkErrors === true
				};
				await this._save(state);
				this._broadcast({
					type: 'state',
					state: state,
					fresh: true
				});
				this._lastActive = sender;
			} else if (msg.type === 'save') {
				await this._save(msg.state);
				this._broadcast({
					type: 'state',
					state: msg.state
				}, sender);
				this._lastActive = sender;
			} else if (msg.type === 'setDifficulty') {
				await this._context.globalState.update('moyuSudoku.difficulty', msg.difficulty || 'medium');
				this._broadcast({
					type: 'difficulty',
					difficulty: msg.difficulty || 'medium'
				}, sender);
				this._lastActive = sender;
			} else if (msg.type === 'openPanel') {
				this._openPanel();
			} else if (msg.type === 'closePanel') {
				if (this._panel) {
					this._panel.dispose();
				}
			}
		} catch (error) {
			console.error('[项目状态] 消息处理失败:', error);
		}
	}

	async _save(state) {
		if (!state) {
			return;
		}
		await this._context.globalState.update(STATE_KEY, state);
	}

	_getSettings() {
		const config = vscode.workspace.getConfiguration('moyuSudoku');
		const defaults = {
			easy: { s: 180, a: 300, b: 600 },
			medium: { s: 300, a: 480, b: 900 },
			hard: { s: 480, a: 900, b: 1500 }
		};
		const raw = config.get('ratingThresholds', {});
		const ratingThresholds = {};
		for (const difficulty of ['easy', 'medium', 'hard']) {
			const t = raw[difficulty] || {};
			ratingThresholds[difficulty] = {
				s: typeof t.s === 'number' ? t.s : defaults[difficulty].s,
				a: typeof t.a === 'number' ? t.a : defaults[difficulty].a,
				b: typeof t.b === 'number' ? t.b : defaults[difficulty].b
			};
		}
		return {
			hideKey: config.get('hideKey', 'Escape'),
			ratingThresholds: ratingThresholds
		};
	}

	async _postTo(target, message) {
		if (target === 'panel') {
			if (this._panel && this._panel.webview) {
				await this._panel.webview.postMessage(message);
			}
		} else if (this._view && this._view.webview) {
			await this._view.webview.postMessage(message);
		}
	}

	async _broadcast(message, exceptSender) {
		if (exceptSender !== 'view') {
			await this._postTo('view', message);
		}
		if (exceptSender !== 'panel') {
			await this._postTo('panel', message);
		}
	}

	async _sendOrQueue(target, message) {
		if (target === 'panel') {
			if (this._panel && this._panel.webview) {
				await this._panel.webview.postMessage(message);
			}
			return;
		}
		if (this._view && this._view.webview) {
			await this._view.webview.postMessage(message);
		} else {
			this._pendingMessage = message;
		}
	}

	_requestSave() {
		this._postTo('view', {
			type: 'requestSave'
		});
		this._postTo('panel', {
			type: 'requestSave'
		});
	}

	async toggleMode() {
		try {
			if (this._panel && this._panel.visible && this._lastActive === 'panel') {
				this._panel.reveal(vscode.ViewColumn.Beside, true);
				await this._sendOrQueue('panel', {
					type: 'toggleMode'
				});
				await this._postTo('view', {
					type: 'showDashboard'
				});
			} else {
				await vscode.commands.executeCommand('workbench.view.extension.' + VIEW_CONTAINER_ID);
				await this._sendOrQueue('view', {
					type: 'toggleMode'
				});
				await this._postTo('panel', {
					type: 'showDashboard'
				});
			}
		} catch (error) {
			console.error('[项目状态] 切换失败:', error);
		}
	}

	async _openPanel() {
		try {
			if (this._panel) {
				this._panel.reveal(vscode.ViewColumn.Beside, true);
			} else {
				const panel = vscode.window.createWebviewPanel(
					'moyuSudoku.panel',
					'项目状态 - 数据明细',
					vscode.ViewColumn.Beside,
					{
						enableScripts: true,
						retainContextWhenHidden: true
					}
				);
				this._panel = panel;
				panel.webview.html = this._getHtml();
				panel.webview.onDidReceiveMessage((msg) => {
					this._onMessage(msg, 'panel');
				});
				panel.onDidDispose(() => {
					if (this._panel === panel) {
						this._panel = null;
					}
				});
			}
			this._lastActive = 'panel';
			await this._postTo('view', {
				type: 'showDashboard'
			});
		} catch (error) {
			console.error('[项目状态] 打开独立窗口失败:', error);
		}
	}

	_getHtml() {
		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
	:root {
		color-scheme: light dark;
	}
	* {
		box-sizing: border-box;
	}
	body {
		margin: 0;
		padding: 12px;
		outline: none;
		font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
		font-size: 13px;
		background: var(--vscode-sideBar-background, #1e1e1e);
		color: var(--vscode-sideBar-foreground, #cccccc);
	}
	#game {
		outline: none;
	}
	.hidden {
		display: none !important;
	}
	.dash-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
	}
	.dash-header h1 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}
	.dash-sub {
		font-size: 11px;
		color: var(--vscode-descriptionForeground, #9d9d9d);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		margin: 12px 0;
	}
	.card {
		background: var(--vscode-editorWidget-background, #252526);
		border: 1px solid var(--vscode-widget-border, #3c3c3c);
		border-radius: 3px;
		padding: 10px;
	}
	.card-label {
		font-size: 11px;
		color: var(--vscode-descriptionForeground, #9d9d9d);
	}
	.card-value {
		font-size: 18px;
		font-weight: 600;
		margin-top: 4px;
	}
	.section-title {
		font-size: 12px;
		font-weight: 600;
		margin: 12px 0 6px;
	}
	.ci-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	.ci-table th,
	.ci-table td {
		text-align: left;
		padding: 5px 6px;
		border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
	}
	.ci-table th {
		color: var(--vscode-descriptionForeground, #9d9d9d);
		font-weight: 500;
	}
	.ok {
		color: var(--vscode-testing-iconPassed, #89d185);
	}
	.warn {
		color: var(--vscode-testing-iconQueued, #cca700);
	}
	button {
		font-family: inherit;
		font-size: 12px;
		padding: 5px 10px;
		border: none;
		border-radius: 2px;
		cursor: pointer;
		background: var(--vscode-button-background, #0e639c);
		color: var(--vscode-button-foreground, #ffffff);
	}
	button:hover {
		background: var(--vscode-button-hoverBackground, #1177bb);
	}
	button.active {
		outline: 2px solid var(--vscode-focusBorder, #007fd4);
		outline-offset: 1px;
	}
	.toolbar button {
		background: transparent;
		color: var(--vscode-descriptionForeground, #9d9d9d);
		border: none;
		padding: 3px 6px;
		border-radius: 2px;
	}
	.toolbar button:hover {
		background: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.15));
		color: var(--vscode-textLink-foreground, #3794ff);
	}
	.toolbar button.active {
		outline: none;
		text-decoration: underline;
		text-underline-offset: 3px;
		color: var(--vscode-textLink-foreground, #3794ff);
	}
	.primary {
		width: 100%;
		margin-top: 12px;
		padding: 8px;
	}
	select {
		font-family: inherit;
		font-size: 12px;
		padding: 4px 6px;
		background: var(--vscode-dropdown-background, #3c3c3c);
		color: var(--vscode-dropdown-foreground, #cccccc);
		border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
		border-radius: 2px;
	}
	.toolbar {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 8px;
	}
	.toolbar-top {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.toolbar-top select {
		flex: 1;
		min-width: 0;
	}
	.toolbar-buttons {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 6px;
	}
	.toolbar-buttons button {
		text-align: center;
		padding: 4px 2px;
		white-space: nowrap;
	}
	.timer {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		color: var(--vscode-descriptionForeground, #9d9d9d);
	}
	.status {
		min-height: 18px;
		margin-bottom: 6px;
		font-size: 12px;
		color: var(--vscode-testing-iconPassed, #89d185);
	}
	#game {
		display: flex;
		flex-direction: column;
	}
	.game-footer {
		flex: 1;
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
	}
	#board {
		display: grid;
		grid-template-columns: repeat(9, 1fr);
		width: 100%;
		aspect-ratio: 1 / 1;
		background: var(--vscode-editor-background, #1e1e1e);
		user-select: none;
	}
	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		font-size: var(--cell-font, 18px);
	}
	.cell.shade {
		background: rgba(127, 127, 127, 0.08);
	}
	.cell.selected {
		background: var(--vscode-list-activeSelectionBackground, #094771);
		color: var(--vscode-list-activeSelectionForeground, #ffffff);
	}
	.cell.same {
		background: var(--vscode-editor-selectionBackground, rgba(38, 79, 120, 0.4));
	}
	.cell.hint {
		background: var(--vscode-editor-selectionBackground, rgba(38, 79, 120, 0.4));
	}
	.cell.error {
		background: var(--vscode-inputValidation-errorBackground, rgba(248, 81, 73, 0.2));
	}
	.cell.error .num {
		color: var(--vscode-inputValidation-errorForeground, #f14c4c);
	}
	.num {
		color: var(--vscode-input-foreground, #cccccc);
	}
	.num.clue {
		color: var(--vscode-editor-foreground, #dddddd);
		font-weight: 600;
	}
	.notes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		width: 100%;
		height: 100%;
		font-size: var(--note-font, 10px);
		color: var(--vscode-descriptionForeground, #9d9d9d);
	}
	.notes span {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	body.vscode-high-contrast .cell {
		border: 1px solid var(--vscode-contrastBorder, #6fc3df);
	}
	body.vscode-high-contrast .cell.br {
		border-right: 2px solid var(--vscode-contrastBorder, #6fc3df);
	}
	body.vscode-high-contrast .cell.bb {
		border-bottom: 2px solid var(--vscode-contrastBorder, #6fc3df);
	}
	body.vscode-high-contrast #board {
		border: 2px solid var(--vscode-contrastBorder, #6fc3df);
	}
	body.vscode-high-contrast .cell.shade {
		border-color: var(--vscode-contrastBorder, #6fc3df);
	}
</style>
</head>
<body tabindex="0">
	<div id="dashboard">
		<div class="dash-header">
			<h1>项目构建状态</h1>
			<span class="dash-sub">CI/CD 总览</span>
		</div>
		<div class="cards">
			<div class="card">
				<div class="card-label">构建成功率</div>
				<div class="card-value" id="statSuccess">98.4%</div>
			</div>
			<div class="card">
				<div class="card-label">代码覆盖率</div>
				<div class="card-value" id="statCoverage">67.2%</div>
			</div>
			<div class="card">
				<div class="card-label">最近构建</div>
				<div class="card-value" id="statBuild">12 分钟前</div>
			</div>
			<div class="card">
				<div class="card-label">待处理问题</div>
				<div class="card-value" id="statIssues">3</div>
			</div>
		</div>
		<div class="section-title">最近流水线记录</div>
		<table class="ci-table">
			<tr><th>流水线</th><th>分支</th><th>状态</th><th>耗时</th></tr>
			<tr><td>build-and-test</td><td>main</td><td class="ok" id="ciStatus1">通过</td><td id="ciTime1">4m12s</td></tr>
			<tr><td>deploy-staging</td><td>release/1.4</td><td class="ok" id="ciStatus2">通过</td><td id="ciTime2">2m05s</td></tr>
			<tr><td>lint-scan</td><td>feature/ui</td><td class="warn" id="ciStatus3">排队中</td><td id="ciTime3">—</td></tr>
		</table>
		<button id="openGameBtn" class="primary">查看数据明细</button>
	</div>
	<div id="game" class="hidden" tabindex="0">
		<div class="dash-header">
			<h1>数据明细表</h1>
			<span class="dash-sub">批次校验</span>
		</div>
		<div class="toolbar">
			<div class="toolbar-top">
				<select id="difficulty">
					<option value="easy">批次：简单</option>
					<option value="medium" selected>批次：中等</option>
					<option value="hard">批次：困难</option>
				</select>
				<button id="panelBtn">独立</button>
				<span id="timer" class="timer">00:00</span>
			</div>
			<div class="toolbar-buttons">
				<button id="newGameBtn">刷新</button>
				<button id="highlightBtn">高亮</button>
				<button id="noteBtn">批注</button>
				<button id="checkBtn">查错</button>
				<button id="hintBtn">提示</button>
				<button id="backBtn">返回</button>
			</div>
		</div>
		<div id="status" class="status"></div>
		<div id="board"></div>
		<div id="gameFooter" class="game-footer">
			<div class="section-title">最近校验记录</div>
			<table class="ci-table">
				<tr><th>批次</th><th>数据量</th><th>状态</th><th>耗时</th></tr>
				<tr><td id="logBatch1">B-1024</td><td id="logSize1">12.6 MB</td><td class="ok" id="logStatus1">通过</td><td id="logTime1">3m42s</td></tr>
				<tr><td id="logBatch2">B-1023</td><td id="logSize2">8.1 MB</td><td class="ok" id="logStatus2">通过</td><td id="logTime2">1m58s</td></tr>
				<tr><td id="logBatch3">B-1022</td><td id="logSize3">20.3 MB</td><td class="warn" id="logStatus3">校验中</td><td id="logTime3">—</td></tr>
			</table>
		</div>
	</div>
<script>
(function () {
	const vscode = acquireVsCodeApi();
	let mode = 'dashboard';
	let state = null;
	let selected = -1;
	let hintIndex = -1;
	let noteMode = false;
	let sameHighlight = true;
	let checkErrors = false;
	let timerSeconds = 0;
	let timerInterval = null;
	let completed = false;
	let isPanel = false;
	let hideKey = 'Escape';
	let confirmArmed = false;
	let confirmTimer = null;
	let history = [];
	let redoStack = [];
	const ratingDefaults = {
		easy: { s: 180, a: 300, b: 600 },
		medium: { s: 300, a: 480, b: 900 },
		hard: { s: 480, a: 900, b: 1500 }
	};
	let ratingThresholds = JSON.parse(JSON.stringify(ratingDefaults));

	const dashboardEl = document.getElementById('dashboard');
	const gameEl = document.getElementById('game');
	const boardEl = document.getElementById('board');
	const timerEl = document.getElementById('timer');
	const statusEl = document.getElementById('status');
	const highlightBtn = document.getElementById('highlightBtn');
	const noteBtn = document.getElementById('noteBtn');
	const checkBtn = document.getElementById('checkBtn');
	const hintBtn = document.getElementById('hintBtn');
	const difficultyEl = document.getElementById('difficulty');
	const panelBtn = document.getElementById('panelBtn');
	const newGameBtn = document.getElementById('newGameBtn');

	function post(message) {
		vscode.postMessage(message);
	}

	function save() {
		if (state) {
			post({ type: 'save', state: serialize() });
		}
	}

	function serialize() {
		return {
			puzzle: state.puzzle,
			solution: state.solution,
			values: state.values,
			notes: state.notes,
			difficulty: state.difficulty,
			elapsed: timerSeconds,
			sameHighlight: sameHighlight,
			checkErrors: checkErrors
		};
	}

	function normalizeState(next) {
		if (!next) {
			return null;
		}
		const notes = Array.from({ length: 81 }, function (_, i) {
			return next.notes && next.notes[i] ? next.notes[i].slice() : [];
		});
		const values = next.values ? next.values.slice() : next.puzzle.slice();
		return {
			puzzle: next.puzzle.slice(),
			solution: next.solution.slice(),
			values: values,
			notes: notes,
			difficulty: next.difficulty || 'medium',
			elapsed: next.elapsed || 0,
			sameHighlight: next.sameHighlight !== false,
			checkErrors: next.checkErrors === true
		};
	}

	function applyState(next, fresh) {
		state = normalizeState(next);
		timerSeconds = state ? state.elapsed : 0;
		sameHighlight = state ? state.sameHighlight : true;
		checkErrors = state ? state.checkErrors : false;
		updateHighlightButton();
		updateCheckButton();
		if (fresh) {
			history = [];
			redoStack = [];
			resetConfirm();
		}
		selected = -1;
		hintIndex = -1;
		completed = state ? isComplete() : false;
		updateTimer();
		render();
		if (mode === 'game') {
			statusEl.textContent = completed ? getCompletionText() : '';
			updateBoardScale();
			gameEl.focus({ preventScroll: true });
			startTimer();
		}
	}

	function isComplete() {
		if (!state) {
			return false;
		}
		return state.values.every(function (v, i) {
			return v === state.solution[i];
		});
	}

	function getRating() {
		if (!state) {
			return 'C';
		}
		const d = state.difficulty || 'medium';
		const t = timerSeconds;
		const thresholds = ratingThresholds[d] || ratingDefaults[d] || ratingDefaults.medium;
		if (t < thresholds.s) {
			return 'S';
		}
		if (t < thresholds.a) {
			return 'A';
		}
		if (t < thresholds.b) {
			return 'B';
		}
		return 'C';
	}

	function getCompletionText() {
		const rating = getRating();
		let face = ' (´･ω･´)';
		if (rating === 'S') {
			face = ' (ﾉ◕ヮ◕)ﾉ';
		} else if (rating === 'A') {
			face = ' (｀・ω・´)';
		} else if (rating === 'B') {
			face = ' (・∀・)';
		}
		return '耗时 ' + formatTime(timerSeconds) + ' · 评级 ' + rating + face;
	}

	function setMode(nextMode) {
		mode = nextMode;
		dashboardEl.classList.toggle('hidden', mode !== 'dashboard');
		gameEl.classList.toggle('hidden', mode !== 'game');
		if (mode === 'game') {
			statusEl.textContent = completed ? getCompletionText() : '';
			if (!state) {
				post({ type: 'newGame', difficulty: difficultyEl.value, sameHighlight: sameHighlight, checkErrors: checkErrors });
				return;
			}
			render();
			updateBoardScale();
			gameEl.focus({ preventScroll: true });
			startTimer();
			randomizeGameFooter();
		} else {
			stopTimer();
			resetConfirm();
			randomizeDashboard();
			save();
		}
	}

	function formatTime(sec) {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
	}

	function updateTimer() {
		timerEl.textContent = formatTime(timerSeconds);
	}

	function updateHighlightButton() {
		highlightBtn.classList.toggle('active', sameHighlight);
		highlightBtn.textContent = sameHighlight ? '高亮' : '高亮（关）';
	}

	function updateCheckButton() {
		checkBtn.classList.toggle('active', checkErrors);
		checkBtn.textContent = checkErrors ? '查错（开）' : '查错';
	}

	function startTimer() {
		if (timerInterval) {
			return;
		}
		timerInterval = setInterval(function () {
			if (mode === 'game' && !completed) {
				timerSeconds++;
				updateTimer();
			}
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function updateBoardScale() {
		const width = boardEl.getBoundingClientRect().width;
		if (width > 0) {
			const cell = width / 9;
			boardEl.style.setProperty('--cell-font', Math.max(10, Math.round(cell * 0.52)) + 'px');
			boardEl.style.setProperty('--note-font', Math.max(7, Math.round(cell * 0.28)) + 'px');
		}
	}

	function pushHistory() {
		if (!state) {
			return;
		}
		history.push({
			values: state.values.slice(),
			notes: state.notes.map(function (a) {
				return a.slice();
			})
		});
		if (history.length > 100) {
			history.shift();
		}
		redoStack = [];
	}

	function takeSnapshot() {
		return {
			values: state.values.slice(),
			notes: state.notes.map(function (a) {
				return a.slice();
			})
		};
	}

	function afterEdit() {
		completed = isComplete();
		if (completed) {
			stopTimer();
			statusEl.textContent = getCompletionText();
		} else {
			statusEl.textContent = '';
		}
		save();
		render();
	}

	function undo() {
		if (!state || history.length === 0) {
			return;
		}
		redoStack.push(takeSnapshot());
		if (redoStack.length > 100) {
			redoStack.shift();
		}
		const prev = history.pop();
		state.values = prev.values;
		state.notes = prev.notes;
		hintIndex = -1;
		afterEdit();
	}

	function redo() {
		if (!state || redoStack.length === 0) {
			return;
		}
		history.push(takeSnapshot());
		const next = redoStack.pop();
		state.values = next.values;
		state.notes = next.notes;
		hintIndex = -1;
		afterEdit();
	}

	function resetConfirm() {
		confirmArmed = false;
		if (confirmTimer) {
			clearTimeout(confirmTimer);
			confirmTimer = null;
		}
		newGameBtn.textContent = '刷新';
	}

	function startNewGame() {
		stopTimer();
		statusEl.textContent = '正在生成数据...';
		post({ type: 'newGame', difficulty: difficultyEl.value, sameHighlight: sameHighlight, checkErrors: checkErrors });
	}

	function randomizeDashboard() {
		document.getElementById('statSuccess').textContent = (96 + Math.random() * 3.4).toFixed(1) + '%';
		document.getElementById('statCoverage').textContent = (58 + Math.random() * 17).toFixed(1) + '%';
		document.getElementById('statBuild').textContent = (1 + Math.floor(Math.random() * 45)) + ' 分钟前';
		document.getElementById('statIssues').textContent = String(2 + Math.floor(Math.random() * 5));
		const statuses = ['通过', '通过', '排队中', '排队中'];
		const times = ['3m42s', '2m05s', '4m18s', '1m56s'];
		for (let i = 1; i <= 3; i++) {
			const statusEl2 = document.getElementById('ciStatus' + i);
			const timeEl = document.getElementById('ciTime' + i);
			const s = statuses[Math.floor(Math.random() * statuses.length)];
			statusEl2.textContent = s;
			statusEl2.className = s === '通过' ? 'ok' : 'warn';
			timeEl.textContent = s === '通过' ? times[Math.floor(Math.random() * times.length)] : '—';
		}
	}

	function randomizeGameFooter() {
		const batches = ['B-1024', 'B-1023', 'B-1022', 'B-1021', 'B-1020'];
		const sizes = ['12.6 MB', '8.1 MB', '20.3 MB', '5.7 MB', '16.4 MB'];
		const statuses = ['通过', '通过', '校验中', '通过', '排队中'];
		const times = ['3m42s', '1m58s', '—', '4m16s', '—'];
		for (let i = 1; i <= 3; i++) {
			const idx = Math.floor(Math.random() * batches.length);
			document.getElementById('logBatch' + i).textContent = batches[idx];
			document.getElementById('logSize' + i).textContent = sizes[idx];
			const s = statuses[Math.floor(Math.random() * statuses.length)];
			const statusEl = document.getElementById('logStatus' + i);
			statusEl.textContent = s;
			statusEl.className = s === '通过' ? 'ok' : 'warn';
			document.getElementById('logTime' + i).textContent = s === '通过' ? times[Math.floor(Math.random() * times.length)] : '—';
		}
	}

	function render() {
		if (!state) {
			boardEl.innerHTML = '';
			return;
		}
		const frag = document.createDocumentFragment();
		for (let i = 0; i < 81; i++) {
			const row = Math.floor(i / 9);
			const col = i % 9;
			const cell = document.createElement('div');
			cell.className = 'cell';
			if ((Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 1) {
				cell.classList.add('shade');
			}
			if (col % 3 === 2) {
				cell.classList.add('br');
			}
			if (row % 3 === 2) {
				cell.classList.add('bb');
			}
			cell.dataset.index = String(i);
			cell.addEventListener('click', function () {
				selectCell(i);
			});

			if (state.puzzle[i] !== 0) {
				const span = document.createElement('span');
				span.className = 'num clue';
				span.textContent = String(state.puzzle[i]);
				cell.appendChild(span);
			} else if (state.values[i] !== 0) {
				const span = document.createElement('span');
				span.className = 'num';
				if (checkErrors && state.values[i] !== state.solution[i]) {
					cell.classList.add('error');
				}
				span.textContent = String(state.values[i]);
				cell.appendChild(span);
			} else if (state.notes[i] && state.notes[i].length) {
				const notes = document.createElement('div');
				notes.className = 'notes';
				for (let n = 1; n <= 9; n++) {
					const d = document.createElement('span');
					d.textContent = state.notes[i].indexOf(n) >= 0 ? String(n) : '';
					notes.appendChild(d);
				}
				cell.appendChild(notes);
			}

			if (i === selected) {
				cell.classList.add('selected');
			}
			const current = selected >= 0 && state.values[selected] !== 0 ? state.values[selected] : 0;
			if (sameHighlight && selected >= 0 && current !== 0 && state.values[i] === current) {
				cell.classList.add('same');
			}
			if (sameHighlight && hintIndex >= 0 && i === hintIndex) {
				cell.classList.add('hint');
			}

			frag.appendChild(cell);
		}
		boardEl.innerHTML = '';
		boardEl.appendChild(frag);
	}

	function selectCell(i) {
		selected = i;
		hintIndex = -1;
		render();
	}

	function inputNumber(n) {
		if (!state || completed || selected < 0) {
			return;
		}
		if (state.puzzle[selected] !== 0) {
			return;
		}
		hintIndex = -1;
		pushHistory();
		if (noteMode) {
			const arr = (state.notes[selected] || []).slice();
			const idx = arr.indexOf(n);
			if (idx >= 0) {
				arr.splice(idx, 1);
			} else {
				arr.push(n);
			}
			arr.sort(function (a, b) {
				return a - b;
			});
			state.notes[selected] = arr;
		} else {
			state.values[selected] = n;
			state.notes[selected] = [];
		}
		afterEdit();
	}

	function clearCell() {
		if (!state || selected < 0 || state.puzzle[selected] !== 0) {
			return;
		}
		hintIndex = -1;
		pushHistory();
		state.values[selected] = 0;
		state.notes[selected] = [];
		afterEdit();
	}

	function computeCandidates(i) {
		if (!state) {
			return [];
		}
		const row = Math.floor(i / 9);
		const col = i % 9;
		const used = {};
		for (let c = 0; c < 9; c++) {
			const v = state.values[row * 9 + c];
			if (v) {
				used[v] = true;
			}
		}
		for (let r = 0; r < 9; r++) {
			const v = state.values[r * 9 + col];
			if (v) {
				used[v] = true;
			}
		}
		const boxRow = Math.floor(row / 3) * 3;
		const boxCol = Math.floor(col / 3) * 3;
		for (let r = 0; r < 3; r++) {
			for (let c = 0; c < 3; c++) {
				const v = state.values[(boxRow + r) * 9 + (boxCol + c)];
				if (v) {
					used[v] = true;
				}
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

	function giveHint() {
		if (!state || completed) {
			return;
		}
		let best = -1;
		let bestLen = 10;
		for (let i = 0; i < 81; i++) {
			if (state.puzzle[i] !== 0 || state.values[i] !== 0) {
				continue;
			}
			const cands = computeCandidates(i);
			if (cands.length < bestLen) {
				bestLen = cands.length;
				best = i;
				if (bestLen === 1) {
					break;
				}
			}
		}
		if (best === -1) {
			return;
		}
		selected = best;
		hintIndex = best;
		render();
		statusEl.textContent = '试试推理这一格';
	}

	function moveSelection(dr, dc) {
		if (selected < 0) {
			selected = 0;
			render();
			return;
		}
		const r = Math.floor(selected / 9) + dr;
		const c = (selected % 9) + dc;
		if (r >= 0 && r < 9 && c >= 0 && c < 9) {
			selected = r * 9 + c;
			render();
		}
	}

	document.addEventListener('keydown', function (e) {
		if (e.key === hideKey) {
			if (mode === 'game') {
				setMode('dashboard');
				e.preventDefault();
			} else if (mode === 'dashboard' && isPanel) {
				post({ type: 'closePanel' });
				e.preventDefault();
			}
			return;
		}
		if (mode !== 'game') {
			return;
		}
		if (e.target.tagName === 'SELECT') {
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey) {
				redo();
			} else {
				undo();
			}
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			redo();
			return;
		}
		if (e.key === 'n' || e.key === 'N') {
			noteMode = !noteMode;
			noteBtn.classList.toggle('active', noteMode);
			noteBtn.textContent = noteMode ? '批注（开）' : '批注';
			return;
		}
		if (e.key === 'h' || e.key === 'H') {
			giveHint();
			return;
		}
		if (e.key >= '1' && e.key <= '9') {
			inputNumber(Number(e.key));
			return;
		}
		if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
			clearCell();
			return;
		}
		if (e.key === 'ArrowUp') {
			moveSelection(-1, 0);
		}
		if (e.key === 'ArrowDown') {
			moveSelection(1, 0);
		}
		if (e.key === 'ArrowLeft') {
			moveSelection(0, -1);
		}
		if (e.key === 'ArrowRight') {
			moveSelection(0, 1);
		}
	});

	window.addEventListener('message', function (event) {
		const msg = event.data;
		if (!msg) {
			return;
		}
		if (msg.type === 'state') {
			applyState(msg.state, msg.fresh === true);
		} else if (msg.type === 'toggleMode') {
			setMode(mode === 'dashboard' ? 'game' : 'dashboard');
		} else if (msg.type === 'showDashboard') {
			setMode('dashboard');
		} else if (msg.type === 'requestSave') {
			save();
		} else if (msg.type === 'settings') {
			if (msg.settings) {
				hideKey = msg.settings.hideKey || 'Escape';
				if (msg.settings.ratingThresholds) {
					ratingThresholds = msg.settings.ratingThresholds;
				}
				if (completed) {
					statusEl.textContent = getCompletionText();
				}
			}
		} else if (msg.type === 'panelInfo') {
			isPanel = msg.isPanel === true;
		} else if (msg.type === 'difficulty') {
			if (msg.difficulty) {
				difficultyEl.value = msg.difficulty;
			}
		}
	});

	document.getElementById('openGameBtn').addEventListener('click', function () {
		setMode('game');
	});
	document.getElementById('newGameBtn').addEventListener('click', function () {
		if (!state) {
			startNewGame();
			return;
		}
		if (!confirmArmed) {
			confirmArmed = true;
			newGameBtn.textContent = '确认刷新？';
			confirmTimer = setTimeout(resetConfirm, 3000);
			return;
		}
		resetConfirm();
		startNewGame();
	});
	document.addEventListener('click', function (e) {
		if (confirmArmed && e.target !== newGameBtn) {
			resetConfirm();
		}
	});
	difficultyEl.addEventListener('change', function () {
		post({ type: 'setDifficulty', difficulty: difficultyEl.value });
	});
	panelBtn.addEventListener('click', function () {
		post({ type: 'openPanel' });
	});
	document.getElementById('backBtn').addEventListener('click', function () {
		setMode('dashboard');
	});
	noteBtn.addEventListener('click', function () {
		noteMode = !noteMode;
		noteBtn.classList.toggle('active', noteMode);
		noteBtn.textContent = noteMode ? '批注（开）' : '批注';
	});
	highlightBtn.addEventListener('click', function () {
		sameHighlight = !sameHighlight;
		updateHighlightButton();
		save();
		render();
	});
	checkBtn.addEventListener('click', function () {
		checkErrors = !checkErrors;
		updateCheckButton();
		save();
		render();
	});
	hintBtn.addEventListener('click', function () {
		giveHint();
	});

	const boardResizeObserver = new ResizeObserver(function () {
		updateBoardScale();
	});
	boardResizeObserver.observe(boardEl);

	randomizeDashboard();
	post({ type: 'ready' });
})();
</script>
</body>
</html>`;
	}
}

function activate(context) {
	const provider = new SudokuProvider(context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('moyuSudoku.toggle', () => {
			provider.toggleMode();
		})
	);
}

function deactivate() {
}

module.exports = {
	activate: activate,
	deactivate: deactivate
};
