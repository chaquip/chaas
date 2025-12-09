import {memo} from 'react';
import {
  Avatar,
  Card,
  CardFooter,
  Text,
  Badge,
  useDisclosure,
  Box,
} from '@chakra-ui/react';
import {AccountDrawer} from './AccountDrawer';

type AccountCardProps = {
  id: string;
  name: string;
  pictureUrl: string;
  totalPaid: number;
  totalPurchased: number;
  isEmployee: boolean;
  onChargeSuccess?: () => void;
};

const getBalanceBadgeStyles = (balance: number) => {
  if (balance >= 0) {
    return {colorScheme: 'green'};
  }
  if (balance > -10) {
    return {colorScheme: 'orange'};
  }

  // Gradient from -10 (light red) to -100 (dark red)
  const clampedBalance = Math.max(balance, -100);
  const intensity = (clampedBalance + 10) / -90; // 0 at -10, 1 at -100

  // RGB red gradient: light red (255, 200, 200) to dark red (139, 0, 0)
  const r = Math.round(255 - intensity * 116);
  const g = Math.round(200 - intensity * 200);
  const b = Math.round(200 - intensity * 200);

  return {
    bg: `rgb(${r.toString()}, ${g.toString()}, ${b.toString()})`,
    color: intensity > 0.5 ? 'white' : 'red.900',
  };
};

export const AccountCard = memo(function AccountCard({
  id,
  name,
  pictureUrl,
  totalPaid,
  totalPurchased,
  isEmployee,
  onChargeSuccess,
}: AccountCardProps) {
  const {isOpen, onOpen, onClose} = useDisclosure();
  const debt = totalPaid - totalPurchased;

  return (
    <>
      <Card
        size={'sm'}
        cursor={'pointer'}
        onClick={onOpen}
        data-testid={`account-card-${id}`}
        borderRadius={'xl'}
        boxShadow={'md'}
        overflow={'hidden'}
        transition={'all 0.2s'}
        _hover={{
          transform: 'translateY(-4px)',
          boxShadow: 'xl',
        }}
      >
        <Box width={'100%'} aspectRatio={1} overflow={'hidden'}>
          <Avatar
            src={pictureUrl}
            name={name}
            size={'full'}
            width={'100%'}
            height={'100%'}
            borderRadius={0}
            sx={{
              '& img': {
                objectFit: 'cover',
              },
              fontSize: '4rem',
            }}
          />
        </Box>
        <CardFooter
          justifyContent={'space-between'}
          alignItems={'center'}
          py={4}
        >
          <Text fontSize={'lg'} fontWeight={'medium'} verticalAlign={'middle'}>
            {name}
          </Text>
          <Badge
            fontSize={'md'}
            fontWeight={'bold'}
            {...getBalanceBadgeStyles(debt)}
            px={2}
            py={1}
            borderRadius={'md'}
          >
            {debt >= 0 ? '+' : ''}
            {debt}€
          </Badge>
        </CardFooter>
      </Card>
      <AccountDrawer
        isOpen={isOpen}
        onClose={onClose}
        onChargeSuccess={onChargeSuccess}
        accountId={id}
        name={name}
        totalPaid={totalPaid}
        totalPurchased={totalPurchased}
        isEmployee={isEmployee}
      />
    </>
  );
});
