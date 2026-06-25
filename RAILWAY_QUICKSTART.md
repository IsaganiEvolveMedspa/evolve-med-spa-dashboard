# Quick Start Guide - Railway Deployment

## 1️⃣ Prerequisites
- GitHub account
- Railway account (free tier available at railway.app)
- Git installed locally

## 2️⃣ Prepare Your Project

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Evolve Med Spa Dashboard"
```

## 3️⃣ Push to GitHub

```bash
# Create a new repository on GitHub (without README, .gitignore, or license)
# Then run:

git remote add origin https://github.com/YOUR_USERNAME/evolve-med-spa-dashboard.git
git branch -M main
git push -u origin main
```

## 4️⃣ Deploy on Railway

1. Visit https://railway.app and sign in
2. Click **New Project**
3. Select **Deploy from GitHub**
4. Connect your GitHub account
5. Select the `evolve-med-spa-dashboard` repository
6. Railway auto-detects Node.js - that's perfect!

## 5️⃣ Wait for Deployment

Railway will:
- ✅ Install dependencies (`npm install`)
- ✅ Build the app (`npm run build`)
- ✅ Start the server (`npm run preview`)
- ✅ Assign a public URL

## 6️⃣ Access Your Dashboard

Once deployed, you'll see a URL like:
```
https://evolve-dashboard-random.up.railway.app
```

**That's it!** Your dashboard is live 🎉

## 📋 File Checklist

Make sure these files are in your project root:

- ✅ `index.html`
- ✅ `main.jsx`
- ✅ `evolve-dashboard.jsx`
- ✅ `package.json`
- ✅ `vite.config.js`
- ✅ `tailwind.config.js`
- ✅ `postcss.config.js`
- ✅ `index.css`
- ✅ `railway.json` (optional but recommended)
- ✅ `.gitignore`
- ✅ `README.md`

## 🔧 Troubleshooting

**Build Failed?**
- Check `package.json` dependencies
- Ensure all imports are correct
- Review build logs in Railway

**App Won't Start?**
- Check that port is `3000`
- Verify vite.config.js has correct host: `'0.0.0.0'`
- Check NODE_ENV isn't blocking production

**Can't See Dashboard?**
- Wait 2-3 minutes for full deployment
- Refresh browser (Ctrl+Shift+Del to clear cache)
- Check Railway logs for errors

## 📊 Next Steps

1. **Connect Real Data**: Replace static data with API calls
2. **Add Authentication**: Protect dashboard with login
3. **Custom Domain**: Add your own domain in Railway settings
4. **Environment Variables**: Add API keys/secrets in Railway dashboard
5. **Auto Refresh**: Add polling or WebSocket updates

## 💡 Pro Tips

- Use Railway CLI for faster local testing:
  ```bash
  npm install -g @railway/cli
  railway run npm run dev
  ```

- Monitor your deployments:
  ```bash
  railway logs --tail
  ```

- Easy rollbacks in Railway dashboard with one click

## 🎯 Success Indicators

Your deployment is successful when:
- ✅ Green "Deploy" status in Railway
- ✅ Dashboard loads at public URL
- ✅ All metrics display correctly
- ✅ No console errors (F12)
- ✅ Tables are interactive

---

**Questions?** Check [Railway Docs](https://docs.railway.app) or [Vite Docs](https://vitejs.dev)
