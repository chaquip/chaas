import {beforeEach, describe, expect, it, vi} from 'vitest';
import {executeUpdateUsers} from './updateUsersLogic';
import type {UpdateUsersOptions, Account} from './updateUsersLogic';

// Create mock functions
const mockUsersList = vi.fn();

// Mock the Slack WebClient
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    users: {
      list: mockUsersList,
    },
  })),
}));

// Mock Firestore
const createMockFirestore = () => {
  const batchOps: Array<{
    type: 'set' | 'update' | 'delete';
    ref: {id: string};
    data?: unknown;
  }> = [];

  return {
    collection: vi.fn().mockReturnValue({
      get: vi.fn(),
      doc: vi.fn((id?: string) => ({
        id: id || 'generated-id-123',
      })),
    }),
    batch: vi.fn().mockReturnValue({
      set: vi.fn((ref, data) => {
        batchOps.push({type: 'set', ref, data});
      }),
      update: vi.fn((ref, data) => {
        batchOps.push({type: 'update', ref, data});
      }),
      delete: vi.fn((ref) => {
        batchOps.push({type: 'delete', ref});
      }),
      commit: vi.fn().mockResolvedValue(undefined),
    }),
    _batchOps: batchOps,
  };
};

describe('updateUsersLogic', () => {
  let mockFirestore: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestore = createMockFirestore() as any;
  });

  describe('Employee Detection', () => {
    it('should create accounts for new Akeneo employees', async () => {
      // Mock Slack API response with Akeneo employee
      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'john.doe@akeneo.com',
              image_192: 'https://example.com/john.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      // Mock empty Firestore (no existing accounts)
      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.created).toBe(1);
      expect(results.details.created).toHaveLength(1);
      expect(results.details.created[0].email).toBe('john.doe@akeneo.com');
      expect(results.details.created[0].reason).toBe('New Slack member');
    });

    it('should create accounts for new GetAkeneo employees', async () => {
      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U456',
            name: 'jane.smith',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'jane.smith@getakeneo.com',
              image_192: 'https://example.com/jane.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.created).toBe(1);
      expect(results.details.created[0].email).toBe('jane.smith@getakeneo.com');
    });

    it('should NOT create accounts for non-Akeneo employees', async () => {
      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U789',
            name: 'external.user',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'external@example.com',
              image_192: 'https://example.com/external.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.created).toBe(0);
      expect(results.details.created).toHaveLength(0);
    });

    it('should NOT create accounts for deleted Slack users', async () => {
      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U999',
            name: 'deleted.user',
            is_bot: false,
            deleted: true,
            profile: {
              email: 'deleted@akeneo.com',
              image_192: 'https://example.com/deleted.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.created).toBe(0);
    });
  });

  describe('Account Updates', () => {
    it('should update isEmployee when user leaves Akeneo', async () => {
      const existingAccount: Account = {
        id: 'account-1',
        slack: {
          id: 'U123',
          name: 'John Doe',
          username: 'john.doe',
          pictureUrl: 'https://example.com/old.jpg',
        },
        activity: {
          totalPurchased: 100,
          totalPaid: 50,
          lastPurchaseTimestamp: 1234567890,
          lastPaymentTimestamp: 1234567890,
        },
        isEmployee: true,
      };

      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'john.doe@external.com', // Changed email
              image_192: 'https://example.com/old.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [
          {
            data: () => existingAccount,
          },
        ],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.updated).toBe(1);
      expect(results.details.updated).toHaveLength(1);
      expect(results.details.updated[0].changes).toContain('isEmployee');
      expect(results.details.updated[0].before.isEmployee).toBe(true);
      expect(results.details.updated[0].after.isEmployee).toBe(false);
    });

    it('should update profile picture when changed in Slack', async () => {
      const existingAccount: Account = {
        id: 'account-1',
        slack: {
          id: 'U123',
          name: 'John Doe',
          username: 'john.doe',
          pictureUrl: 'https://example.com/old.jpg',
        },
        activity: {
          totalPurchased: 100,
          totalPaid: 50,
          lastPurchaseTimestamp: 1234567890,
          lastPaymentTimestamp: 1234567890,
        },
        isEmployee: true,
      };

      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'john.doe@akeneo.com',
              image_192: 'https://example.com/new.jpg', // Changed picture
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [
          {
            data: () => existingAccount,
          },
        ],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.updated).toBe(1);
      expect(results.details.updated[0].changes).toContain('profile_picture');
      expect(results.details.updated[0].before.profilePicture).toBe(
        'https://example.com/old.jpg',
      );
      expect(results.details.updated[0].after.profilePicture).toBe(
        'https://example.com/new.jpg',
      );
    });

    it('should update both isEmployee and picture when both change', async () => {
      const existingAccount: Account = {
        id: 'account-1',
        slack: {
          id: 'U123',
          name: 'John Doe',
          username: 'john.doe',
          pictureUrl: 'https://example.com/old.jpg',
        },
        activity: {
          totalPurchased: 100,
          totalPaid: 50,
          lastPurchaseTimestamp: 1234567890,
          lastPaymentTimestamp: 1234567890,
        },
        isEmployee: false,
      };

      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'john.doe@akeneo.com', // Now employee
              image_192: 'https://example.com/new.jpg', // New picture
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [
          {
            data: () => existingAccount,
          },
        ],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.updated).toBe(1);
      expect(results.details.updated[0].changes).toContain('isEmployee');
      expect(results.details.updated[0].changes).toContain('profile_picture');
    });

    it('should NOT update when nothing changes', async () => {
      const existingAccount: Account = {
        id: 'account-1',
        slack: {
          id: 'U123',
          name: 'John Doe',
          username: 'john.doe',
          pictureUrl: 'https://example.com/same.jpg',
        },
        activity: {
          totalPurchased: 100,
          totalPaid: 50,
          lastPurchaseTimestamp: 1234567890,
          lastPaymentTimestamp: 1234567890,
        },
        isEmployee: true,
      };

      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'john.doe@akeneo.com',
              image_192: 'https://example.com/same.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [
          {
            data: () => existingAccount,
          },
        ],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.updated).toBe(0);
      expect(results.summary.total).toBe(0);
    });
  });

  describe('Account Deletion', () => {
    it('should delete accounts with no purchases when user leaves Slack', async () => {
      const existingAccount: Account = {
        id: 'account-1',
        slack: {
          id: 'U123',
          name: 'John Doe',
          username: 'john.doe',
          pictureUrl: 'https://example.com/john.jpg',
        },
        activity: {
          totalPurchased: 0, // No purchases
          totalPaid: 0,
          lastPurchaseTimestamp: 0,
          lastPaymentTimestamp: 0,
        },
        isEmployee: true,
      };

      // User not in Slack anymore
      mockUsersList.mockResolvedValueOnce({
        members: [],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [
          {
            data: () => existingAccount,
          },
        ],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.deleted).toBe(1);
      expect(results.details.deleted).toHaveLength(1);
      expect(results.details.deleted[0].reason).toBe(
        'Not in Slack workspace, no purchases',
      );
    });

    it('should NOT delete accounts with purchase history when user leaves Slack', async () => {
      const existingAccount: Account = {
        id: 'account-1',
        slack: {
          id: 'U123',
          name: 'John Doe',
          username: 'john.doe',
          pictureUrl: 'https://example.com/john.jpg',
        },
        activity: {
          totalPurchased: 100, // Has purchases
          totalPaid: 50,
          lastPurchaseTimestamp: 1234567890,
          lastPaymentTimestamp: 1234567890,
        },
        isEmployee: true,
      };

      // User not in Slack anymore
      mockUsersList.mockResolvedValueOnce({
        members: [],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [
          {
            data: () => existingAccount,
          },
        ],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.deleted).toBe(0);
      expect(results.details.deleted).toHaveLength(0);
    });

    it('should delete accounts for deleted Slack users with no purchases', async () => {
      const existingAccount: Account = {
        id: 'account-1',
        slack: {
          id: 'U123',
          name: 'John Doe',
          username: 'john.doe',
          pictureUrl: 'https://example.com/john.jpg',
        },
        activity: {
          totalPurchased: 0,
          totalPaid: 0,
          lastPurchaseTimestamp: 0,
          lastPaymentTimestamp: 0,
        },
        isEmployee: true,
      };

      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: true, // Deleted in Slack
            profile: {
              email: 'john.doe@akeneo.com',
              image_192: 'https://example.com/john.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [
          {
            data: () => existingAccount,
          },
        ],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.deleted).toBe(1);
    });
  });

  describe('Bot Filtering', () => {
    it('should skip bot users', async () => {
      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'UBOT123',
            name: 'bot.user',
            is_bot: true, // This is a bot
            deleted: false,
            profile: {
              email: 'bot@akeneo.com',
              image_192: 'https://example.com/bot.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.created).toBe(0);
      expect(results.summary.total).toBe(0);
    });
  });

  describe('Pagination Support', () => {
    it('should handle paginated Slack API responses', async () => {
      // First page
      mockUsersList
        .mockResolvedValueOnce({
          members: [
            {
              id: 'U123',
              name: 'user1',
              is_bot: false,
              deleted: false,
              profile: {
                email: 'user1@akeneo.com',
                image_192: 'https://example.com/user1.jpg',
              },
            },
          ],
          response_metadata: {next_cursor: 'cursor-page-2'},
        })
        // Second page
        .mockResolvedValueOnce({
          members: [
            {
              id: 'U456',
              name: 'user2',
              is_bot: false,
              deleted: false,
              profile: {
                email: 'user2@akeneo.com',
                image_192: 'https://example.com/user2.jpg',
              },
            },
          ],
          response_metadata: {next_cursor: ''},
        });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      expect(results.summary.created).toBe(2);
      expect(mockUsersList).toHaveBeenCalledTimes(2);
    });
  });

  describe('Dry Run Mode', () => {
    it('should not apply changes in dry run mode', async () => {
      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'john.doe@akeneo.com',
              image_192: 'https://example.com/john.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: true, // Dry run
      };

      const results = await executeUpdateUsers(options);

      // Should report what would be done
      expect(results.summary.created).toBe(1);

      // But should not call batch operations
      expect(mockFirestore.batch).not.toHaveBeenCalled();
    });
  });

  describe('Results Structure', () => {
    it('should return properly formatted results', async () => {
      mockUsersList.mockResolvedValueOnce({
        members: [
          {
            id: 'U123',
            name: 'john.doe',
            is_bot: false,
            deleted: false,
            profile: {
              email: 'john.doe@akeneo.com',
              image_192: 'https://example.com/john.jpg',
            },
          },
        ],
        response_metadata: {next_cursor: ''},
      });

      mockFirestore.collection().get.mockResolvedValueOnce({
        docs: [],
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      const results = await executeUpdateUsers(options);

      // Check structure
      expect(results).toHaveProperty('summary');
      expect(results).toHaveProperty('details');
      expect(results).toHaveProperty('executedAt');
      expect(results).toHaveProperty('slackWorkspace');

      expect(results.summary).toHaveProperty('created');
      expect(results.summary).toHaveProperty('updated');
      expect(results.summary).toHaveProperty('deleted');
      expect(results.summary).toHaveProperty('total');

      expect(results.details).toHaveProperty('created');
      expect(results.details).toHaveProperty('updated');
      expect(results.details).toHaveProperty('deleted');

      expect(results.slackWorkspace).toBe('Akeneo');
      expect(results.summary.total).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when Slack API fails', async () => {
      mockUsersList.mockResolvedValueOnce({
        members: undefined, // API failure
        response_metadata: {next_cursor: ''},
      });

      const options: UpdateUsersOptions = {
        slackBotToken: 'test-token',
        firestore: mockFirestore as any,
        dryRun: false,
      };

      await expect(executeUpdateUsers(options)).rejects.toThrow(
        'Failed to fetch Slack users',
      );
    });
  });
});
