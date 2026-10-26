# The Wildcut — Voice of the Wild

বন্যপ্রাণী ও সংরক্ষণবিষয়ক সংবাদ ওয়েবসাইট। সম্পূর্ণ ফ্রি স্ট্যাকে চলে:
**Cloudflare Pages + Pages Functions + D1 (database) + R2 (ছবি)** — কোনো বিল্ড ধাপ
নেই, plain HTML/CSS/JS। GitHub-এ আপলোড করে Cloudflare Pages-এ কানেক্ট করলেই লাইভ।

**Facebook:** https://www.facebook.com/thewildcutbd

## যা যা আছে

- পাবলিক হোমপেজ (Featured + সর্বশেষ + ক্যাটাগরি অনুযায়ী খবর, Load More)
- প্রতিটি খবরের স্থায়ী লিংক `/news/<slug>` — Facebook preview (Open Graph) সহ
  সার্ভার থেকে তৈরি পেজ, তাই FB কমেন্টে লিংক দিলে সঠিক শিরোনাম/ছবি/বিবরণ দেখায়
- ৬টি ক্যাটাগরি (অ্যাডমিন থেকে যোগ/বদল/মুছা যায়)
- নিরাপদ অ্যাডমিন প্যানেল `/admin` — PBKDF2 হ্যাশ পাসওয়ার্ড, session, login
  rate-limit, role ভিত্তিক অ্যাক্সেস (owner / admin / editor), একাধিক ব্যবহারকারী
- খবর Create/Edit/Delete, Draft/Publish/Unpublish, ছবি আপলোড (R2), SEO fields
- sitemap.xml, robots.txt, Bangla ফন্ট ও Bangla তারিখ

## কোথা থেকে শুরু করবেন

1. **`DEPLOYMENT_GUIDE_BN.md`** — ধাপে ধাপে বাংলায় পুরো সেটআপ (আগে এটা পড়ুন)
2. **`ARCHITECTURE.md`** — সিস্টেম ডিজাইন ও ফাইল স্ট্রাকচার
3. **`TESTING_CHECKLIST.md`** — কী পরীক্ষা করা হয়েছে, লাইভে কী পরীক্ষা করবেন

## জরুরি নোট (R2 সম্পর্কে)

ছবি আপলোডের জন্য Cloudflare R2 লাগে। R2-এর ফ্রি সীমা (10 GB) ব্যবহারে কোনো
টাকা কাটে না, তবে Cloudflare সাধারণত R2 চালু করার সময় একটি payment method
(card/PayPal) যোগ করতে বলে। কার্ড না দিলে সাইটের বাকি সবকিছু চলবে — শুধু
অ্যাডমিন প্যানেল থেকে ছবি আপলোড হবে না; তখন ছবির বাইরের লিংক (URL) বসিয়ে
কাজ চালানো যাবে। বিস্তারিত গাইডে আছে।

## লোকাল ডেভেলপমেন্ট (ঐচ্ছিক, কম্পিউটারে)

```bash
npm install -g wrangler
wrangler d1 execute wildcut-db --local --file=schema.sql
wrangler pages dev public --d1 DB --r2 MEDIA
```

## লাইসেন্স / ক্রেডিট

© 2026–2031 The Wildcut. All rights reserved.
Developed by **AMIN SHEIKH**
