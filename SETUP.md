# Job Tracker — Setup Guide

## What you have
A React web app that:
- Uploads your `Opportunities7.xlsx` from your computer
- Lets you view, search, filter, sort, add, and edit applications
- Adds Interview Date, Offer Date, and Status fields
- Exports the updated file back to Excel (replace your OneDrive copy)

Works on any browser on any device. No login required.

---

## Step 1 — Install Node.js (one time only)
1. Go to https://nodejs.org
2. Download and install the **LTS** version
3. Restart your computer after installing

---

## Step 2 — Upload files to GitHub

You have two options:

### Option A — GitHub Desktop (easiest, no command line)
1. Download GitHub Desktop from https://desktop.github.com
2. Sign in with your GitHub account (fwittenauer)
3. Click **File → Add local repository** → point it to the `job-tracker` folder
   - If it says "not a git repo", click **Create a Repository** instead
4. Make sure the repository name is `job-tracker`
5. Click **Publish repository** → uncheck "Keep this code private" → Publish
6. GitHub will push all files automatically

### Option B — Command line
Open Terminal (Mac) or Command Prompt (Windows) in the `job-tracker` folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/fwittenauer/job-tracker.git
git push -u origin main
```

---

## Step 3 — Enable GitHub Pages

1. Go to https://github.com/fwittenauer/job-tracker
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under **Source**, select **Deploy from a branch**
5. Under **Branch**, select **gh-pages** and click **Save**

GitHub will automatically build and deploy your app within 2–3 minutes.

---

## Step 4 — Open your app

Your app will be live at:
**https://fwittenauer.github.io/job-tracker/**

Bookmark this URL. Open it on any browser, any computer.

---

## How to use it day-to-day

1. Open https://fwittenauer.github.io/job-tracker/
2. Click the upload zone and select your `Opportunities7.xlsx` from OneDrive
3. Add entries, edit existing ones
4. When done, click **Export to Excel** — this downloads the updated file
5. Replace your OneDrive copy with the downloaded file

---

## How to update the app later

If you want to make changes to the app, edit the files in the `job-tracker` folder, then push to GitHub again (via GitHub Desktop or command line). The site rebuilds automatically in ~2 minutes.

---

## Fields in the app

| Field | Description |
|---|---|
| Organization | Company name |
| Role | Job title |
| Location | City, Remote, etc. |
| ATS | Applicant tracking system used |
| Status | Applied / Screening / Interviewing / Offer / etc. |
| Date Applied | When you submitted |
| Screen Date | Phone screen date |
| Interview Date | ⭐ New field |
| Offer Date | ⭐ New field |
| Date "No" Received | Rejection date |
| Contacts | Recruiter info |
| Next Steps | Notes on next action |
| Notes / URL | ATS link, notes |
| Flags | LinkedIn ON/OFF, Indeed ON, Street Address Required |
