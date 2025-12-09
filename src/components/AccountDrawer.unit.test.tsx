import {createRef, ReactNode} from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import userEvent from '@testing-library/user-event';
import {renderWithChakra} from '../utils/tests';
import {FocusableElementRefContext} from '../contexts';
import {AccountDrawer} from './AccountDrawer';
import {Item} from '../models';

const mockUseItems = vi.fn<() => Item[] | null>(() => []);

vi.mock('../hooks', async () => {
  const actual = await vi.importActual('../hooks');
  return {
    ...actual,
    useItems: () => mockUseItems(),
  };
});

vi.mock('../store', async () => {
  const actual = await vi.importActual('../store');
  return {
    ...actual,
    loadAccountTransactions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

const renderWithProviders = (children: ReactNode) =>
  renderWithChakra(
    <FocusableElementRefContext.Provider value={createRef()}>
      {children}
    </FocusableElementRefContext.Provider>,
  );

const accountId = 'test-account-id';
const name = 'Luc Bernard';
const totalPaid = 20;
const totalPurchased = 10;

describe('AccountDrawer component', () => {
  beforeEach(() => {
    mockUseItems.mockReturnValue([]);
  });
  it('is closed', () => {
    const {queryByText} = renderWithProviders(
      <AccountDrawer
        isOpen={false}
        accountId={accountId}
        name={name}
        totalPaid={totalPaid}
        totalPurchased={totalPurchased}
        isEmployee={false}
        onClose={vi.fn()}
      />,
    );

    expect(queryByText(name)).not.toBeInTheDocument();
  });

  it('is open', () => {
    const {getByText} = renderWithProviders(
      <AccountDrawer
        isOpen={true}
        accountId={accountId}
        name={name}
        totalPaid={totalPaid}
        totalPurchased={totalPurchased}
        isEmployee={false}
        onClose={vi.fn()}
      />,
    );

    expect(getByText(name)).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    const user = userEvent.setup();

    const {getByRole} = renderWithProviders(
      <AccountDrawer
        isOpen={true}
        accountId={accountId}
        name={name}
        totalPaid={totalPaid}
        totalPurchased={totalPurchased}
        isEmployee={false}
        onClose={vi.fn()}
      />,
    );

    // Should default to "Charge Items" tab
    expect(getByRole('tab', {name: /charge items/i})).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Switch to "Pay" tab
    await user.click(getByRole('tab', {name: /pay/i}));
    expect(getByRole('tab', {name: /pay/i})).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Switch to "Transactions" tab
    await user.click(getByRole('tab', {name: /transactions/i}));
    expect(getByRole('tab', {name: /transactions/i})).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('displays balance in header', () => {
    const {getByText, rerender} = renderWithProviders(
      <AccountDrawer
        isOpen={true}
        accountId={accountId}
        name={name}
        totalPaid={30}
        totalPurchased={10}
        isEmployee={false}
        onClose={vi.fn()}
      />,
    );

    // Positive balance (credit) - text is displayed as "Balance: +20.00€"
    expect(getByText(/Balance:/i)).toBeInTheDocument();
    expect(
      getByText((_content, element) => {
        return element?.textContent === 'Balance: +20.00€';
      }),
    ).toBeInTheDocument();

    // Negative balance (debt)
    rerender(
      <FocusableElementRefContext.Provider value={createRef()}>
        <AccountDrawer
          isOpen={true}
          accountId={accountId}
          name={name}
          totalPaid={10}
          totalPurchased={30}
          isEmployee={false}
          onClose={vi.fn()}
        />
      </FocusableElementRefContext.Provider>,
    );

    expect(
      getByText((_content, element) => {
        return element?.textContent === 'Balance: -20.00€';
      }),
    ).toBeInTheDocument();
  });

  it('shows loading spinner when items are loading', () => {
    mockUseItems.mockReturnValueOnce(null);

    const {getByText} = renderWithProviders(
      <AccountDrawer
        isOpen={true}
        accountId={accountId}
        name={name}
        totalPaid={totalPaid}
        totalPurchased={totalPurchased}
        isEmployee={false}
        onClose={vi.fn()}
      />,
    );

    // Should show a loading spinner in the Charge Items tab
    expect(getByText('Loading...')).toBeInTheDocument();
  });
});
