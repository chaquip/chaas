import {Box, Text, Tooltip, HStack} from '@chakra-ui/react';

type GlobalBalanceDisplayProps = {
  totalOwed: number;
  totalOverpaid: number;
  employeeDebt: number;
  nonEmployeeDebt: number;
};

export const GlobalBalanceDisplay = ({
  totalOwed,
  totalOverpaid,
  employeeDebt,
  nonEmployeeDebt,
}: GlobalBalanceDisplayProps) => {
  const formattedAmount = `€${totalOwed.toFixed(2)}`;
  const hasDebt = totalOwed > 0;

  const tooltipLabel = (
    <Box>
      <Text fontWeight={'bold'} mb={2}>
        Balance Breakdown
      </Text>
      <Text>Total Owed: €{totalOwed.toFixed(2)}</Text>
      <Text>Overpayments: €{totalOverpaid.toFixed(2)}</Text>
      <Text>From Employees: €{employeeDebt.toFixed(2)}</Text>
      <Text>From Non-Employees: €{nonEmployeeDebt.toFixed(2)}</Text>
    </Box>
  );

  return (
    <Tooltip label={tooltipLabel} placement={'bottom'}>
      <Box
        px={3}
        py={1.5}
        bg={hasDebt ? 'orange.50' : 'gray.50'}
        borderRadius={'md'}
        borderWidth={'1px'}
        borderColor={hasDebt ? 'orange.300' : 'gray.200'}
        cursor={'help'}
      >
        <HStack spacing={2}>
          <Text fontSize={'xs'} color={'gray.600'} fontWeight={'medium'}>
            Total Owed
          </Text>
          <Text
            fontSize={'md'}
            fontWeight={'bold'}
            color={hasDebt ? 'orange.700' : 'gray.600'}
          >
            {formattedAmount}
          </Text>
        </HStack>
      </Box>
    </Tooltip>
  );
};
