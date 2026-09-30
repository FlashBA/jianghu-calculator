(() => {
  const data = window.WIKI_REFERENCE_DATA || {};
  const appViewNames = ['calculator', 'teams', 'cards', 'encyclopedia'];
  const viewElements = () => [
    document.getElementById('home-view'),
    ...appViewNames.map((name) => document.getElementById(`${name}-view`)),
    document.getElementById('guide-view'),
  ].filter(Boolean);

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function renderGuides() {
    const list = document.getElementById('guide-list');
    if (!list) return;
    list.innerHTML = (data.guide_notes || []).map((item) => `
      <details class="v03-guide-item">
        <summary><strong>${escapeHtml(item.title)}</strong><span>原版攻略 · P${escapeHtml(item.page || '-')}</span></summary>
        <p>${escapeHtml(item.text)}</p>
      </details>
    `).join('');
  }

  function updateActive(target) {
    document.querySelectorAll('[data-v03-target]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.v03Target === target);
    });
  }

  function hideAllViews() {
    viewElements().forEach((element) => { element.hidden = true; });
  }

  function show(target) {
    const normalized = target === 'guide' ? 'guide' : appViewNames.includes(target) ? target : 'home';
    hideAllViews();
    updateActive(normalized);

    if (normalized === 'home' || normalized === 'guide') {
      document.getElementById(`${normalized}-view`).hidden = false;
      return;
    }

    const navButton = document.querySelector(`#app-nav [data-view="${normalized}"]`);
    navButton?.click();
    const view = document.getElementById(`${normalized}-view`);
    if (view) view.hidden = false;
  }

  function openSearch(value) {
    const query = String(value || '').trim();
    if (!query) return;
    show('encyclopedia');
    const input = document.getElementById('encyclopedia-search');
    if (!input) return;
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function bind() {
    document.querySelectorAll('[data-v03-target]').forEach((button) => {
      button.addEventListener('click', () => show(button.dataset.v03Target));
    });

    const homeSearch = document.getElementById('home-search');
    homeSearch?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') openSearch(homeSearch.value);
    });
    document.querySelectorAll('[data-home-search]').forEach((button) => {
      button.addEventListener('click', () => {
        homeSearch.value = button.dataset.homeSearch;
        openSearch(button.dataset.homeSearch);
      });
    });

    const count = document.getElementById('home-encyclopedia-count');
    if (count) {
      count.textContent = `${data.characters?.length || 0} 位角色 · ${data.martial_arts?.length || 0} 门武学`;
    }
  }

  renderGuides();
  bind();
  const initialView = location.hash.replace('#', '');
  const initialTarget = ['calculator', 'teams', 'cards', 'encyclopedia', 'guide'].includes(initialView) ? initialView : 'home';
  show(initialTarget);
  window.addEventListener('jianghu-app-ready', () => show(initialTarget));
  window.addEventListener('hashchange', () => {
    const nextView = location.hash.replace('#', '');
    show(['calculator', 'teams', 'cards', 'encyclopedia', 'guide'].includes(nextView) ? nextView : 'home');
  });
})();
