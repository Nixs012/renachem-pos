import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { 
      invoice_number, date, date_time, items_json, 
      subtotal, total, payment_mode, cash_amount, 
      mpesa_amount, mpesa_code, cashier_name, 
      customer_name, receipt_html 
    } = req.body;

    const { data, error } = await supabase
      .from('sales')
      .insert([{
        invoice_number,
        date,
        date_time,
        items_json,
        subtotal,
        total,
        payment_mode,
        cash_amount,
        mpesa_amount,
        mpesa_code,
        cashier_name,
        customer_name,
        receipt_html
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error inserting sale:', error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error in save-sale:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
