import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 7,
  tables: [
    tableSchema({
      name: 'accounts',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'bank', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'transactions',
      columns: [
        { name: 'amount', type: 'number' },
        { name: 'merchant', type: 'string' },
        { name: 'date', type: 'number' }, // Store as timestamp
        { name: 'type', type: 'string' }, // credit | debit
        { name: 'account_id', type: 'string', isIndexed: true },
        { name: 'raw_message', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'chat_sessions',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'date', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'session_id', type: 'string', isIndexed: true },
        { name: 'author', type: 'string' },
        { name: 'text', type: 'string', isOptional: true },
        { name: 'type', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'metadata', type: 'string' }, // JSON stringified
        { name: 'position', type: 'number' }, // For ordering
      ],
    }),
    tableSchema({
      name: 'completion_settings',
      columns: [
        { name: 'session_id', type: 'string', isIndexed: true },
        { name: 'settings', type: 'string' }, // JSON stringified
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'global_settings',
      columns: [
        { name: 'key', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' }, // JSON stringified
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
