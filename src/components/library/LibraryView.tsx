import { useMemo, useState } from 'react';
import { FileText, ImageOff, Library, Search } from 'lucide-react';
import type { Conversation } from '../../types/conversation';
import { formatFileSize, isImage } from '../../utils/attachments';
import { cn } from '../../utils/cn';
import { collectLibraryItems, filterLibraryItems, type LibraryFilter, type LibraryItem } from '../../utils/library';

interface LibraryViewProps {
  conversations: Conversation[];
  onOpenChat: (id: string) => void;
}

const FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'images', label: 'Images' },
  { value: 'documents', label: 'Documents' },
];

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Every document and image the user has attached, with a link back to the chat it was sent in. */
export function LibraryView({ conversations, onOpenChat }: LibraryViewProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [query, setQuery] = useState('');
  const all = useMemo(() => collectLibraryItems(conversations), [conversations]);
  const visible = useMemo(() => filterLibraryItems(all, filter, query), [all, filter, query]);
  const counts = useMemo(() => {
    const images = all.filter((i) => isImage(i.attachment.mimeType)).length;
    return { all: all.length, images, documents: all.length - images };
  }, [all]);
  const images = visible.filter((i) => isImage(i.attachment.mimeType));
  const documents = visible.filter((i) => !isImage(i.attachment.mimeType));

  return (
    <div className="chat-surface flex min-h-0 flex-1 flex-col overflow-y-auto pt-14" data-testid="library-view">
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Documents and images you&apos;ve attached in your chats.</p>

        {all.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300" aria-hidden="true">
              <Library className="h-7 w-7" />
            </span>
            <p className="mt-4 font-medium">No files yet</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">Attach documents or images with the + button in the message box. They&apos;ll appear here.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800" role="group" aria-label="Filter files">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm transition-colors',
                      filter === f.value ? 'bg-white font-medium shadow-sm dark:bg-zinc-700' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                    )}
                  >
                    {f.label} <span className="text-zinc-400">{counts[f.value]}</span>
                  </button>
                ))}
              </div>
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search files"
                  aria-label="Search files"
                  autoComplete="off"
                  className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
                />
              </div>
            </div>

            {visible.length === 0 && <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No files match your search.</p>}

            {images.length > 0 && (
              <section aria-labelledby="library-images" className="mt-6">
                <h2 id="library-images" className="mb-3 text-sm font-semibold">
                  Images
                </h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Images">
                  {images.map((item) => (
                    <li key={`${item.messageId}-${item.attachment.id}`}>
                      <ImageCard item={item} onOpenChat={onOpenChat} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {documents.length > 0 && (
              <section aria-labelledby="library-documents" className="mt-8">
                <h2 id="library-documents" className="mb-3 text-sm font-semibold">
                  Documents
                </h2>
                <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900" aria-label="Documents">
                  {documents.map((item) => (
                    <li key={`${item.messageId}-${item.attachment.id}`}>
                      <button
                        type="button"
                        onClick={() => onOpenChat(item.conversationId)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        title={`Open “${item.conversationTitle}”`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.attachment.name}</span>
                          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {formatFileSize(item.attachment.size)} · {dateFormat.format(item.createdAt)} · in {item.conversationTitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ImageCard({ item, onOpenChat }: { item: LibraryItem; onOpenChat: (id: string) => void }) {
  const { attachment } = item;
  return (
    <button
      type="button"
      onClick={() => onOpenChat(item.conversationId)}
      className="group block w-full overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
      title={`Open “${item.conversationTitle}”`}
    >
      <span className="block aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
        {attachment.previewUrl ? (
          <img src={attachment.previewUrl} alt={attachment.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-400">
            <ImageOff className="h-6 w-6" aria-label={`${attachment.name} (no preview)`} />
          </span>
        )}
      </span>
      <span className="block px-3 py-2">
        <span className="block truncate text-sm font-medium">{attachment.name}</span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">in {item.conversationTitle}</span>
      </span>
    </button>
  );
}
