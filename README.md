# 摸鱼数独（Moyu Sudoku）

伪装成项目状态看板的 VSCode 数独小游戏 / A stealth sudoku disguised as a project status dashboard in VS Code.

GitHub 仓库 / Repository: https://github.com/fornarwhal/moyu-sudoku

## 功能 / Features

- 三档难度（简单 / 中等 / 困难） / 3 difficulty levels
- 伪装看板 + 老板键 / Fake dashboard + boss key
- 独立可缩放窗口 / Resizable standalone window
- 撤销 / 重做 / Undo & redo
- 笔记与查错 / Notes & error check
- 提示高亮（不显示答案）/ Hint highlight (no answer revealed)
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
| 提示 Hint | `H` |
| 清除 Clear | `Delete` / `Backspace` / `0` |
| 撤销 / 重做 Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |

## 设置 / Settings

- `moyuSudoku.hideKey`：返回看板 / 关闭独立窗口的按键（`Escape` / `F12` / `` ` ``）
- `moyuSudoku.autoHideOnBlur`：VSCode 窗口失去焦点时自动切回看板（默认关闭）
- `moyuSudoku.conflictHighlight`：填数即时浅色标出与同行/列/宫重复的数字（默认开启）
- `moyuSudoku.ratingThresholds`：各难度评级阈值（秒）

## 维护 / Maintenance

- CI：推送后 GitHub Actions 自动运行语法检查与数独生成器测试
- 自动发布：仓库 Settings → Secrets and variables → Actions 添加 `VSCE_PAT`（Azure DevOps 令牌，有效期选一年）后，在 Actions 页手动运行 **Publish to Marketplace**，自动打包、发布并更新 Release 附件
- 手动发布：先升 `package.json` 版本号，再执行 `vsce publish`

## 开发 / Development

克隆仓库后在 VSCode 按 `F5` 启动调试 / Clone the repo and press `F5` to debug.

## 许可 / License

MIT
