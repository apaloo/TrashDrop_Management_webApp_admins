import { useAuth } from '../context/AuthContext';
import { can } from './permissions';

/** `const canSeeStats = usePermission('dashboard.stats')` for the signed-in account's role */
export const usePermission = (capability) => {
  const { role } = useAuth();
  return can(capability, role);
};

/** `const { can, role } = useCan()` when a component asks about several capabilities */
export const useCan = () => {
  const { role } = useAuth();
  return { role, can: (capability) => can(capability, role) };
};
