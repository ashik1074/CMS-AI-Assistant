import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AIService, GenerationOptions } from '../types/chat';
import { CONVERSATIONS_KEY, LocalConversationService } from '../services/conversationService';
import { MockAIService } from '../services/mockAIService';
import { MockProductApi, PRODUCTS_KEY } from '../services/productService';
import { buildProductDraft } from '../utils/productDraft';
import { RIDE_KINDS } from '../utils/rocketFlight';
import { App } from './App';

/** Wraps the real mock service with tiny delays so tests run quickly. */
function fastService(overrides: GenerationOptions = {}): AIService {
  const base = new MockAIService();
  const opts = { chunkDelayMs: 1, minThinkingMs: 10, stepDurationMs: 5, chunkSize: 20, ...overrides };
  return {
    streamResponse: (r, o) => base.streamResponse(r, { ...o, ...opts }),
    generateResponse: (r, o) => base.generateResponse(r, { ...o, ...opts }),
    cancelGeneration: (id) => base.cancelGeneration(id),
  };
}

function setup(service: AIService = fastService()) {
  const user = userEvent.setup();
  const conversationService = new LocalConversationService(localStorage);
  const utils = render(<App aiService={service} conversationService={conversationService} />);
  return { user, ...utils };
}

const composer = () => screen.getByRole('textbox', { name: 'Message AI Assistant' });
const lastAssistant = () => screen.getAllByTestId('assistant-message').at(-1)!;
const waitForStatus = (status: string) => waitFor(() => expect(lastAssistant()).toHaveAttribute('data-status', status), { timeout: 4000 });

