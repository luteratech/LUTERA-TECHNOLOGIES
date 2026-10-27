# Search engine ownership and indexing

## Indexing review — 27 October 2026

The owner supplied five Search Console example URLs. Live checks confirm:

| URL | Current behaviour | Expected handling |
| --- | --- | --- |
| `http://luteratech.com/` | Permanent 308 to HTTPS | Index the HTTPS destination, not the redirect. |
| `http://www.luteratech.com/` | Permanent 308 to HTTPS, then primary domain | Index `https://luteratech.com/`. |
| `/request-quote/?category=software` | 200 with canonical `/request-quote/` | Keep the preselected form working; consolidate indexing with the main quote page. |
| `/request-quote/?category=consulting` | 200 with canonical `/request-quote/` | Same intentional consolidation. |
| `/services/` | 200, self-canonical, index/follow, linked and in sitemap | Eligible for indexing; Google chooses whether and when to include it. |

The service directory now includes a visible project/service selection guide and
a service ItemList linked to its CollectionPage structured data. These improve
the page's usefulness and description; they do not guarantee indexing or a rich
result. All service names and URLs in the structured list come from the current
public catalogue. Existing quote-query behaviour and private workspace noindex
remain unchanged.

After the update is live, inspect **https://luteratech.com/services/** in Search
Console, select **Test live URL**, check that indexing is allowed and the rendered
page is available, then select **Request indexing** if offered. Compare the
user-declared and Google-selected canonical in the indexed report. Keep
**https://luteratech.com/sitemap.xml** submitted. No repeated requests or redirect
removals are needed; do not request indexing for the four duplicate/redirect URLs.
The private workspace must remain excluded. Search Console report updates can lag
behind the live page and no ranking/indexing date is promised.

## Ownership and submission

Vercel is the website host. The approved primary address is
**https://luteratech.com/**. Use this domain for ownership and sitemap submission.
GitHub Pages addresses are no longer hosting targets.
The owner has reported completing Google Search Console and Bing Webmaster setup.
Those confirmations complete the ownership follow-up; this repository does not
have access to their private indexing or search-performance reports. Keep the
existing DNS verification records and submit the sitemap after relevant changes.

## Google Search Console

1. Sign in at [Google Search Console](https://search.google.com/search-console/).
2. Add a **Domain** property for `luteratech.com` and follow Google's TXT-record
   verification instructions in Cloudflare DNS. Use Google's exact generated
   value; keep the record after verification. Alternatively, add the
   **URL-prefix** property `https://luteratech.com/` and use the HTML-tag steps below.
3. Choose **HTML tag** and copy the `content` value of the
   `google-site-verification` meta tag.
4. In **Vercel → Project → Settings → Environment Variables**, add the public value
   as `GOOGLE_SITE_VERIFICATION` for Production. Redeploy, check the homepage tag,
   then click **Verify** in Search Console. Setting GitHub Actions variables alone
   does not update the Vercel-hosted website.
5. Submit `https://luteratech.com/sitemap.xml` in **Sitemaps**.
6. Use **URL Inspection** for the homepage and service pages. Request indexing
   where available, and review the Pages and Performance reports over time.

Keep the ownership tag after verification. The site does not need Analytics or
advertising scripts to verify ownership. No Google account or verified property
is created by the code itself.

## Bing Webmaster Tools

1. Sign in at [Bing Webmaster Tools](https://www.bing.com/webmasters/).
2. Add the same production URL. Use a Search Console import if offered, or choose
   Bing's HTML meta-tag verification.
3. For the tag method, set its public `content` value as `BING_SITE_VERIFICATION`
   in the Vercel project's Production environment, redeploy and complete verification.
4. Submit the production `/sitemap.xml` and review crawl/indexing reports.

## IndexNow notifications

The Vercel build includes `indexnow.txt` and a production sitemap. GitHub Actions
validates a notification payload but does not send it or publish the site.
Vercel builds also do not send notifications before a deployment is available.

After a successful production deployment, an operator can build an artifact for
that exact live origin and run:

```sh
python scripts/build_vercel.py
python scripts/review_live.py
python scripts/submit_indexnow.py --submit
```

The notifier reads `_site` by default. `SITE_OUTPUT_DIR` can select another built
public artifact. It verifies the deployed public validation token before sending
only that artifact's sitemap URLs. The token is not an account credential.
Do not notify engines about fixture origins or preview builds.

HTTP 200 means the notification was received; HTTP 202 means key validation is
pending. Neither proves crawling, indexing or ranking. Search Console verification
and sitemap submission remain separate owner actions.

## robots.txt and domain cutover

The Vercel artifact serves `/robots.txt` and `/sitemap.xml` from the hostname root.
Production has 17 indexable URLs; confirmation/error pages are excluded. Preview
pages are noindex, their sitemap is empty and robots does not advertise it.

The production origin is committed in `content/site.json`; `SITE_ORIGIN` is an
explicit override. The Vercel deployment must publish the final-domain artifact
before submitting it to search engines. The live review checks canonical/social/
schema URLs and alias redirects. Only notify IndexNow after the complete review
passes, so engines receive the intended live URLs rather than a preview or an
old sitemap.

Keep the company name, Abuja address and contacts consistent in accurate business
listings. Publish useful service information and genuine project material.
Search engines control indexing and ranking; Lighthouse scores do not guarantee placement.

Sources: [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [ownership verification](https://support.google.com/webmasters/answer/9008080), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [robots.txt guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [IndexNow protocol](https://www.indexnow.org/documentation).
