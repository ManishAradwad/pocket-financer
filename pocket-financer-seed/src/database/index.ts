import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import {Account, Transaction} from './models';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'pocketfinancer',
  jsi: true,
  onSetUpError: error => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Account, Transaction],
});

export {Account, Transaction};
