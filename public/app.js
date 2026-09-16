(function () {
  'use strict';

  var state = {
    me: null,
    stats: null,
    view: 'browse',
    browseGigs: [],
    myGigs: [],
    myApplications: [],
    transactions: [],
    searchQuery: '',
    categoryFilter: '',
    remoteOnly: false,
  };

  var CATEGORY_LABEL = {
    design: 'Design', writing: 'Writing', tutoring: 'Tutoring',
    delivery_errands: 'Delivery / errands', tech_support: 'Tech support',
    events_help: 'Events help', other: 'Other',
  };

  var VIEW_COPY = {
    browse: { title: 'Browse gigs', sub: 'Sorted by how well they match your skills' },
    post: { title: 'Post a gig', sub: 'Reach workers matched to what you need' },
    mygigs: { title: 'My posted gigs', sub: 'Review applicants and release payment when work is done' },
    applications: { title: 'My applications', sub: 'Gigs you have applied to, and their status' },
    earnings: { title: 'Earnings', sub: 'Everything paid and earned through GigNest' },
    profile: { title: 'Profile', sub: 'Your skills decide your match score on every gig' },
  };

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n) { return 'RM ' + (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

  function timeAgo(iso) {
    var diffMs = Date.now() - new Date(iso).getTime();
    var hours = Math.round(diffMs / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return hours + 'h ago';
    var days = Math.round(hours / 24);
    return days + 'd ago';
  }

  var toastTimer = null;
  function toast(msg, isError) {
    var el = $('toast');
    el.textContent = msg;
    el.className = isError ? 'toast is-error' : 'toast';
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3600);
  }

  function showErrors(boxId, errors) {
    var box = $(boxId);
    if (!errors || !errors.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = '<ul>' + errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
    box.hidden = false;
  }

  function api(path, options) {
    var opts = options || {};
    var config = { method: opts.method || 'GET', headers: {} };
    if (opts.body) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(opts.body);
    }
    return fetch('/api' + path, config).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error('Request failed');
          err.errors = (data && data.errors) || ['Something went wrong. Try again.'];
          throw err;
        }
        return data;
      });
    }).catch(function (err) {
      if (err.errors) throw err;
      var wrapped = new Error('Network error');
      wrapped.errors = ['Cannot reach the server. Make sure it is still running.'];
      throw wrapped;
    });
  }

  /* ---------------------------------------------------------------- */

  function loadAll() {
    return Promise.all([
      api('/overview'),
      api('/my-gigs'),
      api('/my-applications'),
      api('/transactions'),
    ]).then(function (results) {
      state.me = results[0].me;
      state.stats = results[0].stats;
      state.myGigs = results[1];
      state.myApplications = results[2];
      state.transactions = results[3];
      return loadBrowse();
    }).then(renderEverything).catch(function (err) {
      toast(err.errors ? err.errors[0] : 'Could not load your data.', true);
    });
  }

  function loadBrowse() {
    var params = new URLSearchParams();
    if (state.searchQuery) params.set('q', state.searchQuery);
    if (state.categoryFilter) params.set('category', state.categoryFilter);
    if (state.remoteOnly) params.set('remote', '1');
    return api('/gigs?' + params.toString()).then(function (data) {
      state.browseGigs = data;
    });
  }

  /* ---------------------------------------------------------------- */

  function renderEverything() {
    renderChrome();
    renderBrowse();
    renderMyGigs();
    renderApplications();
    renderEarnings();
    fillProfileForm();
  }

  function renderChrome() {
    $('railName').textContent = state.me.name;
    $('railSkills').textContent = state.me.skills.join(' · ');
    $('navOpenCount').textContent = state.stats.openGigsAvailable;
    $('navAppCount').textContent = state.stats.myPendingApplications;
    var copy = VIEW_COPY[state.view];
    $('viewTitle').textContent = copy.title;
    $('viewSubtitle').textContent = copy.sub;
  }

  function matchClass(score) {
    if (score >= 60) return 'high';
    if (score >= 25) return 'mid';
    return 'low';
  }

  function renderBrowse() {
    $('statOpen').textContent = state.stats.openGigsAvailable;
    $('statPending').textContent = state.stats.myPendingApplications;
    $('statAccepted').textContent = state.stats.myAcceptedApplications;

    var grid = $('browseGrid');
    if (!state.browseGigs.length) {
      grid.innerHTML = '<div class="empty"><strong>No gigs match right now</strong>Try a different search term or clear the filters.</div>';
      return;
    }

    var appliedIds = state.myApplications.map(function (a) { return a.gigId; });

    grid.innerHTML = state.browseGigs.map(function (g) {
      var already = appliedIds.indexOf(g.id) !== -1;
      var skillsHtml = g.skillsRequired.map(function (s) {
        var isMatched = g.matchedSkills.some(function (m) { return s.toLowerCase().includes(m) || m.includes(s.toLowerCase()); });
        return '<span class="skill-pill' + (isMatched ? ' is-matched' : '') + '">' + esc(s) + '</span>';
      }).join('');

      return (
        '<div class="gig-card">' +
          '<div class="gig-top">' +
            '<div>' +
              '<div class="gig-title">' + esc(g.title) + '</div>' +
              '<div class="gig-meta">' + esc(g.posterName) + ' · ' + CATEGORY_LABEL[g.category] + ' · ' + esc(g.location) + ' · ' + timeAgo(g.createdAt) + '</div>' +
            '</div>' +
            '<div class="gig-budget">' + money(g.budgetRM) + '</div>' +
          '</div>' +
          '<div class="gig-desc">' + esc(g.description) + '</div>' +
          '<div class="gig-skills">' + skillsHtml + '</div>' +
          '<div class="gig-foot">' +
            '<span class="match-badge ' + matchClass(g.matchScore) + '">' + g.matchScore + '% skill match</span>' +
            (already
              ? '<span class="tag tag-pending">Already applied</span>'
              : '<button class="btn btn-primary btn-sm" data-action="apply" data-id="' + esc(g.id) + '">Apply</button>') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderMyGigs() {
    var box = $('myGigsList');
    if (!state.myGigs.length) {
      box.innerHTML = '<div class="empty"><strong>You have not posted a gig yet</strong>Post one from the sidebar to start receiving applications.</div>';
      return;
    }

    box.innerHTML = state.myGigs.map(function (g) {
      var statusTag = g.status === 'open' ? '<span class="tag tag-open">Open</span>'
        : g.status === 'in_progress' ? '<span class="tag tag-progress">In progress</span>'
        : '<span class="tag tag-done">Completed</span>';

      var pending = g.applications.filter(function (a) { return a.status === 'pending'; });
      var accepted = g.applications.find(function (a) { return a.status === 'accepted'; });

      var applicantsHtml = g.applications.length
        ? g.applications.map(function (a) {
            var statusBadge = a.status === 'accepted' ? '<span class="tag tag-accepted">Accepted</span>'
              : a.status === 'rejected' ? '<span class="tag tag-rejected">Rejected</span>'
              : '<span class="tag tag-pending">Pending</span>';
            var actions = (a.status === 'pending' && g.status === 'open')
              ? '<div class="applicant-actions">' +
                  '<button class="btn btn-quiet btn-sm" data-action="accept-app" data-id="' + esc(a.id) + '">Accept</button>' +
                  '<button class="btn btn-danger btn-sm" data-action="reject-app" data-id="' + esc(a.id) + '">Reject</button>' +
                '</div>'
              : statusBadge;
            return (
              '<div class="applicant">' +
                '<div><div class="applicant-name">' + esc(a.applicantName) + '</div>' +
                  '<div class="applicant-msg">' + esc(a.message) + '</div></div>' +
                actions +
              '</div>'
            );
          }).join('')
        : '<div class="empty">No applicants yet.</div>';

      var completeButton = (g.status === 'in_progress' && accepted)
        ? '<button class="btn btn-money btn-sm" data-action="complete-gig" data-id="' + esc(g.id) + '">' +
            'Mark complete & pay ' + esc(accepted.applicantName) +
          '</button>'
        : '';

      return (
        '<div class="panel">' +
          '<div class="panel-head">' +
            '<div>' +
              '<h2>' + esc(g.title) + '</h2>' +
              '<p>' + CATEGORY_LABEL[g.category] + ' · ' + money(g.budgetRM) + ' · ' + esc(g.location) + '</p>' +
            '</div>' +
            statusTag +
          '</div>' +
          '<div class="panel-body">' +
            applicantsHtml +
            (completeButton ? '<div style="margin-top:12px">' + completeButton + '</div>' : '') +
            (g.status === 'open'
              ? '<div style="margin-top:12px"><button class="btn btn-danger btn-sm" data-action="delete-gig" data-id="' + esc(g.id) + '">Delete gig</button></div>'
              : '') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderApplications() {
    var box = $('myApplicationsList');
    if (!state.myApplications.length) {
      box.innerHTML = '<div class="empty"><strong>You have not applied to any gigs yet</strong>Browse gigs and apply to ones that match your skills.</div>';
      return;
    }

    box.innerHTML = state.myApplications.map(function (a) {
      if (!a.gig) return '';
      var statusTag = a.status === 'accepted' ? '<span class="tag tag-accepted">Accepted</span>'
        : a.status === 'rejected' ? '<span class="tag tag-rejected">Not selected</span>'
        : '<span class="tag tag-pending">Waiting for reply</span>';
      return (
        '<div class="applicant">' +
          '<div>' +
            '<div class="applicant-name">' + esc(a.gig.title) + ' — ' + money(a.gig.budgetRM) + '</div>' +
            '<div class="applicant-msg">Your message: ' + esc(a.message) + '</div>' +
          '</div>' +
          statusTag +
        '</div>'
      );
    }).join('');
  }

  function renderEarnings() {
    $('earnTotal').textContent = money(state.stats.totalEarnedRM);
    $('earnPaid').textContent = money(state.stats.totalPaidRM);
    $('earnCommission').textContent = money(state.stats.totalCommissionRM);

    var box = $('txTable');
    if (!state.transactions.length) {
      box.innerHTML = '<div class="empty"><strong>No transactions yet</strong>Completing a gig you posted will record a payment here.</div>';
      return;
    }

    box.innerHTML =
      '<table><thead><tr><th>Date</th><th>With</th><th>Amount</th><th>Commission</th><th>Payout</th></tr></thead><tbody>' +
      state.transactions.map(function (t) {
        return (
          '<tr>' +
            '<td>' + new Date(t.at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) + '</td>' +
            '<td>' + esc(t.counterparty) + '</td>' +
            '<td>' + money(t.amountRM) + '</td>' +
            '<td>' + money(t.commissionRM) + '</td>' +
            '<td>' + money(t.payoutRM) + '</td>' +
          '</tr>'
        );
      }).join('') +
      '</tbody></table>';
  }

  function fillProfileForm() {
    $('pName').value = state.me.name;
    $('pBio').value = state.me.bio;
    $('pSkills').value = state.me.skills.join(', ');
  }

  /* ---------------------------------------------------------------- */
  /*  Navigation                                                       */
  /* ---------------------------------------------------------------- */

  function switchView(name) {
    if (!VIEW_COPY[name]) return;
    state.view = name;
    var buttons = document.querySelectorAll('.nav-item');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-active', buttons[i].getAttribute('data-view') === name);
    }
    var views = document.querySelectorAll('.view');
    for (var j = 0; j < views.length; j++) {
      views[j].hidden = views[j].id !== 'view-' + name;
    }
    renderChrome();
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- */
  /*  Events                                                           */
  /* ---------------------------------------------------------------- */

  document.addEventListener('click', function (event) {
    var navBtn = event.target.closest('.nav-item');
    if (navBtn) { switchView(navBtn.getAttribute('data-view')); return; }

    var actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;
    var action = actionBtn.getAttribute('data-action');
    var id = actionBtn.getAttribute('data-id');

    if (action === 'apply') {
      var message = prompt('Write a short message about why you are a good fit for this gig:');
      if (message === null) return;
      api('/applications', { method: 'POST', body: { gigId: id, message: message } })
        .then(function () { toast('Application sent.'); return loadAll(); })
        .catch(function (err) { toast(err.errors[0], true); });
    } else if (action === 'accept-app') {
      api('/applications/' + id + '/status', { method: 'PUT', body: { status: 'accepted' } })
        .then(function () { toast('Applicant accepted. Gig marked in progress.'); return loadAll(); })
        .catch(function (err) { toast(err.errors[0], true); });
    } else if (action === 'reject-app') {
      api('/applications/' + id + '/status', { method: 'PUT', body: { status: 'rejected' } })
        .then(function () { toast('Applicant rejected.'); return loadAll(); })
        .catch(function (err) { toast(err.errors[0], true); });
    } else if (action === 'complete-gig') {
      if (!confirm('Mark this gig as complete and release payment? This simulates the payment split.')) return;
      api('/gigs/' + id + '/complete', { method: 'POST' })
        .then(function (data) {
          toast('Payment released. GigNest commission: ' + money(data.commissionRM) + '.');
          return loadAll();
        })
        .catch(function (err) { toast(err.errors[0], true); });
    } else if (action === 'delete-gig') {
      if (!confirm('Delete this gig? This cannot be undone.')) return;
      api('/gigs/' + id, { method: 'DELETE' })
        .then(function () { toast('Gig deleted.'); return loadAll(); })
        .catch(function (err) { toast(err.errors[0], true); });
    }
  });

  var searchDebounce = null;
  $('searchInput').addEventListener('input', function (e) {
    state.searchQuery = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(function () {
      loadBrowse().then(renderBrowse);
    }, 250);
  });

  $('categoryFilter').addEventListener('change', function (e) {
    state.categoryFilter = e.target.value;
    loadBrowse().then(renderBrowse);
  });

  $('remoteFilter').addEventListener('change', function (e) {
    state.remoteOnly = e.target.checked;
    loadBrowse().then(renderBrowse);
  });

  $('gRemote').addEventListener('change', function (e) {
    $('gLocationField').hidden = e.target.checked;
  });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('Reset everything back to the sample data?')) return;
    api('/reset', { method: 'POST' })
      .then(function () { toast('Demo data restored.'); return loadAll(); })
      .catch(function (err) { toast(err.errors[0], true); });
  });

  /* ---- Forms ---- */

  $('gigForm').addEventListener('submit', function (event) {
    event.preventDefault();
    showErrors('gigErrors', null);

    var skills = $('gSkills').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var body = {
      title: $('gTitle').value,
      description: $('gDesc').value,
      category: $('gCategory').value,
      budgetRM: $('gBudget').value,
      remote: $('gRemote').checked,
      location: $('gLocation').value,
      skillsRequired: skills,
    };

    api('/gigs', { method: 'POST', body: body })
      .then(function () {
        $('gigForm').reset();
        $('gLocationField').hidden = true;
        toast('Gig posted. Workers can now apply.');
        switchView('mygigs');
        return loadAll();
      })
      .catch(function (err) { showErrors('gigErrors', err.errors); });
  });

  $('profileForm').addEventListener('submit', function (event) {
    event.preventDefault();
    showErrors('profileErrors', null);

    var skills = $('pSkills').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var body = { name: $('pName').value, bio: $('pBio').value, skills: skills };

    api('/profile', { method: 'PUT', body: body })
      .then(function () { toast('Profile saved. Your match scores will update.'); return loadAll(); })
      .catch(function (err) { showErrors('profileErrors', err.errors); });
  });

  loadAll();
})();
