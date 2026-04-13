require('dotenv').config();
const express = require('express');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const cors = require('cors');

const app = express();
const pendingCallbacks = new Map();

// --- Log Redaction ---
const sensitiveVars = [
    process.env.MPESA_CONSUMER_KEY,
    process.env.MPESA_CONSUMER_SECRET,
    process.env.MPESA_PASSKEY
].filter(v => typeof v === 'string' && v.trim() !== '');

function redactValue(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') {
        let redacted = val;
        sensitiveVars.forEach(v => {
            redacted = redacted.split(v).join('[REDACTED]');
        });
        return redacted;
    }
    if (Array.isArray(val)) {
        return val.map(item => redactValue(item));
    }
    if (typeof val === 'object') {
        const newObj = {};
        for (const key in val) {
            newObj[key] = redactValue(val[key]);
        }
        return newObj;
    }
    return val;
}

function redact(args) {
    return args.map(arg => redactValue(arg));
}

const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => originalLog(...redact(args));
console.error = (...args) => originalError(...redact(args));

// Middleware
app.use(helmet());
app.use(cors({ origin: ['http://localhost', 'file://'] }));
app.use(express.json({ limit: '10kb' }));

// Rate Limiters
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

const stkPushLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'STK Push frequency exceeded. Please wait.' }
});

app.use(globalLimiter);

// Validate Env Vars
const requiredEnv = [
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_SHORTCODE',
    'MPESA_PASSKEY',
    'MPESA_CALLBACK_URL',
    'MPESA_BASE_URL'
];

let mpesaEnabled = true;
requiredEnv.forEach(envVar => {
    if (!process.env[envVar]) {
        console.error(`FATAL: Missing ${envVar} — M-Pesa payments disabled`);
        mpesaEnabled = false;
    }
});

// OAuth Token Management
let cachedToken = null;
let tokenExpiryTime = 0;

async function getAccessToken() {
    if (!mpesaEnabled) throw new Error('M-Pesa configuration incomplete');

    const now = Date.now();
    if (cachedToken && tokenExpiryTime > now + 60000) {
        return cachedToken;
    }

    try {
        const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
        const url = `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;

        const response = await axios.get(url, {
            headers: { Authorization: `Basic ${auth}` }
        });

        cachedToken = response.data.access_token;
        tokenExpiryTime = now + (parseInt(response.data.expires_in) * 1000);
        return cachedToken;
    } catch (error) {
        console.error('M-Pesa Token Error:', error.message);
        throw new Error('Failed to get M-Pesa access token');
    }
}

// Helpers
function getKenyanTimestamp() {
    const options = {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const parts = formatter.formatToParts(new Date());
    const res = {};
    parts.forEach(p => res[p.type] = p.value);
    return `${res.year}${res.month}${res.day}${res.hour}${res.minute}${res.second}`;
}

// Routes

/**
 * POST /mpesa/stkpush
 * Initiates an M-Pesa STK Push request.
 */
app.post('/mpesa/stkpush', stkPushLimiter, [
    body('phone').matches(/^(07|01|2547|2541)\d{8}$/),
    body('amount').isNumeric().custom(val => val >= 1 && val <= 150000)
], async (req, res) => {
    if (!mpesaEnabled) {
        return res.status(503).json({ success: false, error: 'M-Pesa configuration incomplete' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Invalid phone number or amount' });
    }

    try {
        let { phone, amount } = req.body;
        // Normalize phone
        if (phone.startsWith('0')) {
            phone = '254' + phone.substring(1);
        }

        const token = await getAccessToken();
        const timestamp = getKenyanTimestamp();
        const password = Buffer.from(process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp).toString('base64');

        const payload = {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: phone,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: phone,
            CallBackURL: process.env.MPESA_CALLBACK_URL,
            AccountReference: 'Renachem POS',
            TransactionDesc: 'Pharmacy Sale'
        };

        const response = await axios.post(`${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        res.json({
            success: true,
            CheckoutRequestID: response.data.CheckoutRequestID,
            CustomerMessage: response.data.CustomerMessage
        });
    } catch (error) {
        const message = error.response ? error.response.data.errorMessage || error.response.data.ResponseDescription : error.message;
        res.status(500).json({ success: false, error: message });
    }
});

/**
 * POST /mpesa/callback
 * Webhook for M-Pesa transaction results.
 */
app.post('/mpesa/callback', (req, res) => {
    // Respond immediately
    res.json({ ResultCode: 0, ResultDesc: 'Success' });

    // Process async
    try {
        const { Body } = req.body;
        if (!Body || !Body.stkCallback) return;

        const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;

        if (ResultCode === 0 && CallbackMetadata) {
            const items = CallbackMetadata.Item;
            const getVal = (name) => items.find(i => i.Name === name)?.Value;

            pendingCallbacks.set(CheckoutRequestID, {
                status: 'success',
                code: getVal('MpesaReceiptNumber'),
                amount: getVal('Amount'),
                phone: getVal('PhoneNumber')
            });
        } else {
            pendingCallbacks.set(CheckoutRequestID, {
                status: 'failed',
                reason: ResultDesc
            });
        }
    } catch (error) {
        console.error('Callback Error:', error.message);
    }
});

/**
 * GET /mpesa/result/:checkoutRequestId
 * Poll for the result of a transaction.
 */
app.get('/mpesa/result/:checkoutRequestId', (req, res) => {
    const id = req.params.checkoutRequestId;
    if (pendingCallbacks.has(id)) {
        const result = pendingCallbacks.get(id);
        pendingCallbacks.delete(id);
        res.json(result);
    } else {
        res.json({ status: 'pending' });
    }
});

/**
 * Start the Express server.
 */
function startServer() {
    let port = 3000;
    const mode = process.env.MPESA_BASE_URL && process.env.MPESA_BASE_URL.includes('sandbox') ? 'SANDBOX' : 'LIVE';

    const server = app.listen(port)
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.warn(`Port ${port} in use, trying 3001...`);
                port = 3001;
                server.listen(port);
            } else {
                console.error('Server Listen Error:', err);
            }
        })
        .on('listening', () => {
            console.log(`M-Pesa server running on port ${port} — ${mode} mode`);
        });

    return server;
}

module.exports = { startServer };
