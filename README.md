# Evolve Med Spa - Business Intelligence Dashboard

A modern, responsive React dashboard for Evolve Med Spa that displays real-time business metrics, location performance, and KPIs across all 14 locations.

## Features

✅ **Real-time KPIs** - Cash sales, recognized revenue, and growth metrics  
✅ **Financial Metrics** - Budget tracking, ASP, COGS, and payroll margins  
✅ **Operational Metrics** - Utilization rates, no-show rates, rebook percentages  
✅ **Location Performance** - Detailed data for all 14 locations with sortable metrics  
✅ **Service & Product Mix** - Visual breakdown of revenue and product consumption  
✅ **Responsive Design** - Works perfectly on desktop, tablet, and mobile  
✅ **Export Functionality** - Ready for data export integration  

## Tech Stack

- **React 18** - UI framework
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Lucide Icons** - Beautiful, lightweight icons

## Local Development

### Prerequisites
- Node.js 16+ and npm/yarn

### Installation

```bash
# Clone or download the project
cd evolve-med-spa-dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist` folder.

## Deployment to Railway

Railway makes it simple to deploy your React dashboard. Follow these steps:

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Evolve Med Spa Dashboard"
git remote add origin https://github.com/YOUR_USERNAME/evolve-med-spa-dashboard.git
git branch -M main
git push -u origin main
```

### Step 2: Connect to Railway

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Connect your GitHub account and select this repository
5. Railway will auto-detect it's a Node.js project

### Step 3: Configure Build & Start Commands

In the Railway dashboard:
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run preview`
- **Port:** `3000`

### Step 4: Set Environment Variables (Optional)

If you need any environment variables:
1. Go to "Variables" in your Railway project
2. Add any necessary variables (e.g., API endpoints)

### Step 5: Deploy

Click "Deploy" and Railway will automatically build and deploy your app. You'll get a public URL like:
```
https://evolve-dashboard-production.up.railway.app
```

### Advanced: Use Railway CLI

For CLI-based deployment:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

## Project Structure

```
evolve-med-spa-dashboard/
├── index.html              # HTML entry point
├── main.jsx               # React entry point
├── evolve-dashboard.jsx   # Main dashboard component
├── index.css              # Global styles
├── package.json           # Dependencies
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind configuration
├── postcss.config.js      # PostCSS configuration
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## Data Structure

All dashboard data is currently static (defined in `evolve-dashboard.jsx`). To connect live data:

### Option 1: API Integration

```javascript
// Add this to evolve-dashboard.jsx
const [dashboardData, setDashboardData] = useState(null);

useEffect(() => {
  fetch('/api/dashboard')
    .then(res => res.json())
    .then(data => setDashboardData(data));
}, []);
```

### Option 2: Database Connection

Connect to your database (PostgreSQL, MongoDB, etc.) via a Node.js backend:

```javascript
// Create an API layer
app.get('/api/dashboard', async (req, res) => {
  const data = await db.query('SELECT * FROM dashboard_metrics');
  res.json(data);
});
```

### Option 3: Real-time Updates with WebSockets

```javascript
useEffect(() => {
  const ws = new WebSocket('wss://your-api.com/dashboard');
  ws.onmessage = (event) => {
    setDashboardData(JSON.parse(event.data));
  };
}, []);
```

## Customization

### Update Logo & Branding

Edit the header in `evolve-dashboard.jsx`:

```javascript
<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
  <span className="text-white font-bold">E</span>
</div>
```

### Change Colors

Modify `tailwind.config.js`:

```javascript
colors: {
  teal: {
    500: '#your-color',
    600: '#your-color',
  }
}
```

### Add New Metrics

Add to the `MetricCard` arrays in the component:

```javascript
const newMetric = {
  label: 'YOUR METRIC',
  value: '$1,234K',
  note: '↑ 5.2%',
  trend: 'up'
};
```

## Performance Optimization

The dashboard is already optimized, but for even better performance:

1. **Code Splitting**: Use React lazy() for large sections
2. **Image Optimization**: Compress any images
3. **Caching**: Set proper cache headers in Railway
4. **CDN**: Use Railway's built-in edge caching

## Troubleshooting

### Port Already in Use
```bash
# Use a different port
npm run dev -- --port 3001
```

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Railway Deployment Issues

1. **Check logs**: `railway logs`
2. **Verify environment**: Ensure all env vars are set
3. **Test locally first**: Run `npm run build && npm run preview`

## Environment Variables (Optional)

Create a `.env` file for local development:

```env
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=Evolve Med Spa
```

Access in code:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

## API Integration Example

To fetch live data, modify the component:

```javascript
const [locations, setLocations] = useState([]);

useEffect(() => {
  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };
  
  fetchLocations();
}, []);
```

## License

This project is proprietary to Evolve Med Spa.

## Support

For issues or questions about Railway deployment:
- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

For dashboard customization:
- Contact the development team

---

**Last Updated:** June 2026  
**Dashboard Version:** 1.0.0
