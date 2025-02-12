import { igUserStatusesTable, igUserTable } from "db/schema";

export type UserStatus = typeof igUserStatusesTable.$inferInsert;

export interface FollowingStatuses {
  friendship_statuses: {
    [userId: User['id']]: UserStatus;
  };
}

export type User = typeof igUserTable.$inferInsert;

export interface Followers {
  users: User[];
}
