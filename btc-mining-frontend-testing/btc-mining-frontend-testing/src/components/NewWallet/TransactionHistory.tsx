import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import React from 'react';
import { Transaction } from '../../types/transaction';

// Function to get status color based on status value
const getStatusColor = (status?: string): string => {
  if (!status) return '#94A3B8'; // default gray
  
  const normalizedStatus = status.toUpperCase();
  
  switch (normalizedStatus) {
    case 'PENDING':
      return '#F59E0B'; // light amber
    case 'CONFIRMED':
      return '#047857'; // dark green
    case 'APPROVED':
      return '#10B981'; // light green
    case 'FAILED':
      return '#F87171'; // light red
    default:
      return '#94A3B8'; // default gray
  }
};

const TransactionHistory = ({
  transactions,
}: {
  transactions: Transaction[];
}) => {
  const handleViewAll = () => console.log('View All Transactions');
  return (
    <View style={styles.transactionContainer}>
      <Text style={styles.transactionHeader}>Withdrawal History</Text>

      {transactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Image
            source={require('../../assets/images/emptyWallet.png')}
            style={styles.emptyImage}
            resizeMode="stretch"
          />
          <Text style={styles.emptyText}>
            You haven't had any withdrawals yet
          </Text>
        </View>
      ) : (
        <>
          {transactions.map((txn, index) => (
            <View
              key={index}
              style={[
                styles.transactionRow,
                index !== 0 && styles.transactionRowBorderTop,
              ]}
            >
              <View>
                <Text style={styles.transactionType}>{txn.type}</Text>
                <Text style={styles.transactionMethod}>
                  Method: {txn.method}
                </Text>
                <Text style={styles.transactionDate}>{txn.date}</Text>
                {txn?.status && (
                  <Text style={[
                    styles.transactionStatus,
                    { color: getStatusColor(txn.status) }
                  ]}>
                    Status: {txn.status}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  txn.isPositive ? styles.positiveAmount : styles.negativeAmount,
                ]}
              >
                { txn?.amountNumeric ?? '0'}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={handleViewAll}
          >
            <Text style={styles.viewAllText}>View All Transactions</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default TransactionHistory;

const styles = StyleSheet.create({
  transactionContainer: {
    marginTop: 25,
    flex: 1,
  },
  transactionHeader: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  transactionType: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '500',
  },
  transactionMethod: {
    color: '#A0AEC0',
    fontSize: 13,
    marginTop: 2,
  },
  transactionDate: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  transactionStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'center',
  },
  positiveAmount: {
    color: '#10B981',
  },
  negativeAmount: {
    color: '#EF4444',
  },
  viewAllButton: {
    marginTop: 16,
    backgroundColor: '#374151',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '500',
  },
  transactionRowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
    marginTop: 16,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  emptyImage: { width: '70%', height: 150 },
});
