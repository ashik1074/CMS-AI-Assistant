import type { Attachment } from '../types/chat';
import { createId } from './id';

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Images plus common document types. Used for the file picker's `accept` attribute. */
export const ACCEPTED_FILE_TYPES = 'image/*,.pdf,.txt,.csv,.json,.md,.doc,.docx,.xls,.xlsx';
const THUMBNAIL_SIZE = 320;

export const isImage = (mimeType: string) => mimeType.startsWith('image/');

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Downscales an image to a small JPEG data URL so it fits comfortably in local storage. */
async function createThumbnail(file: File): Promise<string | undefined> {
  if (typeof createImageBitmap !== 'function') return undefined;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return undefined;
  }
}

export async function toAttachment(file: File): Promise<Attachment> {
  const mimeType = file.type || 'application/octet-stream';
  const attachment: Attachment = { id: createId(), name: file.name || 'file', mimeType, size: file.size };
  if (isImage(mimeType)) {
    const previewUrl = await createThumbnail(file);
    if (previewUrl) attachment.previewUrl = previewUrl;
  }
  return attachment;
}

/** Text the AI service receives for a message, so attachments are visible to it. */
export function promptWithAttachments(content: string, attachments: Attachment[] | undefined): string {
  if (!attachments?.length) return content;
  const note = `[Attached: ${attachments.map((a) => a.name).join(', ')}]`;
  return content ? `${content}\n\n${note}` : `Please review the attached file${attachments.length === 1 ? '' : 's'}.\n\n${note}`;
}
