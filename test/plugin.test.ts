import NoteMergerPlugin from '../src/main';
import { App, Plugin } from 'obsidian';

// Mock the loadData and saveData methods
jest.mock('obsidian', () => {
  const original = jest.requireActual('obsidian');
  return {
    ...original,
    Plugin: class {
      app: any;
      settings: any = {};
      addCommand = jest.fn();
      addSettingTab = jest.fn();
      registerEvent = jest.fn();
      loadData = jest.fn().mockResolvedValue({});
      saveData = jest.fn().mockResolvedValue(undefined);
      
      constructor(app?: any, manifest?: any) {
        this.app = app || {
          workspace: {
            on: jest.fn(),
            getLeavesOfType: jest.fn().mockReturnValue([])
          }
        };
      }
    }
  };
});

describe('NoteMergerPlugin', () => {
  let plugin: NoteMergerPlugin;

  beforeEach(() => {
    plugin = new NoteMergerPlugin(new App(), {} as any);
    plugin.app = {
      workspace: {
        on: jest.fn(),
        getLeavesOfType: jest.fn().mockReturnValue([])
      }
    } as any;
    // Initialize settings manually for testing
    plugin.settings = {
      language: 'zh',
      defaultFolder: '',
      separator: '---',
      autoDelete: false,
      hotkey: 'Ctrl+M'
    };
  });

  test('should create plugin instance', () => {
    expect(plugin).toBeInstanceOf(Plugin);
  });

  test('should have default settings', () => {
    expect(plugin.settings).toBeDefined();
    expect(plugin.settings.defaultFolder).toBe('');
    expect(plugin.settings.separator).toBe('---');
    expect(plugin.settings.autoDelete).toBe(false);
  });

  test('should add command on load', async () => {
    const addCommandSpy = jest.spyOn(plugin, 'addCommand');
    await plugin.onload();
    expect(addCommandSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'merge-notes',
        name: '合并笔记',
        callback: expect.any(Function)
      })
    );
  });

  test('should load settings', async () => {
    const loadDataSpy = jest.spyOn(plugin, 'loadData').mockResolvedValue({
      defaultFolder: 'test-folder',
      separator: '===',
      autoDelete: true
    });
    
    await plugin.loadSettings();
    expect(plugin.settings.defaultFolder).toBe('test-folder');
    expect(plugin.settings.separator).toBe('===');
    expect(plugin.settings.autoDelete).toBe(true);
  });

  test('should save settings', async () => {
    const saveDataSpy = jest.spyOn(plugin, 'saveData').mockResolvedValue();
    plugin.settings.defaultFolder = 'new-folder';
    
    await plugin.saveSettings();
    expect(saveDataSpy).toHaveBeenCalledWith(plugin.settings);
  });
});