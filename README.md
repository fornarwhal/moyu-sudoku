# 摸鱼数独（Moyu Sudoku）

伪装成项目状态看板的 VSCode 数独小游戏 / A stealth sudoku disguised as a project status dashboard in VS Code.

GitHub 仓库 / Repository: https://github.com/fornarwhal/moyu-sudoku

## 功能 / Features

- 三档难度（简单 / 中等 / 困难） / 3 difficulty levels
- 伪装看板 + 老板键 / Fake dashboard + boss key
- 独立可缩放窗口 / Resizable standalone window
- 撤销 / 重做 / Undo & redo
- 笔记与查错 / Notes & error check
- 自动存档 / Auto save
- 跟随 VSCode 主题 / Theme-aware UI

## 界面预览 / Screenshots

![项目状态看板 / Dashboard](media/screenshots/dashboard.png)

![数独界面 / Sudoku](media/screenshots/sudoku.png)

## 安装 / Install

- 从 VSIX 安装：`Ctrl+Shift+P` → **Extensions: Install from VSIX...** 选择 `摸鱼数独.vsix`
- 从文件夹安装：`Ctrl+Shift+P` → **Developer: Install Extension from Location...** 选择本目录

## 快捷键 / Shortcuts

| 操作 / Action | 按键 / Key |
| --- | --- |
| 切换看板 / 数独 Toggle | `Ctrl+Alt+S` |
| 返回看板 Back to dashboard | `Esc`（或设置中的 hideKey） |
| 填数 Enter number | `1-9` |
| 笔记 Notes | `N` |
| 清除 Clear | `Delete` / `Backspace` / `0` |
| 撤销 / 重做 Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |

## 设置 / Settings

- `moyuSudoku.hideKey`：返回看板 / 关闭独立窗口的按键（`Escape` / `F12` / `` ` ``）
- `moyuSudoku.ratingThresholds`：各难度评级阈值（秒）

## 开发 / Development

克隆仓库后在 VSCode 按 `F5` 启动调试 / Clone the repo and press `F5` to debug.

## 许可 / License

MIT
