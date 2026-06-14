# Obsidian Note Merger Plugin

将多篇笔记合并为一篇，支持选择、排序、重命名等功能。

## 功能特点

- 快捷键启动（默认 `Ctrl/Cmd + M`）
- 搜索并选择库中的笔记
- 拖动排序已选笔记
- 自定义合并后笔记名称
- 选择目标文件夹
- 可选删除源笔记

## 安装方法

### 手动安装
1. 下载 `main.js`、`manifest.json` 和 `styles.css` 文件
2. 将这些文件放入 Obsidian 插件文件夹：`<vault>/.obsidian/plugins/obsidian-note-merger/`
3. 重启 Obsidian
4. 在设置中启用插件

### 开发安装
1. 克隆此仓库
2. 运行 `npm install`
3. 运行 `npm run build` 构建插件
4. 将构建产物复制到插件文件夹

## 使用方法

1. 按 `Ctrl/Cmd + M` 或使用命令面板 `Note Merger: 合并笔记`
2. 在弹出的对话框中搜索并选择要合并的笔记
3. 点击 `+` 按钮添加笔记到合并列表
4. 拖动调整笔记顺序
5. 设置合并后笔记名称和目标文件夹
6. 点击 `合并` 按钮完成操作

## 配置选项

在插件设置中可以配置：
- 默认目标文件夹
- 合并分隔符
- 是否自动删除源笔记（危险选项）

## 开发说明

### 项目结构
- `src/main.ts` - 主要插件代码
- `styles.css` - 样式文件
- `manifest.json` - 插件元数据

### 构建
```bash
npm install
npm run build
```

### 开发模式
```bash
npm run dev
```

### 测试
```bash
npm test
npm run test:watch  # 监视模式
```

## 许可证

MIT License