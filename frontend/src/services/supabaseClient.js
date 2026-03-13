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

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        global: {
            fetch: (url, options = {}) => {
                const headers = new Headers(options.headers);
                headers.set('x-operator-name', _operatorName);
                return fetch(url, { ...options, headers });
            }
        }
    }
);
