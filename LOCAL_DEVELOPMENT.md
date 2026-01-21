# Local Development Workflow

## Quick Start

### 1. Test Backend Locally (Fast - 30 seconds)

```bash
# Navigate to backend
cd backend

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies (first time only - takes 5-10 min)
pip install -r requirements.txt

# Start backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Test it:**
- Visit: http://localhost:8000/health
- Should return: `{"status":"ok"}`

### 2. Test Frontend Locally

```bash
# In project root
npm install  # First time only
npm run dev
```

**Test it:**
- Visit: http://localhost:3000
- Backend should connect to: http://localhost:8000

### 3. Test Full Stack Locally

```bash
# Use the start script
./start-all.sh
```

This starts both backend (port 8000) and frontend (port 3000).

## Recommended Workflow

### ✅ **DO THIS:**

1. **Make changes locally**
   ```bash
   # Edit your code
   # Test backend: http://localhost:8000/health
   # Test frontend: http://localhost:3000
   ```

2. **Test everything works**
   - Upload a test video
   - Verify analysis works
   - Check for errors

3. **Commit and push** (only when it works!)
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

4. **Railway auto-deploys** (3-5 min)
   - Monitor Railway dashboard
   - Check logs if issues

### ❌ **DON'T DO THIS:**

- Push every small change → wastes time waiting for builds
- Skip local testing → find bugs in production
- Push broken code → causes failed deployments

## Time Comparison

| Action | Local | Railway |
|--------|-------|---------|
| **First setup** | 5-10 min | 5-10 min |
| **Code changes** | Instant (hot reload) | 3-5 min build |
| **Test analysis** | 2-5 seconds | 2-5 seconds |
| **Find bugs** | Immediate | Wait for build |

## Pro Tips

### 1. Use Local Development for Iteration
- Make 10 code changes locally
- Test all of them
- Push once when everything works

### 2. Only Push When Ready
- Don't push "WIP" commits
- Test locally first
- One good commit > 10 broken ones

### 3. Use Railway for Final Testing
- Railway = production-like environment
- Test there before demo/release
- Local = fast iteration

### 4. Monitor Railway Builds
- Check logs if build fails
- Don't push again until you fix the issue
- Failed builds waste time and resources

## Environment Variables

### Local Backend (.env.local in backend/)
```
GROK_API_KEY=your_key_here
PORT=8000
```

### Local Frontend (.env.local in root/)
```
ANALYSIS_BACKEND_URL=http://localhost:8000
GROK_API_KEY=your_key_here
```

## Troubleshooting Local

**Backend won't start?**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend won't connect?**
- Check backend is running on port 8000
- Check `ANALYSIS_BACKEND_URL` in `.env.local`

**Port already in use?**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```

## Summary

**Best Practice:**
1. Develop locally (fast iteration)
2. Test locally (catch bugs early)
3. Push to Railway (production deployment)
4. Monitor Railway (verify deployment)

**Time Saved:**
- Local testing: 30 seconds
- Railway build: 3-5 minutes
- **Save 2-4 minutes per iteration!**
