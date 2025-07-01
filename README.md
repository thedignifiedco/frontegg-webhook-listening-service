# Frontegg Webhook Service

A Node.js service that automatically handles Frontegg webhook events to streamline user management across tenant applications. When a user is invited to a tenant, this service automatically assigns them to all applications associated with that tenant.

## 🎯 Overview

This service listens for the `frontegg.user.invitedToTenant` webhook event from [Frontegg](https://frontegg.com) and performs automatic user-to-application assignments. It's designed for flexible deployment across different environments and infrastructure types.

## ✨ Features

- 🔐 **Secure Webhook Validation** - Validates incoming webhooks using `x-webhook-secret` header
- 🔑 **Vendor Token Authentication** - Uses client credentials grant for API access
- 🤖 **Automatic User Assignment** - Assigns invited users to all tenant applications
- 🚀 **Dual Deployment Support** - Works as both serverless and traditional server
- 🔒 **HTTPS Support** - Includes local HTTPS development with self-signed certificates
- 📊 **Error Handling** - Comprehensive error handling and logging
- ⚡ **Token Caching** - Efficient vendor token management with automatic refresh

## 🏗️ Architecture

The service supports two deployment models:

### 1. Serverless Deployment (Vercel)
- **File**: `/api/webhook.js`
- **Endpoint**: `/webhooks/user-invited`
- **Ideal for**: Cloud platforms, edge functions, auto-scaling

### 2. Traditional Server Deployment
- **File**: `/server/index.js`
- **Endpoint**: `/webhooks/user-invited`
- **Ideal for**: VPS, Docker containers, on-premise deployments

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (for server deployment)
- **Serverless**: Vercel-compatible API routes
- **Authentication**: JWT tokens with client credentials flow
- **HTTP Client**: Native `fetch` API
- **Security**: Crypto validation for webhooks

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd frontegg-webhook-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env-sample .env
   ```
   
   Edit `.env` with your Frontegg credentials:
   ```env
   FRONTEGG_CLIENT_ID=your_frontegg_client_id
   FRONTEGG_CLIENT_SECRET=your_frontegg_client_secret
   WEBHOOK_SECRET=your_webhook_secret_from_dashboard
   PORT=3000
   ```

## 🚀 Deployment

### Option 1: Serverless (Vercel)

1. **Deploy to Vercel**
   ```bash
   npm run vercel-dev  # For local testing
   vercel --prod       # For production deployment
   ```

2. **Configure webhook URL in Frontegg Dashboard**
   ```
   https://your-vercel-app.vercel.app/webhooks/user-invited
   ```

### Option 2: Traditional Server

1. **Start the server**
   ```bash
   npm run dev    # Development with HTTPS
   npm start      # Production
   ```

2. **Configure webhook URL in Frontegg Dashboard**
   ```
   https://your-domain.com/webhooks/user-invited
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FRONTEGG_CLIENT_ID` | Your Frontegg client ID | ✅ |
| `FRONTEGG_CLIENT_SECRET` | Your Frontegg client secret | ✅ |
| `WEBHOOK_SECRET` | Webhook secret from Frontegg dashboard | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |

### Frontegg Dashboard Setup

1. Navigate to your Frontegg dashboard
2. Go to **Settings** → **Webhooks**
3. Add a new webhook with:
   - **Event**: `frontegg.user.invitedToTenant`
   - **URL**: Your deployed service endpoint
   - **Secret**: Same value as `WEBHOOK_SECRET` in your `.env`

## 📁 Project Structure

```
frontegg-webhook-service/
├── api/
│   └── webhook.js          # Serverless function (Vercel)
├── server/
│   └── index.js            # Express server
├── certs/                  # SSL certificates for local HTTPS
├── .env-sample            # Environment variables template
├── package.json           # Dependencies and scripts
├── vercel.json           # Vercel deployment configuration
└── README.md             # This file
```

## 🔄 How It Works

1. **Webhook Reception**: Service receives `frontegg.user.invitedToTenant` events
2. **Validation**: Validates webhook signature and event type
3. **Authentication**: Obtains vendor token using client credentials
4. **Application Discovery**: Fetches all applications for the tenant
5. **User Assignment**: Assigns the invited user to all tenant applications
6. **Response**: Returns success count of assignments

## 🧪 Development

### Local Development with HTTPS

The server includes self-signed certificates for local HTTPS development:

```bash
npm run dev
# Server runs at https://localhost:9000
```

### Testing Webhooks

Use tools like ngrok to test webhooks locally:

```bash
ngrok http 9000
# Use the ngrok URL in your Frontegg webhook configuration
```

## 📝 API Reference

### Webhook Endpoint

**POST** `/webhooks/user-invited`

**Headers:**
- `Content-Type: application/json`
- `x-webhook-secret: your_webhook_secret`

**Request Body:**
```json
{
  "eventKey": "frontegg.user.invitedToTenant",
  "eventContext": {
    "tenantId": "tenant-uuid",
    "userId": "user-uuid"
  }
}
```

**Response:**
- `200 OK`: `"Apps assigned: {count}"`
- `400 Bad Request`: Invalid event or missing data
- `401 Unauthorized`: Invalid webhook secret
- `500 Internal Server Error`: Authentication or assignment failure

## 🔍 Troubleshooting

### Common Issues

1. **Invalid webhook secret**
   - Ensure `WEBHOOK_SECRET` matches the value in Frontegg dashboard

2. **Authentication failures**
   - Verify `FRONTEGG_CLIENT_ID` and `FRONTEGG_CLIENT_SECRET` are correct
   - Check that your Frontegg app has the necessary permissions

3. **User assignment failures**
   - Ensure the tenant has applications configured
   - Verify the user has proper permissions in the tenant

### Logs

The service provides detailed console logging for debugging:
- Token authentication status
- Application discovery results
- User assignment success/failure counts
- Error details for failed operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For issues and questions:
- Check the troubleshooting section above
- Review Frontegg documentation for webhook setup
- Open an issue in the repository

---

**Built with ❤️ for seamless Frontegg integration**

