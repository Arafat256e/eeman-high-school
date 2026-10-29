
(() => {
  const $ = s => document.querySelector(s);
  const loginCard = $('#login-card');
  const app = $('#admin-app');
  const panel = $('#panel');
  const status = $('#login-status');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  const tables = {
    programs: {
      table: 'ehs_programs',
      title: 'Academic programmes',
      fields: [
        ['title', 'Programme name', 'text', true],
        ['level', 'Level / category', 'text', true],
        ['description', 'Description', 'textarea', true],
        ['display_order', 'Display order', 'number'],
        ['published', 'Published', 'checkbox']
      ]
    },
    news: {
      table: 'ehs_news_events',
      title: 'Calendar & news',
      fields: [
        ['title', 'Title', 'text', true],
        ['category', 'Type (News / Event / Calendar)', 'text'],
        ['event_date', 'Event date', 'date'],
        ['body', 'Description', 'textarea', true],
        ['image_url', 'Image URL (optional if uploading)', 'text'],
        ['image_file', 'Upload image', 'file'],
        ['published', 'Published', 'checkbox']
      ]
    },
    staff: {
      table: 'ehs_staff',
      title: 'Staff profiles',
      fields: [
        ['name', 'Staff member name', 'text', true],
        ['role', 'Role / subject', 'text', true],
        ['bio', 'Short biography', 'textarea'],
        ['image_url', 'Photo URL (optional if uploading)', 'text'],
        ['image_file', 'Upload staff photo', 'file'],
        ['display_order', 'Display order', 'number'],
        ['published', 'Published', 'checkbox']
      ]
    },
    gallery: {
      table: 'ehs_gallery',
      title: 'Campus life photo gallery',
      fields: [
        ['caption', 'Photo caption', 'text', true],
        ['image_url', 'Image URL (optional if uploading)', 'text'],
        ['image_file', 'Upload photo', 'file'],
        ['display_order', 'Display order', 'number'],
        ['published', 'Published', 'checkbox']
      ]
    },
    testimonials: {
      table: 'ehs_testimonials',
      title: 'Testimonials',
      fields: [
        ['person_name', 'Parent / student name', 'text', true],
        ['relationship', 'Relationship (Parent / Student / Alumni)', 'text'],
        ['quote', 'Testimonial text', 'textarea', true],
        ['display_order', 'Display order', 'number'],
        ['published', 'Published', 'checkbox']
      ]
    },
    faqs: {
      table: 'ehs_faqs',
      title: 'Frequently asked questions',
      fields: [
        ['question', 'Question', 'text', true],
        ['answer', 'Answer', 'textarea', true],
        ['display_order', 'Display order', 'number'],
        ['published', 'Published', 'checkbox']
      ]
    }
  };

  let active = 'settings';
  let editing = null;
  let cached = [];

  function connected() {
    return window.supabaseReady && window.schoolSupabase;
  }

  function setStatus(msg) {
    status.textContent = msg;
  }

  async function isAdmin() {
    if (!connected()) return false;

    const { data: { user } } =
      await window.schoolSupabase.auth.getUser();

    if (!user) return false;

    $('#signed-in-as').textContent = `Signed in as ${user.email}`;

    const { data, error } = await window.schoolSupabase
      .from('ehs_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn(error);
      return false;
    }

    return !!data;
  }

  async function refreshAuth() {
    if (!connected()) {
      loginCard.classList.remove('hidden');
      setStatus(
        'Supabase is not configured. Update js/supabase.js with your existing project URL and publishable/anon key.'
      );
      return;
    }

    const { data: { session } } =
      await window.schoolSupabase.auth.getSession();

    if (!session) {
      loginCard.classList.remove('hidden');
      app.classList.add('hidden');
      return;
    }

    if (await isAdmin()) {
      loginCard.classList.add('hidden');
      app.classList.remove('hidden');
      renderPanel();
    } else {
      await window.schoolSupabase.auth.signOut();
      loginCard.classList.remove('hidden');
      setStatus(
        'This account is not listed as an authorised school admin. Follow README.md to grant admin access.'
      );
    }
  }

  $('#login-form')?.addEventListener('submit', async e => {
    e.preventDefault();

    if (!connected()) {
      setStatus('Supabase is not configured. Check js/supabase.js.');
      return;
    }

    setStatus('Signing in…');

    const { error } = await window.schoolSupabase.auth
      .signInWithPassword({
        email: $('#email').value.trim(),
        password: $('#password').value
      });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus('');
    await refreshAuth();
  });

  $('#logout')?.addEventListener('click', async () => {
    await window.schoolSupabase?.auth.signOut();
    app.classList.add('hidden');
    loginCard.classList.remove('hidden');
    setStatus('You have signed out.');
  });

  $('#tabs')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;

    active = b.dataset.tab;
    editing = null;

    $('#tabs').querySelectorAll('button').forEach(x => {
      x.classList.toggle('active', x === b);
    });

    renderPanel();
  });

  function fieldHtml(f, record = {}) {
    const [key, label, type, required] = f;
    const val = record[key] ??
      (key === 'published' ? true :
       key === 'display_order' ? 0 : '');

    if (type === 'checkbox') {
      return `<label style="display:flex;gap:9px;align-items:center">
        <input style="width:auto" name="${key}" type="checkbox"
          ${val ? 'checked' : ''}> ${label}
      </label>`;
    }

    if (type === 'file') {
      return `<label>${label}</label>
        <input name="${key}" type="file" accept="image/*">`;
    }

    if (type === 'textarea') {
      return `<label>${label}</label>
        <textarea name="${key}" ${required ? 'required' : ''}>${esc(val)}</textarea>`;
    }

    return `<label>${label}</label>
      <input name="${key}" type="${type}" value="${esc(val)}"
        ${required ? 'required' : ''}
        ${type === 'number' ? 'step="1"' : ''}>`;
  }

  async function renderPanel() {
    if (!connected()) {
      panel.innerHTML =
        '<p class="notice">Supabase is not configured. Update js/supabase.js.</p>';
      return;
    }

    if (active === 'settings') {
      await renderSettings();
      return;
    }

    if (active === 'inquiries') {
      await renderInquiries();
      return;
    }

    const cfg = tables[active];
    if (!cfg) return;

    panel.innerHTML = `
      <h2>${cfg.title}</h2>
      <p class="admin-intro">
        Add new content or choose an existing item to edit.
        Published items appear on the public website.
      </p>
      <form id="content-form" class="admin-form">
        <div class="admin-grid">
          ${cfg.fields.map(f =>
            `<div>${fieldHtml(f, editing || {})}</div>`
          ).join('')}
        </div>
        <button class="btn btn-purple" type="submit">
          ${editing ? 'Save changes' : 'Add item'} <span>↗</span>
        </button>
        <button type="button" id="cancel-edit"
          class="btn btn-outline"
          style="color:var(--purple);border-color:var(--purple)">
          Clear form
        </button>
        <p id="content-status" role="status"></p>
      </form>
      <hr style="border:0;border-top:1px solid var(--line);margin:26px 0">
      <h3>Current items</h3>
      <div id="content-list">Loading…</div>
    `;

    $('#cancel-edit').onclick = () => {
      editing = null;
      renderPanel();
    };

    $('#content-form').onsubmit = e => saveContent(e, cfg);

    await loadList(cfg);
  }

  async function uploadImage(file) {
    if (!file) return null;

    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Image must be smaller than 8 MB.');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file.');
    }

    const ext = (file.name.split('.').pop() || 'jpg')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await window.schoolSupabase.storage
      .from('ehs-media')
      .upload(path, file, {
        upsert: false,
        contentType: file.type
      });

    if (error) throw error;

    const { data } = window.schoolSupabase.storage
      .from('ehs-media')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function saveContent(e, cfg) {
    e.preventDefault();

    const form = e.currentTarget;
    const btn = form.querySelector('button[type=submit]');
    const out = $('#content-status');

    btn.disabled = true;
    out.textContent = 'Saving…';

    try {
      const fd = new FormData(form);
      const row = {};

      cfg.fields.forEach(([key, , type]) => {
        if (type === 'file') return;

        if (type === 'checkbox') {
          row[key] = fd.get(key) === 'on';
        } else if (type === 'number') {
          row[key] = Number(fd.get(key) || 0);
        } else {
          row[key] = fd.get(key) || null;
        }
      });

      const file = fd.get('image_file');

      if (file?.size) {
        row.image_url = await uploadImage(file);
      }

      if (editing?.id) {
        row.updated_at = new Date().toISOString();

        const { error } = await window.schoolSupabase
          .from(cfg.table)
          .update(row)
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await window.schoolSupabase
          .from(cfg.table)
          .insert(row);

        if (error) throw error;
      }

      out.textContent = 'Saved successfully.';
      editing = null;
      await renderPanel();

    } catch (err) {
      console.error(err);
      out.textContent =
        'Could not save: ' +
        (err.message || 'Check Supabase permissions and schema.');
    } finally {
      btn.disabled = false;
    }
  }

  async function loadList(cfg) {
    const target = $('#content-list');

    const { data, error } = await window.schoolSupabase
      .from(cfg.table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      target.innerHTML =
        `<p class="notice">Could not load items: ${esc(error.message)}. Check the SQL schema and admin permissions.</p>`;
      return;
    }

    cached = data || [];

    target.innerHTML = cached.length
      ? cached.map(r => `
        <div class="admin-list-item">
          <div>
            <p>
              <strong>${esc(
                r.title || r.name || r.person_name ||
                r.question || r.caption || 'Item'
              )}</strong>
              ${r.published === false
                ? '<small>· Draft</small>'
                : '<small>· Published</small>'}
            </p>
            <small>${esc(
              (r.description || r.body || r.role ||
               r.answer || r.quote || '').slice(0, 120)
            )}</small>
          </div>
          <div style="display:flex;gap:7px">
            <button class="btn btn-outline"
              style="padding:7px 10px;color:var(--purple);border-color:var(--purple)"
              data-edit="${r.id}">Edit</button>
            <button class="danger-btn" data-delete="${r.id}">
              Delete
            </button>
          </div>
        </div>
      `).join('')
      : '<p class="admin-intro">No items yet. Use the form above to add your first item.</p>';

    target.querySelectorAll('[data-edit]').forEach(b => {
      b.onclick = () => {
        editing = cached.find(x => String(x.id) === b.dataset.edit);
        renderPanel();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    target.querySelectorAll('[data-delete]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('Delete this item? This cannot be undone.')) return;

        const { error } = await window.schoolSupabase
          .from(cfg.table)
          .delete()
          .eq('id', b.dataset.delete);

        if (error) {
          alert('Delete failed: ' + error.message);
        } else {
          loadList(cfg);
        }
      };
    });
  }

  async function renderSettings() {
    const { data, error } = await window.schoolSupabase
      .from('ehs_site_settings')
      .select('*')
      .order('key');

    if (error) {
      panel.innerHTML =
        `<p class="notice">Could not load settings: ${esc(error.message)}</p>`;
      return;
    }

    const vals = Object.fromEntries(
      (data || []).map(x => [x.key, x.value])
    );

    const items = [
      ['school_name_brand', 'School name'],
      ['school_motto_brand', 'School motto'],
      ['hero_eyebrow', 'Home hero eyebrow'],
      ['hero_title', 'Home hero title (use | between two parts for emphasis)'],
      ['hero_description', 'Home hero introduction'],
      ['about_title', 'About section heading'],
      ['about_text', 'About section text'],
      ['contact_phone', 'Contact phone'],
      ['contact_email', 'Contact email'],
      ['contact_address', 'School address']
    ];

    panel.innerHTML = `
      <h2>School information & homepage</h2>
      <p class="admin-intro">
        Edit the core school details and the main text shown on the public homepage.
      </p>
      <form id="settings-form" class="admin-form">
        <div class="admin-grid">
          ${items.map(([k, l]) => `
            <div>
              <label>${l}</label>
              ${['hero_description', 'about_text'].includes(k)
                ? `<textarea name="${k}">${esc(vals[k] || '')}</textarea>`
                : `<input name="${k}" value="${esc(vals[k] || '')}">`}
            </div>
          `).join('')}
        </div>
        <button class="btn btn-purple" type="submit">
          Save school information ↗
        </button>
        <p id="settings-status" role="status"></p>
      </form>
      <p class="notice">
        School crest: the current logo is included in
        <code>assets/school-logo.jpeg</code>. To change it, replace that
        image in your repository. You can upload staff, news and gallery
        images in their respective tabs.
      </p>
    `;

    $('#settings-form').onsubmit = async e => {
      e.preventDefault();

      const out = $('#settings-status');
      out.textContent = 'Saving…';

      const fd = new FormData(e.currentTarget);
      const rows = items.map(([key]) => ({
        key,
        value: String(fd.get(key) || '').trim()
      }));

      const { error } = await window.schoolSupabase
        .from('ehs_site_settings')
        .upsert(rows, { onConflict: 'key' });

      out.textContent = error
        ? 'Could not save: ' + error.message
        : 'Saved successfully. Refresh the public website to see changes.';
    };
  }

  // UPDATED: Contact enquiries with editable status
  async function renderInquiries() {
    panel.innerHTML = `
      <h2>Contact enquiries</h2>
      <p class="admin-intro">
        Messages sent through the public contact form.
        Update each message status as you handle it.
      </p>
      <div id="inquiry-list">Loading…</div>
    `;

    const { data, error } = await window.schoolSupabase
      .from('ehs_contact_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const target = $('#inquiry-list');

    if (error) {
      target.innerHTML =
        `<p class="notice">Could not load enquiries: ${esc(error.message)}</p>`;
      return;
    }

    if (!data?.length) {
      target.innerHTML =
        '<p class="admin-intro">No enquiries yet.</p>';
      return;
    }

    const statuses = [
      { value: 'new', label: 'New' },
      { value: 'read', label: 'Read' },
      { value: 'replied', label: 'Replied' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'archived', label: 'Archived' }
    ];

    target.innerHTML = data.map(x => {
      const currentStatus = statuses.some(s => s.value === x.status)
        ? x.status
        : 'new';

      return `
        <article class="admin-card">
          <p>
            <strong>${esc(x.subject || 'No subject')}</strong>
            · <small>${esc(new Date(x.created_at).toLocaleString())}</small>
          </p>
          <p>
            ${esc(x.name)} ·
            <a href="mailto:${esc(x.email)}">${esc(x.email)}</a>
          </p>
          <p style="white-space:pre-wrap">${esc(x.message)}</p>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px">
            <label for="inquiry-status-${esc(x.id)}">Status</label>

            <select id="inquiry-status-${esc(x.id)}"
              data-inquiry-status="${esc(x.id)}"
              style="max-width:190px">
              ${statuses.map(s => `
                <option value="${s.value}"
                  ${s.value === currentStatus ? 'selected' : ''}>
                  ${s.label}
                </option>
              `).join('')}
            </select>

            <span id="inquiry-save-${esc(x.id)}"
              role="status" aria-live="polite"></span>
          </div>
        </article>
      `;
    }).join('');

    target.querySelectorAll('[data-inquiry-status]').forEach(select => {
      select.addEventListener('change', async () => {
        const id = select.dataset.inquiryStatus;
        const output = document.getElementById(`inquiry-save-${id}`);

        select.disabled = true;
        output.textContent = 'Saving…';

        try {
          const { data: updatedRows, error: updateError } =
  await window.schoolSupabase
    .from('ehs_contact_inquiries')
    .update({ status: select.value })
    .eq('id', id)
    .select('id, status');

if (updateError) {
  throw updateError;
}

if (!updatedRows || updatedRows.length === 0) {
  throw new Error(
    'No row was updated. Check the record ID and Supabase permissions.'
  );
}

output.textContent = 'Status saved successfully.';

          if (updateError) throw updateError;

          output.textContent = 'Status saved successfully.';
        } catch (err) {
          console.error('Could not update enquiry status:', err);
          output.textContent =
            'Could not save: ' + (err.message || 'Please try again.');
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  refreshAuth();
})();
