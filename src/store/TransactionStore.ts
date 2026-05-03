import {makeAutoObservable, runInAction} from 'mobx';
import {Q} from '@nozbe/watermelondb';

import {database} from '../database';
import {Transaction, Account} from '../database/models';

const DEFAULT_ACCOUNT_NAME = '__UNKNOWN__';
const DEFAULT_ACCOUNT_BANK = 'Unknown Bank';
const DEFAULT_ACCOUNT_TYPE = 'auto-extracted';

export class TransactionStore {
  transactions: Transaction[] = [];
  accounts: Account[] = [];
  isLoading = false;

  private defaultAccountPromise: Promise<Account> | null = null;

  constructor() {
    makeAutoObservable(this);
    this.loadStore();
  }

  async loadStore() {
    runInAction(() => {
      this.isLoading = true;
    });

    try {
      const txs = await database
        .get<Transaction>('transactions')
        .query(Q.sortBy('date', Q.desc))
        .fetch();
      const accs = await database.get<Account>('accounts').query().fetch();

      runInAction(() => {
        this.transactions = txs;
        this.accounts = accs;
      });
    } catch (e) {
      console.error('Failed to load transactions and accounts', e);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async addTransaction(data: {
    amount: number;
    merchant: string;
    date: number;
    type: string;
    accountId: string;
    rawMessage: string;
  }) {
    let newTx: Transaction | undefined;
    await database.write(async () => {
      newTx = await database.get<Transaction>('transactions').create(tx => {
        tx.amount = data.amount;
        tx.merchant = data.merchant;
        tx.date = data.date;
        tx.type = data.type;
        tx.accountId = data.accountId;
        tx.rawMessage = data.rawMessage;
      });
    });

    if (newTx) {
      runInAction(() => {
        this.transactions.unshift(newTx!);
      });
    }
    return newTx;
  }

  /**
   * Finds or creates an account. Performs the find-then-create atomically
   * inside a single database.write so two concurrent callers cannot create
   * duplicate rows for the same (name, bank) pair.
   */
  async getOrCreateAccount(name: string, bank: string, type: string) {
    const cached = this.accounts.find(a => a.name === name && a.bank === bank);
    if (cached) return cached;

    let account: Account | undefined;
    await database.write(async () => {
      const existing = await database
        .get<Account>('accounts')
        .query(Q.where('name', name), Q.where('bank', bank))
        .fetch();
      if (existing.length > 0) {
        account = existing[0];
        return;
      }
      account = await database.get<Account>('accounts').create(acc => {
        acc.name = name;
        acc.bank = bank;
        acc.type = type;
      });
    });

    if (account) {
      const ref = account;
      runInAction(() => {
        if (!this.accounts.some(a => a.id === ref.id)) {
          this.accounts.push(ref);
        }
      });
    }
    return account;
  }

  /**
   * Returns the singleton "unknown" account used when extraction does not
   * yield account info. Creates it on first access and caches the promise
   * so parallel callers share one DB write.
   */
  ensureDefaultAccount(): Promise<Account> {
    if (!this.defaultAccountPromise) {
      this.defaultAccountPromise = this.getOrCreateAccount(
        DEFAULT_ACCOUNT_NAME,
        DEFAULT_ACCOUNT_BANK,
        DEFAULT_ACCOUNT_TYPE,
      )
        .then(acc => {
          if (!acc) {
            throw new Error('Failed to create default account');
          }
          return acc;
        })
        .catch(err => {
          // Don't keep a poisoned promise: clear so the next caller can retry.
          this.defaultAccountPromise = null;
          throw err;
        });
    }
    return this.defaultAccountPromise;
  }
}

export const transactionStore = new TransactionStore();
