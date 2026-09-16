# GigNest

**Find and post local or remote gigs, matched to your skills — with commission handling built in.**

Built for young adults, remote workers, and part-time workers who want quick, flexible gigs without wading through a global marketplace built for full-time freelance careers.

---

## Run it

You need [Node.js](https://nodejs.org) 18 or newer. **No dependencies to install.**

```bash
node server.js
```

Open **http://localhost:3000**. Stop with `Ctrl + C`.

### In VS Code
1. `File → Open Folder` → select `gignest`
2. `Terminal → New Terminal`
3. Type `node server.js`, press Enter
4. Ctrl/Cmd-click the localhost link

`F5` also works — a launch config is included. If port 3000 is busy: `PORT=3001 node server.js`.

---

## What's actually inside

```
gignest/
├── server.js          API, search, and skill-matching logic (no dependencies)
├── package.json
├── data/db.json        Your data, saved automatically
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

The app is seeded with sample gigs and one demo profile ("You") so it feels alive immediately. **Reset demo data** in the sidebar restores it any time.

---

## Honest scope — what this is and isn't

**Cross-platform:** this is a responsive website. It works on any OS — Windows, Mac, Linux, phones, tablets — through a browser. That's genuinely "all OS" with zero extra work. It is *not* a native App Store / Play Store app; that's a separate, much larger project (different tech stack, app store review, native builds) if you want it later.

**The "matching" is real, not decorative.** Every gig shows a transparent skill-match percentage, calculated by comparing the gig's required skills against your profile's skills (`matchScore()` in `server.js`). Gigs you're best suited for sort to the top automatically. It's simple on purpose — you can explain exactly why a gig scored 80% to anyone, which matters more for trust than a black-box model would.

**Payments are simulated, not real.** When you mark a gig complete, the app calculates and records the 12% commission split exactly as it would in production — but no real money moves. To take real payments you need a licensed payment gateway. In Malaysia: **Billplz** or **ToyyibPay** are common, simpler choices; **Stripe** if you want to support other countries too. The commission math already lives in `server.js` (`/api/gigs/:id/complete`) — swap the simulated transaction record for a real payout API call there.

---

## How the whole system works

**Frontend:** plain HTML, CSS, and JavaScript — no framework, no build step, no compiling. Renders instantly, easy to read and modify.

**Backend:** a single Node.js file (`server.js`) using only Node's built-in `http` module — no Express, no npm packages at all. It handles routing, search, matching, and validation by hand, which keeps it dependency-free and easy to audit.

**Database:** a plain JSON file (`data/db.json`) for this demo. It's enough for one person testing the whole flow. Before real users touch it, this needs to move to a real database — PostgreSQL or MongoDB — because a JSON file can't safely handle multiple people writing at once.

**Search:** a real keyword search across gig titles, descriptions, skills, and locations (see `searchGigs()` in `server.js`), combined with category and remote-only filters. No external search service needed at this scale.

**"AI" matching:** a transparent skill-overlap scoring function, not a paid AI API. It's genuinely useful and costs nothing to run. If you later want smarter matching (understanding "Photoshop" and "Adobe Photoshop" are the same skill, for example), that's where a real AI/embeddings API would plug in — but it's an upgrade, not a requirement to launch.

---

## The business model, concretely

GigNest takes a **12% commission** only when a gig is completed and paid — never upfront, never just for browsing or posting. This is set in one place: the `COMMISSION_RATE` constant at the top of `server.js`.

Example: a RM100 gig → worker receives RM88, GigNest keeps RM12.

This only works once real payments flow *through* the app instead of being arranged off-platform (cash, bank transfer, WhatsApp) — the biggest real risk for any commission-based marketplace, addressed in "Where to take it next" below.

---

## Where to take it next, in order of value

1. **Real accounts and login** — right now everyone shares one demo profile ("You"). Real multi-user accounts (email/phone + password, or a proper auth provider) are the first thing needed before anyone but you can use it.
2. **Real payment gateway** — Billplz/ToyyibPay/Stripe integration so commission is actually collected, not simulated.
3. **A real database** — PostgreSQL or MongoDB, so multiple people can safely use the app at once.
4. **Trust and safety** — ratings/reviews after a completed gig, ID verification for higher-value gigs, a dispute process for unpaid or unfinished work.
5. **Notifications** — email or WhatsApp alerts when someone applies to your gig or your application gets accepted, so people don't have to keep checking the site.
6. **Mobile app** — once the website has real users, a native app (or a simple wrapped version) makes it easier to use on the go.

MIT licensed.

hello