import './styles/tokens.css';
import './styles/app.css';
import { startApp } from './ui/app.ts';

const params = new URLSearchParams(window.location.search);
const embedded = params.get('embed') === '1';
if (embedded) document.documentElement.classList.add('embed');

const root = document.querySelector<HTMLElement>('#app');
if (root) startApp(root, params.get('doc'));

// When embedded (kokot.it case study), report the content height so the parent can size the iframe.
if (embedded && window.parent !== window) {
  const post = () =>
    window.parent.postMessage(
      { type: 'production-docs-agent:height', height: document.documentElement.scrollHeight },
      '*',
    );
  new ResizeObserver(post).observe(document.body);
  post();
}
