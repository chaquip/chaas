export type SyncResults = {
  summary: {
    created: number;
    updated: number;
    deleted: number;
    total: number;
  };
  details: {
    created: {
      id: string;
      name: string;
      email: string;
      reason: string;
    }[];
    updated: {
      id: string;
      name: string;
      changes: string[];
      before: {isEmployee?: boolean; profilePicture?: string};
      after: {isEmployee?: boolean; profilePicture?: string};
    }[];
    deleted: {
      id: string;
      name: string;
      reason: string;
    }[];
  };
  executedAt: string;
  slackWorkspace: string;
};
