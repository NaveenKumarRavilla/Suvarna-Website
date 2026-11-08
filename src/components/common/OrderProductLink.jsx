import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { getOrderProductPath } from '../../utils/orderProduct';

export default function OrderProductLink({ item, children, ...props }) {
  const { products } = useAdmin();
  const path = getOrderProductPath(item, products);
  if (path) return <Link {...props} to={path}>{children}</Link>;
  const snapshotProps = { ...props };
  delete snapshotProps['aria-label'];
  return <span {...snapshotProps} title="Historical order details; matching catalogue product is unavailable.">{children}</span>;
}
