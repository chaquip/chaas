import {useDeferredValue, useState, useRef, useMemo, useCallback} from 'react';
import {
  Box,
  Center,
  Spinner,
  SimpleGrid,
  Button,
  ButtonGroup,
  HStack,
  Text,
  useToast,
  useDisclosure,
} from '@chakra-ui/react';
import {RepeatIcon} from '@chakra-ui/icons';
import {getFunctions, httpsCallable} from 'firebase/functions';
import type {Account} from '../models';
import {
  AccountCard,
  AccountSearchInput,
  HelpModal,
  SyncResultsModal,
  GlobalBalanceDisplay,
} from '../components';
import {useAccounts, useAuth} from '../hooks';
import {FocusableElement} from '../models';
import {FocusableElementRefContext} from '../contexts';
import type {SyncResults} from '../types/syncResults';

type SortOption = 'lastTransaction' | 'debt' | 'totalPaid';
type EmployeeFilter = 'all' | 'employee' | 'nonEmployee';

export const AccountGrid = () => {
  const [searchValue, setSearchValue] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('lastTransaction');
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('all');
  const deferredSearchValue = useDeferredValue(searchValue);
  const accounts = useAccounts(deferredSearchValue);
  const focusableElementRef = useRef<FocusableElement>(null);
  const {logOut} = useAuth();
  const toast = useToast();
  const {isOpen, onOpen, onClose} = useDisclosure();
  const [isUpdating, setIsUpdating] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);

  const handleChargeSuccess = useCallback(() => {
    setSearchValue('');
  }, []);

  const handleSyncUsers = useCallback(async () => {
    setIsUpdating(true);
    setSyncResults(null);

    try {
      const functions = getFunctions();
      const updateUsers = httpsCallable<Record<string, never>, SyncResults>(
        functions,
        'updateUsers',
      );
      const response = await updateUsers({});
      setSyncResults(response.data);
      onOpen();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sync users';
      toast({
        title: 'Sync Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [toast, onOpen]);

  const filteredAccounts = useMemo(() => {
    if (accounts === null) return null;

    return accounts.filter((account: Account) => {
      if (employeeFilter === 'all') return true;
      if (employeeFilter === 'employee') return account.isEmployee;
      return !account.isEmployee;
    });
  }, [accounts, employeeFilter]);

  const sortedAccounts = useMemo(() => {
    if (filteredAccounts === null) return null;

    const accountsCopy = [...filteredAccounts];

    switch (sortBy) {
      case 'lastTransaction': {
        return accountsCopy.sort((a, b) => {
          return (
            b.activity.lastPurchaseTimestamp - a.activity.lastPurchaseTimestamp
          ); // Most recent first
        });
      }
      case 'debt': {
        return accountsCopy.sort((a, b) => {
          const aDebt = a.activity.totalPaid - a.activity.totalPurchased;
          const bDebt = b.activity.totalPaid - b.activity.totalPurchased;
          return aDebt - bDebt; // Most debt (negative) first
        });
      }
      case 'totalPaid': {
        return accountsCopy.sort(
          (a, b) => b.activity.totalPaid - a.activity.totalPaid,
        ); // Highest first
      }
      default:
        return accountsCopy;
    }
  }, [filteredAccounts, sortBy]);

  const balanceMetrics = useMemo(() => {
    if (!sortedAccounts) return null;

    let totalOwed = 0;
    let totalOverpaid = 0;
    let employeeDebt = 0;
    let nonEmployeeDebt = 0;

    sortedAccounts.forEach((account) => {
      const balance =
        account.activity.totalPurchased - account.activity.totalPaid;

      if (balance > 0) {
        totalOwed += balance;
        if (account.isEmployee) {
          employeeDebt += balance;
        } else {
          nonEmployeeDebt += balance;
        }
      } else if (balance < 0) {
        totalOverpaid += Math.abs(balance);
      }
    });

    return {totalOwed, totalOverpaid, employeeDebt, nonEmployeeDebt};
  }, [sortedAccounts]);

  if (sortedAccounts === null) {
    return (
      <Center h={'100vh'}>
        <Spinner size={'xl'} />
      </Center>
    );
  }

  return (
    <FocusableElementRefContext.Provider value={focusableElementRef}>
      <Box minH={'100vh'} bg={'gray.50'}>
        <Box
          as={'header'}
          bg={'white'}
          borderBottom={'1px solid'}
          borderColor={'gray.200'}
          boxShadow={'sm'}
          px={8}
          py={4}
          position={'sticky'}
          top={0}
          zIndex={10}
        >
          <HStack spacing={5} justify={'space-between'}>
            <AccountSearchInput
              value={searchValue}
              onChange={(newValue) => {
                setSearchValue(newValue);
              }}
              ref={focusableElementRef}
            />
            <Button onClick={() => void logOut()} variant={'ghost'} size={'md'}>
              Log out
            </Button>
          </HStack>
        </Box>
        <Box
          bg={'white'}
          borderBottom={'1px solid'}
          borderColor={'gray.200'}
          px={8}
          py={3}
        >
          <HStack spacing={3} justify={'space-between'} position={'relative'}>
            <Box>
              <HStack spacing={2} mb={2}>
                <Text
                  fontSize={'xs'}
                  fontWeight={'medium'}
                  color={'gray.600'}
                  width={'50px'}
                >
                  Filter:
                </Text>
                <ButtonGroup size={'xs'} isAttached variant={'outline'}>
                  <Button
                    onClick={() => {
                      setEmployeeFilter('all');
                    }}
                    bg={employeeFilter === 'all' ? 'blue.500' : 'white'}
                    color={employeeFilter === 'all' ? 'white' : 'gray.700'}
                    borderColor={'gray.300'}
                    _hover={{
                      bg: employeeFilter === 'all' ? 'blue.600' : 'gray.100',
                    }}
                  >
                    All
                  </Button>
                  <Button
                    onClick={() => {
                      setEmployeeFilter('employee');
                    }}
                    bg={employeeFilter === 'employee' ? 'blue.500' : 'white'}
                    color={employeeFilter === 'employee' ? 'white' : 'gray.700'}
                    borderColor={'gray.300'}
                    _hover={{
                      bg:
                        employeeFilter === 'employee' ? 'blue.600' : 'gray.100',
                    }}
                  >
                    Employee
                  </Button>
                  <Button
                    onClick={() => {
                      setEmployeeFilter('nonEmployee');
                    }}
                    bg={employeeFilter === 'nonEmployee' ? 'blue.500' : 'white'}
                    color={
                      employeeFilter === 'nonEmployee' ? 'white' : 'gray.700'
                    }
                    borderColor={'gray.300'}
                    _hover={{
                      bg:
                        employeeFilter === 'nonEmployee'
                          ? 'blue.600'
                          : 'gray.100',
                    }}
                  >
                    Non-Employee
                  </Button>
                </ButtonGroup>
              </HStack>
              <HStack spacing={2}>
                <Text
                  fontSize={'xs'}
                  fontWeight={'medium'}
                  color={'gray.600'}
                  width={'50px'}
                >
                  Sort by:
                </Text>
                <ButtonGroup size={'xs'} isAttached variant={'outline'}>
                  <Button
                    onClick={() => {
                      setSortBy('lastTransaction');
                    }}
                    bg={sortBy === 'lastTransaction' ? 'blue.500' : 'white'}
                    color={sortBy === 'lastTransaction' ? 'white' : 'gray.700'}
                    borderColor={'gray.300'}
                    _hover={{
                      bg:
                        sortBy === 'lastTransaction' ? 'blue.600' : 'gray.100',
                    }}
                  >
                    Last
                  </Button>
                  <Button
                    onClick={() => {
                      setSortBy('debt');
                    }}
                    bg={sortBy === 'debt' ? 'blue.500' : 'white'}
                    color={sortBy === 'debt' ? 'white' : 'gray.700'}
                    borderColor={'gray.300'}
                    _hover={{
                      bg: sortBy === 'debt' ? 'blue.600' : 'gray.100',
                    }}
                  >
                    Debt
                  </Button>
                  <Button
                    onClick={() => {
                      setSortBy('totalPaid');
                    }}
                    bg={sortBy === 'totalPaid' ? 'blue.500' : 'white'}
                    color={sortBy === 'totalPaid' ? 'white' : 'gray.700'}
                    borderColor={'gray.300'}
                    _hover={{
                      bg: sortBy === 'totalPaid' ? 'blue.600' : 'gray.100',
                    }}
                  >
                    Total Paid
                  </Button>
                </ButtonGroup>
              </HStack>
            </Box>
            <Box
              position={'absolute'}
              left={'50%'}
              transform={'translateX(-50%)'}
            >
              {balanceMetrics && (
                <GlobalBalanceDisplay
                  totalOwed={balanceMetrics.totalOwed}
                  totalOverpaid={balanceMetrics.totalOverpaid}
                  employeeDebt={balanceMetrics.employeeDebt}
                  nonEmployeeDebt={balanceMetrics.nonEmployeeDebt}
                />
              )}
            </Box>
            <Button
              onClick={() => void handleSyncUsers()}
              leftIcon={<RepeatIcon />}
              colorScheme={'blue'}
              variant={'outline'}
              size={'sm'}
              isLoading={isUpdating}
              loadingText={'Syncing...'}
            >
              Sync Users
            </Button>
          </HStack>
        </Box>
        <Box px={8} py={8}>
          <SimpleGrid
            columns={{base: 2, md: 3, lg: 4, xl: 5, '2xl': 6}}
            spacing={8}
          >
            {sortedAccounts.map(
              ({id, slack: {name, pictureUrl}, activity, isEmployee}) => (
                <AccountCard
                  key={id}
                  id={id}
                  name={name}
                  pictureUrl={pictureUrl}
                  totalPaid={activity.totalPaid}
                  totalPurchased={activity.totalPurchased}
                  isEmployee={isEmployee}
                  onChargeSuccess={handleChargeSuccess}
                />
              ),
            )}
          </SimpleGrid>
        </Box>
      </Box>
      <HelpModal />
      <SyncResultsModal
        isOpen={isOpen}
        onClose={onClose}
        results={syncResults}
      />
    </FocusableElementRefContext.Provider>
  );
};
