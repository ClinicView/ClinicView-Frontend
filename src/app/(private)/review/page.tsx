import { ReviewView } from './review-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default function ReviewPage() {
  return (
    <RequirePermissions allOf={['review.read']}>
      <ReviewView />
    </RequirePermissions>
  );
}
