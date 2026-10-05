# Real-Time Developer Signal & Incident Status Tracker

---

## 1. Executive Summary & Core Concept

### What is this project?
The **Real-Time Developer Signal & Incident Status Tracker** is an automated observability and status monitoring platform tailored for modern developer tools, cloud infrastructure, and AI APIs. 

It continuously runs background health probes against public developer endpoints (e.g., GitHub, OpenAI, Vercel, Supabase, Cloudflare), logs latency metrics, detects outages or response degradations, and displays time-series visualizations on a Next.js dashboard while dispatching alerts via Webhooks and Email.

### Why this project for a Product Engineer role?
As you progress from a Web Developer to a **Product Engineer**, recruiters look for system-level architecture, background asynchronous processing, time-series data management, and operational reliability. 

This project demonstrates:
* **Zero Cold-Start Architecture:** Runs serverlessly with scheduled cron jobs keeping backend workers warm.
* **Asynchronous Data Pipelines:** Performs concurrent API probes and writes time-series logs.
* **Full-Stack Product Thinking:** Combines system observability logic with clean, interactive UX and notification subscriptions.

---

## 2. Recommended Tech Stack

| Layer | Technology | Role / Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | **Next.js 14/15 (App Router)** | Dashboard, interactive latency charts (Recharts), and alert subscription forms. |
| **Styling & Components** | **Tailwind CSS + Shadcn UI** | Sleek, modern developer-focused dashboard design. |
| **Database & Auth** | **Supabase (PostgreSQL)** | Time-series log storage, user alert configs, and Row-Level Security (RLS). |
| **Realtime Engine** | **Supabase Realtime (WebSockets)** | Instant frontend updates when status badges change or new pings log. |
| **Background Worker** | **Render (Node.js Service)** | Executes non-blocking API probes concurrently and calculates round-trip latency. |
| **Automation & Cron** | **GitHub Actions / Cron-Job.org** | Hits the Render worker every 5 minutes to maintain active execution without idle sleeping. |
| **Notification Engine** | **Resend API & Discord Webhooks** | Sends immediate email and chat alerts upon detected latency spikes or outages. |

---

## 3. Resume & CV Presentation

### Resume Bullet Points (Action + Tool + Outcome)

* **Developer Signal & Incident Tracker** | *Next.js, Supabase, Node.js, Render, PostgreSQL, Tailwind CSS*
  * Engineered an automated observability platform to monitor public API health across 20+ developer services, logging response times and uptime metrics at 5-minute intervals.
  * Built an asynchronous probe runner hosted on Render, triggered by scheduled cron pipelines to write structured time-series data into Supabase with Row-Level Security (RLS).
  * Implemented real-time dashboard visualizations using Next.js and Recharts, with automated Webhook and email alert triggers via Resend API during detected latency spikes or service outages.

### How to Talk About It in Interviews

* **The Problem:** "Developers constantly check individual status pages when APIs fail. I wanted a consolidated observability hub that actively measures round-trip API latencies rather than relying solely on manual status posts."
* **The Architecture:** "I decoupled the probe runner (Node.js on Render) from the frontend (Next.js). I configured a cron ping to keep the Render worker warm and execute concurrent HTTP health probes every 5 minutes, saving time-series logs directly into Supabase PostgreSQL."
* **The Scalability:** "By classifying status API providers into Standard Atlassian Statuspages, Instatus APIs, and RSS feeds, the background worker handles varied third-party payloads cleanly without hitting rate limits or requiring paid API keys."

---

## 4. System Architecture & Workflows

```text
                               ┌──────────────────────────────────────────┐
                               │             Cron Trigger                 │
                               │  (GitHub Actions / Cron-Job.org / Render) │
                               └────────────────────┬─────────────────────┘
                                                    │ Every 5 mins (HTTP POST / Probe)
                                                    ▼
┌─────────────────────────┐               ┌──────────────────────────────────────────┐
│   Monitored External    │               │            Render Worker API             │
│        APIs             │◄──────────────┤   (Node.js / Express or Serverless)      │
│(GitHub, OpenAI, Vercel) │ Response Time │  • Executes concurrent API health checks │
└─────────────────────────┘               │  • Detects outages & latency spikes      │
                                          └────────────────────┬─────────────────────┘
                                                               │ Inserts logs & triggers alerts
                                                               ▼
                                          ┌──────────────────────────────────────────┐
                                          │             Supabase Cloud               │
                                          │  • PostgreSQL DB (Logs, Monitors, Users) │
                                          │  • Auth & Row Level Security (RLS)       │
                                          │  • Realtime Engine (Websocket broadcast)  │
                                          └──────┬───────────────────────────┬───────┘
                                                 │                           │
                               Websocket Updates │                           │ Trigger Alert
                                                 ▼                           ▼
                               ┌───────────────────┐               ┌───────────────────┐
                               │  Next.js Frontend │               │ Email / Webhooks  │
                               │ (Vercel / Render) │               │ • Live Dashboard  │
                               │ • Live Dashboard  │               │ • Config Alerts   │
                               └───────────────────┘               └───────────────────┘
```

