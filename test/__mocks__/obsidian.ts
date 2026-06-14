export class App {
  vault = new Vault();
}

export class Vault {
  private files: Map<string, string> = new Map();

  getMarkdownFiles() {
    return Array.from(this.files.keys()).map(path => new TFile(path));
  }

  async read(file: TFile) {
    return this.files.get(file.path) || '';
  }

  async create(path: string, content: string) {
    if (this.files.has(path)) {
      throw new Error('File already exists');
    }
    this.files.set(path, content);
    return new TFile(path);
  }

  async delete(file: TFile) {
    if (!this.files.has(file.path)) {
      throw new Error('File not found');
    }
    this.files.delete(file.path);
  }

  addFile(path: string, content: string) {
    this.files.set(path, content);
  }
}

export class TFile {
  path: string;
  name: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || path;
  }
}

export class TFolder {
  path: string;
  name: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || path;
  }
}

export class Modal {
  app: App;
  contentEl: any;

  constructor(app: App) {
    this.app = app;
    this.contentEl = {
      empty: jest.fn(),
      createEl: jest.fn().mockReturnThis(),
      createDiv: jest.fn().mockReturnThis(),
      addClass: jest.fn()
    };
  }

  open() {}
  close() {}
}

export class Notice {
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}

export class Plugin {
  app: App;
  settings: any;

  constructor() {
    this.app = new App();
    this.settings = {};
  }

  addCommand(command: any) {}
  addSettingTab(tab: any) {}
  async loadData() {
    return {};
  }
  async saveData(data: any) {}
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: any;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {
      empty: jest.fn(),
      createEl: jest.fn().mockReturnThis()
    };
  }
}

export class Setting {
  constructor(containerEl: any) {}

  setName(name: string) {
    return this;
  }

  setDesc(desc: string) {
    return this;
  }

  addText(callback: any) {
    return this;
  }

  addToggle(callback: any) {
    return this;
  }
}