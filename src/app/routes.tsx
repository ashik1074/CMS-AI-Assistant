import { useCallback, useEffect, useState } from 'react';

/**
 * Hash routes: `#/` (Product List, the landing page), `#/products/new` (Product Setup form),
 * `#/products/<productId>` (product details), `#/products/<productId>/edit` (draft product form),
 * and for the AI Assistant `#/assistant` (new chat), `#/c/<conversationId>`, `#/library` and `#/p/<projectId>`.
 * Hash routing needs no server config.
 */
export type Route =
  | { name: 'productList' }
  | { name: 'productNew' }
  /** The AI Assistant's new-chat screen. */
  | { name: 'home' }
  | { name: 'conversation'; conversationId: string }
  | { name: 'library' }
  | { name: 'project'; projectId: string }
  | { name: 'product'; productId: string }
  | { name: 'productDraft'; productId: string }
  /** A read-only chat someone shared; the whole snapshot is encoded in `payload`. */
  | { name: 'shared'; payload: string };

const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function parseHash(hash: string): Route {
  if (hash === '#/library') return { name: 'library' };
  if (hash === '#/assistant') return { name: 'home' };
  if (hash === '#/products/new') return { name: 'productNew' };
  const shared = /^#\/s\/([A-Za-z0-9_-]+)$/.exec(hash);
  if (shared) return { name: 'shared', payload: shared[1] };
  const product = /^#\/products\/([^/?#]+)(\/edit)?$/.exec(hash);
  if (product) {
    const id = decodeURIComponent(product[1]);
    if (ID_PATTERN.test(id)) return product[2] ? { name: 'productDraft', productId: id } : { name: 'product', productId: id };
  }
  const match = /^#\/([cp])\/([^/?#]+)$/.exec(hash);
  if (match) {
    const id = decodeURIComponent(match[2]);
    if (ID_PATTERN.test(id)) return match[1] === 'c' ? { name: 'conversation', conversationId: id } : { name: 'project', projectId: id };
  }
  return { name: 'productList' };
}

/** Pages of the portal itself, as opposed to the AI Assistant's chat layout. */
export const isProductRoute = (route: Route) => route.name === 'productList' || route.name === 'productNew' || route.name === 'product' || route.name === 'productDraft';

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'conversation':
      return `#/c/${encodeURIComponent(route.conversationId)}`;
    case 'project':
      return `#/p/${encodeURIComponent(route.projectId)}`;
    case 'library':
      return '#/library';
    case 'home':
      return '#/assistant';
    case 'productNew':
      return '#/products/new';
    case 'product':
      return `#/products/${encodeURIComponent(route.productId)}`;
    case 'productDraft':
      return `#/products/${encodeURIComponent(route.productId)}/edit`;
    case 'shared':
      return `#/s/${route.payload}`;
    default:
      return '#/';
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route, options: { replace?: boolean } = {}) => {
    const hash = routeToHash(next);
    if (window.location.hash !== hash) {
      if (options.replace) window.history.replaceState(null, '', hash);
      else window.history.pushState(null, '', hash);
    }
    setRoute(next);
  }, []);

  return { route, navigate };
}
