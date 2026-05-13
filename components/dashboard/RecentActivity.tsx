type TransactionRow = {
  id?: string
  payment_status?: string
  seller_proceeds?: number | string | null
  created_at?: string
}

interface Props {
  transactions: TransactionRow[]
}

export function RecentActivity({ transactions }: Props) {
  return (
    <div className="recent-activity">
      <div className="ra-header">
        <h2>Recent Activity</h2>
      </div>
      <div className="ra-body">
        {transactions.length === 0 ? (
          <p>No recent activity.</p>
        ) : (
          transactions.map((transaction, index) => (
            <div key={transaction.id ?? index} className="ra-row">
              <span>{transaction.payment_status ?? 'pending'}</span>
              <strong>${Number(transaction.seller_proceeds ?? 0).toLocaleString()}</strong>
              <span>{transaction.created_at ? new Date(transaction.created_at).toLocaleDateString() : 'Just now'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
