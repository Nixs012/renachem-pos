import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    const { dateFrom, dateTo } = req.body

    // Fetch all sales in date range
    let query = supabase.from('sales').select('items_json, total, date')
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)
    
    const { data: sales, error } = await query
    if (error) throw error

    // Parse items_json and aggregate by medicine name
    const medicineStats = {}
    
    for (const sale of sales) {
      let items = []
      try { items = JSON.parse(sale.items_json) } catch { continue }
      
      for (const item of items) {
        const name = item.name || item
        if (!medicineStats[name]) {
          medicineStats[name] = { name, totalQty: 0, totalRevenue: 0, saleCount: 0 }
        }
        medicineStats[name].totalQty += (item.qty || 1)
        medicineStats[name].totalRevenue += (item.subtotal || item.price || 0)
        medicineStats[name].saleCount += 1
      }
    }

    // Sort by totalQty descending, take top 15
    const sorted = Object.values(medicineStats)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 15)

    res.status(200).json({ success: true, stats: sorted })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
