# AI Assistant: ChatGPT-style chat demo (frontend only)

A responsive chat app that looks and behaves like an LLM chat product. **No AI model, API key, backend, or network request is involved.** Every answer comes from a local mock response engine. The engine streams text, simulates thinking and multi-step progress, and can simulate failures.

## Token usage

Each response shows the tokens it used. While it is generating, a live counter shows the input tokens and the output tokens so far; when it finishes (or is stopped), the total appears next to the response actions, with the input and output split. The demo has no model, so the counts are estimates made in the browser (`src/utils/tokens.ts`) and are shown with a ~. A real backend can report its own counts in the `usage` field of the `started`, `completed` and `cancelled` events, and the app shows those instead.

## Portal

The app opens on the **Product List** (`#/`), inside a portal with a dark sidebar: **AI Assistant** (`#/assistant`) and **Product Management → Product List**. A chat keeps generating while you browse the portal's other pages.

- **Product List:** search by name, filter by status, and open a product. Drafts open in the form and can be deleted; other products open read-only. On first visit the list is filled with sample products (`src/services/demoProducts.ts`, called from `main.tsx`).
- **Product Setup** (`#/products/new`): a step-by-step form (Basics → Policies → Permissions → Limits → Fees → Schemes → Preview & Submit). **Next Step** checks the current step, **Save and Exit** keeps a draft (it only needs a name), and **Submit Product** sends it for approval.
- **AI Assistant popup:** the round button in the bottom-right corner of the Product List opens the AI Assistant full screen, over the list. Everything the assistant page does works there, including creating products and reports; the button turns into an X that closes the popup (Escape works too). The popup keeps its own chat, so the page behind stays on the Product List, and the list reloads when the popup closes.
- **AI help on each field:** focus a field and a small AI button appears beside its label. **Auto-fill this field** picks a value from the rest of the form (with Undo), and **Ask AI about this field** answers questions about it and offers a value to apply. The answers come from local rules (`src/utils/fieldAssist.ts`), like the rest of the mock AI.

The form and the chat's product card share their fields, validation and `ProductApi`, so a product from either one appears in the Product List.

## Requirements

- Node.js 20+ (developed with Node 24)
- npm 10+

