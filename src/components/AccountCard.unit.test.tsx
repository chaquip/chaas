import {describe, it, expect, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import {renderWithChakra} from '../utils/tests';
import {AccountCard} from './AccountCard';
import {AccountDrawerProps} from './AccountDrawer';

vi.mock('./AccountDrawer', () => ({
  AccountDrawer: ({isOpen, name}: AccountDrawerProps) =>
    isOpen && <div>Account of {name}</div>,
}));

const id = 'test-account-id';
const name = 'Luc Bernard';
const pictureUrl = 'https://placehold.co/150';
const totalPaid = 10;
const totalPurchased = 20;

describe('AccountCard component', () => {
  it('displays account details', () => {
    const {getByText} = renderWithChakra(
      <AccountCard
        id={id}
        name={name}
        pictureUrl={pictureUrl}
        totalPaid={totalPaid}
        totalPurchased={totalPurchased}
        isEmployee={false}
      />,
    );

    expect(getByText(name)).toBeInTheDocument();
    expect(getByText('-10€')).toBeInTheDocument();
  });

  it('opens account drawer when it is clicked', async () => {
    const user = userEvent.setup();

    const {getByTestId, getByText} = renderWithChakra(
      <AccountCard
        id={id}
        name={name}
        pictureUrl={pictureUrl}
        totalPaid={totalPaid}
        totalPurchased={totalPurchased}
        isEmployee={false}
      />,
    );

    await user.click(getByTestId(`account-card-${id}`));

    expect(getByText('Account of Luc Bernard')).toBeInTheDocument();
  });

  it('shows badge for positive balance (credit)', () => {
    const {getByText} = renderWithChakra(
      <AccountCard
        id={id}
        name={name}
        pictureUrl={pictureUrl}
        totalPaid={30}
        totalPurchased={10}
        isEmployee={false}
      />,
    );

    const badge = getByText('+20€');
    expect(badge).toBeInTheDocument();
    // Verify it's a badge element
    expect(badge.closest('.chakra-badge')).toBeInTheDocument();
  });

  it('shows badge for negative balance (debt)', () => {
    const {getByText} = renderWithChakra(
      <AccountCard
        id={id}
        name={name}
        pictureUrl={pictureUrl}
        totalPaid={10}
        totalPurchased={30}
        isEmployee={false}
      />,
    );

    const badge = getByText('-20€');
    expect(badge).toBeInTheDocument();
    // Verify it's a badge element
    expect(badge.closest('.chakra-badge')).toBeInTheDocument();
  });

  it('shows badge for zero balance', () => {
    const {getByText} = renderWithChakra(
      <AccountCard
        id={id}
        name={name}
        pictureUrl={pictureUrl}
        totalPaid={20}
        totalPurchased={20}
        isEmployee={false}
      />,
    );

    const badge = getByText('+0€');
    expect(badge).toBeInTheDocument();
    // Verify it's a badge element
    expect(badge.closest('.chakra-badge')).toBeInTheDocument();
  });

  it('formats balance with + for credit and - for debt', () => {
    const {getByText, rerender} = renderWithChakra(
      <AccountCard
        id={id}
        name={name}
        pictureUrl={pictureUrl}
        totalPaid={50.5}
        totalPurchased={25.25}
        isEmployee={false}
      />,
    );

    expect(getByText('+25.25€')).toBeInTheDocument();

    rerender(
      <AccountCard
        id={id}
        name={name}
        pictureUrl={pictureUrl}
        totalPaid={10}
        totalPurchased={35.75}
        isEmployee={false}
      />,
    );

    expect(getByText('-25.75€')).toBeInTheDocument();
  });
});
