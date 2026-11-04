import { useCallback, useEffect, useState } from 'react';

/**
 * Hash routes: `#/` (new chat), `#/c/<conversationId>`, `#/library`, `#/p/<projectId>`,
 * `#/products/<productId>` (product details) and `#/products/<productId>/edit` (draft product form).
 * Hash routing needs no server config.
 */
export type Route =
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
  return { name: 'home' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'conversation':
      return `#/c/${encodeURIComponent(route.conversationId)}`;
    case 'project':
      return `#/p/${encodeURIComponent(route.projectId)}`;
    case 'library':
      return '#/library';
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
