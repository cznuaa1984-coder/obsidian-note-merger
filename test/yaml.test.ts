import NoteMergerPlugin from '../src/main';
import { App } from 'obsidian';

// Mock the Modal and other dependencies
jest.mock('obsidian', () => {
  const original = jest.requireActual('obsidian');
  return {
    ...original,
    Modal: class {
      app: any;
      contentEl: any = {
        empty: jest.fn(),
        createEl: jest.fn().mockReturnThis(),
        createDiv: jest.fn().mockReturnThis(),
        addClass: jest.fn()
      };
      open = jest.fn();
      close = jest.fn();
    }
  };
});

describe('YAML Frontmatter Parsing', () => {
  let plugin: NoteMergerPlugin;
  let modal: any;

  beforeEach(() => {
    plugin = new NoteMergerPlugin(new App(), {} as any);
    plugin.settings = {
      language: 'zh',
      defaultFolder: '',
      separator: '---',
      autoDelete: false,
      hotkey: 'Ctrl+M'
    };
    
    // Import the modal class dynamically
    const NoteMergerModal = require('../src/main').NoteMergerModal;
    modal = new NoteMergerModal(plugin.app, plugin);
  });

  test('should parse YAML frontmatter correctly', () => {
    const content = `---
title: Test Note
tags: [tag1, tag2]
date: 2024-01-01
---

This is the body of the note.`;

    const result = modal.parseYamlFrontmatter(content);
    
    expect(result.frontmatter).toEqual({
      title: 'Test Note',
      tags: ['tag1', 'tag2'],
      date: '2024-01-01'
    });
    expect(result.body).toBe('This is the body of the note.');
  });

  test('should handle content without YAML frontmatter', () => {
    const content = 'This is a note without YAML frontmatter.';
    
    const result = modal.parseYamlFrontmatter(content);
    
    expect(result.frontmatter).toBeNull();
    expect(result.body).toBe(content);
  });

  test('should merge YAML frontmatter correctly', () => {
    const frontmatters = [
      { title: 'Note 1', tags: ['tag1', 'tag2'], date: '2024-01-01' },
      { title: 'Note 2', tags: ['tag2', 'tag3'], date: '2024-01-02' },
      { title: 'Note 3', tags: ['tag4'], date: '2024-01-03' }
    ];

    const merged = modal.mergeYamlFrontmatter(frontmatters);
    
    expect(merged.title).toBe('Note 1'); // Uses first note's title
    expect(merged.tags).toEqual(['tag1', 'tag2', 'tag3', 'tag4']); // Merged and deduplicated tags
    expect(merged.date).toBeDefined(); // Should have a date
  });

  test('should convert frontmatter to string correctly', () => {
    const frontmatter = {
      title: 'Test Note',
      tags: ['tag1', 'tag2'],
      date: '2024-01-01'
    };

    const yamlString = modal.frontmatterToString(frontmatter);
    
    expect(yamlString).toContain('---');
    expect(yamlString).toContain('title: Test Note');
    expect(yamlString).toContain('tags: [tag1, tag2]');
    expect(yamlString).toContain('date: 2024-01-01');
  });

  test('should handle empty frontmatter', () => {
    const frontmatter = {};
    
    const yamlString = modal.frontmatterToString(frontmatter);
    
    expect(yamlString).toBe('');
  });

  test('should merge multiple notes with tags correctly', () => {
    const notes = [
      {
        content: `---
title: Note 1
tags: [javascript, react]
date: 2024-01-01
---

First note content.`,
      },
      {
        content: `---
title: Note 2
tags: [react, typescript]
date: 2024-01-02
---

Second note content.`,
      },
      {
        content: `---
title: Note 3
tags: [typescript, node.js]
date: 2024-01-03
---

Third note content.`,
      },
    ];

    // Parse all notes
    const frontmatters: any[] = [];
    const bodies: string[] = [];
    
    for (const note of notes) {
      const { frontmatter, body } = modal.parseYamlFrontmatter(note.content);
      if (frontmatter) {
        frontmatters.push(frontmatter);
      }
      bodies.push(body);
    }
    
    // Merge frontmatter
    const mergedFrontmatter = modal.mergeYamlFrontmatter(frontmatters);
    
    // Merge bodies
    const separator = '---';
    let mergedBody = '';
    for (let i = 0; i < bodies.length; i++) {
      mergedBody += bodies[i].trim();
      if (i < bodies.length - 1) {
        mergedBody += '\n\n' + separator + '\n\n';
      }
    }
    
    // Create final content
    const frontmatterString = modal.frontmatterToString(mergedFrontmatter);
    const finalContent = frontmatterString + mergedBody;
    
    // Verify results
    expect(mergedFrontmatter.title).toBe('Note 1'); // First note's title
    expect(mergedFrontmatter.tags).toEqual(['javascript', 'react', 'typescript', 'node.js']); // All tags merged and deduplicated
    expect(mergedFrontmatter.date).toBeDefined(); // Should have a date
    
    expect(finalContent).toContain('---');
    expect(finalContent).toContain('title: Note 1');
    expect(finalContent).toContain('tags: [javascript, react, typescript, node.js]');
    expect(finalContent).toContain('First note content.');
    expect(finalContent).toContain(separator);
    expect(finalContent).toContain('Second note content.');
    expect(finalContent).toContain('Third note content.');
  });

  test('should handle notes with mixed YAML and non-YAML content', () => {
    const notes = [
      {
        content: `---
title: Note with YAML
tags: [tag1]
---

Has YAML frontmatter.`,
      },
      {
        content: `No YAML frontmatter here.`,
      },
      {
        content: `---
title: Another note
tags: [tag2]
---

Another note with YAML.`,
      },
    ];

    // Parse all notes
    const frontmatters: any[] = [];
    const bodies: string[] = [];
    
    for (const note of notes) {
      const { frontmatter, body } = modal.parseYamlFrontmatter(note.content);
      if (frontmatter) {
        frontmatters.push(frontmatter);
      }
      bodies.push(body);
    }
    
    // Merge frontmatter
    const mergedFrontmatter = modal.mergeYamlFrontmatter(frontmatters);
    
    // Verify results
    expect(mergedFrontmatter.title).toBe('Note with YAML'); // First note's title
    expect(mergedFrontmatter.tags).toEqual(['tag1', 'tag2']); // All tags merged
    
    // Verify body content
    expect(bodies.length).toBe(3);
    expect(bodies[0]).toBe('Has YAML frontmatter.');
    expect(bodies[1]).toBe('No YAML frontmatter here.');
    expect(bodies[2]).toBe('Another note with YAML.');
  });

  test('should handle different titles when merging two notes', () => {
    const notes = [
      {
        content: `---
title: 项目计划
tags: [工作, 重要]
date: 2024-01-01
---
这是第一个笔记的内容。`,
      },
      {
        content: `---
title: 会议记录
tags: [工作, 会议]
date: 2024-01-02
---
这是第二个笔记的内容。`,
      },
    ];

    // Parse all notes
    const frontmatters: any[] = [];
    const bodies: string[] = [];
    
    for (const note of notes) {
      const { frontmatter, body } = modal.parseYamlFrontmatter(note.content);
      if (frontmatter) {
        frontmatters.push(frontmatter);
      }
      bodies.push(body);
    }
    
    // Merge frontmatter
    const mergedFrontmatter = modal.mergeYamlFrontmatter(frontmatters);
    
    // Merge bodies
    const separator = '---';
    let mergedBody = '';
    for (let i = 0; i < bodies.length; i++) {
      mergedBody += bodies[i].trim();
      if (i < bodies.length - 1) {
        mergedBody += '\n\n' + separator + '\n\n';
      }
    }
    
    // Create final content
    const frontmatterString = modal.frontmatterToString(mergedFrontmatter);
    const finalContent = frontmatterString + mergedBody;
    
    // Verify title handling - should use first note's title
    expect(mergedFrontmatter.title).toBe('项目计划');
    
    // Verify tags are merged
    expect(mergedFrontmatter.tags).toEqual(['工作', '重要', '会议']);
    
    // Verify date is updated
    expect(mergedFrontmatter.date).toBeDefined();
    
    // Verify final content structure
    expect(finalContent).toContain('title: 项目计划');
    expect(finalContent).toContain('tags: [工作, 重要, 会议]');
    expect(finalContent).toContain('这是第一个笔记的内容。');
    expect(finalContent).toContain(separator);
    expect(finalContent).toContain('这是第二个笔记的内容。');
    
    console.log('合并后的YAML frontmatter:');
    console.log(mergedFrontmatter);
    console.log('\n合并后的完整内容:');
    console.log(finalContent);
  });

  test('should use first note title as merged title', () => {
    const frontmatters = [
      { title: '第一个标题', tags: ['tag1'] },
      { title: '第二个标题', tags: ['tag2'] },
      { title: '第三个标题', tags: ['tag3'] }
    ];

    const merged = modal.mergeYamlFrontmatter(frontmatters);
    
    // Should always use the first note's title
    expect(merged.title).toBe('第一个标题');
    expect(merged.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  test('should handle notes where only some have titles', () => {
    const frontmatters = [
      { tags: ['tag1'] }, // No title
      { title: '第二个标题', tags: ['tag2'] },
      { tags: ['tag3'] } // No title
    ];

    const merged = modal.mergeYamlFrontmatter(frontmatters);
    
    // Should use the first note that has a title
    expect(merged.title).toBe('第二个标题');
    expect(merged.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });
});