describe('App', () => {
  it('shows the welcome screen, then sends a message and streams a response', async () => {
    const { user } = setup();
    expect(screen.getByRole('heading', { name: 'What can I help you with?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();

    await user.type(composer(), 'Hello there');
    await user.keyboard('{Enter}');

    expect(screen.queryByTestId('welcome-screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-message')).toHaveTextContent('Hello there');
    expect(composer()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument();

    await waitForStatus('completed');
    expect(lastAssistant()).toHaveTextContent(/demo assistant/i);
    expect(within(lastAssistant()).getByText(/^Thought for \d+ seconds?$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
    // Title generated from the first prompt, and the URL points at the conversation.
    expect(within(screen.getByRole('navigation', { name: 'Chat history' })).getByText('Hello there')).toBeInTheDocument();
    expect(window.location.hash).toMatch(/^#\/c\//);
  });

  it('Shift+Enter inserts a newline instead of sending', async () => {
    const { user } = setup();
    await user.type(composer(), 'line one{Shift>}{Enter}{/Shift}line two');
    expect(composer()).toHaveValue('line one\nline two');
    expect(screen.queryByTestId('user-message')).not.toBeInTheDocument();
  });

  it('does not send whitespace-only messages', async () => {
    const { user } = setup();
    await user.type(composer(), '   {Enter}');
    expect(screen.queryByTestId('user-message')).not.toBeInTheDocument();
  });

  it('offers a visual data card instead of the technical explainer, opening the products report', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: /Explain a technical concept/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show visual data/ }));
    expect(await screen.findByTestId('user-message')).toHaveTextContent('Show me visual report of products');
    await waitForStatus('completed');
    expect(await screen.findByTestId('product-report')).toBeInTheDocument();
  });

  it('starts a conversation from a suggestion card', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Create a Product/ }));
    await waitForStatus('completed');
    expect(await screen.findByTestId('product-setup')).toHaveAttribute('data-status', 'collecting');
  });

  it('shows the step timeline for complex requests only', async () => {
    const { user } = setup(fastService({ stepDurationMs: 80 }));
    await user.type(composer(), 'Help me plan a website launch{Enter}');
    const steps = await screen.findByRole('list', { name: 'Processing steps' });
    expect(within(steps).getByText('Understanding the request')).toBeInTheDocument();
    await waitFor(() => expect(steps.querySelector('[data-status="active"]')).not.toBeNull());
    await waitForStatus('completed');
    // Collapsed into a summary; expandable again.
    expect(screen.queryByRole('list', { name: 'Processing steps' })).not.toBeInTheDocument();
    const toggle = within(lastAssistant()).getByRole('button', { name: /Thought for/ });
    await user.click(toggle);
    const expanded = screen.getByRole('list', { name: 'Processing steps' });
    expect(expanded.querySelectorAll('[data-status="completed"]')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await user.type(composer(), 'Hello{Enter}');
    await waitForStatus('completed');
    expect(within(lastAssistant()).queryByRole('button', { name: /Thought for/ })).not.toBeInTheDocument();
  });

  it('stops generation, keeps partial text and marks the response cancelled', async () => {
    const { user } = setup(fastService({ chunkDelayMs: 15, chunkSize: 1 }));
    await user.type(composer(), 'Write a detailed guide about accessibility{Enter}');
    await waitForStatus('streaming');
    await user.click(screen.getByRole('button', { name: 'Stop generating' }));
    await waitForStatus('cancelled');
    const partial = lastAssistant().textContent;
    expect(screen.getByText('Response stopped before completion.')).toBeInTheDocument();
    expect(within(lastAssistant()).getByText(/^Stopped after/)).toBeInTheDocument();
    expect(within(lastAssistant()).queryByText(/Thought for/)).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 80));
    expect(lastAssistant().textContent).toBe(partial);
    // The user can continue chatting.
    await user.type(composer(), 'Hello{Enter}');
    await waitForStatus('completed');
  });

  it('regenerates the latest response with a new generation', async () => {
    const { user } = setup();
    await user.type(composer(), 'Explain how large language models work{Enter}');
    await waitForStatus('completed');
    const first = lastAssistant().textContent;
    await user.click(screen.getByRole('button', { name: 'Regenerate response' }));
    await waitForStatus('completed');
    expect(screen.getAllByTestId('assistant-message')).toHaveLength(1);
    expect(lastAssistant().textContent).not.toBe(first);
    expect(screen.getByTestId('regenerated-label')).toHaveTextContent('Regenerated');
  });

  it('edits a previous message and discards later messages', async () => {
    const { user } = setup();
    await user.type(composer(), 'Hello{Enter}');
    await waitForStatus('completed');
    await user.type(composer(), 'What is a headless CMS?{Enter}');
    await waitForStatus('completed');
    expect(screen.getAllByTestId('user-message')).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Edit message' })[0]);
    const editor = screen.getByRole('textbox', { name: 'Edit message' });
    await user.clear(editor);
    await user.type(editor, 'Write a TypeScript debounce function{Enter}');

    await waitForStatus('completed');
    expect(screen.getAllByTestId('user-message')).toHaveLength(1);
    expect(screen.getByTestId('user-message')).toHaveTextContent('Write a TypeScript debounce function');
    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.getAllByTestId('assistant-message')).toHaveLength(1);
    expect(lastAssistant()).toHaveTextContent('debounce');
  });

  it('shows a retryable error for the simulated failure scenario', async () => {
    const { user } = setup();
    await user.type(composer(), 'Simulate an error{Enter}');
    await waitForStatus('failed');
    expect(within(lastAssistant()).getByRole('alert')).toHaveTextContent("The response couldn't be generated");
    expect(within(lastAssistant()).queryByText(/Thought for/)).not.toBeInTheDocument();
    expect(within(lastAssistant()).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('records feedback locally with toggle semantics', async () => {
    const { user } = setup();
    await user.type(composer(), 'Hello{Enter}');
    await waitForStatus('completed');
    const up = screen.getByRole('button', { name: 'Good response' });
    await user.click(up);
    expect(screen.getByRole('button', { name: 'Remove good response rating' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText(/saved in this browser only/)).toBeInTheDocument();
  });

  it('persists conversations across a reload and never restores streaming', async () => {
    const { user, unmount } = setup(fastService({ chunkDelayMs: 20, chunkSize: 1 }));
    await user.type(composer(), 'Write a detailed guide about accessibility{Enter}');
    await waitForStatus('streaming');
    act(() => window.dispatchEvent(new Event('pagehide')));
    unmount();

    setup();
    const nav = screen.getByRole('navigation', { name: 'Chat history' });
    expect(within(nav).getByText('Write a detailed guide about accessibility')).toBeInTheDocument();
    // Hash still points to the conversation → it's reopened.
    expect(lastAssistant()).toHaveAttribute('data-status', 'cancelled');
  });

  it('renames, searches and deletes conversations (deletion survives reload)', async () => {
    const { user, unmount } = setup();
    await user.type(composer(), 'Hello{Enter}');
    await waitForStatus('completed');
    const nav = screen.getByRole('navigation', { name: 'Chat history' });

    await user.click(within(nav).getByRole('button', { name: 'More options for Hello' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename conversation' });
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(screen.getByText('Title cannot be empty.')).toBeInTheDocument();
    await user.type(input, 'Greetings chat{Enter}');
    expect(within(nav).getByText('Greetings chat')).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Search conversations' });
    await user.type(search, 'demo assistant');
    expect(within(nav).getByText('Greetings chat')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'zzzz');
    expect(within(nav).getByText(/No conversations match/)).toBeInTheDocument();
    await user.clear(search);

    await user.click(within(nav).getByRole('button', { name: 'More options for Greetings chat' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete conversation?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Conversation deleted.')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument();
    unmount();

    setup();
    expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
  });

  it('survives corrupted local storage', () => {
    localStorage.setItem(CONVERSATIONS_KEY, '}}}corrupted');
    setup();
    expect(screen.getByRole('heading', { name: 'What can I help you with?' })).toBeInTheDocument();
    expect(screen.getByText(/corrupted and has been reset/)).toBeInTheDocument();
  });

  it('shows a not-found state for a missing conversation', () => {
    window.location.hash = '#/c/does-not-exist';
    setup();
    expect(screen.getByRole('heading', { name: 'Conversation not found' })).toBeInTheDocument();
  });

  it('attaches files, sends them with the message and persists them', async () => {
    const { user } = setup();
    const input = screen.getByTestId('attachment-input');
    await user.upload(input, [new File(['a,b'], 'fees.csv', { type: 'text/csv' }), new File(['%PDF'], 'scheme.pdf', { type: 'application/pdf' })]);
    const tray = await screen.findByRole('list', { name: 'Attachments' });
    expect(within(tray).getByText('fees.csv')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove scheme.pdf' }));
    expect(within(tray).queryByText('scheme.pdf')).not.toBeInTheDocument();

    // Attachment-only messages are allowed.
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(within(screen.getByTestId('message-attachments')).getByText('fees.csv')).toBeInTheDocument();
    expect(screen.queryByTestId('user-message')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBe(screen.getByTestId('message-attachments'));
    await waitForStatus('completed');

    const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY)!);
    expect(stored.conversations[0].messages[0].attachments).toEqual([expect.objectContaining({ name: 'fees.csv', mimeType: 'text/csv' })]);
    expect(stored.conversations[0].title).toBe('fees.csv');
  });

  it('rejects attachments over the size limit', async () => {
    const { user } = setup();
    const big = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    await user.upload(screen.getByTestId('attachment-input'), big);
    expect(await screen.findByText(/huge\.pdf is larger than 10\.0 MB/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Attachments' })).not.toBeInTheDocument();
  });

  it('sends the chosen assistant mode with the message', async () => {
    const service = fastService();
    const prompts: { prompt: string; mode?: string }[] = [];
    const spy: AIService = { ...service, streamResponse: (r, o) => (prompts.push({ prompt: r.prompt, mode: r.mode }), service.streamResponse(r, o)) };
    const { user } = setup(spy);

    await user.click(screen.getByRole('button', { name: 'Assistant mode: General' }));
    const menu = screen.getByRole('menu', { name: 'Assistant mode' });
    expect(within(menu).getByRole('menuitemradio', { name: /General/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(menu).getByRole('menuitemradio', { name: /Reporting/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.type(composer(), 'Monthly fee summary{Enter}');
    expect(screen.getByTestId('message-mode')).toHaveTextContent('Reporting');
    await waitForStatus('completed');
    expect(prompts.at(-1)).toEqual({ prompt: 'Monthly fee summary', mode: 'reporting' });
    // The mode stays selected for the next message.
    expect(screen.getByRole('button', { name: 'Assistant mode: Reporting' })).toBeInTheDocument();
  });

  it('shows the chat title only, and the user role with an account menu', async () => {
    const user = userEvent.setup();
    render(<App aiService={fastService()} conversationService={new LocalConversationService(localStorage)} user={{ name: 'Rina Das', role: 'Call Center Agent' }} />);
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-title')).not.toBeInTheDocument();

    const account = screen.getByRole('button', { name: 'Rina Das, Call Center Agent. Account menu' });
    expect(account).toHaveTextContent('Call Center Agent');
    expect(within(account).getByText('RD')).toBeInTheDocument();
    await user.click(account);
    await user.click(within(screen.getByRole('menu', { name: 'Account' })).getByRole('menuitem', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.type(composer(), 'Hello title{Enter}');
    expect(screen.getByTestId('chat-title')).toHaveTextContent('Hello title');
    await waitForStatus('completed');
  });

  it('creates a project, starts a chat inside it and shows the breadcrumb', async () => {
    const { user } = setup();
    const sidebar = () => screen.getByRole('navigation', { name: 'Chat history' });
    await user.click(within(sidebar()).getByRole('button', { name: 'New project' }));
    const dialog = screen.getByRole('dialog', { name: 'Create a project' });
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Project name is required.');
    await user.type(within(dialog).getByLabelText('Name'), 'Merchant onboarding');
    await user.type(within(dialog).getByLabelText(/Description/), 'Test cases for merchants');
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));

    expect(window.location.hash).toMatch(/^#\/p\//);
    expect(screen.getByRole('heading', { level: 1, name: 'Merchant onboarding' })).toBeInTheDocument();
    expect(screen.getByText('No chats in this project yet')).toBeInTheDocument();

    await user.type(composer(), 'Draft onboarding test cases{Enter}');
    expect(window.location.hash).toMatch(/^#\/c\//);
    expect(screen.getByTestId('breadcrumb-project')).toHaveTextContent('Merchant onboarding');
    expect(screen.getByTestId('chat-title')).toHaveTextContent('Draft onboarding test cases');
    await waitForStatus('completed');

    await user.click(screen.getByTestId('breadcrumb-project'));
    expect(within(screen.getByRole('list', { name: 'Project chats' })).getByText('Draft onboarding test cases')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ai-chat:projects:v1')!)[0]).toMatchObject({ name: 'Merchant onboarding', description: 'Test cases for merchants' });
  });

  it('adds existing chats to a project and deletes the project without deleting chats', async () => {
    const { user } = setup();
    await user.type(composer(), 'First chat{Enter}');
    await waitForStatus('completed');
    await user.click(screen.getAllByRole('button', { name: 'New chat' })[0]);
    await user.type(composer(), 'Second chat{Enter}');
    await waitForStatus('completed');

    // Move one chat via its menu, creating the project on the way.
    await user.click(screen.getByRole('button', { name: 'More options for First chat' }));
    await user.click(screen.getByRole('menuitem', { name: 'Add to project' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Add to project' })).getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Name'), 'Reports');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Moved to Reports.')).toBeInTheDocument();

    // Add the other chat from the project page.
    await user.click(within(screen.getByRole('navigation', { name: 'Chat history' })).getByRole('button', { name: 'Reports' }));
    const projectChats = () => screen.getByRole('list', { name: 'Project chats' });
    expect(within(projectChats()).getByText('First chat')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add chats' }));
    const picker = screen.getByRole('dialog', { name: 'Add chats to Reports' });
    expect(within(picker).queryByText('First chat')).not.toBeInTheDocument();
    await user.click(within(picker).getByRole('checkbox', { name: 'Second chat' }));
    await user.click(within(picker).getByRole('button', { name: 'Add 1 chat' }));
    expect(within(projectChats()).getByText('Second chat')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Second chat from project' }));
    expect(within(projectChats()).queryByText('Second chat')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete project?' });
    expect(confirm).toHaveTextContent('Its 1 chat will be kept');
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(window.location.hash).toBe('#/');
    const sidebar = screen.getByRole('navigation', { name: 'Chat history' });
    expect(within(sidebar).queryByRole('button', { name: 'Reports' })).not.toBeInTheDocument();
    expect(within(sidebar).getByText('First chat')).toBeInTheDocument();
  });

  it('removes a chat from its project via the chat menu', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Name'), 'Ops');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    await user.type(composer(), 'Project chat{Enter}');
    await waitForStatus('completed');
    expect(screen.getByTestId('breadcrumb-project')).toHaveTextContent('Ops');

    await user.click(screen.getByRole('button', { name: 'More options for Project chat' }));
    expect(screen.getByRole('menuitem', { name: 'Change project' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Remove from project' }));
    expect(await screen.findByText('Removed from project.')).toBeInTheDocument();
    expect(screen.queryByTestId('breadcrumb-project')).not.toBeInTheDocument();

    // A chat outside any project offers no remove option.
    await user.click(screen.getByRole('button', { name: 'More options for Project chat' }));
    expect(screen.getByRole('menuitem', { name: 'Add to project' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Remove from project' })).not.toBeInTheDocument();
  });

  it('resizes the sidebar from its edge and remembers the width', async () => {
    const { user, unmount } = setup();
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(handle).toHaveAttribute('aria-valuenow', '272');
    handle.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '304');
    expect(screen.getByTestId('sidebar')).toHaveStyle({ width: '304px' });
    await user.keyboard('{End}');
    expect(handle).toHaveAttribute('aria-valuenow', '480');
    await user.keyboard('{Home}{ArrowLeft}');
    expect(handle).toHaveAttribute('aria-valuenow', '220');
    expect(JSON.parse(localStorage.getItem('ai-chat:ui:v1')!).sidebarWidth).toBe(220);

    unmount();
    setup();
    const restored = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(restored).toHaveAttribute('aria-valuenow', '220');
    await user.dblClick(restored);
    expect(restored).toHaveAttribute('aria-valuenow', '272');
  });

  it('lists attached files in the library and opens their chat', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByText('No files yet')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'New chat' })[0]);
    await user.upload(screen.getByTestId('attachment-input'), [new File(['a'], 'fees.csv', { type: 'text/csv' }), new File(['b'], 'logo.png', { type: 'image/png' })]);
    await screen.findByRole('list', { name: 'Attachments' });
    await user.type(composer(), 'Check these{Enter}');
    await waitForStatus('completed');

    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByRole('list', { name: 'Documents' })).getByText('fees.csv')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Images' })).getByText('logo.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Images/ }));
    expect(screen.queryByRole('list', { name: 'Documents' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^All/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search files' }), 'fees');
    expect(screen.queryByRole('list', { name: 'Images' })).not.toBeInTheDocument();

    await user.click(within(screen.getByRole('list', { name: 'Documents' })).getByRole('button'));
    expect(window.location.hash).toMatch(/^#\/c\//);
    expect(screen.getByTestId('user-message')).toHaveTextContent('Check these');
  });

  it('shares a chat as a link that opens read-only and can be continued', async () => {
    const { user } = setup();
    expect(screen.queryByTestId('share-button')).not.toBeInTheDocument();
    await user.type(composer(), 'Share me');
    await user.keyboard('{Enter}');
    await waitForStatus('completed');

    await user.click(screen.getByTestId('share-button'));
    const dialog = screen.getByRole('dialog', { name: 'Share chat' });
    await waitFor(() => expect((within(dialog).getByTestId('share-link') as HTMLInputElement).value).toMatch(/#\/s\/[zj]/));
    const link = (within(dialog).getByTestId('share-link') as HTMLInputElement).value;
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    act(() => {
      window.location.hash = new URL(link).hash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByTestId('shared-title')).toHaveTextContent('Share me');
    const shared = screen.getByTestId('shared-chat');
    expect(within(shared).getByTestId('user-message')).toHaveTextContent('Share me');
    expect(within(shared).queryByRole('button', { name: 'Edit message' })).not.toBeInTheDocument();
    expect(within(shared).queryByRole('button', { name: 'Good response' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue this chat' }));
    expect(window.location.hash).toMatch(/^#\/c\//);
    expect(screen.getByTestId('user-message')).toHaveTextContent('Share me');
    expect(composer()).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Chat history' })).getAllByText('Share me')).toHaveLength(2);
  });

  it('shows an error for a broken share link', async () => {
    window.location.hash = '#/s/jbroken';
    setup();
    expect(await screen.findByRole('heading', { name: /share link doesn.t work/ })).toBeInTheDocument();
  });

  it('defaults to light mode and toggles dark mode from the header', async () => {
    const { user } = setup();
    expect(document.documentElement).not.toHaveClass('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(JSON.parse(localStorage.getItem('ai-chat:settings:v1')!).theme).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('changes theme and clears all conversations from settings', async () => {
    const { user } = setup();
    await user.type(composer(), 'Hello{Enter}');
    await waitForStatus('completed');
    await user.click(screen.getAllByRole('button', { name: 'Settings' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    await user.click(within(dialog).getByLabelText('Dark'));
    expect(document.documentElement).toHaveClass('dark');
    await user.click(within(dialog).getByLabelText('Light'));
    expect(document.documentElement).not.toHaveClass('dark');
    await user.click(within(dialog).getByRole('switch', { name: 'Simulated multi-step progress' }));
    expect(JSON.parse(localStorage.getItem('ai-chat:settings:v1')!).enableSteps).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Clear all conversations' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear all' }));
    expect(await screen.findByText('All conversations cleared.')).toBeInTheDocument();
    expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
  });
});

describe('Agentic product creation', { timeout: 30000 }, () => {
  type User = ReturnType<typeof userEvent.setup>;
  function setupProducts() {
    const user = userEvent.setup();
    render(<App aiService={fastService()} conversationService={new LocalConversationService(localStorage)} productApi={new MockProductApi(localStorage, 5)} productPrepareDelayMs={200} />);
    return user;
  }
  const card = () => screen.getByTestId('product-setup');
  const ticks = () => within(card()).queryAllByTestId('section-complete').map((t) => t.closest('button')!.textContent!.replace(/\(complete\).*$/, '').trim());
  const ask = async (user: User, text: string) => {
    await user.type(composer(), text);
    await user.keyboard('{Enter}');
    await waitForStatus('completed');
    return await screen.findByTestId('product-setup');
  };
  /** Answer the basics questions and continue to the full setup. */
  const answerBasics = async (user: User, basics: { type?: string; currency?: string; segment?: string } = {}) => {
    const c = card();
    if (basics.type) await user.selectOptions(within(c).getByLabelText(/^Product type/), basics.type);
    if (basics.currency) await user.selectOptions(within(c).getByLabelText(/^Account currency/), basics.currency);
    if (basics.segment) await user.selectOptions(within(c).getByLabelText(/^Market segment/), basics.segment);
    await user.click(within(c).getByRole('button', { name: /Continue/ }));
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'pending'));
    return card();
  };
  /** The collapsible section headers, in order. */
  const sectionButtons = (root: HTMLElement = card()) => within(root).getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded') && b.closest('h4'));
  /** Expands a section (if it isn't already) and returns its content. */
  const openSection = async (user: User, name: string, root: HTMLElement = card()) => {
    const button = sectionButtons(root).find((b) => b.textContent?.startsWith(name))!;
    if (button.getAttribute('aria-expanded') !== 'true') await user.click(button);
    return within(document.getElementById(button.getAttribute('aria-controls')!)!);
  };
  /** The scheme configuration the user has to choose by hand. */
  const chooseScheme = async (user: User, scheme = 'VISA', named = 'Visa Classic Named', bin = 'Visa Classic BIN 421234', range = 'Range 0000000 to 4999999') => {
    const section = within(screen.getByTestId('scheme-config'));
    await user.selectOptions(section.getByRole('combobox', { name: 'Scheme' }), scheme);
    await user.selectOptions(section.getByLabelText(/^Named card template/), named);
    await user.selectOptions(section.getByLabelText('BIN'), bin);
    await user.selectOptions(section.getByLabelText('BIN range'), range);
  };
  /** From a fresh chat to a complete setup, ready to submit. */
  const prepareProduct = async (user: User, prompt: string, basics: { type: string; currency: string; segment: string }) => {
    await ask(user, prompt);
    await answerBasics(user, basics);
    await chooseScheme(user);
  };

  it('asks for the basics first, then shows the setup as collapsible sections in order with the defaults in place', async () => {
    const user = setupProducts();
    const basics = await ask(user, 'Create a Product');
    expect(basics).toHaveAttribute('data-status', 'collecting');
    expect(within(basics).getByLabelText(/^Product type/)).toHaveValue('');
    await user.click(within(basics).getByRole('button', { name: /Continue/ }));
    expect(within(basics).getByText('Choose a product type.')).toBeInTheDocument();
    expect(within(basics).getByText('Choose a market segment.')).toBeInTheDocument();

    // Continuing shows a processing pause before the form.
    await user.selectOptions(within(basics).getByLabelText(/^Product type/), 'PREPAID');
    await user.selectOptions(within(basics).getByLabelText(/^Account currency/), 'USD');
    await user.selectOptions(within(basics).getByLabelText(/^Market segment/), 'COMMERCIAL');
    await user.click(within(basics).getByRole('button', { name: /Continue/ }));
    expect(card()).toHaveAttribute('data-status', 'preparing');
    expect(within(card()).getByText('Applying your product basics')).toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: 'Create Product' })).not.toBeInTheDocument();
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'pending'));
    const headers = sectionButtons();
    expect(headers.map((b) => ['Basics', 'Policies', 'Permissions', 'Limits', 'Fees', 'Scheme configuration'].find((t) => b.textContent?.startsWith(t)))).toEqual([
      'Basics',
      'Policies',
      'Permissions',
      'Limits',
      'Fees',
      'Scheme configuration',
    ]);
    // Only the part the user must fill in starts open; the others show a summary.
    expect(headers.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'false', 'true']);
    expect(headers[0]).toHaveTextContent('Commercial Prepaid Card · Prepaid · USD');
    // Sections whose mandatory fields are filled show a green tick; the scheme still needs the user.
    expect(ticks()).toEqual(['Basics', 'Policies', 'Permissions', 'Limits', 'Fees']);

    // Basics: the answers, plus domestic and international transaction toggles.
    const basicsSection = await openSection(user, 'Basics');
    expect(basicsSection.getByLabelText(/^Product name/)).toHaveValue('Commercial Prepaid Card');
    expect(basicsSection.getByRole('switch', { name: 'Domestic transaction' })).toBeChecked();
    expect(basicsSection.getByRole('switch', { name: 'International transaction' })).toBeChecked();

    // Policies: PIN on, quota off.
    const policies = await openSection(user, 'Policies');
    expect(policies.getByRole('switch', { name: 'PIN policy' })).toBeChecked();
    expect(policies.getByRole('switch', { name: 'Quota policy' })).not.toBeChecked();

    // Permissions: every transaction type is selected.
    const permissions = await openSection(user, 'Permissions');
    const checkboxes = permissions.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(6);
    checkboxes.forEach((c) => expect(c).toBeChecked());
    expect(permissions.getByText(/All countries are allowed/)).toBeInTheDocument();

    // Limits: one domestic and one international limit, and room for more.
    const limits = await openSection(user, 'Limits');
    expect(limits.getAllByRole('group', { name: /^Domestic transaction limits \d/ })).toHaveLength(1);
    expect(limits.getAllByRole('group', { name: /^International transaction limits \d/ })).toHaveLength(1);
    await user.click(limits.getByRole('button', { name: /Add domestic transaction limit/ }));
    expect(limits.getAllByRole('group', { name: /^Domestic transaction limits \d/ })).toHaveLength(2);

    // Fees: exactly the two default service fees, and a way to add more.
    const fees = await openSection(user, 'Fees');
    expect(fees.getAllByLabelText(/^Policy title/).map((i) => (i as HTMLInputElement).value)).toEqual(['Card Annual Maintenance Fee', 'ATM Cash Withdrawal Fee']);
    expect(fees.getByRole('button', { name: 'Add another fee' })).toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: /Next Step|Approve/ })).not.toBeInTheDocument();
  });

  it('blocks Create Product until the scheme is chosen, then submits it as pending approval with a link to its details', async () => {
    const user = setupProducts();
    await ask(user, 'Create a Product');
    await answerBasics(user, { type: 'PREPAID', currency: 'BDT', segment: 'CONSUMER' });

    // Submitting too early opens what needs work and flags it.
    const basicsSection = await openSection(user, 'Basics');
    await user.clear(basicsSection.getByLabelText(/^Product name/));
    await user.click(sectionButtons()[0]);
    await user.click(within(card()).getByRole('button', { name: 'Create Product' }));
    expect(card()).toHaveAttribute('data-status', 'pending');
    expect(sectionButtons()[0]).toHaveAttribute('aria-expanded', 'true');
    expect(sectionButtons()[0]).toHaveTextContent('1 to fix');
    expect(within(card()).getByText('Product name is required.')).toBeInTheDocument();
    const schemes = within(screen.getByTestId('scheme-config'));
    expect(schemes.getByText('Select a scheme.')).toBeInTheDocument();
    expect(schemes.getByText('Select a BIN.')).toBeInTheDocument();
    expect(within(card()).getByText(/5 fields need attention/)).toBeInTheDocument();

    await user.type(within(card()).getByLabelText(/^Product name/), 'Everyday Prepaid');
    await chooseScheme(user);
    expect(within(card()).queryByText(/need attention/)).not.toBeInTheDocument();
    await user.click(within(card()).getByRole('button', { name: 'Create Product' }));

    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'submitted'));
    expect(within(card()).getByTestId('product-status')).toHaveTextContent('Pending approval');
    expect(within(card()).getByText(/An approver needs to review and approve it/)).toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: /request/i })).not.toBeInTheDocument();
    expect(lastAssistant()).toHaveTextContent(/submitted and is now Pending approval/);
    const productId = within(card()).getByTestId('product-id').textContent!;
    const link = within(card()).getByRole('link', { name: /View product details/ });
    expect(link).toHaveAttribute('href', `#/products/${productId}`);

    await user.click(link);
    const details = await screen.findByTestId('product-details');
    expect(await within(details).findByRole('heading', { name: 'Everyday Prepaid' })).toBeInTheDocument();
    expect(within(details).getByTestId('product-status')).toHaveTextContent('Pending approval');
    expect(within(details).getByText(/ATM Cash Withdrawal Fee/)).toBeInTheDocument();
  });

  it('saves a draft with a link to the draft form, where it can be finished and submitted', async () => {
    const user = setupProducts();
    await ask(user, 'Create a product named Gold Saver');
    await answerBasics(user, { type: 'DEBIT', currency: 'BDT', segment: 'CONSUMER' });
    await user.click(within(card()).getByRole('button', { name: 'Save as Draft' }));

    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'draft'));
    expect(within(card()).getByTestId('product-status')).toHaveTextContent('Draft');
    expect(lastAssistant()).toHaveTextContent(/saved as a draft/);
    const link = within(card()).getByRole('link', { name: /Open draft product form/ });
    const productId = within(card()).getByTestId('product-id').textContent!;
    expect(link).toHaveAttribute('href', `#/products/${productId}/edit`);

    await user.click(link);
    const page = await screen.findByTestId('draft-product');
    await within(page).findByText(`Draft ${productId}`);
    expect((await openSection(user, 'Basics', page)).getByLabelText(/^Product name/)).toHaveValue('Gold Saver');
    await chooseScheme(user);
    await user.click(within(page).getByRole('button', { name: 'Create Product' }));

    // Submitting from the draft page opens the product details, and the chat card follows.
    const details = await screen.findByTestId('product-details');
    expect(await within(details).findByTestId('product-status')).toHaveTextContent('Pending approval');
    await user.click(within(details).getByRole('link', { name: /Back to the chat/ }));
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'submitted'));
  });

  it('keeps the progress bar in step with what the user fills in or clears', async () => {
    const user = setupProducts();
    const basics = await ask(user, 'Create a Product');
    const percent = () => Number(within(card()).getByRole('progressbar', { name: 'Product setup progress' }).getAttribute('aria-valuenow'));
    expect(percent()).toBe(0);
    await user.selectOptions(within(basics).getByLabelText(/^Product type/), 'PREPAID');
    const afterOne = percent();
    expect(afterOne).toBeGreaterThan(0);

    await answerBasics(user, { currency: 'USD', segment: 'CONSUMER' });
    const prepared = percent();
    expect(prepared).toBeGreaterThan(afterOne);
    expect(prepared).toBeLessThan(100);

    await chooseScheme(user);
    expect(percent()).toBe(100);
    expect(ticks()).toContain('Scheme configuration');
    await user.clear((await openSection(user, 'Basics')).getByLabelText(/^Product name/));
    expect(percent()).toBeLessThan(100);
    expect(ticks()).not.toContain('Basics');
    expect(within(card()).getByText('1 item left to complete')).toBeInTheDocument();
  });

  it('pre-fills the basics and the setup from the prompt', async () => {
    const user = setupProducts();
    const basics = await ask(user, 'Create a credit product with Product Name: Platinum Product, currency: USD and international transactions: no');
    expect(screen.getAllByTestId('assistant-message')[0]).toHaveTextContent('Product name: Platinum Product');
    expect(within(basics).getByLabelText(/^Product type/)).toHaveValue('CREDIT');
    expect(within(basics).getByLabelText(/^Account currency/)).toHaveValue('USD');
    expect(within(basics).getAllByText('From you')).toHaveLength(2);

    await answerBasics(user, { segment: 'CONSUMER' });
    const section = await openSection(user, 'Basics');
    expect(section.getByLabelText(/^Product name/)).toHaveValue('Platinum Product');
    expect(section.getByRole('switch', { name: 'International transaction' })).not.toBeChecked();
  });

  it('cancels and reopens at the step the user left', async () => {
    const user = setupProducts();
    await ask(user, 'create product');
    await user.click(within(card()).getByRole('button', { name: 'Cancel' }));
    expect(card()).toHaveAttribute('data-status', 'cancelled');
    await user.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(card()).toHaveAttribute('data-status', 'collecting');

    await answerBasics(user, { type: 'DEBIT', currency: 'BDT', segment: 'CONSUMER' });
    await user.click(within(card()).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(card()).toHaveAttribute('data-status', 'pending');
  });

  it('shows an API error and lets the user retry with a different name', async () => {
    await new MockProductApi(localStorage, 0).submitProduct(buildProductDraft({ productName: 'Gold' }));
    const user = setupProducts();
    await prepareProduct(user, 'Create a debit product named Gold in BDT for consumers', { type: 'DEBIT', currency: 'BDT', segment: 'CONSUMER' });
    await user.click(within(card()).getByRole('button', { name: 'Create Product' }));
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'failed'));
    expect(within(card()).getByRole('alert')).toHaveTextContent(/already exists.*409/);

    // The user's choices survive the failure.
    const section = await openSection(user, 'Basics');
    await user.clear(section.getByLabelText(/^Product name/));
    await user.type(section.getByLabelText(/^Product name/), 'Gold Plus');
    await user.click(within(card()).getByRole('button', { name: 'Create Product' }));
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'submitted'));
    expect(within(card()).getByTestId('product-id')).toHaveTextContent('1002');
    expect(localStorage.getItem(PRODUCTS_KEY)).toContain('Gold Plus');
  });
});

describe('Reports', { timeout: 30000 }, () => {
  function setupReports() {
    const user = userEvent.setup();
    render(<App aiService={fastService()} conversationService={new LocalConversationService(localStorage)} productApi={new MockProductApi(localStorage, 5)} reportDelayMs={150} />);
    return user;
  }
  const send = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(composer(), text);
    await user.keyboard('{Enter}');
    await waitForStatus('completed');
  };

  it('uses the chart type named in the prompt, asks only how to group, then lets the user explore the report', async () => {
    const user = setupReports();
    await send(user, 'Show me Products in PIE Chart');
    const card = await screen.findByTestId('product-report');
    expect(card).toHaveAttribute('data-status', 'choosing');
    expect(within(card).getByText(/Chart type:/)).toHaveTextContent('Chart type: Pie chart');
    expect(within(card).queryByRole('radiogroup', { name: 'Chart type' })).not.toBeInTheDocument();
    // Nothing is pre-selected, and the report can't be generated without a grouping.
    within(card).getAllByRole('radio', { name: /Scheme|currency|Product type|Market segment|Status/ }).forEach((r) => expect(r).not.toBeChecked());
    await user.click(within(card).getByRole('button', { name: /Generate report/ }));
    expect(within(card).getByRole('alert')).toHaveTextContent('Choose how the report should group the products.');

    await user.click(within(card).getByRole('radio', { name: /^Scheme/ }));
    await user.click(within(card).getByRole('button', { name: /Generate report/ }));
    expect(screen.getByTestId('product-report')).toHaveAttribute('data-status', 'loading');
    expect(within(screen.getByTestId('product-report')).getByText('Grouping by scheme')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('product-report')).toHaveAttribute('data-status', 'ready'));

    const report = screen.getByTestId('product-report');
    expect(within(report).getByRole('heading', { name: 'Products by scheme' })).toBeInTheDocument();
    const pie = await within(report).findByTestId('pie-chart');
    const visa = within(pie).getByRole('button', { name: /VISA/ });
    expect(visa).toHaveAttribute('aria-pressed', 'true');
    await user.click(visa);
    expect(visa).toHaveAttribute('aria-pressed', 'false');

    // Only the chosen chart type is shown; the grouping can still change. Then read the numbers as a table.
    expect(within(report).queryByRole('radiogroup', { name: 'Chart type' })).not.toBeInTheDocument();
    expect(within(report).queryByTestId('column-chart')).not.toBeInTheDocument();
    await user.selectOptions(within(report).getByLabelText('Group by'), 'productType');
    expect(within(report).getByRole('heading', { name: 'Products by product type' })).toBeInTheDocument();
    expect(within(report).getByTestId('pie-chart')).toBeInTheDocument();
    await user.click(within(report).getByRole('button', { name: 'Show data table' }));
    const rows = within(within(report).getByRole('table')).getAllByRole('row');
    expect(rows.map((r) => r.querySelector('th')?.textContent)).toEqual(['Product type', 'Debit', 'Credit', 'Prepaid']);
  });

  it('asks for the chart type first when the prompt does not name one', async () => {
    const user = setupReports();
    await send(user, 'Show me visual report of products');
    const card = await screen.findByTestId('product-report');
    const chartTypes = within(card).getByRole('radiogroup', { name: 'Chart type' });
    within(chartTypes).getAllByRole('radio').forEach((r) => expect(r).not.toBeChecked());
    // The groupings depend on the chart type, so they appear once one is chosen.
    expect(within(card).queryByRole('radiogroup', { name: 'Group products by' })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /Generate report/ }));
    expect(within(card).getByRole('alert')).toHaveTextContent('Choose the type of chart for the report.');

    await user.click(within(chartTypes).getByRole('radio', { name: /^Bar chart/ }));
    await user.click(within(card).getByRole('radio', { name: /^Account currency/ }));
    await user.click(within(card).getByRole('button', { name: /Generate report/ }));
    await waitFor(() => expect(screen.getByTestId('product-report')).toHaveAttribute('data-status', 'ready'));
    const report = screen.getByTestId('product-report');
    expect(await within(report).findByTestId('column-chart')).toBeInTheDocument();
    expect(within(report).queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(within(report).getByRole('heading', { name: 'Products by account currency' })).toBeInTheDocument();
  });

  it('offers value ranges, not categories, for a histogram', async () => {
    const user = setupReports();
    await send(user, 'Show me Products in Histogram');
    const card = await screen.findByTestId('product-report');
    expect(within(card).getByRole('radio', { name: /^Card validity/ })).toBeInTheDocument();
    expect(within(card).queryByRole('radio', { name: /^Scheme/ })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('radio', { name: /^Card validity/ }));
    await user.click(within(card).getByRole('button', { name: /Generate report/ }));
    await waitFor(() => expect(screen.getByTestId('product-report')).toHaveAttribute('data-status', 'ready'));
    expect(await within(screen.getByTestId('product-report')).findByRole('img', { name: /Products by card validity, histogram/ })).toBeInTheDocument();
  });

  it('charts transactions for a phone number with a date-range filter', async () => {
    const user = setupReports();
    await send(user, 'Show me visual transaction data for 01712345678');
    const card = await screen.findByTestId('transaction-report');
    expect(within(card).getByRole('heading', { name: 'Transactions for 01712345678' })).toBeInTheDocument();
    expect(within(card).getByLabelText('Date range')).toHaveValue('7d');
    expect(within(card).getByText(/Histogram · Last 1 week/)).toBeInTheDocument();

    await user.selectOptions(within(card).getByLabelText('Date range'), '24h');
    expect(within(card).getByText(/Histogram · Last 24 hours/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Show data table' }));
    expect(within(within(card).getByRole('table')).getAllByRole('row')).toHaveLength(25);

    await user.selectOptions(within(card).getByLabelText('Date range'), '1y');
    await user.click(within(card).getByRole('radio', { name: 'Amount' }));
    expect(within(card).getByRole('img', { name: /last 1 year, amount \(bdt\) per month/i })).toBeInTheDocument();
    expect(within(within(card).getByRole('table')).getAllByRole('row')).toHaveLength(13);
  });
});

describe('Mascot', () => {
  it('greets on the welcome screen, thinks in the chat, then stays by the message box between prompts', async () => {
    const user = userEvent.setup();
    render(<App aiService={fastService({ minThinkingMs: 300, chunkDelayMs: 40, chunkSize: 4 })} conversationService={new LocalConversationService(localStorage)} />);
    expect(within(screen.getByTestId('welcome-screen')).getByTestId('mascot')).toHaveAttribute('data-mood', 'idle');

    await user.type(composer(), 'Hello there{Enter}');
    expect(await screen.findByTestId('thinking-mascot')).toBeInTheDocument();
    expect(screen.queryByTestId('composer-mascot')).not.toBeInTheDocument();

    const perched = await screen.findByTestId('composer-mascot');
    expect(within(perched).getByTestId('mascot')).toHaveAttribute('data-mood', 'working');
    expect(screen.queryByTestId('thinking-mascot')).not.toBeInTheDocument();

    // Once the answer is written it stays beside the box, resting.
    await waitForStatus('completed');
    expect(within(screen.getByTestId('composer-mascot')).getByTestId('mascot')).toHaveAttribute('data-mood', 'idle');

    // A new prompt: it leaves the box to think in the chat, then comes back to work.
    await user.type(composer(), 'Explain closures{Enter}');
    expect(await screen.findByTestId('thinking-mascot')).toBeInTheDocument();
    expect(screen.queryByTestId('composer-mascot')).not.toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId('composer-mascot')).getByTestId('mascot')).toHaveAttribute('data-mood', 'working'));
    await waitForStatus('completed');
    expect(within(screen.getByTestId('composer-mascot')).getByTestId('mascot')).toHaveAttribute('data-mood', 'idle');
  });

  it('does a random trick when clicked, never the same twice in a row, then comes back', async () => {
    const user = userEvent.setup();
    render(<App aiService={fastService({ minThinkingMs: 300, chunkDelayMs: 40, chunkSize: 4 })} conversationService={new LocalConversationService(localStorage)} mascotRideMs={400} />);

    // From the welcome screen.
    const welcome = within(screen.getByTestId('welcome-screen')).getByRole('button', { name: 'Play with the mascot' });
    await user.click(welcome);
    const first = screen.getByTestId('rocket-ride').dataset.ride;
    expect(RIDE_KINDS).toContain(first);
    expect(welcome).toHaveClass('opacity-0');
    await user.click(welcome); // a second click mid-flight does not start another ride
    expect(screen.getAllByTestId('rocket-ride')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByTestId('rocket-ride')).not.toBeInTheDocument());
    expect(welcome).not.toHaveClass('opacity-0');
    await user.click(welcome);
    expect(screen.getByTestId('rocket-ride').dataset.ride).not.toBe(first);
    await waitFor(() => expect(screen.queryByTestId('rocket-ride')).not.toBeInTheDocument());

    // And from beside the message box, even while an answer is being written.
    await user.type(composer(), 'Write a detailed guide about accessibility{Enter}');
    await waitFor(() => expect(within(screen.getByTestId('composer-mascot')).getByTestId('mascot')).toHaveAttribute('data-mood', 'working'));
    await user.click(within(screen.getByTestId('composer-mascot')).getByRole('button'));
    expect(screen.getByTestId('rocket-ride')).toBeInTheDocument();
    // The answer keeps streaming underneath the trick.
    expect(screen.getByTestId('assistant-message')).toHaveAttribute('data-status', 'streaming');
    await waitFor(() => expect(screen.queryByTestId('rocket-ride')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Stop generating' }));
    await waitForStatus('cancelled');
  });
});

describe('Customer lookup', { timeout: 30000 }, () => {
  function setupLookup() {
    const user = userEvent.setup();
    const view = render(<App aiService={fastService()} conversationService={new LocalConversationService(localStorage)} customerSearchMs={150} />);
    return { user, view };
  }
  const send = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(composer(), text);
    await user.keyboard('{Enter}');
    await waitForStatus('completed');
  };

  it('shows the customer profile straight away when the prompt says it is a phone number', async () => {
    const { user } = setupLookup();
    await send(user, "Give me customer information for this Phone Number '01789833786'");
    const card = await screen.findByTestId('customer-lookup');
    expect(card).toHaveAttribute('data-status', 'found');
    expect(within(card).getByRole('heading', { name: 'Mr. Nafidul Alam' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Customer ID: 13806');
    expect(within(card).getByTestId('customer-status')).toHaveTextContent('Active');
    const detail = (label: string) => within(card).getByText(label).nextElementSibling;
    expect(detail("Father's Name")).toHaveTextContent('Rabbi');
    expect(detail("Mother's Name")).toHaveTextContent('Salma');
    expect(detail('Date of Birth')).toHaveTextContent('06-Jan-2003');
    expect(detail('Mobile Number')).toHaveTextContent('01789833786');
    expect(detail('Email Address')).toHaveTextContent('as*******************@gmail.com');
    expect(detail('Registered On')).toHaveTextContent('27-Oct-2026 · 02:59 PM');
    expect(within(card).queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('asks what kind of ID an unlabelled value is, then searches and shows the customer', async () => {
    const { user, view } = setupLookup();
    await send(user, "Give me customer information for '01789833786'");
    const card = await screen.findByTestId('customer-lookup');
    expect(card).toHaveAttribute('data-status', 'choosing');
    const options = within(card).getAllByRole('radio');
    expect(options.map((o) => o.closest('label')!.textContent)).toEqual([expect.stringContaining('Phone Number'), expect.stringContaining('CIF ID'), expect.stringContaining('Customer ID')]);
    options.forEach((o) => expect(o).not.toBeChecked());

    await user.click(within(card).getByRole('button', { name: /Search customer/ }));
    expect(within(card).getByRole('alert')).toHaveTextContent('Choose whether this is a phone number, CIF ID or customer ID.');

    await user.click(within(card).getByRole('radio', { name: /Phone Number/ }));
    await user.click(within(card).getByRole('button', { name: /Search customer/ }));
    expect(screen.getByTestId('customer-lookup')).toHaveAttribute('data-status', 'searching');
    await waitFor(() => expect(screen.getByTestId('customer-lookup')).toHaveAttribute('data-status', 'found'));
    expect(within(screen.getByTestId('customer-lookup')).getByRole('heading', { name: 'Mr. Nafidul Alam' })).toBeInTheDocument();

    // The result is saved with the chat.
    view.unmount();
    render(<App aiService={fastService()} conversationService={new LocalConversationService(localStorage)} />);
    expect(await screen.findByRole('heading', { name: 'Mr. Nafidul Alam' })).toBeInTheDocument();
  });

  it('says when the value cannot be the chosen ID type, and lets the user pick another', async () => {
    const { user } = setupLookup();
    await send(user, "Give me customer information for '01789833786'");
    let card = await screen.findByTestId('customer-lookup');
    await user.click(within(card).getByRole('radio', { name: /Customer ID/ }));
    await user.click(within(card).getByRole('button', { name: /Search customer/ }));
    await waitFor(() => expect(screen.getByTestId('customer-lookup')).toHaveAttribute('data-status', 'invalid'));
    card = screen.getByTestId('customer-lookup');
    expect(card).toHaveTextContent("No customer found: 01789833786 isn't a valid Customer ID.");

    await user.click(within(card).getByRole('button', { name: /Search as a different ID type/ }));
    card = screen.getByTestId('customer-lookup');
    expect(card).toHaveAttribute('data-status', 'choosing');
    await user.click(within(card).getByRole('radio', { name: /Phone Number/ }));
    await user.click(within(card).getByRole('button', { name: /Search customer/ }));
    await waitFor(() => expect(screen.getByTestId('customer-lookup')).toHaveAttribute('data-status', 'found'));
  });
});
