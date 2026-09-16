/**
 * GigNest - find and post local and remote gigs, matched by skill
 * ------------------------------------------------------------------
 * Zero-dependency Node.js server. No npm install needed.
 * Start with:  node server.js
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const CATEGORIES = ['design', 'writing', 'tutoring', 'delivery_errands', 'tech_support', 'events_help', 'other'];
const COMMISSION_RATE = 0.12; // GigNest keeps 12% of each completed gig

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

let db = null;

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function seedData() {
  const gigs = [
    {
      id: randomUUID(), posterName: 'Mei Ling', postedByMe: false, category: 'design',
      title: 'Logo for a new bubble tea stall', description: 'Need a clean, simple logo for a new stall opening in Petaling Jaya. Flat design, 2-3 colours.',
      skillsRequired: ['logo design', 'illustrator', 'branding'], budgetRM: 150, remote: true, location: 'Remote',
      status: 'open', createdAt: hoursAgo(6),
    },
    {
      id: randomUUID(), posterName: 'Arif Hakim', postedByMe: false, category: 'tutoring',
      title: 'SPM Add Maths tuition, 2x a week', description: 'Looking for a patient tutor for my younger brother, form 5, weak in calculus and statistics.',
      skillsRequired: ['mathematics', 'tutoring', 'spm'], budgetRM: 60, remote: false, location: 'Subang Jaya',
      status: 'open', createdAt: hoursAgo(14),
    },
    {
      id: randomUUID(), posterName: 'Chong Wei Ling', postedByMe: false, category: 'tech_support',
      title: 'Fix slow WordPress site', description: 'My small business site takes 8+ seconds to load. Need someone to optimise it.',
      skillsRequired: ['wordpress', 'web performance', 'php'], budgetRM: 220, remote: true, location: 'Remote',
      status: 'open', createdAt: hoursAgo(20),
    },
    {
      id: randomUUID(), posterName: 'Nurul Izzah', postedByMe: false, category: 'writing',
      title: 'Product descriptions for 30 Shopee listings', description: 'Need short, punchy descriptions for handmade candles. Bahasa Malaysia and English both needed.',
      skillsRequired: ['copywriting', 'bahasa malaysia', 'e-commerce'], budgetRM: 180, remote: true, location: 'Remote',
      status: 'open', createdAt: hoursAgo(28),
    },
    {
      id: randomUUID(), posterName: 'Ravi Kumar', postedByMe: false, category: 'events_help',
      title: 'Help needed for a birthday event setup', description: 'Half-day, setting up decorations and tables at a hall in Cheras this Saturday.',
      skillsRequired: ['event setup', 'physical work'], budgetRM: 90, remote: false, location: 'Cheras',
      status: 'open', createdAt: hoursAgo(30),
    },
    {
      id: randomUUID(), posterName: 'Siti Fatimah', postedByMe: false, category: 'delivery_errands',
      title: 'Weekly grocery run for elderly parent', description: 'Every Sunday morning, pick up a grocery list and deliver to my mother in Ampang.',
      skillsRequired: ['reliable', 'own transport'], budgetRM: 40, remote: false, location: 'Ampang',
      status: 'open', createdAt: hoursAgo(40),
    },
    {
      id: randomUUID(), posterName: 'You', postedByMe: true, category: 'design',
      title: 'Instagram carousel templates for a cafe', description: 'Need 5 reusable carousel templates, Canva friendly, matching a warm colour palette.',
      skillsRequired: ['canva', 'social media design'], budgetRM: 120, remote: true, location: 'Remote',
      status: 'in_progress', createdAt: hoursAgo(50),
    },
    {
      id: randomUUID(), posterName: 'You', postedByMe: true, category: 'writing',
      title: 'Proofread a 4,000 word report', description: 'Final year project report, needs a careful grammar and clarity pass before submission.',
      skillsRequired: ['proofreading', 'academic writing'], budgetRM: 70, remote: true, location: 'Remote',
      status: 'completed', createdAt: hoursAgo(90),
    },
  ];

  const gigByTitle = (t) => gigs.find((g) => g.title === t);

  const applications = [
    {
      id: randomUUID(), gigId: gigByTitle('Instagram carousel templates for a cafe').id,
      applicantName: 'Farah Adilah', byMe: false, message: 'I design social templates for 3 local cafes already, happy to share samples.',
      status: 'accepted', at: hoursAgo(45),
    },
    {
      id: randomUUID(), gigId: gigByTitle('Proofread a 4,000 word report').id,
      applicantName: 'Daniel Wong', byMe: false, message: 'English lit graduate, proofread 20+ FYP reports before.',
      status: 'accepted', at: hoursAgo(85),
    },
    {
      id: randomUUID(), gigId: gigByTitle('Logo for a new bubble tea stall').id,
      applicantName: 'You', byMe: true, message: 'I have done branding for 4 F&B stalls in the Klang Valley, portfolio attached.',
      status: 'pending', at: hoursAgo(3),
    },
  ];

  const transactions = [
    {
      id: randomUUID(), gigId: gigByTitle('Proofread a 4,000 word report').id,
      amountRM: 70, commissionRM: Math.round(70 * COMMISSION_RATE * 100) / 100,
      payoutRM: Math.round(70 * (1 - COMMISSION_RATE) * 100) / 100,
      direction: 'paid', counterparty: 'Daniel Wong', at: hoursAgo(80),
    },
  ];

  return {
    me: {
      name: 'You',
      bio: 'Design and writing side hustle alongside university.',
      skills: ['canva', 'social media design', 'copywriting', 'logo design', 'proofreading'],
      createdAt: hoursAgo(200),
    },
    gigs,
    applications,
    transactions,
  };
}

function loadDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (parsed && parsed.me && Array.isArray(parsed.gigs)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read saved data, starting fresh:', err.message);
  }
  const fresh = seedData();
  saveDb(fresh);
  return fresh;
}

function saveDb(next) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(next, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Could not save data:', err.message);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Matching + search "engine"                                         */
/* ------------------------------------------------------------------ */

