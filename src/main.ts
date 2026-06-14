import { App, Modal, Notice, Plugin, TFile, TFolder, Vault, PluginSettingTab, Setting } from 'obsidian';

type Language = 'zh' | 'en';

interface Translations {
  [key: string]: { zh: string; en: string };
}

const i18n: Translations = {
  // Plugin
  pluginName: { zh: 'Note Merger', en: 'Note Merger' },
  commandName: { zh: '合并笔记', en: 'Merge Notes' },
  contextMenu: { zh: 'Note Merge', en: 'Note Merge' },

  // Modal
  title: { zh: '合并笔记', en: 'Merge Notes' },
  searchPlaceholder: { zh: '搜索笔记...', en: 'Search notes...' },
  selectedTitle: { zh: '已选笔记（拖动排序）', en: 'Selected Notes (drag to reorder)' },
  noteNameLabel: { zh: '合并后笔记名称：', en: 'Merged note name:' },
  noteNamePlaceholder: { zh: '默认：第一个文件名_合并', en: 'Default: first filename_merged' },
  targetFolderLabel: { zh: '目标文件夹：', en: 'Target folder:' },
  targetFolderPlaceholder: { zh: '默认为当前文件夹', en: 'Default: current folder' },
  selectFolder: { zh: '选择文件夹', en: 'Select folder' },
  deleteSource: { zh: '合并后删除源笔记（不可撤销）', en: 'Delete source notes after merge (irreversible)' },
  cancel: { zh: '取消', en: 'Cancel' },
  merge: { zh: '合并', en: 'Merge' },
  add: { zh: '+', en: '+' },
  remove: { zh: '×', en: '×' },

  // Folder Suggester
  folderTitle: { zh: '选择文件夹', en: 'Select Folder' },
  folderSearchPlaceholder: { zh: '搜索文件夹...', en: 'Search folders...' },
  select: { zh: '选择', en: 'Select' },

  // Confirm Modal
  confirmTitle: { zh: '确认删除', en: 'Confirm Delete' },
  confirmMessage: { zh: '确定要删除所有源笔记吗？此操作不可撤销。', en: 'Delete all source notes? This cannot be undone.' },
  confirm: { zh: '确定', en: 'Confirm' },

  // Notices
  noNotesSelected: { zh: '请先选择要合并的笔记', en: 'Please select notes to merge' },
  mergeSuccess: { zh: '已创建合并笔记：', en: 'Merged note created: ' },
  deleteFailed: { zh: '删除失败：', en: 'Delete failed: ' },
  allDeleted: { zh: '已删除所有源笔记', en: 'All source notes deleted' },
  mergeFailed: { zh: '合并失败：', en: 'Merge failed: ' },

  // Settings
  settingsTitle: { zh: 'Note Merger 设置', en: 'Note Merger Settings' },
  language: { zh: '语言', en: 'Language' },
  languageDesc: { zh: '选择插件界面语言', en: 'Select plugin interface language' },
  defaultFolder: { zh: '默认文件夹', en: 'Default Folder' },
  defaultFolderDesc: { zh: '合并后笔记的默认存放文件夹', en: 'Default folder for merged notes' },
  defaultFolderPlaceholder: { zh: '留空为当前文件夹', en: 'Leave empty for current folder' },
  advancedSettings: { zh: '高级设置', en: 'Advanced Settings' },
  advancedSettingsDesc: { zh: '配置分隔符、删除选项等', en: 'Configure separator, delete options, etc.' },
  enter: { zh: '进入', en: 'Enter' },
  advancedTitle: { zh: '高级设置', en: 'Advanced Settings' },
  back: { zh: '返回', en: 'Back' },
  backDesc: { zh: '返回基本设置', en: 'Back to basic settings' },
  separator: { zh: '分隔符', en: 'Separator' },
  separatorDesc: { zh: '合并笔记时使用的分隔符', en: 'Separator used when merging notes' },
  autoDelete: { zh: '自动删除源笔记', en: 'Auto-delete source notes' },
  autoDeleteDesc: { zh: '合并后自动删除源笔记（危险选项）', en: 'Auto-delete source notes after merge (dangerous)' },
};

