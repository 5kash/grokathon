# Quick Deployment Checklist

## 🚀 Pre-Deployment

- [ ] Code is pushed to GitHub
- [ ] Grok API key is ready
- [ ] Railway account created
- [ ] Vercel account created

---

## 📦 Backend (Railway)

- [ ] Create new Railway project from GitHub repo
- [ ] Set root directory to `backend`
- [ ] Add environment variable: `GROK_API_KEY`
- [ ] Deploy and wait for build (5-10 min first time)
- [ ] Copy Railway URL (e.g., `https://your-app.up.railway.app`)
- [ ] Test health endpoint: `https://your-app.up.railway.app/health`

---

## ⚛️ Frontend (Vercel)

- [ ] Create new Vercel project from GitHub repo
- [ ] Add environment variables:
  - `ANALYSIS_BACKEND_URL` = your Railway URL
  - `GROK_API_KEY` = your Grok API key
- [ ] Deploy (2-3 minutes)
- [ ] Test homepage loads
- [ ] Test video upload and analysis

---

## 🌐 Custom Domain (Optional)

- [ ] Add domain in Vercel dashboard
- [ ] Update DNS records at domain registrar
- [ ] Wait for SSL certificate (automatic)
- [ ] Test custom domain

---

## ✅ Post-Deployment

- [ ] Test full flow: Upload → Analysis → Results
- [ ] Check Vercel logs for frontend errors
- [ ] Check Railway logs for backend errors
- [ ] Verify Grok insights are working
- [ ] Test on mobile device (responsive UI)

---

## 🔧 Troubleshooting

**Backend not connecting?**
- Check `ANALYSIS_BACKEND_URL` in Vercel env vars
- Verify Railway service is running
- Check Railway logs

**Grok API errors?**
- Verify `GROK_API_KEY` is set in both services
- Check API key is valid

**Build fails?**
- Check Railway logs for Python dependencies
- Check Vercel logs for Node.js build errors

---

**Need help?** See `DEPLOYMENT.md` for detailed instructions.