function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

/**
 * Simple, transparent skill-match score: how much overlap between
 * what a gig needs and what "me" already lists as a skill.
 * This is real matching logic, not a black box - it is easy to explain
 * to a user ("matched on: copywriting, e-commerce").
 */
function matchScore(gig, mySkills) {
  const mine = mySkills.map(normalize);
  const required = gig.skillsRequired.map(normalize);
  if (!required.length) return { score: 0, matched: [] };

  const matched = required.filter((r) => mine.some((m) => m.includes(r) || r.includes(m)));
  const score = Math.round((matched.length / required.length) * 100);
  return { score, matched };
}

function searchGigs(query, category, remoteOnly) {
  const q = normalize(query);
  return db.gigs.filter((g) => {
    if (category && g.category !== category) return false;
    if (remoteOnly && !g.remote) return false;
    if (!q) return true;
    const haystack = normalize(g.title + ' ' + g.description + ' ' + g.skillsRequired.join(' ') + ' ' + g.location);
    return q.split(/\s+/).every((word) => haystack.includes(word));
  });
}

/* ------------------------------------------------------------------ */
/*  Stats                                                               */
/* ------------------------------------------------------------------ */

function computeStats() {
  const myPosted = db.gigs.filter((g) => g.postedByMe);
  const myApplications = db.applications.filter((a) => a.byMe);
  const earned = db.transactions.filter((t) => t.direction === 'received').reduce((s, t) => s + t.payoutRM, 0);
  const paid = db.transactions.filter((t) => t.direction === 'paid').reduce((s, t) => s + t.amountRM, 0);
  const commissionPaid = db.transactions.reduce((s, t) => s + t.commissionRM, 0);

  return {
    openGigsAvailable: db.gigs.filter((g) => !g.postedByMe && g.status === 'open').length,
    myActivePosts: myPosted.filter((g) => g.status !== 'completed').length,
    myCompletedPosts: myPosted.filter((g) => g.status === 'completed').length,
    myPendingApplications: myApplications.filter((a) => a.status === 'pending').length,
    myAcceptedApplications: myApplications.filter((a) => a.status === 'accepted').length,
    totalEarnedRM: Math.round(earned * 100) / 100,
    totalPaidRM: Math.round(paid * 100) / 100,
    totalCommissionRM: Math.round(commissionPaid * 100) / 100,
    commissionRate: COMMISSION_RATE,
  };
}

/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, rel);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Page not found. Open http://localhost:' + PORT + ' instead.');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });
}

/* ------------------------------------------------------------------ */
/*  Validation                                                          */
/* ------------------------------------------------------------------ */

