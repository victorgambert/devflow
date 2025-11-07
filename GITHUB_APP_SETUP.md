# GitHub App Setup Guide for Soma Squad AI

This guide explains how to create and configure a GitHub App for Soma Squad AI to access your repositories securely.

## Why GitHub App vs Personal Access Token?

| Feature | Personal Access Token | GitHub App |
|---------|----------------------|------------|
| **Scope** | All user repos | Specific repos only |
| **Permissions** | User-level (broad) | Repository-level (granular) |
| **Audit** | User actions | App-specific actions |
| **Rate Limits** | 5,000/hour | 5,000/hour per installation |
| **Security** | Tied to user account | Independent identity |
| **Expiration** | Manual rotation | Auto-refresh tokens |

**Recommendation**: Use GitHub App for production, PAT for development/testing.

---

## Option 1: Personal Access Token (Quick Start)

### For Development/Testing

1. **Go to GitHub Settings**
   - Navigate to: https://github.com/settings/tokens

2. **Generate New Token (Classic)**
   - Click "Generate new token" → "Generate new token (classic)"
   - Name: `Soma Squad AI Development`
   - Expiration: 90 days (or custom)

3. **Select Permissions**
   ```
   ✓ repo (all)
     ✓ repo:status
     ✓ repo_deployment
     ✓ public_repo
     ✓ repo:invite
     ✓ security_events

   ✓ read:org (if using organization repos)
   ```

4. **Generate and Copy Token**
   - Click "Generate token"
   - Copy the token (starts with `ghp_`)
   - **IMPORTANT**: Save it securely, you won't see it again

5. **Configure Soma Squad AI**
   ```bash
   # Add to .env file
   GITHUB_TOKEN="ghp_your_token_here"
   ```

6. **Test Access**
   ```bash
   cd packages/sdk
   GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-integration-e2e.ts facebook/react
   ```

---

## Option 2: GitHub App (Production)

### Step 1: Create GitHub App

1. **Navigate to GitHub Settings**
   - **For Personal Account**: https://github.com/settings/apps
   - **For Organization**: https://github.com/organizations/YOUR_ORG/settings/apps

2. **Click "New GitHub App"**

3. **Fill Basic Information**
   ```
   GitHub App name: Soma Squad AI
   Homepage URL: https://your-soma-squad-ai-instance.com
   Description: AI-powered development workflow automation
   ```

4. **Webhook Configuration**
   ```
   ✓ Active (if you want webhook events)
   Webhook URL: https://your-soma-squad-ai-instance.com/api/webhooks/github
   Webhook secret: (generate a random string)
   ```

   **Note**: You can disable webhooks for now if not using real-time events.

5. **Repository Permissions**

   Set these permissions:

   | Permission | Access | Reason |
   |------------|--------|--------|
   | **Contents** | Read & Write | Read code, create branches, commit files |
   | **Metadata** | Read-only | Repository info (auto-granted) |
   | **Pull requests** | Read & Write | Create and manage PRs |
   | **Issues** | Read-only | Read issue information (optional) |
   | **Workflows** | Read & Write | Trigger CI/CD workflows |

6. **Organization Permissions** (Optional)
   ```
   Members: Read-only (if you need team info)
   ```

7. **User Permissions**
   ```
   (None required for basic operation)
   ```

8. **Subscribe to Events** (Optional)
   ```
   ✓ Pull request
   ✓ Pull request review
   ✓ Push
   ✓ Workflow run
   ```

9. **Where can this GitHub App be installed?**
   ```
   ○ Only on this account
   ● Any account (if you want to share)
   ```

10. **Create GitHub App**
    - Click "Create GitHub App"

### Step 2: Generate Private Key

1. **Scroll to "Private keys" section**
2. **Click "Generate a private key"**
3. **Download the `.pem` file**
   - Save it securely (e.g., `soma-squad-ai-github-app.pem`)
   - **Never commit this file to git**

### Step 3: Note App Credentials

After creation, note these values:

```
App ID: 123456
Client ID: Iv1.abc123def456
Installation ID: (see next step)
Private Key: (the .pem file you downloaded)
```

### Step 4: Install the App

1. **Go to App Settings**
   - Click "Install App" in the left sidebar

2. **Choose Account**
   - Select your account or organization

3. **Select Repositories**
   ```
   ○ All repositories (not recommended for security)
   ● Only select repositories
     ✓ my-project-repo
     ✓ another-project-repo
   ```

4. **Click "Install"**

5. **Note Installation ID**
   - After install, check URL: `https://github.com/settings/installations/12345678`
   - The number `12345678` is your Installation ID