---

## 5. PostgreSQL Database Schema (Supabase)

```sql
-- 1. Monitors Table
CREATE TABLE public.monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    probe_type TEXT CHECK (probe_type IN ('statuspage', 'instatus', 'rss', 'direct_ping')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Time-Series Latency Logs Table
CREATE TABLE public.latency_logs (
    id BIGSERIAL PRIMARY KEY,
    monitor_id TEXT REFERENCES public.monitors(id) ON DELETE CASCADE,
    latency_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    is_up BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast time-series dashboard queries
CREATE INDEX idx_latency_logs_monitor_time ON public.latency_logs (monitor_id, created_at DESC);

-- 3. User Alerts Table
CREATE TABLE public.user_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    monitor_id TEXT REFERENCES public.monitors(id) ON DELETE CASCADE,
    alert_type TEXT CHECK (alert_type IN ('email', 'webhook')),
    destination TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latency_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to monitors" ON public.monitors FOR SELECT USING (true);
CREATE POLICY "Allow public read access to latency logs" ON public.latency_logs FOR SELECT USING (true);
CREATE POLICY "Users can manage their own alerts" ON public.user_alerts FOR ALL USING (auth.uid() = user_id);
```

---

## 6. Monitored Developer Services (Grouped Breakdown)

### Group 1: AI Models & Developer Productivity

| Service | Category | Status API Endpoint | Probe Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| **GitHub** | Code Hosting / CI/CD | `https://www.githubstatus.com/api/v2/summary.json` | `statuspage` | Version control, Actions, and GitHub Packages. |
| **OpenAI** | Generative AI | `https://status.openai.com/api/v2/summary.json` | `statuspage` | GPT-4o, ChatGPT, and API endpoints. |
| **Anthropic** | Generative AI | `https://status.anthropic.com/api/v2/summary.json` | `statuspage` | Claude 3.5 Sonnet, Claude API. |
| **Linear** | Issue Tracking | `https://status.linear.app/api/v2/summary.json` | `statuspage` | Issue tracking & project management. |
| **Postman** | API Tooling | `https://status.postman.com/api/v2/summary.json` | `statuspage` | API workspaces, mock servers, runner engine. |
| **NPM Registry** | Package Manager | `https://status.npmjs.org/api/v2/summary.json` | `statuspage` | Node package downloads and registry routing. |
| **Figma** | Design System | `https://status.figma.com/api/v2/summary.json` | `statuspage` | Canvas engine, developer mode, tokens API. |

### Group 2: Cloud Infrastructure & Hosting Platforms

| Service | Category | Status API Endpoint | Probe Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare** | CDN / DNS / Edge | `https://www.cloudflarestatus.com/api/v2/summary.json` | `statuspage` | Edge network, Worker execution, DNS routing. |
| **Vercel** | Serverless / Hosting | `https://www.vercel-status.com/api/v2/summary.json` | `statuspage` | Next.js deployments, Edge Functions. |
| **Render** | Cloud Platform | `https://status.render.com/api/v2/summary.json` | `statuspage` | Managed web services, background workers, databases. |
| **AWS** | Cloud Compute | `https://status.aws.amazon.com/rss/all.rss` | `rss` | EC2, S3, Lambda, and core region health. |
| **DigitalOcean** | Cloud Hosting | `https://status.digitalocean.com/api/v2/summary.json` | `statuspage` | Droplets, managed Kubernetes, App Platform. |
| **Docker** | Container Registry | `https://status.docker.com/summary.json` | `instatus` | Docker Hub image storage and auth services. |

### Group 3: Databases, Authentication & AI Vectors

