import { Model } from '@nozbe/watermelondb';
import { field, text, relation, readonly, date } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Account from './Account';

export default class Transaction extends Model {
    static table = 'transactions';

    static associations: Associations = {
        accounts: { type: 'belongs_to' as const, key: 'account_id' },
    };

    @field('amount') amount!: number;
    @text('merchant') merchant!: string;
    @field('date') date!: number;
    @text('type') type!: string;
    @text('account_id') accountId!: string;
    @text('raw_message') rawMessage!: string;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;

    @relation('accounts', 'account_id') account!: Account;
}
