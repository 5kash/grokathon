# Deployment Guide: XUUG CCTV Reliability Platform

This guide covers deploying the XUUG platform using **Vercel (Frontend) + Railway (Backend)**.

## Architecture

- **Frontend**: Next.js app deployed on Vercel
- **Backend**: FastAPI app deployed on Railway
- **AI**: Grok API (xAI) for insights

---

## Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
3. **Railway Account** - Sign up at [railway.app](https://railway.app)
4. **Grok API Key** - Get from [x.ai](https://x.ai) (if you have access)
5. **Domain** (Optional) - For custom domain setup

---

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will detect the `backend/` folder automatically

### 1.2 Configure Backend Service

1. In Railway dashboard, click on your service
2. Go to **Settings** → **Root Directory**
3. Set to: `backend`
4. Go to **Settings** → **Deploy**
5. Ensure **Build Command** is empty (Railway auto-detects Python)
6. Ensure **Start Command** is: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 1.3 Set Environment Variables

In Railway dashboard → **Variables** tab, add:

```
GROK_API_KEY=your_grok_api_key_here
```

(Optional) If you need other env vars, add them here.

### 1.4 Deploy

1. Railway will automatically deploy when you push to your main branch
2. Wait for deployment to complete (first build may take 5-10 minutes due to PyTorch/YOLO)
3. Once deployed, Railway will provide a public URL like: `https://your-app-name.up.railway.app`
4. **Copy this URL** - you'll need it for the frontend

### 1.5 Test Backend

Visit: `https://your-railway-url.up.railway.app/health`

Should return: `{"status": "ok"}`

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Connect Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 2.2 Configure Build Settings

Vercel should auto-detect:
- **Framework Preset**: Next.js
- **Root Directory**: `./` (root)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 2.3 Set Environment Variables

In Vercel dashboard → **Settings** → **Environment Variables**, add:

```
ANALYSIS_BACKEND_URL=https://your-railway-url.up.railway.app
GROK_API_KEY=your_grok_api_key_here
```

**Important**: 
- Replace `https://your-railway-url.up.railway.app` with your actual Railway URL
- Add these for **Production**, **Preview**, and **Development** environments

### 2.4 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (usually 2-3 minutes)
3. Vercel will provide a URL like: `https://your-app-name.vercel.app`

### 2.5 Test Frontend

1. Visit your Vercel URL
2. Try uploading a video to test the full flow
3. Check browser console for any errors

---

## Step 3: Custom Domain (Optional)

### 3.1 Add Domain in Vercel

1. Go to Vercel dashboard → **Settings** → **Domains**
2. Add your domain (e.g., `xuug.com` or `app.xuug.com`)
3. Vercel will provide DNS records to add

### 3.2 Update DNS

1. Go to your domain registrar (Namecheap, Google Domains, etc.)
2. Add the DNS records provided by Vercel:
   - **A Record** or **CNAME** (Vercel will tell you which)
3. Wait for DNS propagation (5-60 minutes)
4. SSL certificate will be automatically provisioned by Vercel

### 3.3 Update Backend CORS (if needed)

If you're using a custom domain, you may need to update CORS in `backend/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-domain.com",
        "https://www.your-domain.com",
        "https://your-app-name.vercel.app"  # Keep Vercel URL as fallback
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Step 4: Verify Deployment

### 4.1 Test Full Flow

1. **Homepage**: Should show video player with XUUG intro
2. **Upload Page**: Upload a test video (5-20 seconds, MP4)
3. **Analysis**: Should show reliability score, overlay, and recommendations
4. **Grok Insights**: Should show AI-generated why/action

### 4.2 Check Logs

- **Vercel**: Dashboard → **Deployments** → Click deployment → **Functions** tab
- **Railway**: Dashboard → **Deployments** → Click deployment → **Logs** tab

### 4.3 Common Issues

**Backend not connecting:**
- Check `ANALYSIS_BACKEND_URL` in Vercel env vars
- Ensure Railway service is running
- Check Railway logs for errors

**Grok API errors:**
- Verify `GROK_API_KEY` is set in both Vercel and Railway
- Check API key is valid and has credits

**Model loading errors:**
- First request may take longer (model download)
- Check Railway logs for YOLO download progress

**CORS errors:**
- Ensure Railway backend allows your Vercel domain
- Check browser console for specific CORS errors

---

## Step 5: Continuous Deployment

Both platforms support automatic deployments:

- **Vercel**: Auto-deploys on push to main branch
- **Railway**: Auto-deploys on push to main branch (if configured)

To deploy manually:
- **Vercel**: Dashboard → **Deployments** → **Redeploy**
- **Railway**: Dashboard → **Deployments** → **Redeploy**

---

## Cost Estimates

### Free Tier (Hobby)

- **Vercel**: Free (unlimited deployments, 100GB bandwidth)
- **Railway**: $5/month (500 hours compute, 5GB storage)
- **Total**: ~$5/month

### Production Tier

- **Vercel Pro**: $20/month (unlimited bandwidth, team features)
- **Railway**: $10-20/month (based on usage)
- **Total**: ~$30-40/month

---

## Environment Variables Summary

### Frontend (Vercel)
```
ANALYSIS_BACKEND_URL=https://your-railway-url.up.railway.app
GROK_API_KEY=your_grok_api_key_here
```

### Backend (Railway)
```
GROK_API_KEY=your_grok_api_key_here
PORT=8000 (automatically set by Railway)
```

---

## Troubleshooting

### Backend Timeout
- Railway has a 5-minute timeout for free tier
- Consider upgrading if videos take longer to process

### Frontend Build Errors
- Check `package.json` dependencies
- Ensure Node.js version is compatible (Vercel uses Node 18+)

### Model File Missing
- YOLO will auto-download `yolov8n.pt` on first use
- First request may take 1-2 minutes to download model

### Large File Uploads
- Vercel has 50MB limit for API routes (configured in `next.config.js`)
- For larger files, consider direct upload to Railway backend

---

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Project Issues**: Check GitHub issues or create a new one

---

## Quick Reference

| Service | URL | Dashboard |
|---------|-----|-----------|
| Frontend | `https://your-app.vercel.app` | [vercel.com/dashboard](https://vercel.com/dashboard) |
| Backend | `https://your-app.up.railway.app` | [railway.app/dashboard](https://railway.app/dashboard) |
| Health Check | `https://your-app.up.railway.app/health` | - |

---

**Last Updated**: 2024
**Deployment Method**: Vercel + Railway
