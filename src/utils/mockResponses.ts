import type { ChatHistoryEntry } from '../types/chat';
import type { MessageAction } from '../types/product';
import { basicsFromPreferences, basicsIntroText, buildProductDraft, collectProductPreferences, CREATE_PRODUCT_PATTERN } from './productDraft';
import { customerChooseText, CUSTOMER_LOOKUP_PATTERN, customerFoundText, customerInvalidText, extractCustomerQuery, idTypeFromPrompt, isValidId, NO_CUSTOMER_QUERY_TEXT } from './customerData';
import { chartFromPrompt, extractPhone, NO_PHONE_TEXT, PRODUCT_REPORT_PATTERN, productReportIntro, TRANSACTION_REPORT_PATTERN, transactionIntro } from './reportData';

/**
 * Mock response templates. Everything here is pre-written demo content —
 * no model, search engine, database or external tool is involved.
 */

export interface MockStep {
  id: string;
  label: string;
}

export interface MockScenario {
  id: string;
  /** Keyword patterns; each match adds `weight` to the scenario score. */
  patterns: RegExp[];
  weight: number;
  /** Multi-step progress shown for complex scenarios only. */
  steps?: MockStep[];
  /** Simulated failure for testing the error experience. */
  error?: { code: 'mock_failure' | 'unavailable'; message: string };
  /** Response variants; regenerate cycles through them. */
  respond: (prompt: string, variant: number) => string;
  /** Agentic scenarios propose an action (with its own text) instead of a plain answer. */
  agent?: (prompt: string, history: ChatHistoryEntry[], now: Date) => { content: string; action?: MessageAction };
}

export const FALLBACK_RESPONSE =
  "This is a frontend demonstration. I don't have a real LLM connected, so I can't generate a verified answer to that request.\n\n" +
  'You can try one of the built-in demo topics instead:\n\n' +
  '- **Greetings** — say hello\n' +
  '- **Explanations** — "Explain how large language models work"\n' +
  '- **Code** — "Write a TypeScript debounce function"\n' +
  '- **Tables** — "Compare REST, GraphQL and gRPC in a table"\n' +
  '- **Planning** — "Help me plan a website launch"\n' +
  '- **Summaries** — "Summarize: <paste some text>"\n' +
  '- **CMS** — "Headless vs traditional CMS"\n' +
  '- **Errors** — "Simulate an error" to see the failure state';

const pick = (variants: string[], variant: number) => variants[((variant % variants.length) + variants.length) % variants.length];

const GENERIC_STEPS: MockStep[] = [
  { id: 'understand', label: 'Understanding the request' },
  { id: 'organize', label: 'Organizing the required steps' },
  { id: 'prepare', label: 'Preparing the response' },
  { id: 'generate', label: 'Generating the answer' },
];

/* ------------------------------------------------------------------ */
/* Summarization: a small, honest extractive summary of supplied text. */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set(
  'a an and are as at be been but by for from has have in is it its of on or that the this to was were will with which you your we our they their can not than then there these those into about also more such so if do does'.split(
    ' ',
  ),
);

export function extractSourceText(prompt: string): string {
  const colon = prompt.indexOf(':');
  const afterColon = colon >= 0 ? prompt.slice(colon + 1) : '';
  const candidate = afterColon.trim().length > 80 ? afterColon : prompt.replace(/^\s*(please\s+)?(summari[sz]e|tl;?dr)[^\n]*\n?/i, '');
  return candidate.trim();
}

