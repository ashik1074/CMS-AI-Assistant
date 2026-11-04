import { isValidElement, memo, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImageOff } from 'lucide-react';
import { isSafeUrl, sanitizeUrl } from '../../utils/markdown';
import { cn } from '../../utils/cn';
import { CodeBlock } from './CodeBlock';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

const components: Components = {
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (isValidElement(child)) {
      const { className, children: codeChildren } = (child as ReactElement<{ className?: string; children?: ReactNode }>).props;
      const language = /language-([\w+-]+)/.exec(className ?? '')?.[1];
      return <CodeBlock code={textOf(codeChildren)} language={language} />;
    }
    return <pre>{children}</pre>;
  },
  a({ href, children }) {
    if (!href || !isSafeUrl(href)) return <span className="underline decoration-dotted">{children}</span>;
    const external = /^https?:/i.test(href);
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
        {children}
      </a>
    );
  },
  // External images are not loaded automatically (avoids tracking pixels); show a safe link instead.
  img({ src, alt }) {
    const url = typeof src === 'string' && isSafeUrl(src) ? src : undefined;
    return (
      <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
        <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer nofollow">
            {alt || 'Image'}
          </a>
        ) : (
          alt || 'Image'
        )}
      </span>
    );
  },
  table({ children }) {
    return (
      <div className="table-wrap my-3 overflow-x-auto rounded-lg" tabIndex={0} role="region" aria-label="Table">
        <table>{children}</table>
      </div>
    );
  },
  input({ type, checked }) {
    if (type === 'checkbox') return <input type="checkbox" checked={!!checked} readOnly disabled aria-label={checked ? 'Completed' : 'Not completed'} />;
    return null;
  },
};

interface MarkdownProps {
  content: string;
  streaming?: boolean;
  className?: string;
}

/**
 * Renders untrusted Markdown safely: raw HTML is dropped (`skipHtml`), URLs are sanitized,
 * and nothing uses dangerouslySetInnerHTML.
 */
export const Markdown = memo(function Markdown({ content, streaming, className }: MarkdownProps) {
  return (
    <div className={cn('prose-chat', streaming && 'streaming-caret', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={sanitizeUrl} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