### Step 5: Configure Soma Squad AI

#### Environment Variables

```bash
# .env file
GITHUB_APP_ID="123456"
GITHUB_APP_INSTALLATION_ID="12345678"
GITHUB_APP_PRIVATE_KEY_PATH="/path/to/soma-squad-ai-github-app.pem"

# OR inline (base64 encoded)
GITHUB_APP_PRIVATE_KEY="LS0tLS1CRUdJTi..."
```

#### Generate Installation Token

GitHub Apps use short-lived installation tokens:

```typescript
import { App } from '@octokit/app';

const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8'),
});

// Get installation access token (expires in 1 hour)
const { token } = await app.octokit.request(
  'POST /app/installations/{installation_id}/access_tokens',
  { installation_id: process.env.GITHUB_APP_INSTALLATION_ID }
);

// Use token with Soma Squad AI
const github = new GitHubProvider(token);
```

---

## Security Best Practices

### 1. Token Storage

**DO:**
- ✅ Store tokens in environment variables
- ✅ Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- ✅ Encrypt tokens at rest
- ✅ Use short-lived tokens (GitHub App tokens expire in 1h)

**DON'T:**
- ❌ Commit tokens to git
- ❌ Log tokens in application logs
- ❌ Share tokens via email/chat
- ❌ Use the same token across environments

### 2. Token Rotation

```bash
# Personal Access Tokens
# Set expiration and rotate regularly (90 days recommended)

# GitHub App Tokens
# Auto-expire after 1 hour, request new token as needed
```

### 3. Least Privilege

- Only grant permissions actually needed
- Use "Read-only" when possible
- Limit repository access to specific repos

### 4. Monitoring

- Enable audit logging
- Monitor API rate limits
- Track failed authentication attempts
- Review app permissions quarterly

---

## Testing Your Setup

### 1. Test Token Access

```bash
# Test with curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/user/repos

# Expected: JSON list of repositories
```

### 2. Test Soma Squad AI Integration

```bash
# Test repository parsing
cd packages/sdk
GITHUB_TOKEN="your_token" npx ts-node src/__manual_tests__/test-integration-e2e.ts facebook/react
```

### 3. Test API Endpoint

```bash
# Start Soma Squad AI API
cd packages/api
npm run start:dev

# Link a repository
curl -X POST http://localhost:3000/projects/PROJECT_ID/link-repository \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl": "https://github.com/facebook/react"}'

# Expected: 200 OK with updated project
```

---

## Troubleshooting

### Error: "Bad credentials"

**Cause**: Invalid or expired token

**Solution**:
1. Regenerate token
2. Check token has `repo` scope
3. Verify token is active (not expired or revoked)

### Error: "Not Found" or "404"

**Cause**:
- Repository doesn't exist
- Token lacks access to repository
- Repository is private but token is for different user/org

**Solution**:
1. Check repository URL is correct
2. Verify token has access to the repository
3. For private repos, ensure token owner has access

### Error: "API rate limit exceeded"

**Cause**: Exceeded GitHub API rate limit (5,000 requests/hour)

**Solution**:
1. Wait for rate limit to reset
2. Use authenticated requests (higher limit)
3. Implement caching for frequently accessed data
4. Use conditional requests (ETags)

### Error: "Resource not accessible by integration"

**Cause**: GitHub App lacks required permissions

**Solution**:
1. Go to GitHub App settings
2. Grant required permissions
3. Accept permission changes in installation settings

### Error: "Installation ID not found"

**Cause**: App not installed on repository/account

**Solution**:
1. Install the GitHub App on your account
2. Grant access to the required repositories
3. Use correct Installation ID

---

## Production Deployment Checklist

- [ ] Use GitHub App (not Personal Access Token)
- [ ] Store credentials in secure secrets manager
- [ ] Grant minimum required permissions
- [ ] Enable audit logging
- [ ] Set up monitoring and alerts
- [ ] Configure token rotation schedule
- [ ] Document emergency token revocation procedure
- [ ] Test failover scenarios
- [ ] Review security quarterly
- [ ] Set up webhook signature verification

---

## Additional Resources

- **GitHub Apps Documentation**: https://docs.github.com/en/apps
- **GitHub API Reference**: https://docs.github.com/en/rest
- **Octokit Libraries**: https://github.com/octokit
- **Rate Limiting**: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting
- **Best Practices**: https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app

---

## Support

For issues or questions:
- **GitHub**: Open an issue on the Soma Squad AI repository
- **Documentation**: Check the main README.md
- **API Reference**: See API documentation at `/api/docs`

---

**Last Updated**: 2025-11-03
