import {Model} from '@nozbe/watermelondb';
import {text, readonly, date} from '@nozbe/watermelondb/decorators';
import {Associations} from '@nozbe/watermelondb/Model';

export default class Account extends Model {
  static table = 'accounts';

  static associations: Associations = {
    transactions: {type: 'has_many' as const, foreignKey: 'account_id'},
  };

  @text('name') name!: string;
  @text('bank') bank!: string;
  @text('type') type!: string;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
}
