import './styles/tokens.css';
import './styles/app.css';
import { resolveLang } from './i18n/index.ts';
import { startApp } from './ui/app.ts';
import { parentOrigin } from './ui/embed.ts';

const params = new URLSearchParams(window.location.search);
const embedded = params.get('embed') === '1';
if (embedded) document.documentElement.classList.add('embed');

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  startApp(root, {
    docId: params.get('doc'),
    lang: resolveLang(window.location.search, navigator.languages ?? [navigator.language]),
    // Keep the choice in the address bar, so a reload or a shared link opens the same language.
    onLangChange: (lang) => {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url);
    },
  });
}

// When embedded (kokot.it case study), report the content height so the parent can size the iframe.
if (embedded && window.parent !== window) {
  const target = parentOrigin(window.location.ancestorOrigins, document.referrer);
  const post = () =>
    window.parent.postMessage(
      // The body's own height, so the iframe can also shrink (scrollHeight never drops below it).
      {
        type: 'production-docs-agent:height',
        height: Math.ceil(document.body.getBoundingClientRect().height),
      },
      target,
    );
  new ResizeObserver(post).observe(document.body);
  post();
}