## Commands

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Start dev server (http://localhost:5173) | `npm run dev` |
| Production build (outputs to `dist/`) | `npm run build` |
| Preview the production build (http://localhost:4173) | `npm run preview` |
| Lint | `npm run lint` |
| Type-check app, config and e2e code | `npm run typecheck` |
| Unit and component tests (Vitest) | `npm test` |
| End-to-end tests (Playwright, desktop and mobile) | `npm run test:e2e` |
| Everything above | `npm run test:all` |

Before running e2e tests for the first time, install the browser: `npx playwright install chromium`. The e2e suite builds the app and serves it with `vite preview`.

## Try these prompts

| Prompt | Scenario |
| --- | --- |
| `What are your capabilities?` / `What can you do?` / `help` | Lists every prompt the assistant can answer, grouped by topic (from `CAPABILITY_PROMPTS` in `src/utils/mockResponses.ts`). |
| `Hello` | Simple greeting. Shows "Thinking" with no step timeline. |
| `Explain how large language models work` | Technical explanation. Regenerate returns a different variant. |
| `Write a TypeScript debounce function` | Code with syntax highlighting and a 4-step timeline. |
| `Compare REST, GraphQL and gRPC in a table` | GFM table and task list. |
| `Write a detailed guide about accessibility` | Long-form answer. Good for testing **Stop**. |
| `What is a headless CMS?` | CMS guidance. States that no CMS is connected. |
| `Help me plan a website launch` | Multi-step plan. |
| `Summarize: <paste text>` | Extractive summary built by a local word-frequency heuristic. |
| `Create a Product` | Agentic card product setup. First asks for product type, account currency and market segment, then shows the full setup in collapsible sections, ending in Save as Draft or Create Product. |
| `Create a product with Product Name: Platinum Product, currency: USD` | Same flow, using the choices given in the prompt. |
| `Show me visual report of products` | Products report. Asks for the chart type first (pie, bar or histogram, nothing pre-selected), then how to group the products. |
| `Show me Products in Pie Chart` / `Bar Chart` / `Histogram` | Products report in the named chart type; only the grouping is asked (scheme, currency, product type, market segment or status; for a histogram, live-from date, card validity or annual fee). A 3-second build step, then only that chart type: hover or arrow-key tooltips, legend toggles on the pie, a grouping switch and a data table. Uses a demo portfolio plus products created in this browser. |
| `Show me visual transaction data for 01712345678` (any phone number) | Transaction histogram for that number with a date-range filter (last 24 hours, 1 week, 1 month, 1 year), over-time or by-amount views, count or amount, summary tiles and a data table. The data is seeded demo data, the same each time for a given number. |
| `Give me customer information for this Phone Number '01789833786'` | Customer lookup. Shows the customer's profile straight away: name, customer ID, status, father's and mother's names, date of birth, mobile number, partly hidden email and registration date. The prompt can also say `CIF ID` or `Customer ID`. |
| `Give me customer information for '01789833786'` | The value's type isn't stated, so the assistant first asks whether it's a phone number, CIF ID or customer ID (nothing pre-selected), searches briefly, then shows the profile. A value that can't be that type (for example 11 digits as a customer ID) says so and offers to search as a different type. |
| `Simulate an error` / `/error` | Simulated generation failure with Retry. |
| `/unavailable` | Simulated "service unavailable" error. |
| Anything else | An honest fallback saying no real LLM is connected. |

## Features

**Chat**
- Send with Enter. Shift+Enter adds a new line. The composer grows as you type and has a length limit.
- Responses stream word by word. Chunk size and speed are configurable.
- **Stop** keeps the partial text and marks the response *cancelled*. All pending timers are cleared.
- **Regenerate** reruns the latest response using a different template variant. The response is labelled "Regenerated".
- **Edit and resubmit** updates a user message, discards everything after it, and generates a new answer.
- Message actions: copy (both roles), edit (user), and regenerate plus thumbs up/down for assistant messages. Feedback is stored locally.
- Retry for failed responses.
- A scroll-to-bottom button appears when you scroll away. Auto-follow only happens while you are at the bottom.

**Processing animation**
- Lifecycle: Idle → Thinking → Steps (complex scenarios only) → Streaming → Completed, Cancelled or Failed.
- Each step is shown as active (spinner), completed (check) or pending (neutral). Steps are driven by `step_started` and `step_completed` events from the service, not by UI timers.
- On completion the indicator collapses to "Thought for N seconds", using the measured elapsed time. It can be expanded to show the steps again.
- Cancelled responses show "Stopped after N seconds". Failed responses show an error. Neither is ever shown as completed.

**Conversations**
- A new chat is created when you send its first message. The title comes from that prompt.
- The sidebar groups chats into Today, Yesterday, Previous 7 Days and Older, sorted by most recent activity.
- Search covers titles and message content, shows snippets, and has an empty state.
- Rename inline (empty titles are rejected). Delete and Clear all both ask for confirmation.
- The URL hash (`#/c/<id>`) keeps the open conversation after a refresh. Unknown IDs show a "Conversation not found" state.

**Persistence (`localStorage`)**
- Storage keys are versioned (`ai-chat:conversations:v1`). Every stored record is validated before it is rendered.
- Messages that were in progress at reload are restored as *cancelled*, never as streaming.
- Corrupted data is backed up under `…:corrupted-backup`, the app starts fresh, and a notice is shown.
- Quota and unavailable-storage errors produce a single user-facing error rather than a crash.

**Agentic product creation** (follows the KONA PARTNER Product Setup flow)
- A prompt such as "Create a product" first asks for the **product basics** (product type, account currency, market segment, all mandatory). Anything the prompt already says is pre-filled and marked "From you".
- The assistant then prepares the full setup inside the chat as collapsible sections, one after another: **Basics → Policies → Permissions → Limits → Fees → Scheme configuration**. Collapsed sections show a one-line summary; Scheme configuration starts open because the user must fill it in. A sticky progress bar stays visible while scrolling.
  - **Basics:** product name, description, market segment, product type, account currency, card validity (years), default cardholder name, live-from date, and **Domestic / International transaction** toggles with their settlement currency (and international usage).
  - **Policies:** **PIN policy** and **Quota policy** toggles (PIN on, quota off by default) and Renewable / One-time renewal.
  - **Permissions:** domestic and international transaction types (**all selected** by default), plus country, currency and MCC controls (Allow All Except / Disallow All Except).
  - **Limits:** one domestic and one international limit by default; more can be added. Empty values mean "No limit".
  - **Fees:** two service fees by default, **Card Annual Maintenance Fee** and **ATM Cash Withdrawal Fee**, each with fee tiers; more service, domestic and international transaction fees can be added.
  - **Scheme configuration:** scheme, named and anonymous card templates, BIN and BIN range rows. Never pre-selected; submission is blocked until they are chosen.
- **Save as Draft** stores the product as a draft. The chat card links to the **Draft Product form** (`#/products/<id>/edit`), where it can be finished and submitted.
- **Create Product** validates every section (opening the ones with errors and marking them "N to fix"), then submits the product. It is then **Pending approval**: an approver must approve it. The chat card links to the **Product Details** page (`#/products/<id>`). No backend request data is shown.
- Choices from the prompt work as `Label: value` pairs ("Product Name: Platinum Product", "currency: USD", "validity: 3 years", "blocked MCCs: 7995") or plain wording ("a prepaid product called X with international transactions"). Choices from earlier messages in the same chat are remembered until the next product request.
- `MockProductApi` stores products in `localStorage`, numbers them from 1001, and rejects submitting a duplicate name under the same ASP with HTTP 409. Pass a real `ProductApi` to `<App productApi={...} />` to connect the card management system. Reference lists (policies, transaction types, MCCs, fee types, card ranges) are demo data in `src/services/productCatalog.ts`.

**Customer lookup** (demo data)
- Finds a customer by phone number (`01XXXXXXXXX`, optionally with `+88`), CIF ID (5–12 digits, optionally starting with `CIF`) or customer ID (up to 10 digits).
- `01789833786`, customer ID `13806` and CIF ID `CIF0013806` all return the sample customer, Mr. Nafidul Alam. Any other valid value returns a generated profile that is the same every time for that value (`src/utils/customerData.ts`); a phone search always shows the searched number.
- The email address is partly hidden. The result is saved with the chat.

**Mascot**
- A blue robot greets you on the welcome screen. It thinks in the chat while an answer is prepared, then rests beside the message box (working while the answer streams).
- **Click it** (anywhere it appears, even mid-answer) and it does a smooth 3D trick for 4–6 seconds, then lands back where it was. The trick is picked at random, never the same one twice in a row:
  - **Orbit:** a rocket loop into the screen, out to the roomier side and back past you.
  - **Corkscrew:** spirals up around a column twice on the rocket, then back down.
  - **Loop-the-loop:** flies out, loops a full circle like a stunt plane, turns round and flies home.
  - **Fly-by:** swoops right up to the camera in a barrel roll, then turns and zips home.
  - **Jetpack:** no rocket; blasts up on its own thrusters, backflips twice, spins and lands with a bounce.
- The page stays usable during a trick. Tricks are skipped when the user prefers reduced motion.

**Settings:** theme (System, Light or Dark), mock streaming speed, simulated multi-step progress on or off, clear all conversations, reset preferences, and a notice that data stays in this browser.

**Security**
- Markdown is rendered with `react-markdown` and `skipHtml`, so raw HTML is dropped. `dangerouslySetInnerHTML` is not used anywhere.
- URLs are restricted to `http(s)`, `mailto` and relative links. `javascript:`, `data:`, `vbscript:` and protocol-relative URLs are blocked.
- External links open with `rel="noopener noreferrer nofollow"`. Markdown images are not loaded automatically (no tracking pixels).
- Code is highlighted with `prism-react-renderer`, which builds React elements rather than HTML strings.
- User messages are rendered as plain text. An error boundary prevents stack traces from reaching the UI.

**Accessibility:** semantic landmarks, labelled controls, visible focus rings, and keyboard-operable menus (arrow keys and Escape). Dialogs trap focus and restore it when closed. A polite live region announces state changes such as "Assistant is thinking" and "Response complete", not each streamed token. The app respects `prefers-reduced-motion` and provides larger touch targets on coarse pointers. The shortcut **Ctrl/Cmd+Shift+O** starts a new chat.

## Architecture

```
src/
  app/            App.tsx (composition root), routes.tsx (hash routing)
  components/
    layout/       MainLayout, Sidebar, ConversationItem, Header
    chat/         ChatContainer, MessageList, MessageBubble, MessageActions,
                  ChatInput, WelcomeScreen, Markdown, CodeBlock
    assistant/    ProcessingIndicator, TaskProgress, TypingIndicator
    common/       IconButton, Tooltip, Modal, ConfirmDialog, Toast, ErrorState, ErrorBoundary
    settings/     SettingsDialog
  hooks/          useChat (lifecycle orchestration), useConversations (state + persistence),
                  useStreamingMock (abortable runs), conversationReducer, useSettings
  services/       mockAIService, conversationService, settingsService
  types/          chat.ts (messages, events, AIService contract), conversation.ts
  utils/          mockResponses (templates + matching), markdown, formatTime, search, ...
e2e/              Playwright specs
```

### Service contracts

`AIService` in `src/types/chat.ts` defines:

- `streamResponse(request, options)`: an async generator of `GenerationEvent`s (`started`, `step_started`, `step_completed`, `token`, `completed`, `cancelled`, `error`).
- `generateResponse(request, options)`
- `cancelGeneration(requestId)`

`ConversationService` in `src/types/conversation.ts` defines `listConversations`, `getConversation`, `saveConversation`, `renameConversation`, `deleteConversation` and `clearAll`.

The UI only depends on these interfaces. To connect a real backend, implement `AIService` (for example over SSE or `fetch` streaming) and pass it in with `<App aiService={myService} />`. No component changes are needed.

The mock engine (`src/services/mockAIService.ts`) scores prompts against keyword patterns in `src/utils/mockResponses.ts`, and the highest score wins. Cancellation uses `AbortController`: every scheduled delay is abortable and is cleaned up in a `finally` block, including when the consumer stops iterating early. A duplicate `requestId` is rejected, and the UI allows only one in-flight generation per conversation.

## Tests

- **Unit tests:** the mock engine (matching, event order, steps, cancellation and cleanup, duplicate guard, errors, measured duration), the storage service (round trip, corruption, invalid entries, never restoring a message as streaming, quota errors), the reducer, utilities (chunking, URL safety, date grouping, search, summary) and Markdown security (no script, `javascript:` or image injection).
- **Component and integration tests** (`src/app/App.test.tsx`): send and stream, keyboard behaviour, suggestions, step timeline versus simple requests, stop, regenerate, edit and resubmit, the error scenario, feedback, persistence across remounts, rename, search, delete, corrupted storage, missing conversation, theme and clear all.
- **E2E tests** (Playwright, desktop Chrome and Pixel 7): progressive streaming, no external requests, stop, persistence and deletion across reloads, XSS attempts, corrupted storage, the failure state, dark theme, no horizontal overflow, the mobile drawer, and keyboard input.

## Limitations

- Responses are pre-written templates selected by keyword matching. The app cannot answer arbitrary questions, use conversation context, or know current information. The summary scenario is a simple extractive heuristic, not an AI summary.
- No attachment support. The control is left out rather than shown as a non-working button.
- Feedback (thumbs up/down) is stored in the browser only and is not sent anywhere.
- Conversations are tied to a single browser profile and are not synced between tabs in real time. Two tabs open at once can overwrite each other's saves.
- Only the latest assistant message can be regenerated. Editing a message discards later messages instead of keeping alternate branches.
- `localStorage` limits total history to a few MB. When storage is full the app shows an error, and new messages remain in memory until some chats are deleted.
