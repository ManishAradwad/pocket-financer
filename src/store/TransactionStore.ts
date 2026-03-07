import { makeAutoObservable, runInAction } from 'mobx';
import { database } from '../database';
import { Transaction, Account } from '../database/models';
import { Q } from '@nozbe/watermelondb';

export class TransactionStore {
    transactions: Transaction[] = [];
    accounts: Account[] = [];
    isLoading = false;

    constructor() {
        makeAutoObservable(this);
        this.loadStore();
    }

    async loadStore() {
        runInAction(() => {
            this.isLoading = true;
        });

        try {
            const txs = await database.get<Transaction>('transactions').query(Q.sortBy('date', Q.desc)).fetch();
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

    async getOrCreateAccount(name: string, bank: string, type: string) {
        const existing = this.accounts.find(a => a.name === name && a.bank === bank);
        if (existing) {
            return existing;
        }

        let newAcc: Account | undefined;
        await database.write(async () => {
            newAcc = await database.get<Account>('accounts').create(acc => {
                acc.name = name;
                acc.bank = bank;
                acc.type = type;
            });
        });

        if (newAcc) {
            runInAction(() => {
                this.accounts.push(newAcc!);
            });
        }
        return newAcc;
    }
}

export const transactionStore = new TransactionStore();
