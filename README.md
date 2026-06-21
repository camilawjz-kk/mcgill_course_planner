# Semester Balance Checker

A mobile-friendly static website for McGill students. Search real McGill courses, add any number of courses to a wishlist, and generate a Fall/Winter/Summer year plan using course availability, credits, prerequisites, labs, and student difficulty data.

## Features

- Searchable local McGill course dataset
- Student difficulty ratings when available
- Estimated difficulty fallback for unrated courses
- Subject, term, and student-rated filters
- Unlimited course wishlist
- Fall/Winter/Summer year planner
- Prerequisite and placement warnings
- Semester load labels: light, balanced, heavy, risky

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

Build the static website:

```bash
pnpm site
```

The static website is generated in `out/`.

## Data

The website uses a local JSON file at `data/courses.json`. The current dataset was generated from public `mcgill.courses` seed data and transformed into a smaller website-ready format.

Source project: https://github.com/mcgill-courses/mcgill.courses

This project is not affiliated with McGill University or mcgill.courses.

## Regenerating Course Data

The helper script is kept at `work/build-mcgill-courses.mjs`. It expects these files locally:

- `work/mcgill-data/courses-2026-2027.json`
- `work/mcgill-data/reviews.json`
- `work/mcgill-data/course-averages.json`

Then run:

```bash
node work/build-mcgill-courses.mjs
```

## Deploying

### GitHub Pages

1. Push this project to GitHub.
2. Run `pnpm site`.
3. Publish the generated `out/` folder with GitHub Pages or a GitHub Actions Pages workflow.

### Vercel

You can also import the GitHub repo into Vercel and deploy with the default Next.js settings.
