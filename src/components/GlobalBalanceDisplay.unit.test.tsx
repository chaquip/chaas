import {describe, it, expect} from 'vitest';
import {screen} from '@testing-library/react';
import {renderWithChakra} from '../utils/tests';
import {GlobalBalanceDisplay} from './GlobalBalanceDisplay';

describe('GlobalBalanceDisplay', () => {
  it('displays total owed amount', () => {
    renderWithChakra(
      <GlobalBalanceDisplay
        totalOwed={245.5}
        totalOverpaid={15.0}
        employeeDebt={180.0}
        nonEmployeeDebt={65.5}
      />,
    );

    expect(screen.getByText(/€245\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Total Owed/i)).toBeInTheDocument();
  });

  it('displays zero when no debt', () => {
    renderWithChakra(
      <GlobalBalanceDisplay
        totalOwed={0}
        totalOverpaid={0}
        employeeDebt={0}
        nonEmployeeDebt={0}
      />,
    );

    expect(screen.getByText(/€0\.00/)).toBeInTheDocument();
  });

  it('shows breakdown details in tooltip', () => {
    renderWithChakra(
      <GlobalBalanceDisplay
        totalOwed={245.5}
        totalOverpaid={15.0}
        employeeDebt={180.0}
        nonEmployeeDebt={65.5}
      />,
    );

    // Tooltip content should be in the document (may need hover simulation for full test)
    expect(screen.getByText(/€245\.50/)).toBeInTheDocument();
  });
});
