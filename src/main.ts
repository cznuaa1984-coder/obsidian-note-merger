import { App, Modal, Notice, Plugin, TFile, TFolder, Vault, PluginSettingTab, Setting } from 'obsidian';

interface NoteMergerSettings {
  defaultFolder: string;
  separator: string;
  autoDelete: boolean;
  hotkey: string;
}

const DEFAULT_SETTINGS: NoteMergerSettings = {
  defaultFolder: '',
  separator: '---',
  autoDelete: false,
  hotkey: 'Ctrl+M'
};

export default class NoteMergerPlugin extends Plugin {
  settings: NoteMergerSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'merge-notes',
      name: '合并笔记',
      callback: () => new NoteMergerModal(this.app, this).open()
    });

    this.addSettingTab(new NoteMergerSettingTab(this.app, this));
  }

  onunload() {
    console.log('Note Merger plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

export class NoteMergerModal extends Modal {
  plugin: NoteMergerPlugin;
  notes: TFile[] = [];
  selectedNotes: TFile[] = [];
  searchInput: HTMLInputElement;
  noteList: HTMLElement;
  mergedNoteName: HTMLInputElement;
  targetFolder: HTMLInputElement;
  deleteCheckbox: HTMLInputElement;

  constructor(app: App, plugin: NoteMergerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('note-merger-modal');

    contentEl.createEl('h2', { text: '合并笔记' });

    // 搜索框
    const searchContainer = contentEl.createDiv({ cls: 'search-container' });
    this.searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: '搜索笔记...',
      cls: 'search-input'
    });
    this.searchInput.addEventListener('input', () => this.searchNotes());

    // 笔记列表
    this.noteList = contentEl.createDiv({ cls: 'note-list' });
    this.loadAllNotes();

    // 已选笔记列表
    const selectedContainer = contentEl.createDiv({ cls: 'selected-container' });
    selectedContainer.createEl('h3', { text: '已选笔记（拖动排序）' });
    const selectedList = selectedContainer.createDiv({ cls: 'selected-list' });
    this.renderSelectedNotes(selectedList);

    // 设置区域
    const settingsContainer = contentEl.createDiv({ cls: 'settings-container' });
    
    // 合并后笔记名称
    const nameContainer = settingsContainer.createDiv({ cls: 'setting-item' });
    nameContainer.createEl('label', { text: '合并后笔记名称：' });
    this.mergedNoteName = nameContainer.createEl('input', {
      type: 'text',
      placeholder: '默认使用第一篇笔记名称',
      cls: 'name-input'
    });

    // 目标文件夹
    const folderContainer = settingsContainer.createDiv({ cls: 'setting-item' });
    folderContainer.createEl('label', { text: '目标文件夹：' });
    
    const folderInputContainer = folderContainer.createDiv({ cls: 'folder-input-container' });
    this.targetFolder = folderInputContainer.createEl('input', {
      type: 'text',
      placeholder: '默认为当前文件夹',
      value: this.plugin.settings.defaultFolder,
      cls: 'folder-input'
    });
    
    const folderSelectButton = folderInputContainer.createEl('button', { 
      text: '选择文件夹', 
      cls: 'folder-select-button' 
    });
    folderSelectButton.addEventListener('click', () => {
      new FolderSuggesterModal(this.app, (folder) => {
        this.targetFolder.value = folder.path;
      }).open();
    });

    // 删除源笔记选项
    const deleteContainer = settingsContainer.createDiv({ cls: 'setting-item' });
    this.deleteCheckbox = deleteContainer.createEl('input', {
      type: 'checkbox',
      cls: 'delete-checkbox'
    });
    deleteContainer.createEl('label', { text: '合并后删除源笔记（不可撤销）' });

    // 按钮区域
    const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
    buttonContainer.createEl('button', { text: '取消', cls: 'cancel-button' })
      .addEventListener('click', () => this.close());
    buttonContainer.createEl('button', { text: '合并', cls: 'merge-button' })
      .addEventListener('click', () => this.mergeNotes());
  }

  async loadAllNotes() {
    const files = this.app.vault.getMarkdownFiles();
    // 按修改时间降序排序（最新的在前）
    this.notes = files.sort((a, b) => b.stat.mtime - a.stat.mtime);
    this.renderNoteList();
  }

  searchNotes() {
    const query = this.searchInput.value.toLowerCase();
    if (!query) {
      this.renderNoteList();
      return;
    }

    const filteredNotes = this.notes.filter(note => 
      note.name.toLowerCase().includes(query) ||
      note.path.toLowerCase().includes(query)
    );
    this.renderNoteList(filteredNotes);
  }

  renderNoteList(notesToRender?: TFile[]) {
    this.noteList.empty();
    const notes = notesToRender || this.notes;

    notes.forEach(note => {
      const noteItem = this.noteList.createDiv({ cls: 'note-item' });
      noteItem.createEl('span', { text: note.name, cls: 'note-name' });
      noteItem.createEl('span', { text: note.path, cls: 'note-path' });
      
      const addButton = noteItem.createEl('button', { text: '+', cls: 'add-button' });
      addButton.addEventListener('click', () => this.addNote(note));
    });
  }

  addNote(note: TFile) {
    if (!this.selectedNotes.includes(note)) {
      this.selectedNotes.push(note);
      this.renderSelectedNotes();
      this.updateMergedNoteName();
    }
  }

  removeNote(note: TFile) {
    this.selectedNotes = this.selectedNotes.filter(n => n !== note);
    this.renderSelectedNotes();
    this.updateMergedNoteName();
  }

  renderSelectedNotes(container?: HTMLElement) {
    const listContainer = container || this.noteList.parentElement?.querySelector('.selected-list');
    if (!listContainer) return;
    
    listContainer.empty();
    
    this.selectedNotes.forEach((note, index) => {
      const noteItem = listContainer.createDiv({ 
        cls: 'selected-note-item'
      });
      noteItem.draggable = true;
      noteItem.dataset.index = index.toString();
      
      const dragHandle = noteItem.createEl('span', { text: '⋮', cls: 'drag-handle' });
      noteItem.createEl('span', { text: note.name, cls: 'note-name' });
      
      const removeButton = noteItem.createEl('button', { text: '×', cls: 'remove-button' });
      removeButton.addEventListener('click', () => this.removeNote(note));
      
      // 拖动排序
      noteItem.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', index.toString());
        noteItem.addClass('dragging');
      });
      
      noteItem.addEventListener('dragend', () => {
        noteItem.removeClass('dragging');
      });
      
      noteItem.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      
      noteItem.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '-1');
        const toIndex = index;
        
        if (fromIndex !== -1 && fromIndex !== toIndex) {
          const [movedNote] = this.selectedNotes.splice(fromIndex, 1);
          this.selectedNotes.splice(toIndex, 0, movedNote);
          this.renderSelectedNotes();
          this.updateMergedNoteName();
        }
      });
    });
  }

  updateMergedNoteName() {
    if (!this.mergedNoteName.value && this.selectedNotes.length > 0) {
      this.mergedNoteName.placeholder = this.selectedNotes[0].name;
    }
  }

  private parseYamlFrontmatter(content: string): { frontmatter: any; body: string } {
    const yamlRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(yamlRegex);
    
    if (!match) {
      return { frontmatter: null, body: content };
    }
    
    const yamlContent = match[1];
    const body = match[2];
    
    // 简单的YAML解析
    const frontmatter: any = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        // 处理数组格式的值，如 tags: [tag1, tag2]
        if (value.startsWith('[') && value.endsWith(']')) {
          const arrayContent = value.slice(1, -1);
          frontmatter[key] = arrayContent.split(',').map(item => item.trim());
        } else {
          frontmatter[key] = value;
        }
      }
    }
    
    return { frontmatter, body };
  }

  private mergeYamlFrontmatter(frontmatters: any[]): any {
    const merged: any = {};
    const allTags: string[] = [];
    
    // 收集所有tags并去重
    for (const frontmatter of frontmatters) {
      if (frontmatter && frontmatter.tags) {
        if (Array.isArray(frontmatter.tags)) {
          allTags.push(...frontmatter.tags);
        } else {
          allTags.push(frontmatter.tags);
        }
      }
    }
    
    // 去重tags
    const uniqueTags = [...new Set(allTags)];
    
    // 找到第一个有title的frontmatter
    let titleFound = false;
    for (const frontmatter of frontmatters) {
      if (frontmatter && frontmatter.title) {
        merged.title = frontmatter.title;
        titleFound = true;
        break;
      }
    }
    
    // 如果没有找到title，使用第一个frontmatter（即使没有title）
    if (!titleFound && frontmatters.length > 0 && frontmatters[0]) {
      Object.assign(merged, frontmatters[0]);
    }
    
    // 设置合并后的tags
    if (uniqueTags.length > 0) {
      merged.tags = uniqueTags;
    }
    
    // 设置修改时间为当前时间
    merged.date = new Date().toISOString().split('T')[0];
    
    return merged;
  }

  private frontmatterToString(frontmatter: any): string {
    if (!frontmatter || Object.keys(frontmatter).length === 0) {
      return '';
    }
    
    let yaml = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        yaml += `${key}: [${value.join(', ')}]\n`;
      } else {
        yaml += `${key}: ${value}\n`;
      }
    }
    yaml += '---\n';
    
    return yaml;
  }

  async mergeNotes() {
    if (this.selectedNotes.length === 0) {
      new Notice('请先选择要合并的笔记');
      return;
    }

    const mergedName = this.mergedNoteName.value || this.selectedNotes[0].name;
    const targetPath = this.targetFolder.value;
    
    // 解析所有笔记的YAML frontmatter和内容
    const frontmatters: any[] = [];
    const bodies: string[] = [];
    
    for (const file of this.selectedNotes) {
      const fileContent = await this.app.vault.read(file);
      const { frontmatter, body } = this.parseYamlFrontmatter(fileContent);
      if (frontmatter) {
        frontmatters.push(frontmatter);
      }
      bodies.push(body);
    }
    
    // 合并YAML frontmatter
    const mergedFrontmatter = this.mergeYamlFrontmatter(frontmatters);
    
    // 合并内容
    let mergedBody = '';
    for (let i = 0; i < bodies.length; i++) {
      mergedBody += bodies[i].trim();
      if (i < bodies.length - 1) {
        mergedBody += '\n\n' + this.plugin.settings.separator + '\n\n';
      }
    }
    
    // 组合最终内容
    const frontmatterString = this.frontmatterToString(mergedFrontmatter);
    const content = frontmatterString + mergedBody;

    // 确定目标路径
    let finalPath = mergedName;
    if (targetPath) {
      finalPath = targetPath + '/' + mergedName;
    }
    
    // 确保文件名以.md结尾
    if (!finalPath.endsWith('.md')) {
      finalPath += '.md';
    }

    // 创建合并后的笔记
    try {
      await this.app.vault.create(finalPath, content);
      new Notice(`已创建合并笔记：${finalPath}`);
      
      // 删除源笔记
      if (this.deleteCheckbox.checked) {
        const confirmed = await this.confirmDelete();
        if (confirmed) {
          for (const file of this.selectedNotes) {
            try {
              await this.app.vault.delete(file);
            } catch (error) {
              new Notice(`删除失败：${file.name}`);
            }
          }
          new Notice('已删除所有源笔记');
        }
      }
      
      this.close();
    } catch (error) {
      new Notice('合并失败：' + error.message);
    }
  }

  async confirmDelete(): Promise<boolean> {
    return new Promise(resolve => {
      const modal = new ConfirmModal(
        this.app,
        '确认删除',
        '确定要删除所有源笔记吗？此操作不可撤销。',
        resolve
      );
      modal.open();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class ConfirmModal extends Modal {
  title: string;
  message: string;
  callback: (result: boolean) => void;

  constructor(app: App, title: string, message: string, callback: (result: boolean) => void) {
    super(app);
    this.title = title;
    this.message = message;
    this.callback = callback;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: this.title });
    contentEl.createEl('p', { text: this.message });
    
    const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
    buttonContainer.createEl('button', { text: '取消', cls: 'cancel-button' })
      .addEventListener('click', () => {
        this.callback(false);
        this.close();
      });
    buttonContainer.createEl('button', { text: '确定', cls: 'confirm-button' })
      .addEventListener('click', () => {
        this.callback(true);
        this.close();
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class NoteMergerSettingTab extends PluginSettingTab {
  plugin: NoteMergerPlugin;

  constructor(app: App, plugin: NoteMergerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Note Merger 设置' });

    new Setting(containerEl)
      .setName('默认文件夹')
      .setDesc('合并后笔记的默认存放文件夹')
      .addText((text: any) => text
        .setPlaceholder('留空为当前文件夹')
        .setValue(this.plugin.settings.defaultFolder)
        .onChange(async (value: string) => {
          this.plugin.settings.defaultFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('高级设置')
      .setDesc('配置分隔符、删除选项等')
      .addButton((button: any) => button
        .setButtonText('进入')
        .setCta()
        .onClick(() => {
          this.displayAdvanced();
        }));
  }

  displayAdvanced(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: '高级设置' });

    // 返回按钮
    new Setting(containerEl)
      .setName('返回')
      .setDesc('返回基本设置')
      .addButton((button: any) => button
        .setButtonText('返回')
        .setCta()
        .onClick(() => {
          this.display();
        }));

    new Setting(containerEl)
      .setName('分隔符')
      .setDesc('合并笔记时使用的分隔符')
      .addText((text: any) => text
        .setValue(this.plugin.settings.separator)
        .onChange(async (value: string) => {
          this.plugin.settings.separator = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('自动删除源笔记')
      .setDesc('合并后自动删除源笔记（危险选项）')
      .addToggle((toggle: any) => toggle
        .setValue(this.plugin.settings.autoDelete)
        .onChange(async (value: boolean) => {
          this.plugin.settings.autoDelete = value;
          await this.plugin.saveSettings();
        }));
  }
}

class FolderSuggesterModal extends Modal {
  private folders: TFolder[];
  private callback: (folder: TFolder) => void;
  private searchInput: HTMLInputElement;
  private folderList: HTMLElement;

  constructor(app: App, callback: (folder: TFolder) => void) {
    super(app);
    this.callback = callback;
    this.folders = this.getAllFolders();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('folder-suggester-modal');

    contentEl.createEl('h2', { text: '选择文件夹' });

    // 搜索框
    const searchContainer = contentEl.createDiv({ cls: 'search-container' });
    this.searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: '搜索文件夹...',
      cls: 'search-input'
    });
    this.searchInput.addEventListener('input', () => this.searchFolders());

    // 文件夹列表
    this.folderList = contentEl.createDiv({ cls: 'folder-list' });
    this.renderFolders();

    // 取消按钮
    const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
    buttonContainer.createEl('button', { text: '取消', cls: 'cancel-button' })
      .addEventListener('click', () => this.close());
  }

  private getAllFolders(): TFolder[] {
    const folders: TFolder[] = [];
    const root = this.app.vault.getRoot();
    
    const traverse = (folder: TFolder) => {
      folders.push(folder);
      folder.children.forEach(child => {
        if (child instanceof TFolder) {
          traverse(child);
        }
      });
    };
    
    traverse(root);
    return folders;
  }

  private searchFolders() {
    const query = this.searchInput.value.toLowerCase();
    if (!query) {
      this.renderFolders();
      return;
    }

    const filteredFolders = this.folders.filter(folder => 
      folder.name.toLowerCase().includes(query) ||
      folder.path.toLowerCase().includes(query)
    );
    this.renderFolders(filteredFolders);
  }

  private renderFolders(foldersToRender?: TFolder[]) {
    this.folderList.empty();
    const folders = foldersToRender || this.folders;

    folders.forEach(folder => {
      const folderItem = this.folderList.createDiv({ cls: 'folder-item' });
      folderItem.createEl('span', { text: folder.name, cls: 'folder-name' });
      folderItem.createEl('span', { text: folder.path, cls: 'folder-path' });
      
      const selectButton = folderItem.createEl('button', { text: '选择', cls: 'select-button' });
      selectButton.addEventListener('click', () => {
        this.callback(folder);
        this.close();
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}