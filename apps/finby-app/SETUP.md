# Finby Shopify App - Setup Phase 2.2

## App Information

- **App Name:** Finby app
- **Client ID:** `4f7bf5431a26c148fd5faac77b3d02a4`
- **App URL:** `https://svc-api-gateway-2gc7gddpva-ew.a.run.app/api/v1/shops`
- **Redirect URL:** `https://svc-api-gateway-2gc7gddpva-ew.a.run.app/api/v1/shops/callback`
- **Scopes:** `read_themes`, `write_themes`
- **Embedded:** Yes

## Configuration Status

The `shopify.app.toml` file has been configured with:

- Application URL pointing to our Cloud Run gateway
- OAuth callback URL pointing to `/api/v1/shops/callback`
- Required scopes for theme access

## Manual Configuration Required

Since this is the initial setup, you need to verify/apply the configuration in Shopify Partners Dashboard:

1. Open the app in Partners Dashboard:
   - Go to https://partners.shopify.com
   - Navigate to Apps > Finby app
   - Click "Configuration" or "App setup"

2. Verify/Update the following settings:
   - **App URL:** `https://svc-api-gateway-2gc7gddpva-ew.a.run.app/api/v1/shops`
   - **Allowed redirection URL(s):**
     - `https://svc-api-gateway-2gc7gddpva-ew.a.run.app/api/v1/shops/callback`
     - `https://example.com/api/auth` (for local dev)
   - **Scopes:** Ensure `read_themes` and `write_themes` are checked

3. Under "App embed settings":
   - Ensure "Embed app in Shopify admin" is ENABLED

4. Save all changes

## Installation URL

Once configured in Partners, use this URL to install the app on a development store:

```
https://svc-api-gateway-2gc7gddpva-ew.a.run.app/api/v1/shops/install?shop=YOUR-STORE.myshopify.com
```

Replace `YOUR-STORE` with your actual development store name.

## Local Development

To run the app locally for development:

```bash
cd apps/finby-app
npm install
npm run dev
# or
shopify app dev
```

Note: Local dev will use `https://example.com/api/auth` as callback URL (configured in shopify.app.toml).

## OAuth Flow

1. User visits: `GET /api/v1/shops/install?shop={shop}`
2. Gateway redirects to Shopify OAuth with client_id and scopes
3. User authorizes app
4. Shopify redirects to: `GET /api/v1/shops/callback?code={code}&shop={shop}`
5. Backend exchanges code for access token
6. Access token stored securely

## Next Steps

1. ✅ App scaffolded (Remix TypeScript)
2. ✅ Configuration file updated (shopify.app.toml)
3. ⏳ Verify configuration in Partners Dashboard
4. ⏳ Create/select development store
5. ⏳ Test OAuth flow with installation URL
6. ⏳ Implement backend OAuth handler in svc-shops

## Security Notes

- NO secrets committed to repository
- Client secret available in Partners Dashboard only
- Access tokens stored securely in backend (not in frontend)
- CSP headers configured for embedded app: `frame-ancestors https://admin.shopify.com https://*.myshopify.com`