| Service | Category | Status API Endpoint | Probe Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase** | BaaS / PostgreSQL | `https://status.supabase.com/api/v2/summary.json` | `statuspage` | Managed Postgres, Realtime WebSocket engine, Auth. |
| **Clerk** | Authentication | `https://status.clerk.com/api/v2/summary.json` | `statuspage` | User authentication, JWT issuance, session management. |
| **Upstash** | Serverless Redis | `https://status.upstash.com/api/v2/summary.json` | `statuspage` | Rate-limiting, caching, serverless queues. |
| **Pinecone** | Vector Database | `https://status.pinecone.io/api/v2/summary.json` | `statuspage` | Vector index retrieval and embedding lookup. |
| **MongoDB Atlas** | Cloud Database | `https://status.cloud.mongodb.com/api/v2/summary.json` | `statuspage` | Managed Document Database cluster services. |

### Group 4: Payments, Communications & Observability

| Service | Category | Status API Endpoint | Probe Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Stripe** | Payment Engine | `https://status.stripe.com/api/v2/summary.json` | `statuspage` | Payment gateway, checkout, webhooks. |
| **Resend** | Transactional Email | `https://status.resend.com/api/v2/summary.json` | `statuspage` | Email dispatch API, inbox deliverability. |
| **Twilio** | SMS & 2FA API | `https://status.twilio.com/api/v2/summary.json` | `statuspage` | Phone verification, SMS gateway. |
| **Sentry** | Error Tracking | `https://status.sentry.io/api/v2/summary.json` | `statuspage` | Application performance monitoring, crash reports. |
| **Datadog** | Enterprise Monitoring | `https://status.datadoghq.com/api/v2/summary.json` | `statuspage` | Metrics aggregation, log pipelines. |

---

## 7. Probe Implementation Logic

### Service Configuration File (`constants/monitors.ts`)

```typescript
export interface ServiceConfig {
  id: string;
  name: string;
  category: string;
  url: string;
  type: 'statuspage' | 'instatus' | 'rss' | 'direct_ping';
}

export const MONITORED_SERVICES: ServiceConfig[] = [
  { id: "github", name: "GitHub API", category: "AI & Dev Tools", url: "https://www.githubstatus.com/api/v2/summary.json", type: "statuspage" },
  { id: "openai", name: "OpenAI API", category: "AI & Dev Tools", url: "https://status.openai.com/api/v2/summary.json", type: "statuspage" },
  { id: "vercel", name: "Vercel Platform", category: "Cloud & Hosting", url: "https://www.vercel-status.com/api/v2/summary.json", type: "statuspage" },
  { id: "docker", name: "Docker Hub", category: "Cloud & Hosting", url: "https://status.docker.com/summary.json", type: "instatus" },
  { id: "aws", name: "AWS Cloud", category: "Cloud & Hosting", url: "https://status.aws.amazon.com/rss/all.rss", type: "rss" },
  { id: "supabase", name: "Supabase DB", category: "Databases & Auth", url: "https://status.supabase.com/api/v2/summary.json", type: "statuspage" }
];
```

### Node.js Probe Handler (`probeWorker.js`)

```javascript
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { MONITORED_SERVICES } from './monitors.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const rssParser = new Parser();

async function probeService(service) {
  const startTime = Date.now();
  
  try {
    if (service.type === 'rss') {
      const feed = await rssParser.parseURL(service.url);
      const latencyMs = Date.now() - startTime;
      const hasOutage = feed.items.some(item => 
        item.title?.includes('Service Degradation') || item.title?.includes('Informational message')
      );
      return { monitor_id: service.id, latency_ms: latencyMs, status_code: 200, is_up: !hasOutage };
    }

    const response = await fetch(service.url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    const latencyMs = Date.now() - startTime;
    let isUp = response.ok;

    if (service.type === 'statuspage') {
      const data = await response.json();
      isUp = data.status?.indicator === 'none';
    } else if (service.type === 'instatus') {
      const data = await response.json();
      isUp = data.page?.status === 'UP';
    } else if (service.type === 'direct_ping') {
      isUp = response.status < 500;
    }

    return { monitor_id: service.id, latency_ms: latencyMs, status_code: response.status, is_up: isUp };
  } catch (error) {
    return { monitor_id: service.id, latency_ms: Date.now() - startTime, status_code: 0, is_up: false };
  }
}

export async function runAllProbes() {
  console.log('Executing automated probes...');
  const results = await Promise.all(MONITORED_SERVICES.map(probeService));
  const { error } = await supabase.from('latency_logs').insert(results);
  if (error) console.error('Supabase write error:', error);
  else console.log(`Logged ${results.length} probe checks successfully.`);
}
```