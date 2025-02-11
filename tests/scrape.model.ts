export interface FriendshipStatus {
  following: boolean;
  incoming_request: boolean;
  is_bestie: boolean;
  is_private: boolean;
  is_restricted: boolean;
  outgoing_request: boolean;
  is_feed_favorite: boolean;
}

export interface FollowingStatuses {
  friendship_statuses: {
    [userId: string]: FriendshipStatus;
  };
}

export interface User {
  pk: string; // e.g. "66481554801"
  pk_id: string; // e.g. "66481554801"
  id: string; // e.g. "66481554801"
  username: string; // e.g. "jozhaswireart"
  full_name: string; // e.g. "Jozhas Wire Art"
  is_private: boolean; // e.g. false
  fbid_v2: string; // e.g. "17841466564030194"
  third_party_downloads_enabled: number; // e.g. 0
  strong_id__: string; // e.g. "66481554801"
  profile_pic_id: string; // e.g. "3353856056544564103_66481554801"
  profile_pic_url: string; // e.g. "https://scontent-arn2-1.cdninstagram.com/v/t51.2885-19/440120699_1623646108398510_1492426022346641251_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_ht=scontent-arn2-1.cdninstagram.com&_nc_cat=106&_nc_oc=Q6cZ2AFQ2VLnky-HArBXs6EYGeAfRLIhEl2xn5Kem5YcF34fv6rAwkMKfKhuutjHlKddrZGN7U-F0F2hDtIyQT_rLCtW&_nc_ohc=7ruMqblg7YsQ7kNvgEZcjd9&_nc_gid=6959b6f072bf4155bf4b8cbd253cb5ba&edm=APQMUHMBAAAA&ccb=7-5&oh=00_AYCLtZAymhZ3mx-lQrqeqZTpk0JY-Mqnksix5IasqLRqBw&oe=67AE862F&_nc_sid=6ff7c8"
  is_verified: boolean; // e.g. false
  has_anonymous_profile_picture: boolean; // e.g. false
  account_badges: string[]; // e.g. []
  latest_reel_media: number; // e.g. 0
}

export interface Followers {
  users: User[];
}