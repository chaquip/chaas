import {useDeferredValue, useState, useRef, useMemo, useCallback} from 'react';
import {
  Box,
  Center,
  Spinner,
  SimpleGrid,
  Button,
  HStack,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast,
  useDisclosure,
} from '@chakra-ui/react';
import {ChevronDownIcon, RepeatIcon} from '@chakra-ui/icons';
import {getFunctions, httpsCallable} from 'firebase/functions';
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

export const AccountGrid = () => {
  const [searchValue, setSearchValue] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('lastTransaction');
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

  const sortedAccounts = useMemo(() => {
    if (accounts === null) return null;

    const accountsCopy = [...accounts];

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
  }, [accounts, sortBy]);

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
            <HStack spacing={3}>
              <Text fontSize={'sm'} fontWeight={'medium'} color={'gray.600'}>
                Sort by:
              </Text>
              <Menu>
                <MenuButton
                  as={Button}
                  rightIcon={<ChevronDownIcon />}
                  size={'sm'}
                  variant={'outline'}
                  bg={'white'}
                  borderColor={'gray.300'}
                  width={'200px'}
                  textAlign={'left'}
                  fontWeight={'normal'}
                >
                  {sortBy === 'lastTransaction' && 'Last Transaction'}
                  {sortBy === 'debt' && 'Debt'}
                  {sortBy === 'totalPaid' && 'Total Paid'}
                </MenuButton>
                <MenuList minWidth={'200px'}>
                  <MenuItem
                    onClick={() => {
                      setSortBy('lastTransaction');
                    }}
                  >
                    Last Transaction
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSortBy('debt');
                    }}
                  >
                    Debt
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSortBy('totalPaid');
                    }}
                  >
                    Total Paid
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
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
            {sortedAccounts.map(({id, slack: {name, pictureUrl}, activity}) => (
              <AccountCard
                key={id}
                id={id}
                name={name}
                pictureUrl={pictureUrl}
                totalPaid={activity.totalPaid}
                totalPurchased={activity.totalPurchased}
                onChargeSuccess={handleChargeSuccess}
              />
            ))}
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
