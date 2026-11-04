import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIService, Attachment, ChatMode, Feedback } from '../types/chat';
import { conversationService as defaultConversationService, type LocalConversationService } from '../services/conversationService';
import { mockAIService } from '../services/mockAIService';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSettings } from '../hooks/useSettings';
import type { StorageError } from '../types/conversation';
import { ChatContainer } from '../components/chat/ChatContainer';
import type { ChatInputHandle } from '../components/chat/ChatInput';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { ToastProvider } from '../components/common/Toast';
import { useToast } from '../components/common/toastContext';
import { Header } from '../components/layout/Header';
import { MainLayout } from '../components/layout/MainLayout';
import { clampSidebarWidth, SIDEBAR_DEFAULT_WIDTH } from '../utils/sidebarWidth';
import { Sidebar } from '../components/layout/Sidebar';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { LibraryView } from '../components/library/LibraryView';
import { AddChatsDialog } from '../components/projects/AddChatsDialog';
import { MoveToProjectDialog } from '../components/projects/MoveToProjectDialog';
import { ProjectDialog } from '../components/projects/ProjectDialog';
import { ProjectView } from '../components/projects/ProjectView';
import { useProjects, type ProjectInput } from '../hooks/useProjects';
import { ShareDialog } from '../components/share/ShareDialog';
import { SharedChatView } from '../components/share/SharedChatView';
import { createId } from '../utils/id';
import { sharedChatToMessages, type SharedChat } from '../utils/share';
import { useProductSetup } from '../hooks/useProductSetup';
import { useReports } from '../hooks/useReports';
import { mockProductApi, type ProductApi } from '../services/productService';
import { DraftProductPage, ProductDetailsPage } from '../components/products/ProductPages';
import type { ProductRecord } from '../types/product';
import { useHashRoute } from './routes';
import { DEFAULT_USER, type CurrentUser } from '../config/currentUser';

export interface AppProps {
  /** Swap in a real `AIService` implementation to connect a backend. */
  aiService?: AIService;
  conversationService?: LocalConversationService;
  /** Who is using the assistant; shown in the header with their role. */
  user?: CurrentUser;
  /** Card management API used to submit products, save drafts and show product details. */
  productApi?: ProductApi;
  /** Processing pause between the product basics and the full setup form (default 5 seconds). */
  productPrepareDelayMs?: number;
  /** Processing pause before a products report is shown (default 3 seconds). */
  reportDelayMs?: number;
  /** Search pause after the user says what kind of customer ID they gave (default 1.8 seconds). */
  customerSearchMs?: number;
  /** Fixed length for the mascot's tricks when it is clicked (default: each trick's own, about 4–6 seconds). */
  mascotRideMs?: number;
}

const UI_KEY = 'ai-chat:ui:v1';

interface UiPrefs {
  sidebarOpen: boolean;
  sidebarWidth: number;
}

function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      sidebarOpen: parsed.sidebarOpen !== false,
      sidebarWidth: typeof parsed.sidebarWidth === 'number' ? clampSidebarWidth(parsed.sidebarWidth) : SIDEBAR_DEFAULT_WIDTH,
    };
  } catch {
    return { sidebarOpen: true, sidebarWidth: SIDEBAR_DEFAULT_WIDTH };
  }
}

type PendingConfirm =
  | { kind: 'delete'; conversationId: string; title: string }
  | { kind: 'clearAll' }
  | { kind: 'deleteProject'; projectId: string; name: string; chatCount: number }
  | null;

/** Create a project (optionally putting a chat straight into it) or edit an existing one. */
type ProjectDialogState = { mode: 'create'; assignConversationId?: string } | { mode: 'edit'; projectId: string } | null;

