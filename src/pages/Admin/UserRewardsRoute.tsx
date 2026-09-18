/**
 * UserRewardsRoute — thin re-export so the lazy import in App.tsx can
 * resolve to the canonical implementation under `src/features/admin/`.
 *
 * Mirrors the pattern used by AnnualFees (the page component lives
 * alongside this shim) and AdminMedals (which keeps the file in
 * `src/features/admin/` and is re-exported by the same lazy resolver).
 */
import { UserRewards as UserRewardsImpl } from '../../features/admin/UserRewards';

export const UserRewards = (): JSX.Element => <UserRewardsImpl />;
export default UserRewards;
