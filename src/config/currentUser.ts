/** The signed-in user shown in the header. A host app passes the real user to `<App user={...} />`. */
export interface CurrentUser {
  name: string;
  /** Role shown beside the avatar, e.g. "Call Center Agent", "Super Admin", "Reporting Officer". */
  role: string;
  /** Profile photo URL. Falls back to initials when missing or it fails to load. */
  photoUrl?: string;
}

export const DEFAULT_USER: CurrentUser = {
  name: 'Demo User',
  role: 'Super Admin',
  photoUrl: '/avatar.svg',
};
