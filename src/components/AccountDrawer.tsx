import {useState, useCallback, useEffect, useRef} from 'react';
import {
  Box,
  Drawer,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerBody,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Heading,
  VStack,
  Text,
  SimpleGrid,
  Button,
  useToast,
  Spinner,
  Center,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightAddon,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {useFocusableElementRef, useItems} from '../hooks';
import {DrinkCard, TransactionList} from './';
import {Item, Transaction} from '../models';
import {
  chargePurchase,
  chargePurchases,
  addPayment,
  deleteTransaction,
} from '../services';
import {loadAccountTransactions} from '../store';
import {getFirestore} from 'firebase/firestore';

export type AccountDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onChargeSuccess?: () => void;
  accountId: string;
  name: string;
  totalPaid: number;
  totalPurchased: number;
};

export const AccountDrawer = ({
  isOpen,
  onClose,
  onChargeSuccess,
  accountId,
  name,
  totalPaid,
  totalPurchased,
}: AccountDrawerProps) => {
  const focusableElementRef = useFocusableElementRef();
  const balance = totalPaid - totalPurchased;
  const items = useItems();
  const toast = useToast();
  const firestore = getFirestore();

  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [isCharging, setIsCharging] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionLimit, setTransactionLimit] = useState(10);
  const [transactionToDelete, setTransactionToDelete] =
    useState<Transaction | null>(null);
  const {
    isOpen: isDeleteDialogOpen,
    onOpen: onDeleteDialogOpen,
    onClose: onDeleteDialogClose,
  } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const resetQuantities = useCallback(() => {
    setQuantities(new Map());
  }, []);

  useEffect(() => {
    if (isOpen) {
      const debt = totalPurchased - totalPaid;
      if (debt > 0) {
        setPaymentAmount(debt.toString());
      } else {
        setPaymentAmount('');
      }

      // Reset transaction limit when drawer opens
      setTransactionLimit(10);

      // Load transactions
      setIsLoadingTransactions(true);
      loadAccountTransactions(firestore, accountId, 10)
        .then((loadedTransactions) => {
          setTransactions(loadedTransactions);
        })
        .catch((error: unknown) => {
          console.error('Error loading transactions:', error);
          toast({
            title: 'Error loading transactions',
            description:
              error instanceof Error ? error.message : 'Unknown error',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        })
        .finally(() => {
          setIsLoadingTransactions(false);
        });
    }
  }, [isOpen, totalPaid, totalPurchased, firestore, accountId, toast]);

  const handleQuickCharge = useCallback(
    async (item: Item) => {
      setIsCharging(true);
      try {
        await chargePurchase(firestore, accountId, item);
        onChargeSuccess?.();
        onClose();
      } catch (error) {
        toast({
          title: 'Error charging drink',
          description: error instanceof Error ? error.message : 'Unknown error',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsCharging(false);
      }
    },
    [firestore, accountId, onChargeSuccess, onClose, toast],
  );

  const handleIncrement = useCallback((item: Item) => {
    setQuantities((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(item.id) ?? 0;
      newMap.set(item.id, current + 1);
      return newMap;
    });
  }, []);

  const handleDecrement = useCallback((item: Item) => {
    setQuantities((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(item.id) ?? 0;
      if (current > 0) {
        newMap.set(item.id, current - 1);
      }
      return newMap;
    });
  }, []);

  const handleBatchCharge = useCallback(async () => {
    if (items === null) return;

    const itemsToCharge = items
      .map((item) => ({
        item,
        quantity: quantities.get(item.id) ?? 0,
      }))
      .filter(({quantity}) => quantity > 0);

    if (itemsToCharge.length === 0) return;

    setIsCharging(true);
    try {
      await chargePurchases(firestore, accountId, itemsToCharge);
      resetQuantities();
      onChargeSuccess?.();
      onClose();
    } catch (error) {
      toast({
        title: 'Error charging drinks',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsCharging(false);
    }
  }, [
    items,
    quantities,
    firestore,
    accountId,
    resetQuantities,
    onChargeSuccess,
    onClose,
    toast,
  ]);

  const totalQuantity = Array.from(quantities.values()).reduce(
    (sum, qty) => sum + qty,
    0,
  );

  const handleAddPayment = useCallback(async () => {
    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Payment amount must be greater than 0',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsProcessingPayment(true);
    try {
      await addPayment(firestore, accountId, amount);
      setPaymentAmount('');
      onClose();
    } catch (error) {
      toast({
        title: 'Error adding payment',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  }, [paymentAmount, firestore, accountId, onClose, toast]);

  const handleSendPaymentLink = useCallback(async () => {
    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Payment amount must be greater than 0',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsSendingPaymentLink(true);
    try {
      const functions = getFunctions();
      const sendPaymentLink = httpsCallable<
        {accountId: string; amount: number},
        {success: boolean; checkoutId: string}
      >(functions, 'sendPaymentLink');

      await sendPaymentLink({accountId, amount});

      toast({
        title: 'Payment link sent!',
        description: `Payment link sent to ${name} on Slack!`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      setPaymentAmount('');
    } catch (error) {
      toast({
        title: 'Failed to send payment link',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSendingPaymentLink(false);
    }
  }, [paymentAmount, accountId, name, toast]);

  const handleInitiateDelete = useCallback(
    (transaction: Transaction) => {
      setTransactionToDelete(transaction);
      onDeleteDialogOpen();
    },
    [onDeleteDialogOpen],
  );

  const handleLoadMore = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const newLimit = transactionLimit + 10;
      const loadedTransactions = await loadAccountTransactions(
        firestore,
        accountId,
        newLimit,
      );
      setTransactions(loadedTransactions);
      setTransactionLimit(newLimit);
    } catch (error) {
      toast({
        title: 'Error loading more transactions',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [transactionLimit, firestore, accountId, toast]);

  const handleConfirmDelete = useCallback(async () => {
    if (!transactionToDelete) return;

    try {
      await deleteTransaction(firestore, transactionToDelete);

      // Refresh transactions with current limit
      const loadedTransactions = await loadAccountTransactions(
        firestore,
        accountId,
        transactionLimit,
      );
      setTransactions(loadedTransactions);

      toast({
        title: 'Transaction deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error deleting transaction',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setTransactionToDelete(null);
      onDeleteDialogClose();
    }
  }, [
    transactionToDelete,
    firestore,
    accountId,
    transactionLimit,
    toast,
    onDeleteDialogClose,
  ]);

  const paymentAmountValue = parseFloat(paymentAmount) || 0;
  const newBalance = totalPaid + paymentAmountValue - totalPurchased;

  return (
    <Drawer
      isOpen={isOpen}
      placement={'right'}
      onClose={onClose}
      size={'lg'}
      finalFocusRef={focusableElementRef}
    >
      <DrawerOverlay />
      <DrawerContent bg={'gray.50'}>
        <DrawerCloseButton />
        <DrawerHeader
          p={8}
          bg={'white'}
          borderBottom={'1px solid'}
          borderColor={'gray.200'}
        >
          <VStack align={'start'} spacing={4}>
            <Heading size={'lg'}>{name}</Heading>
            <Box display={'flex'} gap={3} flexWrap={'wrap'}>
              <Text
                fontSize={'lg'}
                fontWeight={'bold'}
                color={balance >= 0 ? 'green.700' : 'red.700'}
                bg={balance >= 0 ? 'green.100' : 'red.100'}
                px={4}
                py={2}
                borderRadius={'full'}
              >
                Balance: {balance >= 0 ? '+' : ''}
                {balance.toFixed(2)}€
              </Text>
              <Text
                fontSize={'lg'}
                fontWeight={'bold'}
                color={'blue.700'}
                bg={'blue.100'}
                px={4}
                py={2}
                borderRadius={'full'}
              >
                Total Paid: {totalPaid.toFixed(2)}€
              </Text>
            </Box>
          </VStack>
        </DrawerHeader>

        <DrawerBody>
          <Tabs defaultIndex={0} variant={'line'}>
            <TabList>
              <Tab>Charge Items</Tab>
              <Tab>Pay</Tab>
              <Tab>Transactions</Tab>
            </TabList>

            <TabPanels>
              <TabPanel p={4}>
                {isCharging || items === null ? (
                  <Center py={10}>
                    <Spinner size={'xl'} />
                  </Center>
                ) : (
                  <VStack spacing={4}>
                    <SimpleGrid columns={3} spacing={4}>
                      {items.map((item) => (
                        <DrinkCard
                          key={item.id}
                          item={item}
                          quantity={quantities.get(item.id) ?? 0}
                          onQuickCharge={handleQuickCharge}
                          onIncrement={handleIncrement}
                          onDecrement={handleDecrement}
                        />
                      ))}
                    </SimpleGrid>
                    <Button
                      colorScheme={'blue'}
                      size={'lg'}
                      width={'full'}
                      onClick={() => {
                        void handleBatchCharge();
                      }}
                      isDisabled={totalQuantity === 0}
                      transition={'all 0.2s'}
                      _hover={{
                        transform: 'translateY(-2px)',
                        boxShadow: 'lg',
                      }}
                    >
                      Charge ({totalQuantity} item
                      {totalQuantity !== 1 ? 's' : ''})
                    </Button>
                  </VStack>
                )}
              </TabPanel>
              <TabPanel p={6}>
                {isProcessingPayment ? (
                  <Center py={10}>
                    <Spinner size={'xl'} />
                  </Center>
                ) : (
                  <VStack spacing={6} align={'stretch'}>
                    {totalPurchased > totalPaid && (
                      <Box bg={'red.50'} p={4} borderRadius={'lg'}>
                        <Text
                          fontSize={'lg'}
                          fontWeight={'bold'}
                          color={'red.700'}
                        >
                          Current debt:{' '}
                          {(totalPurchased - totalPaid).toFixed(2)}€
                        </Text>
                      </Box>
                    )}

                    <FormControl>
                      <FormLabel fontSize={'lg'}>Payment amount:</FormLabel>
                      <InputGroup size={'lg'}>
                        <Input
                          type={'text'}
                          inputMode={'decimal'}
                          value={paymentAmount}
                          onChange={(e) => {
                            // Replace comma with period to normalize decimal separator
                            const normalized = e.target.value.replace(
                              /,/g,
                              '.',
                            );
                            setPaymentAmount(normalized);
                          }}
                          placeholder={'0'}
                          bg={'white'}
                          border={'1px solid'}
                          borderColor={'gray.200'}
                          _focus={{
                            borderColor: 'blue.400',
                            boxShadow:
                              '0 0 0 1px var(--chakra-colors-blue-400)',
                          }}
                        />
                        <InputRightAddon bg={'white'}>€</InputRightAddon>
                      </InputGroup>
                    </FormControl>

                    {paymentAmountValue > 0 && (
                      <Box
                        bg={newBalance >= 0 ? 'green.50' : 'red.50'}
                        p={4}
                        borderRadius={'lg'}
                      >
                        <Text
                          fontSize={'lg'}
                          fontWeight={'bold'}
                          color={newBalance >= 0 ? 'green.700' : 'red.700'}
                        >
                          New balance: {newBalance >= 0 ? '+' : ''}
                          {newBalance.toFixed(2)}€
                        </Text>
                      </Box>
                    )}

                    <Button
                      colorScheme={'green'}
                      size={'lg'}
                      width={'full'}
                      onClick={() => {
                        void handleAddPayment();
                      }}
                      isDisabled={!paymentAmount || paymentAmountValue <= 0}
                      transition={'all 0.2s'}
                      _hover={{
                        transform: 'translateY(-2px)',
                        boxShadow: 'lg',
                      }}
                    >
                      Pay
                    </Button>

                    <Button
                      colorScheme={'blue'}
                      size={'lg'}
                      width={'full'}
                      onClick={() => {
                        void handleSendPaymentLink();
                      }}
                      isDisabled={!paymentAmount || paymentAmountValue <= 0}
                      isLoading={isSendingPaymentLink}
                      loadingText={'Sending...'}
                      transition={'all 0.2s'}
                      _hover={{
                        transform: 'translateY(-2px)',
                        boxShadow: 'lg',
                      }}
                    >
                      Send Payment Link via Slack
                    </Button>
                  </VStack>
                )}
              </TabPanel>
              <TabPanel>
                <TransactionList
                  transactions={transactions}
                  isLoading={isLoadingTransactions}
                  onDelete={handleInitiateDelete}
                  onLoadMore={() => {
                    void handleLoadMore();
                  }}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </DrawerBody>
      </DrawerContent>

      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteDialogClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius={'xl'}>
            <AlertDialogHeader fontSize={'lg'} fontWeight={'bold'}>
              Delete Transaction
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this transaction? This action
              cannot be undone and will reverse the account balance changes.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                onClick={onDeleteDialogClose}
                variant={'ghost'}
              >
                Cancel
              </Button>
              <Button
                colorScheme={'red'}
                onClick={() => {
                  void handleConfirmDelete();
                }}
                ml={3}
                transition={'all 0.2s'}
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: 'lg',
                }}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Drawer>
  );
};

export default AccountDrawer;
