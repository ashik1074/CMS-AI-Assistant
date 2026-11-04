import { memo, useEffect, useRef, useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import { useToast } from '../common/toastContext';

const LANGUAGE_ALIASES: Record<string, string> = { ts: 'typescript', js: 'javascript', py: 'python', sh: 'bash', shell: 'bash', html: 'markup', xml: 'markup' };

interface CodeBlockProps {
  code: string;
  language?: string;
}

/** Syntax-highlighted code block. Tokens are rendered as React elements — no HTML injection. */
export const CodeBlock = memo(function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const lang = language ? (LANGUAGE_ALIASES[language] ?? language) : 'text';
  const displayCode = code.replace(/\n$/, '');

  const onCopy = async () => {
    const ok = await copyToClipboard(displayCode);
    if (ok) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } else {
      toast.show("Couldn't copy code to the clipboard.", { kind: 'error' });
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-zinc-200 bg-[#282c34] dark:border-zinc-700">
      <div className="flex items-center justify-between bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300">
        <span className="font-mono">{language || 'text'}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={copied ? 'Code copied' : 'Copy code'}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Highlight theme={themes.oneDark} code={displayCode} language={lang}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed" tabIndex={0} aria-label={`${language || 'Code'} snippet`}>
            <code>
              {tokens.map((line, i) => {
                const { key: _lk, ...lineProps } = getLineProps({ line, key: i }) as ReturnType<typeof getLineProps> & { key?: unknown };
                void _lk;
                return (
                  <div key={i} {...lineProps} style={{ ...lineProps.style, background: 'transparent' }}>
                    {line.map((token, j) => {
                      const { key: _tk, ...tokenProps } = getTokenProps({ token, key: j }) as ReturnType<typeof getTokenProps> & { key?: unknown };
                      void _tk;
                      return <span key={j} {...tokenProps} />;
                    })}
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
});
