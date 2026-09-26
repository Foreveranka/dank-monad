import {defineConfig} from 'drizzle-kit';
export default defineConfig({schema:'./db/pg-schema.ts',out:'./drizzle-pg',dialect:'postgresql'});
