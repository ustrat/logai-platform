import axios from 'axios';

const PLAID_BASE_URL = 'https://sandbox.plaid.com'; // switch to https://development.plaid.com for real banks
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '69c07819f69c58000c95f8fe';
const PLAID_SECRET = process.env.PLAID_SECRET || '6f267634418c8aff85a9041f4d25e8';

const plaidClient = axios.create({
  baseURL: PLAID_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const basePayload = () => ({
  client_id: PLAID_CLIENT_ID,
  secret: PLAID_SECRET,
});

export const plaidService = {
  // Step 1 — create a link token to initialize Plaid Link in the browser
  createLinkToken: async (userId: string) => {
    const res = await plaidClient.post('/link/token/create', {
      ...basePayload(),
      user: { client_user_id: userId },
      client_name: 'ValuePilot',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    return res.data;
  },

  // Step 2 — exchange public token (from Plaid Link) for permanent access token
  exchangePublicToken: async (publicToken: string) => {
    const res = await plaidClient.post('/item/public_token/exchange', {
      ...basePayload(),
      public_token: publicToken,
    });
    return res.data; // { access_token, item_id }
  },

  // Step 3 — fetch transactions using access token
  getTransactions: async (
    accessToken: string,
    startDate: string, // YYYY-MM-DD
    endDate: string,   // YYYY-MM-DD
    count: number = 500,
    offset: number = 0,
  ) => {
    const res = await plaidClient.post('/transactions/get', {
      ...basePayload(),
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count, offset, include_personal_finance_category: true },
    });
    return res.data; // { transactions, accounts, total_transactions }
  },

  // Get account balances
  getAccounts: async (accessToken: string) => {
    const res = await plaidClient.post('/accounts/get', {
      ...basePayload(),
      access_token: accessToken,
    });
    return res.data;
  },

  // Sandbox only — create a test item with fake bank data
  createSandboxItem: async () => {
    const res = await plaidClient.post('/sandbox/public_token/create', {
      ...basePayload(),
      institution_id: 'ins_109508', // Chase sandbox
      initial_products: ['transactions'],
    });
    return res.data;
  },
};