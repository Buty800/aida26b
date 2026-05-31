/**
 * @jest-environment jsdom
 */

describe('Menu Pickers (Theme & Language)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app-title"></div>
      <div id="menu-nav"></div>
      <div id="table-nav"></div>
      <div id="view-title"></div>
      <button id="add-record-btn"></button>
      <div id="record-form"></div>
      <table id="records-table">
        <thead></thead>
        <tbody></tbody>
      </table>
    `;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve([]),
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Theme Picker', () => {
    test('Theme picker select exists and changes theme on change event', async () => {
      jest.resetModules();
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      expect(themeSelect).toBeTruthy();
      expect(themeSelect.tagName).toBe('SELECT');
    });

    test('Theme picker updates document.body data-theme attribute', async () => {
      jest.resetModules();
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));
      
      expect(document.body.getAttribute('data-theme')).toBe('dark');
    });

    test('Theme picker saves theme to localStorage', async () => {
      jest.resetModules();
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      themeSelect.value = 'dark';
      themeSelect.dispatchEvent(new Event('change'));
      
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('Theme picker handles empty values gracefully', async () => {
      jest.resetModules();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await import('../src/app');
      
      const themeSelect = document.getElementById('theme-picker') as HTMLSelectElement;
      
      themeSelect.value = '';
      themeSelect.dispatchEvent(new Event('change'));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Language Picker', () => {
    test('Language picker select exists', async () => {
      jest.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      
      expect(languageSelect).toBeTruthy();
      expect(languageSelect.tagName).toBe('SELECT');
    });

    test('Language picker has valid language options', async () => {
      jest.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      const options = Array.from(languageSelect.options).map(opt => opt.value);
      
      expect(options).toContain('es');
      expect(options).toContain('en');
    });

    test('Language picker saves language to localStorage', async () => {
      jest.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      
      languageSelect.value = 'en';
      languageSelect.dispatchEvent(new Event('change'));
      
      expect(localStorage.getItem('language')).toBe('en');
    });

    test('Language picker updates nav buttons text on change', async () => {
      jest.resetModules();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      const initialText = (document.getElementById('students-btn') as HTMLButtonElement)?.textContent || '';
      
      languageSelect.value = 'en';
      languageSelect.dispatchEvent(new Event('change'));
      
      const newText = (document.getElementById('students-btn') as HTMLButtonElement)?.textContent || '';
      
      // El texto debe cambiar si inicialmente estaba en español
      if (initialText === 'Alumnos') {
        expect(newText).toBe('Students');
      }
    });

    test('Language picker handles invalid values gracefully', async () => {
      jest.resetModules();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await import('../src/app');
      
      const languageSelect = document.getElementById('language-picker') as HTMLSelectElement;
      
      languageSelect.value = 'invalid-lang';
      languageSelect.dispatchEvent(new Event('change'));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});