function t(key: string, lang: Language): string {
  return i18n[key]?.[lang] || i18n[key]?.['zh'] || key;
}

interface NoteMergerSettings {
  language: Language;
  defaultFolder: string;
  separator: string;
  autoDelete: boolean;
  hotkey: string;
}

const DEFAULT_SETTINGS: NoteMergerSettings = {
  language: 'zh',
  defaultFolder: '',
  separator: '---',
  autoDelete: false,
  hotkey: 'Ctrl+M'
};

export default class NoteMergerPlugin extends Plugin {
  settings: NoteMergerSettings;
  preSelectedFiles: TFile[] = [];

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'merge-notes',
      name: t('commandName', this.settings.language),
      callback: () => new NoteMergerModal(this.app, this).open()
    });

    // 右键菜单：将选中的文件添加到合并列表
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        const filesToAdd: TFile[] = [];
        const addedPaths = new Set<string>();

        // 尝试从文件浏览器DOM获取所有选中的文件
        const fileExplorer = this.app.workspace.getLeavesOfType('file-explorer')[0];
        if (fileExplorer) {
          const container = fileExplorer.view.containerEl;
          // 查找所有选中的文件项
          const selectedItems = container.querySelectorAll('.tree-item-self.is-selected');
          selectedItems.forEach((item) => {
            // 从DOM获取文件路径
            const path = item.getAttribute('data-path');
            if (path) {
              const tfile = this.app.vault.getAbstractFileByPath(path);
              if (tfile instanceof TFile && tfile.extension === 'md' && !addedPaths.has(path)) {
                filesToAdd.push(tfile);
                addedPaths.add(path);
              }
            }
          });
        }

        // 如果DOM方式没有获取到，使用右键的单个文件
        if (filesToAdd.length === 0 && file instanceof TFile && file.extension === 'md') {
          filesToAdd.push(file);
        }

        if (filesToAdd.length > 0) {
          menu.addItem((item) => {
            item
              .setTitle(t('contextMenu', this.settings.language))
              .setIcon('file-input')
              .onClick(() => {
                this.preSelectedFiles = filesToAdd;
                new NoteMergerModal(this.app, this).open();
              });
          });
        }
      })
    );

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

  t(key: string): string {
    return t(key, this.settings.language);
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

    contentEl.createEl('h2', { text: this.plugin.t('title') });

    // 搜索框
    const searchContainer = contentEl.createDiv({ cls: 'search-container' });
    this.searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: this.plugin.t('searchPlaceholder'),
      cls: 'search-input'
    });
    this.searchInput.addEventListener('input', () => this.searchNotes());

    // 笔记列表
    this.noteList = contentEl.createDiv({ cls: 'note-list' });
    this.loadAllNotes();

    // 处理右键菜单预选的文件
    if (this.plugin.preSelectedFiles.length > 0) {
      for (const file of this.plugin.preSelectedFiles) {
        if (!this.selectedNotes.includes(file)) {
          this.selectedNotes.push(file);
        }
      }
      this.plugin.preSelectedFiles = [];
      this.updateMergedNoteName();
    }

    // 已选笔记列表
    const selectedContainer = contentEl.createDiv({ cls: 'selected-container' });
    selectedContainer.createEl('h3', { text: this.plugin.t('selectedTitle') });
    const selectedList = selectedContainer.createDiv({ cls: 'selected-list' });
    this.renderSelectedNotes(selectedList);

    // 设置区域
    const settingsContainer = contentEl.createDiv({ cls: 'settings-container' });
    
    // 合并后笔记名称
    const nameContainer = settingsContainer.createDiv({ cls: 'setting-item' });
    nameContainer.createEl('label', { text: this.plugin.t('noteNameLabel') });
    this.mergedNoteName = nameContainer.createEl('input', {
      type: 'text',
      placeholder: this.plugin.t('noteNamePlaceholder'),
      cls: 'name-input'
    });

    // 目标文件夹
    const folderContainer = settingsContainer.createDiv({ cls: 'setting-item' });
    folderContainer.createEl('label', { text: this.plugin.t('targetFolderLabel') });
    
    const folderInputContainer = folderContainer.createDiv({ cls: 'folder-input-container' });
    this.targetFolder = folderInputContainer.createEl('input', {
      type: 'text',
      placeholder: this.plugin.t('targetFolderPlaceholder'),
      value: this.plugin.settings.defaultFolder,
      cls: 'folder-input'
    });
    
    const folderSelectButton = folderInputContainer.createEl('button', { 
      text: this.plugin.t('selectFolder'), 
      cls: 'folder-select-button' 
    });
    folderSelectButton.addEventListener('click', () => {
      new FolderSuggesterModal(this.app, this.plugin, (folder) => {
        this.targetFolder.value = folder.path;
      }).open();
    });

    // 删除源笔记选项
    const deleteContainer = settingsContainer.createDiv({ cls: 'setting-item' });
    this.deleteCheckbox = deleteContainer.createEl('input', {
      type: 'checkbox',
      cls: 'delete-checkbox'
    });
    deleteContainer.createEl('label', { text: this.plugin.t('deleteSource') });

    // 按钮区域
    const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
    buttonContainer.createEl('button', { text: this.plugin.t('cancel'), cls: 'cancel-button' })
      .addEventListener('click', () => this.close());
    buttonContainer.createEl('button', { text: this.plugin.t('merge'), cls: 'merge-button' })
      .addEventListener('click', () => this.mergeNotes());
  }

  async loadAllNotes() {
    const files = this.app.vault.getMarkdownFiles();
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
      
      const addButton = noteItem.createEl('button', { text: this.plugin.t('add'), cls: 'add-button' });
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
      
      const removeButton = noteItem.createEl('button', { text: this.plugin.t('remove'), cls: 'remove-button' });
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
      this.mergedNoteName.placeholder = this.selectedNotes[0].name + '_合并';
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
    
    const frontmatter: any = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
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
    
    for (const frontmatter of frontmatters) {
      if (frontmatter && frontmatter.tags) {
        if (Array.isArray(frontmatter.tags)) {
          allTags.push(...frontmatter.tags);
        } else {
          allTags.push(frontmatter.tags);
        }
      }
    }
    
    const uniqueTags = [...new Set(allTags)];
    
    let titleFound = false;
    for (const frontmatter of frontmatters) {
      if (frontmatter && frontmatter.title) {
        merged.title = frontmatter.title;
        titleFound = true;
        break;
      }
    }
    
    if (!titleFound && frontmatters.length > 0 && frontmatters[0]) {
      Object.assign(merged, frontmatters[0]);
    }
    
    if (uniqueTags.length > 0) {
      merged.tags = uniqueTags;
    }
    
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
      new Notice(this.plugin.t('noNotesSelected'));
      return;
    }

    const mergedName = this.mergedNoteName.value || this.selectedNotes[0].name + '_合并';
    const targetPath = this.targetFolder.value;
    
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
    
    const mergedFrontmatter = this.mergeYamlFrontmatter(frontmatters);
    
    let mergedBody = '';
    for (let i = 0; i < bodies.length; i++) {
      mergedBody += bodies[i].trim();
      if (i < bodies.length - 1) {
        mergedBody += '\n\n' + this.plugin.settings.separator + '\n\n';
      }
    }
    
    const frontmatterString = this.frontmatterToString(mergedFrontmatter);
    const content = frontmatterString + mergedBody;

    let finalPath = mergedName;
    if (targetPath) {
      finalPath = targetPath + '/' + mergedName;
    }
    
    if (!finalPath.endsWith('.md')) {
      finalPath += '.md';
    }

    try {
      await this.app.vault.create(finalPath, content);
      new Notice(this.plugin.t('mergeSuccess') + finalPath);
      
      if (this.deleteCheckbox.checked) {
        const confirmed = await this.confirmDelete();
        if (confirmed) {
          for (const file of this.selectedNotes) {
            try {
              await this.app.vault.delete(file);
            } catch (error) {
              new Notice(this.plugin.t('deleteFailed') + file.name);
            }
          }
          new Notice(this.plugin.t('allDeleted'));
        }
      }
      
      this.close();
    } catch (error) {
      new Notice(this.plugin.t('mergeFailed') + error.message);
    }
  }

  async confirmDelete(): Promise<boolean> {
    return new Promise(resolve => {
      const modal = new ConfirmModal(
        this.app,
        this.plugin,
        this.plugin.t('confirmTitle'),
        this.plugin.t('confirmMessage'),
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
  private title: string;
  private message: string;
  private callback: (result: boolean) => void;
  private plugin: NoteMergerPlugin;

  constructor(app: App, plugin: NoteMergerPlugin, title: string, message: string, callback: (result: boolean) => void) {
    super(app);
    this.plugin = plugin;
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
    buttonContainer.createEl('button', { text: this.plugin.t('cancel'), cls: 'cancel-button' })
      .addEventListener('click', () => {
        this.callback(false);
        this.close();
      });
    buttonContainer.createEl('button', { text: this.plugin.t('confirm'), cls: 'confirm-button' })
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
    const lang = this.plugin.settings.language;
    containerEl.empty();

    containerEl.createEl('h2', { text: this.plugin.t('settingsTitle') });

    // 语言设置
    new Setting(containerEl)
      .setName(this.plugin.t('language'))
      .setDesc(this.plugin.t('languageDesc'))
      .addDropdown((dropdown: any) => dropdown
        .addOption('zh', '中文')
        .addOption('en', 'English')
        .setValue(lang)
        .onChange(async (value: Language) => {
          this.plugin.settings.language = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    // 默认文件夹
    new Setting(containerEl)
      .setName(this.plugin.t('defaultFolder'))
      .setDesc(this.plugin.t('defaultFolderDesc'))
      .addText((text: any) => text
        .setPlaceholder(this.plugin.t('defaultFolderPlaceholder'))
        .setValue(this.plugin.settings.defaultFolder)
        .onChange(async (value: string) => {
          this.plugin.settings.defaultFolder = value;
          await this.plugin.saveSettings();
        }));

    // 高级设置入口
    new Setting(containerEl)
      .setName(this.plugin.t('advancedSettings'))
      .setDesc(this.plugin.t('advancedSettingsDesc'))
      .addButton((button: any) => button
        .setButtonText(this.plugin.t('enter'))
        .setCta()
        .onClick(() => {
          this.displayAdvanced();
        }));
  }

  displayAdvanced(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: this.plugin.t('advancedTitle') });

    // 返回按钮
    new Setting(containerEl)
      .setName(this.plugin.t('back'))
      .setDesc(this.plugin.t('backDesc'))
      .addButton((button: any) => button
        .setButtonText(this.plugin.t('back'))
        .setCta()
        .onClick(() => {
          this.display();
        }));

    // 分隔符
    new Setting(containerEl)
      .setName(this.plugin.t('separator'))
      .setDesc(this.plugin.t('separatorDesc'))
      .addText((text: any) => text
        .setValue(this.plugin.settings.separator)
        .onChange(async (value: string) => {
          this.plugin.settings.separator = value;
          await this.plugin.saveSettings();
        }));

    // 自动删除
    new Setting(containerEl)
      .setName(this.plugin.t('autoDelete'))
      .setDesc(this.plugin.t('autoDeleteDesc'))
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
  private plugin: NoteMergerPlugin;

  constructor(app: App, plugin: NoteMergerPlugin, callback: (folder: TFolder) => void) {
    super(app);
    this.plugin = plugin;
    this.callback = callback;
    this.folders = this.getAllFolders();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('folder-suggester-modal');

    contentEl.createEl('h2', { text: this.plugin.t('folderTitle') });

    // 搜索框
    const searchContainer = contentEl.createDiv({ cls: 'search-container' });
    this.searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: this.plugin.t('folderSearchPlaceholder'),
      cls: 'search-input'
    });
    this.searchInput.addEventListener('input', () => this.searchFolders());

    // 文件夹列表
    this.folderList = contentEl.createDiv({ cls: 'folder-list' });
    this.renderFolders();

    // 取消按钮
    const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
    buttonContainer.createEl('button', { text: this.plugin.t('cancel'), cls: 'cancel-button' })
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
      
      const selectButton = folderItem.createEl('button', { text: this.plugin.t('select'), cls: 'select-button' });
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