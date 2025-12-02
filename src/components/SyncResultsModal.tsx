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
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  List,
  ListItem,
  Avatar,
} from '@chakra-ui/react';
import type {SyncResults} from '../types/syncResults';

type SyncResultsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  results: SyncResults | null;
};

export const SyncResultsModal = ({
  isOpen,
  onClose,
  results,
}: SyncResultsModalProps) => {
  if (!results) return null;

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

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
            <Text>User Sync Results</Text>
            <Text fontSize={'sm'} fontWeight={'normal'} color={'gray.600'}>
              {formatTimestamp(results.executedAt)}
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={6} align={'stretch'}>
            {/* Summary Section */}
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
                <Badge colorScheme={'green'} fontSize={'md'} px={3} py={1}>
                  {results.summary.created} Created
                </Badge>
                <Badge colorScheme={'blue'} fontSize={'md'} px={3} py={1}>
                  {results.summary.updated} Updated
                </Badge>
                <Badge colorScheme={'red'} fontSize={'md'} px={3} py={1}>
                  {results.summary.deleted} Deleted
                </Badge>
                <Badge colorScheme={'gray'} fontSize={'md'} px={3} py={1}>
                  {results.summary.total} Total Changes
                </Badge>
              </HStack>
            </Box>

            {/* Detailed Lists */}
            {results.summary.total > 0 && (
              <Accordion allowMultiple defaultIndex={[0, 1, 2]}>
                {/* Created Users */}
                {results.details.created.length > 0 && (
                  <AccordionItem>
                    <AccordionButton>
                      <Box flex={'1'} textAlign={'left'}>
                        <HStack>
                          <Text fontWeight={'semibold'}>Created Users</Text>
                          <Badge colorScheme={'green'}>
                            {results.details.created.length}
                          </Badge>
                        </HStack>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4}>
                      <List spacing={3}>
                        {results.details.created.map((user) => (
                          <ListItem key={user.id}>
                            <HStack spacing={3}>
                              <Avatar size={'sm'} name={user.name} />
                              <Box>
                                <Text fontWeight={'medium'}>{user.name}</Text>
                                <Text fontSize={'sm'} color={'gray.600'}>
                                  {user.email}
                                </Text>
                                <Text fontSize={'xs'} color={'gray.500'}>
                                  {user.reason}
                                </Text>
                              </Box>
                            </HStack>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionPanel>
                  </AccordionItem>
                )}

                {/* Updated Users */}
                {results.details.updated.length > 0 && (
                  <AccordionItem>
                    <AccordionButton>
                      <Box flex={'1'} textAlign={'left'}>
                        <HStack>
                          <Text fontWeight={'semibold'}>Updated Users</Text>
                          <Badge colorScheme={'blue'}>
                            {results.details.updated.length}
                          </Badge>
                        </HStack>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4}>
                      <List spacing={3}>
                        {results.details.updated.map((user) => (
                          <ListItem key={user.id}>
                            <HStack spacing={3} align={'start'}>
                              <Avatar size={'sm'} name={user.name} />
                              <Box>
                                <Text fontWeight={'medium'}>{user.name}</Text>
                                <VStack align={'start'} spacing={1} mt={1}>
                                  {user.changes.map((change) => (
                                    <Text
                                      key={change}
                                      fontSize={'sm'}
                                      color={'gray.600'}
                                    >
                                      •{' '}
                                      {change === 'isEmployee'
                                        ? 'Employee status updated'
                                        : change === 'profile_picture'
                                          ? 'Profile picture updated'
                                          : change}
                                    </Text>
                                  ))}
                                </VStack>
                              </Box>
                            </HStack>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionPanel>
                  </AccordionItem>
                )}

                {/* Deleted Users */}
                {results.details.deleted.length > 0 && (
                  <AccordionItem>
                    <AccordionButton>
                      <Box flex={'1'} textAlign={'left'}>
                        <HStack>
                          <Text fontWeight={'semibold'}>Deleted Users</Text>
                          <Badge colorScheme={'red'}>
                            {results.details.deleted.length}
                          </Badge>
                        </HStack>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4}>
                      <List spacing={3}>
                        {results.details.deleted.map((user) => (
                          <ListItem key={user.id}>
                            <HStack spacing={3}>
                              <Avatar size={'sm'} name={user.name} />
                              <Box>
                                <Text fontWeight={'medium'}>{user.name}</Text>
                                <Text fontSize={'sm'} color={'gray.600'}>
                                  {user.reason}
                                </Text>
                              </Box>
                            </HStack>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionPanel>
                  </AccordionItem>
                )}
              </Accordion>
            )}

            {results.summary.total === 0 && (
              <Box textAlign={'center'} py={4}>
                <Text color={'gray.600'}>No changes were made</Text>
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