export function summarizeText(text: string, maxSentences = 3): { points: string[]; words: number; sentences: number } {
  const sentences = (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.split(' ').length >= 4);
  const words = text.split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    const k = w.toLowerCase().replace(/[^a-z0-9'-]/g, '');
    if (k.length > 2 && !STOP_WORDS.has(k)) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const scored = sentences.map((s, index) => {
    const tokens = s.toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z0-9'-]/g, ''));
    const score = tokens.reduce((sum, t) => sum + (freq.get(t) ?? 0), 0) / Math.max(4, tokens.length);
    return { s, index, score: score + (index === 0 ? 0.5 : 0) };
  });
  const top = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((x) => x.s);
  return { points: top, words: words.length, sentences: sentences.length };
}

function respondSummary(prompt: string): string {
  const source = extractSourceText(prompt);
  if (source.split(/\s+/).length < 25) {
    return (
      "I'd be glad to summarize something — paste the text after your request, for example:\n\n" +
      '> Summarize: *your paragraph or article here*\n\n' +
      "In this demo the summary is produced by a simple local extractive heuristic (it picks the most representative sentences). " +
      "It isn't an AI-generated abstract, so treat it as a rough overview."
    );
  }
  const { points, words, sentences } = summarizeText(source);
  return [
    '## Summary',
    '',
    ...points.map((p) => `- ${p}`),
    '',
    `**Source length:** ${words} words, ${sentences} sentences.`,
    '',
    '_Demo note: these key sentences were selected by a local word-frequency heuristic, not by a language model. Check the original text for nuance._',
  ].join('\n');
}

/* ------------------------------------------------------------------ */

const CODE_TS = `Here's a small, type-safe **debounce** utility in TypeScript:

\`\`\`ts
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs = 300,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Args) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return debounced;
}
\`\`\`

### How it works

1. Every call **clears** the previously scheduled timer.
2. A new timer is scheduled for \`waitMs\` milliseconds.
3. \`fn\` only runs once calls stop arriving for the full wait period.
4. \`cancel()\` lets you drop a pending call — useful when a component unmounts.

### Usage

\`\`\`tsx
const search = debounce((query: string) => fetchResults(query), 250);

<input onChange={(e) => search(e.target.value)} />
\`\`\`

> Tip: in React, create the debounced function once (e.g. with \`useMemo\`) and call \`cancel()\` in an effect cleanup.`;

const CODE_PY = `Here's an alternative take — a **retry with exponential backoff** helper, shown in Python:

\`\`\`python
import random
import time
from typing import Callable, TypeVar

T = TypeVar("T")

def retry(fn: Callable[[], T], attempts: int = 4, base_delay: float = 0.5) -> T:
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception:
            if attempt == attempts:
                raise
            delay = base_delay * 2 ** (attempt - 1)
            time.sleep(delay + random.uniform(0, delay / 2))  # add jitter
    raise RuntimeError("unreachable")
\`\`\`

**Key ideas**

- The delay doubles after each failure: 0.5s → 1s → 2s.
- *Jitter* spreads retries out so many clients don't retry at the same instant.
- The final failure is re-raised so callers can handle it.

_This is a pre-written demo snippet; review and test it before using it in production._`;

const CODE_FIX = `I can't run or inspect your code in this demo, but here's a reliable checklist for tracking down a bug:

1. **Reproduce it** with the smallest possible input.
2. **Read the full error** — the first stack frame in *your* code is usually the culprit.
3. **Check assumptions** with logging or a debugger breakpoint:
   \`\`\`js
   console.log({ value, type: typeof value });
   \`\`\`
4. **Bisect**: comment out half the logic, see if the bug persists, repeat.
5. **Write a failing test** before fixing, so the bug can't silently return.

Paste a snippet and describe what you expected vs. what happened — in a real deployment an LLM would analyze it. Here, you'll get this generic guidance.`;

const EXPLAIN_LLM = `## How large language models generate text

At a high level, an LLM is a **next-token predictor**.

1. **Tokenization** — your text is split into *tokens* (word pieces), e.g. \`"streaming"\` → \`"stream"\` + \`"ing"\`.
2. **Context encoding** — each token becomes a vector, and a *transformer* network uses **attention** to weigh how every token relates to every other token.
3. **Prediction** — the model outputs a probability for every possible next token.
4. **Sampling** — one token is chosen (settings like *temperature* control how adventurous the choice is).
5. **Repeat** — the chosen token is appended and the loop runs again until the answer is complete.

That loop is why chat apps **stream** responses: tokens are shown as soon as they're produced.

> In this demo, the "streaming" is simulated by revealing a pre-written answer a few words at a time.`;

const EXPLAIN_LLM_ALT = `## LLMs in one analogy

Think of an LLM as an extremely well-read autocomplete:

- It has learned **statistical patterns** of language from a large body of text.
- Given what's been written so far, it repeatedly asks: *"What token most plausibly comes next?"*
- **Attention** lets it look back across the whole conversation to stay on topic.

**Important limitations**

| Limitation | Why it happens |
| --- | --- |
| Can state false things confidently | It predicts plausible text, not verified facts |
| Limited context window | Only a fixed number of tokens fit in memory |
| Knowledge cutoff | Training data stops at a point in time |

_Demo content — no model is running here._`;

const EXPLAIN_CLOSURE = `## Closures in JavaScript

A **closure** is a function that *remembers* the variables from the scope where it was created — even after that scope has finished running.

\`\`\`js
function makeCounter() {
  let count = 0;            // captured by the inner function
  return () => ++count;
}

const next = makeCounter();
next(); // 1
next(); // 2
\`\`\`

**Why it matters**

- Enables private state (like \`count\` above).
- Powers callbacks, event handlers and React hooks.
- Can cause *stale values* if a callback captures an old variable — a common React \`useEffect\` bug.`;

const EXPLAIN_EVENT_LOOP = `## The JavaScript event loop

JavaScript runs on a **single thread**, but stays responsive thanks to the event loop:

1. **Call stack** — synchronous code runs to completion.
2. **Microtask queue** — resolved promises (\`.then\`, \`await\` continuations) run next.
3. **Macrotask queue** — timers, I/O and UI events run one at a time.
4. The browser may **render** between macrotasks.

\`\`\`js
console.log('A');
setTimeout(() => console.log('D'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('B');
// Output: A, B, C, D
\`\`\`

Long synchronous work blocks everything — split it up or move it to a Web Worker.`;

const EXPLAIN_REST = `## What is a REST API?

**REST** (Representational State Transfer) is a style for designing web APIs around **resources**.

- Each resource has a URL, e.g. \`/users/42\`.
- Standard HTTP methods express intent:
  - \`GET\` read · \`POST\` create · \`PUT\`/\`PATCH\` update · \`DELETE\` remove
- Responses use status codes: \`200 OK\`, \`201 Created\`, \`404 Not Found\`…
- Requests are **stateless** — each one carries everything the server needs.

\`\`\`http
GET /users/42 HTTP/1.1
Accept: application/json
\`\`\`

_This app itself makes no API calls — all responses are generated locally._`;

const EXPLAIN_GENERIC = `Here's a general framework I use to explain any technical concept:

1. **One-sentence definition** — what is it, in plain words?
2. **The problem it solves** — why does it exist?
3. **A concrete example** — code, a diagram, or an analogy.
4. **Trade-offs** — when *not* to use it.
5. **Related ideas** — what to learn next.

This demo has detailed write-ups for a few topics: *large language models*, *closures*, *the event loop*, and *REST APIs*. Try asking about one of those!`;

const TABLE_COMPARE = `Here's a side-by-side comparison of common API styles:

| Feature | REST | GraphQL | gRPC |
| --- | --- | --- | --- |
| Transport | HTTP/1.1+ | HTTP | HTTP/2 |
| Data format | JSON (usually) | JSON | Protocol Buffers |
| Fetching | Fixed endpoints | Client-defined queries | Typed RPC methods |
| Over-fetching | Common | Rare | Rare |
| Browser support | Native | Native | Needs a proxy |
| Caching | Easy (HTTP) | Harder | Custom |
| Best for | Public APIs, CRUD | Complex UIs | Service-to-service |

### Quick checklist for choosing

- [x] Need simple, cacheable public endpoints → **REST**
- [x] Many screens needing different data shapes → **GraphQL**
- [ ] Low-latency internal microservices → **gRPC**

_Pre-written demo content for illustrating Markdown tables and task lists._`;

const LIST_TIPS = `Here's a list of **10 habits for writing maintainable frontend code**:

1. Keep components small and focused on one job.
2. Separate business logic from presentation.
3. Name things after *what they mean*, not how they look.
4. Prefer derived state over duplicated state.
5. Type your data at the boundaries (API, storage).
6. Co-locate tests with the code they cover.
7. Make loading, empty and error states explicit.
8. Treat accessibility as a requirement, not a polish step.
9. Avoid premature abstraction — duplicate twice, abstract on the third.
10. Delete dead code promptly.`;

const LONG_FORM = `# A practical guide to accessible web applications

Accessibility isn't a feature you bolt on at the end — it's a quality of well-built software. This guide walks through the essentials.

## 1. Start with semantic HTML

Native elements come with keyboard support and screen-reader semantics for free.

- Use \`<button>\` for actions and \`<a href>\` for navigation.
- Use headings (\`h1\`–\`h6\`) in order to create a document outline.
- Use \`<label>\` for every form control.
- Landmark elements — \`<header>\`, \`<nav>\`, \`<main>\`, \`<aside>\` — help users jump around.

## 2. Make everything keyboard-operable

Unplug your mouse and try your app. You should be able to:

1. Reach every interactive element with **Tab**.
2. See where focus is at all times.
3. Activate controls with **Enter** or **Space**.
4. Close dialogs and menus with **Escape**.

When a dialog opens, move focus into it; when it closes, return focus to the element that opened it.

## 3. Provide visible focus indicators

Never remove outlines without replacing them:

\`\`\`css
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
\`\`\`

## 4. Use color carefully

- Aim for a contrast ratio of at least **4.5:1** for body text.
- Don't rely on color alone — pair it with icons or text.
- Test both light and dark themes.

## 5. Announce dynamic changes thoughtfully

Live regions (\`aria-live="polite"\`) tell screen readers about updates. Announce **meaningful** state changes ("Response complete"), not every keystroke or streamed word.

## 6. Respect motion preferences

\`\`\`css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
\`\`\`

## 7. Test with real tools

| Tool | What it catches |
| --- | --- |
| Automated linters (axe) | Missing labels, contrast, ARIA misuse |
| Keyboard-only testing | Focus traps, unreachable controls |
| Screen readers | Confusing reading order, unlabeled icons |
| Zoom to 200% | Layout breakage, clipped text |

## Conclusion

Accessible apps are easier for *everyone* to use. Build on semantic HTML, keep everything operable from the keyboard, communicate state changes clearly, and test with real assistive technology.

_This long-form answer is pre-written demo content._`;

const CMS_COMPARE = `## Headless vs. traditional CMS

| Aspect | Traditional CMS | Headless CMS |
| --- | --- | --- |
| Architecture | Content + presentation coupled | Content API only |
| Frontend | Built-in themes/templates | Any framework (React, Vue, mobile) |
| Editor preview | Native | Requires preview setup |
| Multi-channel | Limited | Web, app, kiosk, email… |
| Hosting | Usually one server | Separate frontend + CMS |
| Typical examples | WordPress, Drupal | Contentful, Strapi, Sanity |

### When to choose which

- **Traditional** — marketing sites with a small team that wants themes and plugins out of the box.
- **Headless** — multiple frontends, a dedicated dev team, or strict performance requirements.

### Migration tips

1. Audit and model your content types first.
2. Map old URLs to new ones and set up redirects.
3. Migrate a pilot section before the full site.

> Note: this demo isn't connected to any CMS. I can't read, create or publish your content — this is general guidance only.`;

const CMS_GENERIC = `Here's some general guidance on working with content management systems:

- **Model content, not pages.** Define reusable types (Article, Author, Product) with clear fields.
- **Separate drafts from published content** and use roles for review and approval.
- **Use structured rich text** rather than raw HTML for portability.
- **Plan localization early** — retrofitting translations is painful.
- **Version and back up** content regularly.

> I don't have access to any CMS in this demo, so I can't look up, edit or publish entries for you.`;

const PLAN_LAUNCH = `## Two-week website launch plan

### Week 1 — Build

| Day | Focus | Output |
| --- | --- | --- |
| 1 | Goals & audience | One-page brief |
| 2 | Sitemap & wireframes | Page list, rough layouts |
| 3–4 | Content drafting | Copy for all pages |
| 5 | Visual design | Styled home + one inner page |

### Week 2 — Ship

| Day | Focus | Output |
| --- | --- | --- |
| 6–7 | Development | Responsive pages |
| 8 | SEO & analytics | Meta tags, sitemap, tracking |
| 9 | QA | Cross-browser, mobile, accessibility pass |
| 10 | Launch | DNS, monitoring, announcement |

### Launch checklist

- [ ] Domain and SSL configured
- [ ] Forms tested end-to-end
- [ ] 404 page and redirects in place
- [ ] Performance budget checked
- [ ] Backup and rollback plan ready

**Risks to watch:** content arriving late (start drafting early) and scope creep (keep a "post-launch" list).`;

const PLAN_GENERIC = `Here's a structured approach to plan almost any task:

1. **Define the outcome** — what does "done" look like? Write one sentence.
2. **List constraints** — deadline, budget, people, dependencies.
3. **Break it down** into tasks that take no more than a day each.
4. **Order by dependency**, then by risk — tackle unknowns early.
5. **Estimate and buffer** — add ~20% for surprises.
6. **Set checkpoints** to review progress and adjust.

### Template

- [ ] Goal:
- [ ] Deadline:
- [ ] Milestone 1:
- [ ] Milestone 2:
- [ ] Final review:

Tell me more about your task (scope, deadline, team size) and I'll tailor the outline — within the limits of this demo's pre-written templates.`;

/** A prompt the assistant can answer, listed in the "What are your capabilities?" reply. */
export interface CapabilityPrompt {
  group: string;
  prompt: string;
  description: string;
  /** The scenario the prompt triggers (a test keeps this honest). */
  scenario: string;
}

export const CAPABILITY_PROMPTS: CapabilityPrompt[] = [
  {
    group: 'Card products',
    prompt: 'Create a Product',
    description: 'Sets up a card product with you: basics, policies, permissions, limits, fees and scheme configuration. Save it as a draft or submit it for approval.',
    scenario: 'createProduct',
  },
  { group: 'Card products', prompt: 'Create a product with Product Name: Platinum Product, currency: USD', description: 'The same setup, pre-filled with the details you give.', scenario: 'createProduct' },
  { group: 'Card products', prompt: 'Create a prepaid product called Student Saver in BDT with international transactions', description: 'Details can also be written in plain words.', scenario: 'createProduct' },
  { group: 'Reports', prompt: 'Show me visual report of products', description: 'Asks which chart you want (pie, bar or histogram) and how to group the products, then draws it.', scenario: 'productReport' },
  { group: 'Reports', prompt: 'Show me Products in Pie Chart', description: 'Asks only how to group the products (scheme, currency, product type…), then draws an interactive pie chart.', scenario: 'productReport' },
  { group: 'Reports', prompt: 'Show me Products in Bar Chart', description: 'The same report as a bar chart.', scenario: 'productReport' },
  { group: 'Reports', prompt: 'Show me Products in Histogram', description: 'How products spread by live-from date, card validity or annual fee.', scenario: 'productReport' },
  { group: 'Reports', prompt: 'Show me visual transaction data for 01712345678', description: 'A transaction histogram for any phone number, with a date-range filter.', scenario: 'transactionReport' },
  { group: 'Customers', prompt: "Give me customer information for this Phone Number '01789833786'", description: "Finds the customer and shows their profile: name, status, parents' names, date of birth, contact details and registration date.", scenario: 'customerLookup' },
  { group: 'Customers', prompt: "Give me customer information for CIF ID 'CIF0013806'", description: 'The same lookup by CIF ID (or say "Customer ID 13806").', scenario: 'customerLookup' },
  { group: 'Customers', prompt: "Give me customer information for '01789833786'", description: 'Asks whether the value is a phone number, CIF ID, customer ID or NID, then searches.', scenario: 'customerLookup' },
  { group: 'Explanations', prompt: 'Explain how large language models work', description: 'A plain-language explanation.', scenario: 'explain' },
  { group: 'Explanations', prompt: 'Explain closures in JavaScript', description: 'A short explanation with an example.', scenario: 'explain' },
  { group: 'Explanations', prompt: 'How does the event loop work?', description: 'How asynchronous JavaScript runs.', scenario: 'explain' },
  { group: 'Explanations', prompt: 'Explain what a REST API is', description: 'The basics of REST.', scenario: 'explain' },
  { group: 'Code', prompt: 'Write a TypeScript debounce function', description: 'Code with an explanation.', scenario: 'code' },
  { group: 'Code', prompt: 'Write a retry function in Python', description: 'A retry helper with exponential backoff.', scenario: 'code' },
  { group: 'Code', prompt: 'Help me debug a bug in my code', description: 'A checklist for tracking down a bug.', scenario: 'code' },
  { group: 'Comparisons and lists', prompt: 'Compare REST, GraphQL and gRPC in a table', description: 'A comparison table.', scenario: 'table' },
  { group: 'Comparisons and lists', prompt: 'List 10 habits for maintainable frontend code', description: 'A numbered list.', scenario: 'table' },
  { group: 'Writing and planning', prompt: 'Write a detailed guide about accessibility', description: 'A long-form guide.', scenario: 'longform' },
  { group: 'Writing and planning', prompt: 'Help me plan a website launch', description: 'A step-by-step plan.', scenario: 'plan' },
  { group: 'Writing and planning', prompt: 'Summarize: <paste your text>', description: 'The key points of a text you paste.', scenario: 'summarize' },
  { group: 'Content management', prompt: 'What is a headless CMS?', description: 'CMS guidance.', scenario: 'cms' },
  { group: 'Content management', prompt: 'Headless vs traditional CMS', description: 'A side-by-side comparison.', scenario: 'cms' },
  { group: 'Testing the chat', prompt: 'Simulate an error', description: 'Shows the failure state with Retry.', scenario: 'error' },
  { group: 'Testing the chat', prompt: '/unavailable', description: 'Shows the "service unavailable" state.', scenario: 'unavailable' },
];

function capabilitiesText(): string {
  const lines = ["Here's what I can help with. Try any of these prompts:"];
  for (const group of new Set(CAPABILITY_PROMPTS.map((c) => c.group))) {
    lines.push('', `**${group}**`, ...CAPABILITY_PROMPTS.filter((c) => c.group === group).map((c) => `- \`${c.prompt}\` — ${c.description}`));
  }
  lines.push(
    '',
    'You can also just say hello, or ask "What are your capabilities?" to see this list again.',
    '',
    "_This is a demo: answers come from pre-written content, not a live AI model. For anything outside this list, I'll tell you I can't answer it._",
  );
  return lines.join('\n');
}

export const MOCK_SCENARIOS: MockScenario[] = [
  {
    id: 'productReport',
    patterns: [PRODUCT_REPORT_PATTERN],
    // Outranks "create a product …" when the request is for a chart of products.
    weight: 30,
    steps: [
      { id: 'understand', label: 'Reading your request' },
      { id: 'groupings', label: 'Finding ways to group the products' },
    ],
    respond: () => '',
    agent: (prompt) => {
      const chart = chartFromPrompt(prompt);
      return { content: productReportIntro(chart), action: { type: 'productReport', status: 'choosing', chart, chartFromPrompt: chart !== null, groupBy: null } };
    },
  },
  {
    id: 'transactionReport',
    patterns: [TRANSACTION_REPORT_PATTERN],
    weight: 30,
    steps: [
      { id: 'understand', label: 'Reading your request' },
      { id: 'fetch', label: 'Collecting the transactions' },
      { id: 'chart', label: 'Drawing the histogram' },
    ],
    respond: () => NO_PHONE_TEXT,
    agent: (prompt, _history, now) => {
      const phone = extractPhone(prompt);
      if (!phone) return { content: NO_PHONE_TEXT };
      return { content: transactionIntro(phone), action: { type: 'transactionReport', phone, range: '7d', view: 'time', metric: 'count', asOf: now.getTime() } };
    },
  },
  {
    id: 'customerLookup',
    patterns: [CUSTOMER_LOOKUP_PATTERN],
    weight: 30,
    steps: [
      { id: 'understand', label: 'Reading your request' },
      { id: 'search', label: 'Searching customer records' },
    ],
    respond: () => NO_CUSTOMER_QUERY_TEXT,
    agent: (prompt, _history, now) => {
      const query = extractCustomerQuery(prompt);
      if (!query) return { content: NO_CUSTOMER_QUERY_TEXT };
      const idType = idTypeFromPrompt(prompt);
      if (!idType) return { content: customerChooseText(query), action: { type: 'customerLookup', query, idType: null, idTypeFromPrompt: false, status: 'choosing' } };
      const valid = isValidId(query, idType);
      return {
        content: valid ? customerFoundText(query, idType) : customerInvalidText(query, idType),
        action: { type: 'customerLookup', query, idType, idTypeFromPrompt: true, status: valid ? 'found' : 'invalid', searchedAt: now.getTime() },
      };
    },
  },
  {
    id: 'createProduct',
    patterns: [CREATE_PRODUCT_PATTERN],
    weight: 20,
    steps: [
      { id: 'understand', label: 'Reading your request' },
      { id: 'spec', label: 'Checking the Product Create requirements' },
      { id: 'basics', label: 'Working out what to ask first' },
    ],
    respond: () => '',
    agent: (prompt, history, now) => {
      const userMessages = history.filter((h) => h.role === 'user').map((h) => h.content);
      if (userMessages.at(-1) !== prompt) userMessages.push(prompt);
      const preferences = collectProductPreferences(userMessages, now);
      return {
        content: basicsIntroText(preferences),
        action: {
          type: 'createProduct',
          status: 'collecting',
          values: buildProductDraft(preferences.values, { today: now }),
          userProvided: preferences.fields,
          preferences: preferences.values,
          basics: basicsFromPreferences(preferences.values),
          basicsConfirmed: false,
        },
      };
    },
  },
  {
    id: 'error',
    patterns: [/\b(simulate|trigger|test)\s+(an?\s+)?(error|failure)\b/i, /^\/error\b/i],
    weight: 100,
    steps: [
      { id: 'understand', label: 'Understanding the request' },
      { id: 'prepare', label: 'Preparing the response' },
    ],
    error: { code: 'mock_failure', message: 'The mock service simulated a generation failure. Nothing was lost — you can retry.' },
    respond: () => '',
  },
  {
    id: 'unavailable',
    patterns: [/\b(simulate|trigger)\s+(an?\s+)?(outage|unavailable)\b/i, /^\/unavailable\b/i],
    weight: 100,
    error: { code: 'unavailable', message: 'Mock responses are temporarily unavailable (simulated outage). Please try again.' },
    respond: () => '',
  },
  {
    id: 'greeting',
    patterns: [/^\s*(hi|hello|hey|hiya|howdy|yo|greetings|good\s+(morning|afternoon|evening))\b/i, /^\s*(thanks|thank you)\b/i],
    weight: 3,
    respond: (prompt, v) =>
      /^\s*(thanks|thank you)/i.test(prompt)
        ? "You're welcome! Let me know if there's anything else you'd like to try in this demo."
        : pick(
            [
              "Hello! 👋 I'm the demo assistant. I'm running entirely in your browser with pre-written mock responses, so I can't answer arbitrary questions — but I can show you how a chat experience works. Try asking me to **explain a concept**, **write some code**, or **plan a task**.",
              'Hi there! What would you like to explore? You can ask for code samples, comparison tables, a project plan, or a summary of some text.',
            ],
            v,
          ),
  },
  {
    id: 'capabilities',
    patterns: [
      /\bcapabilit(y|ies)\b/i,
      /\bwhat\s+can\s+you\s+(do|help)\b/i,
      /\bwhat\s+(prompts|questions|commands|things)\s+(can|do|should)\s+i\b/i,
      /\bwhat\s+are\s+your\s+(skills|features|abilities|functions)\b/i,
      /\b(who|what)\s+are\s+you\b/i,
      /\bare\s+you\s+(real|an?\s+ai|chatgpt)\b/i,
      /^\s*\/?help\s*\??\s*$/i,
    ],
    // Outranks the generic "what are …" explanation and "list" patterns.
    weight: 10,
    respond: () => capabilitiesText(),
  },
  {
    id: 'summarize',
    patterns: [/\bsummar(y|i[sz]e|i[sz]ing)\b/i, /\btl;?dr\b/i, /\bkey\s+points\b/i],
    weight: 6,
    steps: [
      { id: 'read', label: 'Reading the provided text' },
      { id: 'extract', label: 'Identifying key sentences' },
      { id: 'draft', label: 'Drafting the summary' },
    ],
    respond: (prompt) => respondSummary(prompt),
  },
  {
    id: 'plan',
    patterns: [/\bplan(ning)?\b/i, /\broadmap\b/i, /\bschedule\b/i, /\bmilestones?\b/i, /\bstep[-\s]by[-\s]step\b/i, /\blaunch\b/i, /\borgani[sz]e\b/i],
    weight: 3,
    steps: GENERIC_STEPS,
    respond: (prompt, v) => (/\b(launch|website|site)\b/i.test(prompt) && v % 2 === 0 ? PLAN_LAUNCH : pick([PLAN_GENERIC, PLAN_LAUNCH], v)),
  },
  {
    id: 'cms',
    patterns: [/\bcms\b/i, /\bheadless\b/i, /\b(wordpress|drupal|contentful|strapi|sanity|joomla|ghost)\b/i, /\bcontent\s+management\b/i],
    weight: 5,
    steps: [
      { id: 'understand', label: 'Understanding the request' },
      { id: 'compare', label: 'Comparing CMS approaches' },
      { id: 'generate', label: 'Generating the answer' },
    ],
    respond: (prompt, v) => (/\b(headless|vs|versus|compare|traditional|difference)\b/i.test(prompt) ? pick([CMS_COMPARE, CMS_GENERIC], v) : pick([CMS_GENERIC, CMS_COMPARE], v)),
  },
  {
    id: 'code',
    patterns: [
      /\b(write|create|implement|build|generate|improve|refactor)\b.*\b(code|function|class|component|script|hook|snippet|program)\b/i,
      /\b(typescript|javascript|python|react|debounce|algorithm|regex)\b/i,
      /\b(bug|debug|error\s+in\s+my|fix\s+my|stack\s*trace|exception)\b/i,
      /```/,
    ],
    weight: 3,
    steps: [
      { id: 'understand', label: 'Understanding the request' },
      { id: 'design', label: 'Designing the solution' },
      { id: 'write', label: 'Writing the code' },
      { id: 'review', label: 'Reviewing for edge cases' },
    ],
    respond: (prompt, v) => {
      if (/\b(bug|debug|fix|stack\s*trace|exception|not\s+working)\b/i.test(prompt)) return CODE_FIX;
      if (/\bpython\b/i.test(prompt)) return pick([CODE_PY, CODE_TS], v);
      return pick([CODE_TS, CODE_PY], v);
    },
  },
  {
    id: 'table',
    patterns: [/\btable\b/i, /\bcompar(e|ison)\b/i, /\bvs\.?\b|\bversus\b/i, /\bpros\s+and\s+cons\b/i, /\b(list|top\s+\d+|\d+\s+(tips|ways|habits|ideas))\b/i],
    weight: 2,
    steps: [
      { id: 'understand', label: 'Understanding the request' },
      { id: 'structure', label: 'Structuring the comparison' },
      { id: 'generate', label: 'Generating the answer' },
    ],
    respond: (prompt, v) => (/\b(list|tips|ways|habits|ideas)\b/i.test(prompt) && !/\btable\b/i.test(prompt) ? pick([LIST_TIPS, TABLE_COMPARE], v) : pick([TABLE_COMPARE, LIST_TIPS], v)),
  },
  {
    id: 'longform',
    patterns: [/\b(essay|article|guide|in[-\s]depth|in\s+detail|detailed|comprehensive|long[-\s]form|write\s+up)\b/i, /\baccessib(le|ility)\b/i],
    weight: 3,
    steps: [
      { id: 'understand', label: 'Understanding the request' },
      { id: 'outline', label: 'Outlining the sections' },
      { id: 'prepare', label: 'Preparing the response' },
      { id: 'generate', label: 'Generating the answer' },
    ],
    respond: () => LONG_FORM,
  },
  {
    id: 'explain',
    patterns: [/\b(explain|what\s+is|what\s+are|how\s+does|how\s+do|why\s+does|describe|teach\s+me|eli5)\b/i, /\b(llms?|language\s+models?|closures?|event\s+loop|rest\s+api|api)\b/i],
    weight: 2,
    respond: (prompt, v) => {
      if (/\b(llms?|language\s+models?|gpt|ai\s+models?|transformers?|tokens?)\b/i.test(prompt)) return pick([EXPLAIN_LLM, EXPLAIN_LLM_ALT], v);
      if (/\bclosures?\b/i.test(prompt)) return EXPLAIN_CLOSURE;
      if (/\b(event\s+loop|async|await|promises?)\b/i.test(prompt)) return EXPLAIN_EVENT_LOOP;
      if (/\b(rest|api|http)\b/i.test(prompt)) return EXPLAIN_REST;
      return EXPLAIN_GENERIC;
    },
  },
];

export interface ScenarioMatch {
  scenario: MockScenario | null;
  score: number;
}

/** Deterministic matching: highest score wins; ties go to the earlier scenario. */
export function matchScenario(prompt: string, scenarios: MockScenario[] = MOCK_SCENARIOS): ScenarioMatch {
  let best: ScenarioMatch = { scenario: null, score: 0 };
  for (const scenario of scenarios) {
    const hits = scenario.patterns.reduce((n, p) => n + (p.test(prompt) ? 1 : 0), 0);
    const score = hits * scenario.weight;
    if (score > best.score) best = { scenario, score };
  }
  return best;
}

export const SUGGESTIONS = [
  {
    id: 'visual',
    title: 'Show visual data',
    description: 'Chart your products by scheme, currency and more',
    prompt: 'Show me visual report of products',
  },
  {
    id: 'product',
    title: 'Create a Product',
    description: 'Set up a new card product step by step',
    prompt: 'Create a Product',
  },
  {
    id: 'summarize',
    title: 'Summarize a document or text',
    description: 'Condense a passage into key points',
    prompt:
      'Summarize this text: Remote work has changed how teams collaborate. Many companies adopted distributed workflows during the past few years, and a large share kept them afterwards. ' +
      'Employees often report better focus and less commuting time, while managers worry about onboarding and spontaneous collaboration. ' +
      'Successful remote teams tend to document decisions in writing, keep meetings short and purposeful, and set clear expectations about response times. ' +
      'Tools matter less than habits: a shared written culture helps new members find context without interrupting colleagues. ' +
      'Hybrid models try to combine the benefits of both, but they can create inequality if in-office staff receive more visibility.',
  },
  {
    id: 'plan',
    title: 'Help me plan a task',
    description: 'A two-week website launch plan',
    prompt: 'Help me plan the launch of a small marketing website over the next two weeks.',
  },
] as const;
