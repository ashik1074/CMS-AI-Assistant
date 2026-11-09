import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AIService } from '../types/chat';
import { LocalConversationService } from '../services/conversationService';
import { MockAIService } from '../services/mockAIService';
import { seedDemoProducts } from '../services/demoProducts';
import { MockProductApi, PRODUCTS_KEY } from '../services/productService';
import { App } from './App';

function setup({ seeded = false } = {}) {
  if (seeded) seedDemoProducts(localStorage);
  const user = userEvent.setup();
  const productApi = new MockProductApi(localStorage, 1);
  render(<App conversationService={new LocalConversationService(localStorage)} productApi={productApi} />);
  return { user, productApi };
}

const mainNav = () => within(screen.getByRole('navigation', { name: 'Main' }));
const rows = () => screen.getAllByRole('row').slice(1);

/** Fills in every mandatory Basics field. */
async function fillBasics(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText(/^Product Name/), name);
  await user.selectOptions(screen.getByLabelText(/^Market Segment/), 'CONSUMER');
  await user.selectOptions(screen.getByLabelText(/^Product Type/), 'PREPAID');
  await user.selectOptions(screen.getByLabelText(/^Account Currency/), 'BDT');
  await user.selectOptions(screen.getByLabelText(/^Card Validity/), '5');
  await user.type(screen.getByLabelText(/^Live From/), '2030-01-15');
}

const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Next Step' }));

