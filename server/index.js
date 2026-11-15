import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 4000

// Only the React site may call this server.
const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim())
app.use(cors({ origin: allowed }))
app.use(express.json())

// Health check: Render uses it, and you can open it in a browser to confirm the server is awake.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agapayisip-server', time: new Date().toISOString() })
})

// Next steps will add: POST /api/push/send, GET /api/reports/*, admin actions.

app.listen(PORT, () => console.log(`AgapayIsip+ server listening on port ${PORT}`))
