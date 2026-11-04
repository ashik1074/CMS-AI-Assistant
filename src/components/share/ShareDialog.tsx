import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, Link2, Share2 } from 'lucide-react';
import type { Conversation } from '../../types/conversation';
import { copyToClipboard } from '../../utils/clipboard';
import { buildSharedChat, encodeSharedChat, hasUnsharedAttachments, sharedChatToMarkdown, shareUrl } from '../../utils/share';
import { Modal } from '../common/Modal';
import { useToast } from '../common/toastContext';

interface ShareDialogProps {
  conversation: Conversation | undefined;
  onClose: () => void;
}

/** Links longer than this may be cut off by some chat apps and email clients. */
const LONG_LINK = 8000;

const rowClass =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-zinc-700';

/** Shares a chat as a self-contained link, Markdown text or a .md file. */
export function ShareDialog({ conversation, onClose }: ShareDialogProps) {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'markdown' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Snapshot the chat when the dialog opens; later messages aren't added to the link.
  const [snapshot, setSnapshot] = useState(() => (conversation ? buildSharedChat(conversation) : null));
  const [snapshotFor, setSnapshotFor] = useState(conversation?.id);
  if (conversation?.id !== snapshotFor) {
    setSnapshotFor(conversation?.id);
    setSnapshot(conversation ? buildSharedChat(conversation) : null);
    setLink(null);
    setCopied(null);
  }

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    encodeSharedChat(snapshot).then((payload) => {
      if (!cancelled) setLink(shareUrl(payload));
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  const flash = (what: 'link' | 'markdown') => {
    setCopied(what);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  };

  const copy = async (what: 'link' | 'markdown', text: string) => {
    if (await copyToClipboard(text)) flash(what);
    else toast.show("Couldn't copy to the clipboard. Your browser may have blocked access.", { kind: 'error' });
  };

  const nativeShare = async () => {
    if (!link || !snapshot) return;
    try {
      await navigator.share({ title: snapshot.title, url: link });
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') toast.show("Couldn't open the share sheet.", { kind: 'error' });
    }
  };

  const download = () => {
    if (!snapshot) return;
    const blob = new Blob([sharedChatToMarkdown(snapshot)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'chat'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Modal open={!!conversation} title="Share chat" description={conversation ? `“${conversation.title}”` : undefined} onClose={onClose}>
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 pl-3 dark:border-zinc-700 dark:bg-zinc-900">
        <Link2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
        <input
          readOnly
          value={link ?? 'Creating link…'}
          aria-label="Share link"
          data-testid="share-link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate bg-transparent text-sm text-zinc-600 outline-none dark:text-zinc-300"
        />
        <button type="button" className="btn-primary min-h-9 shrink-0 rounded-lg" disabled={!link} onClick={() => link && copy('link', link)}>
          {copied === 'link' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Anyone with the link can read this chat as it is now. The messages are stored in the link itself, not on a server.
        {conversation && hasUnsharedAttachments(conversation) && ' Attached files are not included.'}
        {link && link.length > LONG_LINK && ' This link is long, so some apps may cut it off. If that happens, share it as Markdown.'}
      </p>

      <div className="mt-3 space-y-1 border-t border-zinc-200 pt-2 dark:border-zinc-700">
        {canNativeShare && (
          <button type="button" className={`${rowClass} -mx-1 w-[calc(100%+0.5rem)]`} disabled={!link} onClick={nativeShare}>
            <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Share via…
          </button>
        )}
        <button type="button" className={`${rowClass} -mx-1 w-[calc(100%+0.5rem)]`} disabled={!snapshot} onClick={() => snapshot && copy('markdown', sharedChatToMarkdown(snapshot))}>
          {copied === 'markdown' ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {copied === 'markdown' ? 'Copied as Markdown' : 'Copy as Markdown'}
        </button>
        <button type="button" className={`${rowClass} -mx-1 w-[calc(100%+0.5rem)]`} disabled={!snapshot} onClick={download}>
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          Download .md file
        </button>
      </div>
    </Modal>
  );
}
