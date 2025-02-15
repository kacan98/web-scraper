export interface FollowingStatuses {
  friendship_statuses: {
    [userId: IGUser["id"]]: IGFollowingStatus;
  };
}

//This is how we get it from ig. Not the same as status in DB!
export interface IGFollowingStatus {
  following: boolean;
  incoming_request: boolean;
  is_bestie: boolean;
  is_private: boolean;
  is_restricted: boolean;
  outgoing_request: boolean;
  is_feed_favorite: boolean;
}

export interface Followers {
  users: IGUser[];
}

export interface IGUser {
  pk: string;
  pk_id: string;
  id: string;
  username: string;
  full_name: string;
  is_private: true;
  fbid_v2: string;
  third_party_downloads_enabled: number;
  strong_id__: string;
  profile_pic_id: string;
  profile_pic_url: string;
  is_verified: false;
  has_anonymous_profile_picture: false;
  account_badges: any[];
  latest_reel_media: number;
}
