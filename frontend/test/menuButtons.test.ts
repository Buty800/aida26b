/**
 * @jest-environment jsdom
 */

describe('Menu Buttons', () => {
  beforeEach(() => {
    document.body.innerHTML = `
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

  test('Theme toggle button works', async () => {
    await import('../src/app');

    document.dispatchEvent(new Event('DOMContentLoaded'));

    const btn = document.getElementById(
      'theme-toggle'
    ) as HTMLButtonElement;

    const initial =
      document.body.getAttribute('data-theme') || 'light';

    btn.click();

    const after =
      document.body.getAttribute('data-theme') || 'light';

    expect(after).not.toBe(initial);
  });
});