import {appSchema, tableSchema} from '@nozbe/watermelondb';

/**
 * Database schema for pocket-financer.
 *
 * Only two tables: accounts and transactions.
 * All PocketPal tables (chat_sessions, messages, completion_settings,
 * global_settings) have been removed.
 */
export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'accounts',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'bank', type: 'string'},
        {name: 'type', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        {name: 'amount', type: 'number'},
        {name: 'merchant', type: 'string'},
        {name: 'date', type: 'number'},
        {name: 'type', type: 'string'},
        {name: 'account_id', type: 'string', isIndexed: true},
        {name: 'raw_message', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
  ],
});
