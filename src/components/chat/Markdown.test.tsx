import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '../common/Toast';
import { Markdown } from './Markdown';

const renderMd = (content: string) =>
  render(
    <ToastProvider>
      <Markdown content={content} />
    </ToastProvider>,
  );

describe('Markdown (security)', () => {
  it('does not render raw HTML or script tags', () => {
    const { container } = renderMd('Hello <script>window.__pwned = true</script> <img src=x onerror="window.__pwned=true"> <b>bold</b>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('strips javascript: and data: URLs from links', () => {
    const { container } = renderMd('[click](javascript:alert(1)) and [data](data:text/html,hi) and [ok](https://example.com)');
    const links = Array.from(container.querySelectorAll('a'));
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://example.com');
    expect(links[0].getAttribute('rel')).toContain('noopener');
    expect(links[0].getAttribute('target')).toBe('_blank');
  });

  it('does not auto-load markdown images', () => {
    const { container } = renderMd('![tracker](https://example.com/pixel.png)');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('tracker')).toBeInTheDocument();
  });

  it('renders GFM tables, task lists and highlighted code', () => {
    const { container } = renderMd('| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n\n```ts\nconst x = "<script>";\n```');
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeChecked();
    expect(container.querySelector('pre')?.textContent).toContain('const x = "<script>";');
    expect(container.querySelector('pre script')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });
});
