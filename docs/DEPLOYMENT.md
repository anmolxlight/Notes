# Deployment Guide

This guide covers deploying the AI-powered Google Keep clone to various platforms.

## Table of Contents

1. [Netlify Deployment (Recommended)](#netlify-deployment)
2. [Vercel Deployment](#vercel-deployment)
3. [AWS S3 + CloudFront](#aws-s3--cloudfront)
4. [Docker Deployment](#docker-deployment)
5. [Environment Variables](#environment-variables)
6. [Troubleshooting](#troubleshooting)

## Netlify Deployment

### Automatic Deployment (GitHub)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Choose GitHub and select your repository
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
     - Node version: `18`

3. **Set Environment Variables**
   
   Go to Site settings > Environment variables and add:
   
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_PINECONE_API_KEY=your_pinecone_api_key
   VITE_PINECONE_ENVIRONMENT=your_pinecone_environment
   VITE_PINECONE_INDEX_NAME=ai-keep-notes
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_DEEPGRAM_API_KEY=your_deepgram_api_key
   VITE_ENABLE_ENCRYPTION=false
   ```

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete
   - Your site will be available at a Netlify URL

### Manual Deployment

1. **Build the Project**
   ```bash
   npm run build
   ```

2. **Deploy via Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

### Custom Domain

1. Go to Domain settings in Netlify
2. Add your custom domain
3. Configure DNS settings:
   - Add CNAME record pointing to your Netlify subdomain
   - Or use Netlify DNS for easier management

## Vercel Deployment

### Automatic Deployment

1. **Push to GitHub** (same as Netlify)

2. **Connect to Vercel**
   - Go to [Vercel](https://vercel.com)
   - Import your GitHub repository
   - Configure project:
     - Framework Preset: Vite
     - Build Command: `npm run build`
     - Output Directory: `dist`

3. **Environment Variables**
   
   Add the same environment variables as Netlify

4. **Deploy**
   - Click "Deploy"
   - Your site will be available at a Vercel URL

### Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

## AWS S3 + CloudFront

### Prerequisites

- AWS Account
- AWS CLI configured

### Steps

1. **Build the Project**
   ```bash
   npm run build
   ```

2. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://your-bucket-name
   ```

3. **Configure Bucket for Website Hosting**
   ```bash
   aws s3 website s3://your-bucket-name --index-document index.html --error-document index.html
   ```

4. **Upload Files**
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

5. **Set Public Read Policy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```

6. **Create CloudFront Distribution**
   - Origin: Your S3 bucket
   - Default Root Object: index.html
   - Error Pages: 404 → /index.html (for SPA routing)

## Docker Deployment

### Dockerfile

Create a `Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

### Build and Run

```bash
# Build image
docker build -t ai-keep .

# Run container
docker run -p 80:80 ai-keep
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Environment Variables

### Required Variables

```bash
# Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Database
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

### Optional Variables

```bash
# AI Features
VITE_PINECONE_API_KEY=...
VITE_PINECONE_ENVIRONMENT=...
VITE_PINECONE_INDEX_NAME=ai-keep-notes
VITE_GEMINI_API_KEY=...
VITE_DEEPGRAM_API_KEY=...

# Security
VITE_ENABLE_ENCRYPTION=false
VITE_ENCRYPTION_KEY=...
```

### Environment-Specific Configuration

Create different `.env` files for different environments:

- `.env.development`
- `.env.staging`
- `.env.production`

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build
      env:
        VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
        VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        VITE_PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}
        VITE_PINECONE_ENVIRONMENT: ${{ secrets.PINECONE_ENVIRONMENT }}
        VITE_GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        VITE_DEEPGRAM_API_KEY: ${{ secrets.DEEPGRAM_API_KEY }}
    
    - name: Deploy to Netlify
      uses: netlify/actions/deploy@master
      with:
        publish-dir: ./dist
        production-branch: main
        production-deploy: ${{ github.ref == 'refs/heads/main' }}
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## Performance Optimization

### Build Optimization

1. **Bundle Analysis**
   ```bash
   npm run build -- --analyze
   ```

2. **Environment Variables at Build Time**
   - Ensure all `VITE_` prefixed variables are set
   - Remove unused API keys to reduce bundle size

3. **Asset Optimization**
   - Images are automatically optimized
   - Use WebP format when possible
   - Enable gzip compression in hosting

### CDN Configuration

1. **Cache Headers**
   ```
   # Static assets
   /*.js, /*.css, /*.png, /*.jpg, /*.ico
   Cache-Control: public, max-age=31536000, immutable
   
   # HTML files
   /*.html
   Cache-Control: public, max-age=0, must-revalidate
   ```

2. **Compression**
   - Enable Brotli and Gzip
   - Most hosting providers enable this automatically

## Monitoring and Analytics

### Error Tracking

1. **Sentry Integration** (Optional)
   ```bash
   npm install @sentry/react
   ```

2. **Custom Error Reporting**
   - Already built into ErrorBoundary component
   - Logs are sent to console in development

### Performance Monitoring

1. **Web Vitals**
   - Built-in performance monitoring
   - Check Lighthouse scores

2. **Analytics**
   - Add Google Analytics or similar
   - Monitor user engagement

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

2. **Environment Variables Not Working**
   - Ensure variables are prefixed with `VITE_`
   - Check variable names match exactly
   - Restart development server after changes

3. **Routing Issues**
   - Ensure SPA routing is configured
   - Check redirect rules in hosting platform

4. **API Errors**
   - Verify all API keys are valid
   - Check CORS settings in services
   - Review service-specific documentation

### Debug Mode

Enable debug mode during development:

```bash
DEBUG=true npm run dev
```

### Service-Specific Issues

1. **Supabase**
   - Check RLS policies
   - Verify table structure
   - Review API key permissions

2. **Clerk**
   - Check domain whitelist
   - Verify webhook configuration
   - Review authentication settings

3. **Pinecone**
   - Verify index configuration
   - Check API key permissions
   - Monitor quota usage

4. **Gemini/Deepgram**
   - Check API key validity
   - Monitor rate limits
   - Review service status

For additional support, refer to the main README or create an issue in the repository.