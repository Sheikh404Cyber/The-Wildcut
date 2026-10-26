-- OPTIONAL demo news — run ONLY if you want two sample articles to test the
-- site right after deployment (homepage, article page, Facebook preview).
-- Delete them from the admin panel after testing. Do NOT run on a live site
-- that already has real news.

INSERT OR IGNORE INTO news
  (title, slug, excerpt, content, cover_image_url, category_id, author,
   source_name, source_url, seo_title, seo_description, featured, status, published_at)
VALUES
  ('সুন্দরবনে বাঘের সংখ্যা নিয়ে নতুন জরিপ শুরু',
   'sundarbans-tiger-survey-demo',
   'বন বিভাগের উদ্যোগে সুন্দরবনে ক্যামেরা ট্র্যাপিংয়ের মাধ্যমে বাঘ গণনার নতুন জরিপ শুরু হয়েছে। (এটি একটি নমুনা সংবাদ)',
   'বন বিভাগের উদ্যোগে সুন্দরবনে শুরু হয়েছে বাঘ গণনার নতুন জরিপ। ক্যামেরা ট্র্যাপিং পদ্ধতিতে বনের বিভিন্ন স্থানে বসানো হয়েছে স্বয়ংক্রিয় ক্যামেরা।

বিশেষজ্ঞরা বলছেন, এই জরিপের ফলাফল বাঘ সংরক্ষণে ভবিষ্যৎ পরিকল্পনা তৈরিতে গুরুত্বপূর্ণ ভূমিকা রাখবে।

(এটি একটি নমুনা সংবাদ — পরীক্ষার জন্য তৈরি। প্রকৃত সংবাদ প্রকাশের আগে অ্যাডমিন প্যানেল থেকে এটি মুছে ফেলুন।)',
   '',
   (SELECT id FROM categories WHERE slug = 'bangladesh'),
   'The Wildcut Desk', 'The Wildcut', '',
   'সুন্দরবনে বাঘের সংখ্যা নিয়ে নতুন জরিপ | The Wildcut',
   'সুন্দরবনে ক্যামেরা ট্র্যাপিংয়ের মাধ্যমে বাঘ গণনার নতুন জরিপ শুরু হয়েছে।',
   1, 'published', datetime('now')),

  ('আহত শকুন উদ্ধার করে চিকিৎসা দিলেন স্থানীয় তরুণরা',
   'injured-vulture-rescue-demo',
   'গ্রামের পাশের মাঠে পড়ে থাকা আহত একটি শকুন উদ্ধার করে প্রাথমিক চিকিৎসা দিয়েছেন স্থানীয় তরুণরা। (এটি একটি নমুনা সংবাদ)',
   'গ্রামের পাশের মাঠে আহত অবস্থায় পড়ে ছিল একটি শকুন। স্থানীয় তরুণরা পাখিটিকে উদ্ধার করে বন বিভাগের সঙ্গে যোগাযোগ করেন।

প্রাথমিক চিকিৎসার পর শকুনটিকে বন্যপ্রাণী পুনর্বাসন কেন্দ্রে পাঠানো হয়েছে। সুস্থ হলে এটিকে আবার প্রকৃতিতে ছেড়ে দেওয়া হবে।

(এটি একটি নমুনা সংবাদ — পরীক্ষার জন্য তৈরি। প্রকৃত সংবাদ প্রকাশের আগে অ্যাডমিন প্যানেল থেকে এটি মুছে ফেলুন।)',
   '',
   (SELECT id FROM categories WHERE slug = 'wildlife-rescue'),
   'The Wildcut Desk', 'The Wildcut', '',
   'আহত শকুন উদ্ধার | The Wildcut',
   'আহত শকুন উদ্ধার করে চিকিৎসা দিলেন স্থানীয় তরুণরা।',
   0, 'published', datetime('now', '-1 hour'));