function ChatApp({ aiService = mockAIService, conversationService = defaultConversationService, user = DEFAULT_USER, productApi = mockProductApi, productPrepareDelayMs, reportDelayMs, customerSearchMs, mascotRideMs }: AppProps) {
  const toast = useToast();
  const onSettingsSaveError = useCallback(() => toast.show("Preferences couldn't be saved in this browser.", { kind: 'error' }), [toast]);
  const { settings, update: updateSettings, reset: resetSettings, toggleTheme } = useSettings(onSettingsSaveError);
  const { route, navigate } = useHashRoute();
  const mobile = useMediaQuery('(max-width: 767px)');
  const inputRef = useRef<ChatInputHandle>(null);

  const onStorageError = useCallback((e: StorageError) => toast.show(e.message, { kind: 'error' }), [toast]);
  const store = useConversations(conversationService, onStorageError);
  const onProjectsSaveError = useCallback(() => toast.show("Projects couldn't be saved in this browser.", { kind: 'error' }), [toast]);
  const projects = useProjects(onProjectsSaveError);

  const activeId = route.name === 'conversation' ? route.conversationId : null;
  const active = store.getConversation(activeId);
  const missing = !!activeId && !active;
  const routeProjectId = route.name === 'project' ? route.projectId : null;
  /** The project whose page is open, or that the open chat belongs to. */
  const activeProject = projects.getProject(routeProjectId ?? active?.projectId);
  const pageTitle = route.name === 'product' ? 'Product details' : route.name === 'productDraft' ? 'Draft product' : undefined;

  const onConversationCreated = useCallback((id: string) => navigate({ name: 'conversation', conversationId: id }), [navigate]);
  const chat = useChat({ aiService, dispatch: store.dispatch, getConversation: store.getConversation, settings, onConversationCreated });
  const generating = !!active && (active.status === 'generating' || chat.isGenerating(active.id));
  const onProductSubmitted = useCallback(
    (record: ProductRecord) => toast.show(`${record.productName || 'Product'} submitted for approval (ID ${record.productId}).`, { kind: 'success' }),
    [toast],
  );
  const onDraftSaved = useCallback((record: ProductRecord) => toast.show(`Draft saved (ID ${record.productId}).`, { kind: 'success' }), [toast]);
  const productSetup = useProductSetup({
    productApi,
    dispatch: store.dispatch,
    getConversation: store.getConversation,
    conversationId: activeId,
    userName: user.name,
    onSubmitted: onProductSubmitted,
    onDraftSaved,
    prepareDelayMs: productPrepareDelayMs,
  });
  const reports = useReports({ productApi, dispatch: store.dispatch, getConversation: store.getConversation, conversationId: activeId, delayMs: reportDelayMs, customerSearchMs });
  const { syncFromRecord } = productSetup;
  /** A draft finished on its own page: update the chat card it came from and show where the product stands. */
  const draftPageSaved = useCallback(
    (record: ProductRecord) => {
      syncFromRecord(record);
      onDraftSaved(record);
    },
    [syncFromRecord, onDraftSaved],
  );
  const draftPageSubmitted = useCallback(
    (record: ProductRecord) => {
      syncFromRecord(record);
      onProductSubmitted(record);
      navigate({ name: 'product', productId: record.productId }, { replace: true });
    },
    [syncFromRecord, onProductSubmitted, navigate],
  );

  const [uiPrefs] = useState(loadUiPrefs);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(uiPrefs.sidebarOpen);
  const [sidebarWidth, setSidebarWidth] = useState(uiPrefs.sidebarWidth);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const [moveConversationId, setMoveConversationId] = useState<string | null>(null);
  const [addChatsOpen, setAddChatsOpen] = useState(false);
  const [shareConversationId, setShareConversationId] = useState<string | null>(null);

  // Report storage load problems once at startup.
  const warned = useRef(false);
  useEffect(() => {
    if (warned.current) return;
    warned.current = true;
    store.loadWarnings.forEach((w) => toast.show(w, { kind: 'error', durationMs: 8000 }));
  }, [store.loadWarnings, toast]);

  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ sidebarOpen: desktopSidebarOpen, sidebarWidth }));
    } catch {
      /* non-critical */
    }
  }, [desktopSidebarOpen, sidebarWidth]);

  useEffect(() => {
    const page = active ? active.title : route.name === 'library' ? 'Library' : route.name === 'project' ? activeProject?.name : pageTitle;
    document.title = page ? `${page} · AI Assistant (Demo)` : 'AI Assistant (Demo)';
  }, [active, route.name, activeProject, pageTitle]);

  const focusComposer = useCallback(() => requestAnimationFrame(() => inputRef.current?.focus()), []);

  const newChat = useCallback(() => {
    navigate({ name: 'home' });
    setDrawerOpen(false);
    focusComposer();
  }, [navigate, focusComposer]);

  // Ctrl/Cmd + Shift + O starts a new chat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        newChat();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newChat]);

  const selectConversation = useCallback(
    (id: string) => {
      navigate({ name: 'conversation', conversationId: id });
      setDrawerOpen(false);
      focusComposer();
    },
    [navigate, focusComposer],
  );

  const openLibrary = useCallback(() => {
    navigate({ name: 'library' });
    setDrawerOpen(false);
  }, [navigate]);

  const openProject = useCallback(
    (id: string) => {
      navigate({ name: 'project', projectId: id });
      setDrawerOpen(false);
      focusComposer();
    },
    [navigate, focusComposer],
  );

  const send = useCallback(
    (text: string, attachments: Attachment[], mode: ChatMode, projectId?: string) => {
      const result = chat.sendMessage(text, activeId, { attachments, mode, projectId });
      if (result.ok && projectId) projects.touch(projectId);
      if (!result.ok) {
        if (result.reason === 'busy') toast.show('Please wait for the current response to finish, or stop it first.');
        else if (result.reason === 'missing') toast.show('This conversation no longer exists. Start a new chat.', { kind: 'error' });
        else toast.show('Type a message or attach a file before sending.');
      }
      return result.ok;
    },
    [chat, activeId, toast, projects],
  );

  /** Starts a new chat inside the open project. */
  const startProjectChat = useCallback(
    (text: string, attachments: Attachment[], mode: ChatMode) => (routeProjectId ? send(text, attachments, mode, routeProjectId) : false),
    [send, routeProjectId],
  );

  const moveConversation = useCallback(
    (conversationId: string, projectId: string | null) => {
      store.dispatch({ type: 'setProject', conversationId, projectId });
      if (projectId) projects.touch(projectId);
      const name = projectId ? projects.getProject(projectId)?.name : undefined;
      toast.show(name ? `Moved to ${name}.` : 'Removed from project.', { kind: 'success' });
    },
    [store, projects, toast],
  );

  const addChatsToProject = (ids: string[]) => {
    if (!routeProjectId) return;
    ids.forEach((conversationId) => store.dispatch({ type: 'setProject', conversationId, projectId: routeProjectId }));
    projects.touch(routeProjectId);
    setAddChatsOpen(false);
    toast.show(`Added ${ids.length} chat${ids.length === 1 ? '' : 's'} to ${activeProject?.name ?? 'the project'}.`, { kind: 'success' });
  };

  const submitProject = (input: ProjectInput) => {
    if (!projectDialog) return;
    if (projectDialog.mode === 'edit') {
      projects.update(projectDialog.projectId, input);
      toast.show('Project updated.', { kind: 'success' });
    } else {
      const project = projects.create(input);
      if (!project) return;
      if (projectDialog.assignConversationId) {
        store.dispatch({ type: 'setProject', conversationId: projectDialog.assignConversationId, projectId: project.id });
        toast.show(`Moved to ${project.name}.`, { kind: 'success' });
      } else {
        openProject(project.id);
      }
    }
    setProjectDialog(null);
  };

  const requestDeleteProject = () => {
    if (!activeProject) return;
    const chatCount = store.conversations.filter((c) => c.projectId === activeProject.id).length;
    setConfirm({ kind: 'deleteProject', projectId: activeProject.id, name: activeProject.name, chatCount });
  };

  /** Saves a copy of a shared chat to this browser so the reader can keep talking. */
  const continueSharedChat = useCallback(
    (shared: SharedChat) => {
      const id = createId();
      const now = Date.now();
      const messages = sharedChatToMessages(shared, id, createId).map((m, i) => ({ ...m, createdAt: now + i }));
      store.dispatch({ type: 'create', conversation: { id, title: shared.title, createdAt: now, updatedAt: now, messages } });
      navigate({ name: 'conversation', conversationId: id }, { replace: true });
      toast.show('Saved a copy of the shared chat. You can continue it here.', { kind: 'success' });
      focusComposer();
    },
    [store, navigate, toast, focusComposer],
  );

  const stop = useCallback(() => {
    if (activeId) chat.stop(activeId);
  }, [chat, activeId]);

  const regenerate = useCallback(
    (messageId: string) => {
      if (activeId && !chat.regenerate(activeId, messageId)) toast.show('Please wait for the current response to finish.');
    },
    [chat, activeId, toast],
  );

  const editSubmit = useCallback(
    (messageId: string, content: string) => {
      if (!activeId) return false;
      const ok = chat.editAndResubmit(activeId, messageId, content);
      if (!ok) toast.show(content.trim() ? 'Please wait for the current response to finish.' : 'Message cannot be empty.');
      return ok;
    },
    [chat, activeId, toast],
  );

  const feedback = useCallback(
    (messageId: string, value: Feedback) => {
      if (!activeId) return;
      const previous = store.getConversation(activeId)?.messages.find((m) => m.id === messageId)?.feedback;
      chat.setFeedback(activeId, messageId, value);
      if (previous !== value) toast.show('Thanks for the feedback. It is saved in this browser only.', { kind: 'success' });
    },
    [chat, activeId, store, toast],
  );

  const requestDelete = useCallback(
    (id: string) => {
      const c = store.getConversation(id);
      if (c) setConfirm({ kind: 'delete', conversationId: id, title: c.title });
    },
    [store],
  );

  const confirmAction = () => {
    if (!confirm) return;
    if (confirm.kind === 'deleteProject') {
      store.dispatch({ type: 'detachProject', projectId: confirm.projectId });
      projects.remove(confirm.projectId);
      if (routeProjectId === confirm.projectId) navigate({ name: 'home' }, { replace: true });
      toast.show('Project deleted. Its chats were kept.', { kind: 'success' });
    } else if (confirm.kind === 'delete') {
      chat.stop(confirm.conversationId);
      const ok = store.remove(confirm.conversationId);
      if (activeId === confirm.conversationId) navigate({ name: 'home' }, { replace: true });
      toast.show(ok ? 'Conversation deleted.' : "Conversation removed, but the change couldn't be saved to browser storage.", { kind: ok ? 'success' : 'error' });
    } else {
      chat.stopAll();
      const ok = store.clearAll();
      navigate({ name: 'home' }, { replace: true });
      toast.show(ok ? 'All conversations cleared.' : "Conversations couldn't be removed from browser storage.", { kind: ok ? 'success' : 'error' });
    }
    setConfirm(null);
    focusComposer();
  };

  const closeSidebar = useCallback(() => (mobile ? setDrawerOpen(false) : setDesktopSidebarOpen(false)), [mobile]);
  const openSidebar = useCallback(() => (mobile ? setDrawerOpen(true) : setDesktopSidebarOpen(true)), [mobile]);
  const sidebarOpen = mobile ? drawerOpen : desktopSidebarOpen;

  return (
    <>
      <MainLayout
        mobile={mobile}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={closeSidebar}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        sidebar={
          <Sidebar
            conversations={store.conversations}
            projects={projects.projects}
            activeId={activeId}
            activeProjectId={activeProject?.id ?? null}
            libraryActive={route.name === 'library'}
            onMoveToProject={setMoveConversationId}
            onRemoveFromProject={(id) => moveConversation(id, null)}
            onOpenLibrary={openLibrary}
            onOpenProject={openProject}
            onNewProject={() => {
              setDrawerOpen(false);
              setProjectDialog({ mode: 'create' });
            }}
            isGenerating={chat.isGenerating}
            onSelect={selectConversation}
            onNewChat={newChat}
            onRename={store.rename}
            onDelete={requestDelete}
            onOpenSettings={() => {
              setDrawerOpen(false);
              setSettingsOpen(true);
            }}
            onClose={closeSidebar}
            mobile={mobile}
          />
        }
        header={
          <Header
            title={active?.title ?? pageTitle}
            project={active && activeProject ? { name: activeProject.name, onOpen: () => openProject(activeProject.id) } : undefined}
            sidebarVisible={sidebarOpen}
            mobile={mobile}
            theme={settings.theme}
            user={user}
            onOpenSidebar={openSidebar}
            onNewChat={newChat}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleTheme={toggleTheme}
            onShare={active?.messages.length ? () => setShareConversationId(active.id) : undefined}
            shareDisabled={generating}
          />
        }
      >
        {route.name === 'shared' ? (
          <SharedChatView key={route.payload} payload={route.payload} onContinue={continueSharedChat} onNewChat={newChat} />
        ) : route.name === 'product' ? (
          <ProductDetailsPage api={productApi} productId={route.productId} />
        ) : route.name === 'productDraft' ? (
          <DraftProductPage api={productApi} productId={route.productId} userName={user.name} onSaved={draftPageSaved} onSubmitted={draftPageSubmitted} />
        ) : route.name === 'library' ? (
          <LibraryView conversations={store.conversations} onOpenChat={selectConversation} />
        ) : route.name === 'project' ? (
          <ProjectView
            key={route.projectId}
            project={activeProject}
            conversations={store.conversations.filter((c) => c.projectId === route.projectId)}
            inputRef={inputRef}
            onStartChat={startProjectChat}
            onOpenChat={selectConversation}
            onRemoveChat={(id) => moveConversation(id, null)}
            onAddChats={() => setAddChatsOpen(true)}
            onEdit={() => setProjectDialog({ mode: 'edit', projectId: route.projectId })}
            onDelete={requestDeleteProject}
            onNewChat={newChat}
          />
        ) : (
          <ChatContainer
            conversation={active}
            missing={missing}
            generating={generating}
            inputRef={inputRef}
            onSend={send}
            onStop={stop}
            onRegenerate={regenerate}
            onEditSubmit={editSubmit}
            onFeedback={feedback}
            onNewChat={newChat}
            productSetup={productSetup.handlers}
            reports={reports}
            mascotRideMs={mascotRideMs}
          />
        )}
      </MainLayout>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
        {chat.announcement}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {productSetup.announcement}
      </div>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        conversationCount={store.conversations.length}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
        onClearAll={() => {
          setSettingsOpen(false);
          setConfirm({ kind: 'clearAll' });
        }}
        onResetPreferences={() => {
          resetSettings();
          toast.show('Demo preferences reset to defaults.', { kind: 'success' });
        }}
      />

      <ProjectDialog
        open={projectDialog !== null}
        project={projectDialog?.mode === 'edit' ? projects.getProject(projectDialog.projectId) : undefined}
        onSubmit={submitProject}
        onClose={() => setProjectDialog(null)}
      />

      <MoveToProjectDialog
        conversation={store.getConversation(moveConversationId)}
        projects={projects.projects}
        onMove={(projectId) => {
          if (moveConversationId) moveConversation(moveConversationId, projectId);
          setMoveConversationId(null);
        }}
        onCreateProject={() => {
          setProjectDialog({ mode: 'create', assignConversationId: moveConversationId ?? undefined });
          setMoveConversationId(null);
        }}
        onClose={() => setMoveConversationId(null)}
      />

      {activeProject && (
        <AddChatsDialog
          open={addChatsOpen && route.name === 'project'}
          project={activeProject}
          conversations={store.conversations}
          projectName={(id) => projects.getProject(id)?.name}
          onAdd={addChatsToProject}
          onClose={() => setAddChatsOpen(false)}
        />
      )}

      <ShareDialog conversation={store.getConversation(shareConversationId)} onClose={() => setShareConversationId(null)} />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'clearAll' ? 'Clear all conversations?' : confirm?.kind === 'deleteProject' ? 'Delete project?' : 'Delete conversation?'}
        description={
          confirm?.kind === 'delete'
            ? `“${confirm.title}” will be permanently deleted from this browser.`
            : confirm?.kind === 'deleteProject'
              ? `“${confirm.name}” will be deleted.${confirm.chatCount ? ` Its ${confirm.chatCount} chat${confirm.chatCount === 1 ? '' : 's'} will be kept and moved out of the project.` : ''}`
              : 'Every conversation stored in this browser will be permanently deleted. This cannot be undone.'
        }
        confirmLabel={confirm?.kind === 'clearAll' ? 'Clear all' : 'Delete'}
        destructive
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

export function App(props: AppProps) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ChatApp {...props} />
      </ToastProvider>
    </ErrorBoundary>
  );
}
