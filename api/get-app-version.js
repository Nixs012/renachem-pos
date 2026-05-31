export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  res.status(200).json({
    success: true,
    version: process.env.APP_VERSION || '1.0.0',
    releaseNotes: process.env.RELEASE_NOTES || 'System running latest version',
    updatedAt: process.env.LAST_UPDATED || new Date().toISOString()
  })
}
