import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Badge,
  Text,
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';
import type {DebtRemindersResults} from '../types/debtRemindersResults';

type DebtRemindersModalProps = {
  isOpen: boolean;
  onClose: () => void;
  results: DebtRemindersResults | null;
};

const TIER_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'yellow',
};

export const DebtRemindersModal = ({
  isOpen,
  onClose,
  results,
}: DebtRemindersModalProps) => {
  if (!results) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={'xl'}
      scrollBehavior={'inside'}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <VStack align={'start'} spacing={1}>
            <Text>Debt Reminders — Dry Run</Text>
            <Text fontSize={'sm'} fontWeight={'normal'} color={'gray.600'}>
              {new Date(results.executedAt).toLocaleString()}
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={6} align={'stretch'}>
            <Box>
              <Text
                fontSize={'sm'}
                fontWeight={'semibold'}
                mb={3}
                color={'gray.700'}
              >
                Summary
              </Text>
              <HStack spacing={3} wrap={'wrap'}>
                <Badge colorScheme={'red'} fontSize={'md'} px={3} py={1}>
                  {results.summary.high} High (&gt;10€)
                </Badge>
                <Badge colorScheme={'orange'} fontSize={'md'} px={3} py={1}>
                  {results.summary.medium} Medium (5-10€)
                </Badge>
                <Badge colorScheme={'yellow'} fontSize={'md'} px={3} py={1}>
                  {results.summary.low} Low (&lt;5€)
                </Badge>
                <Badge colorScheme={'gray'} fontSize={'md'} px={3} py={1}>
                  {results.summary.total} Total
                </Badge>
              </HStack>
            </Box>

            {results.details.length > 0 ? (
              <Table size={'sm'}>
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Tier</Th>
                    <Th isNumeric>Debt</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {results.details.map((entry) => (
                    <Tr key={entry.slackId}>
                      <Td>{entry.name}</Td>
                      <Td>
                        <Badge colorScheme={TIER_COLORS[entry.tier]}>
                          {entry.tier}
                        </Badge>
                      </Td>
                      <Td isNumeric>{entry.debt.toFixed(2)}€</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Box textAlign={'center'} py={4}>
                <Text color={'gray.600'}>No one to remind</Text>
              </Box>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
