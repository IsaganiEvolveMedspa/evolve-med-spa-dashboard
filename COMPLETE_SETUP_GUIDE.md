# Complete Setup Guide

## Project Structure

Your complete project should look like this:

```
evolve-med-spa-dashboard/
│
├── public/                    # (Optional) Static assets
│   └── favicon.svg           # (Optional) Favicon
│
├── src/                       # (Alternative) Source folder (optional)
│   └── evolve-dashboard.jsx  # OR keep at root
│
├── index.html                 # ✅ HTML entry point (REQUIRED)
├── main.jsx                   # ✅ React entry point (REQUIRED)
├── evolve-dashboard.jsx       # ✅ Dashboard component (REQUIRED)
├── index.css                  # ✅ Global styles (REQUIRED)
│
├── package.json              # ✅ Dependencies (REQUIRED)
├── vite.config.js           # ✅ Vite config (REQUIRED)
├── tailwind.config.js       # ✅ Tailwind config (REQUIRED)
├── postcss.config.js        # ✅ PostCSS config (REQUIRED)
│
├── railway.json             # 📋 Railway config (RECOMMENDED)
├── .gitignore              # 📋 Git config (RECOMMENDED)
├── README.md               # 📋 Documentation (RECOMMENDED)
├── RAILWAY_QUICKSTART.md   # 📋 Deployment guide (RECOMMENDED)
└── vercel.json             # 📋 (Optional) For Vercel deployment
```

## Step-by-Step Setup

### Option A: Manual Setup (Recommended for Learning)

1. **Create project directory**
   ```bash
   mkdir evolve-med-spa-dashboard
   cd evolve-med-spa-dashboard
   ```

2. **Initialize git**
   ```bash
   git init
   git config user.email "your-email@example.com"
   git config user.name "Your Name"
   ```

3. **Copy all files** from `/mnt/user-data/outputs/` to your project directory

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Test locally**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:5173`

6. **Build for production**
   ```bash
   npm run build
   ```

### Option B: Express Server Setup (Advanced)

If you want a full Node.js server instead of just Vite:

```bash
npm install express cors
```

Create `server.js`:
```javascript
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.static(join(__dirname, 'dist')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
```

Update `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node server.js"
  }
}
```

For Railway, use start command: `npm run build && npm start`

## Environment Setup

### 1. Node.js & npm
```bash
# Check if installed
node --version
npm --version

# If not installed, download from nodejs.org
# Recommended: Node 18 LTS or higher
```

### 2. Git
```bash
# Check if installed
git --version

# If not installed, download from git-scm.com
```

### 3. IDE Setup (Visual Studio Code)
```bash
# Install extensions:
# - ES7+ React/Redux/React-Native snippets
# - Tailwind CSS IntelliSense
# - Prettier - Code formatter
# - Thunder Client (for API testing)
```

## Local Development Workflow

```bash
# Start development server
npm run dev

# In another terminal, build for testing
npm run build

# Preview production build
npm run preview

# Clean rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Environment Variables

Create `.env` file in project root:

```env
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_API_TIMEOUT=5000

# App Settings
VITE_APP_NAME=Evolve Med Spa
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_EXPORTS=true
```

Access in code:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
const appName = import.meta.env.VITE_APP_NAME;
```

## Deployment Checklist

Before deploying, verify:

- ✅ All files are present in root directory
- ✅ `npm install` completes without errors
- ✅ `npm run build` creates a `dist` folder
- ✅ `npm run preview` shows the dashboard
- ✅ Git repository is initialized
- ✅ All files are committed
- ✅ Repository is pushed to GitHub

## Railway Deployment

### Prerequisites
- GitHub repository with all files
- Railway account (free at railway.app)

### Steps

1. **Connect Repository**
   - Login to railway.app
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Choose your repository

2. **Configure Build Settings**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run preview`
   - Port: `3000`

3. **Add Environment Variables** (if needed)
   - Go to "Variables" tab
   - Add `NODE_ENV=production`
   - Add any API URLs

4. **Deploy**
   - Click "Deploy" button
   - Wait for build to complete
   - Get your public URL

### Monitor Deployment

```bash
# If using Railway CLI
railway logs --tail

# Check deployment status
railway status
```

## Troubleshooting Common Issues

### Issue 1: "npm not found"
```bash
# Reinstall Node.js from nodejs.org
# Or use nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Issue 2: Port 3000 already in use
```bash
# Use different port
npm run dev -- --port 3001

# Or kill process using port 3000
# On Mac/Linux:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue 3: Build fails with "Module not found"
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue 4: Dashboard looks broken
- Press F12 to open developer console
- Check for errors
- Verify CSS is loaded (should see no 404s)
- Clear cache: Ctrl+Shift+Del

### Issue 5: Railway deployment fails
1. Check build logs in Railway dashboard
2. Verify all files are in GitHub repository
3. Test locally with `npm run build && npm run preview`
4. Ensure `.gitignore` doesn't exclude critical files

## Performance Optimization

### Before Deployment

```bash
# Analyze bundle size
npm run build
# Check dist folder size - should be < 500KB

# Test production build locally
npm run preview
```

### Railway Optimization
1. Enable auto-scaling in Railway settings
2. Set memory limit to 512MB
3. Use Railway's built-in caching
4. Monitor performance with Railway insights

## Updating the Dashboard

### Add New Metrics

In `evolve-dashboard.jsx`:

```javascript
const newMetrics = [
  {
    label: 'NEW METRIC',
    value: '$123K',
    note: '↑ 5.2%',
    trend: 'up'
  }
];
```

### Change Data

Update the data objects:
```javascript
const locationData = [
  {
    name: 'Location Name',
    sales: '$214K',
    // ... other fields
  }
];
```

### Deploy Changes

```bash
git add .
git commit -m "Update dashboard metrics"
git push origin main
# Railway auto-deploys on push!
```

## API Integration

### Fetch Data from Backend

```javascript
import { useEffect, useState } from 'react';

function Dashboard() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error('Failed to fetch:', error);
      }
    };
    
    fetchData();
  }, []);
  
  if (!data) return <div>Loading...</div>;
  
  return <Dashboard data={data} />;
}
```

### CORS Configuration

If backend is on different domain:

```javascript
fetch('/api/data', {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include' // For cookies
})
```

## Backup & Recovery

```bash
# Backup project
zip -r evolve-backup.zip .

# Or use git
git clone https://github.com/YOUR_USERNAME/evolve-med-spa-dashboard.git backup/

# Restore from backup
unzip evolve-backup.zip
npm install
npm run dev
```

## Security Best Practices

1. **Never commit secrets**
   - Use `.env` for local development
   - Use Railway environment variables for production
   - Add `.env` to `.gitignore`

2. **Keep dependencies updated**
   ```bash
   npm outdated
   npm update
   ```

3. **Check for vulnerabilities**
   ```bash
   npm audit
   npm audit fix
   ```

4. **Use HTTPS in production** - Railway provides this by default

## Next Steps

1. ✅ Complete setup using this guide
2. ✅ Test locally with `npm run dev`
3. ✅ Push to GitHub
4. ✅ Deploy on Railway
5. 📊 Add real data from your backend
6. 🔐 Add authentication
7. 🎨 Customize styling
8. 📈 Monitor performance

## Support Resources

- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev
- **Tailwind Docs**: https://tailwindcss.com/docs
- **Railway Docs**: https://docs.railway.app
- **Node.js Docs**: https://nodejs.org/docs

---

**Ready to go?** Start with Option A and follow the deployment steps!
