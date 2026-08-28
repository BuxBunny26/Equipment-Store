import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
}

let _operatorName = 'System';

export const setOperatorName = (name) => {
    _operatorName = name || 'System';
};

export const getOperatorName = () => _operatorName;

// Staging-only trusted identity token (see backend/database/rls_afs_design_PROPOSAL.sql).
// Inert today: no RLS policy reads it yet, and mfa-verify.js only issues one
// once a signing key/secret is configured server-side. Attaching it here now
// means the frontend is ready before that cutover, with zero behaviour
// change until both sides are enabled.
let _authToken = null;

export const setAuthToken = (token) => {
    _authToken = token || null;
};

export const getAuthToken = () => _authToken;

export const clearAuthToken = () => {
    _authToken = null;
};

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        // Official mechanism for a custom/third-party JWT (Supabase docs:
        // "Using custom or third-party JWTs") — supersedes the older
        // recommendation of setting Authorization via a custom fetch/header,
        // which Supabase's own docs now say to avoid. Returning undefined
        // when there's no token (not logged in / RLS not yet enabled) means
        // only the apikey (anon key) is sent, exactly today's behaviour.
        accessToken: async () => _authToken || undefined,
        global: {
            fetch: (url, options = {}) => {
                const headers = new Headers(options.headers);
                headers.set('x-operator-name', _operatorName);
                return fetch(url, { ...options, headers });
            }
        }
    }
);
