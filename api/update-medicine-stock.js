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
    const { id, quantityDeducted } = req.body;

    if (!id || typeof quantityDeducted !== 'number') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    // 1. Fetch current stock
    const { data: currentMedicine, error: fetchError } = await supabase
      .from('medicines')
      .select('stock')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching medicine stock:', fetchError);
      return res.status(500).json({ success: false, message: fetchError.message });
    }

    const currentStock = currentMedicine.stock || 0;
    let newStock = currentStock - quantityDeducted;
    
    // Prevent negative stock (or allow it based on settings, but let's prevent below 0 for safety, 
    // or just let it go negative to track missed inventory intakes). For now, standard subtraction:
    if (newStock < 0) newStock = 0; // Optional safeguard

    // 2. Update stock
    const { data: updatedMedicine, error: updateError } = await supabase
      .from('medicines')
      .update({ stock: newStock })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating medicine stock:', updateError);
      return res.status(500).json({ success: false, message: updateError.message });
    }

    return res.status(200).json({ success: true, newStock: updatedMedicine.stock });
  } catch (error) {
    console.error('Error in update-medicine-stock:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}
