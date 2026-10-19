import test from 'node:test';
import assert from 'node:assert/strict';
import { mapMercuryAccounts, mapMercuryTransactions } from '../src/lib/mercury';

test('Mercury accounts are reduced to display-safe fields', () => {
  const accounts = mapMercuryAccounts({ accounts: [{
    id: 'account-1', name: 'Business Checking', nickname: 'Operating', currentBalance: 1234.56,
    availableBalance: 1200, currency: 'USD', status: 'active', type: 'mercury', accountNumber: '1234567890', routingNumber: '987654321',
  }] });
  assert.deepEqual(accounts, [{ id: 'account-1', name: 'Operating', currentBalance: 1234.56, availableBalance: 1200, currency: 'USD', status: 'active' }]);
  assert.equal(JSON.stringify(accounts).includes('1234567890'), false);
  assert.equal(JSON.stringify(accounts).includes('987654321'), false);
});

test('Mercury transaction mapping limits rows and excludes raw provider fields', () => {
  const accounts = mapMercuryAccounts({ accounts: [{ id: 'account-1', name: 'Business Checking', currentBalance: 100, availableBalance: 90, status: 'active', type: 'mercury' }] })!;
  const tx = mapMercuryTransactions({ transactions: [{
    id: 'transaction-1', accountId: 'account-1', amount: -19.99, currency: 'USD', status: 'sent',
    counterpartyName: 'Fuel Stop', createdAt: '2026-10-18T12:00:00Z', postedAt: '2026-10-18T12:02:00Z',
    kind: 'debit', accountNumber: '1234567890', routingNumber: '987654321',
  }] }, accounts);
  assert.deepEqual(tx, [{
    id: 'transaction-1', accountName: 'Business Checking', amount: -19.99, currency: 'USD', status: 'sent',
    description: 'Fuel Stop', createdAt: '2026-10-18T12:00:00Z', postedAt: '2026-10-18T12:02:00Z', kind: 'debit',
  }]);
  assert.equal(JSON.stringify(tx).includes('1234567890'), false);
  assert.equal(mapMercuryAccounts({ accounts: 'unexpected' }), null);
  assert.equal(mapMercuryTransactions({ transactions: [] }, accounts)?.length, 0);
});
