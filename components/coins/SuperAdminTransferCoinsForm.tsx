import { useState, useEffect, useContext } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useSession } from 'next-auth/react';
import { TransactionReason, UserRole } from '@/prisma/enums';
import { toast } from 'react-hot-toast';
import { SessionUpdateContext } from '@/app/dashboard/layout';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  coins: number;
}

interface SuperAdminTransferCoinsFormProps {
  onSuccess?: () => void;
  currentBalance: number;
}

// Create validation schema
const transferSchema = Yup.object().shape({
  toUserId: Yup.string()
    .required('Please select an admin'),
  amount: Yup.number()
    .required('Amount is required')
    .positive('Amount must be positive')
    .integer('Amount must be a whole number'),
  notes: Yup.string()
    .max(200, 'Notes cannot be longer than 200 characters')
});

export default function SuperAdminTransferCoinsForm({ onSuccess, currentBalance }: SuperAdminTransferCoinsFormProps) {
  const { data: session, update: updateSessionData } = useSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { refreshUserSession } = useContext(SessionUpdateContext);

  // Function to fetch admin users
  const fetchAdminUsers = async () => {
    try {
      if (session?.user?.role === UserRole.SUPERADMIN) {
        const response = await fetch('/api/admins', {
          cache: 'no-store', // Ensure we don't get cached data
          headers: {
            'pragma': 'no-cache',
            'cache-control': 'no-cache',
            'x-refresh-timestamp': Date.now().toString()
          }
        });
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.admins) {
          setAdmins(data.admins);
        }
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
      setError('Failed to load admin users');
    }
  };

  // Fetch admin users that can receive coins (only for superadmin users)
  useEffect(() => {
    let isMounted = true;
    
    const fetchAdmins = async (retryCount = 0) => {
      if (retryCount > 3) {
        if (isMounted) setError('Failed to load admin users after multiple attempts');
        return;
      }
      
      try {
        if (session?.user?.role === UserRole.SUPERADMIN) {
          // SuperAdmin users can allocate coins to any admin
          const response = await fetch('/api/admins');
          
          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.admins && isMounted) {
            // Filter out admins
            setAdmins(data.admins);
          }
        } else {
          // Other roles can't use this form
          setAdmins([]);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching admins:', err);
          setError('Failed to load admin users');
        }
      }
    };

    if (session?.user?.role === UserRole.SUPERADMIN) {
      // Wait a moment after component mounts to avoid race conditions
      const timerId = setTimeout(() => fetchAdmins(), 500);
      return () => {
        isMounted = false;
        clearTimeout(timerId);
      };
    } else {
      // If not superadmin, show empty list
      setAdmins([]);
    }
    
    return () => {
      isMounted = false;
    };
  }, [session]);

  const handleSubmit = async (values: any, { resetForm, setSubmitting }: any) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/coins/allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toUserId: values.toUserId,
          amount: Number(values.amount),
          reasonText: values.notes || 'SuperAdmin allocation to Admin',
        }),
      });

      // Check if response is valid before trying to parse it as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Not JSON response, could be HTML error page
        throw new Error(`Server returned ${response.status} with non-JSON response. You may need to refresh the page.`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to allocate coins');
      }

      // Store the verified coin balance temporarily in localStorage
      // This ensures it's immediately available in other parts of the UI
      if (data.verified && data.verified.sender && data.verified.sender.coins !== undefined) {
        try {
          localStorage.setItem('lastCoinBalance', data.verified.sender.coins.toString());
          localStorage.setItem('coinBalanceUpdatedAt', Date.now().toString());
        } catch (err) {
          console.error("Error saving balance to localStorage:", err);
        }
      }

      toast.success('Coins allocated successfully!');
      resetForm();
      
      // Important: Wait for async operations to complete
      // Update the session to reflect new coin balance - wait for it to complete
      await refreshUserSession();
      
      // Force a second refresh after a small delay to ensure changes are picked up
      setTimeout(async () => {
        await refreshUserSession();
      }, 500);
      
      // Refresh admin users list to update their coin balances
      await fetchAdminUsers();
      
      // Call parent component's success handler to trigger balance refresh
      if (onSuccess) {
        try {
          await onSuccess();
        } catch (err) {
          console.error("Error in onSuccess callback:", err);
        }
      }
    } catch (err: any) {
      console.error('Error allocating coins:', err);
      setError(err.message || 'Failed to allocate coins');
      toast.error(err.message || 'Failed to allocate coins');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  // If not a superadmin, don't show the form
  if (session?.user?.role !== UserRole.SUPERADMIN) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">Allocate Coins</h3>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Only SuperAdmin users can allocate coins to Admins.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Allocate Coins to Admins</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <Formik
        initialValues={{
          toUserId: '',
          amount: '',
          notes: '',
        }}
        validationSchema={transferSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting, values, errors, touched }) => (
          <Form className="space-y-4">
            <div>
              <label htmlFor="toUserId" className="block text-sm font-medium text-gray-700 mb-1">
                Admin User
              </label>
              <Field
                as="select"
                id="toUserId"
                name="toUserId"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Select an admin</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name} ({admin.email}) - {admin.coins} coins
                  </option>
                ))}
              </Field>
              <ErrorMessage name="toUserId" component="div" className="text-red-500 text-sm mt-1" />
            </div>
            
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount (max: {currentBalance})
              </label>
              <Field
                type="number"
                id="amount"
                name="amount"
                min="1"
                max={currentBalance}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              />
              <ErrorMessage name="amount" component="div" className="text-red-500 text-sm mt-1" />
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <Field
                as="textarea"
                id="notes"
                name="notes"
                rows={3}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              />
              <ErrorMessage name="notes" component="div" className="text-red-500 text-sm mt-1" />
            </div>
            
            <div>
              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Allocate Coins'}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
} 