describe('Portal', { timeout: 30000 }, () => {
  it('lands on the Product List, with the sidebar links and the assistant one click away', async () => {
    const { user } = setup({ seeded: true });
    expect(screen.getByRole('heading', { name: 'Product List' })).toBeInTheDocument();
    expect(screen.queryByTestId('welcome-screen')).not.toBeInTheDocument();
    expect(mainNav().getByRole('button', { name: 'Product Management' })).toBeInTheDocument();
    expect(mainNav().getByRole('link', { name: 'Product List' })).toHaveAttribute('aria-current', 'page');

    await waitFor(() => expect(rows()).toHaveLength(7));
    // Newest first, and only drafts can be deleted.
    expect(within(rows()[0]).getByRole('link', { name: 'Agent Product' })).toBeInTheDocument();
    expect(within(rows()[0]).getByRole('button', { name: 'Delete Agent Product' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete Debit Product 2' })).toBeDisabled();

    await user.click(mainNav().getByRole('link', { name: 'AI Assistant' }));
    expect(await screen.findByRole('heading', { name: 'What can I help you with?' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/assistant');
    expect(mainNav().getByRole('link', { name: 'AI Assistant' })).toHaveAttribute('aria-current', 'page');

    await user.click(mainNav().getByRole('link', { name: 'Product List' }));
    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeInTheDocument();
  });

  it('searches and filters the list, and deletes a draft after confirming', async () => {
    const { user } = setup({ seeded: true });
    await waitFor(() => expect(rows()).toHaveLength(7));

    await user.type(screen.getByRole('searchbox', { name: 'Search by product' }), 'debit');
    expect(rows()).toHaveLength(2);
    await user.clear(screen.getByRole('searchbox', { name: 'Search by product' }));

    await user.click(screen.getByRole('button', { name: 'Filter by status' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Draft' }));
    expect(rows()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Delete Agent Product' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByRole('link', { name: 'Agent Product' })).not.toBeInTheDocument();
  });

  it('shows an empty list without sample products', async () => {
    setup();
    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
  });

  it('walks the Product Setup form step by step and submits the product', async () => {
    const { user, productApi } = setup();
    await user.click(screen.getByRole('link', { name: 'Product Setup' }));
    const page = await screen.findByTestId('product-setup-page');
    expect(within(page).getByRole('heading', { name: 'Create Product' })).toBeInTheDocument();
    expect(within(page).getByText('Prerequisites Required')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Product Name/)).toHaveValue('');
    // Later steps can't be opened yet.
    expect(within(page).getByRole('button', { name: 'Schemes' })).toBeDisabled();

    // Mandatory fields hold the user on the step.
    await next(user);
    expect(within(page).getByText('Product name is required.')).toBeInTheDocument();
    expect(within(page).getByText('Choose a market segment.')).toBeInTheDocument();
    expect(within(page).getByRole('button', { name: 'Basics' })).toHaveAttribute('aria-current', 'step');

    await fillBasics(user, 'Everyday Prepaid');
    await next(user);
    expect(within(page).getByRole('button', { name: 'Policies' })).toHaveAttribute('aria-current', 'step');
    expect(within(page).queryByText('Prerequisites Required')).not.toBeInTheDocument();
    await next(user);
    await next(user);
    await next(user);
    await next(user);

    // The scheme is always the user's choice.
    expect(within(page).getByRole('button', { name: 'Schemes' })).toHaveAttribute('aria-current', 'step');
    await next(user);
    const schemes = within(screen.getByTestId('scheme-config'));
    expect(schemes.getByText('Select a scheme.')).toBeInTheDocument();
    await user.selectOptions(schemes.getByRole('combobox', { name: 'Scheme' }), 'VISA');
    await user.selectOptions(schemes.getByLabelText(/^Named card template/), 'Visa Classic Named');
    await user.selectOptions(schemes.getByLabelText('BIN'), 'Visa Classic BIN 421234');
    await user.selectOptions(schemes.getByLabelText('BIN range'), 'Range 0000000 to 4999999');
    await next(user);

    expect(within(screen.getByTestId('product-summary')).getByText('Everyday Prepaid')).toBeInTheDocument();
    await user.click(within(page).getByRole('button', { name: 'Submit Product' }));

    // Back on the list, with the new product waiting for approval.
    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0]).getByRole('link', { name: 'Everyday Prepaid' })).toBeInTheDocument();
    expect(within(rows()[0]).getByText('Pending approval')).toBeInTheDocument();
    const [record] = await productApi.listProducts();
    expect(record.values).toMatchObject({ productName: 'Everyday Prepaid', marketSegment: 'CONSUMER', domesticSettlementCurrency: 'BDT' });
  });

  it('Save and Exit needs a name, then keeps the blank fields blank when the draft is reopened', async () => {
    const { user, productApi } = setup();
    await user.click(screen.getByRole('link', { name: 'Product Setup' }));
    const page = await screen.findByTestId('product-setup-page');

    await user.click(within(page).getByRole('button', { name: 'Save and Exit' }));
    expect(within(page).getByRole('alert')).toHaveTextContent('Enter a product name to save a draft.');
    expect(await productApi.listProducts()).toHaveLength(0);

    await user.type(screen.getByLabelText(/^Product Name/), 'Half Done');
    await user.click(within(page).getByRole('button', { name: 'Save and Exit' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0]).getByText('Draft')).toBeInTheDocument();

    await user.click(within(rows()[0]).getByRole('link', { name: 'Half Done' }));
    expect(await screen.findByLabelText(/^Product Name/)).toHaveValue('Half Done');
    const draft = screen.getByTestId('draft-product');
    expect(within(draft).getByLabelText(/^Market Segment/)).toHaveValue('');
    expect(within(draft).getByLabelText(/^Account Currency/)).toHaveValue('');
  });

  it('asks before discarding changes, and leaves straight away when there are none', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: 'Product Setup' }));
    await screen.findByTestId('product-setup-page');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Product Setup' }));
    await user.type(await screen.findByLabelText(/^Product Name/), 'Oops');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeInTheDocument();
    expect(localStorage.getItem(PRODUCTS_KEY)).toBeNull();
  });

  it('shows a rejected product read-only, with a way back to the list', async () => {
    seedDemoProducts(localStorage);
    window.location.hash = '#/products/1004';
    const { user } = setup();
    const details = await screen.findByTestId('product-details');
    expect(await within(details).findByTestId('product-status')).toHaveTextContent('Rejected');
    expect(within(details).getByRole('link', { name: /Back to Product List/ })).toHaveAttribute('href', '#/');
    await user.click(within(details).getByRole('link', { name: /Back to Product List/ }));
    expect(await screen.findByRole('heading', { name: 'Product List' })).toBeInTheDocument();
  });

  it('offers AI help on form fields: auto-fill with undo, and questions with a value to apply', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: 'Product Setup' }));
    const page = await screen.findByTestId('product-setup-page');
    await user.selectOptions(screen.getByLabelText(/^Product Type/), 'PREPAID');

    const name = screen.getByLabelText(/^Product Name/);
    await user.click(name);
    await user.click(within(page).getByRole('button', { name: 'AI help for Product Name' }));
    await user.click(screen.getByRole('menuitem', { name: /Auto-fill this field/ }));
    expect(name).toHaveValue('Consumer Prepaid Card');
    expect(name).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(name).toHaveValue('');

    const validity = screen.getByLabelText(/^Card Validity/);
    await user.click(validity);
    await user.click(within(page).getByRole('button', { name: 'AI help for Card Validity Duration (in years)' }));
    await user.click(screen.getByRole('menuitem', { name: /Ask AI about this field/ }));
    const panel = screen.getByRole('dialog', { name: 'Ask AI about Card Validity Duration (in years)' });
    expect(panel).toHaveTextContent('Current value: empty');
    await user.type(within(panel).getByRole('textbox', { name: /^Ask about/ }), 'What should I enter?{Enter}');
    const apply = await within(panel).findByRole('button', { name: 'Use this value' }, { timeout: 4000 });
    expect(within(panel).getByTestId('field-assist-answer')).toHaveTextContent('I suggest 3 years.');
    await user.click(apply);
    expect(validity).toHaveValue('3');
    expect(screen.queryByRole('dialog', { name: /Ask AI/ })).not.toBeInTheDocument();

    // Escape closes the menu and returns to the AI button.
    await user.click(validity);
    const button = within(page).getByRole('button', { name: 'AI help for Card Validity Duration (in years)' });
    await user.click(button);
    expect(screen.getByRole('menuitem', { name: /Auto-fill this field/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('does not reseed sample products once the list has been emptied', () => {
    localStorage.setItem(PRODUCTS_KEY, '[]');
    seedDemoProducts(localStorage);
    expect(localStorage.getItem(PRODUCTS_KEY)).toBe('[]');
  });
});

/** The real mock AI with tiny delays, so chat tests run quickly. */
function fastService(): AIService {
  const base = new MockAIService();
  const opts = { chunkDelayMs: 1, minThinkingMs: 10, stepDurationMs: 5, chunkSize: 20 };
  return {
    streamResponse: (r, o) => base.streamResponse(r, { ...o, ...opts }),
    generateResponse: (r, o) => base.generateResponse(r, { ...o, ...opts }),
    cancelGeneration: (id) => base.cancelGeneration(id),
  };
}

describe('AI Assistant popup', { timeout: 30000 }, () => {
  const popup = () => screen.getByRole('dialog', { name: 'AI Assistant' });
  const card = () => within(popup()).getByTestId('product-setup');

  it('opens the assistant over the Product List, does agentic work there, and closes with the X', async () => {
    const user = userEvent.setup();
    render(<App aiService={fastService()} conversationService={new LocalConversationService(localStorage)} productApi={new MockProductApi(localStorage, 5)} productPrepareDelayMs={50} />);
    expect(await screen.findByText('No products yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open AI Assistant' }));
    expect(within(popup()).getByRole('heading', { name: 'What can I help you with?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close AI Assistant' })).toHaveAttribute('aria-expanded', 'true');
    const composer = within(popup()).getByRole('textbox', { name: 'Message AI Assistant' });
    await waitFor(() => expect(composer).toHaveFocus());

    // The same agentic product creation as on the assistant page.
    await user.type(composer, 'Create a product named Popup Saver{Enter}');
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'collecting'), { timeout: 4000 });
    await user.selectOptions(within(card()).getByLabelText(/^Product type/), 'DEBIT');
    await user.selectOptions(within(card()).getByLabelText(/^Account currency/), 'BDT');
    await user.selectOptions(within(card()).getByLabelText(/^Market segment/), 'CONSUMER');
    await user.click(within(card()).getByRole('button', { name: /Continue/ }));
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'pending'), { timeout: 4000 });
    await user.click(within(card()).getByRole('button', { name: 'Save as Draft' }));
    await waitFor(() => expect(card()).toHaveAttribute('data-status', 'draft'), { timeout: 4000 });
    // The page behind stays on the Product List.
    expect(window.location.hash).toBe('');

    await user.click(screen.getByRole('button', { name: 'Close AI Assistant' }));
    expect(screen.queryByRole('dialog', { name: 'AI Assistant' })).not.toBeInTheDocument();
    // The list now shows the draft made in the chat.
    expect(await screen.findByRole('link', { name: 'Popup Saver' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open AI Assistant' })).toHaveFocus());

    // Reopening continues the same chat, and Escape closes it.
    await user.click(screen.getByRole('button', { name: 'Open AI Assistant' }));
    expect(card()).toHaveAttribute('data-status', 'draft');
    await waitFor(() => expect(within(popup()).getByRole('textbox', { name: 'Message AI Assistant' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'AI Assistant' })).not.toBeInTheDocument();
  });

  it('shows the AI Assistant button only on the Product List', async () => {
    const user = userEvent.setup();
    render(<App conversationService={new LocalConversationService(localStorage)} productApi={new MockProductApi(localStorage, 1)} />);
    expect(screen.getByRole('button', { name: 'Open AI Assistant' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Product Setup' }));
    await screen.findByTestId('product-setup-page');
    expect(screen.queryByRole('button', { name: 'Open AI Assistant' })).not.toBeInTheDocument();
  });
});
