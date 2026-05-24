import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS headers - mandatory on every route
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { dateFrom, dateTo, search } = req.body || {};

    let query = supabase.from('sales').select('*');

    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    // Sort by created_at descending
    const { data: sales, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    let filteredSales = sales || [];

    // Filter by search query client-side/server-side safely
    if (search) {
      const q = search.toLowerCase().trim();
      filteredSales = filteredSales.filter(s => 
        (s.invoice_number || '').toLowerCase().includes(q) ||
        (s.customer_name || '').toLowerCase().includes(q) ||
        (s.cashier_name || '').toLowerCase().includes(q) ||
        (s.payment_mode || '').toLowerCase().includes(q)
      );
    }

    return res.status(200).json({ success: true, data: filteredSales });

  } catch (error) {
    console.error('[get-invoices] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An unexpected error occurred'
    });
  }
}