function validateGig(body) {
  const errors = [];
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || '');
  const budgetRM = Number(body.budgetRM);
  const remote = Boolean(body.remote);
  const location = String(body.location || '').trim();
  const skillsRequired = Array.isArray(body.skillsRequired)
    ? body.skillsRequired.map((s) => String(s).trim()).filter(Boolean)
    : [];

  if (title.length < 4) errors.push('Give the gig a clear title, at least 4 characters.');
  if (description.length < 10) errors.push('Describe the gig in a bit more detail.');
  if (!CATEGORIES.includes(category)) errors.push('Choose a category.');
  if (!Number.isFinite(budgetRM) || budgetRM <= 0) errors.push('Enter a budget in RM, greater than 0.');
  if (!remote && location.length < 2) errors.push('Enter a location, or mark this gig as remote.');
  if (!skillsRequired.length) errors.push('List at least one skill needed for this gig.');

  return {
    errors,
    value: { title, description, category, budgetRM, remote, location: remote ? 'Remote' : location, skillsRequired },
  };
}

/* ------------------------------------------------------------------ */
/*  API routes                                                          */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, pathname, query) {
  const method = req.method;

  if (pathname === '/api/overview' && method === 'GET') {
    return sendJson(res, 200, { me: db.me, stats: computeStats() });
  }

  if (pathname === '/api/profile' && method === 'PUT') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const bio = String(body.bio || '').trim();
    const skills = Array.isArray(body.skills) ? body.skills.map((s) => String(s).trim()).filter(Boolean) : [];

    if (name.length < 2) return sendJson(res, 400, { errors: ['Enter your name.'] });
    if (!skills.length) return sendJson(res, 400, { errors: ['List at least one skill so matching works.'] });

    db.me.name = name;
    db.me.bio = bio;
    db.me.skills = skills;
    saveDb(db);
    return sendJson(res, 200, db.me);
  }

  /* --- Browse / search gigs, with match score --- */
  if (pathname === '/api/gigs' && method === 'GET') {
    const results = searchGigs(query.get('q'), query.get('category'), query.get('remote') === '1')
      .filter((g) => !g.postedByMe && g.status === 'open')
      .map((g) => {
        const { score, matched } = matchScore(g, db.me.skills);
        return { ...g, matchScore: score, matchedSkills: matched };
      })
      .sort((a, b) => b.matchScore - a.matchScore || b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, results);
  }

  /* --- My posted gigs --- */
  if (pathname === '/api/my-gigs' && method === 'GET') {
    const mine = db.gigs
      .filter((g) => g.postedByMe)
      .map((g) => ({
        ...g,
        applications: db.applications.filter((a) => a.gigId === g.id),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, mine);
  }

  if (pathname === '/api/gigs' && method === 'POST') {
    const body = await readBody(req);
    const { errors, value } = validateGig(body);
    if (errors.length) return sendJson(res, 400, { errors });

    const gig = {
      id: randomUUID(),
      posterName: db.me.name,
      postedByMe: true,
      status: 'open',
      createdAt: new Date().toISOString(),
      ...value,
    };
    db.gigs.push(gig);
    saveDb(db);
    return sendJson(res, 201, gig);
  }

  const gigDeleteMatch = pathname.match(/^\/api\/gigs\/([\w-]+)$/);
  if (gigDeleteMatch && method === 'DELETE') {
    const id = gigDeleteMatch[1];
    const gig = db.gigs.find((g) => g.id === id);
    if (!gig || !gig.postedByMe) return sendJson(res, 404, { errors: ['That gig cannot be removed.'] });

    db.gigs = db.gigs.filter((g) => g.id !== id);
    db.applications = db.applications.filter((a) => a.gigId !== id);
    saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  /* --- My applications (gigs I applied to) --- */
  if (pathname === '/api/my-applications' && method === 'GET') {
    const mine = db.applications
      .filter((a) => a.byMe)
      .map((a) => ({ ...a, gig: db.gigs.find((g) => g.id === a.gigId) || null }))
      .sort((a, b) => b.at.localeCompare(a.at));
    return sendJson(res, 200, mine);
  }

  if (pathname === '/api/applications' && method === 'POST') {
    const body = await readBody(req);
    const gigId = String(body.gigId || '');
    const message = String(body.message || '').trim();

    const gig = db.gigs.find((g) => g.id === gigId);
    if (!gig) return sendJson(res, 404, { errors: ['That gig no longer exists.'] });
    if (gig.postedByMe) return sendJson(res, 400, { errors: ['You cannot apply to your own gig.'] });
    if (message.length < 5) return sendJson(res, 400, { errors: ['Write a short message about why you are a good fit.'] });

    const already = db.applications.find((a) => a.gigId === gigId && a.byMe);
    if (already) return sendJson(res, 400, { errors: ['You already applied to this gig.'] });

    const application = {
      id: randomUUID(), gigId, applicantName: db.me.name, byMe: true,
      message, status: 'pending', at: new Date().toISOString(),
    };
    db.applications.push(application);
    saveDb(db);
    return sendJson(res, 201, application);
  }

  /* --- Client reviewing applicants on their own gig --- */
  const appStatusMatch = pathname.match(/^\/api\/applications\/([\w-]+)\/status$/);
  if (appStatusMatch && method === 'PUT') {
    const body = await readBody(req);
    const application = db.applications.find((a) => a.id === appStatusMatch[1]);
    if (!application) return sendJson(res, 404, { errors: ['That application no longer exists.'] });

    const gig = db.gigs.find((g) => g.id === application.gigId);
    if (!gig || !gig.postedByMe) return sendJson(res, 403, { errors: ['You can only manage applications on your own gigs.'] });
    if (!['accepted', 'rejected'].includes(body.status)) return sendJson(res, 400, { errors: ['Choose a valid decision.'] });

    application.status = body.status;
    if (body.status === 'accepted') {
      gig.status = 'in_progress';
      db.applications
        .filter((a) => a.gigId === gig.id && a.id !== application.id)
        .forEach((a) => (a.status = 'rejected'));
    }
    saveDb(db);
    return sendJson(res, 200, application);
  }

  /* --- Mark a gig complete + simulate the payment / commission split --- */
  const completeMatch = pathname.match(/^\/api\/gigs\/([\w-]+)\/complete$/);
  if (completeMatch && method === 'POST') {
    const gig = db.gigs.find((g) => g.id === completeMatch[1]);
    if (!gig) return sendJson(res, 404, { errors: ['That gig no longer exists.'] });
    if (!gig.postedByMe) return sendJson(res, 403, { errors: ['Only the gig poster can mark it complete and release payment.'] });
    if (gig.status !== 'in_progress') return sendJson(res, 400, { errors: ['This gig has no accepted worker yet.'] });

    const accepted = db.applications.find((a) => a.gigId === gig.id && a.status === 'accepted');
    gig.status = 'completed';

    const commissionRM = Math.round(gig.budgetRM * COMMISSION_RATE * 100) / 100;
    const payoutRM = Math.round((gig.budgetRM - commissionRM) * 100) / 100;

    db.transactions.push({
      id: randomUUID(), gigId: gig.id, amountRM: gig.budgetRM, commissionRM, payoutRM,
      direction: 'paid', counterparty: accepted ? accepted.applicantName : 'worker',
      at: new Date().toISOString(),
    });
    saveDb(db);
    return sendJson(res, 200, { gig, commissionRM, payoutRM });
  }

  /* --- Transactions / earnings history --- */
  if (pathname === '/api/transactions' && method === 'GET') {
    const items = db.transactions.slice().sort((a, b) => b.at.localeCompare(a.at));
    return sendJson(res, 200, items);
  }

  if (pathname === '/api/reset' && method === 'POST') {
    db = seedData();
    saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { errors: ['That endpoint does not exist.'] });
}

/* ------------------------------------------------------------------ */
/*  Server                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, url.searchParams);
    } else {
      serveStatic(req, res);
    }
  } catch (err) {
    console.error('Request failed:', err.message);
    if (!res.headersSent) sendJson(res, 400, { errors: [err.message || 'Something went wrong. Try again.'] });
  }
});

db = loadDb();

server.listen(PORT, () => {
  console.log('');
  console.log('  GigNest is running');
  console.log('  Open  ->  http://localhost:' + PORT);
  console.log('  Stop  ->  Ctrl + C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' is already in use.');
    console.error('  Close the other program, or run:  PORT=3001 node server.js\n');
  } else {
    console.error('\n  Server error:', err.message, '\n');
  }
  process.exit(1);
});
