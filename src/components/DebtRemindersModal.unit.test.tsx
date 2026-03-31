import {describe, it, expect, vi} from 'vitest';
import {renderWithChakra} from '../utils/tests';
import {DebtRemindersModal} from './DebtRemindersModal';
import type {DebtRemindersResults} from '../types/debtRemindersResults';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const makeResults = (
  overrides?: Partial<DebtRemindersResults>,
): DebtRemindersResults => ({
  summary: {high: 1, medium: 1, low: 0, total: 2, sent: 0, failed: 0},
  details: [
    {
      name: 'Alice',
      slackId: 'slack-1',
      debt: 7,
      tier: 'medium',
      lastPurchaseTimestamp: Date.now() - 35 * MS_PER_DAY,
      sent: false,
    },
    {
      name: 'Bob',
      slackId: 'slack-2',
      debt: 15,
      tier: 'high',
      lastPurchaseTimestamp: Date.now() - 2 * MS_PER_DAY,
      sent: false,
    },
  ],
  dryRun: true,
  executedAt: '2026-04-01T12:00:00.000Z',
  ...overrides,
});

describe('DebtRemindersModal', () => {
  it('renders nothing when results is null', () => {
    const {queryByRole} = renderWithChakra(
      <DebtRemindersModal isOpen={true} onClose={vi.fn()} results={null} />,
    );

    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays summary badges', () => {
    const results = makeResults();
    const {getByText} = renderWithChakra(
      <DebtRemindersModal isOpen={true} onClose={vi.fn()} results={results} />,
    );

    expect(getByText('1 High (>10€)')).toBeInTheDocument();
    expect(getByText('1 Medium (5-10€)')).toBeInTheDocument();
    expect(getByText('0 Low (<5€)')).toBeInTheDocument();
    expect(getByText('2 Total')).toBeInTheDocument();
  });

  it('displays details sorted by biggest debt first', () => {
    const results = makeResults();
    const {getAllByRole} = renderWithChakra(
      <DebtRemindersModal isOpen={true} onClose={vi.fn()} results={results} />,
    );

    const rows = getAllByRole('row');
    const dataRows = rows.slice(1);

    expect(dataRows[0].textContent).toContain('Bob');
    expect(dataRows[0].textContent).toContain('15.00€');
    expect(dataRows[1].textContent).toContain('Alice');
    expect(dataRows[1].textContent).toContain('7.00€');
  });

  it('shows last seen column', () => {
    const results = makeResults();
    const {getByText} = renderWithChakra(
      <DebtRemindersModal isOpen={true} onClose={vi.fn()} results={results} />,
    );

    expect(getByText('Last Seen')).toBeInTheDocument();
    expect(getByText('2 days ago')).toBeInTheDocument();
  });

  it('shows empty state when no reminders', () => {
    const results = makeResults({
      summary: {high: 0, medium: 0, low: 0, total: 0, sent: 0, failed: 0},
      details: [],
    });
    const {getByText} = renderWithChakra(
      <DebtRemindersModal isOpen={true} onClose={vi.fn()} results={results} />,
    );

    expect(getByText('No one to remind')).toBeInTheDocument();
  });
});
